# Queue management: acknowledge or reset

These actions are provided in the interactive incremental preview. **Neither operation connects to the remote server.** They change the local manifest only.

## Acknowledge selected versions (mode A)

Suppose `sample-site/orders.php` is reported as a new file, but it was already uploaded by another tool. Tick the file and choose **Acknowledge selected versions** (some button labels in v1.3.4 are currently Italian). Confirm the prompt. The extension records the file's *current SHA-256* in the manifest, treating that specific version as already deployed.

```text
Before: orders.php hash A → pending
Acknowledge: record hash A locally → not pending
Edit: orders.php hash B → pending again
```

The action validates selected paths and checks whether files changed between preview and confirmation. Because the extension cannot establish remote equality, use this only if you have manually verified the remote copy.

## Reset the queue baseline

A reset replaces the profile's baseline with a snapshot of **all currently scanned local files**. It may clear thousands of pending uploads without transferring them. This is an explicit assertion by the operator that the server is already synchronized.

**Danger:** Reset does not verify remote files; it can hide missing or outdated remote copies. Use it only after independent server verification.

## Backups and recovery

Before editing an existing manifest, the implementation writes a uniquely named `.bak` copy. To recover, stop deployment activity, identify the matching manifest and backup under the extension's storage, make a copy of both, then restore the previous manifest. Open the preview again to verify expected counts. Do not edit or delete an active manifest while a deployment runs.

## Example workflow

1. Open preview for staging.
2. Review `sample-site/` and `sample-site/reports/` candidates.
3. Select files known to be deployed and acknowledge their current versions.
4. Change one acknowledged file and run the preview again.
5. Confirm that it reappears as modified.
