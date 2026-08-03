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

## 2. Build an installable APK

### Option A — EAS Build (cloud) ✅ recommended on this machine

**Why:** local Gradle currently fails on this PC. Java's NIO `Selector.open()` is being
blocked (verified: plain loopback sockets succeed, but `Selector.open()` throws
`Unable to establish loopback connection`) — almost always antivirus/EDR interfering with
the JDK's internal loopback pipe. Gradle cannot run without it. EAS runs Gradle on Expo's
servers, side-stepping the problem entirely.

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build --platform android --profile preview
```

`eas.json` is already configured — the **preview** profile emits a **`.apk`** (not an `.aab`),
which is what you want for direct install. When the build finishes, the CLI prints a download
URL; open it on the phone, or download the APK and install it via:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r path\to\app.apk
```

A free Expo account is required. Signing keys are generated and stored by EAS on first run.

### Option B — Local Gradle build

Only works once the Java/Selector issue above is resolved. To try to fix it, add these to your
antivirus / Defender **exclusions**, then reboot:

- `C:\Program Files\Android\Android Studio\jbr`
- `%USERPROFILE%\.gradle`
- `C:\Users\MuditSengar\FPO\FPO-Setu-Mobile\android`

Confirm the fix — this must print `SELECTOR_OK`:

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile && node -e "require('fs').writeFileSync('LbTest.java','import java.nio.channels.Selector;public class LbTest{public static void main(String[] a){try{Selector.open();System.out.println(\"SELECTOR_OK\");}catch(Throwable t){System.out.println(\"SELECTOR_FAIL \"+t);}}}')" && "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" LbTest.java
```

Once it prints `SELECTOR_OK`, build the APK. The native `android/` folder is already generated:

```bash
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk && set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr && cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile\android && gradlew.bat assembleRelease
```

Output APK:

```
android\app\build\outputs\apk\release\app-release.apk
```

Install it on a connected device/emulator:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\release\app-release.apk
```

> The release build is signed with the RN template's debug keystore, so it installs directly.
> Generate a real upload key before publishing to the Play Store.

### Option C — Android Studio GUI

Sometimes succeeds where the CLI fails, because Android Studio runs Gradle under a different
security context.

1. Android Studio → **Open** → `C:\Users\MuditSengar\FPO\FPO-Setu-Mobile\android`
2. Wait for the Gradle sync.
3. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## 3. Regenerating the native project

`android/` is generated output — safe to delete and recreate. Edit `app.json`, then:

```bash
npm run prebuild
```

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
