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
exports.ProfileStatusBar = void 0;
exports.loadProfiles = loadProfiles;
exports.profileToConfig = profileToConfig;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
/**
 * Legge tutti i profili da ftpDeploy.profiles nel settings.json.
 * Se non ci sono profili, crea un profilo "default" dalle impostazioni flat legacy.
 */
const FALLBACK_READ_TIMEOUT_MS = 3000;
/**
 * Legge un file con un timeout, cosi uno share di rete irraggiungibile non
 * blocca il fallback all'infinito (fs.readFileSync bloccherebbe l'extension host).
 */
function readFileWithTimeout(filePath, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms reading ${filePath}`)), timeoutMs);
    });
    return Promise.race([
        require('fs/promises').readFile(filePath, 'utf8'),
        timeout,
    ]).finally(() => clearTimeout(timer));
}
/**
 * Rimuove commenti // e /* *\/ da un JSONC, tracciando se ci si trova dentro
 * una stringa JSON (con gestione dell'escape \") per non corrompere valori
 * come "**\/.vscode/**" che contengono la sequenza // senza essere un commento.
 */
function stripJsonComments(text) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        const next = text[i + 1];
        if (inString) {
            result += ch;
            if (ch === '\\') {
                // copia anche il carattere escapato cosi non si esce dalla stringa su \"
                result += next ?? '';
                i += 2;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            i++;
            continue;
        }
        if (ch === '"') {
            inString = true;
            result += ch;
            i++;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
            continue;
        }
        result += ch;
        i++;
    }
    return result;
}
async function loadProfiles(logger, resource) {
    // Prima prova via API VS Code
    const cfg = vscode.workspace.getConfiguration('ftpDeploy', resource);
    const profiles = cfg.get('profiles');
    // Non basta che esistano chiavi: su drive di rete la cache di getConfiguration()
    // può restare stale (watcher non affidabile su UNC/mapped drive) e restituire
    // un profilo con valori vuoti/vecchi. Valida che host sia valorizzato prima di fidarsi.
    const isValid = !!profiles
        && Object.keys(profiles).length > 0
        && Object.values(profiles).every((p) => !!p.host);
    if (isValid) {
        return profiles;
    }
    // Fallback: leggi settings.json direttamente (aggira bug VS Code con additionalProperties
    // e con la cache stale su drive di rete). Lettura async + timeout: uno share di rete
    // caduto non deve bloccare l'extension host, e un solo tentativo senza retry.
    try {
        const wsFolders = vscode.workspace.workspaceFolders;
        const resourceFolder = resource
            ? vscode.workspace.getWorkspaceFolder(resource)
            : undefined;
        const fallbackFolder = resourceFolder ?? wsFolders?.[0];
        if (fallbackFolder) {
            const settingsPath = require('path').join(fallbackFolder.uri.fsPath, '.vscode', 'settings.json');
            const raw = await readFileWithTimeout(settingsPath, FALLBACK_READ_TIMEOUT_MS);
            // Rimuovi commenti // e /* */ prima del parse, ignorando quelli dentro stringhe JSON
            const cleaned = stripJsonComments(raw);
            const parsed = JSON.parse(cleaned);
            const directProfiles = parsed['ftpDeploy.profiles'];
            if (directProfiles && Object.keys(directProfiles).length > 0) {
                return directProfiles;
            }
        }
    }
    catch (e) {
        logger?.error(`Failed to read .vscode/settings.json directly: ${e}`);
    }
    // Fallback legacy: config flat
    const legacyProfile = {
        protocol: cfg.get('protocol', 'ftp'),
        host: cfg.get('host', ''),
        port: cfg.get('port', 21),
        user: cfg.get('user', ''),
        password: cfg.get('password', ''),
        remotePath: cfg.get('remotePath', '/'),
        localRoot: cfg.get('localRoot', ''),
        uploadOnSave: cfg.get('uploadOnSave', true),
        confirmBeforeUpload: cfg.get('confirmBeforeUpload', true),
        ignore: cfg.get('ignore', ['.git', 'node_modules', '.vs', '*.user']),
        passive: cfg.get('passive', true),
        timeout: cfg.get('timeout', 15000),
        showNotifications: cfg.get('showNotifications', true),
        ftpsImplicit: cfg.get('ftpsImplicit', false),
        rejectUnauthorized: cfg.get('rejectUnauthorized', true),
        privateKeyPath: cfg.get('privateKeyPath', ''),
        passphrase: cfg.get('passphrase', ''),
    };
    return { default: legacyProfile };
}
/**
 * Converte un ProfileSettings in FtpConfig completo,
 * risolvendo localRoot e valori di default.
 */
function profileToConfig(name, p, resolvedPassword, workspaceRoot) {
    const protocol = p.protocol ?? 'ftp';
    const defaultPort = protocol === 'sftp' ? 22 : 21;
    const rawLocalRoot = p.localRoot ?? '';
    const localRoot = rawLocalRoot
        ? (0, config_1.normalizeLocalPath)(rawLocalRoot)
        : (workspaceRoot ?? '');
    return {
        protocol,
        host: p.host,
        port: p.port ?? defaultPort,
        user: p.user,
        password: resolvedPassword,
        remotePath: (p.remotePath ?? '/').replace(/\\/g, '/'),
        localRoot,
        uploadOnSave: p.uploadOnSave ?? true,
        confirmBeforeUpload: p.confirmBeforeUpload ?? true,
        ignore: p.ignore ?? ['.git', 'node_modules', '.vs', '*.user'],
        passive: p.passive ?? true,
        timeout: p.timeout ?? 15000,
        showNotifications: p.showNotifications ?? true,
        ftpsImplicit: p.ftpsImplicit ?? false,
        rejectUnauthorized: p.rejectUnauthorized ?? true,
        privateKeyPath: p.privateKeyPath ?? '',
        passphrase: p.passphrase ?? '',
    };
}
/**
 * Gestisce la status bar per selezionare il profilo attivo.
 */
class ProfileStatusBar {
    constructor() {
        this.currentProfile = 'default';
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'ftpDeploy.selectProfile';
        this.item.tooltip = 'FTP Deploy: click to change profile';
        this.update('default');
        this.item.show();
    }
    get active() {
        return this.currentProfile;
    }
    setProfile(name) {
        this.currentProfile = name;
        this.update(name);
        this.onChangeCallback?.(name);
    }
    onChange(cb) {
        this.onChangeCallback = cb;
    }
    update(name) {
        const icons = {
            dev: '$(debug-alt)',
            development: '$(debug-alt)',
            staging: '$(beaker)',
            stage: '$(beaker)',
            prod: '$(globe)',
            production: '$(globe)',
            default: '$(cloud-upload)',
        };
        const icon = icons[name.toLowerCase()] ?? '$(cloud-upload)';
        this.item.text = `${icon} FTP: ${name}`;
    }
    dispose() {
        this.item.dispose();
    }
}
exports.ProfileStatusBar = ProfileStatusBar;
//# sourceMappingURL=profiles.js.map