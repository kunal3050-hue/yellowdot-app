import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import MainLayout from "../../layouts/MainLayout";

const ROLE_LABELS = {
  super_admin:  "Super Admin",
  center_admin: "Center Admin",
  teacher:      "Teacher",
  parent:       "Parent",
  accountant:   "Accountant",
  cctv_viewer:  "CCTV Viewer",
  reception:    "Reception",
};

export default function Profile() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(user?.name || "");
  const [mobile,  setMobile]  = useState(user?.mobile || "");
  const [saved,   setSaved]   = useState(false);

  function handleSave(e) {
    e.preventDefault();
    // Wire to PATCH /api/users/:id when available
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <MainLayout>
      <div style={styles.page}>
        <div style={styles.inner}>

          {/* Page header */}
          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>My Profile</h1>
            <p style={styles.pageSub}>Manage your account details and preferences.</p>
          </div>

          {/* Avatar + role card */}
          <div style={styles.profileCard}>
            <div style={styles.avatarWrap}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.name} style={styles.avatarImg} />
              ) : (
                <div style={styles.avatar}>{initials}</div>
              )}
              <div style={styles.avatarBadge}>{ROLE_LABELS[user?.role] || user?.role}</div>
            </div>
            <div style={styles.profileInfo}>
              <h2 style={styles.profileName}>{user?.name}</h2>
              <p style={styles.profileEmail}>{user?.email}</p>
              <div style={styles.centerTags}>
                {(user?.centers || []).map(c => (
                  <span key={c} style={styles.centerTag}>
                    {c.replace(/-/g, " ").replace(/\b\w/g, x => x.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} style={styles.editBtn}>
                Edit Profile
              </button>
            )}
          </div>

          {/* Success toast */}
          {saved && (
            <div style={styles.toastSuccess}>
              <span>✓</span> Profile updated successfully.
            </div>
          )}

          {/* Details form */}
          <div style={styles.detailCard}>
            <h3 style={styles.sectionTitle}>Account Information</h3>

            <form onSubmit={handleSave} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Full Name</label>
                  {editing ? (
                    <input
                      className="yd-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div style={styles.value}>{user?.name || "—"}</div>
                  )}
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Mobile Number</label>
                  {editing ? (
                    <input
                      className="yd-input"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      type="tel"
                    />
                  ) : (
                    <div style={styles.value}>{user?.mobile || "—"}</div>
                  )}
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Email Address</label>
                  <div style={{ ...styles.value, color: "var(--yd-text-muted)" }}>{user?.email || "—"}</div>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Role</label>
                  <div style={styles.value}>{ROLE_LABELS[user?.role] || user?.role || "—"}</div>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Assigned Centers</label>
                  <div style={styles.value}>
                    {(user?.centers || []).join(", ") || "—"}
                  </div>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Active Center</label>
                  <div style={styles.value}>{user?.activeCenter || "—"}</div>
                </div>
              </div>

              {editing && (
                <div style={styles.formActions}>
                  <button type="button" onClick={() => setEditing(false)} style={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" style={styles.saveBtn}>
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Security section link */}
          <div style={styles.securityCard}>
            <div style={styles.securityLeft}>
              <div style={styles.securityIcon}>🔒</div>
              <div>
                <h4 style={styles.securityTitle}>Password & Security</h4>
                <p style={styles.securitySub}>Change your password or review active sessions.</p>
              </div>
            </div>
            <a href="/settings/security" style={styles.securityLink}>
              Manage →
            </a>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}

const styles = {
  page: { padding: "32px 32px 48px", maxWidth: 860, margin: "0 auto" },
  inner: { display: "flex", flexDirection: "column", gap: 20 },
  pageHeader: { marginBottom: 4 },
  pageTitle: { fontSize: "var(--yd-font-size-2xl)", fontWeight: "var(--yd-weight-black)", color: "var(--yd-black)", letterSpacing: "-0.025em", marginBottom: 4 },
  pageSub: { fontSize: "var(--yd-font-size-base)", color: "var(--yd-text-soft)" },

  profileCard: {
    background: "var(--yd-surface)", borderRadius: "var(--yd-radius-lg)", border: "1px solid var(--yd-border)",
    boxShadow: "var(--yd-shadow)",
    padding: "28px 28px",
    display: "flex", alignItems: "center", gap: 24,
  },
  avatarWrap: { position: "relative", flexShrink: 0 },
  avatarImg: {
    width: 72, height: 72, borderRadius: 22,
    objectFit: "cover", display: "block",
  },
  avatar: {
    width: 72, height: 72, borderRadius: 22,
    background: "var(--yd-yellow)", color: "var(--yd-black)",
    fontSize: 24, fontWeight: "var(--yd-weight-extra)",
    display: "flex", alignItems: "center", justifyContent: "center",
    letterSpacing: "-0.02em",
  },
  avatarBadge: {
    position: "absolute", bottom: -6, left: "50%",
    transform: "translateX(-50%)",
    background: "var(--yd-black)", color: "var(--yd-yellow)",
    fontSize: 9, fontWeight: "var(--yd-weight-extra)",
    padding: "2px 8px", borderRadius: 20,
    whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: "var(--yd-font-size-xl)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", marginBottom: 4 },
  profileEmail: { fontSize: "var(--yd-font-size-sm)", color: "var(--yd-text-soft)", marginBottom: 10 },
  centerTags: { display: "flex", gap: 6, flexWrap: "wrap" },
  centerTag: {
    background: "var(--yd-yellow-light)", border: "1px solid var(--yd-yellow)",
    borderRadius: "var(--yd-radius-sm)", padding: "3px 10px",
    fontSize: "var(--yd-font-size-xs)", fontWeight: "var(--yd-weight-bold)", color: "var(--yd-black)",
  },
  editBtn: {
    padding: "10px 20px", borderRadius: "var(--yd-radius)", background: "var(--yd-soft)",
    border: "1.5px solid var(--yd-border)", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-bold)",
    color: "var(--yd-text)", cursor: "pointer", flexShrink: 0,
    fontFamily: "var(--yd-font)",
    transition: "var(--yd-transition)",
  },

  toastSuccess: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--yd-success-soft)", border: "1px solid var(--yd-success-border)",
    borderRadius: "var(--yd-radius)", padding: "12px 16px",
    fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-success)",
  },

  detailCard: {
    background: "var(--yd-surface)", borderRadius: "var(--yd-radius-lg)", border: "1px solid var(--yd-border)",
    boxShadow: "var(--yd-shadow)",
    padding: "28px",
  },
  sectionTitle: { fontSize: "var(--yd-font-size-md)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 20 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: "var(--yd-font-size-xs)", fontWeight: "var(--yd-weight-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--yd-text-muted)" },
  value: { fontSize: "var(--yd-font-size-base)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-text)", padding: "4px 0" },
  formActions: { display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 },
  cancelBtn: {
    padding: "10px 20px", borderRadius: "var(--yd-radius)", background: "var(--yd-soft)",
    border: "1.5px solid var(--yd-border)", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-semi)",
    color: "var(--yd-text-soft)", cursor: "pointer", fontFamily: "var(--yd-font)",
  },
  saveBtn: {
    padding: "10px 24px", borderRadius: "var(--yd-radius)", background: "var(--yd-yellow)",
    border: "none", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-extra)",
    color: "var(--yd-black)", cursor: "pointer",
    boxShadow: "var(--yd-shadow-yellow)",
    fontFamily: "var(--yd-font)",
  },

  securityCard: {
    background: "var(--yd-surface)", borderRadius: "var(--yd-radius-lg)", border: "1px solid var(--yd-border)",
    boxShadow: "var(--yd-shadow)",
    padding: "20px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
  },
  securityLeft: { display: "flex", alignItems: "center", gap: 16 },
  securityIcon: {
    width: 44, height: 44, borderRadius: "var(--yd-radius-sm)",
    background: "var(--yd-soft)", border: "1px solid var(--yd-border)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
  },
  securityTitle: { fontSize: "var(--yd-font-size-base)", fontWeight: "var(--yd-weight-bold)", color: "var(--yd-black)", marginBottom: 3 },
  securitySub: { fontSize: "var(--yd-font-size-sm)", color: "var(--yd-text-soft)" },
  securityLink: {
    fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-bold)", color: "var(--yd-black)",
    background: "var(--yd-soft)", border: "1.5px solid var(--yd-border)",
    borderRadius: "var(--yd-radius-sm)", padding: "9px 16px", textDecoration: "none",
    transition: "var(--yd-transition)",
  },
};
