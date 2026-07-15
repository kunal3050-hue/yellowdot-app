/**
 * groupByDate.js — shared "Today / Yesterday / This Week / Older" bucketing
 * Used by Timeline and ActivityFeed. Assumes items are already sorted
 * newest-first; preserves that order within each bucket.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function bucketLabel(timestamp) {
  const date = new Date(timestamp);
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today - target) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return "This Week";
  return "Older";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This Week", "Older"];

/** Groups items (each must have a `timestamp`) into ordered buckets. */
export default function groupByDate(items, getTimestamp = (i) => i.timestamp) {
  const buckets = {};
  for (const item of items) {
    const label = bucketLabel(getTimestamp(item));
    (buckets[label] ??= []).push(item);
  }
  return BUCKET_ORDER
    .filter(label => buckets[label]?.length)
    .map(label => ({ label, items: buckets[label] }));
}
