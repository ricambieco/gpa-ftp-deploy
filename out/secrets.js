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
exports.savePassword = savePassword;
exports.loadPassword = loadPassword;
exports.deletePassword = deletePassword;
exports.promptAndSavePassword = promptAndSavePassword;
exports.resolvePassword = resolvePassword;
const vscode = __importStar(require("vscode"));
/**
 * Chiave usata nel Secret Storage per ogni profilo.
 * Format: ftp-deploy::<profileName>
 */
function secretKey(profileName) {
    return `ftp-deploy::${profileName}`;
}
/**
 * Salva la password nel keychain OS tramite VS Code Secret Storage.
 * La password NON viene mai scritta in settings.json.
 */
async function savePassword(context, profileName, password) {
    await context.secrets.store(secretKey(profileName), password);
}
/**
 * Legge la password dal keychain.
 * Restituisce undefined se non ancora salvata.
 */
async function loadPassword(context, profileName) {
    return context.secrets.get(secretKey(profileName));
}
/**
 * Elimina la password dal keychain.
 */
async function deletePassword(context, profileName) {
    await context.secrets.delete(secretKey(profileName));
}
/**
 * Chiede la password all'utente via input box e la salva nel keychain.
 * Restituisce la password inserita, o undefined se l'utente ha annullato.
 */
async function promptAndSavePassword(context, profileName, host) {
    const password = await vscode.window.showInputBox({
        title: `FTP Deploy — Password for profile "${profileName}"`,
        prompt: `Enter the password for ${host} (will be saved to the OS keychain)`,
        password: true,
        ignoreFocusOut: true,
    });
    if (password === undefined)
        return undefined; // utente ha premuto Esc
    await savePassword(context, profileName, password);
    return password;
}
/**
 * Risolve la password per un profilo:
 * 1. Cerca nel keychain
 * 2. Se non trovata, chiede all'utente e la salva
 * 3. Se ftpDeploy.password è settata in settings, la usa SOLO come fallback
 *    (e avvisa l'utente di migrarla)
 *
 * Restituisce null se non è stato possibile ottenere la password.
 */
async function resolvePassword(context, profileName, host, passwordInSettings, logger) {
    // Prima cerca nel keychain
    const stored = await loadPassword(context, profileName);
    if (stored)
        return stored;
    // Fallback: password in chiaro nel settings (deprecato)
    if (passwordInSettings) {
        logger?.warn(`Password for profile "${profileName}" found in plaintext settings.json, consider migrating to keychain`);
        vscode.window.showWarningMessage(`FTP Deploy: the password for profile "${profileName}" is in plaintext in settings.json. ` +
            `Use the "FTP Deploy: Save password to keychain" command to migrate it.`, 'Migrate now').then(async (choice) => {
            if (choice === 'Migrate now') {
                await savePassword(context, profileName, passwordInSettings);
                vscode.window.showInformationMessage(`Password for profile "${profileName}" moved to keychain. ` +
                    `You can remove "ftpDeploy.password" from settings.json.`);
            }
        });
        return passwordInSettings;
    }
    // Niente in keychain né in settings: chiedi all'utente
    return await promptAndSavePassword(context, profileName, host) ?? null;
}
//# sourceMappingURL=secrets.js.map