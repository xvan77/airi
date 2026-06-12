# Consolidated Changes Report (Patch 2.00)

This report documents all consolidated changes integrated from the Patch 2.00 directory into the workspace.

---

## 1. New Features

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-local-llm-setup.vue` | Creates a new onboarding step component specifically for setting up the local GGUF-based LLM runner. Inlines Electron-Eventa IPC endpoints for local server lifecycle and download monitoring. Includes Gemma 3 270M IT, Qwen 2.5 1.5B, and Llama 3.2 3B catalog definitions. | Adds a new step during the setup guide to help users download and run a local AI model for 100% private offline chats. |

---

## 2. Optimizations of Existing Files

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `apps/stage-tamagotchi/src/main/services/electron/local-llm.ts` | Implements safety improvements and parallel safety checks during local LLM server instantiation. Introduces a semaphore lock/atomic gate (`isStartingServer`) to prevent race conditions during rapid startup triggers, and implements `killAllZombies` to clean up orphaned llama-server processes on stop/shutdown. | Prevents multiple copies of the local AI engine from starting up at the same time and makes sure background server tasks are completely shut down when stopping. |
| `packages/stage-ui/src/components/scenarios/chat/ChatBrainPopover.vue` | Enhances model management popover by integrating active local server control buttons (Start/Stop Server), dynamic status polling, automatic display names, and direct shortcut button pointing to Consciousness module settings. | Adds a quick controller for the local AI server directly inside the chat settings bubble, letting you start or stop the offline brain without opening the main settings page. |
| `packages/stage-pages/src/pages/settings/modules/consciousness.vue` | Integrates inline Start/Stop server controls to manage the active `local-llm` process from the Consciousness settings page, and automatically refreshes and re-validates the provider configurations when the server state switches to `'running'`. | Adds easy start/stop buttons for the offline AI directly in the main consciousness configuration screen. |
| `packages/stage-pages/src/pages/settings/modules/speech.vue` | Displays real-time ONNX compile/download status and progress indicators for the local Kokoro speech synthesis engine within the Voice Configuration header. | Shows a loading/download percentage next to the voice settings to let you know when the offline speaker files are downloading or warming up. |

---

## 3. Errors and Bug Fixes

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `packages/stage-ui/src/stores/llm.ts` | Corrects API validation errors with strict local llama-server endpoints by guaranteeing messages follow an alternating user/assistant sequence (prepending a dummy user message if history begins with an assistant message). | Fixes communication errors with the local offline server by making sure the conversation history always alternates correctly starting with a user message. |
| `packages/stage-ui/src/stores/llm.sanitize.test.ts` | Added unit tests to assert the alternating user/assistant message pattern behavior when preprocessing messages. | Adds tests to verify that the message role alternation is handled correctly and doesn't break local LLM servers. |
| `packages/stage-ui/src/stores/chat.ts` | Automatically intercepts local network connection errors and unreachable local ports (`Failed to fetch`), injecting a user-friendly troubleshooting guide and direct link back to Consciousness Settings instead of crashing or showing raw stack traces. | Shows a helpful warning with instructions and a link to the settings page if the offline AI server goes offline, instead of displaying a cryptic error message. |
| `packages/stage-ui/src/stores/modules/consciousness.ts` | Solves local resource hogging by automatically calling the Eventa RPC server-stop endpoint when user selects a non-local LLM model/provider. Implements a self-heal clean-up loop to remove legacy GGUF mappings from remote providers in `lastSelectedModelPerProvider`. | Automatically shuts down the local AI server when you switch back to a cloud model, saving your computer's RAM and battery. |
| `packages/stage-ui/src/components/scenarios/chat/assistant-item.vue` | Updates the speech-bubble loading indicator to render descriptive text translated from `chatOrchestrator.loadingStatus` (e.g. Preparing context, Thinking) instead of a simple static loader. | Changes the chat waiting bubble to show what the AI is currently doing (like "Thinking..." or "Preparing context...") instead of just showing loading dots. |
| `packages/stage-ui/src/components/layouts/page-header.vue` | Hardens navigation history stack fallback handling; PageHeader back button now tests `window.history.state.back` and redirects back to `/settings` if no history exists, preventing blank screen lockouts when opening pages via direct link. | Fixes a bug where clicking the "Back" button in settings could break and show a blank screen if you opened the settings page from a direct link. |
| `packages/stage-layouts/src/layouts/settings.vue` | Updates back navigation trigger on settings layout header wrapper to invoke history-safe `handleBack` fallback resolver instead of forcing a blind router jump. | Protects settings panel back navigations from failing and lock-out states if no history context exists. |
| `packages/stage-ui/src/workers/kokoro/worker.ts` | Resolves file lock/corruption crashes by automatically fallback-enabling remote model queries and disabling local cached models if a model load error occurs when local-only models are active. | Automatically repairs/redownloads local voice files if they get corrupted or truncated, preventing the voice generator from breaking silently. |

---

## 4. Other

| File Changed | Technical Explanation of Changes | Colloquial Explanation of Changes |
| :--- | :--- | :--- |
| `apps/stage-tamagotchi/src/main/index.ts` | Updates settings window parameters to pass `settingsWindow` reference down to Electron chat window setup. | Plumbs settings page control logic into the core Electron bootstrap process. |
| `apps/stage-tamagotchi/src/main/windows/chat/index.ts` | Receives and injects settings window controllers during reusable chat window instantiation. | Enables the chat window to trigger settings window navigation. |
| `apps/stage-tamagotchi/src/main/windows/chat/rpc/index.electron.ts` | Defines RPC handler binding for `electronOpenSettings` trigger. | Registers the command to open the settings window from the chat interface. |
| `apps/stage-tamagotchi/src/main/windows/shared/window.ts` | Relocates local LLM service declaration initialization scope, removing it from base window bootstrapping. | Cleans up duplicated offline service initialization commands in the window manager. |
| `packages/stage-ui/src/components/markdown/markdown-renderer.vue` | Intercepts interior routing links targeting `#/settings/*` inside rendered markdown, and redirects them via Electron eventa IPC calls or local hash manipulation. Applies custom CSS styling for anchor tags inside markdown nodes. | Allows clicking settings links written in chat messages (like warning dialogs) to instantly navigate to the correct settings section. |
| `packages/stage-ui/src/components/scenarios/dialogs/onboarding/onboarding.vue` | Expands onboarding flow modes to include a dedicated `'local'` type, linking to the newly introduced local LLM setup screen and force-initializing local LLM configurations on completion. | Integrates the local offline setup option as a third path in the initial greeting setup guide. |
| `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-mode-selection.vue` | Conditionally adds a Local Setup option to the onboarding choices grid when running under Electron (`isStageTamagotchi()`). | Adds a button to select offline-only setup in the welcome screen. |
| `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue` | Bypasses API key and base URL constraints check when configuring `local-llm` provider options. | Allows setting up the local model during onboarding without prompting for API keys or addresses. |
| `packages/stage-pages/src/pages/settings/providers/chat/local-llm.vue` | Appends Gemma 3 270M IT to base model selection catalog, introduces `isStartingServer` to disable double triggers, and updates the local store to clear local models list immediately on stop. | Adds Gemma 3 to the local model download catalog and fixes UI double-clicks during startup. |
| `packages/stage-ui/src/composables/index.ts` | Re-exports `useInferenceStatus` helper composable. | Exposes inference status metrics to the layout views. |
| `packages/stage-ui/src/stores/providers.ts` | Returns empty model lists and exports `isProviderConfigured` validation state. | Allows checking if the offline provider setup is completed correctly. |
| `packages/i18n/src/locales/en/settings.yaml` | Appends i18n copy descriptions for local mode selections in onboarding. | Adds English labels for local setup choices. |
| `packages/i18n/src/locales/en/stage.yaml` | Registers localized strings for various fine-grained model pipeline loading states. | Adds English labels for thinking and preparation stages. |
