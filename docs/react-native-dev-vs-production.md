# React Native: Dev Client vs Production

Why developing a React Native app feels different from a regular iOS/Android app, and what actually ships to users.

## The problem native development has

A native app (iOS/Android) is a compiled binary — Swift/Kotlin source goes through a compiler and ends up as machine code packaged into `.ipa` / `.apk`. Editing one line means:

1. Recompile (minutes)
2. Repackage
3. Reinstall on device
4. Relaunch

Slow. Web developers are used to "save → F5 → see the change in 100ms". Plain native can't do that.

## React Native's split

React Native splits the app into two layers:

```
┌──────────────────────────────────────┐
│  JavaScript layer                    │  Your code:
│  app/, src/, components, screens     │  - UI (React)
│                                      │  - business logic
│                                      │  - styling
├──────────────────────────────────────┤
│  Native runtime (compiled binary)    │  Provided by Expo/RN:
│  - Hermes JS engine                  │  - runs JS at runtime
│  - Native modules                    │  - bridges to hardware
│    (mic, secure-store, audio-api)    │    (camera, mic, files, etc.)
└──────────────────────────────────────┘
```

JS doesn't need compiling — Hermes (the JS engine baked into the native binary) reads JS and runs it. So if we can swap the JS out without rebuilding the binary, dev iteration becomes fast.

## Production: JS is baked in

When you run `eas build --profile production`:

```
.ipa  =  [Native binary]  +  [main.jsbundle (your JS, pre-built)]
```

The bundle is generated once at build time and shipped inside the binary. At launch, the native runtime loads `main.jsbundle` from itself and runs it.

- Self-contained — works offline, no server needed.
- Same UX as any App Store app: tap icon → app opens → works.
- No URL prompt, no Metro, no Mac involved.

This is what TestFlight testers and App Store users get.

## Development: JS streams from Metro

In dev mode, we don't want JS embedded in the binary (that defeats the point). Instead:

```
┌──────────────┐         HTTP          ┌──────────────────┐
│  iPhone      │  ◄──────────────────  │  Mac             │
│  (real or    │   fetch jsbundle      │                  │
│   simulator) │                       │  Metro bundler   │
│              │                       │  (port 8081)     │
│  Dev client  │                       │                  │
│  app         │                       └─────────┬────────┘
└──────────────┘                                 │ watches
                                                 │
                                       ┌─────────▼────────┐
                                       │  app/index.tsx   │
                                       │  src/...         │
                                       └──────────────────┘
```

**Metro** = a local HTTP server running on the Mac. It:
- Watches JS/TS files in the project.
- On request, transpiles TS → JS, bundles all imports → returns one `main.jsbundle`.
- On file save, pushes the new bundle to connected clients → app hot-reloads (UI updates, state is preserved when possible).

**Dev client** = the native app shell *without* an embedded bundle. When it launches, it asks: "where is Metro?" That's why you saw the URL prompt — the dev client needs the Mac's IP and port to fetch JS.

- iOS Simulator: knows automatically (same machine).
- Real phone: needs to be on the same Wi-Fi; you type / scan the Mac's LAN IP.

## The typical dev cycle

```bash
# First time — native build (slow, ~5 min)
npx expo run:ios

# Every time after that — just Metro (fast, seconds)
npx expo start --dev-client
# edit JS → save → app reloads
```

You only need to rebuild the native binary when something **native** changes:
- New or upgraded native module (e.g. adding `react-native-audio-api`)
- Edits to `app.json` (permissions, plugins, bundle ID, icon)
- New splash screen / app icon
- iOS Info.plist or Android manifest changes

Pure JS/TS changes never require a rebuild.

## Why dev client at all (vs Expo Go)?

Expo Go is a pre-built host app from Expo. It works for projects that only use the Expo SDK's bundled native modules. The moment you add a custom native module (this project uses `react-native-audio-api` for raw PCM streaming, which Expo Go doesn't ship), Expo Go can't run your code.

Dev client = your *own* Expo Go, built with exactly the native modules your project needs. After that, JS iteration is identical to Expo Go.

## Summary table

|                    | Dev client                          | Production build                |
| ------------------ | ----------------------------------- | ------------------------------- |
| JS source          | Fetched from Metro over HTTP        | Embedded in binary              |
| Needs Mac running? | Yes                                 | No                              |
| Hot reload?        | Yes                                 | No                              |
| URL prompt?        | Yes (real device, first launch)     | No                              |
| Network required?  | LAN to Mac                          | No (app is self-contained)      |
| Used by            | Developer                           | TestFlight testers, end users   |
| Built with         | `npx expo run:ios` + `expo start`   | `eas build --profile production`|

## Where this fits in this project

- Local dev: `npx expo run:ios` once, then `npx expo start --dev-client`. The dev client app on the phone connects to Metro on the Mac.
- TestFlight / Release: `eas build --platform ios --profile production` produces an `.ipa` with JS embedded. `eas submit` uploads it to App Store Connect → TestFlight → App Store. End users tap an icon and the app just works, no URLs, no Metro, no Mac.

## Related concepts in other stacks

The same idea — separating the slow-to-build part from the fast-to-iterate part — shows up everywhere:

- **Web**: Vite / Webpack dev server serves modules; production bundles them statically.
- **Flutter**: `flutter run` hot-reloads Dart; release builds AOT-compile.
- **Electron**: dev loads from `localhost`; production loads from packaged files.

Once you see the pattern, every modern UI framework looks like a variation of "compile native shell once, swap UI fast".
