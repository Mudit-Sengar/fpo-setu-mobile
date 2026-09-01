import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Package, Receipt } from "lucide-react-native";
import { orderRepo } from "../db";
import { describeWriteError } from "../db/authz";
import type { OrderRow, OrderStatus } from "../db/repositories/orderRepository";
import { useDbQuery } from "../db/useDbQuery";
import { useApp } from "../lib/app-state";
import { tr } from "../lib/i18n";
import { colors, radius, spacing } from "../theme";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Muted, Text, toast } from "../components/ui";
import { Segmented } from "../components/common";

/**
 * Orders, shared by every persona.
 *
 * One list serves both sides because an order is one row: the seller and the
 * buyer see the same quantities, the same price and the same status, which is the
 * whole reason the order exists rather than each side keeping its own note.
 */

const inr = (n: number) => n.toLocaleString("en-IN");

const STATUS_STYLE: Record<OrderStatus, { fg: string; bg: string; label: string }> = {
  draft:      { fg: colors.mutedForeground, bg: colors.muted,      label: "Draft" },
  confirmed:  { fg: colors.buyer,           bg: colors.buyerSoft,  label: "Confirmed" },
  in_transit: { fg: colors.accent,          bg: "#FDF0E6",         label: "In transit" },
  delivered:  { fg: colors.farmer,          bg: colors.farmerSoft, label: "Delivered" },
  paid:       { fg: "#ffffff",              bg: colors.farmer,     label: "Paid" },
  cancelled:  { fg: colors.mutedForeground, bg: colors.muted,      label: "Cancelled" },
  disputed:   { fg: colors.destructive,     bg: "#FDECEA",         label: "Disputed" },
};

/** What this party can do to the order next, in the words of their own role. */
function actionsFor(o: OrderRow): { to: OrderStatus; label: string }[] {
  switch (o.status) {
    case "confirmed":
      return o.iAmSeller
        ? [{ to: "in_transit", label: "Mark dispatched" }, { to: "delivered", label: "Mark delivered" }]
        : [{ to: "cancelled", label: "Cancel" }];
    case "in_transit":
      return o.iAmSeller ? [{ to: "delivered", label: "Mark delivered" }] : [{ to: "disputed", label: "Raise issue" }];
    case "delivered":
      // Payment is the buyer's to confirm — the seller saying "paid" would be
      // recording money they have not received.
      return o.iAmSeller ? [] : [{ to: "paid", label: "Confirm payment" }];
    default:
      return [];
  }
}

type SettledFilter = "all" | "paid" | "cancelled";

export function OrdersPanel({ accent }: { accent: string }) {
  const { session, lang } = useApp();
  const orders = useDbQuery<OrderRow[]>(() => orderRepo.listMyOrders(session), [session?.partyId], []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [settledFilter, setSettledFilter] = useState<SettledFilter>("all");

  async function advance(o: OrderRow, to: OrderStatus, label: string) {
    if (busyId != null) return;
    setBusyId(o.id);
    try {
      await orderRepo.advance(session, o.id, to);
      toast.success(`${o.orderNo}: ${tr(label, lang).toLowerCase()}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not update that order."));
    } finally {
      setBusyId(null);
    }
  }

  const open = orders.filter((o) => !["paid", "cancelled"].includes(o.status));
  const settled = orders.filter((o) => ["paid", "cancelled"].includes(o.status));
  const settledFiltered = useMemo(
    () => (settledFilter === "all" ? settled : settled.filter((o) => o.status === settledFilter)),
    [settled, settledFilter],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Package size={16} color={accent} />
            <CardTitle>{`${tr("Orders in progress", lang)} (${open.length})`}</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {open.length === 0 && (
            <Muted>No orders in progress. Accepting a reply to a posting creates one.</Muted>
          )}
          {open.map((o) => {
            const style = STATUS_STYLE[o.status];
            return (
              <View key={o.id} style={s.card}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text size="sm" weight="700">
                      {`${o.qty} ${o.unit} ${o.commodity}${o.grade !== "" ? ` · ${tr("Grade", lang)} ${o.grade}` : ""}`}
                    </Text>
                    <Muted>
                      {`${tr(o.iAmSeller ? "To" : "From", lang)} ${o.counterpartyName} · ${o.orderNo}`}
                    </Muted>
                  </View>
                  <Badge color={style.fg} bg={style.bg}>{style.label}</Badge>
                </View>

                {o.totalAmount > 0 && (
                  <Muted style={{ marginTop: 4 }}>
                    {`₹${inr(o.totalAmount)} at ₹${inr(o.pricePerUnit)}/${o.unit}`}
                  </Muted>
                )}

                <View style={s.actions}>
                  {actionsFor(o).map((a) => (
                    <Button key={a.to} size="sm" accent={accent} disabled={busyId === o.id}
                      variant={a.to === "cancelled" || a.to === "disputed" ? "outline" : "default"}
                      onPress={() => advance(o, a.to, a.label)}>
                      {a.label}
                    </Button>
                  ))}
                  {actionsFor(o).length === 0 && (
                    <Muted>
                      {o.status === "delivered" ? "Waiting for the buyer to confirm payment." : "No action needed."}
                    </Muted>
                  )}
                </View>
              </View>
            );
          })}
        </CardContent>
      </Card>

      {settled.length > 0 && (
        <Card>
          <CardHeader>
            <View style={s.titleRow}>
              <Receipt size={16} color={accent} />
              <CardTitle>{`${tr("Completed", lang)} (${settledFiltered.length})`}</CardTitle>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Segmented
                options={["all", "paid", "cancelled"] as const}
                value={settledFilter}
                onChange={setSettledFilter}
                accent={accent}
                labelOf={(v) => (v === "all" ? "All" : v === "paid" ? "Paid" : "Cancelled")}
              />
            </View>
          </CardHeader>
          <CardContent>
            {settledFiltered.length === 0 && <Muted>No completed orders match this filter.</Muted>}
            {/* Capped to roughly 2-3 rows of visible height — the rest scrolls
                instead of pushing the rest of the Inbox down as orders pile up. */}
            <ScrollView style={s.settledScroll} nestedScrollEnabled>
              {settledFiltered.map((o) => (
                <View key={o.id} style={s.settledCard}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text size="sm" numberOfLines={1}>{`${o.qty} ${o.unit} ${o.commodity} · ${o.counterpartyName}`}</Text>
                      <Muted noTranslate>{o.orderNo}</Muted>
                    </View>
                    <Badge color={STATUS_STYLE[o.status].fg} bg={STATUS_STYLE[o.status].bg}>
                      {STATUS_STYLE[o.status].label}
                    </Badge>
                  </View>
                </View>
              ))}
            </ScrollView>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap", alignItems: "center" },
  // ~2-3 rows visible at once (each settledCard is ~64pt tall) — the rest is
  // reached by scrolling inside this box rather than growing the Inbox screen.
  settledScroll: { maxHeight: 200 },
  settledCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.card, padding: spacing.sm, marginBottom: 6,
  },
});
