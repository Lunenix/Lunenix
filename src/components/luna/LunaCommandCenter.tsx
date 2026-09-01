"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import {
  ensureVoicesLoaded,
  pickFemaleVoice,
  isLunaWakePhrase,
  stripLunaWakePhrase,
  LUNA_AVATAR_URL,
} from "@/lib/luna";
import { cn } from "@/lib/utils";
import type { WorkspaceAISettings } from "@/types/database";
import { LunaSettingsModal } from "./LunaSettingsModal";
import { Mic, MicOff, Send, Settings } from "lucide-react";
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

type Status = "idle" | "listening" | "thinking" | "speaking";

interface LunaCommandCenterProps {
  workspaceId: string;
}

export function LunaCommandCenter({ workspaceId }: LunaCommandCenterProps) {
  const [settings, setSettings] = useState<WorkspaceAISettings | null>(null);
  const [instruction, setInstruction] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [live, setLive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRecRef = useRef<SpeechRecognitionLike | null>(null);
  const commandMicRef = useRef(false);
  const pauseWakeRef = useRef(false);
  const wakeWantedRef = useRef(true);
  const handleSubmitRef = useRef<(text: string) => Promise<void>>(
    async () => {}
  );
  const sessionGenRef = useRef(0);
  const liveRef = useRef(false);
  const wantedRef = useRef(true);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLiveRef = useRef<() => Promise<boolean>>(async () => false);

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

  // Stay on Simli for the whole dashboard visit. Idle uses no Gemini/ElevenLabs.
  useEffect(() => {
    wantedRef.current = true;
    void startLive();
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
  }, [startLive]);

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
      setInstruction("");
      const woke = isLunaWakePhrase(raw);
      const command = woke ? stripLunaWakePhrase(raw) : raw;

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
          }),
        });
        if (res.status === 401) {
          toast("Sign in to talk to Luna.", "error");
          setStatus("idle");
          return;
        }
        const data = await res.json();
        const reply: string =
          data?.reply || "Understood! I'll take care of that right away.";
        await speakText(reply);
      } catch {
        await speakText("Sorry, I ran into a problem processing that request.");
      }
    },
    [speakText, workspaceId]
  );

  handleSubmitRef.current = handleSubmit;

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

  const toggleMic = useCallback(() => {
    if (isRecording) {
      commandMicRef.current = false;
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;

    if (!Ctor) {
      toast("Voice input isn't supported in this browser.", "error");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      const last = e.results[e.results.length - 1];
      const transcript = last?.[0]?.transcript ?? "";
      setInstruction(transcript);
      handleSubmit(transcript);
    };
    recognition.onend = () => {
      commandMicRef.current = false;
      pauseWakeRef.current = false;
      try {
        wakeRecRef.current?.start();
      } catch {
        /* ignore */
      }
      setIsRecording(false);
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };
    recognition.onerror = () => {
      commandMicRef.current = false;
      pauseWakeRef.current = false;
      setIsRecording(false);
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };
    commandMicRef.current = true;
    pauseWakeRef.current = true;
    try {
      wakeRecRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setStatus("listening");
  }, [handleSubmit, isRecording]);

  const statusLabel =
    status === "idle"
      ? "Idle"
      : status === "listening"
        ? "Listening..."
        : status === "thinking"
          ? "Thinking..."
          : "Speaking...";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
      <div className="absolute left-4 top-4 z-20">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            status === "idle" && "bg-white/10 text-white/60",
            status === "listening" && "animate-pulse bg-blue-500/30 text-blue-300",
            status === "thinking" && "animate-pulse bg-amber-500/30 text-amber-300",
            status === "speaking" && "animate-pulse bg-green-500/30 text-green-300"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>

      <div className="absolute right-3 top-3 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/60 hover:bg-white/10 hover:text-white"
          onClick={() => setSettingsOpen(true)}
          aria-label="Customize assistant"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative mx-auto w-full max-w-[320px] aspect-square overflow-hidden rounded-xl bg-gradient-to-b from-indigo-950 to-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          poster={LUNA_AVATAR_URL}
          className="absolute inset-0 z-10 h-full w-full object-cover"
        />
        <audio ref={audioRef} autoPlay playsInline className="sr-only" />
        {!live && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-white/70">
            Connecting…
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 bg-black/40 p-4">
        <Button
          type="button"
          size="icon"
          onClick={toggleMic}
          aria-label={isRecording ? "Stop listening" : "Start voice input"}
          className={cn(
            isRecording
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-white/10 text-white hover:bg-white/20"
          )}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit(instruction);
          }}
          placeholder={`Hey ${agentName}...`}
          className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />

        <Button
          type="button"
          size="icon"
          onClick={() => handleSubmit(instruction)}
          aria-label="Send"
          className="bg-indigo-600 text-white hover:bg-indigo-500"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="px-4 pb-3 text-center text-[11px] text-white/40">
        Type or say Hey {agentName} to talk. She stays on the live avatar;
        idle uses no Gemini or ElevenLabs until you wake her.
      </p>

      <LunaSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workspaceId={workspaceId}
        settings={settings}
        isAdmin={isAdmin}
        onSaved={(s) => setSettings(s)}
      />
    </div>
  );
}
