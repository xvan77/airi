# Live2D VTube + card thumbnails backup patch

Offline copy of the **slim Patch-4** work tree (stage + selector thumbnails). No preview-source v5 experiment.

## Apply base

| Field | Value |
| --- | --- |
| Parent (apply base) | `25f82d131` |
| Patch file | `live2d-vtube-expressions.patch` |
| Commit | Uncommitted at generation time — set this row after you commit |

Regenerate from repo root (stage product files only, then diff):

```sh
git add packages/i18n packages/stage-ui packages/stage-ui-live2d patches/pixi-live2d-display.patch pnpm-lock.yaml
# optional: docs/ai/runbooks/porting-legacy-dasilva-patches.md apps/stage-tamagotchi-kirie/src-web/src/renderer/App.vue
git diff --cached 25f82d131 > patches/local/live2d-vtube-expressions/live2d-vtube-expressions.patch
git reset
```

Apply on a clean tree at `25f82d131`:

```sh
git apply patches/local/live2d-vtube-expressions/live2d-vtube-expressions.patch
```

## Included

- `packages/stage-ui-live2d/` — VTube stage, zip loader, ArtMesh, expression stack, validator tweaks, thumbnail source/cache, tests
- `packages/stage-ui/` — `display-models.ts`, model selector (import unless `INVALID`, Live render / Icon toggles)
- `packages/i18n/src/locales/en/settings.yaml` — thumbnail strings
- `patches/pixi-live2d-display.patch`, `pnpm-lock.yaml`
- Optional in patch: Kirie `App.vue` init order, porting runbook

## Excluded

- `AGENTS.md`
- `start_tamagotchi_gpu.bat`
- `patches/local/patch-4-full-with-preview-wip/` (commit `a4eefeef1`, preview experiment)

## Full backup (with preview attempt)

Commit **`a4eefeef1`** — tag `patch-4-full-with-preview-wip`, folder `patches/local/patch-4-full-with-preview-wip/`.

```sh
git cherry-pick a4eefeef1
```
