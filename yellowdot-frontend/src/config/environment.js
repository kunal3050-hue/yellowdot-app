/**
 * environment.js — single source of truth for which environment this build
 * targets (development | staging | production) and associated metadata.
 *
 * Set VITE_APP_ENV in the relevant .env file:
 *   .env             → development  (local dev / Yellow Dot local)
 *   .env.staging     → staging      (Yellow Dot cloud deploy — vite build --mode staging)
 *   .env.production  → production   (KUE Boxs Care deploy   — vite build)
 */

export const APP_ENV     = import.meta.env.VITE_APP_ENV     || 'development';
export const APP_NAME    = import.meta.env.VITE_APP_NAME    || 'Yellow Dot';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.2.0';

export const isDevelopment = APP_ENV === 'development';
export const isStaging     = APP_ENV === 'staging';
export const isProduction  = APP_ENV === 'production';

// True for any non-production environment — used by feature flags and guards
export const isPreProduction = !isProduction;

export const ENV_META = {
  development: { label: 'Development',  color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  staging:     { label: 'Staging',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  production:  { label: 'Production',   color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
};

export const currentEnvMeta = ENV_META[APP_ENV] || ENV_META.development;
