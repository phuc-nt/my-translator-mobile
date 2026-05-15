# My Translator — Mobile

Minimal iOS + Android companion to [my-translator](https://github.com/phuc-nt/my-translator) (desktop).
Captures phone mic at conferences/lectures and shows live translation.

Two engines:

- **Soniox** (~$0.12/hr, text-only)
- **OpenAI Realtime** (~$4/hr, text + optional voice playback — muted by default, toggle in header)

Source language is auto-detected. You only pick a target.

Bring-your-own API key — keys are stored locally in iOS Keychain / Android Keystore via `expo-secure-store`. No backend, no telemetry, no transcript history.

---

## Install (end-user)

### iOS — TestFlight

1. Install [TestFlight](https://apps.apple.com/app/testflight/id899247664) from the App Store.
2. Open the TestFlight invite link the maintainer shares with you.
3. Tap **Accept** → **Install**.

### Android — APK from GitHub Releases

1. On your Android phone, open the latest [Release](https://github.com/phuc-nt/my-translator-mobile/releases/latest) and download the `.apk` asset (or use the [direct download](https://github.com/phuc-nt/my-translator-mobile/releases/download/v0.1.0-android/my-translator-0.1.0.apk)).
2. When prompted, allow your browser to install unknown apps (Settings → Apps → Your browser → Install unknown apps).
3. Open the downloaded APK and tap **Install**. If Play Protect warns, tap **Install anyway**.

### First-run setup

1. Open the app — you'll be sent to **Settings** because no API key is saved yet.
2. Paste either:
   - **Soniox API key** — get one from <https://console.soniox.com> (cheap, text-only, recommended).
   - **OpenAI API key** — get one from <https://platform.openai.com/api-keys> (more expensive but plays voice).
   - **Tip:** Set a low monthly spending cap on your OpenAI key.
3. Pick your **target** language (source is auto-detected).
4. Back on the main screen, tap **Start**, allow the microphone prompt, and start speaking.
5. On OpenAI engine, tap 🔇 in the header to unmute TTS audio if you want voice output.

---

## Stack

- Expo SDK 54 + React Native 0.81 + TypeScript
- Expo Router v4 (file-based)
- NativeWind v4 (Tailwind for RN)
- `react-native-audio-api` 0.11 (mic capture + PCM playback)
- `expo-secure-store` (API keys + prefs)
- Distribution: EAS Build → TestFlight (iOS) + APK on GitHub Release (Android)

## Develop

```bash
npm install
npx expo prebuild --clean
npx expo run:ios       # or: npx expo run:android
```

After the first native build, iterate via:

```bash
npx expo start --dev-client
```

## Build & ship

```bash
# install once
npm i -g eas-cli
eas login

# iOS → TestFlight
eas build --profile production --platform ios
eas submit --platform ios --latest

# Android → APK artifact (download → attach to GitHub Release)
eas build --profile production --platform android
```

`eas.json` profiles:

- `development` — for local dev client (simulator OK on iOS)
- `preview` — internal distribution APK / ad-hoc iOS
- `production` — TestFlight + signed APK

## Project layout

```
app/                    # Expo Router screens
  _layout.tsx           # Root layout + providers
  index.tsx             # Translate screen
  settings.tsx          # Settings (API keys, engine, langs, font, panel)
src/
  engines/              # soniox-client.ts + openai-realtime-client.ts
  lib/                  # audio-capture.ts, openai-audio-output-queue.ts,
                        # secure-keys.ts, languages.ts
  components/           # transcript-stream.tsx
  state/                # Settings + Session contexts
  types/                # Shared TS types
```

## License

Same as desktop my-translator.
