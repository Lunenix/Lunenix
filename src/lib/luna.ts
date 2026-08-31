/**
 * Shared metadata + helpers for the Luna AI assistant.
 * Used by both the command center and the settings modal.
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

  // 1. English female voice by explicit hint.
  const englishFemale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && isFemale(v.name.toLowerCase())
  );
  if (englishFemale) return englishFemale;

  // 2. Any female voice by explicit hint.
  const anyFemale = voices.find((v) => isFemale(v.name.toLowerCase()));
  if (anyFemale) return anyFemale;

  // 3. English voice that is not obviously male.
  const englishNonMale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && !isMale(v.name.toLowerCase())
  );
  if (englishNonMale) return englishNonMale;

  // 4. Any voice that is not obviously male.
  const nonMale = voices.find((v) => !isMale(v.name.toLowerCase()));
  return nonMale ?? voices[0];
}
