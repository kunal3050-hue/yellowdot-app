const admin = require('firebase-admin');
const svcAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(svcAccount), projectId: 'yellowdot-app' });
const db = admin.firestore();

async function check() {
  // Most recent pickup requests — no orderBy to avoid index requirement
  const pkr = await db.collection('pickupRequests').get();
  const pkrDocs = pkr.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);
  console.log('\n=== pickupRequests (last 5) ===');
  if (!pkrDocs.length) { console.log('  NONE FOUND'); }
  pkrDocs.forEach(d => {
    console.log(`  id=${d.id}`);
    console.log(`  studentId=${d.studentId} studentName=${d.studentName}`);
    console.log(`  status=${d.status} createdAt=${d.createdAt}`);
    console.log(`  staffName=${d.staffName} personName=${d.personName}`);
  });

  // Notifications — filter in-memory, no composite index needed
  const notifSnap = await db.collection('notifications').where('type', '==', 'pickup_request').get();
  const notifDocs = notifSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);
  console.log('\n=== notifications type=pickup_request (last 5) ===');
  if (!notifDocs.length) { console.log('  NONE FOUND — notification was never written to Firestore'); }
  notifDocs.forEach(d => {
    console.log(`  id=${d.id}`);
    console.log(`  parentId=${d.parentId} childId=${d.childId}`);
    console.log(`  title=${d.title}`);
    console.log(`  createdAt=${d.createdAt} read=${d.read}`);
    console.log(`  deepLink=${d.deepLink}`);
  });

  // Parent docs — scan for yellowdotpreschooldaycare@gmail.com or YD008
  const parentsSnap = await db.collection('parents').get();
  console.log('\n=== parent docs matching YD008 / yellowdotpreschooldaycare@gmail.com ===');
  let found = false;
  parentsSnap.docs.forEach(d => {
    const data = d.data();
    const ids = data.studentIds || [];
    const email = 'yellowdotpreschooldaycare@gmail.com';
    if (ids.includes('YD008') || data.fatherEmail === email || data.motherEmail === email) {
      found = true;
      console.log(`  doc id=${d.id}`);
      console.log(`  studentIds=${JSON.stringify(ids)}`);
      console.log(`  fatherEmail=${data.fatherEmail || 'none'}`);
      console.log(`  motherEmail=${data.motherEmail || 'none'}`);
      console.log(`  schoolId=${data.schoolId}`);
      console.log(`  fcmToken=${data.fcmToken ? data.fcmToken.substring(0, 30) + '...' : 'NULL — NO TOKEN'}`);
    }
  });
  if (!found) console.log('  No matching parent doc found');
}

check().then(() => process.exit(0)).catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
