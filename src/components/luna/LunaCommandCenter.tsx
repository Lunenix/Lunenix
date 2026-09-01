"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { ensureVoicesLoaded, pickFemaleVoice, isLunaWakePhrase, stripLunaWakePhrase } from "@/lib/luna";
import { cn } from "@/lib/utils";
import type { WorkspaceAISettings } from "@/types/database";
import { LunaAvatar } from "./LunaAvatar";
import { LunaSettingsModal } from "./LunaSettingsModal";
import { Mic, MicOff, Send, Settings, Power } from "lucide-react";
import type { SimliClient } from "simli-client/dist/client";

/* -------------------------------------------------------------------------- */
/*  Minimal SpeechRecognition typings (no @types package available)           */
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

/** Simli lip-sync frames: PCM16 mono 16 kHz, ~187.5 ms per 6000-byte chunk. */
const SIMLI_PCM_CHUNK = 6000;

function sendPcmToSimli(client: SimliClient, chunk: Uint8Array) {
  client.sendAudioData(chunk);
}

async function pipePcm16ToSimli(
  body: ReadableStream<Uint8Array>,
  getClient: () => SimliClient | null
) {
  const reader = body.getReader();
  let pending = new Uint8Array(0);
  try {
    while (getClient()) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const merged = new Uint8Array(pending.length + value.length);
      merged.set(pending);
      merged.set(value, pending.length);
      let offset = 0;
      const client = getClient();
      if (!client) break;
      while (offset + SIMLI_PCM_CHUNK <= merged.length) {
        sendPcmToSimli(client, merged.slice(offset, offset + SIMLI_PCM_CHUNK));
        offset += SIMLI_PCM_CHUNK;
      }
      pending = merged.slice(offset);
    }
    const even = pending.length & ~1;
    const client = getClient();
    if (even > 0 && client) {
      sendPcmToSimli(client, pending.slice(0, even));
    }
  } finally {
    reader.releaseLock();
  }
}

/* -------------------------------------------------------------------------- */

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
  const [streamConnected, setStreamConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRecRef = useRef<SpeechRecognitionLike | null>(null);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const streamConnectedRef = useRef(false);
  const commandMicRef = useRef(false);
  const pauseWakeRef = useRef(false);
  const wakeWantedRef = useRef(true);
  const handleSubmitRef = useRef<(text: string) => Promise<void>>(async () => {});
  const liveWantedRef = useRef(true);
  const sessionGenRef = useRef(0);

  const agentName = settings?.agent_name || "Luna";

  /* ----------------------------- Load settings ---------------------------- */
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

  /* ----------------------------- Admin check ------------------------------ */
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

  /* ----------------------- Simli teardown -------------------------- */
  const teardownSimli = useCallback(() => {
    liveWantedRef.current = false;
    sessionGenRef.current += 1;
    try {
      void simliRef.current?.stop();
    } catch {
      /* ignore */
    }
    simliRef.current = null;
    connectPromiseRef.current = null;
    streamConnectedRef.current = false;
    setStreamConnected(false);
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => teardownSimli();
  }, [teardownSimli]);

  /* --------------------------- Connect to Simli -------------------------- */
  const connectSimli = useCallback(async (): Promise<boolean> => {
    if (simliRef.current && streamConnectedRef.current) return true;
    if (!videoRef.current || !audioRef.current) return false;
    if (!liveWantedRef.current) return false;

    const gen = ++sessionGenRef.current;
    if (simliRef.current) {
      try {
        void simliRef.current.stop();
      } catch {
        /* ignore */
      }
      simliRef.current = null;
    }

    setConnecting(true);
    try {
      // 1. Session token + ICE servers (minted server-side; no API key in browser)
      const sessionRes = await fetch("/api/simli-session", { method: "POST" });
      if (sessionRes.status === 401) {
        toast("Sign in to start the live avatar.", "error");
        return false;
      }
      if (sessionRes.status === 503) {
        toast("Live avatar is not configured on the server.", "error");
        return false;
      }
      if (!sessionRes.ok) throw new Error(await sessionRes.text());
      const sessionData = await sessionRes.json();
      const sessionToken: string | undefined = sessionData?.sessionToken;
      if (!sessionToken) throw new Error("No session token returned");

      const iceServers: RTCIceServer[] | null =
        Array.isArray(sessionData?.iceServers) && sessionData.iceServers.length
          ? sessionData.iceServers
          : null;

      // 2. Official Simli client — handles the full WebRTC handshake + audio
      //    worklet. Dynamically imported so it never runs during SSR.
      const { SimliClient } = await import("simli-client/dist/client.js");
      const client = new SimliClient(
        sessionToken,
        videoRef.current,
        audioRef.current,
        iceServers
      );
      simliRef.current = client;

      // Simli drives these events off the actual media pipeline, so the status
      // badge and lip-sync stay in sync with what the avatar is really doing.
      client.on("speaking", () => {
        if (gen !== sessionGenRef.current) return;
        setStatus("speaking");
      });
      client.on("silent", () => {
        if (gen !== sessionGenRef.current) return;
        setStatus((prev) => (prev === "speaking" ? "idle" : prev));
      });
      // STOP/ENDFRAME after a spoken clip is normal. Do not reconnect in a
      // loop — that wiped the next session and made her vanish.
      client.on("stop", () => {
        if (gen !== sessionGenRef.current) return;
        streamConnectedRef.current = false;
        setStreamConnected(false);
        if (simliRef.current === client) simliRef.current = null;
        connectPromiseRef.current = null;
      });
      client.on("error", (detail: string) => {
        if (gen !== sessionGenRef.current) return;
        toast(`Live avatar error: ${String(detail).slice(0, 120)}`, "error");
      });
      client.on("startup_error", (msg: string) => {
        if (gen !== sessionGenRef.current) return;
        toast(`Live avatar failed to start: ${String(msg).slice(0, 120)}`, "error");
        streamConnectedRef.current = false;
        setStreamConnected(false);
        if (simliRef.current === client) simliRef.current = null;
        connectPromiseRef.current = null;
      });

      // 3. Establish the WebRTC connection (resolves once the first video frame arrives).
      await client.start();
      if (gen !== sessionGenRef.current || !liveWantedRef.current) return false;
      streamConnectedRef.current = true;
      setStreamConnected(true);
      setStatus("idle");

      const video = videoRef.current;
      const audio = audioRef.current;
      if (video) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
      if (audio) {
        audio.muted = false;
        void audio.play().catch(() => undefined);
      }
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await new Promise((r) => setTimeout(r, 400));
      return gen === sessionGenRef.current && streamConnectedRef.current;
    } catch (e) {
      if (gen === sessionGenRef.current) {
        toast(
          e instanceof Error && e.message
            ? `Live avatar error: ${e.message.slice(0, 120)}`
            : "Could not start live avatar.",
          "error"
        );
        simliRef.current = null;
        connectPromiseRef.current = null;
        streamConnectedRef.current = false;
        setStreamConnected(false);
      }
      return false;
    } finally {
      if (gen === sessionGenRef.current) setConnecting(false);
    }
  }, []);

  const ensureLive = useCallback(async () => {
    liveWantedRef.current = true;
    if (simliRef.current && streamConnectedRef.current) return true;
    if (!connectPromiseRef.current) {
      connectPromiseRef.current = connectSimli().finally(() => {
        if (!streamConnectedRef.current) connectPromiseRef.current = null;
      });
    }
    return connectPromiseRef.current;
  }, [connectSimli]);

  // Go live as soon as the command center mounts — no start button.
  useEffect(() => {
    liveWantedRef.current = true;
    void ensureLive();
  }, [ensureLive]);

  /* ------- Browser speech-synthesis fallback (when Simli not live) -------- */
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
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    synth.speak(utterance);
  }, []);

  /* ----------------------------- Speak text ------------------------------ */
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
      const live = await ensureLive();
      const client = simliRef.current;
      const simliLive = Boolean(live && client && streamConnectedRef.current);

      // If the live avatar isn't running, use the browser voice so Luna still talks.
      if (!simliLive) {
        try {
          await speakFallback(text);
        } finally {
          resumeWakeListening();
        }
        return;
      }

      setStatus("speaking");
      try {
        // TTS is proxied server-side so the ElevenLabs key never reaches the browser.
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.status === 401) {
          toast("Sign in to use Luna's voice.", "error");
          setStatus("idle");
          return;
        }
        if (res.status === 503) {
          await speakFallback(text);
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        if (!res.body) throw new Error("TTS returned no audio stream");

        void audioRef.current?.play().catch(() => undefined);
        await pipePcm16ToSimli(res.body, () => simliRef.current);
      } catch (e) {
        toast(
          e instanceof Error
            ? `Voice error: ${e.message.slice(0, 120)}`
            : "Voice generation failed.",
          "error"
        );
        await speakFallback(text);
      } finally {
        resumeWakeListening();
      }
    },
    [ensureLive, pauseWakeListening, resumeWakeListening, speakFallback]
  );

  /* ------------------------- Submit an instruction ----------------------- */
  const handleSubmit = useCallback(
    async (text: string) => {
      const raw = text.trim();
      if (!raw) return;
      setInstruction("");
      const woke = isLunaWakePhrase(raw);
      const command = woke ? stripLunaWakePhrase(raw) : raw;

      setStatus("thinking");
      const live = await ensureLive();
      if (!live) {
        toast("Could not start the live avatar. Check Simli settings.", "error");
      }

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
    [workspaceId, speakText, ensureLive]
  );

  handleSubmitRef.current = handleSubmit;

  /* --------- Always-on wake word: Hey Luna / Hello Luna / Hi Luna -------- */
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

  /* ------------------------------ Mic toggle ----------------------------- */
  const toggleMic = useCallback(() => {
    if (isRecording) {
      commandMicRef.current = false;
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    void ensureLive();

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
  }, [isRecording, handleSubmit, ensureLive]);

  /* -------------------------------- Render ------------------------------- */
  const statusLabel =
    connecting && !streamConnected
      ? "Connecting..."
      : status === "idle"
      ? "Idle"
      : status === "listening"
      ? "Listening..."
      : status === "thinking"
      ? "Thinking..."
      : "Speaking...";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
      {/* Status badge */}
      <div className="absolute left-4 top-4 z-20">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            status === "idle" && !connecting && "bg-white/10 text-white/60",
            connecting && !streamConnected && "animate-pulse bg-indigo-500/30 text-indigo-200",
            status === "listening" && "animate-pulse bg-blue-500/30 text-blue-300",
            status === "thinking" && "animate-pulse bg-amber-500/30 text-amber-300",
            status === "speaking" && "animate-pulse bg-green-500/30 text-green-300"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>

      {/* Settings gear */}
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

      {/* Video frame */}
      <div className="relative mx-auto w-full max-w-[320px] aspect-square bg-gradient-to-b from-indigo-950 to-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "h-full w-full object-cover",
            !streamConnected && "opacity-0"
          )}
        />
        {/* Must stay in the layout — display:none often blocks MediaStream audio. */}
        <audio ref={audioRef} autoPlay playsInline className="sr-only" />

        {!streamConnected && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LunaAvatar
              isSpeaking={status === "speaking"}
              isAdmin={isAdmin}
              size={120}
            />
          </div>
        )}

        {/* End-session control when live */}
        {streamConnected && (
          <div className="absolute bottom-3 right-3 z-20">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 text-red-300 hover:bg-red-500/30 hover:text-red-200"
              onClick={teardownSimli}
              aria-label="End live session"
            >
              <Power className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
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
          onChange={(e) => {
            const value = e.target.value;
            setInstruction(value);
            void ensureLive();
          }}
          onFocus={() => {
            void ensureLive();
          }}
          onKeyDown={(e) => {
            void ensureLive();
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
        Type or say Hey {agentName} to talk. Ask for a briefing or the weather
        anytime.
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
