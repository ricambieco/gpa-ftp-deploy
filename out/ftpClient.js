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
exports.FtpDeployClient = void 0;
exports.localToRemote = localToRemote;
const ftp = __importStar(require("basic-ftp"));
const SftpClient = require("ssh2-sftp-client");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Converte un path locale assoluto nel path remoto corrispondente.
 *
 * localRoot : Z:\\progetti\\myapp (o \\\\server\\share\\myapp)
 * localFile : Z:\\progetti\\myapp\\sub\\file.asp
 * remotePath: /var/www/myapp
 * -> risultato: /var/www/myapp/sub/file.asp
 */
function localToRemote(localFile, localRoot, remotePath) {
    const normalRoot = localRoot.replace(/[/\\]+$/, '');
    const normalFile = localFile;
    const relative = path.relative(normalRoot, normalFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`File "${localFile}" is outside root folder "${localRoot}"`);
    }
    const posixRelative = relative.split(path.sep).join('/');
    const remoteBase = remotePath.replace(/\/+$/, '') || '/';
    return posixRelative
        ? (remoteBase === '/' ? `/${posixRelative}` : `${remoteBase}/${posixRelative}`)
        : remoteBase;
}
function expandHome(filePath) {
    if (!filePath)
        return filePath;
    if (filePath === '~')
        return os.homedir();
    if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
}
class FtpDeployClient {
    constructor(logger) {
        this.logger = logger;
    }
    async connect(cfg) {
        this.protocol = cfg.protocol;
        if (cfg.protocol === 'sftp') {
            await this.connectSftp(cfg);
            return;
        }
        await this.connectFtp(cfg);
    }
    async connectFtp(cfg) {
        const client = new ftp.Client(cfg.timeout);
        this.ftpClient = client;
        client.ftp.verbose = false;
        const isFtps = cfg.protocol === 'ftps';
        await client.access({
            host: cfg.host,
            port: cfg.port,
            user: cfg.user,
            password: cfg.password,
            secure: isFtps ? (cfg.ftpsImplicit ? 'implicit' : true) : false,
            secureOptions: isFtps
                ? { rejectUnauthorized: cfg.rejectUnauthorized ?? true }
                : undefined,
        });
        if (cfg.passive && client.ftp.socket) {
            client.ftp.socket.setKeepAlive(true, 5000);
        }
        const proto = isFtps ? 'FTPS' : 'FTP';
        this.logger.info(`${proto} connected to ${cfg.host}:${cfg.port}`);
    }
    async connectSftp(cfg) {
        const client = new SftpClient('gpa-ftp-deploy');
        this.sftpClient = client;
        const options = {
            host: cfg.host,
            port: cfg.port,
            username: cfg.user,
            readyTimeout: cfg.timeout,
        };
        if (cfg.privateKeyPath) {
            const keyPath = expandHome(cfg.privateKeyPath);
            if (!fs.existsSync(keyPath)) {
                throw new Error(`SFTP private key not found: ${keyPath}`);
            }
            options.privateKey = fs.readFileSync(keyPath);
            if (cfg.passphrase) {
                options.passphrase = cfg.passphrase;
            }
            this.logger.info(`SFTP authentication: private key ${keyPath}`);
        }
        if (cfg.password) {
            options.password = cfg.password;
            if (!cfg.privateKeyPath) {
                this.logger.info('SFTP authentication: password/keychain');
            }
        }
        if (!cfg.privateKeyPath && !cfg.password) {
            throw new Error('SFTP requires privateKeyPath or a password/keychain credential');
        }
        this.logger.info(`SFTP connecting to ${cfg.host}:${cfg.port} as ${cfg.user}`);
        await client.connect(options);
        this.logger.info(`SFTP connected to ${cfg.host}:${cfg.port}`);
    }
    async close() {
        if (this.sftpClient) {
            const client = this.sftpClient;
            this.sftpClient = undefined;
            try {
                await client.end();
            }
            catch (e) {
                this.logger.debug(`SFTP close warning: ${e}`);
            }
        }
        if (this.ftpClient) {
            const client = this.ftpClient;
            this.ftpClient = undefined;
            client.close();
        }
        this.protocol = undefined;
    }
    /** Carica un singolo file garantendo che la cartella remota esista. */
    async uploadFile(localFile, remoteDest) {
        const remoteDir = path.posix.dirname(remoteDest) || '/';
        await this.ensureDir(remoteDir);
        if (this.protocol === 'sftp') {
            if (!this.sftpClient)
                throw new Error('SFTP client is not connected');
            await this.sftpClient.fastPut(localFile, remoteDest);
        }
        else {
            if (!this.ftpClient)
                throw new Error('FTP client is not connected');
            await this.ftpClient.uploadFrom(localFile, remoteDest);
        }
        this.logger.info(`✓ ${localFile} → ${remoteDest}`);
    }
    /** Remove one tracked remote file. Never called for unknown remote content. */
    async deleteFile(remoteDest) {
        if (this.protocol === 'sftp') {
            if (!this.sftpClient)
                throw new Error('SFTP client is not connected');
            await this.sftpClient.delete(remoteDest);
        }
        else {
            if (!this.ftpClient)
                throw new Error('FTP client is not connected');
            await this.ftpClient.remove(remoteDest);
        }
        this.logger.info(`Deleted tracked remote file: ${remoteDest}`);
    }
    /** Crea ricorsivamente le cartelle remote se non esistono. */
    async ensureDir(remoteDir) {
        if (!remoteDir || remoteDir === '/')
            return;
        if (this.protocol === 'sftp') {
            if (!this.sftpClient)
                throw new Error('SFTP client is not connected');
            await this.sftpClient.mkdir(remoteDir, true);
            return;
        }
        if (!this.ftpClient)
            throw new Error('FTP client is not connected');
        await this.ftpClient.ensureDir(remoteDir);
        // basic-ftp cambia la cwd durante ensureDir().
        await this.ftpClient.cd('/');
    }
    /**
     * Carica ricorsivamente una cartella intera rispettando la gerarchia.
     * Salta i file/cartelle che corrispondono ai pattern di ignore.
     */
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
                    const remoteDest = localToRemote(localFull, localRoot, remotePath);
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
                const ext = pattern.slice(1);
                if (name.endsWith(ext))
                    return true;
            }
            else if (name === pattern) {
                return true;
            }
        }
        return false;
    }
}
exports.FtpDeployClient = FtpDeployClient;
//# sourceMappingURL=ftpClient.js.map