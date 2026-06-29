/**
 * releaseService.js — Staged Release Dashboard API client.
 */

import api from './api';

export async function getModules() {
  const { data } = await api.get('/api/releases/modules');
  return data.modules;
}

export async function promoteModule({ moduleKey, releaseNote, version }) {
  const { data } = await api.post('/api/releases/promote', { moduleKey, releaseNote, version });
  return data;
}

export async function rollbackModule({ moduleKey, reason }) {
  const { data } = await api.post('/api/releases/rollback', { moduleKey, reason });
  return data;
}

export async function getAuditLog({ limit = 100 } = {}) {
  const { data } = await api.get('/api/releases/audit', { params: { limit } });
  return data.log;
}
