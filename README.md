# FPO Setu Mobile

A React Native mobile app for connecting farmers, Farmer Producer Organizations (FPOs), and agricultural buyers. Built with bare React Native 0.86, React 19, and TypeScript — **no Expo**. Data lives in a local SQLite database with database-backed authentication.

**What it is:** A voice-enabled marketplace where farmers join FPOs, buyers discover suppliers, and FPOs manage their business—all with Krishi Bandhu, a voice/text navigator that understands Hinglish and regional languages.

**Status:** Working prototype with a local SQLite database, database-backed authentication, and full farmer/FPO/buyer/supplier workflows.

---

## Table of Contents

1. [What is FPO Setu?](#what-is-fpo-setu)
2. [Role-Based Navigation and Features](#role-based-navigation-and-features)
3. [Authentication](#authentication)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Database Schema](#database-schema)
7. [Installation](#installation)
8. [Running the App](#running-the-app)
9. [Building for Android](#building-for-android)
10. [Development Tools](#development-tools)
11. [Krishi Bandhu Voice Navigator](#krishi-bandhu-voice-navigator)
12. [Android Permissions](#android-permissions)
13. [Troubleshooting](#troubleshooting)
14. [Known Limitations](#known-limitations)
15. [Development Notes](#development-notes)
16. [Related Resources](#related-resources)
17. [License](#license)
18. [Contributing](#contributing)
19. [Support & Questions](#support--questions)

---

## What is FPO Setu?

FPO Setu is a digital marketplace platform that bridges the gap between:
- **Farmers**: Direct access to FPO memberships, government schemes, market insights, and peer networks
- **FPOs (Farmer Producer Organizations)**: Tools to manage their business, find buyers and suppliers, and expand operations
- **Buyers**: Discover and source produce directly from verified FPOs

The platform operates in English, Hindi, and Marathi with voice-powered navigation (Krishi Bandhu) for farmers with limited literacy.

---

## Role-Based Navigation and Features

### Farmer Role

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

Sign-in takes a **username** (not an email), a password, and the role whose view to open.

| Username | Password | Role | Linked profile |
|----------|----------|------|----------------|
| `farmer01` | `farmer` | Farmer | `MH-AH-2024-00831` (Suresh Patil) |
| `fpo01` | `fpo` | FPO | `fpo-1` (Samruddha Adivasi Agro) |
| `buyer01` | `buyer` | Buyer | `b-1` (Sahyadri Foods) |
| `supplier01` | `supplier` | Supplier | `s-1` (Mahabeej Seeds) |
| `admin01` | `admin` | Admin | All four; can switch views without logout |

An account with no profile linked for the role it is opening **cannot sign in** —
it fails with "No … profile is linked to this account." There is deliberately no
fallback to the first record in the table, because that meant an unlinked account
silently acted as `fpo-1`.

### How It Works

1. **Login Screen** accepts username + password + role
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
- **@op-engineering/op-sqlite:** SQLite database for users, roles, FPOs, farmers, buyers, market data
- **@react-native-async-storage/async-storage:** 2.2.0 (session + ephemeral state)

### Native & Permissions
- **react-native-safe-area-context:** ~5.7.0 (notch handling)
- **react-native-screens:** ~4.26.0 (native stack optimization)
- **Custom TurboModules — no Expo, no third-party speech library.** New Architecture (`newArchEnabled=true`, no legacy-bridge fallback) broke every third-party speech package tried, so both directions are hand-written:
  - **NativeVoiceInput** (`src/native/NativeVoiceInput.ts` + `android/app/src/main/java/com/fposetu/mobile/VoiceInputModule.kt`) — speech-to-text, launches Android's speech recognizer as a foreground dialog Activity
  - **NativeTts** (`src/native/NativeTts.ts` + `android/app/src/main/java/com/fposetu/mobile/TtsModule.kt`) — text-to-speech

### Development
- **ESLint:** ^9.0.0 with the `@react-native` config (configured in `eslint.config.js`)
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
│   │       ├── VoiceInputModule.kt       # Custom speech-to-text TurboModule
│   │       └── TtsModule.kt              # Custom text-to-speech TurboModule
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
│   │   ├── useVoiceInput.ts             # Krishi Bandhu voice logic (NativeVoiceInput TurboModule)
│   │   ├── useSpeech.ts                 # Text-to-speech hook (NativeTts TurboModule)
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
│   │   ├── NativeVoiceInput.ts          # Bridge to custom Kotlin speech-to-text module
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

**farmer_profiles / fpo_profiles / buyer_profiles**
- One table per role, each linking a login to one domain record
- **Replaced by `user_profiles` in migration 003** — see below. These tables are
  copied across and dropped during that migration.

### Migration 003: Parties

Introduces the supertype that lets one persona's action reference another.

**parties**
- `id INTEGER PRIMARY KEY`, `kind TEXT` (farmer/fpo/buyer/supplier/service_provider)
- `entity_id TEXT` — the natural key of the owning record, `UNIQUE (kind, entity_id)`
- `is_active INT`
- Farmers, FPOs, buyers and suppliers have unrelated id formats, so nothing could
  express "A acted on B". `parties` is that common key. Names are deliberately not
  copied here — the `v_parties` view resolves them from the owning entity.

**v_parties** (view)
- `party_id, kind, entity_id, name, locality, state` across all five kinds

**user_profiles**
- `user_id INT FK`, `role_code TEXT FK roles(code)`, `party_id INT FK parties(id)`
- `PRIMARY KEY (user_id, role_code)` — at most one profile per login per role
- Replaces the three `*_profiles` tables, and is what allows `supplier` to be a
  real role rather than a UI toggle

**service_providers**
- `id TEXT PRIMARY KEY`, `name`, `provider_type` (lender/logistics/compliance/expert/mentor)
- `org, specialisation, phone, email, location, fee_note, eligibility_note, product_note, note`
- Folds the five ID-less directories into one entity that can hold a party row,
  so a service request has something to point at

**roles**
- Migration 003 adds the `supplier` role and re-sorts `admin` after it

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

### Option 2: Command Line (React Native CLI)

```bash
npm run android
```

Runs `react-native run-android` after ensuring Metro is up (`scripts/ensure-metro.js`). There is no Expo CLI in this project — `expo start`/`expo run:android` do not apply here.

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
3. Speech-to-text (via the app's own `NativeVoiceInput` TurboModule) transcribes the command
4. `farmer-intents.ts` resolves intent → destination screen
5. App navigates automatically; shows a success toast

### Fallback to Typed Input

If voice fails (no mic, no permission, device doesn't support it):
- Input field becomes available for typing
- Same commands work when typed

### Implementation

**`src/hooks/useVoiceInput.ts`:**
- Wraps the app's own `NativeVoiceInput` TurboModule (`src/native/NativeVoiceInput.ts`, `android/app/src/main/java/com/fposetu/mobile/VoiceInputModule.kt`) — hand-written because third-party speech-to-text packages either don't actually implement the TurboModule interface they register as, or are old-bridge-only, and fail under this app's New Architecture (`newArchEnabled=true`, no legacy-bridge fallback)
- Handles the `RECORD_AUDIO` runtime permission
- Launches Android's speech recognizer as a foreground dialog Activity rather than binding the headless service (the headless approach failed with `MICROPHONE_UNAVAILABLE` on at least one OEM device despite the permission being granted)
- Supports English, Hindi, Marathi locales (`en-IN`, `hi-IN`, `mr-IN`)
- Graceful fallback to typed input if the native module or device recognizer is unavailable
- No live partial transcript while speaking — a result only arrives once, final

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

1. **Microphone permission denied?**
   - App shows: "Microphone permission is needed for voice."
   - Grant in: **Settings → Apps → FPO Setu → Permissions → Microphone**
   - Then try again.

2. **Microphone access is blocked?**
   - App shows: "Microphone access is blocked. Enable it in Settings."
   - Grant in: **Settings → Apps → FPO Setu → Permissions → Microphone**
   - Or: **Settings → Privacy → Microphone → enable FPO Setu**

3. **Device has no recognizer installed?**
   - Unlikely. Most Android 13+ devices have Google Recorder built-in.
   - If missing: Install **Google Recorder** from Play Store.

4. **No internet connection?**
   - Voice uses cloud recognition (requires data/Wi-Fi).
   - Error: "Voice needs an internet connection."
   - Connect to Wi-Fi or mobile data.

5. **Language not supported?**
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
- Check seeded accounts: see [Authentication](#authentication) for the seeded username/password/role table
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
- **React Navigation:** https://reactnavigation.org/
- **Android Manifest Reference:** https://developer.android.com/guide/topics/manifest/manifest-intro
- **op-sqlite Documentation:** https://op-engineering.github.io/op-sqlite/

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
