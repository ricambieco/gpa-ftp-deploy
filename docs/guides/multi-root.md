# Multi-root workspaces

The fork supports VS Code workspaces that contain more than one folder, each of which may have different FTP profiles.

Example:

```text
WORKSPACE
├── Example_Web/       → profile web
├── Example_API/        → profile demo
└── Example_Staging/    → profile demo-test
```

When an editor file is saved, profile resolution considers the workspace folder containing that file and the configured `localRoot` values. Where there is one unambiguous matching root, it uses the corresponding profile. When two equally specific profiles match different environments, the extension must not silently select the wrong environment.

Example: `Example_Web/sample-site/example.php` should be handled by the `web` profile, **not** by a profile whose local root belongs to `Example_API`.

Test that switching between editor tabs does not direct uploads to the wrong remote path. Keep `uploadOnSave: false` for production profiles unless explicitly required.
