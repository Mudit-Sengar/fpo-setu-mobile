import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, Mic, MicOff, Send, Volume2, X } from "lucide-react-native";
import { useApp, type Role } from "../lib/app-state";
import { tr } from "../lib/i18n";
import { useSpeech } from "../hooks/useSpeech";
import { accentColors, colors, radius, spacing, type Accent } from "../theme";
import { Input, Text } from "./ui";

/**
 * `text` is a list of segments rather than one pre-joined string. Each static
 * sentence/fragment is its own array element so <Text> (which translates every
 * array-child element independently, see components/ui/Text.tsx) can translate
 * each one; dynamic values (role names, screen names) sit in the array untouched
 * and simply fail to match any dictionary key, which is a safe no-op.
 */
interface Msg { role: "user" | "bot"; text: string[] }

/**
 * FAB geometry. Exported because the FAB floats above RoleShell's ScrollView, so
 * the shell has to pad its content past it — otherwise the last card on every
 * screen sits permanently under the button once scrolled to the bottom.
 */
export const FAB_SIZE = 54;
export const FAB_BOTTOM_OFFSET = 74;

/**
 * Ported from the web app's AssistantWidget.tsx.
 * The rule-based `reply()` logic is preserved verbatim; only the presentation and
 * the speech plumbing changed. The web version keyed some fallback text off
 * `useLocation().pathname`; here the equivalent is the current screen name, passed
 * in by RoleShell.
 */
export function AssistantWidget({
  screenName = "Home",
  accent,
}: {
  screenName?: string;
  /** Role accent, supplied by RoleShell. Without it the widget would render the
   *  FPO red on every role — visibly wrong in the teal Buyer view. */
  accent?: Accent;
}) {
  const { role, lang } = useApp();
  const { speak, startListening, listening } = useSpeech();
  const insets = useSafeAreaInsets();
  const accentColor = accent ? accentColors[accent].base : colors.primary;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "bot",
    text: role
      ? [
          "Namaste! I'm the FPO Setu Assistant. Ask me anything about the app — I'll tailor tips for the ",
          role.toUpperCase(),
          " view.",
        ]
      : ["Namaste! I'm the FPO Setu Assistant. Ask me anything about the app."],
  }]);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [msgs, open]);

  function reply(question: string) {
    const r: Role = role ?? "farmer";
    const q = question.toLowerCase();
    const tips: string[] = [];

    if (r === "farmer") {
      if (q.includes("fpo") && (q.includes("discover") || q.includes("find") || q.includes("join"))) {
        tips.push("Open Discover (first tab). You'll see nearby FPOs ranked by your crops; tap 'Apply for membership' on any card.");
      }
      if (q.includes("benefit") || q.includes("profit") || q.includes("equity") || q.includes("share")) {
        tips.push("Go to 'My FPO'. The green hero panel shows your monthly equity profit share — that's your income on top of sale proceeds.");
      }
      if (q.includes("course") || q.includes("learn") || q.includes("video")) {
        tips.push("Capacity Building has short videos: What is an FPO, Benefits, How FPOs function, How to become a member, and How to register an FPO.");
      }
      if (q.includes("price") || q.includes("market")) {
        tips.push("In Capacity Building, the FPO vs APMC price chart shows your realisation uplift over the last 6 months.");
      }
    } else if (r === "fpo") {
      if (q.includes("tier")) {
        tips.push("Open Buyer Match. Tiering scores you on Financial, Operational, Infra, Governance and Market readiness (0–100) and is shown next to your tier badge.");
      }
      if (q.includes("proposal") || q.includes("loan") || q.includes("bank") || q.includes("capital")) {
        tips.push("Compliance → 'Generate bankable proposal' creates a one-click loan dossier you can share with NABARD, NCDC and Samunnati.");
      }
      if (q.includes("scheme") || q.includes("government") || q.includes("subsidy")) {
        tips.push("Open Government Schemes & Support to see Central + Maharashtra FPO schemes; the badge tells you if this FPO is currently Eligible.");
      }
      if (q.includes("member") || q.includes("farmer") || q.includes("engage")) {
        tips.push("Relationship Management lists at-risk and dormant members. Click '480 on roll' to expand the full list and filter by status.");
      }
      if (q.includes("buyer") || q.includes("match")) {
        tips.push("Buyer Match shows AI-matched buyers and an Opportunity Sizing panel; click any card (Immediate / Near-Term / Aspirational) for a detailed expansion plan.");
      }
      if (q.includes("compliance") || q.includes("book") || q.includes("ledger")) {
        tips.push("Compliance → Digital Bookkeeping logs each transaction with a Buyer/Seller ID that links to the counterparty's profile.");
      }
    } else {
      if (q.includes("post") || q.includes("demand") || q.includes("requirement")) {
        tips.push("Profile & Order → 'Post a demand requirement'. Enter commodity, qty, grade and delivery — you'll be taken to matching FPOs.");
      }
      if (q.includes("cluster") || q.includes("match")) {
        tips.push("FPO Matching assembles regional FPO clusters when a single FPO can't fulfil your volume. Try 250 MT Onion to see clustering.");
      }
      if (q.includes("window") || q.includes("season")) {
        tips.push("Your Seasonal Procurement Window in the profile is used to match you with FPOs whose harvest windows overlap yours.");
      }
    }

    if (q.includes("voice") || q.includes("listen") || q.includes("speak")) {
      tips.push("Tap the mic to dictate questions; tap the speaker icon on any reply to listen.");
    }
    if (q.includes("switch") || q.includes("logout") || q.includes("role")) {
      tips.push("Use 'Logout' in the top bar to return to the Login screen and pick a different role.");
    }

    if (tips.length === 0) {
      tips.push("I'm a rule-based prototype assistant for the ");
      tips.push(r.toUpperCase());
      tips.push(" view. Try asking about: ");
      tips.push(
        r === "farmer" ? "discover FPOs, benefits, courses, prices"
        : r === "fpo" ? "tiering, bankable proposal, schemes, members, buyer match"
        : "posting demand, FPO clusters, procurement window",
      );
      tips.push(".");
      tips.push("You're currently on ");
      tips.push(screenName);
      tips.push(".");
    }
    return tips;
  }

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    const ans = reply(q);
    setMsgs((m) => [...m, { role: "user", text: [q] }, { role: "bot", text: ans }]);
    setInput("");
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[s.fab, { bottom: insets.bottom + FAB_BOTTOM_OFFSET, backgroundColor: accentColor }]}
        accessibilityLabel={tr("Open FPO Setu Assistant", lang)}
      >
        <MessageCircle size={24} color="#ffffff" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <View style={[s.panel, { marginBottom: insets.bottom + 12, marginTop: insets.top + 40 }]}>
            <View style={[s.header, { backgroundColor: accentColor }]}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700" color="#ffffff">FPO Setu Assistant</Text>
                <Text size="xxs" color="rgba(255,255,255,0.9)">
                  {role ? ["Ask me anything about the app", " · ", role.toUpperCase()] : "Ask me anything about the app"}
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel={tr("Close", lang)}>
                <X size={18} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView ref={scrollRef} style={s.log} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
              {msgs.map((m, i) => (
                <View key={i} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <View style={[
                    s.bubble,
                    m.role === "user" ? { backgroundColor: accentColor } : s.bubbleBot,
                  ]}>
                    <Text
                      size="sm"
                      color={m.role === "user" ? "#ffffff" : colors.foreground}
                      noTranslate={m.role === "user"}
                    >
                      {m.text}
                    </Text>
                    {m.role === "bot" && (
                      <Pressable
                        onPress={() => speak(m.text.map((seg) => tr(seg, lang)).join(""))}
                        style={s.listen}
                        hitSlop={6}
                      >
                        <Volume2 size={12} color={colors.mutedForeground} />
                        <Text size="xxs" color={colors.mutedForeground}>Listen</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={s.composer}>
              <Pressable
                onPress={startListening}
                style={[s.iconBtn, listening && { backgroundColor: accentColor, borderColor: accentColor }]}
                accessibilityLabel={tr("Voice input", lang)}
              >
                {listening
                  ? <MicOff size={16} color="#ffffff" />
                  : <Mic size={16} color={accentColor} />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Input value={input} onChangeText={setInput} placeholder="Ask me anything about the app" />
              </View>
              <Pressable
                onPress={() => send()}
                style={[s.iconBtn, { backgroundColor: accentColor, borderColor: accentColor }]}
                accessibilityLabel={tr("Send", lang)}
              >
                <Send size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 50,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  panel: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: "hidden",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  log: { flex: 1, backgroundColor: colors.mutedBg },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleBot: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  listen: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
});
