# FPO Setu Mobile

A React Native mobile app for connecting farmers, Farmer Producer Organizations (FPOs), and agricultural buyers/suppliers. FPO Setu is a digital platform that bridges gaps in India's agricultural value chain.

**Current Build:** React Native 0.86 + Expo SDK 57 + TypeScript  
**Status:** Production-ready prototype on Android; web counterpart in `../FPO-Setu`

---

## Table of Contents

1. [Overview](#overview)
2. [Roles & Features](#roles--features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Architecture](#architecture)
6. [Installation](#installation)
7. [Running the App](#running-the-app)
8. [Building for Android](#building-for-android)
9. [Data & Storage](#data--storage)
10. [Krishi Bandhu Voice Navigator](#krishi-bandhu-voice-navigator)
11. [Android Permissions](#android-permissions)
12. [Troubleshooting](#troubleshooting)
13. [Known Limitations](#known-limitations)

---

## Overview

**FPO Setu** (Bridge) is a digital platform designed to:

- **Connect farmers** with formal FPOs (Farmer Producer Organizations) for collective market power
- **Empower FPOs** to manage operations, find buyers, and access capital
- **Enable buyers/suppliers** to post demand/supply and directly engage with FPOs

The app supports **English, Hindi, and Marathi** and includes **Krishi Bandhu**, a voice-driven navigator using speech-to-text (via `expo-speech-recognition`), allowing farmers to navigate hands-free with voice commands or text.

This is a **mobile-first React Native port** of the web application (which remains the source of truth for behavior).

---

## Roles & Features

### Farmer Role

Farmers discover FPOs, track benefits, and access market intelligence.

**Home Screen** (Krishi Bandhu Navigator)
- Voice or text input to navigate ("Show me onion prices", "Tell me about my FPO", etc.)
- Intent-driven navigation: resolves natural-language commands to screens
- Fallback to typed input if voice unavailable

**Tabs:**
- **Home:** Farmer greeting + Krishi Bandhu navigator
- **My FPO:** Discover nearby FPOs, view details, supply trends
- **Learn:** Educational content on aggregation, aggregators, collective marketing
- **Connect:** Connect with FPO members, access networks
- **Schemes:** Government agricultural schemes and benefits

**Profile Screen** (modal navigation)
- Farmer profile with basic info

### FPO Role

FPO managers oversee operations, find buyers, and access capital programs.

**Stack Navigation** (no tab bar; back-only navigation)
- **Home:** Primary hub with business metrics
- **Manage:** Operational dashboards (members, capacity, supply)
- **Partners:** Buyer and supplier relationships
- **Help:** Capital access, scheme eligibility
- **Capacity:** Supply aggregation and grading
- **My FPO:** FPO profile and settings

### Buyer/Supplier Role

Buyers and agricultural input suppliers post demand and discover FPO supply.

**Tabs:**
- **Profile & Order:** Buyer profile with active orders/posts
- **Connect:** Find FPOs matching demand/supply specs
- **Reviews:** Seller/buyer reputation and reviews

---

## Tech Stack

### Core Framework
- **React Native:** 0.86.2
- **Expo:** ~57.0.9
- **React:** 19.2.3
- **TypeScript:** ~6.0.3

### Navigation & UI
- **@react-navigation/native:** ^7.3.14
- **@react-navigation/native-stack:** ^7.18.6
- **@react-navigation/bottom-tabs:** ^7.18.14
- **lucide-react-native:** ^1.28.0 (icons)
- **react-native-svg:** 15.15.4

### Native & Storage
- **@react-native-async-storage/async-storage:** 2.2.0 (persisted app state)
- **react-native-safe-area-context:** ~5.7.0 (notch handling)
- **react-native-screens:** ~4.26.0 (native stack optimization)

### Voice & Speech
- **expo-speech-recognition:** ^56.0.1 (speech-to-text for Krishi Bandhu)
- **expo-speech:** ~57.0.1 (text-to-speech, not currently used)

### Other
- **expo-constants:** ~57.0.9 (build/environment info)
- **expo-status-bar:** ~57.0.1 (status bar styling)

### Dev Tools
- **ESLint:** ^9.0.0 with expo config
- **TypeScript:** Strict mode enabled

---

## Project Structure

```
FPO-Setu-Mobile/
├── android/                          # Native Android project (tracked in git)
│   ├── app/
│   │   ├── src/main/
│   │   │   └── AndroidManifest.xml   # Permissions & voice service queries
│   │   └── build.gradle
│   ├── build.gradle
│   └── gradle wrapper (gradlew.bat)
├── assets/                           # App icon, splash, adaptive icons
├── src/
│   ├── components/
│   │   ├── ui/                       # Reusable UI primitives
│   │   │   ├── Text.tsx              # Translated text component
│   │   │   ├── Toast.tsx             # Toast notifications
│   │   │   └── index.tsx
│   │   ├── layout/
│   │   │   ├── RoleShell.tsx         # Wraps screens with header + role accent
│   │   │   ├── TopBar.tsx            # Role-colored header
│   │   │   └── AssistantWidget.tsx   # Krishi Bandhu UI (voice input widget)
│   │   ├── common.tsx                # Tile, card, chart components
│   │   └── charts.tsx                # Data visualization
│   ├── features/
│   │   ├── buyer-shared.tsx          # Shared buyer UI logic
│   │   ├── fpo-sections.tsx          # Shared FPO features
│   │   └── market-readiness.tsx      # Market metrics
│   ├── hooks/
│   │   ├── useVoiceInput.ts          # Krishi Bandhu voice logic
│   │   ├── useSpeech.ts              # Text-to-speech hook
│   │   └── useFarmerBack.ts          # Farmer back-navigation
│   ├── lib/
│   │   ├── app-state.tsx             # Global state (lang, role, FPO)
│   │   ├── mockData.ts               # Seed data: FPOs, farmers, buyers
│   │   ├── farmer-intents.ts         # Krishi Bandhu intent resolver
│   │   ├── buyer-storage.ts          # AsyncStorage for demand/supply
│   │   └── i18n.ts                   # (deprecated; use app-state.t())
│   ├── navigation/
│   │   ├── index.tsx                 # Root navigator setup
│   │   └── types.ts                  # TypeScript navigation types
│   ├── screens/
│   │   ├── RoleSelectScreen.tsx      # Role picker + language selector
│   │   ├── farmer/                   # 6 farmer screens
│   │   │   ├── FarmerHomeScreen.tsx  # Home + Krishi Bandhu navigator
│   │   │   ├── MyFpoScreen.tsx
│   │   │   ├── LearnScreen.tsx
│   │   │   ├── ConnectScreen.tsx
│   │   │   ├── SchemesScreen.tsx
│   │   │   └── FarmerProfileScreen.tsx
│   │   ├── fpo/                      # 6 FPO screens (stack, no tabs)
│   │   │   ├── FpoHomeScreen.tsx
│   │   │   ├── FpoManageScreen.tsx
│   │   │   ├── FpoPartnersScreen.tsx
│   │   │   ├── FpoHelpScreen.tsx
│   │   │   ├── FpoCapacityScreen.tsx
│   │   │   └── FpoMyScreen.tsx
│   │   └── buyer/                    # 3 buyer screens (tabs)
│   │       ├── BuyerHomeScreen.tsx
│   │       ├── BuyerMatchingScreen.tsx
│   │       └── BuyerReviewsScreen.tsx
│   ├── theme/
│   │   └── index.ts                  # Design tokens (colors, spacing, radius)
│   └── (index.ts entry point)
├── App.tsx                           # Root component
├── app.json                          # Expo configuration
├── index.ts                          # Entry point (calls App)
├── tsconfig.json                     # TypeScript strict mode
├── package.json                      # Dependencies & scripts
├── eas.json                          # EAS Build config (development/preview/production)
├── build-apk.ps1                     # PowerShell script for local APK builds
├── RUNNING.md                        # Legacy setup documentation
└── LICENSE                           # Apache 2.0
```

---

## Architecture

### Navigation Flow

```
RootNavigator
├── role == null
│   └── RoleSelectScreen (role picker + language selector)
├── role === "farmer"
│   └── FarmerNavigator
│       ├── FarmerTabNavigator (5 bottom tabs)
│       │   ├── FarmerHome (+ Krishi Bandhu)
│       │   ├── MyFpo
│       │   ├── Learn
│       │   ├── Connect
│       │   └── Schemes
│       └── FarmerProfileScreen (modal from header)
├── role === "fpo"
│   └── FpoNavigator (stack, no tabs)
│       ├── FpoHome
│       ├── FpoManage
│       ├── FpoPartners
│       ├── FpoHelp
│       ├── FpoCapacity
│       └── FpoMy
└── role === "buyer"
    └── BuyerNavigator (3 bottom tabs)
        ├── BuyerHome
        ├── BuyerMatching
        └── BuyerReviews
```

### State Management

**Global App State** (`src/lib/app-state.tsx`):
- `lang`: Current language (en/hi/mr)
- `role`: Selected role (farmer/fpo/buyer/null)
- `activeFpoId`: Currently selected FPO (default: "fpo-1")
- Persisted to `AsyncStorage` (native equivalent of localStorage)

**Component State**:
- Local to screens/components; no Redux/Zustand
- Only persistent data: demand/supply posts (buyers) via `buyer-storage.ts`

### Theming

Colors, spacing, radius, and typography defined in `src/theme/index.ts`:

- **Primary:** #A91E22 (Red — brand)
- **Farmer Accent:** #2E7D52 (Green)
- **FPO Accent:** #A91E22 (Red — same as primary)
- **Buyer Accent:** #1F6E78 (Teal)

Roles are visually distinguished by their accent color in headers and buttons.

---

## Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Android Studio** (for building native)
- **Android SDK:** API 33+ (Pixel 6 / Android 13+ recommended)
- **Java:** Bundled with Android Studio JBR

### Setup

1. **Clone and install dependencies:**

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
npm install
```

2. **Verify it compiles:**

```bash
npm run typecheck
```

---

## Running the App

### Option 1: Expo Go (Fastest, No Native Build)

Every native module (AsyncStorage, SVG, screens, safe-area, speech) ships inside Expo Go.

#### 1a. Start an Android Emulator

Open **Android Studio → More Actions → Virtual Device Manager** and launch a device (Pixel 6 / API 33+).

Or from terminal:

```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd YOUR_AVD_NAME
```

#### 1b. Start Expo Dev Server

```bash
npm start
```

Press **`a`** to open on the running emulator. Expo Go installs automatically on first run.

#### 1c. Or Run on Physical Phone

1. Install **Expo Go** from Google Play
2. Ensure phone is on **same Wi-Fi** as PC
3. Run `npm start` and scan the QR code with Expo Go

For different networks or corporate Wi-Fi blocking:

```bash
npx expo start --tunnel
```

### Option 2: Android Studio (Recommended for Development)

The native `android/` folder is tracked in git—no generation needed.

#### 2a. Open in Android Studio

1. **Android Studio → Open**
2. Select `android` folder (not the repo root)
3. Wait for Gradle sync (first sync ~2 min)

#### 2b. Debug Build (Requires Metro)

Start the dev server first:

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
npm start
```

Then **▶ Run** in Android Studio. The app loads the JS bundle from Metro at runtime.

**On Physical Device (USB):** Forward the Metro port:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

**White screen / "Unable to load script"?** → Metro isn't running or port isn't forwarded.

#### 2c. Release Build (Standalone, No Metro)

The JS bundle is embedded, so the APK runs offline.

1. **Build → Select Build Variant** → set to `release`
2. **Build → Build Bundle(s)/APK(s) → Build APK(s)**
3. Find the APK at: `android\app\build\outputs\apk\release\app-release.apk`

**⚠️ Common mistake:** Leaving variant on `debug` produces an APK that white-screens without Metro.

---

## Building for Android

### Quick Build (PowerShell)

All-in-one: preflight check → build → install.

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
.\build-apk.ps1
```

If blocked:

```bash
powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
```

The script:
- Sets `JAVA_HOME` and `ANDROID_HOME`
- Probes Java NIO Selector (detects sandboxed/restricted shells upfront)
- Runs Gradle release build
- Prints the APK path for installation

**Preflight failure?** The script detected you're in a restricted shell (CI, IDE sandbox, VM). Run from a normal PowerShell window, or build via Android Studio GUI.

### Manual Gradle Build

From `android/` folder:

**Debug APK** (requires Metro):
```bash
cd android && .\gradlew.bat assembleDebug
```

**Release APK** (standalone):
```bash
cd android && .\gradlew.bat assembleRelease
```

Output: `android\app\build\outputs\apk\release\app-release.apk`

### Install on Device/Emulator

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r app-release.apk
```

### Signing

Release APKs are signed with React Native's **template debug keystore** (`android/app/debug.keystore`, password: `android`). Suitable for sideloading and testing. **Before Play Store submission**, generate a real upload key.

---

## Data & Storage

### Mock Data

**`src/lib/mockData.ts`:**
- 12+ **FPOs** with supply chains, tiers, compliance scores, reviews
- 3+ **Farmers** (demo users)
- 3+ **Buyers** (demo users)
- Educational content, schemes, market data

No backend API calls; all data is seeded in the app.

### Persistent Storage

**AsyncStorage** (persisted to device):

| Key | Purpose | Type |
|-----|---------|------|
| `setu.lang` | Selected language | String (en/hi/mr) |
| `setu.role` | Selected role | String (farmer/fpo/buyer) |
| `setu.fpo` | Active FPO ID | String |
| `setu.demands` | Buyer posted demands | JSON array |
| `setu.supplies` | Supplier posted supplies | JSON array |

**Toast messages** (ephemeral; not persisted):
- Success/error feedback on user actions

### Backend Integration

Currently **offline.** All data is mocked. To add a real backend:

1. Replace `mockData` calls with API calls
2. Add `QueryClientProvider` to `App.tsx` (currently commented out)
3. Use `React Query` or `fetch` for async data
4. Update `app-state.tsx` to fetch persisted role/language from backend

---

## Krishi Bandhu Voice Navigator

**Krishi Bandhu** ("Agricultural Friend") is a hands-free voice navigator for farmers. Located on the Farmer Home screen.

### How It Works

1. Farmer taps the **mic icon**
2. Says a command: *"Show me my FPO", "Tell me onion prices", "Open Connect", etc.*
3. Speech-to-text (via `expo-speech-recognition`) transcribes the command
4. `farmer-intents.ts` resolves intent → destination screen
5. App navigates automatically; shows a success toast

### Fallback to Typed Input

If voice fails (no mic, no permission, device doesn't support it):
- Input field becomes available for typing
- Same commands work when typed

### Implementation

**`src/hooks/useVoiceInput.ts`:**
- Lazy-loads `expo-speech-recognition` (fails gracefully in Expo Go)
- Handles permissions (mic access)
- Manages retry logic for language/service mismatches
- Prefers **cloud recognition** (no language pack required)
- Supports English, Hindi, Marathi locales

**`src/lib/farmer-intents.ts`:**
- Defines recognized intents (e.g., "onion", "My FPO", "Learn")
- Resolves text → `FarmerDestination` (screen name + params)
- Supports fuzzy matching on commodity names

### Supported Intents

Examples (from `farmer-intents.ts`):

- "Show me My FPO" → MyFpo tab
- "Tell me about onion" → Learn tab (onion commodity)
- "Onion prices" → MyFpo (price trends)
- "Open Connect" → Connect tab
- "Government schemes" → Schemes tab

### Permission Requirements

**`RECORD_AUDIO`** must be granted on Android. App requests at runtime; farmer can deny but still use typed input.

### Troubleshooting Voice

See [Troubleshooting](#troubleshooting) section below.

---

## Android Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

| Permission | Purpose | Requested |
|-----------|---------|-----------|
| `INTERNET` | Network access | Implicit (always granted) |
| `RECORD_AUDIO` | Microphone for Krishi Bandhu | Runtime request on first use |
| `READ_EXTERNAL_STORAGE` | (SDK <= 32 only) | No |
| `WRITE_EXTERNAL_STORAGE` | (SDK <= 32 only) | No |
| `VIBRATE` | Haptic feedback | Implicit |
| `SYSTEM_ALERT_WINDOW` | (rarely used) | No |

**Voice Service Queries** (Android 11+):
- App queries for `android.speech.RecognitionService` and `android.speech.action.RECOGNIZE_SPEECH` to discover on-device speech recognizers.
- Without these, `getAvailable()` always returns false on Android 11+.

---

## Useful Commands

```bash
# Start dev server
npm start

# Type check
npm run typecheck

# Lint code
npm run lint

# Run on Android emulator (Expo)
npm run android

# Prebuild (rarely needed; native is already generated)
npm run prebuild

# Build debug APK (from android/)
npm run apk:debug

# Build release APK (from android/)
npm run apk
```

---

## Troubleshooting

### Voice Input Not Working

**Symptom:** Mic icon does nothing, or shows "Voice isn't available".

**Causes & Fixes:**

1. **Running in Expo Go?**
   - Expo Go doesn't include native modules. Voice only works in a native build (Android Studio or `npm run android` with native build).
   - Fallback: Use typed input.

2. **Microphone permission denied?**
   - App shows: "Microphone permission is needed for voice."
   - Grant in: **Settings → Apps → FPO Setu → Permissions → Microphone**
   - Then try again.

3. **Microphone blocked?**
   - App shows: "Microphone access is blocked. Enable it in Settings."
   - Grant in: **Settings → Apps → FPO Setu → Permissions → Microphone**
   - Or: **Settings → Privacy → Microphone → enable FPO Setu**

4. **Device has no recognizer installed?**
   - Unlikely. Most Android 13+ devices have Google Recorder built-in.
   - If missing: Install **Google Recorder** from Play Store.

5. **No internet connection?**
   - Voice uses cloud recognition (requires data/Wi-Fi).
   - Error: "Voice needs an internet connection."
   - Connect to Wi-Fi or mobile data.

6. **Language pack not installed?**
   - App forces cloud recognition; offline packs aren't required.
   - If still failing: Try restarting the app.

### White Screen / "Unable to Load Script"

**In Android Studio debug build:**
- Metro dev server not running.
- Fix: `npm start` in a separate terminal, leave it running.

**On physical device over USB:**
- Metro port not forwarded.
- Fix: `adb reverse tcp:8081 tcp:8081`

**On release APK:**
- Release variant not selected.
- Fix: **Build → Select Build Variant → set to release**, then rebuild.

### APK Build Fails

**Preflight error (Selector failed):**
- You're in a restricted shell (CI, IDE sandbox).
- Fix: Run `.\build-apk.ps1` from a normal PowerShell window.

**Gradle sync hangs:**
- First sync can take 2-3 min.
- Check: **File → Invalidate Caches** and restart Android Studio.

**Out of memory:**
- Gradle needs ~2 GB heap.
- Fix: Increase in `android/gradle.properties`: `org.gradle.jvmargs=-Xmx2048m`

### Emulator won't start

**Missing AVD (virtual device):**
```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -list-avds
```

If none listed, create one in **Android Studio → Virtual Device Manager**.

**Hyper-V conflicts (Windows):**
- Emulator needs virtualization. If Hyper-V is on, disable or use WSL2.

### Navigation Issues

**Back button doesn't work as expected:**
- Farmer tabs use `backBehavior="history"` to return to the previously-visited tab (not always the first tab).

**Bottom sheet / modal not appearing:**
- Ensure `RoleShell` wraps the screen. Some screens require it for header access.

---

## Known Limitations

### Prototype Status

- **No backend:** All data is mock. Ready for API integration.
- **No real authentication:** Role is persisted locally; a real backend would replace this.
- **No user profiles saved:** Farmer name/FPO choice reset on app uninstall.
- **Buyer demand/supply is local-only:** Persisted in AsyncStorage, not synced to a server.

### Voice Navigator (Krishi Bandhu)

- **Limited intent set:** Only ~10 intents defined. Add more in `src/lib/farmer-intents.ts`.
- **English/Hindi/Marathi only:** Other languages would require new locale codes + training.
- **No voice feedback:** App shows toasts, not audio confirmations. Add `expo-speech` TTS for this.
- **Cloud-only:** No offline speech recognition. Requires internet.

### UI/UX

- **English strings hardcoded:** Most strings are English; some aren't translated to Hindi/Marathi yet.
- **No dark mode:** App is light-only.
- **Limited accessibility:** No screen reader support or high-contrast mode.

### Performance

- **No pagination:** FPO/farmer lists load all at once (fine for 12–50 items; would need pagination for 1000s).
- **No caching:** Every screen reload fetches from mock data (no real API calls currently).

### Testing

- **No automated tests:** Unit/E2E tests not yet written.
- **Manual testing only:** QA is by running the app on a device.

---

## Development Notes

### Adding a New Feature

1. **Create a screen** in `src/screens/{role}/`
2. **Add navigation** in `src/navigation/index.tsx`
3. **Define types** in `src/navigation/types.ts`
4. **Wrap with `RoleShell`** for header/accent
5. **Use `useApp()` for global state:** `const { lang, t, role } = useApp()`
6. **Use `toast` for feedback:** `import { toast } from "../components/ui"`

### Adding a Voice Intent

1. Edit `src/lib/farmer-intents.ts`
2. Add intent object to `INTENTS` array
3. Test with voice or typed input on Farmer Home

### Updating Translations

Edit `STRINGS` in `src/lib/app-state.tsx`. All UI text pulls from here via `t()`.

### Styling

Use theme tokens from `src/theme/index.ts`, not hard-coded colors:

```typescript
import { colors, spacing, radius } from "../theme";

// Good
backgroundColor: colors.farmer

// Avoid
backgroundColor: "#2E7D52"
```

### Native Modifications

If you modify `android/` (e.g., add a new permission):
- Edit `android/app/src/main/AndroidManifest.xml` directly
- **Never run `expo prebuild --clean`**—it deletes and regenerates `android/`, losing changes

---

## Related Resources

- **Web App (source of truth):** `../FPO-Setu/` (React + Vite)
- **Expo Docs:** https://docs.expo.dev/versions/v57.0.0/
- **React Native Docs:** https://reactnative.dev/
- **AndroidManifest Reference:** https://developer.android.com/guide/topics/manifest/manifest-intro

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

---

## Contributing

This is a prototype. For improvements:

1. Test locally on Android (emulator or device)
2. Check type safety: `npm run typecheck`
3. Lint: `npm run lint`
4. Verify no hardcoded strings (use `app-state.t()`)
5. Wrap screens with `RoleShell` for consistent UX

---

## Support & Questions

For issues or questions about:
- **Setup/build:** See [Installation](#installation) and [Building for Android](#building-for-android)
- **Voice:** See [Troubleshooting](#troubleshooting)
- **Features/design:** Refer to the web app in `../FPO-Setu` (same behavior)
