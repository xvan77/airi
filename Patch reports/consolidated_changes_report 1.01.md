# Consolidated Changes Report (Updated)

This report documents all consolidated changes integrated from the Patch 1 directory into the workspace, including the updated fix for local Kokoro TTS models.

---

## 1. New Features

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `apps/stage-tamagotchi/src/main/services/electron/local-llm.ts` | Implements main-process bindings to download, unpack, start, stop, and monitor a local Vulkan-optimized Llama.cpp server (`llama-server.exe`), scanning for discrete GPUs and offloading calculations via `--n-gpu-layers 99`. | Adds a local AI brain service that lets AIRI run on your computer's graphics card (GPU) for fast offline chats. |
| `apps/stage-tamagotchi/src/main/services/electron/native-tts.ts` | Creates a main-process service that calls Windows Speech API (SAPI) using a lightweight VBScript script executed via `cscript` instead of heavy PowerShell processes. | Creates a very fast, offline voice reader that speaks using Windows' built-in system voices. |
| `packages/stage-pages/src/pages/settings/providers/chat/local-llm.vue` | Introduces a frontend settings page to choose models, download GGUF models, view download progress, import custom URLs, and control/delete local LLM files. | Adds a settings screen where you can download, choose, and manage local AI models on your computer. |
| `packages/stage-ui/src/libs/providers/providers/local-llm/index.ts` | Declares and registers the local offline LLM provider metadata, mapping it to port `39000` with V1-compatible routing properties. | Registers the local offline chat provider in AIRI's internal engine. |
| `packages/stage-ui/src/libs/providers/providers/speech/app-local-audio-speech.ts` | Implements the frontend local speech provider, mapping `xsai` text-to-speech calls to the main Electron SAPI process. | Connects the interface's speech requests to the newly created offline voice reader. |

---

## 2. Optimizations of Existing Files

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `packages/pipelines-audio/src/processors/tts-chunker.ts` | Reconfigured `minimumWords` from 4 to 3, `maximumWords` from 12 to 10, and added soft punctuation split thresholds (commas, semicolons). | Splits long texts into smaller, more natural-sounding phrase groups so the speaker starts speaking quicker. |
| `packages/pipelines-audio/src/speech-pipeline.ts` | Parallelized TTS synthesis from audio playback using promise chains (`prevTtsPromise` / `currentTtsPromise`), synthesizing upcoming sentences in the background. | Prevents voices from stuttering or pausing by preparing the next sentence's audio while the current one is playing. |
| `packages/stage-ui/src/workers/kokoro/worker.ts` | Limits ONNX Runtime WASM threads dynamically to half of CPU cores (max 4) and sets log levels to `'error'` to minimize print statement overhead. | Keeps the local speech reader from using 100% of your CPU, preventing the computer from freezing. |
| `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` | Added a `100ms` yield cooldown inside the generation loop mutex. | Prevents graphics card crash errors (`DXGI_DEVICE_HUNG`) when the local voice generator runs too quickly on Windows. |
| `packages/stage-ui/src/stores/modules/speech.ts` | Implements an eager pre-warming watch hook that calls `loadModel` when Kokoro is selected, rather than waiting for the first request. | Loads the voice files into memory immediately, making the very first speech response instantaneous. |

---

## 3. Errors and Bug Fixes

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `packages/stage-ui/src/stores/chat/session-store.ts` | Sanitizes daily memory continuity context blocks by stripping out system tags (`[TOOL_REQUEST]`, `<\|ACT:...\|>`) before injection. | Fixes a bug where local AI models would get stuck repeating greetings (like "Nya!") by cleaning system labels out of its memory. |
| `packages/stage-ui/src/stores/memory-short-term.ts` | Introduces clean-up regex for transcripts and summaries, and adds strict instructions forcing daily summaries to be written in the neutral third person. | Instructs the AI summarizer to record history neutrally (not saying "I did this" or using character catchphrases) so it doesn't cause loop repetitions. |
| `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` | Standardized voice configuration syncing, resolved Temporal Dead Zone warnings, and auto-selects valid fallback SAPI voices. | Fixes settings reversion issues where selected local voices were ignored or reset back to default. |
| `apps/stage-tamagotchi/src/renderer/pages/index.vue` | Removed the `-y` coordinate inversion for Live2D model positioning computations. | Fixes alignment so Live2D and VRM models align properly rather than moving in opposite vertical directions. |
| `packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue` | Standardized Live2D coordinates calculations and updated logic check methods from `isNaN` to `Number.isNaN`. | Fixes character positioning errors on the settings slider and makes checking coordinates safer. |
| `packages/stage-ui/src/stores/llm.ts` | Integrates strict message role merging and system prompt consolidation into `sanitizeMessages` for llama-server compatibility. | Fixes "400 Bad Request" errors when communicating with local Llama servers by ensuring consecutive messages don't break strict API rules. |
| `packages/stage-pages/src/pages/settings/modules/consciousness.vue` | Added an alert banner and status indicator that polls the server status and prompts users to start the local LLM server when offline. | Shows an warning banner on the settings page if the local server is offline, with a button to turn it on. |

---

## 4. Other

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `apps/stage-tamagotchi/src/main/services/electron/index.ts` | Registers and exports `local-llm` and `native-tts` service bootstrap bindings in the Electron main process lifecycle. | Plumbs the new offline voice and text services into the app's startup sequence. |
| `apps/stage-tamagotchi/src/main/windows/shared/window.ts` | Exposes the Eventa `ipcRenderer` web preferences when creating client windows. | Connects Electron's main process window structure to the frontend logic safely. |
| `apps/stage-tamagotchi/src/shared/eventa.ts` | Declares shared IPC/RPC contracts for local server statuses, download progress, and fetching native TTS voice lists. | Defines the protocol/messages used by the app to talk between the interface and background services. |
| `packages/i18n/src/locales/en/settings.yaml` | Appends locale translation tokens for "App (Local LLM)", downloading models, and local server actions. | Adds the English text descriptions and labels for local LLM settings in the user interface. |
| `packages/stage-ui/src/libs/providers/providers/index.ts` | Imports and registers the local LLM provider in the main providers boot sequence. | Integrates the local LLM option into the list of available providers. |
| `packages/stage-ui/src/stores/providers.ts` | Updates validation checks to treat local offline engines (Local LLM, Native TTS) as always pre-validated. Also upgrades the local Kokoro provider from the legacy worker manager to use the new unified `KokoroAdapter` protocol and maps progress events properly. | Fixes a bug where local offline options were hidden because they lacked API keys, and resolves model-loading timeouts when launching local Kokoro voice options. |
| `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue` | Updates onboarding API key requirements validation logic to exclude `lm-studio`. | Allows setting up LM Studio on onboarding without requiring an API key. |
