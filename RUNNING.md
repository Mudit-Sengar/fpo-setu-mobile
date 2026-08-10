# FPO Setu Mobile — Run on Android & build an APK

Bare React Native (RN 0.86, React 19, TypeScript, New Architecture) port of the FPO Setu web app.
The web app in `../FPO-Setu` is untouched and remains the source of truth for behaviour.

This is a **bare React Native CLI project** — there is no Expo. No Expo Go, no EAS, no
`expo-*` packages, no `app.json`/`eas.json`. The `android/` folder is the only source of
truth for native config and is built purely with the React Native CLI + Gradle.

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

## 1. Run on an emulator or phone

There is no Expo Go path — a real (debug) build of this app must be installed once per
device/emulator, same as any bare RN app. After that, Metro pushes JS updates instantly.

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

### 1b. Install & launch

```bash
npm run android
```

This ensures Metro is running (starting it silently in the background if it isn't — see
`scripts/ensure-metro.js`), builds the debug variant via the React Native CLI
(`react-native run-android`), installs it on the running emulator/device, and launches it.

You do **not** need to run `npm start` first — `npm run android` handles that for you now,
without opening a separate visible terminal window for it (see the note below). Running
`npm start` yourself first is still fine if you want Metro's interactive terminal (reload
shortcuts, live log output) — `npm run android` will just detect it's already up and skip
starting another one.

When you're done for the day, or if the dev server ever seems stuck, stop it cleanly with:

```bash
npm run stop
```

This kills whatever is listening on port 8081 and its child processes (Metro's transform
workers), rather than hunting for node.exe processes in Task Manager.

> **Why `npm run android` used to open a new "Metro" Command Prompt window every time.**
> `react-native run-android` has a built-in fallback: if it doesn't detect Metro already
> running, it opens Metro in a brand-new terminal window so you can see its banner. That
> window's script ends in `pause`, so it never closes itself — running `npm run android`
> repeatedly (the normal dev loop) left more of these open every time. `npm run android` now
> runs `scripts/ensure-metro.js` first (silently — no window) and passes `--no-packager` to
> `react-native run-android`, which disables that fallback outright. Metro itself still starts
> and stays running in the background exactly as before; only the extra visible window is gone.

### 1c. Or run on a physical phone over USB

1. Enable USB debugging on the phone and connect it.
2. Forward the Metro port: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081`
3. `npm start`, then `npm run android`.

---

## 2. Build & run in Android Studio (primary workflow)

The native project lives in `android/` and **is tracked in git**, so it survives a clean
checkout. You do not need to generate anything before opening it.

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
> running, or the port isn't forwarded. Force-stop and relaunch the app once Metro is up if it
> was already open when Metro wasn't running yet.

**This is now auto-recovered for you in most cases.** Every debug build — whether triggered by
`gradlew installDebug`, `npm run android`, or Android Studio's own ▶ Run button — runs
`scripts/ensure-metro.js` as part of the build (see the hook in `android/app/build.gradle`,
scoped to the `debug` variant only). It checks `http://127.0.0.1:8081/status`; if Metro isn't
answering, it starts it (output goes to `.metro-autostart.log`, gitignored) and waits up to 30s
for it to become ready before letting the build proceed. If Metro genuinely can't start, the
build fails with a clear message instead of producing an APK that will blank-screen on launch.

This only fires when a build actually runs, though — it can't help if Metro dies **after** the
app is already installed and you just tap the icon again (e.g. after a reboot) without
rebuilding. In that specific case you'll still see "Unable to load script" once; press ▶ Run in
Android Studio again (or `npm start`) and relaunch.

### 2c. Build the **release** variant — standalone, no Metro

Release builds embed the JS bundle via the standard React Native CLI `bundle` command, so the
APK runs on its own.

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

## 4. Visual verification on the emulator

The running app is the source of truth for UI work — a screen is not "done" until it has been
looked at. `scripts/` holds three small helpers that make that loop fast. They all talk to
whatever device `adb devices` shows, so start an emulator (section 1a) and Metro (section 1b)
first.

### Screenshots

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\shot.ps1 -Name farmer-home
```

Writes `.shots\farmer-home.png` (gitignored) at the device's native 1080x2400.

Two traps this script exists to avoid:

- **`adb exec-out screencap -p > file.png` produces a corrupt PNG in PowerShell.** `>` applies
  text encoding and prepends a BOM. The script writes on-device and `adb pull`s instead, which
  is byte-exact.
- **The emulator reports two displays**, so a bare `screencap` warns and picks one
  arbitrarily — screenshots silently come from the wrong display. The script resolves
  `HWC display 0` from `dumpsys SurfaceFlinger` and pins to it.

### Driving the UI

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\ui.ps1 tap 540 882
```

| Command | Effect |
|---|---|
| `restart` | force-stop + relaunch (use after a native change or to reset navigation) |
| `tap X Y` | tap at device pixels — screenshot coordinates map 1:1 |
| `swipe X1 Y1 X2 Y2 [ms]` | scroll; `swipe 540 1800 540 700 400` is roughly one page down |
| `text "onion price"` | type into the focused field |
| `back` / `home` | hardware keys |
| `clear` | `pm clear` — wipes the persisted role + AsyncStorage, back to Role Select |
| `logs` / `errors` | recent `ReactNativeJS` output / errors only |
| `focus` | which activity is in front |

After `clear` + `restart`, give the app ~8s before tapping — the first frame renders while
Metro is still serving the bundle, and taps sent before that are dropped.

### Reading the database

Screens are fed from `databases/fposetu.sqlite` (see `src/db/`). To check a screen against what
the DB actually holds rather than trusting the screen alone:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\db.ps1 "select name from fpos limit 5"
```

Run it with no argument to list tables.

### Microphone

The Krishi Bandhu mic and the assistant's voice input need `RECORD_AUDIO`, which is not granted
on a fresh install (and `pm clear` revokes it again). Grant it without touching the permission
dialog:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe shell pm grant com.fposetu.mobile android.permission.RECORD_AUDIO
```

The listening state is visibly distinct — card gains a green border, header reads
"Listening… speak now", a red dot appears, and the mic button fills and switches to mic-off.

### Note on the browser preview pane

`.claude/launch.json` starts Metro, but Metro serves a JS bundle, not a web page — this app has
no web target. Opening `localhost:8081` in a browser shows Metro's status page, never the UI.
All visual verification goes through the emulator and the scripts above.

---

## 5. Accounts & authentication

Sign-in is database-driven. Nothing in the UI knows a username or password — the
login screen collects three fields and hands them to `src/services/authService.ts`,
which queries SQLite through `src/db/repositories/authRepository.ts`.

### Seeded accounts

Written once on first run by `src/db/seedAuth.ts`, then treated as ordinary rows.

| Username | Password | Role | Profile |
|---|---|---|---|
| `farmer01` | `farmer` | Farmer | Suresh Patil (`MH-AH-2024-00831`) |
| `fpo01` | `fpo` | FPO | Samruddha Adivasi Agro (`fpo-1`) |
| `buyer01` | `buyer` | Buyer / Seller | Sahyadri Foods (`b-1`) |
| `admin01` | `admin` | Admin | all three of the above |

Admin is not a fourth view: it grants access to the other three, switched in place
from the shield chip in the header without signing in again.

### Adding a user without touching code

Passwords are stored as PBKDF2-HMAC-SHA256 in the portable
`pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>` format (Django/passlib
compatible), so any language can mint one. Generate the hash, then insert:

```bash
node -e "const c=require('crypto'),s=c.randomBytes(16),i=10000;console.log(['pbkdf2_sha256',i,s.toString('base64'),c.pbkdf2Sync(process.argv[1],s,i,32,'sha256').toString('base64')].join(String.fromCharCode(36)))" mypassword
```

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\db.ps1 "INSERT INTO users (username,password_hash,display_name) VALUES ('farmer02','<hash>','Sunita Deshmukh'); INSERT INTO user_roles (user_id,role_code) SELECT id,'farmer' FROM users WHERE username='farmer02'; INSERT INTO farmer_profiles (user_id,farmer_id) SELECT id,'MH-LT-2024-01122' FROM users WHERE username='farmer02';"
```

That account can sign in immediately — no rebuild, no restart.

Useful maintenance queries:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\db.ps1 "UPDATE users SET is_active=0 WHERE username='fpo01'"
```

Deactivating a user also kills any persisted session: `authService.restore()`
re-checks the account on every launch rather than trusting stored state.

### Moving auth to a backend

`AuthService` in `src/services/authService.ts` is the seam. Write a second
implementation that calls HTTP instead of SQLite and change the final
`export const authService` line — no screen, navigator or context changes, since
every method is already async and returns plain serialisable data. The stored hash
format is deliberately one a Django/Node/Go backend can verify unchanged.

> The on-device PBKDF2 cost is 10,000 iterations, well below the ~600k recommended
> server-side. It runs single-threaded in JS on the phone, and higher counts
> visibly block the login button. Raise it in the backend, where the work costs a
> server core rather than the user's frame budget.

### Test helper

`scripts/login.ps1` drives the login form end-to-end for verification:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\login.ps1 -User farmer01 -Pass farmer -Role farmer
```

---

## 6. Changing native config (app name, icon, package id)

`android/` is **tracked in git and hand-maintained** — it is the only source of truth for
native configuration. There is no `app.json`/`expo prebuild` to regenerate it from anymore.
Edit the native files directly:

| Change | File |
|---|---|
| App display name | `android/app/src/main/res/values/strings.xml` |
| Package / applicationId | `android/app/build.gradle` + `android/app/src/main/java/com/fposetu/mobile/` |
| Version name / code | `android/app/build.gradle` |
| Permissions | `android/app/src/main/AndroidManifest.xml` |
| Icons / splash | `android/app/src/main/res/mipmap-*`, `drawable-*` |
| SDK/NDK/build-tools versions | `android/build.gradle` (`ext { }` block at the top) |

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

## Voice: text-to-speech and speech-to-text

- **Text-to-speech** ("Listen" buttons) — `src/hooks/useSpeech.ts`, on the app's **own
  `NativeTts` TurboModule**: spec in `src/native/NativeTts.ts`, Kotlin implementation in
  `android/app/src/main/java/com/fposetu/mobile/TtsModule.kt`, registered via `TtsPackage.kt`
  in `MainApplication.kt`. Hand-written because `react-native-tts` is a dead end on RN 0.86 —
  no `codegenConfig` (not a TurboModule), `ReactContextBaseJavaModule` (old bridge, and 0.86
  has no legacy interop layer), and a bundled Gradle file calling the long-dead `jcenter()`
  with AGP 1.3.1, which fails to configure at all under Gradle 9.
- **Speech-to-text** (Krishi Bandhu mic on Farmer Home) — `src/hooks/useVoiceInput.ts`, on
  `@dbkable/react-native-speech-to-text` (a TurboModule — required since this app runs on the
  New Architecture with no legacy-bridge fallback).

App-level Codegen is configured by the `codegenConfig` block in `package.json` (`jsSrcsDir:
"src/native"`), which generates the `NativeTtsSpec` base class that `TtsModule.kt` extends.
Any new app-local TurboModule spec goes in `src/native/` and gets registered in `TtsPackage.kt`
(or its own package class added to `MainApplication.kt`'s package list).

**Known regression vs. the previous Expo-based implementation:** the earlier hook negotiated a
supported locale and retried alternate Android recognition services on failure (see git history:
"negotiate a supported speech locale", "stop force-selecting a recognition service" — real fixes
for real on-device bugs). `@dbkable/react-native-speech-to-text`'s API (`start({language})` /
`stop()` / `requestPermissions()` / `isAvailable()` plus result/error/end listeners) doesn't
expose service enumeration or per-attempt service targeting, so that negotiation/retry logic
could not be ported as-is — this is a deliberate, documented trade-off for trying the maintained
npm package first. If voice input misbehaves on real devices the way the old force-a-service bug
did, the fix is a small custom Android TurboModule wrapping `android.speech.SpeechRecognizer`
directly, which can reintroduce that negotiation using the exact same manifest `<queries>` already
declared for it in `AndroidManifest.xml`.
