# GPA FTP Deploy — RicambiEco community fork

**Status: v1.3.4 VALIDATED (fork release; not an upstream release).** This is a public fork of [GPA FTP Deploy by gyagix](https://github.com/gyagix/gpa-ftp-deploy), with additional deployment workflows developed by RicambiEco. This project is **not affiliated with or endorsed by the upstream maintainer**.

> The original project and its copyright notice are retained under the [MIT license](LICENSE). The fork's enhancements, documentation and release process are described below. **Do not mistake the original VS Code Marketplace listing for the fork's distribution.**

## Features

| Capability | Upstream or fork enhancement | Documentation |
| --- | --- | --- |
| FTP / FTPS / SFTP, keychain, upload on save, profile selection | Original GPA FTP Deploy baseline | [Configuration](docs/guides/configuration.md) |
| Multi-root workspace profile resolution | Fork enhancement | [Multi-root workflows](docs/guides/multi-root.md) |
| Incremental upload based on SHA-256 | Fork enhancement (v1.3.0) | [Incremental deployment](docs/guides/incremental-deployment.md) |
| Separate preview of pending changes | Fork enhancement (v1.3.2) | [Queue preview](docs/guides/queue-preview.md) |
| Acknowledge selected file versions without transfer | Fork enhancement (v1.3.3) | [Queue management](docs/guides/queue-management.md) |
| Reset local deployment baseline | Fork enhancement (v1.3.3) | [Queue management](docs/guides/queue-management.md) |
| Folder-level and nested-folder selection, mixed state and filtering | Fork enhancement (v1.3.4) | [Folder selection](docs/guides/folder-selection.md) |

## Quick start

1. Install this **fork's own compiled VSIX** after building it from source. Do not assume that the Marketplace version includes fork features.
2. Open a workspace with `.vscode/settings.json` and configure `ftpDeploy.profiles`; see [the sample](docs/examples/settings.jsonc).
3. In the Command Palette, run `FTP Deploy: Preview Incremental Changes` to review a plan.
4. Optionally acknowledge previously uploaded files or reset the baseline after verifying server contents.
5. Run `FTP Deploy: Upload Changes Since Last Upload` to compute a new plan and perform the confirmed deployment.

**Important:** The preview is separate from upload. Reset/acknowledge operations only change local tracking; they do **not** validate what is on the remote host. The first incremental run cannot safely infer and delete unknown remote files.

## Documentation

- [Documentation index](docs/README.md)
- [Installation and building the VSIX](docs/guides/build-and-install.md)
- [Configuration and security](docs/guides/configuration.md)
- [Multi-root profile selection](docs/guides/multi-root.md)
- [Incremental deployment](docs/guides/incremental-deployment.md)
- [Preview and queue semantics](docs/guides/queue-preview.md)
- [Queue actions and rollback](docs/guides/queue-management.md)
- [Folder-level selection](docs/guides/folder-selection.md)
- [Troubleshooting and verification](docs/guides/troubleshooting.md)
- [Change history](CHANGELOG.md)
- [Contribution and release policy](CONTRIBUTING.md)
- [Differences from upstream](docs/UPSTREAM-DIFFERENCES.md)

## Validation and build

The project owner confirmed a successful VSIX build and functional acceptance test on 2026-11-01. This source archive was prepared separately from that build; the compiled VSIX is not included. To reproduce the build, run `npm install`, `npm run compile`, `npm test`, then `npx @vscode/vsce package`. Confirm the generated VSIX before publishing a binary.

## License and attribution

MIT; original copyright (c) 2026 Gianluca P remains in [LICENSE](LICENSE). Enhancements are separately documented and do not transfer upstream ownership. [Original repository](https://github.com/gyagix/gpa-ftp-deploy).
