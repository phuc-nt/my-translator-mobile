/**
 * Edge TTS voice definitions.
 * Microsoft Edge Neural voices grouped by language.
 */

export interface EdgeVoice {
  id: string;
  name: string;
  gender: "male" | "female";
}

export interface EdgeVoiceGroup {
  lang: string;
  langName: string;
  voices: EdgeVoice[];
}

export const EDGE_TTS_VOICES: EdgeVoiceGroup[] = [
  {
    lang: "vi",
    langName: "Vietnamese",
    voices: [
      { id: "vi-VN-NamMinhNeural", name: "NamMinh", gender: "male" },
      { id: "vi-VN-HoaiMyNeural", name: "HoaiMy", gender: "female" },
    ],
  },
  {
    lang: "en",
    langName: "English",
    voices: [
      { id: "en-US-JennyNeural", name: "Jenny (US)", gender: "female" },
      { id: "en-US-GuyNeural", name: "Guy (US)", gender: "male" },
      { id: "en-US-AriaNeural", name: "Aria (US)", gender: "female" },
      { id: "en-GB-SoniaNeural", name: "Sonia (UK)", gender: "female" },
      { id: "en-GB-RyanNeural", name: "Ryan (UK)", gender: "male" },
      { id: "en-AU-NatashaNeural", name: "Natasha (AU)", gender: "female" },
    ],
  },
  {
    lang: "ja",
    langName: "Japanese",
    voices: [
      { id: "ja-JP-NanamiNeural", name: "Nanami", gender: "female" },
      { id: "ja-JP-KeitaNeural", name: "Keita", gender: "male" },
    ],
  },
  {
    lang: "ko",
    langName: "Korean",
    voices: [
      { id: "ko-KR-SunHiNeural", name: "SunHi", gender: "female" },
      { id: "ko-KR-InJoonNeural", name: "InJoon", gender: "male" },
    ],
  },
  {
    lang: "zh",
    langName: "Chinese",
    voices: [
      { id: "zh-CN-XiaoxiaoNeural", name: "Xiaoxiao", gender: "female" },
      { id: "zh-CN-YunxiNeural", name: "Yunxi", gender: "male" },
      { id: "zh-CN-YunjianNeural", name: "Yunjian", gender: "male" },
    ],
  },
  {
    lang: "yue",
    langName: "Cantonese",
    voices: [
      { id: "zh-HK-HiuGaaiNeural", name: "HiuGaai", gender: "female" },
      { id: "zh-HK-WanLungNeural", name: "WanLung", gender: "male" },
    ],
  },
  {
    lang: "es",
    langName: "Spanish",
    voices: [
      { id: "es-ES-ElviraNeural", name: "Elvira (ES)", gender: "female" },
      { id: "es-ES-AlvaroNeural", name: "Alvaro (ES)", gender: "male" },
      { id: "es-MX-DaliaNeural", name: "Dalia (MX)", gender: "female" },
    ],
  },
  {
    lang: "fr",
    langName: "French",
    voices: [
      { id: "fr-FR-DeniseNeural", name: "Denise", gender: "female" },
      { id: "fr-FR-HenriNeural", name: "Henri", gender: "male" },
    ],
  },
  {
    lang: "de",
    langName: "German",
    voices: [
      { id: "de-DE-KatjaNeural", name: "Katja", gender: "female" },
      { id: "de-DE-ConradNeural", name: "Conrad", gender: "male" },
    ],
  },
  {
    lang: "ru",
    langName: "Russian",
    voices: [
      { id: "ru-RU-SvetlanaNeural", name: "Svetlana", gender: "female" },
      { id: "ru-RU-DmitryNeural", name: "Dmitry", gender: "male" },
    ],
  },
  {
    lang: "pt",
    langName: "Portuguese",
    voices: [
      { id: "pt-BR-FranciscaNeural", name: "Francisca (BR)", gender: "female" },
      { id: "pt-BR-AntonioNeural", name: "Antonio (BR)", gender: "male" },
      { id: "pt-PT-RaquelNeural", name: "Raquel (PT)", gender: "female" },
    ],
  },
  {
    lang: "it",
    langName: "Italian",
    voices: [
      { id: "it-IT-ElsaNeural", name: "Elsa", gender: "female" },
      { id: "it-IT-DiegoNeural", name: "Diego", gender: "male" },
    ],
  },
  {
    lang: "id",
    langName: "Indonesian",
    voices: [
      { id: "id-ID-GadisNeural", name: "Gadis", gender: "female" },
      { id: "id-ID-ArdiNeural", name: "Ardi", gender: "male" },
    ],
  },
  {
    lang: "th",
    langName: "Thai",
    voices: [
      { id: "th-TH-PremwadeeNeural", name: "Premwadee", gender: "female" },
      { id: "th-TH-NiwatNeural", name: "Niwat", gender: "male" },
    ],
  },
  {
    lang: "hi",
    langName: "Hindi",
    voices: [
      { id: "hi-IN-SwaraNeural", name: "Swara", gender: "female" },
      { id: "hi-IN-MadhurNeural", name: "Madhur", gender: "male" },
    ],
  },
  {
    lang: "ar",
    langName: "Arabic",
    voices: [
      { id: "ar-SA-ZariyahNeural", name: "Zariyah", gender: "female" },
      { id: "ar-SA-HamedNeural", name: "Hamed", gender: "male" },
    ],
  },
];

export function getVoicesForLang(langCode: string): EdgeVoice[] {
  const group = EDGE_TTS_VOICES.find((g) => g.lang === langCode);
  return group?.voices ?? EDGE_TTS_VOICES[1].voices; // fallback to English
}

export function getDefaultVoice(langCode: string): string {
  const voices = getVoicesForLang(langCode);
  return voices[0]?.id ?? "en-US-JennyNeural";
}
