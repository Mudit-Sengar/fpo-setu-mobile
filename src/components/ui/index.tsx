/**
 * React Native replacements for the shadcn/Radix primitives used by the web app
 * (src/components/ui/*). Only the ~14 components the real screens actually used
 * are ported; unused shadcn boilerplate (sidebar, command, carousel, resizable,
 * input-otp, day-picker …) is deliberately dropped.
 */
import React, { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Check, ChevronDown, ChevronUp, Star, X } from "lucide-react-native";
import { colors, radius, spacing } from "../../theme";
import { Text, Muted } from "./Text";

export { Text, Muted } from "./Text";
export { toast, Toaster } from "./Toast";

/** Absolute-fill style object (RN 0.86 dropped StyleSheet.absoluteFillObject typing). */
const ABS_FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;
export { ABS_FILL };

/* ------------------------------------------------------------------ Card */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function CardHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.cardHeader, style]}>{children}</View>;
}

export function CardTitle({ children, color }: { children: ReactNode; color?: string }) {
  return <Text size="base" weight="600" color={color}>{children}</Text>;
}

export function CardContent({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.cardContent, style]}>{children}</View>;
}

/* ---------------------------------------------------------------- Button */

export type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export function Button({
  children,
  onPress,
  variant = "default",
  size = "md",
  accent,
  disabled,
  full,
  icon,
  style,
}: {
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Overrides the default brand colour (used for role-accented buttons). */
  accent?: string;
  disabled?: boolean;
  full?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const base = accent ?? colors.primary;
  const height = size === "sm" ? 34 : size === "lg" ? 48 : 40;
  const padH = size === "sm" ? 10 : 14;

  const bg =
    variant === "default" ? base
    : variant === "secondary" ? colors.secondary
    : variant === "destructive" ? colors.destructive
    : "transparent";
  const fg =
    variant === "default" || variant === "destructive" ? "#ffffff"
    : variant === "secondary" ? colors.secondaryForeground
    : base;
  const borderColor = variant === "outline" ? colors.border : "transparent";

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        {
          height,
          paddingHorizontal: padH,
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "outline" ? 1 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
      accessibilityRole="button"
    >
      {icon}
      {children != null && (
        <Text size={size === "sm" ? "xs" : "sm"} weight="600" color={fg}>{children}</Text>
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Badge */

export function Badge({
  children,
  color = colors.mutedForeground,
  bg = colors.muted,
}: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text size="xxs" weight="600" color={color}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ Chip */

/**
 * The web app's repeated "chip selector" pattern (a row of toggle buttons that
 * swap the conditionally-rendered section below). Two near-identical copies
 * existed in the web codebase (farmer routes + fpo-sections); unified here.
 */
export function Chip({
  label,
  active,
  onPress,
  accent = colors.primary,
}: { label: string; active: boolean; onPress: () => void; accent?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        s.chip,
        active
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Text size="sm" weight="600" color={active ? "#ffffff" : colors.foreground}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={s.chipRow}>{children}</View>;
}

/* ----------------------------------------------------------------- Input */

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  numberOfLines,
  style,
  editable = true,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  onSubmitEditing,
  returnKeyType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  multiline?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  editable?: boolean;
  /** Masks input. Used by the password field on the login screen. */
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={numberOfLines}
      editable={editable}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType}
      style={[
        s.input,
        multiline ? { height: (numberOfLines ?? 3) * 22 + 16, textAlignVertical: "top" } : null,
        style as never,
      ]}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text size="xs" weight="600" color={colors.mutedForeground} style={{ marginBottom: 4 }}>{children}</Text>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Select */

/**
 * Replaces both the native web `<select>` and shadcn's Radix `<Select>`.
 * Implemented as a modal list — no extra native picker dependency needed.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select…",
  labelOf,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  placeholder?: string;
  labelOf?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? (labelOf ? labelOf(value) : value) : placeholder;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.select}>
        <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
        <ChevronDown size={16} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView bounces={false}>
              {options.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => { onChange(o); setOpen(false); }}
                  style={s.selectOption}
                >
                  <Text size="sm" style={{ flex: 1 }}>{labelOf ? labelOf(o) : o}</Text>
                  {o === value && <Check size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------- Switch/Checkbox */

export function Toggle({
  checked,
  onChange,
  label,
  accent = colors.primary,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; accent?: string }) {
  return (
    <Pressable onPress={() => onChange(!checked)} style={s.toggleRow}>
      <View style={[s.track, { backgroundColor: checked ? accent : colors.border }]}>
        <View style={[s.thumb, { alignSelf: checked ? "flex-end" : "flex-start" }]} />
      </View>
      {label != null && <Text size="sm" style={{ flex: 1 }}>{label}</Text>}
    </Pressable>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  accent = colors.primary,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; accent?: string }) {
  return (
    <Pressable onPress={() => onChange(!checked)} style={s.checkRow}>
      <View style={[s.checkBox, checked && { backgroundColor: accent, borderColor: accent }]}>
        {checked && <Check size={12} color="#ffffff" strokeWidth={3} />}
      </View>
      {label != null && <Text size="sm" style={{ flex: 1 }}>{label}</Text>}
    </Pressable>
  );
}

/* -------------------------------------------------------------- Progress */

export function Progress({ value, color = colors.primary, height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[s.progressTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** Circular-ish compliance gauge used by the FPO bookkeeping section. */
export function Gauge({ value, label }: { value: number; label?: string }) {
  const color = value >= 75 ? colors.farmer : value >= 55 ? colors.accent : colors.destructive;
  return (
    <View style={{ gap: 6 }}>
      <View style={s.rowBetween}>
        <Muted>{label ?? "Compliance score"}</Muted>
        <Text size="sm" weight="700" color={color}>{`${value}%`}</Text>
      </View>
      <Progress value={value} color={color} />
    </View>
  );
}

/* ----------------------------------------------------------------- Table */

/**
 * The web app used HTML <table> heavily. RN has no table primitive, so this is the
 * equivalent: one responsive pattern shared by every table in the app.
 *
 * Columns are sized in **resolved pixels**, not flex weights. That distinction is
 * the whole point: `flex` only divides a *bounded* width, and a horizontal
 * ScrollView gives its child an unbounded one. Inside a scrolling table every row
 * therefore laid itself out against its own content instead of a shared grid, so
 * no two rows agreed on a column position and none matched the header — the
 * visible misalignment in Log Meeting and Bookkeeping.
 *
 * Here the table measures the space it has, resolves each `flex` weight into a
 * concrete width once, and hands that same number to the header cell and to every
 * body cell. Cell content can then wrap freely without moving any other column.
 */
export function Table({ columns, rows, minWidth }: {
  columns: { key: string; label: string; flex?: number; align?: "left" | "right" }[];
  rows: Record<string, ReactNode>[];
  /**
   * Width the table needs to stay readable. When the available space is narrower
   * the table keeps this width and scrolls horizontally rather than squeezing
   * columns until content clips — which is what happens on smaller Android phones.
   */
  minWidth?: number;
}) {
  const [available, setAvailable] = useState(0);

  const gaps = spacing.sm * (columns.length - 1);
  const totalFlex = columns.reduce((sum, c) => sum + (c.flex ?? 1), 0);

  // Grow to fill the card when there's room; never shrink below `minWidth`.
  const tableWidth = Math.max(available, minWidth ?? 0);
  const scrolls = tableWidth > available;

  /**
   * ONE shared per-column style, applied identically to the header cell and every
   * body cell, so a column's width and alignment cannot drift between them.
   * `alignItems` makes `align: "right"` apply to JSX cells (Badges, Buttons) too,
   * not just plain strings — a `textAlign` alone would leave a right-aligned
   * header sitting above a left-aligned Badge.
   */
  const cellStyle = (c: { flex?: number; align?: "left" | "right" }) => ({
    width: ((c.flex ?? 1) / totalFlex) * (tableWidth - gaps),
    alignItems: (c.align === "right" ? "flex-end" : "flex-start") as "flex-end" | "flex-start",
  });

  const body = (
    <View style={{ width: tableWidth }}>
      <View style={s.tableHeadRow}>
        {columns.map((c) => (
          <View key={c.key} style={cellStyle(c)}>
            <Text
              size="xxs"
              weight="700"
              color={colors.mutedForeground}
              style={{ textAlign: c.align ?? "left" }}
            >
              {c.label}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tableRow}>
          {columns.map((c) => {
            const cell = r[c.key];
            return (
              <View key={c.key} style={cellStyle(c)}>
                {typeof cell === "string" || typeof cell === "number" ? (
                  <Text size="xs" style={{ textAlign: c.align ?? "left" }}>{String(cell)}</Text>
                ) : (
                  cell
                )}
              </View>
            );
          })}
        </View>
      ))}
      {rows.length === 0 && (
        <View style={{ paddingVertical: spacing.lg }}>
          <Muted center>No records yet.</Muted>
        </View>
      )}
    </View>
  );

  // The outer View is the measuring frame; widths can only be resolved once it has
  // reported how much room the card actually gives us, which is what makes the
  // same table work across Android screen sizes.
  return (
    <View onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
      {available > 0 && (
        scrolls
          ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{body}</ScrollView>
          : body
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- Dialog */

export function Dialog({
  visible,
  onClose,
  title,
  children,
}: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.dialogSheet}>
          <View style={s.dialogHeader}>
            <Text size="base" weight="700" style={{ flex: 1 }}>{title ?? ""}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------- Accordion */

export function Accordion({
  title,
  children,
  defaultOpen = false,
}: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={s.accordion}>
      <Pressable onPress={() => setOpen((o) => !o)} style={s.accordionHead}>
        <Text size="sm" weight="600" style={{ flex: 1 }}>{title}</Text>
        {open ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
      </Pressable>
      {open && <View style={s.accordionBody}>{children}</View>}
    </View>
  );
}

/* ----------------------------------------------------------------- Stars */

export function StarRating({
  value,
  onChange,
  size = 22,
  readOnly,
}: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={readOnly} onPress={() => onChange?.(n)} hitSlop={4}>
          <Star
            size={size}
            color={n <= value ? colors.accent : colors.border}
            fill={n <= value ? colors.accent : "transparent"}
          />
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------- Utilities */

/** Label/value row used across profile + detail screens. */
export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={s.detailRow}>
      <Muted style={{ flex: 1 }}>{label}</Muted>
      <View style={{ flex: 1.3, alignItems: "flex-end" }}>
        {typeof value === "string" || typeof value === "number"
          ? <Text size="sm" weight="500" style={{ textAlign: "right" }}>{value as string}</Text>
          : value}
      </View>
    </View>
  );
}

export function SectionTitle({ children, color }: { children: ReactNode; color?: string }) {
  return <Text size="lg" weight="700" color={color} style={{ marginBottom: 2 }}>{children}</Text>;
}

export function Divider() {
  return <View style={s.divider} />;
}

/** Small stat tile used on home/summary screens. */
export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text size="lg" weight="700" color={color ?? colors.foreground}>{value}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 2 },
  cardContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  // Enlarged for touch: >=44pt tall target with roomier padding and larger label.
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  selectOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    maxHeight: "70%",
    overflow: "hidden",
  },
  dialogSheet: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    maxHeight: "85%",
    overflow: "hidden",
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  track: { width: 42, height: 24, borderRadius: 12, padding: 2, justifyContent: "center" },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkBox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  progressTrack: { width: "100%", backgroundColor: colors.muted, overflow: "hidden" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tableHeadRow: {
    flexDirection: "row",
    // alignItems matches tableRow below — without it a two-line header cell sat at a
    // different vertical offset than its single-line neighbours.
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  accordion: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  accordionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  accordionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  stat: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
});
