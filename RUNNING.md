# FPO Setu Mobile — Run on Android & build an APK

React Native + Expo (SDK 57, RN 0.86, React 19, TypeScript) port of the FPO Setu web app.
The web app in `../FPO-Setu` is untouched and remains the source of truth for behaviour.

---

## 0. One-time setup

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
npm install
```

Verify it compiles (this already passes):

```bash
npm run typecheck
```

---

## 1. Fastest path — run on an emulator or phone with Expo Go

Every native module this app uses (AsyncStorage, react-native-svg, react-native-screens,
safe-area-context, expo-speech) ships inside Expo Go, so **no native build is needed to test**.

### 1a. Start an Android emulator

Your Android SDK is already installed at `%LOCALAPPDATA%\Android\Sdk`.

Open **Android Studio → More Actions → Virtual Device Manager → ▶** on a device
(Pixel 6 / API 33+ recommended).

Or from a terminal:

```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -list-avds
```

```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd YOUR_AVD_NAME
```

### 1b. Start the dev server

```bash
npm start
```

Then press **`a`** in that terminal to open the app on the running emulator.
Expo installs Expo Go into the emulator automatically the first time.

### 1c. Or run on a physical phone

1. Install **Expo Go** from the Play Store.
2. Put the phone on the **same Wi-Fi** as the PC.
3. Run `npm start` and scan the QR code with Expo Go.

If your phone and PC are on different networks (or corporate Wi-Fi blocks it):

```bash
npx expo start --tunnel
```

---

## 2. Build & run in Android Studio (primary workflow)

The native project lives in `android/` and **is tracked in git**, so it survives a clean
checkout. You do not need to generate anything before opening it.

> ⚠️ **Never run `npx expo prebuild --clean`.** It deletes and regenerates `android/`, wiping
> any native edits and your IDE state. The project is already generated and configured.

### 2a. Open it

Android Studio → **Open** → select the **`android` folder** (not the repo root):

```
C:\Users\MuditSengar\FPO\FPO-Setu-Mobile\android
```

Wait for the Gradle sync to finish. `local.properties` (your SDK path) is generated
automatically on first open and is deliberately gitignored.

### 2b. Run the **debug** variant — needs Metro

Debug builds do **not** contain the JS bundle; they load it from the Metro dev server at
runtime. So start Metro **first**, in a terminal, and leave it running:

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile && npm start
```

Then hit **▶ Run** in Android Studio.

On a **physical device over USB**, also forward the Metro port or the app can't reach your PC:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

> If you see a white screen or *"Unable to load script"*, it's almost always this: Metro isn't
> running, or the port isn't forwarded.

### 2c. Build the **release** variant — standalone, no Metro

Release builds embed the JS bundle (`react { bundleCommand = "export:embed" }`), so the APK
runs on its own.

1. **Build → Select Build Variant…** → set the `app` module to **`release`**
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Click **locate** in the notification, or find it at:

```
android\app\build\outputs\apk\release\app-release.apk
```

> Leaving the variant on `debug` is the most common mistake here — you'll get an APK that
> white-screens on any machine without your Metro server running.

Release is signed with the React Native template's debug keystore (`android/app/debug.keystore`,
password `android`), so it installs directly. That keystore is public and fine for sideloading —
generate a real upload key before any Play Store submission.

---

## 3. Build an installable APK — fully local (CLI)

Everything below runs on this machine. No source code is uploaded anywhere.
The native `android/` project is already generated and the release build is signed with the
React Native template's debug keystore, so the APK installs directly.

### Option A — one command ✅

From a **normal PowerShell window**:

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile && .\build-apk.ps1
```

It sets `JAVA_HOME`/`ANDROID_HOME`, runs a preflight check, builds, and prints the APK path.
If PowerShell blocks the script:

```bash
powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
```

### Option B — raw Gradle

```bash
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk && set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr && cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile\android && gradlew.bat assembleRelease
```

Output APK:

```
android\app\build\outputs\apk\release\app-release.apk
```

Install on a connected device or running emulator:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\release\app-release.apk
```

> Generate a real upload keystore before publishing to the Play Store — the debug keystore is
> fine for sideloading and testing only.

### Option C — Android Studio GUI

See [section 2](#2-build--run-in-android-studio-primary-workflow) — that's the primary
workflow and covers the build-variant trap the CLI options don't have.

---

### Troubleshooting: "Unable to establish loopback connection"

If Gradle fails immediately with this, run:

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile && .\build-apk.ps1
```

and read the preflight result. The underlying cause is that `java.nio.channels.Selector.open()`
fails. On JDK 21 / Windows the selector's wakeup pipe is built on an **AF_UNIX socket**, and in
some restricted process contexts that `connect()` returns `Invalid argument`. Plain TCP loopback
still works, which is why the failure looks confusing.

Diagnosed on this machine: **not** antivirus (only Defender is installed, and the Winsock
catalog contains no third-party layered providers). It reproduces only inside automated/agent
shells, so:

1. Run the build from a **normal** PowerShell window — this is usually enough.
2. If it still fails there, reboot and retry.
3. Failing that, use the Android Studio GUI (Option C), which runs Gradle in its own context.

---

## 4. Changing native config (app name, icon, package id)

`android/` is **tracked in git and hand-maintained** — it is no longer disposable output.

For most changes, edit the native files directly:

| Change | File |
|---|---|
| App display name | `android/app/src/main/res/values/strings.xml` |
| Package / applicationId | `android/app/build.gradle` + `android/app/src/main/java/com/fposetu/mobile/` |
| Version name / code | `android/app/build.gradle` |
| Permissions | `android/app/src/main/AndroidManifest.xml` |
| Icons / splash | `android/app/src/main/res/mipmap-*`, `drawable-*` |

If you ever do need to regenerate from `app.json`, commit first so you can diff and restore
anything hand-edited:

```bash
git add -A && git commit -m "checkpoint before prebuild" && npx expo prebuild --platform android
```

Omit `--clean` — it deletes the folder outright rather than merging.

---

## Project layout

```
src/
├── theme/            Design tokens ported from the web app's styles.css
├── lib/
│   ├── mockData.ts   All entities + seed data (ported verbatim from the web app)
│   ├── app-state.tsx Global Context; localStorage -> AsyncStorage
│   ├── buyer-storage.ts  Demand/supply persistence (the app's only real writes)
│   └── i18n.ts       English->Marathi dictionary + tr()
├── components/
│   ├── ui/           RN replacements for the shadcn/Radix primitives actually used
│   ├── charts.tsx    react-native-svg Line/Bar charts (replaces recharts)
│   ├── common.tsx    Shared card/tile/chip pieces
│   ├── layout/       TopBar + RoleShell
│   └── AssistantWidget.tsx
├── features/         fpo-sections, market-readiness, buyer-shared
├── navigation/       React Navigation stacks & tabs (replaces file-based routing)
└── screens/          farmer/ fpo/ buyer/ + RoleSelectScreen
```

## Known parity gap

**Voice dictation (speech-to-text)** is the one feature not carried over. The web app used the
browser `SpeechRecognition` API, which has no built-in Expo equivalent. Text input works
everywhere and the mic button explains this. Text-to-speech ("Listen" buttons) **does** work
via `expo-speech`.

To add dictation later, install `expo-speech-recognition` and implement `startListening` in
`src/hooks/useSpeech.ts` — that hook is the single integration point, and no screen code
needs to change.
