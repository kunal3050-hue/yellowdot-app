/**
 * useChartTokens — reads live KUE BOXS design tokens (CSS custom properties)
 * so Recharts (which needs literal color strings, not var() at the JS layer
 * for some props) always matches the current theme, including dark mode
 * (toggled via the `.dark` class on <html>, per tokens.css).
 */
import { useEffect, useState } from "react";

const TOKEN_NAMES = [
  "--yd-info", "--yd-success", "--yd-warning", "--yd-danger",
  "--yd-yellow", "--yd-navy-3",
  "--yd-text", "--yd-text-soft", "--yd-text-muted",
  "--yd-border", "--yd-border-light", "--yd-surface", "--yd-soft",
];

function readTokens() {
  if (typeof window === "undefined") return {};
  const styles = getComputedStyle(document.documentElement);
  const out = {};
  for (const name of TOKEN_NAMES) {
    out[name] = styles.getPropertyValue(name).trim();
  }
  return out;
}

export default function useChartTokens() {
  const [tokens, setTokens] = useState(readTokens);

  useEffect(() => {
    setTokens(readTokens());
    const observer = new MutationObserver(() => setTokens(readTokens()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setTokens(readTokens());
    mq.addEventListener?.("change", handler);
    return () => {
      observer.disconnect();
      mq.removeEventListener?.("change", handler);
    };
  }, []);

  const palette = [
    tokens["--yd-info"], tokens["--yd-success"], tokens["--yd-warning"],
    tokens["--yd-danger"], tokens["--yd-yellow"], tokens["--yd-navy-3"],
  ].filter(Boolean);

  return {
    tokens,
    palette,
    colorAt: (i) => palette[i % palette.length] || "var(--yd-info)",
    grid: tokens["--yd-border-light"] || "#F1F1F1",
    axisText: tokens["--yd-text-muted"] || "#94A3B8",
    tooltipBg: tokens["--yd-surface"] || "#FFFFFF",
    tooltipBorder: tokens["--yd-border"] || "#E8E8E8",
    text: tokens["--yd-text"] || "#0F172A",
  };
}
