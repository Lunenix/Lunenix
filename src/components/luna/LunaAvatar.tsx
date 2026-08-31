"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { LUNA_AVATAR_URL } from "@/lib/luna";

/**
 * Still portrait for idle / settings / before Simli video is up.
 * Do not split the photo or overlay a blink bar — those caused a looping
 * scale cycle and a black seam across the face on each restart.
 */

interface LunaAvatarProps {
  isSpeaking: boolean;
  isAdmin?: boolean;
  size?: number;
  className?: string;
}

export function LunaAvatar({
  isSpeaking,
  isAdmin = false,
  size = 96,
  className,
}: LunaAvatarProps) {
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
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
    >
      {isSpeaking && (
        <span className="pointer-events-none absolute inset-[-4px] z-0 animate-ping rounded-xl bg-indigo-500/25" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LUNA_AVATAR_URL}
        alt="Luna"
        draggable={false}
        className="relative z-10 h-full w-full rounded-xl border-2 border-indigo-500/60 object-cover shadow-lg"
      />
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
  );
}
