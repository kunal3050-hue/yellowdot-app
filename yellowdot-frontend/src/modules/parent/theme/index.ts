/**
 * ═══════════════════════════════════════════════════════════════════
 * YELLOW DOT — PARENT MODULE · THEME BARREL
 * ═══════════════════════════════════════════════════════════════════
 *
 * The one import every Parent Module screen should use:
 *
 *   import { colors, spacing, radius, shadows, typography } from "../theme";
 *
 * Rule: components consume theme tokens only. Never hardcode colours,
 * font sizes, radii or shadows in a Parent Module component.
 * ═══════════════════════════════════════════════════════════════════
 */

export { colors, yellow, neutral, success, danger, warning, surface, text, brand } from "./colors";
export { spacing, radius, shadows, touchTarget, layout } from "./spacing";
export { typography, fontFamily, size, weight, lineHeight, tracking, textStyle } from "./typography";

import colors from "./colors";
import spacing, { radius, shadows, touchTarget, layout } from "./spacing";
import typography from "./typography";

// Combined theme object for ergonomic single-import access:
//   import theme from "../theme"; theme.colors.yellow500
export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  touchTarget,
  layout,
  typography,
} as const;

export type Theme = typeof theme;
export default theme;
