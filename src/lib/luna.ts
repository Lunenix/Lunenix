/**
 * Shared metadata + helpers for the Luna AI assistant.
 * Used by both the command center and the settings modal.
 * Server-side CRM tools live in luna-server.ts so this file stays client-safe.
 */

/** Permanent CDN URL of the generated photorealistic Luna portrait. */
export const LUNA_AVATAR_URL =
  "https://cdn.abacus.ai/images/11332739-7e5e-427d-b7fb-4dcee2db35c4.png";

export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "ava", label: "Ava (Confident)" },
  { id: "liam", label: "Liam (Professional)" },
  { id: "nova", label: "Nova (Warm)" },
  { id: "aria", label: "Aria (Energetic)" },
];

export function voiceById(id: string | null | undefined): VoiceOption {
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}

/** Voice-name fragments (lowercase) that identify a female system voice. */
const FEMALE_VOICE_HINTS = [
  "samantha",
  "karen",
  "victoria",
  "susan",
  "hazel",
  "serena",
  "moira",
  "fiona",
  "tessa",
  "veena",
  "zira",
  "aria",
  "jenny",
  "michelle",
  "sonia",
  "libby",
  "google us english", // Chrome's default US voice is female
  "google uk english female",
  "microsoft zira",
  "female",
  "woman",
];

/** Voice-name fragments that identify a male voice (used to avoid them). */
const MALE_VOICE_HINTS = [
  "male",
  "man",
  "daniel",
  "alex",
  "fred",
  "david",
  "mark",
  "george",
  "james",
  "oliver",
  "thomas",
  "guy",
  "eric",
  "google uk english male",
  "microsoft david",
];

/**
 * Some browsers (notably Chrome) populate the voice list asynchronously, so
 * the first `getVoices()` call often returns an empty array — which is exactly
 * why the assistant sometimes fell back to the default (often male) voice.
 * This resolves once voices are actually available.
 */
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish, { once: true });
    // Fallback in case the event never fires.
    setTimeout(finish, 1000);
  });
}

const SENSITIVE_FIELD =
  /^(password|passwd|token|secret|hash|api_?key|service_role|authorization|credit_?card|card_?number|cvv|ssn|access_token|refresh_token)/i;

/**
 * Strip secrets and non-operational fields before any CRM row is added to
 * Luna's LLM context. Keeps titles, names, statuses, and similar prompt data.
 */
export function sanitizeLunaContext(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_FIELD.test(key)) continue;
    if (value == null) continue;
    if (typeof value === "string") {
      out[key] = value.length > 400 ? value.slice(0, 400) : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export const LUNA_WAKE_RE = /^(hey|hello|hi)\s+luna\b/i;

export function isLunaWakePhrase(text: string): boolean {
  return LUNA_WAKE_RE.test(text.trim());
}

/** Strip a leading "hey/hello/hi luna" so the rest can be treated as a command. */
export function stripLunaWakePhrase(text: string): string {
  return text.trim().replace(LUNA_WAKE_RE, "").replace(/^[,.\s]+/, "").trim();
}

/**
 * Pick the best available female voice. Prefers an English female voice, then
 * any female voice, then any non-male English voice, and finally any voice.
 */
export function pickFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const isMale = (name: string) =>
    MALE_VOICE_HINTS.some((h) => name.includes(h));
  const isFemale = (name: string) =>
    FEMALE_VOICE_HINTS.some((h) => name.includes(h));

  const englishFemale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && isFemale(v.name.toLowerCase())
  );
  if (englishFemale) return englishFemale;

  const anyFemale = voices.find((v) => isFemale(v.name.toLowerCase()));
  if (anyFemale) return anyFemale;

  const englishNonMale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && !isMale(v.name.toLowerCase())
  );
  if (englishNonMale) return englishNonMale;

  const nonMale = voices.find((v) => !isMale(v.name.toLowerCase()));
  return nonMale ?? voices[0];
}

/** Common IANA zones for Luna's home city / local clock. */
export const LUNA_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "UTC",
] as const;

export function isIanaTimeZone(value: string): boolean {
  if (!/^[A-Za-z0-9_]+(?:\/[A-Za-z0-9_+\-]+)+$|^UTC$/.test(value)) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function formatTimeInZone(timeZone: string): string | null {
  if (!isIanaTimeZone(timeZone)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    return null;
  }
}
