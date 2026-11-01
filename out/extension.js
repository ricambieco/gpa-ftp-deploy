"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const incremental_1 = require("./incremental");
const incrementalPreview_1 = require("./incrementalPreview");
const config_1 = require("./config");
const ftpClient_1 = require("./ftpClient");
const logger_1 = require("./logger");
const secrets_1 = require("./secrets");
const profiles_1 = require("./profiles");
function getClient(cfg, logger) {
    return new ftpClient_1.FtpDeployClient(logger);
}
// ── Stato globale ─────────────────────────────────────────────────────────────
let logger;
let statusBar;
let extensionContext;
// ── Activate ──────────────────────────────────────────────────────────────────
function activate(context) {
    extensionContext = context;
    logger = new logger_1.Logger('FTP Deploy');
    statusBar = new profiles_1.ProfileStatusBar();
    logger.info('FTP Deploy activated');
    const lastProfile = context.workspaceState.get('activeProfile', 'default');
    statusBar.setProfile(lastProfile);
    logger.info(`Active profile: ${lastProfile}`);
    // ── Upload on save ──────────────────────────────────────────────────────────
    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        const cfg = await resolveActiveConfigForResource(doc.uri);
        if (!cfg || !cfg.uploadOnSave)
            return;
        const localFile = doc.uri.fsPath;
        if (!isUnderRoot(localFile, cfg.localRoot)) {
            logger.debug(`File outside localRoot, skipping: ${localFile}`);
            return;
        }
        await runUploadFile(localFile, cfg);
    });
    // ── Seleziona profilo ───────────────────────────────────────────────────────
    const selectProfileCmd = vscode.commands.registerCommand('ftpDeploy.selectProfile', async () => {
        const profiles = await (0, profiles_1.loadProfiles)(logger);
        const names = Object.keys(profiles);
        if (names.length === 0) {
            logger.warn('No profiles configured');
            vscode.window.showWarningMessage('FTP Deploy: no profiles configured');
            return;
        }
        const current = statusBar.active;
        const items = names.map((n) => ({
            label: n === current ? `$(check) ${n}` : n,
            description: `${profiles[n].protocol ?? 'ftp'}://${profiles[n].host}${profiles[n].remotePath}`,
            name: n,
        }));
        const picked = await vscode.window.showQuickPick(items, {
            title: 'FTP Deploy — Select profile',
            placeHolder: `Active profile: ${current}`,
        });
        if (!picked)
            return;
        statusBar.setProfile(picked.name);
        await context.workspaceState.update('activeProfile', picked.name);
        logger.info(`Profile changed: ${picked.name}`);
        vscode.window.showInformationMessage(`FTP Deploy: profile "${picked.name}" active`);
    });
    // ── Carica file corrente ────────────────────────────────────────────────────
    const uploadFileCmd = vscode.commands.registerCommand('ftpDeploy.uploadFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            logger.warn('No active editor for upload');
            vscode.window.showWarningMessage('FTP Deploy: no file open');
            return;
        }
        const cfg = await resolveActiveConfigForResource(editor.document.uri);
        if (!cfg)
            return;
        await runUploadFile(editor.document.uri.fsPath, cfg);
    });
    // ── Carica intera cartella ──────────────────────────────────────────────────
    const uploadFolderCmd = vscode.commands.registerCommand('ftpDeploy.uploadFolder', async (args) => {
        const cfg = await resolveActiveConfig(args?.profile);
        if (!cfg)
            return;
        const skipConfirm = args?.skipConfirm === true || cfg.confirmBeforeUpload === false;
        if (!skipConfirm) {
            const confirm = await vscode.window.showWarningMessage(`Upload the ENTIRE folder "${cfg.localRoot}" to ${cfg.host}${cfg.remotePath}?\n[profile: ${args?.profile ?? statusBar.active}]`, { modal: true }, 'Yes, upload all');
            if (confirm !== 'Yes, upload all')
                return;
        }
        await runUploadDirectory(cfg.localRoot, cfg);
    });
    // ── Anteprima su richiesta, mai aperta automaticamente durante l'upload ──
    const previewChangesCmd = vscode.commands.registerCommand('ftpDeploy.previewChanges', async (args) => {
        const cfg = await resolveActiveConfig(args?.profile);
        if (!cfg)
            return;
        try {
            const manifest = incrementalManifestPath(context, cfg);
            const current = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
            const previous = (0, incremental_1.readSnapshot)(manifest);
            const plan = (0, incremental_1.planChanges)(current, previous, cfg.ignore);
            const panel = vscode.window.createWebviewPanel('ftpDeploy.incrementalPreview', 'FTP Deploy: Incremental Changes', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: false });
            const refresh = () => {
                const now = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
                const base = (0, incremental_1.readSnapshot)(manifest);
                panel.webview.html = (0, incrementalPreview_1.renderIncrementalPreview)(`${cfg.protocol}://${cfg.host}${cfg.remotePath}`, (0, incremental_1.planChanges)(now, base, cfg.ignore), base, !fs.existsSync(manifest), true);
            };
            // No remote writes: queue mutations only advance the local SHA-256 baseline.
            panel.webview.onDidReceiveMessage(async (message) => {
                try {
                    if (message.type === 'exclude') {
                        const chosen = Array.isArray(message.paths) ? Array.from(new Set(message.paths)) : [];
                        if (!chosen.length || chosen.length > 100000 || chosen.some(p => typeof p !== 'string' || !(0, incremental_1.safeRelative)(p)))
                            return;
                        const live = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
                        const base = (0, incremental_1.readSnapshot)(manifest);
                        const livePlan = (0, incremental_1.planChanges)(live, base, cfg.ignore);
                        // Reject stale previews, including files edited while the confirmation modal is open.
                        if (chosen.some(rel => !plan.upload.includes(rel) || !livePlan.upload.includes(rel) || current[rel] !== live[rel])) {
                            vscode.window.showWarningMessage('FTP Deploy: anteprima non aggiornata. Riapri o aggiorna la selezione.');
                            refresh();
                            return;
                        }
                        const choice = await vscode.window.showWarningMessage(`Escludere ${chosen.length} file dalla coda per la versione attuale? Non verranno caricati. La prossima modifica li farà ricomparire.`, { modal: true }, 'Escludi versioni selezionate');
                        if (choice !== 'Escludi versioni selezionate')
                            return;
                        const afterConfirm = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
                        if (chosen.some(rel => afterConfirm[rel] !== live[rel])) {
                            vscode.window.showWarningMessage('FTP Deploy: file modificati durante la conferma, operazione annullata.');
                            refresh();
                            return;
                        }
                        (0, incremental_1.backupSnapshot)(manifest);
                        (0, incremental_1.saveSnapshot)(manifest, (0, incremental_1.acknowledgeVersions)((0, incremental_1.readSnapshot)(manifest), afterConfirm, chosen));
                        logger.info(`Incremental queue: acknowledged ${chosen.length} version(s) locally; no remote operation`);
                        refresh();
                    }
                    else if (message.type === 'reset') {
                        const choice = await vscode.window.showWarningMessage(`RESET CODA per ${cfg.host}${cfg.remotePath}: tutti i file locali saranno considerati già presenti sul server SENZA VERIFICA REMOTA. Operazione potenzialmente rischiosa. Proseguire?`, { modal: true }, 'Reset baseline locale');
                        if (choice !== 'Reset baseline locale')
                            return;
                        const baseline = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
                        (0, incremental_1.backupSnapshot)(manifest);
                        (0, incremental_1.saveSnapshot)(manifest, baseline);
                        logger.warn(`Incremental queue RESET: ${Object.keys(baseline).length} local files acknowledged; no remote operation`);
                        vscode.window.showInformationMessage(`FTP Deploy: coda azzerata (${Object.keys(baseline).length} file tracciati). Nessuna modifica remota.`);
                        refresh();
                    }
                }
                catch (e) {
                    logger.error(`Incremental queue operation failed: ${e}`);
                    vscode.window.showErrorMessage(`FTP Deploy: errore gestione coda — ${e}`);
                }
            });
            refresh();
        }
        catch (e) {
            logger.error(`Incremental preview failed: ${e}`);
            vscode.window.showErrorMessage(`FTP Deploy: cannot preview incremental changes — ${e}`);
        }
    });
    const uploadChangesCmd = vscode.commands.registerCommand('ftpDeploy.uploadChanges', async (args) => {
        const cfg = await resolveActiveConfig(args?.profile);
        if (!cfg)
            return;
        const manifest = incrementalManifestPath(context, cfg);
        try {
            const current = (0, incremental_1.scan)(cfg.localRoot, cfg.ignore);
            const previous = (0, incremental_1.readSnapshot)(manifest);
            const plan = (0, incremental_1.planChanges)(current, previous, cfg.ignore);
            if (!plan.upload.length && !plan.remove.length) {
                vscode.window.showInformationMessage(`FTP Deploy: no changes (${plan.unchanged} unchanged).`);
                return;
            }
            const firstRun = !fs.existsSync(manifest);
            const answer = await vscode.window.showWarningMessage(`FTP Deploy ${firstRun ? '(first incremental upload)' : '(incremental)'}: ${plan.upload.length} upload(s), ${plan.remove.length} tracked deletion(s), ${plan.unchanged} unchanged. Target: ${cfg.host}${cfg.remotePath}. ${firstRun ? 'No remote deletions will occur on first run. Existing remote files are not inventoried.' : 'Confirm before deleting tracked remote files.'}`, { modal: true }, 'Deploy changes');
            if (answer !== 'Deploy changes')
                return;
            const client = getClient(cfg, logger);
            const next = { ...previous };
            let uploaded = 0, deleted = 0, failed = 0;
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'FTP Deploy: incremental upload', cancellable: false }, async () => {
                await client.connect(cfg);
                try {
                    for (const rel of plan.upload) {
                        if (!(0, incremental_1.safeRelative)(rel)) {
                            failed++;
                            continue;
                        }
                        try {
                            const local = path.join(cfg.localRoot, ...rel.split('/'));
                            // Detect changes between scanning and uploading; retry on next run.
                            const { hashFile } = await Promise.resolve().then(() => __importStar(require('./incremental')));
                            if (hashFile(local) !== current[rel])
                                throw new Error('File changed during scan');
                            await client.uploadFile(local, (0, ftpClient_1.localToRemote)(local, cfg.localRoot, cfg.remotePath));
                            next[rel] = current[rel];
                            uploaded++;
                        }
                        catch (e) {
                            failed++;
                            logger.error(`Incremental upload failed: ${rel}: ${e}`);
                        }
                    }
                    if (failed > 0)
                        logger.warn("Skipping remote deletions because one or more uploads failed");
                    for (const rel of (failed > 0 ? [] : plan.remove)) {
                        if (!(0, incremental_1.safeRelative)(rel)) {
                            failed++;
                            continue;
                        }
                        try {
                            const remote = path.posix.join(cfg.remotePath, rel);
                            await client.deleteFile(remote);
                            delete next[rel];
                            deleted++;
                        }
                        catch (e) {
                            failed++;
                            logger.error(`Tracked deletion failed: ${rel}: ${e}`);
                        }
                    }
                }
                finally {
                    await client.close();
                }
            });
            (0, incremental_1.saveSnapshot)(manifest, next);
            const report = `FTP Deploy: ${uploaded} uploaded, ${deleted} deleted, ${plan.unchanged} unchanged, ${failed} failed.`;
            logger.info(report);
            if (failed)
                vscode.window.showWarningMessage(report);
            else
                vscode.window.showInformationMessage(report);
        }
        catch (e) {
            logger.error(`Incremental deploy aborted: ${e}`);
            vscode.window.showErrorMessage(`FTP Deploy: incremental deploy aborted — ${e}`);
        }
    });
    // ── Tasto destro nel file explorer ─────────────────────────────────────────
    const uploadSelectedCmd = vscode.commands.registerCommand('ftpDeploy.uploadSelected', async (uri, uris) => {
        const cfg = await resolveActiveConfig();
        if (!cfg)
            return;
        const targets = uris?.length > 0 ? uris : uri ? [uri] : [];
        if (targets.length === 0) {
            logger.warn('No items selected for upload');
            vscode.window.showWarningMessage('FTP Deploy: no items selected');
            return;
        }
        for (const target of targets) {
            const localPath = target.fsPath;
            fs.statSync(localPath).isDirectory()
                ? await runUploadDirectory(localPath, cfg)
                : await runUploadFile(localPath, cfg);
        }
    });
    // ── Salva password nel keychain ─────────────────────────────────────────────
    const savePasswordCmd = vscode.commands.registerCommand('ftpDeploy.savePassword', async () => {
        const profiles = await (0, profiles_1.loadProfiles)(logger);
        const names = Object.keys(profiles);
        let profileName = statusBar.active;
        if (names.length > 1) {
            const picked = await vscode.window.showQuickPick(names, {
                title: 'FTP Deploy — Save password to keychain',
            });
            if (!picked)
                return;
            profileName = picked;
        }
        const profile = profiles[profileName];
        if (!profile) {
            logger.error(`Profile "${profileName}" not found`);
            vscode.window.showErrorMessage(`Profile "${profileName}" not found`);
            return;
        }
        const pwd = await (0, secrets_1.promptAndSavePassword)(context, profileName, profile.host);
        if (pwd !== undefined) {
            vscode.window.showInformationMessage(`FTP Deploy: password for profile "${profileName}" saved to keychain ✓`);
        }
    });
    // ── Rimuovi password dal keychain ───────────────────────────────────────────
    const deletePasswordCmd = vscode.commands.registerCommand('ftpDeploy.deletePassword', async () => {
        const profiles = await (0, profiles_1.loadProfiles)(logger);
        const names = Object.keys(profiles);
        let profileName = statusBar.active;
        if (names.length > 1) {
            const picked = await vscode.window.showQuickPick(names, {
                title: 'FTP Deploy — Remove password from keychain',
            });
            if (!picked)
                return;
            profileName = picked;
        }
        await (0, secrets_1.deletePassword)(context, profileName);
        vscode.window.showInformationMessage(`FTP Deploy: password for profile "${profileName}" removed from keychain`);
    });
    // ── Test connessione ────────────────────────────────────────────────────────
    const testCmd = vscode.commands.registerCommand('ftpDeploy.testConnection', async () => {
        const cfg = await resolveActiveConfig();
        if (!cfg)
            return;
        const client = getClient(cfg, logger);
        try {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `FTP Deploy: test [${statusBar.active}]…` }, async () => { await client.connect(cfg); await client.close(); });
            vscode.window.showInformationMessage(`FTP Deploy [${statusBar.active}]: ${cfg.host} OK ✓`);
            logger.info(`Connection test OK — profile: ${statusBar.active}, host: ${cfg.host}`);
        }
        catch (e) {
            vscode.window.showErrorMessage(`FTP Deploy: connection failed — ${e}`);
            logger.error(`Connection test failed: ${e}`);
        }
    });
    // ── Mostra log ──────────────────────────────────────────────────────────────
    const showLogCmd = vscode.commands.registerCommand('ftpDeploy.showLog', () => logger.show());
    // ── Apri configurazione workspace ───────────────────────────────────────────
    const openConfigCmd = vscode.commands.registerCommand('ftpDeploy.openConfig', async () => {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!wsRoot) {
            logger.warn('No workspace open');
            vscode.window.showWarningMessage('FTP Deploy: no workspace open');
            return;
        }
        const vscodeDirUri = vscode.Uri.joinPath(wsRoot, '.vscode');
        const settingsUri = vscode.Uri.joinPath(vscodeDirUri, 'settings.json');
        // Crea .vscode/ e settings.json con template se non esistono
        try {
            await vscode.workspace.fs.createDirectory(vscodeDirUri);
        }
        catch { }
        let exists = false;
        try {
            await vscode.workspace.fs.stat(settingsUri);
            exists = true;
        }
        catch { }
        if (!exists) {
            const template = [
                '{',
                '  // ── FTP Deploy ──────────────────────────────────────────────────────',
                '  "ftpDeploy.profiles": {',
                '    "dev": {',
                '      "protocol": "ftp",',
                '      "host": "192.168.1.100",',
                '      "port": 21,',
                '      "user": "ftpuser",',
                '      // password: use the "FTP Deploy: Save password to keychain" command',
                '      "remotePath": "/var/www/myapp",',
                '      "localRoot": "",',
                '      "uploadOnSave": true,',
                '      "passive": true,',
                '      "ignore": [".git", "node_modules", ".vs", "*.user", "Thumbs.db"]',
                '    }',
                '  }',
                '}',
            ].join('\n');
            await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(template, 'utf8'));
        }
        const doc = await vscode.workspace.openTextDocument(settingsUri);
        await vscode.window.showTextDocument(doc);
    });
    // ── Ricarica configurazione ─────────────────────────────────────────────────
    const reloadConfigCmd = vscode.commands.registerCommand('ftpDeploy.reloadConfig', async () => {
        const profiles = await (0, profiles_1.loadProfiles)(logger);
        const names = Object.keys(profiles);
        if (names.length === 0) {
            logger.warn('No profiles configured');
            vscode.window.showWarningMessage('FTP Deploy: no profiles configured');
            return;
        }
        const previousProfile = statusBar.active;
        if (!profiles[previousProfile]) {
            const fallback = names[0];
            statusBar.setProfile(fallback);
            await context.workspaceState.update('activeProfile', fallback);
            logger.info(`Profile "${previousProfile}" not found after reload, using "${fallback}"`);
        }
        logger.info(`Configuration reloaded: ${names.length} profile(s), active "${statusBar.active}"`);
        vscode.window.showInformationMessage(`FTP Deploy: configuration reloaded — ${names.length} profile(s), active "${statusBar.active}"`);
    });
    // ── Wizard: aggiungi profilo ─────────────────────────────────────────────────
    const addProfileCmd = vscode.commands.registerCommand('ftpDeploy.addProfile', async () => {
        // Nome profilo
        const name = await vscode.window.showInputBox({
            title: 'FTP Deploy — Add profile (1/5)',
            prompt: 'Profile name (e.g. dev, staging, prod)',
            placeHolder: 'dev',
            ignoreFocusOut: true,
        });
        if (!name)
            return;
        // Protocollo
        const proto = await vscode.window.showQuickPick([
            { label: 'ftp', description: 'Standard FTP (port 21)' },
            { label: 'ftps', description: 'FTP over TLS (port 21 STARTTLS or 990 implicit)' },
            { label: 'sftp', description: 'SFTP over SSH (port 22)' },
        ], { title: 'FTP Deploy — Add profile (2/5)', placeHolder: 'Select protocol' });
        if (!proto)
            return;
        // Host
        const host = await vscode.window.showInputBox({
            title: 'FTP Deploy — Add profile (3/5)',
            prompt: 'Server hostname or IP address',
            placeHolder: '192.168.1.100',
            ignoreFocusOut: true,
        });
        if (!host)
            return;
        // User
        const user = await vscode.window.showInputBox({
            title: 'FTP Deploy — Add profile (4/5)',
            prompt: 'Username',
            ignoreFocusOut: true,
        });
        if (!user)
            return;
        // Remote path
        const remotePath = await vscode.window.showInputBox({
            title: 'FTP Deploy — Add profile (5/5)',
            prompt: 'Remote folder on the server (absolute POSIX path)',
            placeHolder: '/var/www/myapp',
            ignoreFocusOut: true,
        });
        if (!remotePath)
            return;
        // Costruisci il blocco da aggiungere
        const defaultPort = proto.label === 'sftp' ? 22 : 21;
        const newProfile = {
            protocol: proto.label,
            host,
            port: defaultPort,
            user,
            remotePath,
            uploadOnSave: true,
            passive: true,
            ignore: ['.git', 'node_modules', '.vs', '*.user', 'Thumbs.db'],
        };
        // Leggi il settings.json attuale e aggiungi il profilo
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!wsRoot)
            return;
        const settingsUri = vscode.Uri.joinPath(wsRoot, '.vscode', 'settings.json');
        let settings = {};
        try {
            const raw = await vscode.workspace.fs.readFile(settingsUri);
            // Parsing robusto: rimuove commenti stile // prima del JSON.parse
            const cleaned = Buffer.from(raw).toString('utf8').replace(/\/\/[^\n]*/g, '');
            settings = JSON.parse(cleaned);
        }
        catch {
            settings = {};
        }
        if (!settings['ftpDeploy.profiles'] || typeof settings['ftpDeploy.profiles'] !== 'object') {
            settings['ftpDeploy.profiles'] = {};
        }
        settings['ftpDeploy.profiles'][name] = newProfile;
        await vscode.workspace.fs.writeFile(settingsUri, Buffer.from(JSON.stringify(settings, null, 2), 'utf8'));
        // Offri subito di salvare la password nel keychain
        const savePwd = await vscode.window.showInformationMessage(`Profile "${name}" added ✓ — Save the password to keychain now?`, 'Yes, save password', 'Later');
        if (savePwd === 'Yes, save password') {
            await (0, secrets_1.promptAndSavePassword)(context, name, host);
        }
        // Aggiorna la status bar al nuovo profilo
        statusBar.setProfile(name);
        await context.workspaceState.update('activeProfile', name);
        // Apri il settings.json per revisione
        const doc = await vscode.workspace.openTextDocument(settingsUri);
        await vscode.window.showTextDocument(doc);
    });
    context.subscriptions.push(onSaveDisposable, selectProfileCmd, uploadFileCmd, uploadFolderCmd, uploadChangesCmd, previewChangesCmd, uploadSelectedCmd, savePasswordCmd, deletePasswordCmd, testCmd, showLogCmd, openConfigCmd, reloadConfigCmd, addProfileCmd, statusBar, { dispose: () => logger.dispose() });
}
function deactivate() { }
// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveActiveConfig(profileOverride) {
    const profiles = await (0, profiles_1.loadProfiles)(logger);
    const names = Object.keys(profiles);
    if (names.length === 0) {
        logger.error('No profiles configured in ftpDeploy.profiles');
        vscode.window.showErrorMessage('FTP Deploy: no profiles configured in ftpDeploy.profiles');
        return null;
    }
    if (profileOverride) {
        if (!profiles[profileOverride]) {
            logger.error(`Profile "${profileOverride}" not found`);
            vscode.window.showErrorMessage(`FTP Deploy: profile "${profileOverride}" not found`);
            return null;
        }
        return finalizeConfig(profileOverride, profiles[profileOverride]);
    }
    let profileName = statusBar.active;
    // Se il profilo attivo non esiste, usa il primo disponibile
    if (!profiles[profileName]) {
        const previousProfile = profileName;
        profileName = names[0];
        statusBar.setProfile(profileName);
        await extensionContext.workspaceState.update('activeProfile', profileName);
        logger.info(`Profile "${previousProfile}" not found, using "${profileName}"`);
    }
    return finalizeConfig(profileName, profiles[profileName]);
}
async function finalizeConfig(profileName, profile) {
    const password = await resolveProfilePassword(profileName, profile);
    if (password === null)
        return null;
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cfg = (0, profiles_1.profileToConfig)(profileName, profile, password, wsRoot);
    const err = (0, config_1.validate)(cfg);
    if (err) {
        logger.error(`Profile [${profileName}] validation failed: ${err}`);
        vscode.window.showErrorMessage(`FTP Deploy [${profileName}]: ${err}`);
        return null;
    }
    return cfg;
}
async function resolveProfilePassword(profileName, profile) {
    const usesSftpPrivateKey = (profile.protocol ?? 'ftp') === 'sftp' && !!profile.privateKeyPath;
    if (usesSftpPrivateKey) {
        return profile.password ?? '';
    }
    return (0, secrets_1.resolvePassword)(extensionContext, profileName, profile.host, profile.password ?? '', logger);
}
async function resolveActiveConfigForResource(resource) {
    const profiles = await (0, profiles_1.loadProfiles)(logger, resource);
    const names = Object.keys(profiles);
    if (names.length === 0) {
        logger.error('No profiles configured in ftpDeploy.profiles');
        vscode.window.showErrorMessage('FTP Deploy: no profiles configured in ftpDeploy.profiles');
        return null;
    }
    let profileName = statusBar.active;
    if (!profiles[profileName]) {
        const previousProfile = profileName;
        profileName = names[0];
        statusBar.setProfile(profileName);
        await extensionContext.workspaceState.update('activeProfile', profileName);
        logger.info(`Profile "${previousProfile}" not found for resource, using "${profileName}"`);
    }
    const profile = profiles[profileName];
    const password = await resolveProfilePassword(profileName, profile);
    if (password === null)
        return null;
    const resourceFolder = vscode.workspace.getWorkspaceFolder(resource);
    const wsRoot = resourceFolder?.uri.fsPath
        ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cfg = (0, profiles_1.profileToConfig)(profileName, profile, password, wsRoot);
    const err = (0, config_1.validate)(cfg);
    if (err) {
        logger.error(`Profile [${profileName}] validation failed: ${err}`);
        vscode.window.showErrorMessage(`FTP Deploy [${profileName}]: ${err}`);
        return null;
    }
    return cfg;
}
function isUnderRoot(filePath, localRoot) {
    const rel = path.relative(localRoot, filePath);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}
async function runUploadFile(localFile, cfg) {
    let remoteDest;
    try {
        remoteDest = (0, ftpClient_1.localToRemote)(localFile, cfg.localRoot, cfg.remotePath);
    }
    catch (e) {
        logger.error(`Remote path calculation failed: ${e}`);
        return;
    }
    const client = getClient(cfg, logger);
    const shortName = path.basename(localFile);
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `${cfg.protocol.toUpperCase()} ↑ ${shortName} [${statusBar.active}]`,
            cancellable: false,
        }, async () => {
            await client.connect(cfg);
            try {
                await client.uploadFile(localFile, remoteDest);
            }
            finally {
                await client.close();
            }
        });
        if (cfg.showNotifications) {
            vscode.window.showInformationMessage(`FTP Deploy: ${shortName} uploaded ✓`);
        }
    }
    catch (e) {
        vscode.window.showErrorMessage(`FTP Deploy: upload error ${shortName} — ${e}`);
        logger.error(`Upload failed for ${localFile}: ${e}`);
    }
}
async function runUploadDirectory(localDir, cfg) {
    const client = getClient(cfg, logger);
    const shortName = path.basename(localDir);
    let stats = { uploaded: 0, skipped: 0, errors: 0 };
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `FTP Deploy [${statusBar.active}]: uploading "${shortName}"…`,
            cancellable: false,
        }, async (progress) => {
            await client.connect(cfg);
            progress.report({ message: 'Connected, upload in progress…' });
            try {
                stats = await client.uploadDirectory(localDir, cfg.localRoot, cfg.remotePath, cfg.ignore);
            }
            finally {
                await client.close();
            }
        });
        const msg = `FTP Deploy: "${shortName}" → ${stats.uploaded} uploaded, ${stats.skipped} skipped, ${stats.errors} errors`;
        logger.info(msg);
        if (cfg.showNotifications || stats.errors > 0) {
            stats.errors > 0
                ? vscode.window.showWarningMessage(msg)
                : vscode.window.showInformationMessage(msg);
        }
    }
    catch (e) {
        vscode.window.showErrorMessage(`FTP Deploy: folder upload error — ${e}`);
        logger.error(`Upload failed for directory ${localDir}: ${e}`);
    }
}
/** One manifest per exact destination and local root. Shared by preview and upload. */
function incrementalManifestPath(context, cfg) {
    const scope = JSON.stringify([cfg.protocol, cfg.host, cfg.port, cfg.user, cfg.remotePath, path.resolve(cfg.localRoot)]);
    const key = crypto.createHash('sha256').update(scope).digest('hex');
    return path.join(context.globalStorageUri.fsPath, 'incremental', `${key}.json`);
}
//# sourceMappingURL=extension.js.map