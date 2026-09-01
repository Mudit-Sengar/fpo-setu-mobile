/** Small presentational pieces repeated across the ported screens. */
import React, { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Play } from "lucide-react-native";
import { imgSource, type Thumb } from "../lib/mockData";
import { useApp } from "../lib/app-state";
import { tr } from "../lib/i18n";
import { colors, radius, spacing } from "../theme";
import { Muted, Text } from "./ui";

/**
 * Per-line height reserved for a multi-line SectionCard title, sized for
 * the 1.3x max accessibility font scale (fontSize.xs=12 * 1.3 * lineHeight
 * multiplier 1.4 ≈ 22px), so the reserved box never needs to grow from
 * content at any supported font scale — see SectionCard's `lines` prop.
 */
const MAX_SCALE_LINE_HEIGHT = 22;

/** The "Tap one of the buttons above…" empty state used by every chip screen. */
export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <View style={s.hint}>
      <Muted center>{children}</Muted>
    </View>
  );
}

/** Small 3-up key/value pill grid (farmer connect cards). */
export function Pill({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.pill}>
      <Text size="xxs" weight="600" color={colors.mutedForeground} center>{k}</Text>
      <Text size="xs" weight="700" center>{v}</Text>
    </View>
  );
}

/** Icon + label metadata line. */
export function Meta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={s.meta}>
      {icon}
      <Muted style={{ flex: 1 }} numberOfLines={2}>{label}</Muted>
    </View>
  );
}

/** Large square navigation tile (farmer + FPO home grids). */
export function Tile({
  label, icon, onPress, accent, tint,
}: { label: string; icon: ReactNode; onPress: () => void; accent: string; tint: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, { backgroundColor: tint, borderColor: accent + "44", opacity: pressed ? 0.8 : 1 }]}>
      <View style={[s.tileIcon, { backgroundColor: "rgba(255,255,255,0.75)" }]}>{icon}</View>
      <Text size="sm" weight="700" color={accent}>{label}</Text>
    </Pressable>
  );
}

/**
 * Video/course card. Note: as in the web app these are NOT real videos — the
 * dialog shows a static thumbnail + transcript. Parity preserved.
 */
export function VideoCard({
  title, duration, thumb, index, onPress, accent = colors.farmer,
}: { title: string; duration: string; thumb: Thumb; index?: number; onPress: () => void; accent?: string }) {
  const { lang } = useApp();
  return (
    <Pressable onPress={onPress} style={s.videoCard}>
      <View style={s.videoThumbWrap}>
        <Image source={imgSource(thumb)} style={s.videoThumb} resizeMode="cover" />
        <View style={s.videoOverlay}>
          <Play size={30} color="#ffffff" fill="#ffffff" />
        </View>
        {index != null && (
          <View style={[s.stepBadge, { backgroundColor: accent }]}>
            <Text size="xxs" weight="700" color="#ffffff">{`${tr("Step", lang)} ${index}`}</Text>
          </View>
        )}
        <View style={s.durBadge}>
          <Text size="xxs" color="#ffffff" noTranslate>{duration}</Text>
        </View>
      </View>
      <View style={{ padding: spacing.md }}>
        <Text size="sm" weight="600">{title}</Text>
      </View>
    </Pressable>
  );
}

/** Course card with a progress bar (FPO capacity building). */
export function CourseCard({
  name, by, progress, thumb, accent,
}: { name: string; by?: string; progress: number; thumb: Thumb; accent: string }) {
  const { lang } = useApp();
  return (
    <View style={s.videoCard}>
      <Image source={imgSource(thumb)} style={s.videoThumb} resizeMode="cover" />
      <View style={{ padding: spacing.md, gap: 6 }}>
        <Text size="sm" weight="600">{name}</Text>
        {by != null && <Muted>{by}</Muted>}
        <View style={s.progressTrack}>
          <View style={{ width: `${progress}%`, height: "100%", backgroundColor: accent, borderRadius: 4 }} />
        </View>
        <Muted>{`${progress}${tr("% complete", lang)}`}</Muted>
      </View>
    </View>
  );
}

/** Back-to-home link, mirroring the web app's "← Home" Link. */
export function BackLink({ label = "Home", onPress, icon }: { label?: string; onPress: () => void; icon: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={s.back} hitSlop={6}>
      {icon}
      <Muted>{label}</Muted>
    </Pressable>
  );
}

/** Segmented pill toggle (durations, Central/State filters, buyer/supplier mode). */
export function Segmented<T extends string>({
  options, value, onChange, accent, labelOf, size = "md",
}: {
  options: readonly T[]; value: T; onChange: (v: T) => void; accent: string;
  labelOf?: (v: T) => string;
  /** "lg" stretches to full width with larger targets — used for prominent filters. */
  size?: "md" | "lg";
}) {
  const large = size === "lg";
  return (
    <View style={[s.segmented, large && s.segmentedLg]}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[s.segment, large && s.segmentLg, active && { backgroundColor: accent }]}
          >
            <Text
              size={large ? "base" : "xs"}
              weight="600"
              center={large}
              color={active ? "#ffffff" : colors.foreground}
            >
              {labelOf ? labelOf(o) : o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Square icon+label section selector. Originally local to the My FPO screen;
 * shared so the Learn screen presents its sections identically.
 */
export function SectionCard({
  title, icon, active, onPress, accent, lines = 1,
}: {
  title: string; icon: ReactNode; active: boolean; onPress: () => void; accent: string;
  /**
   * Titles too long for one line ("Connect with Similar Farmers",
   * "Market-Linked Growth Planning") pass `lines={3}` to show the full text
   * instead of truncating. Wrapped in a fixed-height box below — reserving
   * the height for that many lines up front, rather than letting it grow
   * from content, is what avoids the layout-shift bug described below.
   * 3, not 2, because at the 1.3x max accessibility font scale (see
   * DEFAULT_MAX_FONT_SCALE in Text.tsx) these titles wrap to 3 lines, not 2 —
   * reserving only 2 there re-truncates exactly the titles this prop exists
   * to show in full.
   */
  lines?: 1 | 2 | 3;
}) {
  const titleNode = (
    <Text
      size="xs" weight="700" center
      numberOfLines={lines}
      color={active ? "#ffffff" : colors.foreground}
    >
      {title}
    </Text>
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        s.sectionCard,
        active ? { backgroundColor: accent, borderColor: accent } : null,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      {/*
        numberOfLines={1} (the default): a wrapped 2-line title makes Fabric's
        flexWrap container miscalculate that line's height, shifting the
        icon+text block within its own card AND every row below (including a
        lone full-width card and any EmptyHint after it) can end up
        overlapping. Forcing a single line removes the wrap entirely, so it
        can't trigger that container miscalculation for any SectionCard, on
        any screen.

        adjustsFontSizeToFit + minimumFontScale used to handle overlong
        titles by shrinking them instead of truncating — but combined with
        this Text wrapper's explicit lineHeight, translated multi-word titles
        (Hindi/Marathi run longer than English) silently dropped their second
        word instead of shrinking or ellipsizing. Plain numberOfLines={1}
        falls back to RN's default tail-ellipsis, which reliably shows a
        truncated-but-legible label instead.

        `lines={2|3}`: reserves a fixed height for that many lines (sized for
        the max accessibility font scale, see DEFAULT_MAX_FONT_SCALE in
        Text.tsx) instead of one. Because the box's height never depends on
        how the text actually wraps, it sidesteps the Fabric remeasurement
        bug above while still showing the complete title.
      */}
      {lines > 1 ? <View style={{ height: MAX_SCALE_LINE_HEIGHT * lines, justifyContent: "center" }}>{titleNode}</View> : titleNode}
    </Pressable>
  );
}

/** Row wrapper for SectionCard. */
export function SectionCardRow({ children }: { children: ReactNode }) {
  return <View style={s.sectionRow}>{children}</View>;
}

const s = StyleSheet.create({
  hint: {
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg, backgroundColor: colors.mutedBg,
  },
  pill: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, backgroundColor: colors.background, gap: 1,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: "45%" },
  tile: {
    flex: 1, minWidth: "45%", minHeight: 112, borderWidth: 1, borderRadius: radius.xl,
    padding: spacing.lg, justifyContent: "space-between",
  },
  tileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  videoCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    overflow: "hidden", backgroundColor: colors.card,
  },
  videoThumbWrap: { height: 120, width: "100%", backgroundColor: colors.muted },
  videoThumb: { height: 120, width: "100%", backgroundColor: colors.muted },
  videoOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)",
  },
  stepBadge: { position: "absolute", left: 6, top: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  durBadge: { position: "absolute", right: 6, bottom: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.55)" },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" },
  back: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  segmented: {
    flexDirection: "row", borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, overflow: "hidden",
  },
  segmentedLg: { borderWidth: 1.5, alignSelf: "stretch" },
  segment: { paddingHorizontal: 12, paddingVertical: 7 },
  segmentLg: { flex: 1, paddingHorizontal: 10, paddingVertical: 14, minHeight: 50, justifyContent: "center" },
  sectionCard: {
    flex: 1, minWidth: 100, minHeight: 88,
    alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.sm,
    backgroundColor: colors.card,
  },
  sectionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
