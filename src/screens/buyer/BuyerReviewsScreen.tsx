import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { FPOS, SUPPLIERS } from "../../lib/mockData";
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
  const [targetId, setTargetId] = useState<string>(FPOS[0].id);
  const [scores, setScores] = useState({ quality: 5, delivery: 4, communication: 5 });
  const [note, setNote] = useState("Excellent grading, smooth coordination via anchor FPO.");

  function changeMode(m: Mode) {
    setMode(m);
    setTargetId(m === "buyer" ? FPOS[0].id : SUPPLIERS[0].id);
  }

  const targets = mode === "buyer" ? FPOS : SUPPLIERS;
  const nameOf = (id: string) => targets.find((t) => t.id === id)?.name ?? id;

  return (
    <RoleShell accent="buyer" screenName="Reviews & Feedback" header={<Stepper />}>
      <ModeToggle mode={mode} setMode={changeMode} />

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
            onPress={() => toast.success("Review submitted. Reputation updated.")}>
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
