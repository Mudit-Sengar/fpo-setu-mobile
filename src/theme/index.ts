// Design tokens ported verbatim from the web app's src/styles.css (:root block).
// Tailwind v4 `@theme inline` CSS custom properties -> a plain RN theme object.

export const colors = {
  background: "#ffffff",
  foreground: "#222222",
  card: "#ffffff",
  cardForeground: "#222222",
  popover: "#ffffff",
  popoverForeground: "#222222",

  primary: "#A91E22",
  primaryForeground: "#ffffff",

  secondary: "#F5F5F5",
  secondaryForeground: "#222222",

  muted: "#F5F5F5",
  mutedForeground: "#6b7280",

  accent: "#E8731C",
  accentForeground: "#ffffff",

  destructive: "#C0392B",
  destructiveForeground: "#ffffff",

  border: "#e5e7eb",
  input: "#e5e7eb",
  ring: "#A91E22",

  brand: "#A91E22",
  brandAccent: "#E8731C",

  farmer: "#2E7D52",
  farmerForeground: "#ffffff",
  farmerSoft: "#E7F2EC",

  fpo: "#A91E22",
  fpoForeground: "#ffffff",
  fpoSoft: "#FBEAEB",

  buyer: "#1F6E78",
  buyerForeground: "#ffffff",
  buyerSoft: "#E3F1F3",

  chart1: "#A91E22",
  chart2: "#E8731C",
  chart3: "#2E7D52",
  chart4: "#1F6E78",
  chart5: "#6b7280",

  // Derived helpers (web used opacity modifiers like bg-muted/30)
  mutedBg: "#FAFAFA",
  success: "#2E7D52",
  warning: "#E8731C",
} as const;

export type Accent = "farmer" | "fpo" | "buyer";

export const accentColors: Record<Accent, { base: string; fg: string; soft: string }> = {
  farmer: { base: colors.farmer, fg: colors.farmerForeground, soft: colors.farmerSoft },
  fpo: { base: colors.fpo, fg: colors.fpoForeground, soft: colors.fpoSoft },
  buyer: { base: colors.buyer, fg: colors.buyerForeground, soft: colors.buyerSoft },
};

// --radius: 0.75rem = 12px; sm/md/lg/xl derived exactly as in styles.css
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xxs: 10,
  xs: 12,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const chartPalette = [
  colors.chart1,
  colors.chart2,
  colors.chart3,
  colors.chart4,
  colors.chart5,
];
