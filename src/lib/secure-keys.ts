import * as SecureStore from "expo-secure-store";

const KEYS = {
  soniox: "apikey.soniox",
  openai: "apikey.openai",
} as const;

export type SecureKeyName = keyof typeof KEYS;

export async function getSecureKey(name: SecureKeyName): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS[name]);
}

export async function setSecureKey(
  name: SecureKeyName,
  value: string,
): Promise<void> {
  if (!value) {
    await SecureStore.deleteItemAsync(KEYS[name]);
    return;
  }
  await SecureStore.setItemAsync(KEYS[name], value);
}

export async function clearSecureKey(name: SecureKeyName): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS[name]);
}

export async function clearAllSecureKeys(): Promise<void> {
  await Promise.all(
    (Object.keys(KEYS) as SecureKeyName[]).map((k) => clearSecureKey(k)),
  );
}

// Non-secret app preferences (engine, languages, font size, panel mode).
// SecureStore works fine for these too — we just don't need encryption-grade
// storage; YAGNI says one storage layer beats pulling in AsyncStorage.
const PREF_KEYS = {
  engine: "pref.engine",
  sourceLang: "pref.sourceLang",
  targetLang: "pref.targetLang",
  panelMode: "pref.panelMode",
  fontSize: "pref.fontSize",
} as const;

export type PrefName = keyof typeof PREF_KEYS;

export async function getPref(name: PrefName): Promise<string | null> {
  return SecureStore.getItemAsync(PREF_KEYS[name]);
}

export async function setPref(name: PrefName, value: string): Promise<void> {
  await SecureStore.setItemAsync(PREF_KEYS[name], value);
}

export async function clearAllPrefs(): Promise<void> {
  await Promise.all(
    (Object.keys(PREF_KEYS) as PrefName[]).map((k) =>
      SecureStore.deleteItemAsync(PREF_KEYS[k]),
    ),
  );
}
