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
exports.SftpDeployClient = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SftpClient = require('ssh2-sftp-client');
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ftpClient_1 = require("./ftpClient");
class SftpDeployClient {
    constructor(logger) {
        this.client = new SftpClient();
        this.logger = logger;
    }
    async connect(cfg) {
        const opts = {
            host: cfg.host,
            port: cfg.port || 22,
            username: cfg.user,
        };
        if (cfg.privateKeyPath) {
            opts.privateKey = fs.readFileSync(cfg.privateKeyPath);
            if (cfg.passphrase) {
                opts.passphrase = cfg.passphrase;
            }
        }
        else {
            opts.password = cfg.password;
        }
        await this.client.connect(opts);
        this.logger.info(`SFTP connected to ${cfg.host}:${cfg.port || 22}`);
    }
    close() {
        this.client.end().catch(() => { });
    }
    async uploadFile(localFile, remoteDest) {
        const remoteDir = remoteDest.substring(0, remoteDest.lastIndexOf('/')) || '/';
        await this.client.mkdir(remoteDir, true);
        await this.client.put(localFile, remoteDest);
        this.logger.info(`✓ ${localFile} → ${remoteDest}`);
    }
    async uploadDirectory(localDir, localRoot, remotePath, ignorePatterns) {
        const stats = { uploaded: 0, skipped: 0, errors: 0 };
        await this._uploadDirRecursive(localDir, localRoot, remotePath, ignorePatterns, stats);
        return stats;
    }
    async _uploadDirRecursive(currentLocal, localRoot, remotePath, ignorePatterns, stats) {
        let entries;
        try {
            entries = fs.readdirSync(currentLocal, { withFileTypes: true });
        }
        catch (e) {
            this.logger.error(`Failed to read directory: ${currentLocal}: ${e}`);
            stats.errors++;
            return;
        }
        for (const entry of entries) {
            const localFull = path.join(currentLocal, entry.name);
            if (this.shouldIgnore(entry.name, ignorePatterns)) {
                this.logger.debug(`Skip (ignore): ${localFull}`);
                stats.skipped++;
                continue;
            }
            if (entry.isDirectory()) {
                await this._uploadDirRecursive(localFull, localRoot, remotePath, ignorePatterns, stats);
            }
            else if (entry.isFile()) {
                try {
                    const remoteDest = (0, ftpClient_1.localToRemote)(localFull, localRoot, remotePath);
                    await this.uploadFile(localFull, remoteDest);
                    stats.uploaded++;
                }
                catch (e) {
                    this.logger.error(`Upload error ${localFull}: ${e}`);
                    stats.errors++;
                }
            }
        }
    }
    shouldIgnore(name, patterns) {
        for (const pattern of patterns) {
            if (pattern.startsWith('*')) {
                if (name.endsWith(pattern.slice(1)))
                    return true;
            }
            else {
                if (name === pattern)
                    return true;
            }
        }
        return false;
    }
}
exports.SftpDeployClient = SftpDeployClient;
//# sourceMappingURL=sftpClient.js.map