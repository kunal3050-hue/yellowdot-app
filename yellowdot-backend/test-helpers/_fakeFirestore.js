/**
 * _fakeFirestore.js — tiny in-memory Firestore stand-in for unit tests.
 *
 * Supports exactly what the parent services use:
 *   db.collection(name).doc(id).get()/.set(data,{merge})
 *   db.collection(name).where(field,'==',val).get()  (single equality filter)
 *
 * Inject it before requiring a service:
 *   const fake = makeFakeFirestore();
 *   require.cache[require.resolve("../firebaseAdmin")] = { exports: { db: fake.db, auth: {} } };
 */

function makeFakeFirestore() {
  // collections: object collections keyed by id; "students" is an array.
  const store = { parents: {}, students: [] };

  const snap = (id, data) => ({ id, exists: !!data, data: () => data });

  const db = {
    _store: store,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() { return snap(id, store[name] && store[name][id]); },
            async set(data, opts) {
              if (!store[name] || Array.isArray(store[name])) store[name] = store[name] || {};
              store[name][id] = opts && opts.merge ? { ...(store[name][id] || {}), ...data } : { ...data };
            },
          };
        },
        where(field, _op, val) {
          return {
            async get() {
              const rows = Array.isArray(store[name]) ? store[name] : Object.values(store[name] || {});
              const matched = rows.filter(r => r[field] === val);
              const docs = matched.map(r => snap(r.studentId || r.id, r));
              return { empty: docs.length === 0, size: docs.length, docs, forEach: cb => docs.forEach(cb) };
            },
          };
        },
      };
    },
  };

  return {
    db,
    reset(seed = {}) { store.parents = seed.parents || {}; store.students = seed.students || []; },
    store,
  };
}

module.exports = { makeFakeFirestore };
