import * as ftp from 'basic-ftp';
import SftpClient = require('ssh2-sftp-client');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FtpConfig } from './config';
import { Logger } from './logger';

/**
 * Converte un path locale assoluto nel path remoto corrispondente.
 *
 * localRoot : Z:\\progetti\\myapp (o \\\\server\\share\\myapp)
 * localFile : Z:\\progetti\\myapp\\sub\\file.asp
 * remotePath: /var/www/myapp
 * -> risultato: /var/www/myapp/sub/file.asp
 */
export function localToRemote(
  localFile: string,
  localRoot: string,
  remotePath: string
): string {
  const normalRoot = localRoot.replace(/[/\\]+$/, '');
  const normalFile = localFile;
  const relative = path.relative(normalRoot, normalFile);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `File "${localFile}" is outside root folder "${localRoot}"`
    );
  }

  const posixRelative = relative.split(path.sep).join('/');
  const remoteBase = remotePath.replace(/\/+$/, '') || '/';
  return posixRelative
    ? (remoteBase === '/' ? `/${posixRelative}` : `${remoteBase}/${posixRelative}`)
    : remoteBase;
}

export interface UploadStats {
  uploaded: number;
  skipped: number;
  errors: number;
}

function expandHome(filePath: string): string {
  if (!filePath) return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export class FtpDeployClient {
  private ftpClient?: ftp.Client;
  private sftpClient?: SftpClient;
  private protocol?: FtpConfig['protocol'];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async connect(cfg: FtpConfig): Promise<void> {
    this.protocol = cfg.protocol;

    if (cfg.protocol === 'sftp') {
      await this.connectSftp(cfg);
      return;
    }

    await this.connectFtp(cfg);
  }

  private async connectFtp(cfg: FtpConfig): Promise<void> {
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

  private async connectSftp(cfg: FtpConfig): Promise<void> {
    const client = new SftpClient('gpa-ftp-deploy');
    this.sftpClient = client;

    const options: any = {
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

  async close(): Promise<void> {
    if (this.sftpClient) {
      const client = this.sftpClient;
      this.sftpClient = undefined;
      try {
        await client.end();
      } catch (e) {
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
  async uploadFile(localFile: string, remoteDest: string): Promise<void> {
    const remoteDir = path.posix.dirname(remoteDest) || '/';
    await this.ensureDir(remoteDir);

    if (this.protocol === 'sftp') {
      if (!this.sftpClient) throw new Error('SFTP client is not connected');
      await this.sftpClient.fastPut(localFile, remoteDest);
    } else {
      if (!this.ftpClient) throw new Error('FTP client is not connected');
      await this.ftpClient.uploadFrom(localFile, remoteDest);
    }

    this.logger.info(`✓ ${localFile} → ${remoteDest}`);
  }

  /** Remove one tracked remote file. Never called for unknown remote content. */
  async deleteFile(remoteDest: string): Promise<void> {
    if (this.protocol === 'sftp') {
      if (!this.sftpClient) throw new Error('SFTP client is not connected');
      await this.sftpClient.delete(remoteDest);
    } else {
      if (!this.ftpClient) throw new Error('FTP client is not connected');
      await this.ftpClient.remove(remoteDest);
    }
    this.logger.info(`Deleted tracked remote file: ${remoteDest}`);
  }

  /** Crea ricorsivamente le cartelle remote se non esistono. */
  async ensureDir(remoteDir: string): Promise<void> {
    if (!remoteDir || remoteDir === '/') return;

    if (this.protocol === 'sftp') {
      if (!this.sftpClient) throw new Error('SFTP client is not connected');
      await this.sftpClient.mkdir(remoteDir, true);
      return;
    }

    if (!this.ftpClient) throw new Error('FTP client is not connected');
    await this.ftpClient.ensureDir(remoteDir);
    // basic-ftp cambia la cwd durante ensureDir().
    await this.ftpClient.cd('/');
  }

  /**
   * Carica ricorsivamente una cartella intera rispettando la gerarchia.
   * Salta i file/cartelle che corrispondono ai pattern di ignore.
   */
  async uploadDirectory(
    localDir: string,
    localRoot: string,
    remotePath: string,
    ignorePatterns: string[]
  ): Promise<{ uploaded: number; skipped: number; errors: number }> {
    const stats = { uploaded: 0, skipped: 0, errors: 0 };
    await this._uploadDirRecursive(localDir, localRoot, remotePath, ignorePatterns, stats);
    return stats;
  }

  private async _uploadDirRecursive(
    currentLocal: string,
    localRoot: string,
    remotePath: string,
    ignorePatterns: string[],
    stats: { uploaded: number; skipped: number; errors: number }
  ): Promise<void> {
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(currentLocal, { withFileTypes: true });
    } catch (e) {
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
      } else if (entry.isFile()) {
        try {
          const remoteDest = localToRemote(localFull, localRoot, remotePath);
          await this.uploadFile(localFull, remoteDest);
          stats.uploaded++;
        } catch (e) {
          this.logger.error(`Upload error ${localFull}: ${e}`);
          stats.errors++;
        }
      }
    }
  }

  private shouldIgnore(name: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.startsWith('*')) {
        const ext = pattern.slice(1);
        if (name.endsWith(ext)) return true;
      } else if (name === pattern) {
        return true;
      }
    }
    return false;
  }
}
