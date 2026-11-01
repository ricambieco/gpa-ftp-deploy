# Changelog — RicambiEco fork

The version history below applies to the RicambiEco fork, not the upstream repository. Version 1.3.4 was validated by the project owner after a successful VSIX build and functional acceptance test. Earlier entries describe the progression of the fork; they are not upstream releases.

## v1.3.4 — 2026-11-01 — Validated
- Added a folder tree to the incremental preview. Checking `Ajax/` selects files under `Ajax/` and nested folders such as `Ajax/Banche/`.
- Added individual nested-folder deselection, three-state parent checkboxes, folder filtering and select-all/deselect-all actions.
- Group selection only modifies the preview selection; the manifest changes after the user explicitly acknowledges selected versions.
- Retained the separate upload command and remote-deletion safeguards.

## v1.3.3 — 2026-11-01 — Candidate
- Added checkbox selection for pending uploads in the preview and a command to acknowledge selected **current SHA-256 versions** as already deployed.
- Added a local baseline reset action with confirmation. Reset does not scan or modify the remote server.
- Added backups of existing manifests before queue-management mutations and checks for files changing while confirmation is in progress.
- Excluded versions return to the queue when their file content changes.

## v1.3.2 — 2026-10-31 — Candidate
- Added `FTP Deploy: Preview Incremental Changes`, a separate view of new, modified, unchanged and tracked-for-deletion files.
- Preview does not upload, delete or automatically open when incremental upload is launched.
- Preview and upload use the same profile-scoped manifest location, and upload recalculates the plan.

## v1.3.0 — 2026-10-20 — Candidate
- Added `FTP Deploy: Upload Changes Since Last Upload` with SHA-256 tracking and profile/destination scoping.
- Added confirmation, retry behaviour, ignored-path handling and no-following-symlinks scanning.
- Remote deletions are limited to paths recorded in the previous manifest; an initial run does not delete untracked remote content.

## Earlier fork work — multi-root profile resolution
- Added resource-aware workspace config resolution for files saved in VS Code multi-root workspaces.
- Prefer the active matching profile; avoid guessing when multiple equally specific profiles could target different environments.
- See [multi-root](docs/guides/multi-root.md) for examples and safety conditions.

## Original baseline
Based on the original [gyagix/gpa-ftp-deploy](https://github.com/gyagix/gpa-ftp-deploy) implementation. Original copyright and MIT license retained.
