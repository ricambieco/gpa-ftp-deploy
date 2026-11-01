# Contributing to the fork

This repository is a community-maintained derivative of [gyagix/gpa-ftp-deploy](https://github.com/gyagix/gpa-ftp-deploy), licensed under MIT. Keep copyright notices intact. Report fork bugs in this fork's issue tracker rather than assuming upstream ownership of the changes.

## Development

```bash
npm install
npm run compile
npm test
```

Create a feature branch. Include reproducible steps, safety impact (especially around remote deletion), test coverage and documentation changes. Never commit deployment credentials, private SSH keys, local `.vscode/settings.json` secrets or real customer information.

## Release policy

- `CANDIDATE`: implementation under test; do not publish as stable.
- `VALIDATED`: acceptance criteria and test evidence have been approved.
- `CURRENT`: explicitly promoted validated version.
- Maintain a changelog and a rollback path for manifest schema changes.
- Deliver full-source and changed-files packages when needed. Publish VSIX only after successful build and validation.
- Keep Git history attributable; authorized automated commits should use `ChatGPT <chatgpt@ricambieco.eu>` as author when requested by the repository owner.
- Project planning is managed separately from the public README; operational notes must be sanitized before publication.
