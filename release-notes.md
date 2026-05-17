### **AIRI v0.9.1-stable.20260517**
**What's New**
*   **Caption System Overhaul**:
    *   Introduced colored, segmented captions with actor-aware tracking, making it easier to distinguish who is speaking.
    *   Added real-time active segment highlighting and improved the legibility of inactive text.
    *   Implemented smart caption click-through functionality for better desktop usability.
*   **Enhanced Chat & Messaging UX**:
    *   **Screenplay Actor Formatting**: Chat bubbles now support screenplay formatting with high-contrast dynamic chips, typography overrides, and actor-aware colored text segments.
    *   **Journal Moments**: Added a new Journal Moment feature enabling real-time previews and seamless LLM integration.
    *   **Timeline Management**: Implemented powerful timeline controls like "Fork & Switch", "Trim Timeline", and "Delete Following" directly from the message action menu.
    *   **Session Management**: Added inline editing for session titles and introduced a redesigned action menu with a quick retry handler.
*   **Backups & Artistry Integration**:
    *   **Manual Backups**: Fully restored the backup UI and successfully hooked it up to the main process handlers.
    *   **Autonomous Artistry**: Refined concept filtering and improved how active concepts are passed to the Director to ensure strong visual continuity.
*   **Core Stability & Tooling**:
    *   Resolved a critical PNPM hoist leak on Windows CI by migrating the i18n bundler script to the `yaml` package.
    *   Addressed various TypeScript compiler errors across the chat orchestrator and backup stores.
    *   Patched `node-gyp` to properly support Visual Studio 2026.
