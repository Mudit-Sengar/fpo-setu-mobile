/** Small presentational pieces repeated across the ported screens. */
import React, { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Play } from "lucide-react-native";
import { imgSource, type Thumb } from "../lib/mockData";
import { colors, radius, spacing } from "../theme";
import { Muted, Text } from "./ui";

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
  return (
    <Pressable onPress={onPress} style={s.videoCard}>
      <View style={s.videoThumbWrap}>
        <Image source={imgSource(thumb)} style={s.videoThumb} resizeMode="cover" />
        <View style={s.videoOverlay}>
          <Play size={30} color="#ffffff" fill="#ffffff" />
        </View>
        {index != null && (
          <View style={[s.stepBadge, { backgroundColor: accent }]}>
            <Text size="xxs" weight="700" color="#ffffff">{`Step ${index}`}</Text>
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
  return (
    <View style={s.videoCard}>
      <Image source={imgSource(thumb)} style={s.videoThumb} resizeMode="cover" />
      <View style={{ padding: spacing.md, gap: 6 }}>
        <Text size="sm" weight="600">{name}</Text>
        {by != null && <Muted>{by}</Muted>}
        <View style={s.progressTrack}>
          <View style={{ width: `${progress}%`, height: "100%", backgroundColor: accent, borderRadius: 4 }} />
        </View>
        <Muted>{`${progress}% complete`}</Muted>
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
  options, value, onChange, accent, labelOf,
}: { options: readonly T[]; value: T; onChange: (v: T) => void; accent: string; labelOf?: (v: T) => string }) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[s.segment, active && { backgroundColor: accent }]}
          >
            <Text size="xs" weight="600" color={active ? "#ffffff" : colors.foreground}>
              {labelOf ? labelOf(o) : o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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
  segment: { paddingHorizontal: 12, paddingVertical: 7 },
});
