import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { orderRepo, reviewRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { OrderRow } from "../../db/repositories/orderRepository";
import type { ReviewRow } from "../../db/repositories/reviewRepository";
import { useDbQuery } from "../../db/useDbQuery";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Muted, Select, StarRating, Text, toast,
} from "../../components/ui";
import { ModeToggle, Stepper } from "../../features/buyer-shared";
import { OrdersPanel } from "../../features/orders";

/**
 * Ported from the web app's src/routes/buyer.reviews.tsx.
 *
 * The target used to be a dropdown of every FPO (or every supplier) in the
 * database, so a buyer could rate an organisation they had never dealt with, over
 * and over. It is now the list of this account's own delivered orders — a review
 * is about a trade that happened, and the counterparty comes from the order
 * rather than from a picker.
 */
export function BuyerReviewsScreen() {
  const { session, lang } = useApp();
  const reviewable = useDbQuery<OrderRow[]>(
    () => orderRepo.listReviewableOrders(session), [session?.partyId], []);
  const mine = useDbQuery<ReviewRow[]>(
    () => reviewRepo.listMyReviews(session), [session?.partyId], []);

  const [orderId, setOrderId] = useState<string>("");
  const [scores, setScores] = useState({ quality: 5, delivery: 4, communication: 5 });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Default to the first reviewable order once the list loads, and drop the
  // selection when that order is no longer reviewable.
  useEffect(() => {
    const stillThere = reviewable.some((o) => String(o.id) === orderId);
    if (!stillThere) setOrderId(reviewable[0] != null ? String(reviewable[0].id) : "");
  }, [reviewable, orderId]);

  const selected = reviewable.find((o) => String(o.id) === orderId) ?? null;

  const labelOf = (id: string) => {
    const o = reviewable.find((x) => String(x.id) === id);
    return o == null ? id : `${o.counterpartyName} · ${o.qty} ${o.unit} ${o.commodity}`;
  };

  async function submit() {
    if (selected == null || busy) return;
    setBusy(true);
    try {
      await reviewRepo.submit(session, {
        orderId: selected.id,
        quality: scores.quality,
        delivery: scores.delivery,
        communication: scores.communication,
        note: note.trim() === "" ? null : note.trim(),
      });
      setNote("");
      toast.success(`${tr("Review of", lang)} ${selected.counterpartyName} ${tr("submitted.", lang)}`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not submit that review."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleShell accent="buyer" screenName="Reviews & Feedback" header={<Stepper />}>
      <ModeToggle />

      <Card>
        <CardHeader>
          <CardTitle>Rate a completed order</CardTitle>
          <Muted>You can review a counterparty once an order with them has been delivered.</Muted>
        </CardHeader>
        <CardContent>
          {reviewable.length === 0 && (
            <Muted>
              Nothing to review yet. Once an order reaches delivered, it appears here.
            </Muted>
          )}

          {reviewable.length > 0 && (
            <>
              <Field label="Order">
                <Select
                  value={orderId}
                  options={reviewable.map((o) => String(o.id))}
                  onChange={setOrderId}
                  labelOf={labelOf}
                />
              </Field>

              {(["quality", "delivery", "communication"] as const).map((k) => (
                <View key={k} style={s.starBox}>
                  <Muted style={{ textTransform: "capitalize", marginBottom: 6 }}>{k}</Muted>
                  <StarRating value={scores[k]} onChange={(v) => setScores((p) => ({ ...p, [k]: v }))} />
                </View>
              ))}

              <Field label="Notes">
                <Input value={note} onChangeText={setNote} multiline numberOfLines={3}
                  placeholder="How did the trade go?" />
              </Field>

              <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }}
                disabled={busy || selected == null} onPress={submit}>
                {busy ? "Submitting…" : "Submit review"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {mine.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Reviews you have written</CardTitle></CardHeader>
          <CardContent>
            {mine.map((r) => (
              <View key={r.id} style={s.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="600">
                    {r.commodity !== "" ? `${r.qty} ${r.unit} ${r.commodity}` : "Earlier rating"}
                  </Text>
                  {r.note !== "" && <Muted>{`"${r.note}"`}</Muted>}
                </View>
                <Badge color={colors.buyer} bg={colors.buyerSoft} >
                  {`${((r.quality + r.delivery + r.communication) / 3).toFixed(1)}★`}
                </Badge>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      <OrdersPanel accent={colors.buyer} />
    </RoleShell>
  );
}

const s = StyleSheet.create({
  starBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  reviewRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginBottom: spacing.sm,
  },
});
