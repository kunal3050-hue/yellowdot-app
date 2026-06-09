/**
 * FoodMenu.jsx — Parent Module · Daily Care · Food Menu (read-only)
 * ──────────────────────────────────────────────────────────────────
 * View today's menu (grouped by meal) and browse previous days.
 * Reuses the staff-managed foodMenus collection via GET /api/parent/food-menu.
 * Theme tokens only.
 */

import { useState } from "react";
import useFoodMenu from "../hooks/useFoodMenu";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MEAL_EMOJI = {
  "Breakfast": "🍳", "Mid-Morning": "🥤", "Roti Sabzi": "🫓",
  "Dal Rice": "🍛", "Milk": "🥛", "Snacks": "🍪",
};

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FoodMenu() {
  const [date, setDate] = useState(undefined); // undefined → latest from API
  const { data, loading, error } = useFoodMenu(date);

  const meals = data?.meals || [];
  const availableDates = data?.availableDates || [];
  const shownDate = data?.date;
  const isToday = shownDate === todayISO();

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Food Menu</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          {shownDate ? `${isToday ? "Today · " : ""}${fmtDate(shownDate)}` : "What's on the plate 🍽️"}
        </p>
      </header>

      {/* Date selector (previous menus) */}
      {availableDates.length > 1 && (
        <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
          {availableDates.map(d => {
            const sel = d === shownDate;
            return (
              <button key={d} onClick={() => setDate(d)} style={{
                ...typography.caption, flexShrink: 0,
                padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.pill, cursor: "pointer",
                fontWeight: typography.weight.bold,
                color: sel ? colors.text.onYellow : colors.text.secondary,
                background: sel ? colors.brand.gradient : colors.surface.card,
                border: `1px solid ${sel ? "transparent" : colors.surface.border}`,
                boxShadow: sel ? shadows.primary : "none",
              }}>
                {d === todayISO() ? "Today" : fmtDate(d)}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorNote message={error} />
      ) : meals.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {meals.map(meal => (
            <div key={meal.mealType} style={{
              background: colors.surface.card, borderRadius: radius.card,
              boxShadow: shadows.card, padding: spacing.lg,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}>
                <span style={{
                  width: 40, height: 40, borderRadius: radius.md,
                  background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                }}>{MEAL_EMOJI[meal.mealType] || "🍽️"}</span>
                <span style={{ ...typography.title, color: colors.text.primary }}>{meal.mealType}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, paddingLeft: 52 }}>
                {meal.items.map((it, i) => (
                  <div key={i} style={{ ...typography.body, color: colors.text.secondary }}>
                    {it.itemName}{it.unitType ? <span style={{ color: colors.text.faint }}> · {it.unitType}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div style={{
      background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card,
      padding: `${spacing["3xl"]}px ${spacing.xl}px`, textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: radius.pill, background: colors.brand.gradient,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
        margin: `0 auto ${spacing.lg}px`, boxShadow: shadows.primary,
      }}>🍽️</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>No menu yet</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
        The food menu for this day hasn't been published.
      </p>
    </div>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body, color: colors.dangerStrong, background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: spacing.lg,
    }}>{message}</div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <div style={{ height: 14, width: "40%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.md }} />
      <div style={{ height: 11, width: "70%", borderRadius: radius.sm, background: colors.gray100 }} />
    </div>
  );
}
