export { T, pillStyle } from "../attendance/_shared";

export function inr(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
}
export function monthName(m) {
  return new Date(2000, (m || 1) - 1, 1).toLocaleDateString("en-IN", { month: "long" });
}
