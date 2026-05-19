export default function ParentLayout({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--yd-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          height: 56,
          borderBottom: "1px solid var(--yd-border)",
          background: "var(--yd-surface)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--yd-yellow)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 13,
            color: "var(--yd-black)",
          }}
        >
          Y
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--yd-charcoal)",
            letterSpacing: "-0.2px",
          }}
        >
          Yellow Dot
        </span>
      </header>
      <div style={{ flex: 1, padding: "24px 24px" }}>{children}</div>
    </div>
  );
}
