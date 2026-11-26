/**
 * First-install and tray "recommended" size for the main stage window.
 *
 * Tall defaults (450×600, then 400×420) left a large empty band above Hiyori
 * when fit-model frames the upper body at the bottom. Keep this short so the
 * window hugs the character. Tray full/half height still use the aspect ratio.
 */
export const MAIN_WINDOW_DEFAULT_WIDTH = 380
export const MAIN_WINDOW_DEFAULT_HEIGHT = 300
export const MAIN_WINDOW_ASPECT_RATIO = MAIN_WINDOW_DEFAULT_WIDTH / MAIN_WINDOW_DEFAULT_HEIGHT
