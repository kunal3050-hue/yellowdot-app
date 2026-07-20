/**
 * highlightText.jsx — wraps the portion of `text` matching `query` in
 * <mark>, case-insensitive. Returns `text` unchanged (as a plain string)
 * when there's no query or no match, so callers can use it unconditionally
 * without an extra branch.
 */
export default function highlightText(text, query) {
  if (!query || !text) return text;
  const q = query.trim();
  if (!q) return text;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="qnd-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
