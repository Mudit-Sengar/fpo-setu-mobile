/**
 * Replacements for the two `recharts` charts the web app used:
 *   - LineChart  -> farmer market insights (FPO vs APMC, daily APMC series)
 *   - BarChart   -> FPO "Cumulative FPO profile" crop-wise acreage
 *
 * recharts renders to DOM SVG and cannot run in RN, so these are hand-rolled on
 * react-native-svg. Colours come from the same chart palette as the web tokens.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../theme";
import { Text } from "./ui/Text";

const PAD_L = 44;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 26;

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: number[];
}

export function LineChart({
  labels,
  series,
  height = 200,
  width = 320,
  yTickCount = 4,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  width?: number;
  yTickCount?: number;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0 || labels.length === 0) return null;

  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  // Pad the domain a little so lines don't sit flat on the axes.
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.1);
  const min = Math.max(0, rawMin - span * 0.12);
  const max = rawMax + span * 0.12;

  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;

  const x = (i: number) => PAD_L + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH - ((v - min) / (max - min)) * plotH;

  const ticks = Array.from({ length: yTickCount + 1 }, (_, i) => min + ((max - min) * i) / yTickCount);

  // Show at most ~6 x-axis labels so they don't overlap on a phone.
  const step = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={PAD_L} y1={y(t)} x2={width - PAD_R} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            <SvgText x={PAD_L - 6} y={y(t) + 3} fontSize={9} fill={colors.mutedForeground} textAnchor="end">
              {Math.round(t).toString()}
            </SvgText>
          </G>
        ))}

        {labels.map((l, i) =>
          i % step === 0 ? (
            <SvgText key={i} x={x(i)} y={height - 8} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">
              {l}
            </SvgText>
          ) : null,
        )}

        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p).toFixed(2)}`)
            .join(" ");
          return (
            <G key={s.key}>
              <Path d={d} stroke={s.color} strokeWidth={2} fill="none" />
              {s.points.length <= 12 &&
                s.points.map((p, i) => (
                  <Circle key={i} cx={x(i)} cy={y(p)} r={2.5} fill={s.color} />
                ))}
            </G>
          );
        })}
      </Svg>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </View>
  );
}

export function BarChart({
  labels,
  values,
  height = 200,
  width = 320,
  color = colors.chart1,
}: {
  labels: string[];
  values: number[];
  height?: number;
  width?: number;
  color?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values) * 1.12 || 1;
  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / values.length;
  const barW = Math.min(38, slot * 0.6);

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const yy = PAD_T + plotH - f * plotH;
          return (
            <G key={i}>
              <Line x1={PAD_L} y1={yy} x2={width - PAD_R} y2={yy} stroke={colors.border} strokeWidth={1} />
              <SvgText x={PAD_L - 6} y={yy + 3} fontSize={9} fill={colors.mutedForeground} textAnchor="end">
                {Math.round(max * f).toString()}
              </SvgText>
            </G>
          );
        })}
        {values.map((v, i) => {
          const h = (v / max) * plotH;
          const cx = PAD_L + slot * i + slot / 2;
          return (
            <G key={i}>
              <Rect x={cx - barW / 2} y={PAD_T + plotH - h} width={barW} height={h} rx={4} fill={color} />
              <SvgText x={cx} y={height - 8} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">
                {labels[i]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 4 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: it.color }} />
          <Text size="xxs" color={colors.mutedForeground}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
