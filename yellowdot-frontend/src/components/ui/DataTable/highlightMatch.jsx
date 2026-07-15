/**
 * highlightMatch.jsx — wraps matches of `query` inside `text` in <mark>
 * Used for instant-search match highlighting in table cells and mobile cards.
 */
export default function highlightMatch(text, query) {
  if (!query || text == null) return text;
  const str = String(text);
  const q = String(query).trim();
  if (!q) return str;

  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return str;

  return (
    <>
      {str.slice(0, idx)}
      <mark className="yd-dt-highlight">{str.slice(idx, idx + q.length)}</mark>
      {str.slice(idx + q.length)}
    </>
  );
}
