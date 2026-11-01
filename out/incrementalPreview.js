"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyUploads = classifyUploads;
exports.renderIncrementalPreview = renderIncrementalPreview;
function classifyUploads(plan, previous) {
    return {
        added: plan.upload.filter(p => !Object.prototype.hasOwnProperty.call(previous, p)),
        modified: plan.upload.filter(p => Object.prototype.hasOwnProperty.call(previous, p)),
    };
}
function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderIncrementalPreview(target, plan, previous, firstRun, interactive = false) {
    const { added, modified } = classifyUploads(plan, previous);
    const renderRows = (paths, state) => paths.length
        ? paths.map(p => `<tr><td class="status">${interactive && state !== 'DELETE' ? `<input type="checkbox" class="file-select" data-path="${escapeHtml(p)}" aria-label="Seleziona ${escapeHtml(p)}"> ` : ''}${state}</td><td class="path">${escapeHtml(p)}</td></tr>`).join('\n')
        : '<tr><td colspan="2" class="empty">Nessun file</td></tr>';
    const section = (heading, paths, state) => `<section><h2>${heading} <span class="count">${paths.length}</span></h2><table><thead><tr><th>Operazione</th><th>Percorso relativo</th></tr></thead><tbody>${renderRows(paths, state)}</tbody></table></section>`;
    return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>FTP Deploy — Anteprima incrementale</title>
  <style>body{font-family:var(--vscode-font-family, sans-serif);color:var(--vscode-foreground);padding:18px 24px}
  h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:26px}p{line-height:1.5}
  .meta{color:var(--vscode-descriptionForeground);overflow-wrap:anywhere}
  .metrics{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.metric{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:10px 16px;min-width:95px}.metric b{font-size:1.5rem;display:block}
  table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;border-bottom:1px solid var(--vscode-panel-border);padding:7px 10px;vertical-align:top}th:first-child{width:115px}
  .path{font-family:var(--vscode-editor-font-family, monospace);overflow-wrap:anywhere}.status{color:var(--vscode-descriptionForeground)}
  .empty{color:var(--vscode-descriptionForeground);font-style:italic}.count{font-weight:normal;color:var(--vscode-descriptionForeground)}
  .folder-panel{border:1px solid var(--vscode-panel-border);border-radius:6px;padding:10px 12px;margin:14px 0}.folder-panel summary{cursor:pointer;font-weight:600}.folder-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}.folder-filter{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));padding:7px;min-width:230px;max-width:100%;flex:1}.folder-tree{max-height:300px;overflow-y:auto;border:1px solid var(--vscode-panel-border);padding:6px}.folder-row{display:flex;gap:9px;align-items:center;padding:4px 6px;white-space:nowrap}.folder-row:hover{background:var(--vscode-list-hoverBackground)}.folder-row label{cursor:pointer;overflow:hidden;text-overflow:ellipsis}.folder-count{color:var(--vscode-descriptionForeground);font-size:.85em}.folder-row[hidden]{display:none}.folder-hint{font-size:.9em;color:var(--vscode-descriptionForeground)}
  .notice{padding:10px 12px;border-left:3px solid var(--vscode-focusBorder);background:var(--vscode-editor-inactiveSelectionBackground)} button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:8px 12px;border:0;border-radius:4px;margin-right:8px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0}.warn{background:var(--vscode-inputValidation-warningBackground);padding:8px}</style></head>
  <body><h1>FTP Deploy — Anteprima incrementale</h1>
  <p class="meta">Destinazione: ${escapeHtml(target)}</p>
  <p class="notice">Nessun trasferimento o eliminazione remota viene eseguito da questa anteprima. Il piano sarà ricalcolato quando avvierai il comando Upload Changes Since Last Upload.${firstRun ? ' Primo caricamento: nessuna cancellazione remota.' : ' Le cancellazioni si applicano esclusivamente ai file tracciati nel manifest.'}</p>
  <div class="metrics"><div class="metric"><b>${added.length}</b>Nuovi</div><div class="metric"><b>${modified.length}</b>Modificati</div><div class="metric"><b>${plan.remove.length}</b>Da eliminare</div><div class="metric"><b>${plan.unchanged}</b>Invariati</div></div>
  ${interactive ? `<details class="folder-panel" open><summary>Selezione per percorso <span id="folder-total" class="count"></span></summary>
    <p class="folder-hint">Seleziona o deseleziona tutti i file di una cartella, comprese le sottocartelle. Il simbolo parziale indica una selezione mista.</p>
    <div class="folder-actions"><input id="folder-filter" class="folder-filter" type="search" placeholder="Filtra cartelle (es. sample-site/reports)" aria-label="Filtra cartelle"><button id="select-all" type="button">Seleziona tutti</button><button id="deselect-all" type="button">Deseleziona tutti</button></div>
    <div id="folder-tree" class="folder-tree" role="group" aria-label="Selezione cartelle"></div>
  </details>` : ''}
  ${interactive ? `<div class="tools"><button id="exclude" disabled>Escludi selezionati fino alla modifica</button><button id="reset">Reset coda (baseline locale)</button><span id="selected">0 selezionati</span></div><p class="meta">Il reset considera tutti i file locali attuali gia sincronizzati, senza verificarli sul server. Entrambe le operazioni richiedono conferma. I file modificati dopo l'esclusione ricompaiono.</p>` : ''}
  ${section('File nuovi da caricare', added, 'UPLOAD')}
  ${section('File modificati da caricare', modified, 'UPLOAD')}
  ${section('File tracciati da eliminare', plan.remove, 'DELETE')}
  ${interactive ? `<script>
  const vscode=acquireVsCodeApi();
  const checkboxes=()=>Array.from(document.querySelectorAll('.file-select'));
  const allFiles=checkboxes();
  const folderTree=document.getElementById('folder-tree');
  const folderFilter=document.getElementById('folder-filter');
  const folderMap=new Map();
  // The folder hierarchy is derived from file paths already listed in the preview.
  // No additional files are scanned or transferred.
  for(const checkbox of allFiles){
    const segments=checkbox.dataset.path.split(String.fromCharCode(92)).join('/').split('/');
    for(let n=1;n<segments.length;n++){
      const folder=segments.slice(0,n).join('/')+'/';
      let group=folderMap.get(folder);
      if(!group){group=[];folderMap.set(folder,group);}
      group.push(checkbox);
    }
  }
  const folderEntries=[];
  for(const folder of Array.from(folderMap.keys()).sort((a,b)=>a.localeCompare(b))){
    const files=folderMap.get(folder);
    const row=document.createElement('div');
    row.className='folder-row';
    const depth=folder.slice(0,-1).split('/').length-1;
    row.style.paddingLeft=(6+Math.min(depth,12)*18)+'px';
    const check=document.createElement('input');
    check.type='checkbox';
    const id='folder-'+folderEntries.length;
    check.id=id;
    check.setAttribute('aria-label','Seleziona tutti i file in '+folder);
    const label=document.createElement('label');
    label.htmlFor=id;
    label.textContent=folder;
    label.title=folder;
    const count=document.createElement('span');
    count.className='folder-count';
    count.textContent='('+files.length+')';
    row.append(check,label,count);
    folderTree.appendChild(row);
    folderEntries.push({folder,files,check,row});
    check.addEventListener('change',()=>{
      for(const file of files)file.checked=check.checked;
      update();
    });
  }
  document.getElementById('folder-total').textContent='('+folderEntries.length+' cartelle)';
  const update=()=>{
    const n=allFiles.filter(c=>c.checked).length;
    document.getElementById('selected').textContent=n+' selezionati';
    document.getElementById('exclude').disabled=!n;
    for(const entry of folderEntries){
      const count=entry.files.reduce((sum,c)=>sum+(c.checked?1:0),0);
      entry.check.checked=count===entry.files.length;
      entry.check.indeterminate=count>0&&count<entry.files.length;
      entry.check.setAttribute('aria-checked',entry.check.indeterminate?'mixed':String(entry.check.checked));
    }
  };
  for(const c of allFiles)c.addEventListener('change',update);
  folderFilter.addEventListener('input',()=>{
    const needle=folderFilter.value.trim().toLocaleLowerCase();
    for(const entry of folderEntries)entry.row.hidden=!entry.folder.toLocaleLowerCase().includes(needle);
  });
  document.getElementById('select-all').addEventListener('click',()=>{for(const c of allFiles)c.checked=true;update();});
  document.getElementById('deselect-all').addEventListener('click',()=>{for(const c of allFiles)c.checked=false;update();});
  document.getElementById('exclude').addEventListener('click',()=>vscode.postMessage({type:'exclude',paths:allFiles.filter(c=>c.checked).map(c=>c.dataset.path)}));
  document.getElementById('reset').addEventListener('click',()=>vscode.postMessage({type:'reset'}));
  update();
  </script>` : ''}
  </body></html>`;
}
//# sourceMappingURL=incrementalPreview.js.map