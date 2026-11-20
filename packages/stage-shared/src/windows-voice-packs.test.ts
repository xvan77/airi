import { describe, expect, it } from 'vitest'

import {
  buildWindowsVoiceCatalog,
  filterWindowsVoiceCatalogByZone,
  filterWindowsVoicePacksByZone,
  markWindowsVoicePacks,
  parseOneCoreRegistryListing,
  preferDistinctWindowsVoices,
  windowsVoicePackCapabilityName,
  windowsVoicePackZone,
} from './windows-voice-packs'

describe('windows voice packs', () => {
  it('builds a Windows text-to-speech capability name for a known language', () => {
    expect(windowsVoicePackCapabilityName('en-AU')).toBe('Language.TextToSpeech~~~en-AU~0.0.1.0')
  })

  it('rejects a language that is not in the catalog', () => {
    expect(windowsVoicePackCapabilityName('en-AU;calc')).toBeNull()
    expect(windowsVoicePackCapabilityName('xx-YY')).toBeNull()
  })

  it('marks a pack installed from the voices that can actually be picked', () => {
    const packs = markWindowsVoicePacks([
      { name: 'Microsoft Zira Desktop', lang: 'en-US' },
      { name: 'Microsoft Laura', lang: 'es-ES' },
      { name: 'Microsoft Pablo', lang: 'es-ES' },
    ])
    expect(packs.find(pack => pack.locale === 'en-GB')?.installed).toBe(false)
    expect(packs.find(pack => pack.locale === 'en-US')?.voiceNames).toBe('Microsoft Zira Desktop')
    expect(packs.find(pack => pack.locale === 'es-ES')?.voiceNames).toBe('Microsoft Laura, Microsoft Pablo')
  })

  it('reads Laura and Pablo from a Spanish Windows registry listing', () => {
    const listing = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_esES_LauraM\\Attributes
    Name    REG_SZ    Microsoft Laura
    Gender    REG_SZ    Female
    Language    REG_SZ    C0A

HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_esES_PabloM\\Attributes
    Name    REG_SZ    Microsoft Pablo
    Gender    REG_SZ    Male
    Language    REG_SZ    C0A
`
    const voices = parseOneCoreRegistryListing(listing)
    expect(voices.map(voice => voice.name)).toEqual(['Microsoft Laura', 'Microsoft Pablo'])
    expect(voices.every(voice => voice.lang === 'es-ES')).toBe(true)
  })

  it('maps locales into the Speech language zones', () => {
    expect(windowsVoicePackZone('en-GB')).toBe('english')
    expect(windowsVoicePackZone('es-MX')).toBe('spanish')
    expect(windowsVoicePackZone('fr-FR')).toBe('european')
    expect(windowsVoicePackZone('ja-JP')).toBe('asian')
    expect(windowsVoicePackZone('pt-BR')).toBeNull()
  })

  it('filters packs by the selected language zone', () => {
    const packs = [
      { locale: 'en-US' },
      { locale: 'es-ES' },
      { locale: 'de-DE' },
      { locale: 'zh-CN' },
      { locale: 'pt-BR' },
    ]
    expect(filterWindowsVoicePacksByZone(packs, 'european').map(pack => pack.locale)).toEqual(['de-DE'])
    expect(filterWindowsVoicePacksByZone(packs, null)).toHaveLength(5)
  })

  it('builds one bubble per voice and keeps uninstalled locale mates together', () => {
    const packs = markWindowsVoicePacks([
      { name: 'Microsoft Zira Desktop', lang: 'en-US' },
    ])
    const catalog = buildWindowsVoiceCatalog(packs, [
      { id: 'Microsoft Zira Desktop', name: 'Microsoft Zira Desktop', lang: 'en-US' },
    ])
    const english = filterWindowsVoiceCatalogByZone(catalog, 'english')
    expect(english.find(entry => entry.name.includes('Zira'))?.installed).toBe(true)
    expect(english.filter(entry => entry.locale === 'en-AU').map(entry => entry.name)).toEqual([
      'Microsoft Catherine',
      'Microsoft James',
    ])
    expect(english.filter(entry => entry.locale === 'en-AU').every(entry => !entry.installed)).toBe(true)
    expect(english[0]?.installed).toBe(true)
    const uninstalledEnglish = english.filter(entry => !entry.installed)
    expect(uninstalledEnglish.map(entry => entry.locale)).toEqual([
      'en-AU',
      'en-AU',
      'en-CA',
      'en-CA',
      'en-GB',
      'en-GB',
      'en-GB',
      'en-IE',
      'en-IN',
      'en-IN',
    ])
  })

  it('keeps Zira and drops the desktop copy when the same voice exists', () => {
    const voices = preferDistinctWindowsVoices(
      [
        { id: 'Microsoft Zira Desktop', name: 'Microsoft Zira Desktop', lang: 'en-US', gender: 'female' },
        { id: 'Microsoft Helena Desktop', name: 'Microsoft Helena Desktop', lang: 'en-US', gender: 'female' },
      ],
      [
        { id: 'Microsoft Helena', name: 'Microsoft Helena', lang: 'es-ES', gender: 'female' },
        { id: 'Microsoft Laura', name: 'Microsoft Laura', lang: 'es-ES', gender: 'female' },
      ],
    )
    expect(voices.map(voice => voice.id)).toEqual([
      'Microsoft Helena',
      'Microsoft Laura',
      'Microsoft Zira Desktop',
    ])
  })
})
