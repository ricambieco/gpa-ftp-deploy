# Incremental queue preview

Run **FTP Deploy: Preview Incremental Changes** explicitly from the Command Palette. The extension opens a separate view that shows new, modified and tracked deletion candidates, as well as unchanged file counts.

This preview is **not a remote directory comparison**: the classifications come from the local snapshot and local manifest. It does not transfer data or update the remote site. The upload command remains separate and recomputes the plan.

## Example

```text
New:           2
Modified:      1
Tracked delete:1
Unchanged:    20
```

`sample-site/new.php` appears as **new** if absent from the manifest; `sample-site/orders.php` appears as **modified** if its hash differs; a removed local file appears as **tracked delete** only if its prior path was in the manifest.

Use the checkboxes to choose upload candidates to acknowledge locally, then explicitly confirm the action. Deletion rows are not candidates for the selected-version acknowledgement operation.

See [queue management](queue-management.md) for the exact impact of each button.
