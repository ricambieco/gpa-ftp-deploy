# Incremental deployment

`FTP Deploy: Upload Changes Since Last Upload` compares the current local SHA-256 snapshot with the manifest saved after previously successful operations. The command recalculates the plan immediately before upload.

## Example

Initial local files:

```text
index.php              SHA-256 A
Ajax/orders.php        SHA-256 B
Ajax/Banche/import.php SHA-256 C
```

On the **first** incremental run there is no trusted baseline, so all three local files are candidates for upload. Unknown remote files are **not** deleted.

After successful upload, change only `Ajax/orders.php` (hash B → B2), and remove `Ajax/Banche/import.php` locally:

```text
UPLOAD Ajax/orders.php
DELETE Ajax/Banche/import.php   # previously tracked file only
UNCHANGED index.php
```

The extension asks for confirmation before performing the remote operation. Failed operations are not to be represented as successful state in the manifest. Preserve the manifest (and its backup files) when migrating your VS Code user data.

## Safety model

- First-run upload is **not** proof that the remote directory exactly matches the local directory.
- Deletion candidates are restricted to previously tracked paths and are subject to confirmation.
- Symbolic links are skipped by the local scanner.
- Profile/destination changes require distinct tracking state.
- Ignore rules can affect which files are tracked; review these rules after configuration changes.

For reviewing pending operations without connecting to the server, use the [preview](queue-preview.md).
