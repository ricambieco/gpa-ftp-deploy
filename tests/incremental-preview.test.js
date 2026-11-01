const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {planChanges} = require('../out/incremental');
const {classifyUploads, renderIncrementalPreview} = require('../out/incrementalPreview');
const previous = {'same.txt':'a', 'edit.txt':'old', 'delete.txt':'gone'};
const current = {'same.txt':'a', 'edit.txt':'new', 'add.txt':'new'};
const plan = planChanges(current, previous, []);
assert.deepEqual(classifyUploads(plan, previous), {added:['add.txt'],modified:['edit.txt']});
assert.deepEqual(plan.remove,['delete.txt']);
const html = renderIncrementalPreview('<host>&', plan, previous, false);
assert.ok(html.includes('&lt;host&gt;&amp;'));
assert.ok(html.includes('add.txt') && html.includes('edit.txt') && html.includes('delete.txt'));
assert.ok(html.includes('Nessun trasferimento o eliminazione remota'));
const interactive = renderIncrementalPreview('<host>&', plan, previous, false, true);
assert.ok(interactive.includes('Escludi selezionati fino alla modifica'));
assert.ok(interactive.includes('Reset coda'));
assert.ok(interactive.includes('data-path=\"add.txt\"'));
assert.ok(!interactive.includes('data-path=\"delete.txt\"'));
const ext = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');
assert.ok(ext.includes("registerCommand('ftpDeploy.previewChanges'"));
assert.ok(!ext.includes("'Deploy changes', 'Show details'"));
assert.ok(!/registerCommand\('ftpDeploy.uploadChanges'[\s\S]*?registerCommand\('ftpDeploy.uploadSelected'/.test(ext) || ext.includes('const previewChangesCmd'));
console.log('Incremental preview tests: PASS');

// 1.3.4: folder-wide selection is preview-only, with nested folder paths and mixed states.
const grouped = renderIncrementalPreview('host', {
  upload:['sample-site/Api.php','sample-site/reports/banks_de.php','sample-site/reports/iban_parser.php','Images/logo.png'],
  remove:[], unchanged:0
}, {}, false, true);
assert.ok(grouped.includes('Selezione per percorso'));
assert.ok(grouped.includes('Filtra cartelle (es. sample-site/reports)'));
assert.ok(grouped.includes("const folder=segments.slice(0,n).join('/')+'/';"));
assert.ok(grouped.includes('for(const file of files)file.checked=check.checked'));
assert.ok(grouped.includes('entry.check.indeterminate=count>0&&count<entry.files.length'));
assert.ok(grouped.includes('deselect-all'));
const script = grouped.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'Preview must have a script');
assert.doesNotThrow(() => new Function(script[1]), 'Webview JavaScript must be syntactically valid');
const readOnly = renderIncrementalPreview('host', {upload:['sample-site/a.php'], remove:[], unchanged:0}, {}, false, false);
assert.ok(!readOnly.includes('id="folder-tree"'), 'Folder selection must only appear in interactive preview');
