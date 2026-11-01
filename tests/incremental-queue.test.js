const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {acknowledgeVersions, backupSnapshot, planChanges, saveSnapshot, readSnapshot} = require('../out/incremental');
const old = {'a.txt':'a'.repeat(64), 'b.txt':'b'.repeat(64)};
const now = {'a.txt':'c'.repeat(64), 'b.txt':'b'.repeat(64), 'new.txt':'d'.repeat(64)};
const acknowledged = acknowledgeVersions(old, now, ['a.txt', 'new.txt']);
assert.equal(acknowledged['a.txt'], now['a.txt']);
assert.equal(acknowledged['new.txt'], now['new.txt']);
assert.equal(planChanges(now, acknowledged, []).upload.length, 0);
assert.deepEqual(planChanges({...now, 'a.txt':'e'.repeat(64)}, acknowledged, []).upload, ['a.txt']);
assert.equal(old['a.txt'], 'a'.repeat(64));
assert.throws(()=>acknowledgeVersions(old, now, ['../escape']), /Invalid/);
assert.throws(()=>acknowledgeVersions(old, now, ['missing.txt']), /Invalid/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ftpqueue-'));
try {
  const file=path.join(dir,'snapshot.json');
  assert.equal(backupSnapshot(file),undefined);
  saveSnapshot(file,old);
  const backup=backupSnapshot(file);
  saveSnapshot(file,acknowledged);
  assert.deepEqual(readSnapshot(backup),old);
  assert.deepEqual(readSnapshot(file),acknowledged);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
console.log('Incremental queue tests: PASS');
