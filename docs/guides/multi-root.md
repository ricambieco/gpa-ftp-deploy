# Multi-root workspaces

The fork supports VS Code workspaces that contain more than one folder, each of which may have different FTP profiles.

Example:

```text
WORKSPACE
├── Area2_Php/       → profile area2
├── Demo_PHP/        → profile demo
└── DemoTest_PHP/    → profile demo-test
```

When an editor file is saved, profile resolution considers the workspace folder containing that file and the configured `localRoot` values. Where there is one unambiguous matching root, it uses the corresponding profile. When two equally specific profiles match different environments, the extension must not silently select the wrong environment.

Example: `Area2_Php/Ajax/example.php` should be handled by the `area2` profile, **not** by a profile whose local root belongs to `Demo_PHP`.

Test that switching between editor tabs does not direct uploads to the wrong remote path. Keep `uploadOnSave: false` for production profiles unless explicitly required.
