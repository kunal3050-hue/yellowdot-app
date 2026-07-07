/**
 * ReleasesDashboard.jsx — Staged Release Dashboard
 *
 * Shows the full module pipeline: Development → Testing → Production.
 * Allows developer / super_admin to promote modules and roll back releases.
 * Every action is logged to the Firestore releaseAudits collection.
 *
 * Mounted inside Settings → "Staged Releases" (developer-only section).
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/ui';
import { getModules, promoteModule, rollbackModule, getAuditLog } from '../../services/releaseService';
import { APP_VERSION, currentEnvMeta } from '../../config/environment';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ic = { w: 16, h: 16, fill: 'none', stroke: 'currentColor', sw: '1.75', lc: 'round', lj: 'round' };
const svg = (d) => (
  <svg width={ic.w} height={ic.h} viewBox="0 0 24 24" fill={ic.fill}
    stroke={ic.stroke} strokeWidth={ic.sw} strokeLinecap={ic.lc} strokeLinejoin={ic.lj}>{d}</svg>
);

const Icons = {
  Rocket:      () => svg(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l5.5-5.5-8-3L4.5 16.5z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>),
  ArrowUp:     () => svg(<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>),
  ArrowDown:   () => svg(<><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>),
  RotateCcw:   () => svg(<><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 101.85-3.82L1 10"/></>),
  CheckCircle: () => svg(<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
  Clock:       () => svg(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  Code:        () => svg(<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>),
  ChevronDown: () => svg(<polyline points="6 9 12 15 18 9"/>),
  ChevronUp:   () => svg(<polyline points="18 15 12 9 6 15"/>),
  Info:        () => svg(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>),
  User:        () => svg(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  Package:     () => svg(<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>),
  AlertTriangle: () => svg(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  RefreshCw:   () => svg(<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>),
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  production:  { label: 'Production',  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: 'CheckCircle' },
  testing:     { label: 'Testing',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: 'Clock'        },
  development: { label: 'Development', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: 'Code'         },
};

const ACTION_META = {
  promote:  { label: 'Promoted to Production', color: '#059669', bg: '#ECFDF5' },
  rollback: { label: 'Rolled Back',            color: '#EF4444', bg: '#FEF2F2' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.development;
  const I = Icons[m.icon];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <I /> {m.label}
    </span>
  );
}

function VersionPill({ version }) {
  if (!version) return <span style={{ fontSize: 11, color: 'var(--yd-text-muted)' }}>—</span>;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 4,
      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
      background: 'var(--yd-surface)', color: 'var(--yd-text-muted)',
      border: '1px solid var(--yd-border-light)',
    }}>
      v{version}
    </span>
  );
}

function SummaryCard({ count, label, color, bg, border }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 100,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function ModuleCard({ mod, onPromote, onRollback }) {
  const canPromote  = mod.status === 'testing';
  const canRollback = mod.status === 'production';

  return (
    <div style={{
      background: 'var(--yd-card)',
      border: '1px solid var(--yd-border-light)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--yd-text)' }}>{mod.name}</span>
            <VersionPill version={mod.version} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--yd-text-muted)', marginTop: 3 }}>{mod.description}</div>
        </div>
        <StatusPill status={mod.status} />
      </div>

      {/* Promotion info */}
      {mod.promotedAt && (
        <div style={{ fontSize: 11, color: 'var(--yd-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icons.User />
          Promoted by <strong style={{ color: 'var(--yd-text)' }}>{mod.promotedByName || mod.promotedByEmail || '—'}</strong>
          &nbsp;· {fmtDateShort(mod.promotedAt)}
        </div>
      )}

      {/* Rollback info */}
      {mod.rolledBackAt && (
        <div style={{ fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icons.RotateCcw />
          Rolled back {fmtDateShort(mod.rolledBackAt)}
          {mod.rollbackReason && <> — {mod.rollbackReason}</>}
        </div>
      )}

      {/* Release note */}
      {mod.releaseNote && (
        <div style={{
          fontSize: 11, color: 'var(--yd-text-muted)',
          background: 'var(--yd-surface)', borderRadius: 6, padding: '5px 9px',
          borderLeft: '2px solid var(--yd-border)',
        }}>
          {mod.releaseNote}
        </div>
      )}

      {/* Actions */}
      {(canPromote || canRollback) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {canPromote && (
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              onClick={() => onPromote(mod)}
            >
              <Icons.Rocket /> Promote to Production
            </button>
          )}
          {canRollback && (
            <button
              className="btn btn-ghost btn-sm"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                color: '#EF4444', borderColor: '#FECACA',
              }}
              onClick={() => onRollback(mod)}
            >
              <Icons.RotateCcw /> Rollback
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StageSection({ title, status, modules, onPromote, onRollback, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const m = STATUS_META[status];
  const I = Icons[m.icon];

  return (
    <div style={{
      border: `1px solid ${m.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Stage header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: m.bg, border: 'none', cursor: 'pointer',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: m.color }}><I /></span>
          <span style={{ fontWeight: 700, fontSize: 13, color: m.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
            background: m.color, color: '#fff',
          }}>
            {modules.length}
          </span>
        </div>
        <span style={{ color: m.color }}>
          {open ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </span>
      </button>

      {/* Module grid */}
      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 10,
          padding: 14,
          background: 'var(--yd-background)',
        }}>
          {modules.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0', color: 'var(--yd-text-muted)', fontSize: 13 }}>
              No modules in this stage.
            </div>
          ) : (
            modules.map(mod => (
              <ModuleCard key={mod.moduleKey} mod={mod} onPromote={onPromote} onRollback={onRollback} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PromoteModal({ mod, onClose, onConfirm, loading }) {
  const [releaseNote, setReleaseNote] = useState('');
  const [version, setVersion]         = useState(mod?.version || APP_VERSION);

  if (!mod) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--yd-card)', borderRadius: 14,
        width: '100%', maxWidth: 480, padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#059669' }}><Icons.Rocket /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--yd-text)' }}>
              Promote to Production
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--yd-text-muted)' }}>
            You are promoting <strong>{mod.name}</strong> from Yellow Dot (Development) to KUE BOXS Care (Production).
          </p>
        </div>

        {/* Version */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--yd-text-muted)', marginBottom: 5 }}>
            Version
          </label>
          <input
            className="yd-input"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="e.g. 1.2.0"
          />
        </div>

        {/* Release note */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--yd-text-muted)', marginBottom: 5 }}>
            Release Note
          </label>
          <textarea
            className="yd-input"
            value={releaseNote}
            onChange={e => setReleaseNote(e.target.value)}
            placeholder="Briefly describe what this release includes…"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Next-steps callout */}
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
          padding: '10px 12px', marginBottom: 20,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }}><Icons.Info /></span>
          <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
            <strong>Next steps after confirming:</strong>
            <ol style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              <li>Open <code>src/config/featureFlags.js</code> and set <code>{mod.moduleKey}: true</code></li>
              <li>Run <code>npm run build:production</code> and deploy to Railway</li>
            </ol>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onConfirm({ releaseNote, version })}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {loading ? 'Promoting…' : <><Icons.Rocket /> Confirm Promotion</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function RollbackModal({ mod, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('');

  if (!mod) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--yd-card)', borderRadius: 14,
        width: '100%', maxWidth: 440, padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#EF4444' }}><Icons.AlertTriangle /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--yd-text)' }}>
              Roll Back Release
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--yd-text-muted)' }}>
            This will move <strong>{mod.name}</strong> back to Testing status and log the rollback with your user details.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--yd-text-muted)', marginBottom: 5 }}>
            Reason for Rollback
          </label>
          <textarea
            className="yd-input"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Describe the issue that requires rollback…"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
          padding: '10px 12px', marginBottom: 20,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }}><Icons.Info /></span>
          <div style={{ fontSize: 11, color: '#991B1B', lineHeight: 1.5 }}>
            <strong>Remember:</strong> Also flip <code>{mod.moduleKey}</code> back to <code>isPreProduction</code> in <code>featureFlags.js</code> and rebuild.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-sm"
            onClick={() => onConfirm({ reason })}
            disabled={loading}
            style={{
              background: '#EF4444', color: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {loading ? 'Rolling back…' : <><Icons.RotateCcw /> Confirm Rollback</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditLog({ log, loading }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? log : log.slice(0, 10);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--yd-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icons.Package /> Release Audit Log
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
          background: 'var(--yd-surface)', color: 'var(--yd-text-muted)',
          border: '1px solid var(--yd-border-light)',
        }}>
          {log.length}
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--yd-text-muted)', fontSize: 13 }}>Loading audit log…</div>
      ) : log.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '24px', color: 'var(--yd-text-muted)',
          fontSize: 13, background: 'var(--yd-surface)', borderRadius: 10,
          border: '1px solid var(--yd-border-light)',
        }}>
          No release events recorded yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map(entry => {
              const am = ACTION_META[entry.action] || ACTION_META.promote;
              return (
                <div key={entry.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: 'var(--yd-card)', border: '1px solid var(--yd-border-light)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  {/* Action badge */}
                  <span style={{
                    flexShrink: 0, display: 'inline-block', padding: '2px 8px',
                    borderRadius: 4, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: am.bg, color: am.color, marginTop: 1,
                  }}>
                    {entry.action === 'promote' ? '↑ Promoted' : '↓ Rolled Back'}
                  </span>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yd-text)' }}>
                      {entry.moduleName}
                      {entry.version && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--yd-text-muted)', marginLeft: 6 }}>
                          v{entry.version}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--yd-text-muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                      <span>
                        {entry.fromStatus} → {entry.toStatus}
                      </span>
                      <span>
                        {entry.performedByName || entry.performedByEmail || entry.performedBy}
                      </span>
                      <span>{fmtDate(entry.timestamp)}</span>
                    </div>
                    {(entry.releaseNote || entry.rollbackReason) && (
                      <div style={{ fontSize: 11, color: 'var(--yd-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                        {entry.releaseNote || entry.rollbackReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {log.length > 10 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10, width: '100%' }}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'Show less' : `Show all ${log.length} events`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Pipeline header ────────────────────────────────────────────────────────────

function PipelineHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 10,
      background: 'var(--yd-surface)', border: '1px solid var(--yd-border-light)',
      marginBottom: 20, fontSize: 12, fontWeight: 600, color: 'var(--yd-text-muted)',
    }}>
      <span style={{
        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: STATUS_META.development.bg, color: STATUS_META.development.color,
        border: `1px solid ${STATUS_META.development.border}`,
      }}>
        Development
      </span>
      <span style={{ color: 'var(--yd-border)' }}>──►</span>
      <span style={{
        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: STATUS_META.testing.bg, color: STATUS_META.testing.color,
        border: `1px solid ${STATUS_META.testing.border}`,
      }}>
        Testing
      </span>
      <span style={{ color: 'var(--yd-border)' }}>──►</span>
      <span style={{
        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: STATUS_META.production.bg, color: STATUS_META.production.color,
        border: `1px solid ${STATUS_META.production.border}`,
      }}>
        Production
      </span>
      <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
        Yellow Dot (Development) → KUE BOXS Care (Production)
      </span>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function ReleasesDashboard() {
  const { show: toast } = useToast();

  const [modules,      setModules]      = useState([]);
  const [auditLog,     setAuditLog]     = useState([]);
  const [loadingMods,  setLoadingMods]  = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [promoteTarget,  setPromoteTarget]  = useState(null);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  const fetchModules = useCallback(async () => {
    setLoadingMods(true);
    try {
      setModules(await getModules());
    } catch {
      toast('Failed to load modules', 'error');
    } finally {
      setLoadingMods(false);
    }
  }, [toast]);

  const fetchAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      setAuditLog(await getAuditLog({ limit: 100 }));
    } catch {
      // audit log is non-critical — fail silently
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
    fetchAudit();
  }, [fetchModules, fetchAudit]);

  // Grouped modules
  const byStatus = {
    production:  modules.filter(m => m.status === 'production'),
    testing:     modules.filter(m => m.status === 'testing'),
    development: modules.filter(m => m.status === 'development'),
  };

  async function handlePromoteConfirm({ releaseNote, version }) {
    if (!promoteTarget) return;
    setActionLoading(true);
    try {
      await promoteModule({ moduleKey: promoteTarget.moduleKey, releaseNote, version });
      toast(`${promoteTarget.name} promoted to production`, 'success');
      setPromoteTarget(null);
      await Promise.all([fetchModules(), fetchAudit()]);
    } catch (err) {
      toast(err.response?.data?.error || 'Promotion failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollbackConfirm({ reason }) {
    if (!rollbackTarget) return;
    setActionLoading(true);
    try {
      await rollbackModule({ moduleKey: rollbackTarget.moduleKey, reason });
      toast(`${rollbackTarget.name} rolled back to testing`, 'success');
      setRollbackTarget(null);
      await Promise.all([fetchModules(), fetchAudit()]);
    } catch (err) {
      toast(err.response?.data?.error || 'Rollback failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      {/* Section header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--yd-border-light)',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--yd-text)' }}>Staged Release Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--yd-text-muted)', marginTop: 3 }}>
            Manage the module lifecycle: Development → Testing → Production.
            Each promotion is recorded with a timestamp and approver.
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
          onClick={() => { fetchModules(); fetchAudit(); }}
          disabled={loadingMods}
        >
          <Icons.RefreshCw /> Refresh
        </button>
      </div>

      {/* Pipeline flow */}
      <PipelineHeader />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryCard
          count={byStatus.production.length}
          label="In Production"
          {...STATUS_META.production}
        />
        <SummaryCard
          count={byStatus.testing.length}
          label="In Testing"
          {...STATUS_META.testing}
        />
        <SummaryCard
          count={byStatus.development.length}
          label="In Development"
          {...STATUS_META.development}
        />
      </div>

      {/* Stage sections */}
      {loadingMods ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 56, borderRadius: 12, background: 'var(--yd-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <>
          <StageSection
            title="Production — Live on KUE Boxs Care"
            status="production"
            modules={byStatus.production}
            onPromote={setPromoteTarget}
            onRollback={setRollbackTarget}
            defaultOpen={false}
          />
          <StageSection
            title="Testing — Yellow Dot (Development)"
            status="testing"
            modules={byStatus.testing}
            onPromote={setPromoteTarget}
            onRollback={setRollbackTarget}
            defaultOpen={true}
          />
          <StageSection
            title="Development — Coming Soon"
            status="development"
            modules={byStatus.development}
            onPromote={setPromoteTarget}
            onRollback={setRollbackTarget}
            defaultOpen={true}
          />
        </>
      )}

      {/* Audit log */}
      <AuditLog log={auditLog} loading={loadingAudit} />

      {/* Modals */}
      <PromoteModal
        mod={promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onConfirm={handlePromoteConfirm}
        loading={actionLoading}
      />
      <RollbackModal
        mod={rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleRollbackConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
