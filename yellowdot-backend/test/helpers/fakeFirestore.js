/**
 * fakeFirestore.js — a minimal, in-memory stand-in for the pieces of the
 * Firestore Admin SDK the Finance Foundation services actually use:
 * collection().doc().get/set/update, collection().add(), collection()
 * .where(...).where(...).limit(n).get(), and db.runTransaction(fn) with
 * tx.get()/tx.set()/tx.update() supporting both a DocumentReference and a
 * (multi-)where Query as the target of tx.get().
 *
 * This exists specifically for financeBillingEngineValidation.test.js,
 * which validates cross-service integration by running the REAL,
 * unmodified service code end-to-end (not each function mocked
 * individually, unlike every other Finance Foundation test file) against
 * a realistic multi-step scenario. It is intentionally NOT a faithful
 * Firestore emulator: only "==" filters are supported (the only operator
 * any Finance Foundation query uses), and there is no real transactional
 * isolation between concurrent callers (fine for a single-threaded test
 * — every real transaction in this codebase is used for atomicity against
 * concurrent writers, not simulated here since nothing runs concurrently
 * in a test).
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
        coll.set(id, opts && opts.merge && coll.has(id) ? { ...coll.get(id), ...data } : { ...data });
      },
      update: async (data) => {
        const coll = getCollectionMap(name);
        if (!coll.has(id)) throw new Error(`fakeFirestore: no document to update at ${name}/${id}`);
        coll.set(id, { ...coll.get(id), ...data });
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
        coll.set(ref.id, opts && opts.merge && coll.has(ref.id) ? { ...coll.get(ref.id), ...data } : { ...data });
      },
      update: (ref, data) => {
        const coll = getCollectionMap(ref.__collection);
        coll.set(ref.id, { ...(coll.get(ref.id) || {}), ...data });
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
