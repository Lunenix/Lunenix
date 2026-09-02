import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * Reverse-geocode lat/lng via Open-Meteo (no API key).
 * Used only to prefill Luna's home city from the browser; coords are not stored.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gated = await requireSuperAdmin();
  if ("error" in gated) return gated.error;

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
  const json = (await res.json()) as {
    results?: {
      name?: string;
      admin1?: string;
      country?: string;
      timezone?: string;
    }[];
  };
  const place = json.results?.[0];
  if (!place?.name) {
    return NextResponse.json({ error: "No place found" }, { status: 404 });
  }

  const city = [place.name, place.admin1].filter(Boolean).join(", ");
  return NextResponse.json({
    city,
    country: place.country ?? null,
    timezone: place.timezone ?? null,
  });
}
