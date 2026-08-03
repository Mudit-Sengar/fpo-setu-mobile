import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { colors, fontSize } from "../../theme";

/**
 * Drop-in replacement for RN's <Text> that auto-translates string children.
 *
 * This is the React Native equivalent of the web app's DomTranslator: instead of
 * walking DOM text nodes with a MutationObserver, we translate at render time.
 * Each string child is looked up independently — mirroring how the web version
 * translated each DOM Text node separately (so `<Text>Hi {name}</Text>` translates
 * the "Hi " segment and leaves the interpolated value alone, exactly as before).
 */
export interface TextProps extends RNTextProps {
  /** Font size token or explicit number. */
  size?: keyof typeof fontSize | number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  center?: boolean;
  /** Skip translation (for user-entered content that must stay verbatim). */
  noTranslate?: boolean;
}

export function Text({
  children,
  size = "base",
  weight,
  color = colors.foreground,
  center,
  noTranslate,
  style,
  ...rest
}: TextProps) {
  const { lang } = useApp();

  const translate = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") return noTranslate ? node : tr(node, lang);
    if (Array.isArray(node)) return node.map((c, i) => <React.Fragment key={i}>{translate(c)}</React.Fragment>);
    return node;
  };

  const resolvedSize = typeof size === "number" ? size : fontSize[size];

  return (
    <RNText
      style={[
        { fontSize: resolvedSize, color, lineHeight: Math.round(resolvedSize * 1.4) },
        weight ? { fontWeight: weight } : null,
        center ? { textAlign: "center" as const } : null,
        style,
      ]}
      {...rest}
    >
      {translate(children)}
    </RNText>
  );
}

/** Muted secondary text — the web app's `text-muted-foreground` equivalent. */
export function Muted(props: TextProps) {
  return <Text size="xs" color={colors.mutedForeground} {...props} />;
}
