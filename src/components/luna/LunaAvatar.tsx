"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { LUNA_AVATAR_URL } from "@/lib/luna";

/**
 * Offline/fallback portrait only. When a live Simli session is running, the
 * dashboard shows the WebRTC video instead — lip-sync comes from piping
 * ElevenLabs PCM into SimliClient.sendAudioData, not from this CSS jaw.
 */

// Phoneme sequence: 0 = mouth closed, 1 = fully open.
// Varied values create more natural, non-robotic movement.
const PHONEMES = [0.25, 0.75, 0.45, 0.9, 0.15, 0.6, 1.0, 0.3, 0.55, 0.1, 0.8, 0.4];

// Where to split the face into upper (static) and lower jaw (animated).
// ~70% down works well for a head-and-shoulders portrait.
const SPLIT_PCT = 70;

// Max jaw rotation in degrees when fully open.
const MAX_JAW_DEG = 9;

interface LunaAvatarProps {
  /** When true the avatar talks — jaw moves, pulse rings show, status dot appears. */
  isSpeaking: boolean;
  /**
   * Only super-admins see the real Luna portrait. Other users get a generic
   * branded placeholder. Defaults to false.
   */
  isAdmin?: boolean;
  /** Rendered width/height in pixels. Defaults to 96. */
  size?: number;
  className?: string;
}

export function LunaAvatar({
  isSpeaking,
  isAdmin = false,
  size = 96,
  className,
}: LunaAvatarProps) {
  const [phonemeIdx, setPhonemeIdx] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const [headBob, setHeadBob] = useState(0); // -1 | 0 | 1
  const [eyeShiftX, setEyeShiftX] = useState(0); // subtle gaze drift in px

  // ── Phoneme cycling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSpeaking) return;
    const id = setInterval(
      () => setPhonemeIdx((i) => i + 1),
      110
    );
    return () => clearInterval(id);
  }, [isSpeaking]);

  // ── Random blinking ──────────────────────────────────────────────────────
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t1 = setTimeout(() => {
        setBlinking(true);
        t2 = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 120);
      }, 2500 + Math.random() * 2000);
    };
    schedule();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // ── Head bob while speaking ───────────────────────────────────────────────
  useEffect(() => {
    if (!isSpeaking) {
      setHeadBob(0);
      return;
    }
    const seq = [-1, 0, 0, 1, 0, -1, 0, 0, 1, 0];
    let i = 0;
    const id = setInterval(() => {
      setHeadBob(seq[i % seq.length] as -1 | 0 | 1);
      i++;
    }, 350);
    return () => clearInterval(id);
  }, [isSpeaking]);

  // ── Gaze drift ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setEyeShiftX(Math.random() > 0.65 ? (Math.random() - 0.5) * size * 0.06 : 0);
    }, 2000);
    return () => clearInterval(id);
  }, [size]);

  // Current jaw angle derived from phoneme
  const phonemeVal = PHONEMES[phonemeIdx % PHONEMES.length];
  const jawDeg = isSpeaking ? phonemeVal * MAX_JAW_DEG : 0;
  const mouthVisible = jawDeg > 1;

  // ── Non-admin fallback ────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className={cn("relative", className)} style={{ width: size, height: size }}>
        <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-indigo-500/50 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
          <Bot
            className="text-white/90"
            style={{ width: size * 0.5, height: size * 0.5 }}
          />
        </div>
        {isSpeaking && (
          <span className="absolute right-1 top-1 z-30 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
          </span>
        )}
      </div>
    );
  }

  return (
    // Outermost: breathing scale
    <div
      className={cn("relative select-none", className)}
      style={{
        width: size,
        height: size,
        animation: "luna-breathe 3.2s ease-in-out infinite",
      }}
    >
      {/* Pulse rings while speaking */}
      {isSpeaking && (
        <>
          <span className="pointer-events-none absolute inset-[-4px] z-0 animate-ping rounded-xl bg-indigo-500/25" />
          <span
            className="pointer-events-none absolute inset-[-4px] z-0 animate-ping rounded-xl bg-violet-400/15"
            style={{ animationDelay: "0.45s" }}
          />
        </>
      )}

      {/* Head-bob wrapper */}
      <div
        className="relative h-full w-full"
        style={{
          transform: `translateY(${headBob * 2}px) rotate(${headBob * 0.6}deg)`,
          transition: "transform 0.35s ease-in-out",
        }}
      >
        {/*
         * Face container — clipping and perspective live here.
         * overflow:hidden keeps layers inside the rounded frame.
         */}
        <div
          className="relative h-full w-full overflow-hidden rounded-xl border-2 border-indigo-500/60 shadow-lg"
          style={{ perspective: "700px" }}
        >

          {/* ── UPPER FACE (forehead → nose, static) ── */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LUNA_AVATAR_URL}
            alt="Luna"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              clipPath: `polygon(0% 0%, 100% 0%, 100% ${SPLIT_PCT}%, 0% ${SPLIT_PCT}%)`,
              zIndex: 10,
            }}
          />

          {/* ── Eyelid blink bar ── */}
          {blinking && (
            <div
              style={{
                position: "absolute",
                top: "37%",
                left: "10%",
                right: "10%",
                height: Math.max(5, size * 0.065),
                background:
                  "linear-gradient(to bottom, transparent 0%, #08000e 35%, #08000e 65%, transparent 100%)",
                borderRadius: "50%",
                zIndex: 25,
              }}
            />
          )}

          {/* ── Pupil / gaze drift glint ── */}
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: `calc(50% + ${eyeShiftX}px)`,
              width: size * 0.06,
              height: size * 0.035,
              background: "rgba(255,255,255,0.18)",
              borderRadius: "50%",
              transform: "translateX(-50%)",
              transition: "left 0.7s ease",
              zIndex: 24,
              pointerEvents: "none",
            }}
          />

          {/* ── Mouth cavity (visible when jaw opens) ── */}
          {mouthVisible && (
            <div
              style={{
                position: "absolute",
                top: `${SPLIT_PCT - 1.5}%`,
                left: "30%",
                right: "30%",
                height: `${6 + jawDeg * 0.55}%`,
                background:
                  "radial-gradient(ellipse at 50% 20%, #2a0828 0%, #0a000d 65%)",
                borderRadius: "50% 50% 55% 55%",
                opacity: Math.min(1, (jawDeg - 1) / 3),
                zIndex: 12,
                transition: "opacity 0.09s ease",
              }}
            />
          )}

          {/* ── Teeth hint ── */}
          {mouthVisible && jawDeg > 2.5 && (
            <div
              style={{
                position: "absolute",
                top: `${SPLIT_PCT + 0.2}%`,
                left: "34%",
                right: "34%",
                height: `${Math.min(3.5, (jawDeg - 2.5) * 0.6)}%`,
                background: "rgba(255, 248, 240, 0.75)",
                borderRadius: "0 0 3px 3px",
                zIndex: 14,
                transition: "height 0.09s ease, opacity 0.09s ease",
              }}
            />
          )}

          {/* ── LOWER JAW (lip area → chin) — rotates down ── */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LUNA_AVATAR_URL}
            alt=""
            aria-hidden
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              clipPath: `polygon(0% ${SPLIT_PCT}%, 100% ${SPLIT_PCT}%, 100% 100%, 0% 100%)`,
              transformOrigin: `50% ${SPLIT_PCT}%`,
              transform: `perspective(700px) rotateX(${jawDeg}deg)`,
              transition: "transform 0.09s ease",
              zIndex: 20,
            }}
          />
        </div>

        {/* Speaking indicator dot */}
        {isSpeaking && (
          <span
            style={{ position: "absolute", top: 4, right: 4, zIndex: 30 }}
            className="flex h-3 w-3"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
          </span>
        )}
      </div>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes luna-breathe {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.007);
          }
        }
      `}</style>
    </div>
  );
}
