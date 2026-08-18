# FPO Setu Mobile

A React Native mobile app for connecting farmers, Farmer Producer Organizations (FPOs), and agricultural buyers. Built with Expo SDK 57, React Native 0.86, and TypeScript.

**What it is:** A voice-enabled marketplace where farmers join FPOs, buyers discover suppliers, and FPOs manage their business—all with Krishi Bandhu, a voice/text navigator that understands Hinglish and regional languages.

**Status:** Working prototype with mock data, local storage, and full farmer/FPO/buyer workflows.

---

## Table of Contents

1. [What is FPO Setu?](#what-is-fpo-setu)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database and Storage Architecture](#database-and-storage-architecture)
5. [Role-Based Navigation and Features](#role-based-navigation-and-features)
6. [Krishi Bandhu (Voice Navigation)](#krishi-bandhu-voice-navigation)
7. [Android Permissions](#android-permissions)
8. [Project Structure](#project-structure)
9. [Installation](#installation)
10. [Development Commands](#development-commands)
11. [Building an APK](#building-an-apk)
12. [Configuration](#configuration)
13. [Emulator and Physical Device Setup](#emulator-and-physical-device-setup)
14. [Troubleshooting](#troubleshooting)
15. [Known Limitations](#known-limitations)
16. [Important Developer Notes](#important-developer-notes)
17. [Contributing](#contributing)
18. [References](#references)

---

## What is FPO Setu?

FPO Setu is a digital marketplace platform that bridges the gap between:
- **Farmers**: Direct access to FPO memberships, government schemes, market insights, and peer networks
- **FPOs (Farmer Producer Organizations)**: Tools to manage their business, find buyers and suppliers, and expand operations
- **Buyers**: Discover and source produce directly from verified FPOs

The platform operates in English, Hindi, and Marathi with voice-powered navigation (Krishi Bandhu) for farmers with limited literacy.

---

## Technology Stack

- **Framework**: React Native 0.86.2 with Expo SDK 57
- **Language**: TypeScript 6.0.3
- **Routing**: React Navigation 7 (native stack + bottom tabs)
- **State Management**: React Context API (app-state.tsx)
- **Storage**: AsyncStorage (React Native Async Storage 2.2.0)
- **UI Components**: Lucide React Native icons, custom shadcn-inspired components
- **Voice**: expo-speech-recognition (speech-to-text) + expo-speech (text-to-speech)
- **Architecture**: New React Native Architecture enabled (newArchEnabled=true)

---

## Architecture Overview

### High-Level Flow
```
Root Navigator (RootStack)
├── RoleSelectScreen (no role selected)
├── FarmerNavigator (role="farmer")
│   ├── FarmerTabNavigator (bottom tabs: Home, My FPO, Learn, Connect, Schemes)
│   └── FarmerProfileScreen (stack overlay)
├── FpoNavigator (role="fpo")
│   └── FpoStack (Manage, Partners, Help, My FPO, Capacity)
└── BuyerNavigator (role="buyer")
    └── BuyerTabs (bottom tabs: Profile & Order, Connect, Reviews)
```

### State Management

**AppStateProvider** (src/lib/app-state.tsx):
- Persists user role, language preference, and active FPO ID to AsyncStorage
- Provides `useApp()` hook for global access to `role`, `lang`, `login()`, `logout()`, `t()`
- Hydrates on app start; `ready` indicates storage has been read
- Storage keys: `setu.role`, `setu.lang`, `setu.fpo`

### Role-Based Profiles

Three core roles with distinct features:

#### Farmer
- Screen: FarmerHomeScreen (bottom tab navigation)
- Tabs: Home (Krishi Bandhu voice nav) | My FPO | Learn | Connect | Schemes
- Features:
  - Krishi Bandhu: Voice/text intent resolver for screen navigation
  - FPO discovery and membership information
  - Market price insights
  - Government schemes and subsidies
  - Peer farmer connections
- Data source: Mock (src/lib/mockData.ts), seeded with real farmer profiles

#### FPO
- Screen: FpoHomeScreen (stack navigation, no bottom tabs)
- Sections: Manage & Grow Business | Find Partners | Learn & Get Expert Help | Know My FPO
- Features:
  - Business management dashboard
  - Buyer/supplier discovery and matching
  - FPO profile and capacity management
  - Market readiness assessment
  - Help/expert consultation
- Data source: Mock (src/lib/mockData.ts with 30+ FPO profiles)

#### Buyer
- Screen: BuyerHomeScreen (bottom tab navigation)
- Tabs: Profile & Order | Connect | Reviews
- Features:
  - Profile management (company info, commodity interests, quality specs)
  - Demand posting and procurement orders
  - FPO supplier discovery and matching
  - Review/rating system
  - Dual mode: switch between buyer and supplier personas
- Data source: Mock (BUYERS array in mockData.ts) + local storage (buyer-storage.ts)

---

## Database and Storage Architecture

### In-Memory Mock Data (src/lib/mockData.ts)
- Seeded with real FPO data, farmer profiles, buyer records, and commodity information
- **Not persisted**: survives app session only; data is read-only seed data

### AsyncStorage Persistence (react-native-async-storage)
- **Global app state**: role, language, active FPO ID (keys: `setu.role`, `setu.lang`, `setu.fpo`)
- **Buyer demands**: user-created procurement orders (key: `setu.demands`)
- **Buyer supplies**: supplier-mode postings (key: `setu.supplies`)
- See src/lib/buyer-storage.ts for load/save helpers

### Key Data Models

**FPO**
- id, name, district, block, registration number
- Tier (1-3), members, commodities
- Warehouse capacity (MT), processing capabilities
- Supply: commodity, quantity, grade, harvest window
- Reputation (score, reviews)
- Compliance score, avg price realization vs APMC

**Farmer**
- id, name, district, commodities, landholding
- Profile image, FPO membership

**Buyer**
- id, name, type (exporter, processor, trader, etc.)
- Commodity interests, typical volume (MT/year)
- Location, quality specs, procurement window

**Demand & Supply** (buyer-created)
- Posted by buyers, matched against FPO supply
- Fields: commodity, quantity, grade, delivery location/window, price

---

## Role-Based Navigation and Features

### Farmer Flow (Krishi Bandhu)

**Home Screen** (FarmerHomeScreen)
- Tiles: Know My FPO, Learn, Connect, Gov Schemes
- **Krishi Bandhu**: voice/text input engine that resolves farmer intents to navigation
  - Uses intent patterns (regex) from src/lib/farmer-intents.ts
  - Supports Hinglish (e.g., "bhav" = price, "yojana" = scheme)
  - Supports Hindi and Marathi text input

**My FPO Tab** (MyFpoScreen)
- Shows FPO details (name, location, members, tiers, supply)
- Market subsection: price trends vs APMC
- FPO subsection: member transactions, dividends
- Discovery subsection: FPOs near the farmer's location

**Learn Tab** (LearnScreen)
- Courses: training modules on farming, marketing, value addition
- Success Stories: video testimonials from farmers

**Connect Tab** (ConnectScreen)
- Farmers: peer network for collective action
- Buyers: direct buyer access and contact info

**Schemes Tab** (SchemesScreen)
- Government subsidies, crop insurance (PMFBY), Kisan Credit Card (KCC), etc.

**Profile Screen** (FarmerProfileScreen)
- AgrStack ID, name, commodities, landholding, location

### FPO Flow

**Home Screen** (FpoHomeScreen)
- Header: FPO name selector (can switch between FPOs via global activeFpoId)
- Tiles: Manage & Grow Business | Find Partners | Learn & Get Expert Help | Know My FPO

**Manage Screen** (FpoManageScreen)
- Production planning, quality management, supply scheduling
- Financial dashboards and ledgers

**Partners Screen** (FpoPartnersScreen)
- Match with buyers based on supply and demand
- Supplier and service provider discovery
- Direct messaging and negotiation

**Help Screen** (FpoHelpScreen)
- Expert consultations, training modules, compliance resources

**My FPO Screen** (FpoMyScreen)
- Organization profile, members, financials, reputation metrics

### Buyer Flow

**Profile & Order Tab** (BuyerHomeScreen)
- Mode toggle: switch between Buyer and Supplier roles
- **Buyer mode**: company profile, demand posting, order tracking
- **Supplier mode**: inventory and supply posting
- Both modes persisted to AsyncStorage

**Connect Tab** (BuyerMatchingScreen)
- Discover FPOs by commodity, capacity, location, reputation
- Matching algorithm: supply ↔ demand
- Direct contact and negotiation

**Reviews Tab** (BuyerReviewsScreen)
- View and post reviews for FPOs
- Rating system, review visibility

---

## Krishi Bandhu (Voice Navigation)

Voice and text input for farmer intents. Lives on FarmerHomeScreen only.

### How It Works
1. Farmer taps mic (or types) on the home screen
2. Input is passed to `resolveFarmerIntent()` (src/lib/farmer-intents.ts)
3. Intent patterns (regex) are tested; first match wins
4. Destination (screen/tab) is determined; farmer is navigated
5. Toast confirms action

### Intent Examples
- "Show me onion prices" → Market Insights
- "Connect me with a buyer" → Connect → Buyers
- "Government schemes" → Schemes
- "FPOs near me" → My FPO → Discovery
- "My profile" → Farmer Profile
- "Success stories" → Learn → Stories
- Supports Hindi/Marathi: "भाव" (price), "योजना" (scheme), "खरेदीदार" (buyer)

### Adding Intents
Edit INTENTS array in src/lib/farmer-intents.ts. Each intent specifies regex patterns and a destination. Order matters: most-specific intents go first.

### Voice Technical Details
- Uses `expo-speech-recognition` (TurboModule-based, New Architecture compatible)
- Avoids `@react-native-voice/voice` (incompatible with New Architecture)
- **Network-first approach**: prefers cloud recognition to avoid language-pack requirement
- Supports locales: en-IN, hi-IN, mr-IN (negotiated dynamically)
- Graceful degradation: if unavailable or in Expo Go, falls back to typed input
- Permissions: RECORD_AUDIO + runtime request via expo-speech-recognition module
- Error handling: retries alternate services/locales on specific errors (language-not-supported, service-not-allowed)

---

## Android Permissions

Defined in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>  <!-- Krishi Bandhu -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>

<!-- Android 11+ package visibility for speech services -->
<queries>
  <intent>
    <action android:name="android.speech.RecognitionService"/>
  </intent>
  <intent>
    <action android:name="android.speech.action.RECOGNIZE_SPEECH"/>
  </intent>
</queries>
```

Runtime permission for microphone is handled by expo-speech-recognition (`getPermissionsAsync()` / `requestPermissionsAsync()`).

---

## Project Structure

```
FPO-Setu-Mobile/
├── src/
│   ├── theme/                Design tokens (colors, spacing, radius, fontSize)
│   │   └── index.ts
│   ├── lib/
│   │   ├── app-state.tsx      Global context (role, lang, FPO ID, AsyncStorage sync)
│   │   ├── mockData.ts        Seed data (FPOs, farmers, buyers, commodities)
│   │   ├── buyer-storage.ts   Demand/supply persistence helpers
│   │   ├── farmer-intents.ts  Krishi Bandhu intent → navigation mapping
│   │   └── i18n.ts            Translation helper (en/hi/mr)
│   ├── hooks/
│   │   ├── useVoiceInput.ts   Speech recognition integration
│   │   ├── useSpeech.ts       Text-to-speech
│   │   └── useFarmerBack.ts   Hardware back button handling
│   ├── components/
│   │   ├── ui/                shadcn-inspired primitives (Text, Button, Card, etc.)
│   │   ├── layout/
│   │   │   ├── RoleShell.tsx  Role-specific wrapper (header, top bar, role switcher)
│   │   │   └── TopBar.tsx     Header bar with title and menu
│   │   ├── common.tsx         Tile, Chip, Card utilities
│   │   ├── charts.tsx         Line/Bar charts (react-native-svg)
│   │   └── AssistantWidget.tsx Floating action button for help
│   ├── features/              Shared screens/components by role
│   │   ├── buyer-shared.tsx   Buyer mode toggle, demand form
│   │   ├── fpo-sections.tsx   FPO-specific sections
│   │   └── market-readiness.tsx FPO market maturity assessment
│   ├── navigation/
│   │   ├── index.tsx          Root navigator, tab/stack config
│   │   └── types.ts           TypeScript navigation param types
│   ├── screens/
│   │   ├── RoleSelectScreen.tsx  Role picker
│   │   ├── farmer/
│   │   │   ├── FarmerHomeScreen.tsx      (Krishi Bandhu)
│   │   │   ├── MyFpoScreen.tsx
│   │   │   ├── LearnScreen.tsx
│   │   │   ├── ConnectScreen.tsx
│   │   │   ├── SchemesScreen.tsx
│   │   │   └── FarmerProfileScreen.tsx
│   │   ├── fpo/
│   │   │   ├── FpoHomeScreen.tsx
│   │   │   ├── FpoManageScreen.tsx
│   │   │   ├── FpoPartnersScreen.tsx
│   │   │   ├── FpoHelpScreen.tsx
│   │   │   ├── FpoCapacityScreen.tsx
│   │   │   └── FpoMyScreen.tsx
│   │   └── buyer/
│   │       ├── BuyerHomeScreen.tsx       (Mode toggle)
│   │       ├── BuyerMatchingScreen.tsx
│   │       └── BuyerReviewsScreen.tsx
│   └── assets/                Bundled images (FPO meetings, value-addition examples)
├── android/                   Native project (tracked in git)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/fposetu/mobile/
│   │   │   └── res/              (icons, splash, strings)
│   │   └── build.gradle
│   ├── build.gradle
│   └── gradle.properties
├── App.tsx                    Root component (SafeAreaProvider → AppStateProvider → RootNavigator)
├── index.ts                   Expo entry point (registerRootComponent)
├── app.json                   Expo config (SDK 57, package name, EAS project ID)
├── eas.json                   EAS build config (development/preview/production)
├── package.json               npm dependencies
├── tsconfig.json              TypeScript config (Expo base + strict mode)
├── eslint.config.js           ESLint config (Expo preset)
├── build-apk.ps1              PowerShell script to build release APK locally
└── .gitignore                 Git ignore rules (node_modules, build outputs, .env, ios/)
```

---

## Installation

### Prerequisites
- **Node.js** 18+ and npm
- **Android SDK** installed (default: `%LOCALAPPDATA%\Android\Sdk`)
- **Android Studio** with JDK (default: `C:\Program Files\Android\Android Studio\jbr`)
- **Git**

### Setup

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
npm install
```

Verify TypeScript compilation:

```bash
npm run typecheck
```

---

## Development Commands

### Run on Emulator/Phone with Expo Go (No Native Build)

All native modules used (AsyncStorage, react-native-svg, screens, safe-area-context, expo-speech-recognition) are bundled in Expo Go, so you can test without building native code.

```bash
npm start
```

Press **`a`** in the terminal to launch on a running Android emulator (or scan QR code with Expo Go on a phone).

### Metro Dev Server

```bash
npm start
```

Leaves Metro running on port 8081. Needed for debug builds running from Android Studio.

### Android Studio Workflow

#### 1. Open the Android Project

Android Studio → **Open** → select `android/` folder (not the repo root)

Wait for Gradle sync to finish. `local.properties` is auto-generated on first open.

#### 2. Run Debug Build (Requires Metro)

Start Metro first in a terminal:
```bash
npm start
```

Then in Android Studio: **Run** (▶) → select emulator or device

Debug builds load the JS bundle from Metro at runtime.

**Physical device over USB**: Forward the Metro port:
```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

If you see a white screen or "Unable to load script", Metro isn't running or the port isn't forwarded.

#### 3. Run Release Build (Standalone, No Metro)

Release builds embed the JS bundle, so they run independently.

1. **Build** → **Select Build Variant…** → set `app` to **`release`**
2. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK location: `android\app\build\outputs\apk\release\app-release.apk`

Release is signed with the React Native template's debug keystore (`android/app/debug.keystore`, password `android`). This is fine for sideloading; generate a real upload key for Play Store submission.

### Lint

```bash
npm run lint
```

Runs ESLint with Expo preset.

---

## Building an APK

### Option A: PowerShell Script (One Command)

From a **normal PowerShell window** (not IDE or agent shell):

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
.\build-apk.ps1
```

The script:
1. Sets JAVA_HOME and ANDROID_HOME
2. Runs a preflight check (java.nio.Selector.open() test)
3. Executes `gradlew assembleRelease`
4. Prints the APK path

If PowerShell blocks execution:

```bash
powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
```

### Option B: Gradle CLI

```bash
cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
cd android
gradlew.bat assembleRelease
```

Output: `android\app\build\outputs\apk\release\app-release.apk`

Install on a device or emulator:

```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\release\app-release.apk
```

### Option C: Android Studio GUI

Use the primary workflow above (Run Release Build) to build through the GUI.

---

## Configuration

### App Metadata (app.json)
- **name**: "FPO Setu"
- **slug**: "fpo-setu-mobile"
- **package** (Android): "com.fposetu.mobile"
- **version**: "1.0.0"
- **SDK version**: Expo ~57.0.9
- **New Architecture**: Enabled (newArchEnabled=true)
- **Orientation**: portrait only

### Native Config (android/app/)
| Setting | Location |
|---------|----------|
| App display name | `src/main/res/values/strings.xml` |
| Package / applicationId | `build.gradle` (com.fposetu.mobile) + `src/main/java/com/fposetu/mobile/` |
| Version code/name | `build.gradle` (versionCode=1, versionName="1.0.0") |
| Permissions | `src/main/AndroidManifest.xml` |
| Icons/splash | `src/main/res/mipmap-*`, `drawable-*` |

### Language Selection
App defaults to English. Users can change via menu → Settings. Persisted to AsyncStorage (`setu.lang`). Supports: English, हिन्दी (Hindi), मराठी (Marathi).

---

## Emulator and Physical Device Setup

### Android Emulator

List available AVDs:
```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -list-avds
```

Start an emulator:
```bash
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd YOUR_AVD_NAME
```

Recommended: Pixel 6 (API 33+) for better screen sizes and speech recognition availability.

### Physical Android Device

1. Enable Developer Mode: **Settings** → **About** → tap **Build Number** 7 times
2. Enable USB Debugging: **Developer Options** → **USB Debugging**
3. Connect via USB
4. Allow USB access when prompted
5. Run `npm start` or Android Studio build

### Troubleshooting Connection Issues

**Emulator can't reach Metro on Windows**:
```bash
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

**Phone on different network**:
```bash
npm start -- --tunnel
```

---

## Troubleshooting

### White Screen or "Unable to Load Script"

**Cause**: Metro dev server isn't running or port 8081 isn't forwarded.

**Fix**:
1. Start Metro: `npm start` (in a separate terminal)
2. For physical devices: forward the port (see above)
3. Rebuild/restart the app

### "Unable to Establish Loopback Connection" (Gradle)

**Cause**: java.nio.channels.Selector.open() fails (AF_UNIX socket issue on JDK 21 / Windows, usually in restricted process contexts).

**Fix** (in order):
1. Run build-apk.ps1 from a **normal PowerShell window** (not IDE/agent shell)
2. Reboot, then retry
3. Use Android Studio GUI to build instead

The build-apk.ps1 script includes a preflight check that diagnoses this early.

### Speech Recognition Not Working

**Cause**: Microphone permission denied, no network, or on-device language pack missing.

**Fixes**:
- Grant microphone permission when prompted
- Ensure device has internet connectivity (cloud recognition preferred)
- Check RECORD_AUDIO is in AndroidManifest.xml
- On Expo Go: voice is unavailable, fall back to typed input

### Voice Input Falls Back to Typed Input

**Cause**: expo-speech-recognition not available (Expo Go, custom build without the module).

**Expected behavior**: Mic button is grayed out; typed input works normally.

### Build Variant is "Debug" When Building Release APK

**Cause**: Common mistake in Android Studio.

**Symptom**: Built APK is 200+ MB, white-screens on any device without Metro running.

**Fix**: **Build** → **Select Build Variant…** → set `app` to **`release`** before building.

---

## Known Limitations

### Voice Recognition
- expo-speech-recognition is only available in production builds and Expo Go (v57.0.1+)
- Text-to-speech (expo-speech) works but isn't implemented on farmer screens yet
- Language pack requirement: cloud recognition (network-first) avoids needing pre-downloaded packs on Android 13+

### Data Persistence
- **No real backend**: all data is mock seed data (FPOs, farmers, buyers)
- **Only buyer demands/supplies are persisted**: stored in AsyncStorage (local only)
- **No sync**: changes don't propagate between devices or survive account deletion

### Web
- **Web platform not supported**: react-native components don't map to web
- Expo web build is not configured (see app.json)

### iOS
- **iOS project not generated**: (.gitignore excludes `/ios`)
- To add iOS support: run `npx expo prebuild --platform ios` (one-time)

---

## Important Developer Notes

### Android/ Is Tracked in Git
The `android/` folder is **intentionally tracked** so the native project survives a clean checkout. Do **not** run `expo prebuild --clean` — it deletes and regenerates the folder, wiping native edits and IDE state.

To update native config:
1. Edit files directly (AndroidManifest.xml, build.gradle, strings.xml, etc.)
2. If you must regenerate: commit first, run `expo prebuild` (no `--clean`), then diff and restore hand-edits

### New React Native Architecture
The app has New Architecture enabled (`newArchEnabled=true` in app.json). This enables TurboModules and newer native interop. Avoid libraries without TurboModule/codegen support (e.g., old @react-native-voice/voice).

### Async Storage (No Local SQLite)
The app uses AsyncStorage (simple key-value store), not SQLite. If a real backend/database is added:
1. Add backend API client (e.g., axios)
2. Replace mock data loading with API calls
3. Replace AsyncStorage buyer storage with API persistence
4. AppStateProvider already handles async hydration; follow that pattern for new data sources

### Localization (i18n)
Language strings are in AppStateProvider (app-state.tsx). To add a language:
1. Add locale to `Lang` type
2. Add strings to STRINGS object in app-state.tsx
3. Add locale mapping in useVoiceInput.ts (LOCALE object)
4. Update LANG_LABELS

### Navigation Types
All navigation param lists are defined in `src/navigation/types.ts`. Keep them in sync with actual screen route names and params to maintain type safety.

### Styling
No external CSS framework. All styling uses React Native's built-in `StyleSheet` and theme tokens from `src/theme/index.ts`. Colors, spacing, radius, and typography are design tokens; update the theme object to change the entire app's appearance.

### Image Handling
Bundled images are required() as numeric asset handles (React Native). Remote images use `{ uri: "https://..." }`. See mockData.ts for the `imgSource()` helper that normalizes between the two.

---

## Contributing

When adding features:

1. **Verify against current state**: Don't rely on old READMEs or git history; read the actual source code
2. **Keep data local** unless a real backend exists
3. **Follow the role pattern**: FarmerNavigator, FpoNavigator, BuyerNavigator are separate, isolated stacks
4. **Use theme tokens**: don't hardcode colors or spacing
5. **Test on emulator and physical device**: emulator can mask native issues
6. **Document breaking changes**: Expo/React Native versions, dependencies, build steps

---

## References

- Expo Documentation: https://docs.expo.dev/versions/v57.0.0/
- React Native: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/
- expo-speech-recognition: https://docs.expo.dev/versions/v57.0.0/sdk/speech-recognition/
- Android Permissions: https://developer.android.com/guide/topics/permissions/overview

---

## License

See LICENSE file.
- Voice or text input to navigate ("Show me onion prices", "Tell me about my FPO", etc.)
- Intent-driven navigation: resolves natural-language commands to screens
- Fallback to typed input if voice unavailable

**Tabs:**
- **Home:** Farmer greeting + Krishi Bandhu navigator
- **My FPO:** Discover nearby FPOs, view details, supply trends, and market insights
- **Learn:** Educational content on aggregation, aggregators, collective marketing, success stories
- **Connect:** Connect with FPO members, access farmer networks
- **Schemes:** Government agricultural schemes and benefits

**Profile Screen** (modal navigation)
- Farmer profile with basic info and preferences

### FPO Role

FPO managers oversee operations, find buyers, and manage capacity.

**Stack Navigation** (no tab bar; back-only navigation)
- **Home:** Primary hub with business metrics and KPIs
- **Manage:** Operational dashboards (members, capacity, supply)
- **Partners:** Buyer and supplier relationships and reviews
- **Help:** Capital access, scheme eligibility, network support
- **Capacity:** Supply aggregation and grading
- **My FPO:** FPO profile, settings, and compliance info

### Buyer/Supplier Role

Buyers and agricultural input suppliers post demand and discover FPO supply.

**Tabs:**
- **Profile & Order:** Buyer/supplier profile with active orders/posts and mode toggle (buyer ↔ supplier)
- **Connect:** Find FPOs matching demand/supply specs with filters
- **Reviews:** Seller/buyer reputation and detailed reviews

---

## Authentication

FPO Setu uses **database-backed authentication** with SQLite, eliminating the mock-based role picker.

### User Accounts

**Seeded Test Accounts** (pre-populated in the database):

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `farmer01@setu.local` | `test123` | Farmer | Demo farmer account |
| `fpo01@setu.local` | `test123` | FPO Manager | Demo FPO account |
| `buyer01@setu.local` | `test123` | Buyer | Demo buyer account |
| `admin01@setu.local` | `test123` | Admin | Can switch roles without logout |

### How It Works

1. **Login Screen** accepts email + password
2. **Password Verification:** Passwords are hashed with PBKDF2-HMAC-SHA256 (portable, no native deps)
3. **Session Persistence:** Session `{userId, activeRole}` is stored locally and revalidated on app launch
4. **Role Switching:** Admin accounts can switch roles from the header control without re-authenticating
5. **Logout:** Clears the session and returns to login screen

### Password Hashing

Passwords use **PBKDF2-HMAC-SHA256** in the standard `pbkdf2_sha256$iterations$salt$hash` format, ensuring portability to any backend. Implementation is in pure TypeScript to avoid native module dependencies.

### Adding New Users

Edit `src/db/seedAuth.ts` to add new test accounts. The auth schema supports email, full name, and multiple roles per user.

---

## Tech Stack

### Core Framework
- **React Native:** 0.86.2 (bare native, not Expo Go)
- **Hermes Engine:** JavaScript engine optimized for mobile
- **React:** 19.2.3
- **TypeScript:** ~6.0.3

### Navigation & UI
- **@react-navigation/native:** ^7.3.14
- **@react-navigation/native-stack:** ^7.18.6
- **@react-navigation/bottom-tabs:** ^7.18.14
- **lucide-react-native:** ^1.28.0 (icons)
- **react-native-svg:** 15.15.4

### Database & Storage
- **sqlite:** SQLite3 database for users, roles, FPOs, farmers, buyers, market data
- **@react-native-async-storage/async-storage:** 2.2.0 (session + ephemeral state)

### Native & Permissions
- **react-native-safe-area-context:** ~5.7.0 (notch handling)
- **react-native-screens:** ~4.26.0 (native stack optimization)
- **Custom TTS Module:** Kotlin-based text-to-speech for voice feedback

### Voice & Speech
- **expo-speech-recognition:** ^56.0.1 (speech-to-text for Krishi Bandhu)
- **expo-speech:** ~57.0.1 (text-to-speech library, wrapped by native TTS module)

### Development
- **ESLint:** ^9.0.0 with expo config (configured in `eslint.config.js`)
- **TypeScript:** Strict mode enabled

---

## Project Structure

```
FPO-Setu-Mobile/
├── android/                              # Native Android project (bare React Native)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml           # Permissions, services, voice queries
│   │   └── java/com/fposetu/mobile/
│   │       ├── MainActivity.kt           # Main activity
│   │       ├── MainApplication.kt        # App initialization
│   │       └── TtsModule.kt              # Custom text-to-speech module
│   ├── build.gradle
│   └── gradle wrapper (gradlew.bat)
├── assets/                               # App icon, splash, adaptive icons
├── scripts/                              # Helper scripts for development
│   ├── db.ps1                           # Database query helper
│   ├── login.ps1                        # Test login scenarios
│   ├── shot.ps1                         # Screenshot capture
│   └── ui.ps1                           # UI automation helper
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Text.tsx                 # Translated text component
│   │   │   ├── Toast.tsx                # Toast notifications
│   │   │   └── index.tsx                # UI primitives (Button, Card, Input, etc.)
│   │   ├── layout/
│   │   │   ├── RoleShell.tsx            # Wraps screens with header + role accent
│   │   │   ├── TopBar.tsx               # Role-colored header with controls
│   │   │   └── AssistantWidget.tsx      # Krishi Bandhu UI (voice input widget)
│   │   ├── common.tsx                   # Tile, card, chart, section components
│   │   └── charts.tsx                   # Data visualization (LineChart, etc.)
│   ├── db/
│   │   ├── assets.ts                    # Bundled SQLite asset
│   │   ├── connection.ts                # SQLite connection pool & initialization
│   │   ├── index.ts                     # Database facade
│   │   ├── types.ts                     # TypeScript types for all tables
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.ts    # FPO, farmer, buyer, market data tables
│   │   │   ├── 002_auth.ts              # Users, roles, authentication tables
│   │   │   └── index.ts                 # Migration runner
│   │   ├── repositories/
│   │   │   ├── authRepository.ts        # Auth SQL: login, user creation, role management
│   │   │   ├── farmerRepository.ts      # Farmer queries
│   │   │   ├── fpoRepository.ts         # FPO queries
│   │   │   ├── marketRepository.ts      # Market price & commodity queries
│   │   │   └── contentRepository.ts     # Educational content, schemes
│   │   ├── seed.ts                      # Initial data population (FPOs, farmers, etc.)
│   │   ├── seedAuth.ts                  # User account seeding
│   │   └── useDbQuery.ts                # React hook for database queries
│   ├── features/
│   │   ├── buyer-shared.tsx             # Shared buyer UI logic (mode toggle, stepper)
│   │   ├── fpo-sections.tsx             # Shared FPO features (metrics, details)
│   │   └── market-readiness.tsx         # Market metrics and commodity data
│   ├── hooks/
│   │   ├── useVoiceInput.ts             # Krishi Bandhu voice logic (Expo Go detection, speech)
│   │   ├── useSpeech.ts                 # Text-to-speech hook
│   │   └── useFarmerBack.ts             # Farmer back-navigation
│   ├── lib/
│   │   ├── app-state.tsx                # Global state (lang, role, session)
│   │   ├── useSessionProfile.ts         # Session-based profile fetching
│   │   ├── farmer-intents.ts            # Krishi Bandhu intent resolver
│   │   ├── buyer-storage.ts             # AsyncStorage for demand/supply posts
│   │   ├── i18n.ts                      # (deprecated; use app-state.t())
│   │   ├── crypto/
│   │   │   ├── password.ts              # PBKDF2-HMAC-SHA256 password hashing
│   │   │   └── sha256.ts                # SHA-256 implementation (FIPS 180-4)
│   │   └── mockData.ts                  # Fallback mock data (seed data now from DB)
│   ├── native/
│   │   └── NativeTts.ts                 # Bridge to custom Kotlin TTS module
│   ├── navigation/
│   │   ├── index.tsx                    # Root navigator setup
│   │   └── types.ts                     # TypeScript navigation types
│   ├── screens/
│   │   ├── LoginScreen.tsx              # Database-backed login screen
│   │   ├── farmer/                      # 6 farmer screens
│   │   │   ├── FarmerHomeScreen.tsx     # Home + Krishi Bandhu navigator
│   │   │   ├── MyFpoScreen.tsx          # FPO discovery + market insights
│   │   │   ├── LearnScreen.tsx          # Educational content
│   │   │   ├── ConnectScreen.tsx        # Farmer networks + buyers
│   │   │   ├── SchemesScreen.tsx        # Government schemes
│   │   │   └── FarmerProfileScreen.tsx  # Farmer profile (modal)
│   │   ├── fpo/                         # 6 FPO screens (stack, no tabs)
│   │   │   ├── FpoHomeScreen.tsx        # FPO home + KPIs
│   │   │   ├── FpoManageScreen.tsx      # Member & capacity management
│   │   │   ├── FpoPartnersScreen.tsx    # Buyer/supplier relationships
│   │   │   ├── FpoHelpScreen.tsx        # Capital access, support
│   │   │   ├── FpoCapacityScreen.tsx    # Supply aggregation
│   │   │   └── FpoMyScreen.tsx          # FPO profile + settings
│   │   └── buyer/                       # 3 buyer screens (tabs)
│   │       ├── BuyerHomeScreen.tsx      # Profile & orders (mode toggle)
│   │       ├── BuyerMatchingScreen.tsx  # FPO discovery + filters
│   │       └── BuyerReviewsScreen.tsx   # Reviews + reputation
│   ├── services/
│   │   └── authService.ts               # AuthService interface + DB implementation
│   ├── theme/
│   │   └── index.ts                     # Design tokens (colors, spacing, radius)
│   └── (index.ts entry point)
├── App.tsx                               # Root component (DB init + App state)
├── index.ts                              # Entry point
├── babel.config.js                      # Babel configuration for bare React Native
├── metro.config.js                      # Metro bundler configuration
├── eslint.config.js                     # ESLint configuration
├── tsconfig.json                        # TypeScript strict mode
├── package.json                         # Dependencies & scripts
├── .claude/launch.json                  # Claude Code launch configuration
├── RUNNING.md                           # Development workflow (login, DB, testing)
├── LICENSE                              # Apache 2.0
└── (git-tracked android/ project)
```

---

## Database Schema

### Migration 001: Initial Schema

Core domain tables for FPOs, farmers, buyers, and market data:

**fpos**
- `id TEXT PRIMARY KEY`
- `name TEXT`, `location TEXT`, `district TEXT`
- `members_count INT`, `primary_commodity TEXT`
- `compliance_score REAL`, `trust_score REAL`
- Reviews, capacity, supply trends

**farmers**
- `id TEXT PRIMARY KEY`
- `name TEXT`, `location TEXT`, `district TEXT`
- `primary_commodity TEXT`, `land_size_hectares REAL`
- Experience level, FPO membership, preferences

**buyers**
- `id TEXT PRIMARY KEY`
- `name TEXT`, `location TEXT`, `type TEXT` (processor/retailer/exporter)
- `commodities TEXT`, `typical_volume_mt INT`
- Quality specs, procurement window, order history

**daily_apmc_prices**
- `id INT PRIMARY KEY`
- `commodity TEXT`, `date DATE`, `price_per_quintal REAL`
- Reference market prices

**schemes**
- `id TEXT PRIMARY KEY`
- `name TEXT`, `category TEXT` (subsidy/loan/training)
- Eligibility, benefits, application process

**content**
- Educational articles, stories, how-to guides

### Migration 002: Authentication Schema

User authentication and role management:

**users**
- `id INT PRIMARY KEY`
- `email TEXT UNIQUE`, `password_hash TEXT` (PBKDF2-HMAC-SHA256)
- `full_name TEXT`, `created_at TIMESTAMP`

**roles**
- `id INT PRIMARY KEY`
- `name TEXT` (farmer/fpo/buyer/admin)

**user_roles**
- `user_id INT FOREIGN KEY`, `role_id INT FOREIGN KEY`
- Junction table: each user can have multiple roles

**farmer_profiles**
- `user_id INT FOREIGN KEY`, `farmer_id TEXT FOREIGN KEY`
- Links a login to a farmer record

**fpo_profiles**
- `user_id INT FOREIGN KEY`, `fpo_id TEXT FOREIGN KEY`
- Links a login to an FPO record

**buyer_profiles**
- `user_id INT FOREIGN KEY`, `buyer_id TEXT FOREIGN KEY`
- Links a login to a buyer record

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

2. **Verify TypeScript compilation:**

```bash
npm run typecheck
```

3. **Initialize the database** (automatic on first app launch, but you can test it):

The database migrations run automatically in `App.tsx` on first launch. Seeded accounts are created, and the app stores the SQLite file in the app's document directory.

---

## Running the App

### Option 1: Android Studio (Recommended for Development)

The native `android/` folder is tracked in git—no generation needed.

#### 1a. Open in Android Studio

1. **Android Studio → Open**
2. Select `android` folder (not the repo root)
3. Wait for Gradle sync (first sync ~2 min)

#### 1b. Debug Build (Requires Metro)

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

#### 1c. Release Build (Standalone, No Metro)

The JS bundle is embedded, so the APK runs offline.

1. **Build → Select Build Variant** → set to `release`
2. **Build → Build Bundle(s)/APK(s) → Build APK(s)**
3. Find the APK at: `android\app\build\outputs\apk\release\app-release.apk`

**⚠️ Common mistake:** Leaving variant on `debug` produces an APK that white-screens without Metro.

### Option 2: Command Line (Expo CLI — Legacy)

This app has migrated from Expo SDK to bare React Native. The `expo` CLI commands no longer work; use Android Studio instead.

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
- Probes Java NIO Selector (detects sandboxed shells upfront)
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

## Development Tools

### npm Scripts

```bash
# Start Metro dev server (required for debug builds)
npm start

# Type check
npm run typecheck

# Lint code (ESLint configured in eslint.config.js)
npm run lint

# Build debug APK (from android/)
npm run apk:debug

# Build release APK (from android/)
npm run apk
```

### Development Scripts (`scripts/`)

Located in `scripts/` for testing and debugging:

**`scripts/db.ps1`** — Query the database
```bash
.\scripts\db.ps1 "SELECT * FROM users"
```

**`scripts/login.ps1`** — Test login scenarios
```bash
.\scripts\login.ps1 farmer01@setu.local test123
```

**`scripts/shot.ps1`** — Capture screenshots
```bash
.\scripts\shot.ps1
```

**`scripts/ui.ps1`** — Drive UI interactions
```bash
.\scripts\ui.ps1
```

See [RUNNING.md](RUNNING.md) for detailed workflow.

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
- Detects Expo Go upfront via `ExecutionEnvironment` to prevent errors
- Handles permissions (mic access)
- Manages retry logic for language/service mismatches
- Prefers **cloud recognition** (no language pack required)
- Supports English, Hindi, Marathi locales
- Graceful fallback if native module unavailable

**`src/lib/farmer-intents.ts`:**
- Defines recognized intents (e.g., "onion", "My FPO", "Learn")
- Resolves text → `FarmerDestination` (screen name + params)
- Supports fuzzy matching on commodity names
- Includes Hinglish and Marathi variants (bhav = price, yojana = scheme)

### Supported Intents

Examples (from `farmer-intents.ts`):

- "Show me My FPO" → MyFpo tab
- "Tell me about onion" → Learn tab (onion commodity)
- "Onion prices" / "भाव" → MyFpo (price trends)
- "Open Connect" → Connect tab
- "Government schemes" / "योजना" → Schemes tab
- "My profile" / "प्रोफाइल" → Profile screen (modal)
- "Success stories" / "यशोगाथा" → Learn tab (stories)
- "Join FPO" / "सदस्यता" → MyFpo (nearby FPOs)

### Permission Requirements

**`RECORD_AUDIO`** must be granted on Android. App requests at runtime; farmer can deny but still use typed input.

---

## Android Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

| Permission | Purpose | Requested |
|-----------|---------|-----------|
| `INTERNET` | Network access (cloud speech, API) | Implicit (always granted) |
| `RECORD_AUDIO` | Microphone for Krishi Bandhu | Runtime request on first use |
| `READ_PHONE_STATE` | (may be unused) | Implicit |
| `VIBRATE` | Haptic feedback | Implicit |

**Voice Service Queries** (Android 11+):
- App queries for `android.speech.RecognitionService` and `android.speech.action.RECOGNIZE_SPEECH` to discover on-device speech recognizers.
- Without these, `getAvailable()` always returns false on Android 11+.

---

## Troubleshooting

### Voice Input Not Working

**Symptom:** Mic icon does nothing, or shows "Voice isn't available".

**Causes & Fixes:**

1. **Running in Expo Go?**
   - Expo Go doesn't include native modules. Voice only works in a native build (Android Studio or release APK).
   - Fallback: Use typed input.

2. **Microphone permission denied?**
   - App shows: "Microphone permission is needed for voice."
   - Grant in: **Settings → Apps → FPO Setu → Permissions → Microphone**
   - Then try again.

3. **Microphone access is blocked?**
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

6. **Language not supported?**
   - App auto-negotiates a supported locale. If still failing: Try restarting the app.

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

### Login Issues

**Can't log in?**
- Check seeded accounts: `farmer01@setu.local` / `test123`
- Verify database initialized: Check `RUNNING.md` for `scripts/db.ps1` usage
- Clear app data: **Settings → Apps → FPO Setu → Clear Storage** and retry

**Session expired after restart?**
- Session is revalidated against the database on launch. If user was deactivated or role revoked, session will be cleared.

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

**Modal not appearing:**
- Ensure `RoleShell` wraps the screen. Some screens require it for header access.

---

## Known Limitations

### Database & Backend

- **No cloud sync:** Database is local only; data doesn't sync to a server.
- **No remote backend yet:** Current implementation is SQLite-based. Backend integration would involve:
  1. Implementing a second `AuthService` with HTTP calls
  2. Changing the export in `src/services/authService.ts`
  3. Adjusting session logic (no local revalidation needed)

### Voice Navigator (Krishi Bandhu)

- **Limited intent set:** Only ~15 intents defined. Add more in `src/lib/farmer-intents.ts`.
- **English/Hindi/Marathi only:** Other languages would require new locale codes.
- **No voice feedback:** App shows toasts, not audio confirmations. TTS module exists but not integrated yet.
- **Cloud-only:** No offline speech recognition. Requires internet.

### UI/UX

- **Light theme only:** No dark mode.
- **Limited accessibility:** No screen reader support or high-contrast mode.
- **Mobile-only:** No tablet or web support (web version is separate in `../FPO-Setu`).

### Performance

- **No pagination:** FPO/farmer lists load all at once (fine for 12–50 items; needs optimization for 1000s).
- **No caching layer:** Every screen reload queries the database (acceptable for current data size).

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
7. **Query the database** via `src/db/repositories/` or create a new repository

### Adding a Voice Intent

1. Edit `src/lib/farmer-intents.ts`
2. Add intent object to `INTENTS` array (most-specific first)
3. Test with voice or typed input on Farmer Home

### Querying the Database

Use the repository pattern in `src/db/repositories/`:

```typescript
import { db } from "../db";
import { farmerRepository } from "../db/repositories/farmerRepository";

// In a component or hook:
const farmer = await farmerRepository.getFarmer("farmer-1");
```

### Adding a New User

Edit `src/db/seedAuth.ts` and add to the `SEEDED_USERS` array. Run the app to re-seed.

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
- Rebuild: `npm run apk` or via Android Studio

---

## Related Resources

- **Web App (reference):** `../FPO-Setu/` (React + Vite)
- **React Native Docs:** https://reactnative.dev/
- **Expo SDK 57 (legacy, for reference):** https://docs.expo.dev/versions/v57.0.0/
- **Android Manifest Reference:** https://developer.android.com/guide/topics/manifest/manifest-intro
- **SQLite Documentation:** https://www.sqlite.org/docs.html

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

---

## Contributing

This is a production-ready prototype. For improvements:

1. **Test locally** on Android (emulator or device)
2. **Check type safety:** `npm run typecheck`
3. **Lint:** `npm run lint`
4. **Verify no hardcoded strings:** Use `app-state.t()`
5. **Wrap screens** with `RoleShell` for consistent UX
6. **Query the database** instead of using mock data
7. **Document database changes** in migration files

---

## Support & Questions

For issues or questions about:
- **Setup/build:** See [Installation](#installation) and [Building for Android](#building-for-android)
- **Voice:** See [Troubleshooting](#troubleshooting)
- **Database/auth:** See [Database Schema](#database-schema) and [Authentication](#authentication)
- **Development workflow:** See [RUNNING.md](RUNNING.md)
