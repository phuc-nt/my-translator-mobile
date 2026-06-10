export interface Language {
  code: string;
  name: string;
}

export const SONIOX_LANGS: Language[] = [
  { code: "en", name: "English" },
  { code: "vi", name: "Vietnamese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
  { code: "th", name: "Thai" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
];

export const OPENAI_LANGS: Language[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
];

// qwen3-livetranslate-flash-realtime: 60 supported target languages per
// Alibaba docs (source is auto-detected, so this is the target list).
// Common-first ordering; rest A-Z. See:
// plans/reports/researcher-260525-1453-qwen-livetranslate-language-coverage.md
export const QWEN_LANGS: Language[] = [
  { code: "en", name: "English" },
  { code: "vi", name: "Vietnamese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "yue", name: "Cantonese" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "th", name: "Thai" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  // A-Z rest
  { code: "af", name: "Afrikaans" },
  { code: "ast", name: "Asturian" },
  { code: "az", name: "Azerbaijani" },
  { code: "be", name: "Belarusian" },
  { code: "bg", name: "Bulgarian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "ca", name: "Catalan" },
  { code: "ceb", name: "Cebuano" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "el", name: "Greek" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Persian" },
  { code: "fi", name: "Finnish" },
  { code: "fil", name: "Filipino" },
  { code: "gl", name: "Galician" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "jv", name: "Javanese" },
  { code: "kk", name: "Kazakh" },
  { code: "kn", name: "Kannada" },
  { code: "ky", name: "Kyrgyz" },
  { code: "lv", name: "Latvian" },
  { code: "mk", name: "Macedonian" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "nb", name: "Norwegian Bokmål" },
  { code: "pa", name: "Punjabi" },
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sv", name: "Swedish" },
  { code: "sw", name: "Swahili" },
  { code: "tg", name: "Tajik" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
];

export function langName(code: string, list: Language[]): string {
  return list.find((l) => l.code === code)?.name ?? code;
}

// Edge TTS voice mapping: language code → Azure Neural voice ID
// User requirement: vi→NamMinh (male), en→Jenny (female)
const EDGE_TTS_VOICES: Record<string, string> = {
  vi: "vi-VN-NamMinhNeural",
  en: "en-US-JennyNeural",
  ja: "ja-JP-NanamiNeural",
  ko: "ko-KR-SunHiNeural",
  zh: "zh-CN-XiaoxiaoNeural",
  yue: "zh-HK-HiuGaaiNeural",
  es: "es-ES-ElviraNeural",
  fr: "fr-FR-DeniseNeural",
  de: "de-DE-KatjaNeural",
  ru: "ru-RU-SvetlanaNeural",
  pt: "pt-BR-FranciscaNeural",
  it: "it-IT-ElsaNeural",
  id: "id-ID-GadisNeural",
  th: "th-TH-PremwadeeNeural",
  hi: "hi-IN-SwaraNeural",
  ar: "ar-SA-ZariyahNeural",
};

export function getEdgeTTSVoice(langCode: string): string {
  return EDGE_TTS_VOICES[langCode] ?? EDGE_TTS_VOICES.en;
}
