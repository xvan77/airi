# Runbook: Port legacy “da Silva” patches into `moeru-airi`

Use this runbook when the user asks to bring features from old patch folders into the current **moeru-ai/airi** fork (`moeru-airi` on GitHub). Do **not** replay patch files line by line unless they apply cleanly.

## Product goals (source of truth)

Read the user’s living notes first:

`C:\Users\iahum\OneDrive\Escritorio\Patches not sent to da Silva (new features)\AIRI PATCHES LOGIC.txt`

Summary:

| Goal | Meaning for implementation |
| --- | --- |
| Low friction for non-experts | Show model size, quantization, download progress, server on/off clearly |
| Few menus / clicks | Chat popovers, quick actions in Consciousness, onboarding “local setup” |
| No external apps or logins for core offline use | Bundled llama-server, local TTS paths, not “install LM Studio first” |
| Low-end hardware | Small default models (Gemma 270M), GPU layers where safe, Kokoro CPU limits |
| Speed | Parallel TTS, pre-warm Kokoro, avoid blocking UI on long downloads |

Feature areas from that file:

1. **Local LLM** — download GGUF inside AIRI, run llama-server (Tamagotchi).
2. **Local TTS** — Windows SAPI in Tamagotchi (**done**); Kokoro worker fixes still backlog.
3. **Audio console** — global Speech panel effects + UST cleanup (**done** in moeru port).
4. **Expressions** — Live2D expressions visible in AIRI (check old patches).
5. **Chat buttons** — brain/speech popovers, start/stop without opening full settings.
6. **Start menu / onboarding** — “local setup” path on first run.
7. **General fixes** — memory sanitization, chat errors, navigation, performance.
8. **Misc** — grep old patches for anything still useful.

## Patch archive layout (user machine)

Base folder:

`C:\Users\iahum\OneDrive\Escritorio\Patches not sent to da Silva (new features)\`

| Path | Role |
| --- | --- |
| `AIRI PATCHES LOGIC.txt` | Why patches exist; prioritize UX goals |
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

- Repo: `local-llm-session.patch` (regenerate with `git diff <parent>..HEAD > local-llm-session.patch` after new commits)
- Desktop copy: `New moeru Airi patches\local-llm-session.patch`

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

- Desktop: `moeru-airi-local-tts-audio-console.patch`
- Regenerate: `git format-patch -1 4c1927eb3 --stdout > local-tts-audio-console.patch`

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

## What already landed in moeru-airi (chat composer shortcuts)

**Status: partial** — brain and speech popovers in Tamagotchi desktop chat.

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
- Regenerate (stage only these paths, then unstage):

  ```bash
  git add packages/stage-ui/src/components/scenarios/chat/chat-brain-popover.vue \
    packages/stage-ui/src/components/scenarios/chat/chat-speech-popover.vue \
    packages/stage-ui/src/composables/chat/tamagotchi-eventa-session.ts \
    packages/stage-ui/src/components/scenarios/chat/index.ts \
    apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue
  git diff --cached -p --output=moeru-airi-chat-composer-popovers.patch
  git restore --staged <same paths>
  ```

### Not ported yet (use Patch 2.00 / 1.01 reports as backlog)

| Item | Legacy files to study | Notes |
| --- | --- | --- |
| Chat memory / images popovers, grounding toggle, token meter | Patch 2.00 fork `InteractiveArea` | Not in moeru port yet |
| Onboarding `step-local-llm-setup.vue`, local mode | Patch 2.00, 09-06 | First-run “local setup” |
| Auto-stop local server when switching provider | `consciousness.ts` in 2.00 | Saves RAM |
| Friendly chat error when server offline | `chat.ts` in 2.00 | Replace raw `Failed to fetch` |
| Kokoro worker / adapter fixes | Patch 1.01, 2.00, 13.06 | Progress UI in `speech.vue` |
| Memory / short-term sanitization | `session-store.ts`, `memory-short-term.ts` | Reduces local model loops |
| Markdown settings links in chat | `markdown-renderer.vue` | Electron navigation |
| Loading status in chat bubble | `assistant-item.vue`, `stage.yaml` | “Thinking…” text |
| `supportsTools: false` for local-llm | Discuss with user | Shrinks first-turn prompt |

## Agent workflow (every new session)

1. **Read** `AGENTS.md` and this runbook. Read `AIRI PATCHES LOGIC.txt` if the task is UX-wide.
2. **Confirm scope** with the user (one feature area per PR is easier).
3. **Locate intent** in `consolidated_changes_report *.md` or `walkthrough.md` for that patch folder.
4. **Search current tree** for the same capability (upstream may have added something similar).

   ```bash
   # Examples
   rg "local-llm|native-tts|ChatBrainPopover|kokoro" packages apps
   ```

5. **Try apply only as archaeology** (optional):

   ```bash
   git apply --check path/to/old.patch
   ```

   If hunks fail, **port by intent** into current files. Never fight a 3-way merge across renames without a plan.

6. **Implement** using current patterns:

   - IPC: `@moeru/eventa` contracts under `apps/stage-tamagotchi/src/shared/eventa/`
   - Providers: `packages/stage-ui/src/libs/providers/providers/`
   - Settings pages: `packages/stage-pages/src/pages/settings/`
   - Chat: `packages/stage-ui/src/stores/chat.ts` + `packages/core-agent`

7. **i18n**: edit `packages/i18n/src/locales/en/settings.yaml` (and user locale only). See `packages/i18n/AGENTS.md`.

8. **Checks** (report what you ran):

   ```bash
   pnpm -F @proj-airi/stage-tamagotchi typecheck   # if Electron/main touched
   pnpm -F @proj-airi/stage-pages typecheck
   pnpm -F @proj-airi/stage-ui typecheck
   pnpm -F @proj-airi/core-agent build             # if core-agent exports changed
   pnpm exec vitest run <related tests>
   pnpm lint                                       # pre-commit runs ESLint
   ```

9. **Export patch** for the user’s archive if asked:

   ```bash
   git diff <upstream-base-commit>..HEAD > local-llm-session.patch
   git format-patch -1 <commit> --stdout > local-tts-audio-console.patch
   ```

   Ask before `git commit` unless the user requests a save point.

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
Fork: moeru-airi. Read docs/ai/runbooks/porting-legacy-dasilva-patches.md and
AIRI PATCHES LOGIC on my Desktop. Port <FEATURE> from Old da silva version patches/Patch 2.00
by intent, not line-by-line. Tamagotchi only unless I say otherwise.
```

Replace `<FEATURE>` with: `chat brain popover`, `onboarding local setup`, `Kokoro progress`, `Live2D expressions`, etc.

## Git remotes (typical)

| Remote | URL |
| --- | --- |
| `origin` | User fork `xvan77/airi` |
| `upstream` | `moeru-ai/airi` |

Publish: commit on a feature branch, `git push -u origin <branch>`. Open a PR to upstream only when lint/tests pass and scope is agreed.

---

*Last updated: local TTS (Windows SAPI), Speech audio console, multi-segment playback effects (`4c1927eb3`). Update when a feature area moves from “not ported” to “done”.*
