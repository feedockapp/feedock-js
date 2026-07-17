import { useEffect, useRef, type CSSProperties } from "react";

import { useFeedockContext } from "../../context";
import { colorizeCodeBlocks } from "../lib/code-theme";

/**
 * Render rich text returned by the Feedock public API. The API sanitizes every
 * HTML body server-side (and entity-escapes plain-text bodies), so the string
 * is already safe to inject — this is the intended render path.
 *
 * Code blocks arrive already highlighted (inert hljs-* spans); since the SDK is
 * stylesheet-free, `colorizeCodeBlocks` sets the token colours + code surface
 * inline after render, in the SDK's resolved light/dark mode. No highlighter JS.
 */
export function SafeHtml({
  html,
  style,
}: {
  html: string;
  style?: CSSProperties;
}) {
  const { theme } = useFeedockContext();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      colorizeCodeBlocks(ref.current, theme);
    }
  }, [html, theme]);
  // fd-rich lets the widget's shadow stylesheet (and embedders) tame the UA's
  // default paragraph margins inside rich-text bodies.
  return (
    <div
      ref={ref}
      className="fd-rich"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
