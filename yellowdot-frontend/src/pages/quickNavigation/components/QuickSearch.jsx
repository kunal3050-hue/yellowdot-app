/**
 * QuickSearch — search-as-you-type across the Quick Navigation
 * Dashboard. Wraps the shared SearchBar for consistent input styling;
 * adds a "/" keyboard shortcut to focus and a grouped results dropdown
 * that navigates on click or Enter.
 *
 * "Modules" results are real and RBAC-filtered (a module the user can't
 * access never appears). Students/Parents/Staff are shown as a
 * dedicated, clearly-disabled group — this UI is prepared for global
 * search across those record types, but no student/parent/staff data
 * is fetched or searched yet (that's a backend feature, out of scope
 * for this navigation-page pass).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import SearchBar from "../../../components/ui/SearchBar";
import { useAuth } from "../../../contexts/AuthContext";
import { ALL_MODULES } from "../modules";

const COMING_SOON_GROUPS = ["Students", "Parents", "Staff"];

export default function QuickSearch({ onNavigate }) {
  const { can } = useAuth();
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);

  // "/" focuses search — ignored while typing in another field
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_MODULES
      .filter(m => !m.routeKey || can(m.routeKey))
      .filter(m => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.sectionLabel.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, can]);

  function handleSelect(module) {
    setQuery("");
    setOpen(false);
    onNavigate(module.id, module.path);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && results[0]) handleSelect(results[0]);
  }

  return (
    <div className="qnd-search" ref={wrapRef}>
      <div onKeyDown={handleKeyDown}>
        <SearchBar
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onClear={() => { setQuery(""); setOpen(false); }}
          placeholder="Search modules, students, parents, staff…  (press / to focus)"
          size="lg"
        />
      </div>

      {open && query && (
        <div className="qnd-search-results" role="listbox">
          <div className="qnd-search-group">
            <div className="qnd-search-group-label">Modules</div>
            {results.length === 0 ? (
              <div className="qnd-search-empty">No modules match "{query}"</div>
            ) : (
              results.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="qnd-search-item"
                    role="option"
                    onClick={() => handleSelect(m)}
                  >
                    <span className="qnd-search-item-icon"><Icon size={16} strokeWidth={1.75} /></span>
                    <span className="qnd-search-item-text">
                      <span className="qnd-search-item-label">{m.label}</span>
                      <span className="qnd-search-item-section">{m.sectionLabel}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {COMING_SOON_GROUPS.map(group => (
            <div className="qnd-search-group qnd-search-group--soon" key={group}>
              <div className="qnd-search-group-label">{group}</div>
              <div className="qnd-search-item qnd-search-item--soon">
                <span className="qnd-search-item-icon"><Search size={16} strokeWidth={1.75} /></span>
                <span className="qnd-search-item-text">
                  <span className="qnd-search-item-label">{group} search coming soon</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
