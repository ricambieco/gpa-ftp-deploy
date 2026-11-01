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
exports.normalizeLocalPath = normalizeLocalPath;
exports.getWorkspaceRoot = getWorkspaceRoot;
exports.getConfig = getConfig;
exports.validate = validate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Normalizza qualsiasi path locale (lettera di rete, UNC, POSIX) in
 * un path assoluto con separatori corretti per Node.js su Windows.
 *
 * Esempi:
 *   Z:\progetto            → Z:\progetto
 *   \\server\share\proj    → \\server\share\proj
 *   /z/progetto (WSL/Git)  → Z:\progetto  (euristica)
 */
function normalizeLocalPath(inputPath) {
    if (!inputPath)
        return '';
    // Rimuovi eventuali slash/backslash finali
    let p = inputPath.replace(/[/\\]+$/, '');
    // Già un path Windows assoluto (lettera o UNC) → ok
    if (/^[A-Za-z]:/.test(p) || p.startsWith('\\\\')) {
        return p;
    }
    // Path POSIX tipo /z/progetto → converti in Z:\progetto
    const posixDriveMatch = p.match(/^\/([a-zA-Z])(\/.*)?$/);
    if (posixDriveMatch) {
        const drive = posixDriveMatch[1].toUpperCase();
        const rest = (posixDriveMatch[2] || '').replace(/\//g, '\\');
        return `${drive}:${rest || '\\'}`;
    }
    // Path relativo → lo risolviamo rispetto alla workspace root
    const wsRoot = getWorkspaceRoot();
    if (wsRoot) {
        return path.resolve(wsRoot, p);
    }
    return p;
}
function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return undefined;
    // Per workspace su unità di rete il fsPath restituisce già il path UNC/drive corretto
    return folders[0].uri.fsPath;
}
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('ftpDeploy');
    const rawLocalRoot = cfg.get('localRoot', '');
    const localRoot = rawLocalRoot
        ? normalizeLocalPath(rawLocalRoot)
        : (getWorkspaceRoot() || '');
    const protocol = cfg.get('protocol', 'ftp');
    const defaultPort = protocol === 'sftp' ? 22 : 21;
    return {
        protocol,
        host: cfg.get('host', ''),
        port: cfg.get('port', defaultPort),
        user: cfg.get('user', ''),
        password: cfg.get('password', ''),
        remotePath: cfg.get('remotePath', '/').replace(/\\/g, '/'),
        localRoot,
        uploadOnSave: cfg.get('uploadOnSave', true),
        confirmBeforeUpload: cfg.get('confirmBeforeUpload', true),
        ignore: cfg.get('ignore', ['.git', 'node_modules', '.vs']),
        passive: cfg.get('passive', true),
        timeout: cfg.get('timeout', 15000),
        showNotifications: cfg.get('showNotifications', true),
        ftpsImplicit: cfg.get('ftpsImplicit', false),
        rejectUnauthorized: cfg.get('rejectUnauthorized', true),
        privateKeyPath: cfg.get('privateKeyPath', ''),
        passphrase: cfg.get('passphrase', ''),
    };
}
function validate(cfg) {
    if (!cfg.host)
        return 'ftpDeploy.host not configured';
    if (!cfg.user)
        return 'ftpDeploy.user not configured';
    if (!cfg.localRoot)
        return 'Unable to determine local root folder';
    if (cfg.protocol === 'sftp' && !cfg.privateKeyPath && !cfg.password) {
        return 'SFTP requires privateKeyPath or a password/keychain credential';
    }
    return null;
}
//# sourceMappingURL=config.js.map