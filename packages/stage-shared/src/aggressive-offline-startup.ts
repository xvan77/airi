/** True when Tamagotchi renderer build enables aggressive offline startup. */
export function isAggressiveOfflineStartup(): boolean {
  return import.meta.env.VITE_TAMAGOTCHI_AGGRESSIVE_STARTUP === 'true'
}
