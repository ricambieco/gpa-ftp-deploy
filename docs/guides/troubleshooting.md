# Troubleshooting and verification

## Every file appears as new

The profile may have no manifest yet, or the destination, local root or profile identity may have changed. The preview is based on local tracking, not remote presence. **Do not reset blindly**; first verify the remote state or run a controlled initial upload.

## Files return after being acknowledged

Mode A intentionally tracks the exact SHA-256 of the acknowledged version. Any content change, even one byte, makes that file pending again.

## Folder checkbox shows a mixed state

At least one pending file in that folder is selected and another is not. Select or deselect the folder to apply one state to all nested pending files.

## Preview differs from actual upload

The upload command performs a fresh scan. Changes made after preview may alter the plan; check the confirmation totals before continuing.

## Deployment targets the wrong profile

Review the active profile, workspace folder, `localRoot` and `remotePath`. In multi-root workspaces, test profile selection with harmless files before enabling upload on save.

## Build fails

Regenerate dependency state with `npm install`, then run `npm run compile` and `npm test`. The source candidate may not include a lockfile suitable for `npm ci`; do not claim successful packaging until the VSIX build completes.

## Suggested acceptance tests

| Test | Expected result |
| --- | --- |
| First incremental run with no manifest | Upload candidates; no untracked remote deletions |
| Edit one tracked local file | Only changed hash becomes pending |
| Acknowledge an unchanged local version | It disappears from the pending-upload list |
| Edit the acknowledged version | It returns to the pending-upload list |
| Select `sample-site/`, deselect `sample-site/reports/` | Only files outside the child folder remain selected |
| Reset baseline (test environment only) | Local pending uploads clear without remote transfer |
| Restore backup manifest | Prior pending state is recoverable |
| Reopen preview after an edit | Fresh plan is displayed |
