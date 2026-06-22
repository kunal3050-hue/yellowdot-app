/**
 * Memories.jsx — DEPRECATED (V1)
 * Redirects to /parent-journey (unified Child Journey timeline, V2).
 * The memories collection was never populated; no data is lost.
 */

import { Navigate } from "react-router-dom";

export default function Memories() {
  return <Navigate to="/parent-journey" replace />;
}
