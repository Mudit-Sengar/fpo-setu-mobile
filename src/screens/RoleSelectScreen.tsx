import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Globe, ShoppingBag, Sprout, Warehouse } from "lucide-react-native";
import { LANG_LABELS, useApp, type Lang, type Role } from "../lib/app-state";
import { accentColors, colors, radius, spacing } from "../theme";
import { Muted, Text } from "../components/ui";

/**
 * Ported from the web app's src/routes/index.tsx ("Login — FPO Setu").
 *
 * As in the web app this is NOT real authentication — it just calls `login(role)`,
 * which writes the role string to storage. The web version's "if already logged in,
 * redirect" effect is unnecessary here: RootNavigator only mounts this screen when
 * `role` is null.
 */
export function RoleSelectScreen() {
  const { lang, setLang, login } = useApp();
  const insets = useSafeAreaInsets();
  const [langOpen, setLangOpen] = useState(false);

  const go = (role: Role) => login(role);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.brand}>
          <View style={s.logoBox}><Sprout size={16} color={colors.primaryForeground} /></View>
          <Text size="base" weight="700">FPO Setu</Text>
        </View>
        <Pressable onPress={() => setLangOpen(true)} style={s.langBtn} accessibilityLabel="Language">
          <Globe size={14} color={colors.mutedForeground} />
          <Text size="xxs" weight="600" noTranslate>{LANG_LABELS[lang]}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.hero}>
          <Text size="xxxl" weight="700" color={colors.primary} center>FPO Setu</Text>
          <Text size="base" weight="500" color={colors.accent} center style={{ marginTop: 4 }}>
            Connecting Farmers, FPOs & Markets
          </Text>
        </View>

        <Muted center style={{ marginBottom: spacing.md, letterSpacing: 0.5 }}>
          Choose your role to enter
        </Muted>

        <View style={{ gap: spacing.md }}>
          <RoleCard
            onPress={() => go("farmer")}
            color="farmer"
            icon={<Sprout size={24} color={colors.farmerForeground} />}
            title="Login as Farmer"
            sub="Discover FPOs, track benefits, market intel."
          />
          <RoleCard
            onPress={() => go("fpo")}
            color="fpo"
            icon={<Warehouse size={24} color={colors.fpoForeground} />}
            title="Login as FPO"
            sub="Manage business, find buyers, access capital."
          />
          <RoleCard
            onPress={() => go("buyer")}
            color="buyer"
            icon={<ShoppingBag size={24} color={colors.buyerForeground} />}
            title="Login as Buyer / Supplier"
            sub="Post demand or supply inputs to FPOs."
          />
        </View>
      </ScrollView>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setLangOpen(false)}>
          <View style={s.sheet}>
            <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
              <Text size="sm" weight="700">Language</Text>
            </View>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <Pressable key={l} onPress={() => { setLang(l); setLangOpen(false); }} style={s.option}>
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

function RoleCard({
  onPress, color, icon, title, sub,
}: { onPress: () => void; color: "farmer" | "fpo" | "buyer"; icon: React.ReactNode; title: string; sub: string }) {
  const a = accentColors[color];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.roleCard, pressed && { opacity: 0.85 }]}>
      <View style={[s.roleIcon, { backgroundColor: a.base }]}>{icon}</View>
      <Text size="lg" weight="700" color={a.base}>{title}</Text>
      <Muted style={{ marginTop: 2 }}>{sub}</Muted>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBox: {
    width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  langBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 8, paddingVertical: 7,
  },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { paddingVertical: spacing.xxl },
  roleCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    backgroundColor: colors.card, padding: spacing.xl,
  },
  roleIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  sheet: { backgroundColor: colors.background, borderRadius: radius.lg, overflow: "hidden" },
  option: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
