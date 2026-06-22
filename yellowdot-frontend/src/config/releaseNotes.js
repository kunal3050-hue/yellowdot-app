/**
 * releaseNotes.js — changelog for the Yellow Dot / KUE Boxs Care platform.
 *
 * Add a new entry here each time a version is cut. The "environment" field
 * tracks where the version was first deployed:
 *   staging    = live on Yellow Dot, not yet promoted
 *   production = live on KUE Boxs Care
 */

export const CURRENT_VERSION = '1.2.0';

// Change-type labels and their display colours
export const CHANGE_TYPE_META = {
  feature:  { label: 'New',      color: '#3B82F6' },
  fix:      { label: 'Fix',      color: '#10B981' },
  improve:  { label: 'Improved', color: '#8B5CF6' },
  breaking: { label: 'Breaking', color: '#EF4444' },
  security: { label: 'Security', color: '#F59E0B' },
};

/**
 * Release history — newest first.
 * @typedef {{ type: keyof CHANGE_TYPE_META, text: string }} Change
 * @typedef {{ version: string, date: string, environment: 'staging'|'production', title: string, changes: Change[] }} Release
 * @type {Release[]}
 */
export const RELEASE_NOTES = [
  {
    version: '1.2.0',
    date: '2026-06-19',
    environment: 'staging',
    title: 'Staged Release Infrastructure',
    changes: [
      { type: 'feature', text: 'Two-environment strategy: Yellow Dot (staging) → KUE Boxs Care (production)' },
      { type: 'feature', text: 'Feature flags for controlled module rollouts per environment' },
      { type: 'feature', text: 'Release notes and build version info surfaced in Settings' },
      { type: 'feature', text: 'Environment badge in Settings for at-a-glance deployment awareness' },
    ],
  },
  {
    version: '1.1.5',
    date: '2026-06-18',
    environment: 'production',
    title: 'Pickup Request & Push Notifications',
    changes: [
      { type: 'feature', text: 'FCM push notifications for pickup request unknown-person gate alerts' },
      { type: 'feature', text: 'Gate register renamed and reception UX refinements' },
      { type: 'fix',     text: 'Staff check-in/out selfieImage and faceDetected payload fixes' },
      { type: 'improve', text: 'Unified Child Presence screen redesign' },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-06-15',
    environment: 'production',
    title: 'Family & Sibling Management',
    changes: [
      { type: 'feature', text: 'Family module: link siblings under one family record' },
      { type: 'feature', text: 'Parent-facing child switcher in the Parent Portal' },
      { type: 'feature', text: 'RBAC-gated family management routes' },
    ],
  },
  {
    version: '1.1.3',
    date: '2026-06-10',
    environment: 'production',
    title: 'Care & Hygiene Module',
    changes: [
      { type: 'feature', text: 'Daily care logs: meals, nap, hygiene recorded by staff' },
      { type: 'feature', text: 'CARE_LOGGED push notification to parents' },
      { type: 'feature', text: 'Care log feed visible in Parent Portal home' },
    ],
  },
  {
    version: '1.1.2',
    date: '2026-06-05',
    environment: 'production',
    title: 'Notification System V2',
    changes: [
      { type: 'improve', text: 'Centralised Firestore notifications collection with badge count' },
      { type: 'feature', text: 'Bell icon badge in sidebar with real-time unread count' },
      { type: 'fix',     text: 'FCM token refresh and service-worker scope conflict resolved' },
    ],
  },
];
