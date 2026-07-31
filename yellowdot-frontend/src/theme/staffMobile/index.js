/**
 * index.js — Staff Mobile · theme barrel
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 *   import { colors, spacing, radius, shadows, typography, layout } from "../../theme/staffMobile";
 *
 * Deliberately duplicated from `src/modules/parent/theme`, not imported
 * from it — see colors.js's header comment. Same shape as that barrel so
 * the two token sets stay structurally comparable.
 */

export { colors, yellow, neutral, success, danger, warning, surface, text, brand } from "./colors";
export { spacing, radius, shadows, touchTarget, layout } from "./spacing";
export { typography, fontFamily, size, weight, lineHeight, tracking, textStyle } from "./typography";

import colors from "./colors";
import spacing, { radius, shadows, touchTarget, layout } from "./spacing";
import typography from "./typography";

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  touchTarget,
  layout,
  typography,
};

export default theme;
