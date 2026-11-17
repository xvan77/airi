/**
 * When true, Tamagotchi defers non-essential main-process windows and renderer
 * catalog or tool work until the user enables the related module or opens its UI.
 */
export const TAMAGOTCHI_AGGRESSIVE_STARTUP = true

/** How long the main process waits after first paint before MCP and extension warmup. */
export const TAMAGOTCHI_DEFERRED_WARMUP_MS = 20_000

/** How long the main window waits before loading the speech inlay renderer. */
export const TAMAGOTCHI_DEFERRED_INLAY_MS = 12_000
