/**
 * fakeFirestore.js — a minimal, in-memory stand-in for the pieces of the
 * Firestore Admin SDK the Finance Foundation services actually use:
 * collection().doc().get/set/update, collection().add(), collection()
 * .where(...).where(...).limit(n).get(), and db.runTransaction(fn) with
 * tx.get()/tx.set()/tx.update() supporting both a DocumentReference and a
 * (multi-)where Query as the target of tx.get().
 *
 * This exists specifically for financeBillingEngineValidation.test.js and
 * financePaymentLifecycleValidation.test.js, which validate cross-service
 * integration by running the REAL, unmodified service code end-to-end
 * (not each function mocked individually, unlike every other Finance
 * Foundation test file) against a realistic multi-step scenario. It is
 * intentionally NOT a faithful Firestore emulator: only "==" filters are
 * supported (the only operator any Finance Foundation query uses), there
 * is no real transactional isolation between concurrent callers (fine
 * for a single-threaded test), but dotted-path field keys in
 * update()/merge-set() calls (e.g. `{"financeAccount.creditBalance": 200}`,
 * which `familyAccountService.adjustCreditBalance()` relies on) ARE
 * honored, matching real Firestore's nested-field-update behavior — a
 * plain flat merge would silently create a bogus literal key instead of
 * updating the nested field, which is exactly the bug this fake caught
 * when financePaymentLifecycleValidation.test.js first exercised
 * adjustCreditBalance() for real (Sprint 3's validation never touched
 * this code path at all).
 *
 * Callers install this by mutating the properties of the REAL `db`
 * singleton from `../../firebaseAdmin` (`db.collection = fake.collection`,
 * `db.runTransaction = fake.runTransaction`) rather than swapping the
 * whole `db` object — every Finance Foundation service does
 * `const { db } = require("../firebaseAdmin")` (a destructured import),
 * which captures a reference to the object itself, not a live binding to
 * whatever `firebaseAdmin.db` currently points to. Mutating the shared
 * object's properties is the only way to intercept calls from code that
 * already holds that reference — the same technique every other Finance
 * Foundation test file already uses for individual `db.collection`
 * mocks, just applied comprehensively here for a whole test file.
 */

function createFakeFirestore() {
  const store = new Map(); // collectionName -> Map<id, plainDataObject>

  function getCollectionMap(name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  }

  /**
   * applyDottedFields — real Firestore treats a key containing "." in an
   * update()/merge-set() payload as a path into a nested map field (e.g.
   * `{"financeAccount.creditBalance": 200}` updates just that nested
   * field, leaving sibling fields under `financeAccount` untouched).
   * `familyAccountService.adjustCreditBalance()` relies on exactly this.
   * Plain `{...base, ...data}` spreading would instead create a bogus
   * top-level key literally named "financeAccount.creditBalance" — this
   * mutates `base` in place, walking/creating intermediate objects for
   * each dotted segment, matching real Firestore's behavior.
   */
  function applyDottedFields(base, data) {
    for (const [key, value] of Object.entries(data)) {
      if (!key.includes(".")) { base[key] = value; continue; }
      const segments = key.split(".");
      let cursor = base;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (typeof cursor[seg] !== "object" || cursor[seg] === null) cursor[seg] = {};
        cursor = cursor[seg];
      }
      cursor[segments[segments.length - 1]] = value;
    }
    return base;
  }

  function matchesFilters(data, filters) {
    return filters.every(([field, op, value]) => {
      if (op !== "==") throw new Error(`fakeFirestore only supports "==" filters (got "${op}" on "${field}")`);
      return data[field] === value;
    });
  }

  function runQuery(name, filters, limitN) {
    const coll = getCollectionMap(name);
    let docs = [...coll.entries()]
      .filter(([, data]) => matchesFilters(data, filters))
      .map(([id, data]) => ({ id, data: () => ({ ...data }) }));
    if (limitN != null) docs = docs.slice(0, limitN);
    return { empty: docs.length === 0, docs };
  }

  function makeQuery(name, filters, limitN) {
    return {
      __type: "query", __collection: name, __filters: filters, __limit: limitN,
      where(field, op, value) { return makeQuery(name, [...filters, [field, op, value]], limitN); },
      limit(n) { return makeQuery(name, filters, n); },
      get: async () => runQuery(name, filters, limitN),
    };
  }

  function makeDocSnap(name, id) {
    const coll = getCollectionMap(name);
    const exists = coll.has(id);
    return { exists, id, data: () => (exists ? { ...coll.get(id) } : undefined) };
  }

  function makeDocRef(name, id) {
    return {
      __type: "docRef", __collection: name, id,
      get: async () => makeDocSnap(name, id),
      set: async (data, opts) => {
        const coll = getCollectionMap(name);
        coll.set(id, opts && opts.merge && coll.has(id) ? applyDottedFields({ ...coll.get(id) }, data) : { ...data });
      },
      update: async (data) => {
        const coll = getCollectionMap(name);
        if (!coll.has(id)) throw new Error(`fakeFirestore: no document to update at ${name}/${id}`);
        coll.set(id, applyDottedFields({ ...coll.get(id) }, data));
      },
    };
  }

  function collection(name) {
    return {
      doc: (id) => makeDocRef(name, id),
      where: (field, op, value) => makeQuery(name, [[field, op, value]], null),
      add: async (data) => {
        const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        getCollectionMap(name).set(id, { ...data });
        return makeDocRef(name, id);
      },
    };
  }

  async function runTransaction(fn) {
    const tx = {
      get: async (target) => {
        if (target.__type === "docRef") return makeDocSnap(target.__collection, target.id);
        if (target.__type === "query")  return runQuery(target.__collection, target.__filters, target.__limit);
        throw new Error("fakeFirestore: unsupported tx.get() target");
      },
      set: (ref, data, opts) => {
        const coll = getCollectionMap(ref.__collection);
        coll.set(ref.id, opts && opts.merge && coll.has(ref.id) ? applyDottedFields({ ...coll.get(ref.id) }, data) : { ...data });
      },
      update: (ref, data) => {
        const coll = getCollectionMap(ref.__collection);
        coll.set(ref.id, applyDottedFields({ ...(coll.get(ref.id) || {}) }, data));
      },
    };
    return fn(tx);
  }

  /** Test-only direct seeding — bypasses every service, for setting up
   * baseline fixtures (fee templates, student records) that no Finance
   * Foundation service itself is responsible for creating. */
  function seed(collectionName, id, data) {
    getCollectionMap(collectionName).set(id, { ...data });
  }

  /** Test-only direct read — for assertions that don't go through a service. */
  function peek(collectionName, id) {
    const coll = getCollectionMap(collectionName);
    return coll.has(id) ? { ...coll.get(id) } : null;
  }

  function all(collectionName) {
    return [...getCollectionMap(collectionName).values()].map((d) => ({ ...d }));
  }

  return { collection, runTransaction, seed, peek, all };
}

module.exports = { createFakeFirestore };
