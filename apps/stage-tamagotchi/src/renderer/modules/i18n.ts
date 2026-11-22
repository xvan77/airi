import messages from '@proj-airi/i18n/locales'

import { createFallbackOptions, resolveInitialUserLocale } from '@proj-airi/i18n'
import { createI18n } from 'vue-i18n'

function getLocale() {
  return resolveInitialUserLocale(
    localStorage.getItem('settings/language'),
    Object.keys(messages!),
  )
}

export const i18n = createI18n({
  legacy: false,
  locale: getLocale(),
  messages,
  ...createFallbackOptions(console.warn),
})
