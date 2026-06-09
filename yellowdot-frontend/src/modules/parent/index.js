/**
 * Parent Module — public surface (V1)
 * ──────────────────────────────────────────────────────────────────
 * Everything parent-related lives under src/modules/parent/.
 * Import the module's pieces from here:
 *
 *   import { ParentLayout, parentRoutes, parentService, theme } from "../modules/parent";
 */

export { default as ParentLayout } from "./components/ParentLayout";
export { parentRoutes } from "./routes/parentRoutes";
export { default as parentService } from "./services/parentService";
export { default as useParentProfile } from "./hooks/useParentProfile";
export { default as useNotifications, useUnreadCount } from "./hooks/useNotifications";
export { theme } from "./theme";
