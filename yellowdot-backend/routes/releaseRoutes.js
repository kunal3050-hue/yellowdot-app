/**
 * releaseRoutes.js — Staged Release Dashboard API
 *
 * All routes require authentication. Only developer / super_admin roles
 * may read or mutate release state (authorize uses bypass-role short-circuit,
 * so developer/super_admin always pass regardless of explicit list).
 *
 * GET  /api/releases/modules        — list all modules with current status
 * POST /api/releases/promote        — promote a module to production
 * POST /api/releases/rollback       — roll a module back to testing
 * GET  /api/releases/audit          — fetch release audit log
 */

const express    = require('express');
const router     = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const releaseSvc = require('../services/releaseService');

// GET /api/releases/modules
router.get(
  '/api/releases/modules',
  authenticate,
  authorize('developer', 'super_admin'),
  async (req, res) => {
    try {
      const modules = await releaseSvc.getModules();
      res.json({ modules });
    } catch (err) {
      console.error('[releases] getModules error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/releases/promote
router.post(
  '/api/releases/promote',
  authenticate,
  authorize('developer', 'super_admin'),
  async (req, res) => {
    const { moduleKey, releaseNote, version } = req.body;
    if (!moduleKey) return res.status(400).json({ error: 'moduleKey is required' });

    try {
      const result = await releaseSvc.promoteModule({
        moduleKey,
        releaseNote:     releaseNote || '',
        version:         version     || undefined,
        performedBy:     req.user.userId,
        performedByName: req.user.name  || '',
        performedByEmail: req.user.email || '',
      });
      res.json(result);
    } catch (err) {
      console.error('[releases] promote error:', err.message);
      res.status(400).json({ error: err.message });
    }
  },
);

// POST /api/releases/rollback
router.post(
  '/api/releases/rollback',
  authenticate,
  authorize('developer', 'super_admin'),
  async (req, res) => {
    const { moduleKey, reason } = req.body;
    if (!moduleKey) return res.status(400).json({ error: 'moduleKey is required' });

    try {
      const result = await releaseSvc.rollbackModule({
        moduleKey,
        reason:           reason || '',
        performedBy:      req.user.userId,
        performedByName:  req.user.name  || '',
        performedByEmail: req.user.email || '',
      });
      res.json(result);
    } catch (err) {
      console.error('[releases] rollback error:', err.message);
      res.status(400).json({ error: err.message });
    }
  },
);

// GET /api/releases/audit
router.get(
  '/api/releases/audit',
  authenticate,
  authorize('developer', 'super_admin'),
  async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    try {
      const log = await releaseSvc.getAuditLog({ limit });
      res.json({ log });
    } catch (err) {
      console.error('[releases] getAuditLog error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
