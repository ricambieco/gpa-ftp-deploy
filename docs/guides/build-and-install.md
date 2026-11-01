# Build and install the fork

**Requirements:** VS Code compatible with the `engines.vscode` requirement in `package.json`, Node.js and npm. The fork must be built independently of the upstream Marketplace extension.

```powershell
git clone https://github.com/ricambieco/gpa-ftp-deploy.git
cd gpa-ftp-deploy
npm install
npm run compile
npm test
npx @vscode/vsce package
```

The `git clone` URL above will work **only after you create the public fork and publish its files**. For now, the documentation kit can be extracted locally and built in place.

To install: in VS Code select **Extensions → … → Install from VSIX…**, choose the generated `.vsix`, then reload the window. If a Marketplace copy is installed with the same extension identifier, confirm which version is actually active. When publishing under another publisher identifier, first audit the package metadata and installation/migration behaviour.

## Safe release checklist

- Confirm upstream license and notices are intact.
- Inspect `.vscode/settings.json`, release files and tracked examples for secrets.
- Run `npm run compile` and `npm test`.
- Test FTP, FTPS and SFTP against a disposable remote directory, including first run, incremental update, and deletion confirmation.
- Test queue acknowledgement, baseline reset, backup recovery and folder selection.
- Mark a release `VALIDATED` only after acceptance. Do not mark candidate builds as stable.
