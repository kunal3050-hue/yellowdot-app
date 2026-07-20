/**
 * QuickSearch — drives Control Center's live filter. As the user
 * types, the query is lifted to the page (onQueryChange) which passes
 * it down to every ModuleSection — matching cards stay, non-matching
 * ones disappear, matched text highlights, all instantly (no dropdown,
 * no separate results UI to keep in sync with the real grid below).
 *
 * "/" focuses the input. Enter navigates straight to the first match
 * across every category (RBAC-filtered), same order the sections
 * render in. Escape clears the query.
 *
 * Ctrl+K / Cmd+K is deliberately NOT bound here — it's already the
 * app's global command-palette shortcut (see Topbar.jsx). Rebinding it
 * on this page would double-fire both handlers on every other page's
 * navigation shell; "/" is this page's own, non-conflicting shortcut.
 *
 * Student/Parent/Staff record search isn't implemented yet (that's a
 * backend feature) — while a query is active, a small note says so
 * beneath the input rather than pretending those results exist.
 */
import { useEffect, useRef } from "react";
import SearchBar from "../../../components/ui/SearchBar";
import { useAuth } from "../../../contexts/AuthContext";
import { ALL_MODULES } from "../modules";

export default function QuickSearch({ query, onQueryChange, onNavigate }) {
  const { can } = useAuth();
  const inputRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onQueryChange("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onQueryChange]);

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    const first = ALL_MODULES
      .filter(m => !m.routeKey || can(m.routeKey))
      .find(m => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    if (first) onNavigate(first.id, first.path);
  }

  return (
    <div className="qnd-search">
      <div onKeyDown={handleKeyDown}>
        <SearchBar
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onClear={() => onQueryChange("")}
          placeholder="Search students, parents, staff, modules…  (press / to focus)"
          size="lg"
        />
      </div>
      {query.trim() && (
        <p className="qnd-search-note">Searching modules only — student, parent and staff search coming soon.</p>
      )}
    </div>
  );
}
