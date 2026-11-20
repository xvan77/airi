export interface WindowsVoicePackDefinition {
  locale: string
  voiceNames: string
}

export interface WindowsVoicePackState extends WindowsVoicePackDefinition {
  installed: boolean
}

export interface WindowsVoiceCatalogEntry {
  id: string
  name: string
  locale: string
  installed: boolean
}

export type WindowsVoicePackInstallCode = 'ready' | 'cancelled' | 'failed'

export type WindowsVoicePackZone = 'english' | 'spanish' | 'european' | 'asian'

export interface WindowsVoicePackInstallResult {
  ok: boolean
  code: WindowsVoicePackInstallCode
}

export const WINDOWS_VOICE_PACK_ZONES: readonly WindowsVoicePackZone[] = [
  'english',
  'spanish',
  'european',
  'asian',
]

/**
 * Languages Windows can add as a text-to-speech pack.
 * `voiceNames` lists the usual voices in that pack. The PC may install a shorter set.
 */
export const WINDOWS_VOICE_PACKS: readonly WindowsVoicePackDefinition[] = [
  { locale: 'en-US', voiceNames: 'David, Mark, Zira' },
  { locale: 'en-GB', voiceNames: 'George, Hazel, Susan' },
  { locale: 'en-AU', voiceNames: 'James, Catherine' },
  { locale: 'en-CA', voiceNames: 'Richard, Linda' },
  { locale: 'en-IN', voiceNames: 'Ravi, Heera' },
  { locale: 'en-IE', voiceNames: 'Sean' },
  { locale: 'es-ES', voiceNames: 'Pablo, Helena, Laura' },
  { locale: 'es-MX', voiceNames: 'Raul, Sabina' },
  { locale: 'fr-FR', voiceNames: 'Paul, Hortense, Julie' },
  { locale: 'de-DE', voiceNames: 'Stefan, Hedda, Katja' },
  { locale: 'pt-BR', voiceNames: 'Daniel, Maria' },
  { locale: 'it-IT', voiceNames: 'Cosimo, Elsa' },
  { locale: 'ja-JP', voiceNames: 'Ichiro, Ayumi, Haruka' },
  { locale: 'zh-CN', voiceNames: 'Kangkang, Huihui, Yaoyao' },
  { locale: 'ko-KR', voiceNames: 'Heami' },
  { locale: 'ru-RU', voiceNames: 'Pavel, Irina' },
]

export function windowsVoicePackCapabilityName(locale: string): string | null {
  const pack = WINDOWS_VOICE_PACKS.find(item => item.locale === locale)
  if (!pack)
    return null
  return `Language.TextToSpeech~~~${pack.locale}~0.0.1.0`
}

export function windowsVoicePackZone(locale: string): WindowsVoicePackZone | null {
  const language = locale.split('-')[0]?.toLowerCase()
  if (!language)
    return null
  if (language === 'en')
    return 'english'
  if (language === 'es')
    return 'spanish'
  if (language === 'fr' || language === 'de' || language === 'it')
    return 'european'
  if (language === 'ja' || language === 'ko' || language === 'zh' || language === 'ru')
    return 'asian'
  return null
}

export function filterWindowsVoicePacksByZone<T extends { locale: string }>(
  packs: readonly T[],
  zone: WindowsVoicePackZone | null,
): T[] {
  if (!zone)
    return [...packs]
  return packs.filter(pack => windowsVoicePackZone(pack.locale) === zone)
}

function desktopVoiceKey(name: string): string {
  return name.toLowerCase().replace(/ desktop$/, '')
}

function catalogVoiceNames(voiceNames: string): string[] {
  return voiceNames.split(',').map(name => name.trim()).filter(Boolean)
}

function catalogVoiceId(shortName: string): string {
  return shortName.toLowerCase().startsWith('microsoft ')
    ? shortName
    : `Microsoft ${shortName}`
}

/**
 * One bubble per voice. Voices from the same locale share one Windows download.
 */
export function buildWindowsVoiceCatalog(
  packs: readonly WindowsVoicePackState[],
  installedVoices: readonly { id: string, name: string, lang: string }[],
): WindowsVoiceCatalogEntry[] {
  const installedByKey = new Map(
    installedVoices.map(voice => [desktopVoiceKey(voice.name), voice] as const),
  )
  const claimedKeys = new Set<string>()
  const entries: WindowsVoiceCatalogEntry[] = []

  for (const pack of packs) {
    for (const shortName of catalogVoiceNames(pack.voiceNames)) {
      const key = desktopVoiceKey(catalogVoiceId(shortName))
      const installed = installedByKey.get(key)
      if (installed) {
        claimedKeys.add(key)
        entries.push({
          id: installed.id,
          name: installed.name,
          locale: installed.lang || pack.locale,
          installed: true,
        })
        continue
      }
      if (pack.installed)
        continue
      entries.push({
        id: catalogVoiceId(shortName),
        name: catalogVoiceId(shortName),
        locale: pack.locale,
        installed: false,
      })
    }
  }

  for (const voice of installedVoices) {
    const key = desktopVoiceKey(voice.name)
    if (claimedKeys.has(key))
      continue
    entries.push({
      id: voice.id,
      name: voice.name,
      locale: voice.lang,
      installed: true,
    })
  }

  return entries
}

export function filterWindowsVoiceCatalogByZone(
  entries: readonly WindowsVoiceCatalogEntry[],
  zone: WindowsVoicePackZone | null,
): WindowsVoiceCatalogEntry[] {
  const filtered = !zone
    ? [...entries]
    : entries.filter(entry => windowsVoicePackZone(entry.locale) === zone)
  return filtered.sort((left, right) => {
    if (left.installed !== right.installed)
      return left.installed ? -1 : 1
    const localeCompare = left.locale.localeCompare(right.locale)
    if (localeCompare !== 0)
      return localeCompare
    return left.name.localeCompare(right.name)
  })
}

export function markWindowsVoicePacks(voices: readonly { name: string, lang: string }[]): WindowsVoicePackState[] {
  return WINDOWS_VOICE_PACKS.map((pack) => {
    const names = voices
      .filter(voice => voice.lang.toLowerCase() === pack.locale.toLowerCase())
      .map(voice => voice.name)
    return {
      ...pack,
      installed: names.length > 0,
      voiceNames: names.length > 0 ? names.join(', ') : pack.voiceNames,
    }
  })
}

const WINDOWS_LCID_TO_LOCALE: Record<string, string> = {
  '409': 'en-US',
  '0409': 'en-US',
  '809': 'en-GB',
  '0809': 'en-GB',
  'c09': 'en-AU',
  '0c09': 'en-AU',
  '1009': 'en-CA',
  '4009': 'en-IN',
  '1809': 'en-IE',
  '40a': 'es-ES',
  '040a': 'es-ES',
  'c0a': 'es-ES',
  '0c0a': 'es-ES',
  '80a': 'es-MX',
  '080a': 'es-MX',
  '40c': 'fr-FR',
  '040c': 'fr-FR',
  '407': 'de-DE',
  '0407': 'de-DE',
  '410': 'it-IT',
  '0410': 'it-IT',
  '411': 'ja-JP',
  '0411': 'ja-JP',
  '412': 'ko-KR',
  '0412': 'ko-KR',
  '804': 'zh-CN',
  '0804': 'zh-CN',
  '416': 'pt-BR',
  '0416': 'pt-BR',
  '419': 'ru-RU',
  '0419': 'ru-RU',
}

function localeFromVoiceToken(tokenName: string, languageId: string): string {
  const fromToken = tokenName.match(/_([a-z]{2})([A-Z]{2})_/)
  if (fromToken)
    return `${fromToken[1]}-${fromToken[2]}`
  return WINDOWS_LCID_TO_LOCALE[languageId.toLowerCase()] ?? ''
}

/** Read `reg query ... /s` text for OneCore voices. Works when the system language is not English. */
export function parseOneCoreRegistryListing(text: string): Array<{ id: string, name: string, lang: string, gender: string }> {
  const voices: Array<{ id: string, name: string, lang: string, gender: string }> = []
  let tokenName = ''
  let name = ''
  let gender = ''
  let languageId = ''

  function flush(): void {
    if (!tokenName || !name)
      return
    const lang = localeFromVoiceToken(tokenName, languageId)
    if (!lang)
      return
    voices.push({
      id: name,
      name,
      lang,
      gender: gender.toLowerCase() || 'neutral',
    })
  }

  for (const line of text.split(/\r?\n/)) {
    const key = line.match(/\\([^\\]+)\\Attributes\s*$/)
    if (key) {
      flush()
      tokenName = key[1] ?? ''
      name = ''
      gender = ''
      languageId = ''
      continue
    }
    if (!tokenName)
      continue
    if (line.trim() === '') {
      flush()
      tokenName = ''
      continue
    }
    const typeAt = line.indexOf('REG_')
    if (typeAt <= 0)
      continue
    const field = line.slice(0, typeAt).trim()
    const afterType = line.slice(typeAt)
    const separator = afterType.search(/\s/)
    const fieldValue = separator < 0 ? '' : afterType.slice(separator).trim()
    if (field === 'Name')
      name = fieldValue
    else if (field === 'Gender')
      gender = fieldValue
    else if (field === 'Language')
      languageId = fieldValue
  }
  flush()
  return voices
}

/** Keep the newer Windows voice when the same person also exists as a Desktop voice. */
export function preferDistinctWindowsVoices<T extends { name: string }>(desktopVoices: readonly T[], oneCoreVoices: readonly T[]): T[] {
  const oneCoreNames = new Set(oneCoreVoices.map(voice => desktopVoiceKey(voice.name)))
  const keptDesktop = desktopVoices.filter(voice => !oneCoreNames.has(desktopVoiceKey(voice.name)))
  return [...oneCoreVoices, ...keptDesktop]
}
