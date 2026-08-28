import React, { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertCircle, Check, Globe, LogIn, Package, Shield, ShoppingBag, Sprout, Warehouse,
} from "lucide-react-native";
import { LANG_LABELS, useApp, type Lang, type Role } from "../lib/app-state";
import { tr } from "../lib/i18n";
import { VIEW_ROLES } from "../services/authService";
import { accentColors, accentForRole, colors, radius, spacing } from "../theme";
import { Button, Input, Label, Muted, Text } from "../components/ui";

/**
 * Username + password + role sign-in, replacing the old three-card role picker.
 *
 * This screen holds no credentials and knows no usernames: it collects three
 * fields and hands them to `signIn`, which goes through the auth service to the
 * database. Adding or removing users is therefore a data change, not a code one.
 */

const ROLE_META: Record<Role, { label: string; icon: (c: string) => React.ReactNode }> = {
  farmer: { label: "Farmer", icon: (c) => <Sprout size={18} color={c} /> },
  fpo: { label: "FPO", icon: (c) => <Warehouse size={18} color={c} /> },
  buyer: { label: "Buyer", icon: (c) => <ShoppingBag size={18} color={c} /> },
  supplier: { label: "Supplier", icon: (c) => <Package size={18} color={c} /> },
  admin: { label: "Admin", icon: (c) => <Shield size={18} color={c} /> },
};

export function LoginScreen() {
  const { lang, setLang, signIn } = useApp();
  const insets = useSafeAreaInsets();

  const [langOpen, setLangOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("farmer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Admin signs in with an ID + password only — no role to pick. The account
  // still needs an opening view, so it lands on Farmer and uses the TopBar's
  // role switcher (already built for admins) to reach FPO/Buyer/Supplier/Admin.
  const [adminMode, setAdminMode] = useState(false);

  // `supplier` has no accent of its own — it opens the Buyer stack.
  const accent = accentColors[accentForRole(adminMode ? "admin" : role)].base;

  async function submit() {
    if (busy) return;
    setError(null);

    if (username.trim() === "" || password === "") {
      setError(adminMode ? "Enter both Admin ID and password." : "Enter both username and password.");
      return;
    }

    setBusy(true);
    try {
      // PBKDF2 blocks the JS thread; yield one frame first so the spinner paints.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const result = await signIn(username, password, adminMode ? "farmer" : role);
      // On success the navigator swaps this screen out — nothing to do here.
      if (!result.ok) setError(result.message);
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.brand}>
          <View style={s.logoBox}><Sprout size={16} color={colors.primaryForeground} /></View>
          <Text size="base" weight="700" numberOfLines={1}>FPO Setu</Text>
        </View>
        <Pressable onPress={() => setLangOpen(true)} style={s.langBtn} accessibilityLabel={tr("Language", lang)}>
          <Globe size={14} color={colors.mutedForeground} />
          <Text size="xxs" weight="600" noTranslate>{LANG_LABELS[lang]}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.hero}>
            <Text size="xxxl" weight="700" color={colors.primary} center>FPO Setu</Text>
            <Text size="base" weight="500" color={colors.accent} center style={{ marginTop: 4 }}>
              Connecting Farmers, FPOs & Markets
            </Text>
          </View>

          <View style={s.card}>
            <Text size="lg" weight="700" style={{ marginBottom: spacing.xs }}>Sign in</Text>
            <Muted style={{ marginBottom: spacing.lg }}>
              {adminMode
                ? "Enter the Admin ID and password."
                : "Enter your credentials and choose the view to open."}
            </Muted>

            <View style={{ marginBottom: spacing.md }}>
              <Label>{adminMode ? "Admin ID" : "Username / User ID"}</Label>
              <Input
                value={username}
                onChangeText={(t) => { setUsername(t); setError(null); }}
                placeholder={adminMode ? "e.g. admin01" : "e.g. farmer01"}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="next"
              />
            </View>

            <View style={{ marginBottom: spacing.md }}>
              <Label>Password</Label>
              <Input
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                placeholder="Password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </View>

            {!adminMode && (
              <>
                <Label>Role</Label>
                <View style={s.roleRow}>
                  {VIEW_ROLES.filter((r) => r !== "admin").map((r) => {
                    const active = r === role;
                    const a = accentColors[accentForRole(r)].base;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => { setRole(r); setError(null); }}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${tr("Sign in as", lang)} ${tr(ROLE_META[r].label, lang)}`}
                        style={[
                          s.roleChip,
                          active && { backgroundColor: a, borderColor: a },
                        ]}
                      >
                        {ROLE_META[r].icon(active ? "#ffffff" : a)}
                        <Text
                          size="xxs"
                          weight="700"
                          color={active ? "#ffffff" : colors.foreground}
                          center
                          style={{ marginTop: 4 }}
                        >
                          {ROLE_META[r].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {error != null && (
              <View style={s.error} accessibilityLiveRegion="polite">
                <AlertCircle size={14} color={colors.destructive} />
                <Text size="xs" color={colors.destructive} style={{ flex: 1 }}>{error}</Text>
              </View>
            )}

            <View style={{ marginTop: spacing.lg }}>
              <Button
                full
                accent={accent}
                onPress={submit}
                disabled={busy}
                icon={busy
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <LogIn size={16} color="#ffffff" />}
              >
                {busy ? "Signing in…" : "Login"}
              </Button>
            </View>

            <Pressable
              onPress={() => { setAdminMode((v) => !v); setError(null); }}
              disabled={busy}
              style={{ marginTop: spacing.md, alignSelf: "center" }}
              accessibilityRole="button"
            >
              <Text size="xs" weight="700" color={colors.primary} center>
                {adminMode ? "← Back to role login" : "Admin login instead →"}
              </Text>
            </Pressable>

            <Muted center style={{ marginTop: spacing.sm }}>
              Admin accounts can open Farmer, FPO and Buyer/Seller views after signing in.
            </Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1, minWidth: 0 },
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
  hero: { paddingTop: spacing.xl, paddingBottom: spacing.xl },
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    backgroundColor: colors.card, padding: spacing.xl,
  },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleChip: {
    flex: 1, flexBasis: 0, minWidth: 0,
    alignItems: "center", justifyContent: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  error: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginTop: spacing.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.destructive, borderRadius: radius.md,
    backgroundColor: "rgba(192,57,43,0.06)",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  sheet: { backgroundColor: colors.background, borderRadius: radius.lg, overflow: "hidden" },
  option: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
