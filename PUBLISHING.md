# Publishing the validated fork release

This public fork preserves the upstream Git history. Do **not** initialize a new Git repository from the ZIP.

## From Windows PowerShell

1. Clone `https://github.com/ricambieco/gpa-ftp-deploy.git` to a **new** local folder.
2. Extract this archive to a different folder; copy all its contents **except `.git`** into the clone. Preserve the clone's `.git` directory.
3. Review `git status --short`, `git diff --stat`, `git diff --check` and inspect the changed files.
4. Do not commit private credentials, local settings, secret keys, `node_modules`, or compiled `.vsix` packages.
5. Run `npm install`, `npm run compile`, and `npm test` on the clone.
6. Commit with the authorized author and push to the fork after reviewing the diff:

```powershell
git remote -v
git switch main
git pull --ff-only origin main
git status --short
git add -A
git diff --cached --check
git diff --cached --stat
git -c user.name=ChatGPT -c user.email=chatgpt@ricambieco.eu commit --author="ChatGPT <chatgpt@ricambieco.eu>" -m "feat: publish validated FTP Deploy v1.3.4 fork enhancements and English documentation"
git push origin main
```

7. Verify the push and then create a GitHub Release with tag `v1.3.4`. Attach only the tested VSIX from the validated local build. Describe the differences from the original project and the validation performed.

## Project status

`VALIDATED` applies to the owner's accepted v1.3.4 implementation. `CURRENT` is recorded only after release promotion under the project's shared release policy.
