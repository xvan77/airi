# Patch-4 full backup (includes preview attempt)

Frozen copy of commit **`a4eefeef1`** on branch `Patch-4` before preview work was removed.

| Field | Value |
| --- | --- |
| Git tag (local) | `patch-4-full-with-preview-wip` → `a4eefeef1` |
| Parent | `25f82d131` |
| Patch file | `patch-4-a4eefeef1.patch` |

Includes VTube stage work **and** the Live2D thumbnail pipeline (`live2d-preview.ts` v5, preview source keys, `display-models` refresh).

Restore for archaeology:

```sh
git cherry-pick a4eefeef1
```

Or apply the patch on `25f82d131` (verify with `git apply --check`).

Active porting should use `patches/local/live2d-vtube-expressions/` after the slim commit (no preview experiment).
