# AIRI v0.9.1-stable (May 19, 2026)

This release delivers major upgrades to the Live2D interactivity engine, robust Spine model support, handy chat draft persistence, and system-level reliability fixes.

## Key Changes

### 🎨 Live2D Enhancements & Positioning Control
- **Interactive Translation**: Added drag-and-drop translation directly in the viewport for custom model positioning.
- **Zoom Gestures**: Added support for mouse wheel and trackpad zoom gestures.
- **Improved Center Positioning**: Live2D avatars now center by default, with settings sliders seamlessly synchronized to the global positioning store.
- **Idle Customization**: Implemented custom idle loop cycle subsets and standstill states.
- **Sanitization & Crash Protection**: Added index-preserving sanitization for empty motion/expression files and sanitized zip loader settings to prevent boot deadlocks.
- **Audio Integration**: Integrated leadership delegation for Live2D motion sound files.

### 🦴 Spine 2D Improvements
- **Binary Support**: Added full support for Spine 4.0+ binary format and robust version parser fallbacks.
- **Physics Fixes**: Resolved the `physics is undefined` preview generation error on Spine 4.2+ models.

### 💬 Chat & UX Quality of Life
- **Draft Autosaving**: Added trailing throttle localStorage autosave for chatbox drafts, preserving typed text across restarts/accidents.
- **Reactive Model Favorites**: Added a model favorites popover and updated the action menu/chat items.
- **Audio Specification**: Revamped the audio studio and speech configurations.
- **Performance**: Integrated critical UI optimizations for smoother renderer performance.

### ⚙️ Platform & Bundling Fixes
- **Active-Win ESM Load**: Fixed loading errors related to the `active-win` ESM wrapper.
- **i18n Flattening**: Resolved i18n bundling path flattening issues on production builds.
- **Control Strip RFC**: Published the customizable control strip design specifications, WhisperDock, and startup sequence architectures.
