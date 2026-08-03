import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BookOpen, Play, Trophy } from "lucide-react-native";
import { FARMER_COURSES, imgSource, type Thumb } from "../../lib/mockData";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Card, CardContent, CardHeader, CardTitle, Chip, ChipRow, Dialog, Muted, Text } from "../../components/ui";
import { EmptyHint, VideoCard } from "../../components/common";

interface V { title: string; duration: string; transcript: string; thumb: Thumb }

const farmerMale = require("../../assets/farmer-male.jpg");
const farmerFemale = require("../../assets/farmer-female.jpg");

// Ported verbatim from the web app's farmer.learn.tsx local STORIES array.
const STORIES: V[] = [
  { title: "Success Story — Ravindra from Akole", duration: "4:08",
    transcript: "Ravindra earned ₹38,000 extra in one season by selling 80 quintals of onion through Samruddha FPO, thanks to grading and direct processor linkage.",
    thumb: farmerMale },
  { title: "Learn from Gayatri Devi from Pune", duration: "3:50",
    transcript: "Gayatri Devi led a women-only FPO in Pune that scaled from 40 to 220 members in 18 months by focusing on vegetables, packaging, and HORECA buyers.",
    thumb: farmerFemale },
];

/** Ported from the web app's src/routes/farmer.learn.tsx */
export function LearnScreen() {
  const nav = useNavigation();
  const [tab, setTab] = useState<null | "courses" | "stories">(null);
  const [open, setOpen] = useState<V | null>(null);

  return (
    <RoleShell accent="farmer" screenName="Learn" onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <ChipRow>
        <Chip label="Courses" accent={colors.farmer} active={tab === "courses"}
          onPress={() => setTab(tab === "courses" ? null : "courses")} />
        <Chip label="Success Stories" accent={colors.farmer} active={tab === "stories"}
          onPress={() => setTab(tab === "stories" ? null : "stories")} />
      </ChipRow>

      {tab === null && <EmptyHint>Tap a button above to begin.</EmptyHint>}

      {tab === "courses" && (
        <Card>
          <CardHeader>
            <CardTitle>Foundational courses · learn about FPOs</CardTitle>
          </CardHeader>
          <CardContent>
            <Muted style={{ marginBottom: spacing.sm }}>Follow the sequence — each course builds on the previous.</Muted>
            <View style={{ gap: spacing.md }}>
              {FARMER_COURSES.map((v, i) => (
                <VideoCard key={v.title} title={v.title} duration={v.duration} thumb={v.thumb}
                  index={i + 1} accent={colors.farmer} onPress={() => setOpen(v)} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {tab === "stories" && (
        <Card>
          <CardHeader><CardTitle>Success stories from FPO members</CardTitle></CardHeader>
          <CardContent>
            <View style={{ gap: spacing.md }}>
              {STORIES.map((v) => (
                <VideoCard key={v.title} title={v.title} duration={v.duration} thumb={v.thumb}
                  accent={colors.farmer} onPress={() => setOpen(v)} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      <Dialog visible={open != null} onClose={() => setOpen(null)} title={open?.title}>
        {open != null && (
          <>
            <View style={s.hero}>
              <Image source={imgSource(open.thumb)} style={s.heroImage} resizeMode="cover" />
              <View style={s.heroOverlay}>
                <Play size={40} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
            <Muted>{open.transcript}</Muted>
          </>
        )}
      </Dialog>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  hero: { height: 180, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.muted },
  heroImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.28)",
  },
});
