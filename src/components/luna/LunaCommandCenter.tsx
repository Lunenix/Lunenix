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
} from "@/lib/luna";
import { cn } from "@/lib/utils";
import type { WorkspaceAISettings } from "@/types/database";
import { LunaAvatar } from "./LunaAvatar";
import { LunaSettingsModal } from "./LunaSettingsModal";
import { Mic, MicOff, Send, Settings } from "lucide-react";

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

const PCM_SAMPLE_RATE = 16000;

async function playPcm16Stream(
  body: ReadableStream<Uint8Array>,
  audioCtx: AudioContext
) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const even = total & ~1;
  if (even < 2) return;

  const merged = new Uint8Array(even);
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, even - offset);
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= even) break;
  }

  const samples = merged.length / 2;
  const buffer = audioCtx.createBuffer(1, samples, PCM_SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  const view = new DataView(merged.buffer, merged.byteOffset, merged.byteLength);
  for (let i = 0; i < samples; i++) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }

  await audioCtx.resume();
  await new Promise<void>((resolve) => {
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.onended = () => resolve();
    src.start();
  });
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

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRecRef = useRef<SpeechRecognitionLike | null>(null);
  const commandMicRef = useRef(false);
  const pauseWakeRef = useRef(false);
  const wakeWantedRef = useRef(true);
  const handleSubmitRef = useRef<(text: string) => Promise<void>>(
    async () => {}
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  const agentName = settings?.agent_name || "Luna";

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

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

        const ctx = getAudioContext();
        if (!ctx) {
          await speakFallback(text);
          return;
        }
        await playPcm16Stream(res.body, ctx);
        setStatus("idle");
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
    [getAudioContext, pauseWakeListening, resumeWakeListening, speakFallback]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const raw = text.trim();
      if (!raw) return;
      setInstruction("");
      const woke = isLunaWakePhrase(raw);
      const command = woke ? stripLunaWakePhrase(raw) : raw;

      setStatus("thinking");
      // Unlock audio on the same user gesture as Send / Enter.
      void getAudioContext()?.resume();

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
    [getAudioContext, speakText, workspaceId]
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

  const toggleMic = useCallback(() => {
    if (isRecording) {
      commandMicRef.current = false;
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    void getAudioContext()?.resume();

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
  }, [getAudioContext, handleSubmit, isRecording]);

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
        <LunaAvatar
          fill
          isSpeaking={status === "speaking"}
          isAdmin={isAdmin}
        />
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
        Type or say Hey {agentName} to talk. She stays still until you send a
        message — no live session while idle.
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
