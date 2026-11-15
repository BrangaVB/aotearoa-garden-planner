# Aotearoa Garden Planner (Phase 1 MVP)

Offline-first, mobile-first New Zealand garden planner built with **React Native (Expo SDK 52) + TypeScript + `expo-sqlite`**.

## What's Included in Phase 1 MVP
- **Zero-Friction Guest Onboarding (`src/screens/OnboardingScreen.tsx`)**: Enter any NZ postcode, town, or suburb to resolve NIWA climate normals (14 NZ climate zones), spring/autumn frost windows, and active council water restriction stages without mandatory sign-up.
- **Complete 67-Council Water Rules Registry (`src/data/nzClimateAndCouncils.ts`)**: All 67 NZ territorial authorities (13 city councils, 53 district councils, Chatham Islands) with water-provider metadata, Level 0–4 restriction rules, odd/even address logic, and in-app user-reported restriction overrides.
- **Offline SQLite Schema & Seeder (`src/db/schema.ts`, `src/db/database.ts`)**: Local-first persistence for garden profiles, beds/zones (with 3-bed free tier guard), plantings, watering logs, and care tasks.
- **Expanded NZ Botanical, Cultural & Biosecurity Catalog (`src/data/nzPlantCatalog.ts`)**: 150+ edibles, fruit trees, NZ natives, ornamentals, and **NPPA / regional pest plants** with Te Reo Māori names, companion/antagonist pairings, crop-rotation families, and search/category filtering.
- **Dynamic Smart Watering Engine (`src/engine/wateringEngine.ts`)**: Daily soil-moisture balance ($ET_0 \times K_c \times \text{ShadeFactor} - \text{EffectiveRainfall}$) adjusted for soil water-holding capacity, pot dry-down, rainwater tank exemptions, Open-Meteo weather forecasts (`src/services/weatherService.ts`), and local council water restrictions.
- **Modular Bed & Zone Builder (`src/engine/bedPlannerEngine.ts`, `src/screens/BedBuilderScreen.tsx`)**: Interactive 25 cm grid placement with Southern Hemisphere orientation, spacing checks, companion/antagonist warnings, NPPA biosecurity blocking, and bed/planting management.
- **Proactive NZ Care Calendar, Notifications & Pest Guide (`src/engine/careCalendarEngine.ts`, `src/services/notificationService.ts`, `src/data/nzPestGuide.ts`)**: Seasonal sowing/pruning tasks, overnight frost-cloth alerts ($\le 2^\circ\text{C}$), Expo local notifications for morning watering & evening frost alerts, optional **Maramataka** lunar phase overlay, and offline NZ pest/disease remedies.

## Quick Start

```bash
npm install
npx expo start
```

Run type-checking and engine unit tests:

```bash
npm run typecheck
npm test
```
