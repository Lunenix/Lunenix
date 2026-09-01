"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import {
  ensureVoicesLoaded,
  pickFemaleVoice,
  isLunaWakePhrase,
  stripLunaWakePhrase,
  LUNA_AVATAR_URL,
} from "@/lib/luna";
import type { WorkspaceAISettings } from "@/types/database";
import { LunaSettingsModal } from "./LunaSettingsModal";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Loader2, Mic, MicOff, Play, Send, Settings, Video, VideoOff } from "lucide-react";
import type { SimliClient } from "simli-client/dist/client";

/* -------------------------------------------------------------------------- */
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal?: boolean; 0: { transcript: string } };
  };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SIMLI_PCM_CHUNK = 6000;
const PCM_HZ = 16000;

function sendPcmChunks(client: SimliClient, bytes: Uint8Array) {
  const even = bytes.length & ~1;
  let offset = 0;
  while (offset + SIMLI_PCM_CHUNK <= even) {
    client.sendAudioData(bytes.subarray(offset, offset + SIMLI_PCM_CHUNK));
    offset += SIMLI_PCM_CHUNK;
  }
  if (offset < even) client.sendAudioData(bytes.subarray(offset, even));
}

async function playMp3(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const audio = new Audio(url);
    audio.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      void audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Status =
  | "disconnected"
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking";

interface LunaCommandCenterProps {
  workspaceId: string;
}

export function LunaCommandCenter({ workspaceId }: LunaCommandCenterProps) {
  const [settings, setSettings] = useState<WorkspaceAISettings | null>(null);
  const [instruction, setInstruction] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<Status>("disconnected");
  const [isAdmin, setIsAdmin] = useState(false);
  const [live, setLive] = useState(false);
  const [chatLog, setChatLog] = useState<
    { role: "user" | "luna"; text: string }[]
  >([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const wakeRecRef = useRef<SpeechRecognitionLike | null>(null);
  const commandMicRef = useRef(false);
  const pauseWakeRef = useRef(false);
  const wakeWantedRef = useRef(true);
  const handleSubmitRef = useRef<(text: string) => Promise<void>>(
    async () => {}
  );
  const sessionGenRef = useRef(0);
  const liveRef = useRef(false);
  const wantedRef = useRef(false);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLiveRef = useRef<() => Promise<boolean>>(async () => false);
  const pendingActionRef = useRef<string | null>(null);

  const agentName = settings?.agent_name || "Luna";

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/workspaces/ai-settings?workspaceId=${workspaceId}`
        );
        const data = await res.json();
        if (!cancelled) setSettings(data.settings ?? null);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const superAdmin =
          (data.user?.app_metadata as { is_super_admin?: boolean } | undefined)
            ?.is_super_admin === true;
        if (!cancelled) setIsAdmin(superAdmin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!wantedRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      connectPromiseRef.current = null;
      liveRef.current = false;
      void startLiveRef.current();
    }, 1500);
  }, []);

  const startLive = useCallback(async (): Promise<boolean> => {
    if (simliRef.current && liveRef.current) return true;
    if (connectPromiseRef.current) return connectPromiseRef.current;
    if (!wantedRef.current) return false;

    const run = (async () => {
      setStatus((prev) =>
        prev === "disconnected" || prev === "idle" ? "connecting" : prev
      );
      // Video must exist and stay unoccluded — Simli only emits "start"
      // after requestVideoFrameCallback, which never fires under an overlay.
      for (let i = 0; i < 20 && (!videoRef.current || !audioRef.current); i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const videoEl = videoRef.current;
      const audioEl = audioRef.current;
      if (!videoEl || !audioEl || !wantedRef.current) return false;

      const gen = ++sessionGenRef.current;
      try {
        const sessionRes = await fetch("/api/simli-session", { method: "POST" });
        if (!sessionRes.ok) {
          scheduleReconnect();
          return false;
        }
        const sessionData = await sessionRes.json();
        const sessionToken: string | undefined = sessionData?.sessionToken;
        if (!sessionToken) {
          scheduleReconnect();
          return false;
        }

        const iceServers: RTCIceServer[] =
          Array.isArray(sessionData?.iceServers) && sessionData.iceServers.length
            ? sessionData.iceServers
            : [{ urls: ["stun:stun.l.google.com:19302"] }];

        const { SimliClient } = await import("simli-client/dist/client.js");
        const client = new SimliClient(
          sessionToken,
          videoEl,
          audioEl,
          iceServers
        );
        simliRef.current = client;

        const bumpPlay = () => {
          void videoEl.play().catch(() => undefined);
          audioEl.muted = false;
          void audioEl.play().catch(() => undefined);
        };
        bumpPlay();
        videoEl.addEventListener("loadeddata", bumpPlay);
        videoEl.addEventListener("playing", () => setLive(true), { once: true });

        let started = false;
        const onSessionEnded = () => {
          if (gen !== sessionGenRef.current) return;
          if (simliRef.current === client) simliRef.current = null;
          liveRef.current = false;
          connectPromiseRef.current = null;
          if (started) scheduleReconnect();
        };
        client.on("stop", onSessionEnded);
        client.on("startup_error", onSessionEnded);

        await client.start();
        videoEl.removeEventListener("loadeddata", bumpPlay);
        if (gen !== sessionGenRef.current || !wantedRef.current) return false;
        started = true;
        liveRef.current = true;
        setLive(true);
        setStatus((prev) => (prev === "connecting" ? "idle" : prev));
        bumpPlay();
        return true;
      } catch {
        if (gen === sessionGenRef.current) {
          try {
            void simliRef.current?.stop();
          } catch {
            /* ignore */
          }
          simliRef.current = null;
          liveRef.current = false;
          scheduleReconnect();
        }
        return false;
      }
    })();

    connectPromiseRef.current = run;
    void run.finally(() => {
      if (connectPromiseRef.current === run) connectPromiseRef.current = null;
    });
    return run;
  }, [scheduleReconnect]);

  startLiveRef.current = startLive;

  const stopAvatarSession = useCallback(() => {
    wantedRef.current = false;
    sessionGenRef.current += 1;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    connectPromiseRef.current = null;
    try {
      void simliRef.current?.stop();
    } catch {
      /* ignore */
    }
    simliRef.current = null;
    liveRef.current = false;
    setLive(false);
    setStatus("disconnected");
  }, []);

  const startAvatarSession = useCallback(async (): Promise<boolean> => {
    wantedRef.current = true;
    return startLive();
  }, [startLive]);

  // Do not mint a Simli session until the user starts one. Always tear down on leave.
  useEffect(() => {
    return () => {
      wantedRef.current = false;
      sessionGenRef.current += 1;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      try {
        void simliRef.current?.stop();
      } catch {
        /* ignore */
      }
      simliRef.current = null;
      liveRef.current = false;
      connectPromiseRef.current = null;
    };
  }, []);

  const speakFallback = useCallback(async (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("idle");
      return;
    }
    const voices = await ensureVoicesLoaded();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const female = pickFemaleVoice(voices);
    if (female) utterance.voice = female;
    utterance.pitch = 1.15;
    utterance.rate = 0.98;
    await new Promise<void>((resolve) => {
      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => {
        setStatus("idle");
        resolve();
      };
      utterance.onerror = () => {
        setStatus("idle");
        resolve();
      };
      synth.speak(utterance);
    });
  }, []);

  const speakMp3 = useCallback(async (text: string) => {
    setStatus("speaking");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, format: "mp3" }),
    });
    if (res.status === 503) {
      await speakFallback(text);
      return;
    }
    if (!res.ok) throw new Error(await res.text());
    await playMp3(await res.blob());
    setStatus("idle");
  }, [speakFallback]);

  const pauseWakeListening = useCallback(() => {
    pauseWakeRef.current = true;
    try {
      wakeRecRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const resumeWakeListening = useCallback(() => {
    pauseWakeRef.current = false;
    try {
      wakeRecRef.current?.start();
    } catch {
      /* already running */
    }
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      pauseWakeListening();
      setStatus("speaking");
      try {
        wantedRef.current = true;
        const simliOk = await startLive();
        const client = simliRef.current;

        if (simliOk && client && liveRef.current) {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, format: "pcm" }),
          });
          if (res.status === 503) {
            await speakFallback(text);
            return;
          }
          if (!res.ok || !res.body) throw new Error("TTS failed");
          const buf = new Uint8Array(await res.arrayBuffer());
          sendPcmChunks(client, buf);
          const durationMs = Math.max(800, (buf.length / 2 / PCM_HZ) * 1000 + 400);
          await new Promise((r) => setTimeout(r, durationMs));
          setStatus("idle");
          return;
        }

        await speakMp3(text);
      } catch (e) {
        try {
          await speakMp3(text);
        } catch {
          toast(
            e instanceof Error
              ? `Voice error: ${e.message.slice(0, 120)}`
              : "Voice generation failed.",
            "error"
          );
          await speakFallback(text);
        }
      } finally {
        resumeWakeListening();
      }
    },
    [
      pauseWakeListening,
      resumeWakeListening,
      speakFallback,
      speakMp3,
      startLive,
    ]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const raw = text.trim();
      if (!raw) return;
      if (!workspaceId) {
        toast("No workspace selected.", "error");
        return;
      }
      setInstruction("");
      const woke = isLunaWakePhrase(raw);
      const command = woke ? stripLunaWakePhrase(raw) : raw;

      setChatLog((prev) => [...prev, { role: "user", text: raw }]);
      wantedRef.current = true;
      void startLive();
      setStatus("thinking");

      const forGemini =
        command ||
        (woke
          ? "The user just said hello and woke you. Greet them briefly as Luna."
          : raw);

      try {
        const res = await fetch("/api/luna/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: forGemini,
            workspaceId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            pendingAction: pendingActionRef.current,
          }),
        });
        if (res.status === 401) {
          toast("Sign in to talk to Luna.", "error");
          setStatus("idle");
          return;
        }
        const data = await res.json();
        pendingActionRef.current =
          typeof data?.pendingAction === "string" ? data.pendingAction : null;
        const reply: string =
          (typeof data?.text === "string" && data.text.trim()) ||
          (typeof data?.reply === "string" && data.reply.trim()) ||
          "Understood! I'll take care of that right away.";
        setChatLog((prev) => [...prev, { role: "luna", text: reply }]);
        await speakText(reply);
      } catch {
        await speakText("Sorry, I ran into a problem processing that request.");
      }
    },
    [speakText, workspaceId]
  );

  handleSubmitRef.current = handleSubmit;

  const {
    isListening,
    transcript: liveTranscript,
    startListening,
    stopListening,
    isSupported: speechSupported,
  } = useSpeechToText({
    onFinalTranscript: (text) => {
      if (!text) return;
      setInstruction(text);
      void handleSubmitRef.current(text);
    },
  });

  useEffect(() => {
    if (isListening && liveTranscript) {
      setInstruction(liveTranscript);
    }
  }, [isListening, liveTranscript]);

  const wasListeningRef = useRef(false);
  useEffect(() => {
    commandMicRef.current = isListening;
    if (isListening && !wasListeningRef.current) {
      pauseWakeRef.current = true;
      wantedRef.current = true;
      void startLiveRef.current();
      try {
        wakeRecRef.current?.stop();
      } catch {
        /* ignore */
      }
      setStatus("listening");
    } else if (!isListening && wasListeningRef.current) {
      pauseWakeRef.current = false;
      try {
        wakeRecRef.current?.start();
      } catch {
        /* ignore */
      }
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    }
    wasListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    wakeWantedRef.current = true;
    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      if (commandMicRef.current) return;
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal === false) continue;
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (transcript && isLunaWakePhrase(transcript)) {
          void handleSubmitRef.current(transcript);
        }
      }
    };
    rec.onend = () => {
      if (!wakeWantedRef.current || pauseWakeRef.current) return;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };
    rec.onerror = () => {
      /* Chrome fires no-speech / aborted; onend restarts */
    };
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    wakeRecRef.current = rec;
    return () => {
      wakeWantedRef.current = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      wakeRecRef.current = null;
    };
  }, []);

  const toggleMic = useCallback(async () => {
    if (!speechSupported) {
      toast("Voice input isn't supported in this browser.", "error");
      return;
    }
    if (isListening) {
      stopListening();
      if (status === "listening") setStatus("idle");
      return;
    }
    if (status === "disconnected") {
      await startAvatarSession();
    }
    setStatus("listening");
    startListening();
  }, [
    isListening,
    speechSupported,
    startAvatarSession,
    startListening,
    status,
    stopListening,
  ]);

  const statusLabel =
    status === "disconnected"
      ? "Disconnected"
      : status === "idle"
        ? "Idle"
        : status === "connecting"
          ? "Connecting"
          : status === "listening"
            ? "Listening"
            : status === "thinking"
              ? "Thinking"
              : "Speaking";

  const statusBadgeVariant =
    status === "disconnected"
      ? "destructive"
      : status === "speaking" || status === "listening"
        ? "default"
        : status === "thinking" || status === "connecting"
          ? "secondary"
          : "outline";

  const busy = status === "thinking";
  const sessionOn = status !== "disconnected";

  return (
    <Card className="border-border/40 bg-background/95 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <Badge variant={statusBadgeVariant} className="font-mono text-xs">
          {status === "connecting" && (
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          )}
          {statusLabel}
        </Badge>
        <div className="flex items-center space-x-1">
          {sessionOn ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopAvatarSession}
              className="h-8 font-mono text-xs text-muted-foreground hover:text-destructive"
            >
              <VideoOff className="mr-1.5 h-3.5 w-3.5" />
              Disconnect
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => void startAvatarSession()}
              className="h-8 font-mono text-xs"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Start Session
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
            aria-label="Customize assistant"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center overflow-hidden rounded-2xl border border-border/30 bg-black/90 shadow-md">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            poster={LUNA_AVATAR_URL}
            className="h-full w-full object-cover"
          />
          <audio ref={audioRef} autoPlay playsInline className="sr-only" />

          {status === "disconnected" && (
            <>
              <img
                src={LUNA_AVATAR_URL}
                alt={`${agentName} portrait`}
                className="absolute inset-0 z-10 h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/70 to-transparent pb-2 pt-8">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void startAvatarSession()}
                  className="h-6 px-2 text-[10px]"
                >
                  Connect
                </Button>
              </div>
            </>
          )}

          {status === "connecting" && (
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[9px] text-white/90">
              <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />
              WebRTC...
            </div>
          )}

          {live && status !== "disconnected" && status !== "connecting" && (
            <div className="absolute right-1.5 top-1.5 flex items-center space-x-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
              <Video className="h-2.5 w-2.5 text-emerald-400" />
              <span>Live</span>
            </div>
          )}
        </div>

        {chatLog.length > 0 && (
          <div className="max-h-32 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs">
            {chatLog.slice(-3).map((entry, idx) => (
              <div key={`${entry.role}-${idx}`} className="flex space-x-2">
                <span className="font-semibold capitalize text-muted-foreground">
                  {entry.role}:
                </span>
                <span className="text-foreground">{entry.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={() => void toggleMic()}
            disabled={!speechSupported || busy}
            title={isListening ? "Stop listening" : "Start voice input"}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          <Input
            placeholder={
              isListening
                ? "Listening..."
                : status === "disconnected"
                  ? "Type a message to wake Luna..."
                  : `Type or speak to ${agentName}...`
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleSubmit(instruction);
            }}
            disabled={busy}
          />

          <Button
            type="button"
            onClick={() => void handleSubmit(instruction)}
            disabled={busy}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          {isListening
            ? "Speak now. Your query will automatically send when you finish speaking."
            : "Click the mic or type to send queries. Disconnect anytime to stop Simli credit use."}
        </p>
      </CardContent>

      <LunaSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workspaceId={workspaceId}
        settings={settings}
        isAdmin={isAdmin}
        onSaved={(s) => setSettings(s)}
      />
    </Card>
  );
}
