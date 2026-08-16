"use client";

/**
 * Signature capture: draw with a pointer or type a name rendered in a script
 * font. Returns a data URL (drawn) or the typed string via onChange.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SignatureValue {
  type: "typed" | "drawn";
  data: string; // data URL for drawn; the typed string for typed
}

interface SignaturePadProps {
  defaultName?: string;
  onChange: (value: SignatureValue | null) => void;
}

export function SignaturePad({ defaultName = "", onChange }: SignaturePadProps) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(defaultName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Prepare the canvas backing store.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#12123a";
    }
  }, [mode]);

  useEffect(() => {
    // Push typed value up whenever it changes in type mode.
    if (mode === "type") {
      onChange(typed.trim() ? { type: "typed", data: typed.trim() } : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    lastPoint.current = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    const lp = lastPoint.current!;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    hasDrawn.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    if (hasDrawn.current) {
      const data = canvasRef.current!.toDataURL("image/png");
      onChange({ type: "drawn", data });
    }
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => {
            setMode("draw");
            onChange(null);
          }}
        >
          Draw
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "type" ? "default" : "outline"}
          onClick={() => setMode("type")}
        >
          Type
        </Button>
      </div>

      {mode === "draw" ? (
        <div>
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-md border border-input bg-white"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="mt-1 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="typed-sig">Type your signature</Label>
          <Input
            id="typed-sig"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Your full name"
          />
          <div
            className={cn(
              "flex h-20 items-center justify-center rounded-md border border-input bg-white px-4",
              "text-3xl"
            )}
            style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive" }}
          >
            <span className="text-[#12123a]">{typed || "Preview"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
