/**
 * foodMenuService.js — Firestore-backed food menu
 * ──────────────────────────────────────────────────
 * Collection: foodMenus/{menuId}
 * Fields: menuId, date, mealType, itemName, unitType,
 *         branch, schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("foodMenus");

function nowISO() { return new Date().toISOString(); }

function docToMenu(snap) {
  const d = snap.data() || {};
  return {
    id:        d.id        || snap.id,
    date:      d.date      || "",
    mealType:  d.mealType  || "",
    itemName:  d.itemName  || "",
    unitType:  d.unitType  || "",
    branch:    d.branch    || "",
    schoolId:  d.schoolId  || SCHOOL_ID,
    centerId:  d.centerId  || d.center || "",
    center:    d.centerId  || d.center || "",
    createdAt: d.createdAt || "",
    updatedAt: d.updatedAt || "",
  };
}

async function getMenus({ date, branch, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date) q = q.where("date", "==", date);
  const snap = await q.get();
  let menus = snap.docs.map(docToMenu);
  if (branch)   menus = menus.filter(m => m.branch   === branch);
  if (centerId) menus = menus.filter(m => m.centerId === centerId);
  // Sort newest date first (JS — avoids composite index)
  menus.sort((a, b) => b.date.localeCompare(a.date));
  return menus;
}

async function createMenu(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const menuId          = `MENU-${Date.now()}`;
  const resolvedCenter  = centerId || data.centerId || data.center || "";
  const doc = {
    id:        menuId,
    date:      data.date     || new Date().toISOString().slice(0, 10),
    mealType:  data.mealType || "",
    itemName:  data.itemName || "",
    unitType:  data.unitType || "",
    branch:    data.branch   || "",
    schoolId,
    centerId:  resolvedCenter,
    center:    resolvedCenter,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
    updatedBy: actorUserId,
  };
  await col().doc(menuId).set(doc);
  return doc;
}

async function updateMenuByDate(date, data, { schoolId = SCHOOL_ID } = {}) {
  let q = col().where("schoolId", "==", schoolId).where("date", "==", date);
  const snap  = await q.get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { ...data, updatedAt: nowISO() }));
  await batch.commit();
  return { updated: snap.size };
}

async function deleteMenuByDate(date, { schoolId = SCHOOL_ID } = {}) {
  let q = col().where("schoolId", "==", schoolId).where("date", "==", date);
  const snap  = await q.get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { deleted: snap.size };
}

module.exports = { getMenus, createMenu, updateMenuByDate, deleteMenuByDate };
