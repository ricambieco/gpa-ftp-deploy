# Bulk selection by folder (v1.3.4)

In the incremental preview, a separate folder tree is derived from the *pending upload paths*. Selecting a folder selects all pending uploads beneath it, including nested subfolders. It does **not** change deletion rows.

## Example: parent and child folders

```text
Ajax/
├── orders.php
├── returns.php
└── Banche/
    ├── iban_parser.php
    └── import.php
```

1. Check **`Ajax/`**: all four pending upload files are selected.
2. Uncheck **`Ajax/Banche/`**: `orders.php` and `returns.php` stay selected; the two files under `Banche/` are unselected.
3. The `Ajax/` checkbox becomes **indeterminate** (partially selected).
4. Check `Ajax/Banche/` again: all four are selected; the parent checkbox is fully checked.
5. Type `Ajax/Banche` in the folder filter: the visible folder list narrows; the underlying selection is not implicitly changed.
6. Use **Select all** or **Deselect all** to change the entire pending-upload selection.

**Key distinction:** The folder tree only changes checkboxes. No local manifest is modified until you press **Acknowledge selected versions** and confirm. Normal incremental uploads still compute their own current plan and are not limited to the preview's temporary checkbox selection.

In v1.3.4 the extension's actual webview strings are in Italian; this guide documents behaviour in English for the public fork. See [the current release status](../README.md).
