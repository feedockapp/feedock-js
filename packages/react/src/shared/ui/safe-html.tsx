import type { CSSProperties } from "react";

/**
 * Render rich text returned by the Feedock public API. The API sanitizes every
 * HTML body server-side (and entity-escapes plain-text bodies), so the string
 * is already safe to inject — this is the intended render path.
 */
export function SafeHtml({
  html,
  style,
}: {
  html: string;
  style?: CSSProperties;
}) {
  // fd-rich lets the widget's shadow stylesheet (and embedders) tame the UA's
  // default paragraph margins inside rich-text bodies.
  return (
    <div
      className="fd-rich"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
