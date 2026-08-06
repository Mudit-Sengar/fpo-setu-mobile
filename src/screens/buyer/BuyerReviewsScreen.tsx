import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fpoRepo, marketRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { FPO, Supplier } from "../../db/types";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Muted, Select, StarRating, toast,
} from "../../components/ui";
import { ModeToggle, Stepper, type Mode } from "../../features/buyer-shared";

/** Ported from the web app's src/routes/buyer.reviews.tsx */
export function BuyerReviewsScreen() {
  const [mode, setMode] = useState<Mode>("buyer");
  const [fpos] = useDbQuery<FPO[]>(() => fpoRepo.listFpos(), [], []);
  const [suppliers] = useDbQuery<Supplier[]>(() => marketRepo.listSuppliers(), [], []);
  const [targetId, setTargetId] = useState<string>("");
  const [scores, setScores] = useState({ quality: 5, delivery: 4, communication: 5 });
  const [note, setNote] = useState("Excellent grading, smooth coordination via anchor FPO.");

  const targets = mode === "buyer" ? fpos : suppliers;

  // Default the selection to the first option once the lists load (or when the
  // mode flips) — the target lists are async now, so this can't be a useState init.
  useEffect(() => {
    setTargetId(targets[0]?.id ?? "");
  }, [mode, targets]);

  const nameOf = (id: string) => targets.find((t) => t.id === id)?.name ?? id;

  return (
    <RoleShell accent="buyer" screenName="Reviews & Feedback" header={<Stepper />}>
      <ModeToggle mode={mode} setMode={setMode} />

      <Card>
        <CardHeader><CardTitle>Rate your transaction</CardTitle></CardHeader>
        <CardContent>
          <Field label={mode === "buyer" ? "FPO / Cluster anchor" : "Input Supplier"}>
            <Select
              value={targetId}
              options={targets.map((t) => t.id)}
              onChange={setTargetId}
              labelOf={nameOf}
            />
          </Field>

          {(["quality", "delivery", "communication"] as const).map((k) => (
            <View key={k} style={s.starBox}>
              <Muted style={{ textTransform: "capitalize", marginBottom: 6 }}>{k}</Muted>
              <StarRating value={scores[k]} onChange={(v) => setScores((p) => ({ ...p, [k]: v }))} />
            </View>
          ))}

          <Field label="Notes">
            <Input value={note} onChangeText={setNote} multiline numberOfLines={3} />
          </Field>

          <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }}
            onPress={async () => {
              // Reviews are now persisted — previously this was a toast only.
              await marketRepo.insertReview({
                targetId,
                targetType: mode === "buyer" ? "fpo" : "supplier",
                quality: scores.quality,
                delivery: scores.delivery,
                communication: scores.communication,
                note,
              });
              toast.success("Review submitted. Reputation updated.");
            }}>
            Submit review
          </Button>
        </CardContent>
      </Card>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  starBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
});
