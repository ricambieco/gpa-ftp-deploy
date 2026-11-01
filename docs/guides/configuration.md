# Profile configuration and security

The extension reads profiles from `ftpDeploy.profiles` in `.vscode/settings.json`. See [the full example](../examples/settings.jsonc).

```jsonc
{
  "ftpDeploy.profiles": {
    "staging": {
      "protocol": "ftps",
      "host": "staging.example.org",
      "port": 21,
      "user": "deploy-staging",
      "remotePath": "/site-staging",
      "localRoot": "C:\\projects\\demo-site",
      "uploadOnSave": false,
      "ftpsImplicit": false,
      "rejectUnauthorized": true,
      "ignore": [".git", "node_modules", ".env", "*.log"]
    }
  }
}
```

Use `FTP Deploy: Save password to keychain` for password-based authentication. Do **not** add passwords, private keys or tokens to committed settings. For SFTP, `privateKeyPath` is a reference to a locally stored key file, **never** the key contents. Keep `rejectUnauthorized: true` for FTPS with trusted certificates. Restrict network and deployment permissions on production systems.

Profiles can target separate remote paths. The incremental manifest is scoped to the local root and remote destination; a deployment to staging is not the same tracking baseline as production.

**Important:** The `ignore` field is used by the fork's incremental scan. Confirm that sensitive paths and build artifacts are excluded before any upload. The ignore matcher is intentionally simple; refer to its exact matching behaviour in `src/incremental.ts` rather than assuming complete `.gitignore` semantics.
