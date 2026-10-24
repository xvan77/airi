# Runbook: Port legacy “da Silva” patches into `moeru-airi`

Use this runbook when the user asks to bring features from old patch folders into the current **moeru-ai/airi** fork (`moeru-airi` on GitHub).

## User agent policy (mandatory)

Follow this policy for every legacy port, Live2D/VTube work, and any task that uses the Escritorio patch archives.

### Where to search (in order)

| Priority | Location | Use it for |
| --- | --- | --- |
| 1 | `AIRI PATCHES LOGIC 1.txt` on Escritorio (see [Patch archive layout](#patch-archive-layout-user-machine)) | Feature order, UX goals, what “feature N” means |
| 2 | **Sent:** `Escritorio\Patches sent to DaSilva\FULL PATCH WITH ALL SENT TO DA SILVA\` — start with `SENT-ORDER-REPORT.md`, then `combined-da-silva-sent.patch` or the standalone `.patch` named in the report | **Your** shared diffs (Live2D A1/A2, expressions persistence, Kokoro, and similar) |
| 3 | **Not sent:** `Escritorio\Patches not sent to da Silva (new features)\Old da silva version patches\` plus reports (`consolidated_changes_report`, `walkthrough.md`) | **Your** private diffs (LLM, TTS, onboarding, Patch 1.01 / 2.00) |
| 4 | **This repo (`moeru-airi`)** | Where you implement. Use `rg` on paths the patch names before you re-implement |
| 5 | `C:\Users\iahum\OneDrive\Documentos\GitHub\airi` | **Secondary reference only** — see [Credit-conscious workflow](#credit-conscious-workflow-mandatory). Your **final integrated fork** (patches applied on the da Silva lineage). Use for call-site context when a hunk is unclear. Not a search root |
| 6 | `docs/ai/runbooks/porting-legacy-dasilva-patches.md` (this file) | Status tables, architecture maps, checks |

`Downloads\1. Files sent to Da silva via DM` and `Downloads\2. Files sent to Da silva in AIRI chat` are **older mirrors** of the sent bundle. Use them only when the Escritorio **FULL PATCH** folder is missing.

### Credit-conscious workflow (mandatory)

Moeru and the old da Silva fork **do not share the same architecture**. Patches alone are often enough. A full-tree search of `GitHub\airi` burns credits and is **not** the default.

1. **Read the patch** (report + hunks). State the behavior you must deliver.
2. **Map hunks to moeru paths** (`rg` in `moeru-airi` only on files the patch lists or the runbook maps).
3. **Port or adapt** in moeru. Re-read neighboring hunks in `combined-da-silva-sent.patch` when adaptation stalls.
4. **Open `GitHub\airi` only when step 3 is blocked** — for example ambiguous ownership, missing helper, or “what did this hunk call before the split?”. Read **only** the mirror paths the patch names (same relative file role). Do not run broad `rg` across the whole `airi` tree before steps 1–3.
5. **On conflict**, Escritorio archives win. Do not merge the fork or copy dasilva-only behavior without user agreement.

Reference use of `GitHub\airi` is **in scope** for port work. It is not “stealing” dasilva work: it shows the environment your patches assumed. **What you port** still comes from Escritorio patches and LOGIC 1.

**Neither source alone is enough.** `GitHub\airi` is your **last integrated tree** on the old fork — you did not keep developing past it. It still mixes dasilva333’s work with yours and it is **not** the moeru repo. Moeru’s layout (Eventa split, `core-agent`, Pinia stores, settings pages) does not match copy-paste from `GitHub\airi`. Escritorio patches are the **portable scope list** (diffs + reports). Agents still must **adapt** into moeru. See [Audio console lesson](#audio-console-lesson-patches-fork-and-moeru).

### File access (announce fork reads)

| Path | Rule |
| --- | --- |
| Escritorio archives + LOGIC 1 | Canonical scope for **what** to port |
| `moeru-airi` workspace | Canonical for **where** to implement and verify |
| `C:\Users\iahum\OneDrive\Documentos\GitHub\airi` | Allowed as **secondary** reference per [Credit-conscious workflow](#credit-conscious-workflow-mandatory). Your **final** da Silva-fork tree (patches integrated). Not canonical for **scope** (Escritorio archives still define what to port). Contains dasilva333 + your changes. **Before read**, tell the user in chat: path, file list, and reason. No silent browsing |
| **Planned moeru / da Silva backup trees** (user will add later) | Same rules as `GitHub\airi`. When this runbook lists concrete paths, use that table |
| Other Desktop logs, zips, or personal folders | Only when the user pastes a path or attaches a file — announce before read |
| Any fork as “source of truth” | **Do not.** When patch and fork disagree, **Escritorio archives win** |

### How to port patches (not improvisation)

1. **Find the patch section** in `SENT-ORDER-REPORT.md` / `combined-da-silva-sent.patch` (or the not-sent folder report for that feature).
2. **Port 1:1** when moeru’s layout matches the patch (same file role, same lifecycle, same data). Apply the same behavior the hunk describes.
3. **Adapt** when moeru and the old da Silva fork **diverge** (for example split `eventa`, `core-agent`, Live2D **Root** + `live2d.expressions` vs monolithic `Model.vue` + `activeExpressions`). The adaptation must still deliver the **same user-visible behavior** the patch documents (inputs, outputs, when it runs).
4. **When adaptation stalls** (missing API, “almost works”, wrong colors/params, unclear ownership): **stop improvising**. Re-read the patch hunk and neighbors in `combined-da-silva-sent.patch`. Compare with current moeru files. Then read the matching paths in `GitHub\airi` if needed ([Credit-conscious workflow](#credit-conscious-workflow-mandatory)). **Announce** paths before read. If still blocked, report what the patch expects and what moeru lacks — do not invent a new design.

`git apply --check` is optional archaeology. Failed hunks do **not** mean “skip the patch”. They mean **port by intent from the patch text**, with the rules above.

### Live2D / VTube quick map (sent bundle)

| Sent step | Patch intent | Moeru touchpoints (adapt, do not skip) |
| --- | --- | --- |
| A1 | `SavedActiveExpressions`, expression list refresh, preview/card behavior | `live2d-zip-loader.ts`, `Model.vue`, expression UI in stage-ui |
| A2 | ArtMesh colors from `.vtube.json`, hook after `model.update`, pixi multiply/screen shader | `vtube-artmesh-colors.ts`, `motion-manager.ts`, `patches/pixi-live2d-display.patch` |
| B1 | `expressions_persistence.patch` — do not wipe stacked expressions on reload; vtube defaults once per model | `Model.vue` + card/storage as patch describes |

## Product goals (source of truth)

Read the user’s living notes first. The current file is:

`C:\Users\iahum\OneDrive\Escritorio\Patches not sent to da Silva (new features)\AIRI PATCHES LOGIC 1.txt`

An older copy may exist as `AIRI PATCHES LOGIC.txt`. When the two differ, **LOGIC 1** wins.

### Main focus (from LOGIC 1)

| Focus | Meaning for implementation |
| --- | --- |
| Help new users | Show parameters, quantization, providers, download progress, and model state in plain language |
| Few menus and clicks | Chat controls, Consciousness quick actions, first-run “local setup” |
| No extra installs or logins for core offline use | Bundled llama-server, local TTS paths, not “install LM Studio first” |
| Low-end hardware | Small default models, safe GPU layers, Kokoro CPU limits |
| Speed | Avoid long blocking loads; parallel TTS where it helps |

### Main features (numbered like LOGIC 1)

Use this list when the user says “feature 4” or “point 5”. Do not use the old order (expressions before chat buttons).

| # | LOGIC 1 name | Intent | Moeru port status |
| --- | --- | --- | --- |
| 1 | **Local LLM** | Download and run Hugging Face GGUF inside AIRI (Tamagotchi). Show download progress, disk size, parameter count, and state (not downloaded / downloaded / server running). | **Largely done** — see [local LLM](#what-already-landed-in-moeru-airi-local-llm) |
| 2 | **Local TTS** | Same offline philosophy as LLM. Legacy fork also explored cloud TTS (Azure); moeru port prioritized **Windows SAPI** for Tamagotchi. Kokoro can stay clunky — progress, weight, and quantization UI for Kokoro remain backlog. | **Partial** — SAPI + provider done; Kokoro fixes backlog |
| 3 | **Audio studio** | Modify voices with local tools when preset voices are too limited. | **Done** as **Speech audio console** (not a separate provider menu) — see [TTS + audio console](#what-already-landed-in-moeru-airi-local-tts--audio-console) |
| 4 | **Buttons** | Change LLM and TTS from the chat composer without opening full Settings each time. | **Done** (brain + speech popovers) — see [chat buttons](#what-already-landed-in-moeru-airi-feature-4-chat-buttons) |
| 5 | **Expressions** | Live2D expressions visible in AIRI so edits in Live2D Cubism (colors, params) show on stage. | **Not ported** — study old patches; runtime already discovers some `.exp3.json` in zips |
| 6 | **Start menu** | First-run **local setup**: download a light LLM/TTS and chat quickly, then explore other options. User asks whether onboarding still exists and whether OpenRouter free models auto-work — verify in current `stage-tamagotchi` / `stage-web` before re-porting. | **Not ported** |
| 7 | **General fixes** | Optimization and error handling (chat errors, memory loops, navigation). | **Backlog** — items in [not ported yet](#not-ported-yet-use-patch-200--101-reports-as-backlog) |
| 8 | **From old patches** | Grep legacy folders for anything still useful. | Ongoing |

### Extra notes from LOGIC 1 (for agents)

- User may ask for one patch per feature in dependency order (LLM → TTS → studio → buttons → expressions → onboarding).
- Confirm with the user whether local LLM/TTS still match their goals after upstream moeru changes.
- Explain upstream **OpenAI / login / official TTS** only when the user asks; do not expand cloud scope without agreement.

## Patch archive layout (user machine)

To move **all** legacy work into **moeru-airi**, use **both** archives below. One archive alone is not enough.

| Archive | Path | Role |
| --- | --- | --- |
| **Sent to da Silva** | `C:\Users\iahum\OneDrive\Escritorio\Patches sent to DaSilva\FULL PATCH WITH ALL SENT TO DA SILVA\` | Comprehensive patches and reports for everything shared with **dasilva333** (Live2D / VTube sends, Kokoro, maintenance patches, and related). Start with `SENT-ORDER-REPORT.md` and `combined-da-silva-sent.patch`. |
| **Not sent to da Silva** | `C:\Users\iahum\OneDrive\Escritorio\Patches not sent to da Silva (new features)\Old da silva version patches\` | Patches kept on your side only (Patch 1.01 / 2.00, LLM, TTS, onboarding, chat UX, and similar). |

Downloads copies (`Downloads\1. Files sent to Da silva via DM`, `Downloads\2. Files sent to Da silva in AIRI chat`) are older mirrors of the **sent** bundle. Prefer the Escritorio **FULL PATCH** folder when it exists.

### Desktop copies vs files inside `moeru-airi`

The user keeps **canonical** patch bundles on **Escritorio** (paths in the table above). The **moeru-airi** repo is a working tree: clone again, delete the folder, or reset hard, and anything that lives **only** inside that project (agent notes, git-excluded folders, uncommitted docs) can disappear.

**Rule for agents:** always read patches and reports from **Escritorio** (and `AIRI PATCHES LOGIC 1.txt` there). If the same files also exist under `moeru-airi\docs\` or similar, treat those as **optional workspace copies**. After a project nuke, restore from Desktop, not from the repo.

### Why these archives exist (scope: **your** changes only)

The user’s **da Silva–based fork** mixes two kinds of history:

1. **Changes from dasilva333** (upstream collaborator) on the shared `airi` project.
2. **Changes the user made** on top of that fork.

**moeru-airi** must receive **only the user’s work**, not a blind copy of the whole fork.

The two Escritorio archives are the **scope boundary**:

| Archive | What it represents |
| --- | --- |
| **FULL PATCH … SENT TO DA SILVA** | Diffs the user **chose to share** with dasilva333 (plus related reports). |
| **Old da silva version patches** (not sent) | Diffs the user **kept private** while still on the da Silva lineage. |

Together they define **“mine to port”**. Port by **intent** from those patches into current `moeru-airi` packages. Do not `git merge` the old fork into moeru.

### Fork and backup snapshots (reference only)

The user keeps a local fork at `C:\Users\iahum\OneDrive\Documentos\GitHub\airi`. That tree is the **final integrated result** of their patch work on the da Silva lineage. They did **not** continue on that fork after that point. Porting now targets **moeru-airi**, which is a different architecture.

It is **not** canonical for **scope** (Escritorio sent + not-sent archives still win). It mixes dasilva333’s changes with the user’s. Agents **may** read it after patches and targeted moeru work ([Credit-conscious workflow](#credit-conscious-workflow-mandatory)). The user may add more backup roots later.

| Role | Rule |
| --- | --- |
| **What to port** | Escritorio sent + not-sent patches and LOGIC 1 |
| **Why open `GitHub\airi`** | Patch hunk unclear, or moeru layout diverged — compare the **same file role** the patch touched, not hunt the whole repo |
| **Before read** | Message the user with folder + file list + reason ([File access](#file-access-announce-fork-reads)) |
| **On conflict** | Archives win. Do not import dasilva-only behavior without user agreement |

When new backup roots exist, add a row here (path, label, for example “da Silva fork @ date”, “stock moeru @ date”):

| Label | Path | Notes |
| --- | --- | --- |
| Final integrated fork (user patches applied) | `C:\Users\iahum\OneDrive\Documentos\GitHub\airi` | Secondary reference; patch-first for moeru ports |
| *(pending)* | — | User will add more backup roots when ready |

### `Patches not sent to da Silva (new features)\` (detail)

Base folder:

`C:\Users\iahum\OneDrive\Escritorio\Patches not sent to da Silva (new features)\`

| Path | Role |
| --- | --- |
| `AIRI PATCHES LOGIC 1.txt` | Why patches exist; feature order and UX goals (source of truth) |
| `AIRI PATCHES LOGIC.txt` | Older copy; use only if LOGIC 1 is missing |
| `New moeru Airi patches\local-llm-session.patch` | **Current** moeru-airi local LLM port (preferred baseline) |
| `Old da silva version patches\Patch 1.01\` | Core offline stack: local-llm, native-tts, Kokoro, `llm.ts` sanitize |
| `Old da silva version patches\Patch 2.00\` | Onboarding local mode, brain popover, consciousness/speech UX, chat errors |
| `Old da silva version patches\11-06\` | Gemma default, brain button tweaks |
| `Old da silva version patches\13.06\` | TTS fix, speech popover |
| `07-06\`, `09-06\`, `10-06\` | Smaller QOL / local LM follow-ups |

Reports (`consolidated_changes_report *.md`, `walkthrough.md`) list **intent** and touched files. Read reports before reading `.patch` blobs.

## What already landed in moeru-airi (local LLM)

**Status: largely done** on branches such as `Local-LLM-moeru-Airi` / `Patch-2-moeru-Airi` (user naming).

Canonical diff for reuse:

- Desktop: `New moeru Airi patches\local-llm-session.patch`
- Reference commit: `b8a756693` — `Locall LLM patch`
- Regenerate (LF, matches commit exactly):

  ```bash
  git -c core.autocrlf=false format-patch -1 b8a756693 -o <dir>
  # rename 0001-Locall-LLM-patch.patch → local-llm-session.patch
  ```

  On Windows, use `git format-patch -o <dir>` or `copy /b`. Do not use PowerShell `>` redirect (UTF-16 breaks `git am`).

### Architecture map (old → current upstream)

| Concern | Legacy (patches) | Current moeru-airi |
| --- | --- | --- |
| Main process LLM | `apps/stage-tamagotchi/src/main/services/electron/local-llm.ts` | Same path; wire in `main/index.ts` via `setupLocalLlmService()` |
| IPC contracts | Monolithic `eventa.ts` | `apps/stage-tamagotchi/src/shared/eventa/local-llm.ts` + export from `eventa/index.ts` |
| Provider | `packages/stage-ui/.../local-llm/` | Same; register in `providers/index.ts`, `registry.ts`, `attributes.ts` |
| Settings page | `packages/stage-pages/.../local-llm.vue` | Same; route via provider chat settings |
| Consciousness UX | `consciousness.vue` + popovers in 2.00 | `consciousness.vue`, `consciousness-local-llm-actions.vue`, `use-local-llm-electron.ts`, `local-llm-catalog.ts` |
| Message sanitize for llama.cpp Jinja | `packages/stage-ui/src/stores/llm.ts` | **`packages/core-agent/src/messages/llama-server-chat.ts`** + fetch wrapper in `local-llm` provider |
| Chat orchestration | Older `chat.ts` / `llm` store | **`packages/stage-ui/src/stores/chat.ts`** + **`@proj-airi/core-agent`** `streamFrom` |
| i18n | `packages/i18n/src/locales/en/settings.yaml` | English only unless user asks for other locales |

### Behaviors implemented in the moeru port (check before re-porting)

- llama-server on port **39000**, Vulkan binary on Windows, **`--ctx-size` 16384** (override `AIRI_LOCAL_LLM_CTX_SIZE`)
- Model list from **disk + API** in Consciousness when server stops
- **Restart server** when user picks another GGUF while running
- **Local LLM settings** link under model list (always visible)
- **normalizeLlamaServerChatMessages** for alternating user/assistant roles

## What already landed in moeru-airi (local TTS + audio console)

**Status: done** on user branches such as `Patch-2-moeru-Airi`.

Reference commit: `4c1927eb3` — `feat(stage-tamagotchi): add native local TTS and speech audio console`

User archive (optional):

- Desktop: `New moeru Airi patches\moeru-airi-local-tts-audio-console.patch`
- Reference commit: `4c1927eb3` — `feat(stage-tamagotchi): add native local TTS and speech audio console`
- Regenerate: `git -c core.autocrlf=false format-patch -1 4c1927eb3 -o <dir>` then rename the `0001-*.patch` file

### Architecture map (legacy → current)

| Concern | Legacy (Patch 1.01 / fork) | Current moeru-airi |
| --- | --- | --- |
| Main process TTS | `native-tts.ts` | `apps/stage-tamagotchi/src/main/services/electron/native-tts.ts`; register in `main/windows/shared/window.ts` |
| IPC contracts | Monolithic `eventa.ts` | `apps/stage-tamagotchi/src/shared/eventa/native-tts.ts` + export from `eventa/index.ts` |
| Speech provider | Local audio / virtual studio | `packages/stage-ui/src/libs/providers/providers/local-audio/app-local-audio-speech.ts` (`app-local-audio-speech`) |
| Audio “studio” profiles | `virtual-audio-studio` provider page | **Audio console** on **Settings → Modules → Speech** (`speech-audio-console.vue`); hidden provider stub only for registry/tests |
| Effects on playback | Voice profile / studio routing | `packages/stage-ui/src/composables/audio/audio-effects.ts` + `Stage.vue` `onSource` (every chat segment) |
| Settings persistence | Nested `audioConsole` object | Per-field `useLocalStorageManualReset` in `speech` store (same pattern as SSML `pitch`) |
| UST (strip `*`, emojis, `~`) | Studio UST block | `transformTextForSpeech()` in `packages/stage-ui/src/stores/modules/speech.ts` |
| Types | Voice profile types | `packages/stage-ui/src/libs/speech/voice-profile.ts` (`AudioConsoleSettings`) |
| Speech module UI | Separate studio provider | `packages/stage-pages/src/pages/settings/modules/speech.vue` embeds `<SpeechAudioConsole />` |
| Slider value labels | — | `packages/ui/.../field-range.vue` uses `formattedValue` computed |

### Behaviors implemented (check before re-porting)

- **Windows SAPI** lists voices and writes WAV via `cscript` + `SpVoice` (no cloud API).
- Provider **`app-local-audio-speech`** uses Eventa `generate-native-tts` / `get-native-tts-voices`.
- **Audio console** shapes **all** assistant TTS in the stage (pitch, rate, filters, pan, UST).
- Chat TTS is **multi-segment** (one clip per sentence). Effects apply to **each** segment; do not gate effects with a flag that clears after the first `onPlaybackEnd`.
- **`AudioOutput`**: call `onStart` before `onSource` on the first buffer (`packages/audio/src/browser/audio-output.ts`).
- Legacy single-key `settings/speech/audio-console` JSON is read once when new per-field keys are first created.

### Audio console lesson (patches, fork, and moeru)

This feature is a real example of the [credit-conscious workflow](#credit-conscious-workflow-mandatory).

| Source | What it gave | What it did **not** give |
| --- | --- | --- |
| **`GitHub\airi`** | Old `virtual-audio-studio` wiring, voice-profile ideas, surrounding call sites | A working moeru port. Wrong menu shape for the user’s goal. No fix for moeru-only bugs (Pinia nested `audioConsole`, multi-segment TTS playback, `AudioOutput` callback order) |
| **Escritorio patches + LOGIC 1** | Proof the feature exists in **your** history (`native_tts_report`, Patch 1.01 speech providers, Audio Studio / console wording). Targets to grep in moeru | A single file to paste. Hunks assume the old monolithic fork |
| **moeru-airi** | Final design the user asked for in chat: **audio console under Speech playground**, not a separate speech provider in the menu | — |

**Takeaway for agents:** Read patches first to learn scope and behavior. Open matching paths in `GitHub\airi` only when a hunk is unclear. Implement and debug in moeru. Do not expect the fork alone to close the task.

## What already landed in moeru-airi (feature 4: chat buttons)

**Status: done** for brain and speech popovers in Tamagotchi desktop chat (LOGIC 1 item 4).

| Piece | Path |
| --- | --- |
| Brain popover (consciousness provider/model, favorites, local LLM start/stop) | `packages/stage-ui/src/components/scenarios/chat/chat-brain-popover.vue` |
| Speech popover (TTS provider/model/voice favorites) | `packages/stage-ui/src/components/scenarios/chat/chat-speech-popover.vue` |
| Tamagotchi Eventa session helper | `packages/stage-ui/src/composables/chat/tamagotchi-eventa-session.ts` |
| Wired in chat composer | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` |

Favorites persist in `localStorage` keys `airi:chat-model-favorites` and `airi:speech-model-favorites`.

User archive (optional):

- Repo root: `moeru-airi-chat-composer-popovers.patch`
- Desktop: `moeru-airi-chat-composer-popovers.patch`
- Reference commit: `afd6a847c` — `feat(stage-tamagotchi): add chat brain and speech composer popovers` (includes runbook in the same commit)
- Regenerate: `git -c core.autocrlf=false format-patch -1 afd6a847c -o <dir>` then rename to `moeru-airi-chat-composer-popovers.patch`

## Feature 5: Live2D expressions (not ported)

**LOGIC 1 intent:** Expressions edited in Live2D Studio must appear in AIRI (not only the default look).

**Current moeru behavior (baseline):**

- Import preview: `packages/stage-ui-live2d/src/utils/live2d-validator.ts` compares `FileReferences.Expressions` in `.model3.json` to `.exp3.json` files in the zip. Extra files → **warnings**, not errors (`0 referenced · N found` is common on custom exports).
- Runtime load: `packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts` and `packages/stage-ui-live2d/src/controls/manifest.ts` can **merge discovered** expression files into settings when loading a zip.
- Porting goal: match legacy fork UX (where expressions were visible to the user), not only silent auto-discovery.

Search old patches for expression UI and wiring before re-implementing.

### Not ported yet (use Patch 2.00 / 1.01 reports as backlog)

| Item | LOGIC 1 # | Legacy files to study | Notes |
| --- | --- | --- | --- |
| Live2D expressions UX | 5 | Patch 1.01 / 2.00, `stage-ui-live2d` | Studio color/param changes must show on stage |
| Onboarding `step-local-llm-setup.vue`, local mode | 6 | Patch 2.00, 09-06 | First-run “local setup”; confirm current onboarding first |
| Chat memory / images popovers, grounding toggle, token meter | 4 (extra) | Patch 2.00 fork `InteractiveArea` | User did not prioritize in LOGIC 1 |
| Auto-stop local server when switching provider | `consciousness.ts` in 2.00 | Saves RAM |
| Friendly chat error when server offline | `chat.ts` in 2.00 | Replace raw `Failed to fetch` |
| Kokoro worker / adapter fixes | Patch 1.01, 2.00, 13.06 | Progress UI in `speech.vue` |
| Memory / short-term sanitization | `session-store.ts`, `memory-short-term.ts` | Reduces local model loops |
| Markdown settings links in chat | `markdown-renderer.vue` | Electron navigation |
| Loading status in chat bubble | `assistant-item.vue`, `stage.yaml` | “Thinking…” text |
| `supportsTools: false` for local-llm | Discuss with user | Shrinks first-turn prompt |

## Agent workflow (every new session)

1. **Read** `AGENTS.md` and this runbook, including [User agent policy](#user-agent-policy-mandatory). Read `AIRI PATCHES LOGIC 1.txt` if the task is UX-wide.
2. **Confirm scope** with the user (one feature area per PR is easier).
3. **Locate the patch** (sent or not-sent archive). Read the report, then the `.patch` section — not the old fork first.
4. **Locate intent** in `consolidated_changes_report *.md` or `walkthrough.md` for that patch folder when present.
5. **Search current tree** for the same capability (upstream may have added something similar).

   ```bash
   # Examples
   rg "local-llm|native-tts|ChatBrainPopover|kokoro" packages apps
   ```

6. **Try apply only as archaeology** (optional):

   ```bash
   git apply --check path/to/old.patch
   ```

   If hunks fail, **port from the patch text** ([How to port patches](#how-to-port-patches-not-improvisation)). Never fight a 3-way merge across renames without a plan.

7. **Implement** using current patterns:

   - IPC: `@moeru/eventa` contracts under `apps/stage-tamagotchi/src/shared/eventa/`
   - Providers: `packages/stage-ui/src/libs/providers/providers/`
   - Settings pages: `packages/stage-pages/src/pages/settings/`
   - Chat: `packages/stage-ui/src/stores/chat.ts` + `packages/core-agent`

8. **i18n**: edit `packages/i18n/src/locales/en/settings.yaml` (and user locale only). See `packages/i18n/AGENTS.md`.

9. **Checks** (report what you ran):

   ```bash
   pnpm -F @proj-airi/stage-tamagotchi typecheck   # if Electron/main touched
   pnpm -F @proj-airi/stage-pages typecheck
   pnpm -F @proj-airi/stage-ui typecheck
   pnpm -F @proj-airi/core-agent build             # if core-agent exports changed
   pnpm exec vitest run <related tests>
   pnpm lint                                       # pre-commit runs ESLint
   ```

10. **Export patch** for the user’s archive if asked:

   ```bash
   git -c core.autocrlf=false format-patch -1 <commit> -o <dir>
   ```

   Rename the `0001-*.patch` file. On Windows, do not use PowerShell `>` redirect (UTF-16 breaks `git am`). Ask before `git commit` unless the user requests a save point.

## Rules that differ from old patches

| Old patch assumption | Current moeru-airi |
| --- | --- |
| `packages/stage-ui/src/stores/llm.ts` + `sanitizeMessages` | LLM streaming in **core-agent**; provider-specific fixes in provider `fetch` or shared `llama-server-chat.ts` |
| Single `eventa.ts` | Split eventa modules under `shared/eventa/` |
| `providers.ts` monolith | `packages/stage-ui/src/stores/providers/provider.ts` + provider-inference registry |
| No `// NOTICE:` for workarounds | Required per root `AGENTS.md` |
| Back-compat shims | Avoid; document refactors instead |

## ESLint pitfalls (Tamagotchi / Vue)

Pre-commit **fails on errors**. Common fixes when porting old code:

- `import process from 'node:process'` (not global `process`)
- Use `console.info` / `warn` / `error`, not `console.log`
- `perfectionist/sort-imports` and `sort-exports` (run `pnpm lint:fix`)
- Vue: define refs before `computed` that use them (`no-use-before-define`)
- UnoCSS order warnings: often auto-fixable

## Suggested session prompts for the user

Copy into a new chat:

```text
Fork: moeru-airi. Read docs/ai/runbooks/porting-legacy-dasilva-patches.md (User agent policy) and
AIRI PATCHES LOGIC 1.txt on Escritorio. Use BOTH archives: (1) Patches sent to DaSilva\FULL PATCH WITH ALL SENT TO DA SILVA,
(2) Patches not sent\Old da silva version patches. Port 1:1 when moeru allows; adapt when architectures differ.
Patches first; GitHub\airi only as secondary reference on the same paths the patch names—no whole-repo search. Announce fork reads in chat.
When stuck, re-read combined-da-silva-sent.patch—do not improvise. Port only MY changes—not dasilva’s fork wholesale. LOGIC 1 feature <N>: <name>. Tamagotchi unless I say otherwise.
```

Examples: `4 buttons` (done), `5 expressions`, `6 start menu local setup`, `2 Kokoro progress`.

## Git remotes (typical)

| Remote | URL |
| --- | --- |
| `origin` | User fork `xvan77/airi` |
| `upstream` | `moeru-ai/airi` |

Publish: commit on a feature branch, `git push -u origin <branch>`. Open a PR to upstream only when lint/tests pass and scope is agreed.

---

*Last updated: 2026-10-24 — patch-first workflow; `GitHub\airi` as narrow secondary reference; audio console noted as patches + fork + moeru. Update when backup roots are registered or a LOGIC 1 item moves to “done”.*
