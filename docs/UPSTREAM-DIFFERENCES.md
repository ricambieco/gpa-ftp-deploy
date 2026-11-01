# Upstream relationship and modification map

**Upstream:** https://github.com/gyagix/gpa-ftp-deploy  
**Proposed public fork:** https://github.com/ricambieco/gpa-ftp-deploy (create this fork on GitHub before publishing)  
**License:** MIT; retain original copyright and license notices.

The fork is a derivative, not a replacement for the upstream author's project. This mapping is based on the project's supplied candidate archive; it is not a formal Git history diff against a pinned upstream SHA.

| Area | Fork behaviour | Key source files |
| --- | --- | --- |
| Multi-root profile selection | Resource-aware config and safer local-root selection | `src/profiles.ts`, `src/extension.ts` |
| Incremental manifest | SHA-256 scan, planning and tracked deletions | `src/incremental.ts`, `src/extension.ts` |
| Queue preview | Dedicated command and webview; separate from upload | `src/incrementalPreview.ts`, `src/extension.ts` |
| Queue acknowledgement | Mark exact current file versions as tracked | `src/incremental.ts`, `src/extension.ts` |
| Baseline reset and backup | Confirmed local-only baseline reset; pre-mutation manifest backup | `src/incremental.ts`, `src/extension.ts` |
| Folder selection | Parent/child selection, mixed state, filter, bulk actions | `src/incrementalPreview.ts` |
| Regression tests | Manifest, queue and preview behaviour | `tests/` |

## Known limitations

- The v1.3.4 source webview currently contains Italian interface labels; documentation is English, but UI localization has not been changed here.
- No verified VSIX binary is included in this fork-preparation package.
- The baseline reset cannot prove remote/server equivalence.
- Documentation and code should be reviewed against an exact upstream commit after the fork is created.
