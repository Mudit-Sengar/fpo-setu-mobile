import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, Globe, Shield, Sprout, User } from "lucide-react-native";
import { useApp, LANG_LABELS, type Lang, type Role } from "../../lib/app-state";
import { farmerRepo, fpoRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { FPO, Farmer } from "../../db/types";
import { accentColors, colors, radius, spacing, type Accent } from "../../theme";
import { Button, Text, Muted } from "../ui";

/**
 * Ported from the web app's src/components/layout/TopBar.tsx.
 * The web `<select>` for language becomes a modal picker; `<Link>` becomes an
 * onPress callback supplied by the navigator.
 */
export function TopBar({
  accent,
  onOpenFarmerProfile,
  onBack,
}: {
  accent?: Accent;
  onOpenFarmerProfile?: () => void;
  /** When provided, renders a Back affordance at the far left of the header. */
  onBack?: () => void;
}) {
  const { lang, setLang, t, logout, activeFpoId, session, profileId, switchRole } = useApp();
  const insets = useSafeAreaInsets();
  const [langOpen, setLangOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  // The signed-in farmer, not a fixed constant — an admin viewing the farmer role
  // and a farmer login both resolve through the session's profile id.
  const farmerId = accent === "farmer" ? profileId : null;
  const [farmer] = useDbQuery<Farmer | null>(
    () => (farmerId == null ? Promise.resolve(null) : farmerRepo.getFarmerById(farmerId)),
    [farmerId], null);
  const [fpo] = useDbQuery<FPO | null>(
    () => fpoRepo.getFpoById(activeFpoId), [activeFpoId], null);
  const accentColor = accent ? accentColors[accent].base : colors.primary;

  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <View style={s.inner}>
        <View style={s.left}>
          {onBack != null && (
            <Pressable
              onPress={onBack}
              style={s.backBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={22} color={accentColor} />
            </Pressable>
          )}
          {accent === "farmer" && farmer ? (
            <>
              <Pressable
                onPress={onOpenFarmerProfile}
                style={[s.avatar, { backgroundColor: colors.farmer }]}
                accessibilityLabel="Open farmer profile"
              >
                <User size={16} color={colors.farmerForeground} />
              </Pressable>
              <Pressable onPress={onOpenFarmerProfile} style={{ flex: 1 }}>
                <Muted>Hi</Muted>
                <Text size="sm" weight="700" color={colors.farmer} numberOfLines={1}>{farmer.name}</Text>
              </Pressable>
            </>
          ) : accent === "fpo" ? (
            <>
              <View style={[s.logoBox, { backgroundColor: colors.fpo }]}>
                <Sprout size={16} color={colors.fpoForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size="xxs" weight="600" color={colors.mutedForeground}>FPO</Text>
                <Text size="sm" weight="700" color={colors.fpo} numberOfLines={1}>
                  {(fpo?.name ?? "").split(" Farmer")[0]}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[s.logoBox, { backgroundColor: colors.primary }]}>
                <Sprout size={16} color={colors.primaryForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size="base" weight="700" color={accentColor} numberOfLines={1}>{t("appName")}</Text>
                <Text size="xxs" color={colors.mutedForeground} numberOfLines={1}>{t("tagline")}</Text>
              </View>
            </>
          )}
        </View>

        <View style={s.right}>
          {/* Admins hold every view, so they get an in-place switcher rather than
              having to sign out and back in to change role. */}
          {session?.isAdmin === true && (
            <Pressable
              onPress={() => setRoleOpen(true)}
              style={[s.langBtn, { borderColor: accentColor }]}
              accessibilityLabel="Switch role view"
            >
              <Shield size={14} color={accentColor} />
              <Text size="xxs" weight="700" color={accentColor} noTranslate>
                {session.activeRole.toUpperCase()}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => setLangOpen(true)} style={s.langBtn} accessibilityLabel="Language">
            <Globe size={14} color={colors.mutedForeground} />
            <Text size="xxs" weight="600">{LANG_LABELS[lang]}</Text>
          </Pressable>
          <Button variant="outline" size="sm" onPress={logout} accent={accentColor}>
            {t("logout")}
          </Button>
        </View>
      </View>

      <Modal visible={roleOpen} transparent animationType="fade" onRequestClose={() => setRoleOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setRoleOpen(false)}>
          <View style={s.sheet}>
            <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
              <Text size="sm" weight="700">Switch view</Text>
              <Muted>{`Signed in as ${session?.displayName ?? ""}`}</Muted>
            </View>
            {(session?.viewableRoles ?? []).map((r: Role) => (
              <Pressable
                key={r}
                onPress={() => { setRoleOpen(false); void switchRole(r); }}
                style={s.option}
              >
                <Text size="sm" style={{ flex: 1 }} noTranslate>
                  {r === "buyer" ? "Buyer / Seller" : r.toUpperCase()}
                </Text>
                {r === session?.activeRole && <Check size={16} color={accentColors[r].base} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setLangOpen(false)}>
          <View style={s.sheet}>
            <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
              <Text size="sm" weight="700">Language</Text>
            </View>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => { setLang(l); setLangOpen(false); }}
                style={s.option}
              >
                <Text size="sm" style={{ flex: 1 }} noTranslate>{LANG_LABELS[l]}</Text>
                {l === lang && <Check size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Ported from the web app's exported PrototypeFooter. */
export function PrototypeFooter() {
  return (
    <View style={s.footer}>
      <View style={s.footerPill}>
        <Text size="xxs" weight="600" color={colors.accent} center>
          Prototype — dummy data for demonstration
        </Text>
      </View>
      <Muted center style={{ marginTop: 4 }}>
        Powered by: AgriStack Farmer ID + eNAM prices + Buyer & FPO databases (simulated).
      </Muted>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginRight: 2,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  logoBox: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  langBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 8, paddingVertical: 7,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  sheet: { backgroundColor: colors.background, borderRadius: radius.lg, overflow: "hidden" },
  option: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.mutedBg, alignItems: "center",
  },
  footerPill: {
    backgroundColor: "rgba(232,115,28,0.10)",
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
});
