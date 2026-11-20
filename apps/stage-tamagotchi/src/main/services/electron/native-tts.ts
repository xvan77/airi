import type { Buffer } from 'node:buffer'

import type { createContext } from '@moeru/eventa/adapters/electron/main'

import type { NativeTtsVoice } from '../../../shared/eventa/native-tts'

import os from 'node:os'
import path from 'node:path'

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'

import { defineInvokeHandler } from '@moeru/eventa'
import { markWindowsVoicePacks, preferDistinctWindowsVoices, windowsVoicePackCapabilityName } from '@proj-airi/stage-shared'
import { isLinux, isMacOS, isWindows } from 'std-env'

import {
  electronGenerateNativeTts,
  electronGetNativeTtsVoices,
  electronInstallWindowsVoicePack,
  electronListWindowsVoicePacks,
  electronRemoveWindowsVoicePack,
} from '../../../shared/eventa/native-tts'
import { installTextToSpeechCapability, listOneCoreVoices, removeTextToSpeechCapability, synthesizeOneCoreVoice } from './windows-native-speech'

function execPromise(command: string): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error)
        reject(error)
      else
        resolve({ stdout, stderr })
    })
  })
}

async function getWindowsDesktopVoices(): Promise<NativeTtsVoice[]> {
  const tmpDir = os.tmpdir()
  const vbsFile = path.join(tmpDir, `airi_get_voices_${Date.now()}.vbs`)
  const script = `
Set voice = CreateObject("SAPI.SpVoice")
WScript.StdOut.Write "["
first = True
For Each v In voice.GetVoices
    If Not first Then
        WScript.StdOut.Write ","
    End If
    first = False
    name = v.GetAttribute("Name")
    lang = v.GetAttribute("Language")
    gender = v.GetAttribute("Gender")
    locale = "en-US"
    Select Case LCase(lang)
        Case "409", "0409": locale = "en-US"
        Case "809", "0809": locale = "en-GB"
        Case "40a", "040a", "c0a", "0c0a": locale = "es-ES"
        Case "80a", "080a": locale = "es-MX"
        Case "40c", "040c": locale = "fr-FR"
        Case "407", "0407": locale = "de-DE"
        Case "411", "0411": locale = "ja-JP"
        Case "412", "0412": locale = "ko-KR"
        Case "804", "0804": locale = "zh-CN"
        Case "419", "0419": locale = "ru-RU"
        Case "416", "0416": locale = "pt-BR"
        Case "410", "0410": locale = "it-IT"
    End Select
    name_esc = Replace(name, "\\", "\\\\")
    name_esc = Replace(name_esc, """", "\\""")
    WScript.StdOut.Write "{""id"":""" & name_esc & """,""name"":""" & name_esc & """,""lang"":""" & locale & """,""gender"":""" & gender & """}"
Next
WScript.StdOut.Write "]"
  `
  try {
    await fs.writeFile(vbsFile, `\uFEFF${script}`, 'utf16le')
    const { stdout } = await execPromise(`cscript //NoLogo "${vbsFile}"`)
    const trimmed = stdout.trim()
    if (!trimmed)
      return []
    const parsed = JSON.parse(trimmed) as NativeTtsVoice | NativeTtsVoice[]
    return Array.isArray(parsed) ? parsed : [parsed]
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list Windows voices:', error)
    return []
  }
  finally {
    fs.unlink(vbsFile).catch(() => {})
  }
}

async function getWindowsVoices(): Promise<NativeTtsVoice[]> {
  const [desktop, oneCore] = await Promise.all([
    getWindowsDesktopVoices().catch(() => []),
    listOneCoreVoices().catch(() => []),
  ])
  return preferDistinctWindowsVoices(desktop, oneCore)
}

async function generateWindowsTts(text: string, voiceId?: string): Promise<Buffer> {
  // Desktop voices stay on the old engine. Language-pack voices use the newer Windows list.
  if (voiceId && !voiceId.toLowerCase().endsWith('desktop'))
    return synthesizeOneCoreVoice(text, voiceId)
  return generateWindowsDesktopTts(text, voiceId)
}

async function generateWindowsDesktopTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const vbsFile = path.join(tmpDir, `airi_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.vbs`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`)

  const script = `
Set voice = CreateObject("SAPI.SpVoice")
Set stream = CreateObject("SAPI.SpFileStream")
stream.Open "${outFile.replace(/\\/g, '\\\\')}", 3
Set voice.AudioOutputStream = stream
voiceId = "${(voiceId || '').replace(/"/g, '""')}"
If voiceId <> "" Then
    For Each v In voice.GetVoices
        If LCase(v.GetAttribute("Name")) = LCase(voiceId) Or LCase(v.GetDescription) = LCase(voiceId) Then
            Set voice.Voice = v
            Exit For
        End If
    Next
End If
voice.Speak "${text.replace(/"/g, '""')}"
stream.Close
  `
  try {
    await fs.writeFile(vbsFile, `\uFEFF${script}`, 'utf16le')
    await execPromise(`cscript //NoLogo "${vbsFile}"`)
    return await fs.readFile(outFile)
  }
  finally {
    fs.unlink(vbsFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

async function getMacVoices(): Promise<NativeTtsVoice[]> {
  try {
    const { stdout } = await execPromise('say -v ?')
    const voices: NativeTtsVoice[] = []
    for (const line of stdout.split('\n')) {
      const match = line.match(/^([\w.-]+)\s+([a-z]{2}_[A-Z]{2})/)
      if (match) {
        const name = match[1].trim()
        const lang = match[2].replace('_', '-')
        voices.push({
          id: name,
          name,
          lang,
          gender: 'neutral',
        })
      }
    }
    return voices
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list macOS voices:', error)
    return []
  }
}

async function generateMacTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const textFile = path.join(tmpDir, `airi_tts_text_${Date.now()}.txt`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}.aiff`)

  await fs.writeFile(textFile, text, 'utf8')

  let cmd = `say -o "${outFile}" -f "${textFile}"`
  if (voiceId)
    cmd += ` -v "${voiceId.replace(/"/g, '\\"')}"`

  try {
    await execPromise(cmd)
    return await fs.readFile(outFile)
  }
  finally {
    fs.unlink(textFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

async function getLinuxVoices(): Promise<NativeTtsVoice[]> {
  try {
    const { stdout } = await execPromise('espeak --voices')
    const voices: NativeTtsVoice[] = []
    for (const line of stdout.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4 && parts[0] !== 'Pty') {
        const lang = parts[1]
        const gender = parts[2] === 'M' ? 'male' : parts[2] === 'F' ? 'female' : 'neutral'
        const name = parts[3]
        voices.push({
          id: name,
          name,
          lang,
          gender,
        })
      }
    }
    return voices
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list Linux voices:', error)
    return []
  }
}

async function generateLinuxTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const textFile = path.join(tmpDir, `airi_tts_text_${Date.now()}.txt`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}.wav`)

  await fs.writeFile(textFile, text, 'utf8')

  let cmd = `espeak -w "${outFile}" -f "${textFile}"`
  if (voiceId)
    cmd += ` -v "${voiceId.replace(/"/g, '\\"')}"`

  try {
    await execPromise(cmd)
    return await fs.readFile(outFile)
  }
  finally {
    fs.unlink(textFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForWindowsLocaleVoices(locale: string, timeoutMs: number): Promise<boolean> {
  const wanted = locale.toLowerCase()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const voices = await getWindowsVoices()
    if (voices.some(voice => voice.lang.toLowerCase() === wanted))
      return true
    if (Date.now() >= deadline)
      return false
    await sleep(1500)
  }
}

async function waitForWindowsLocaleVoicesGone(locale: string, timeoutMs: number): Promise<boolean> {
  const wanted = locale.toLowerCase()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const voices = await getWindowsVoices()
    if (!voices.some(voice => voice.lang.toLowerCase() === wanted))
      return true
    if (Date.now() >= deadline)
      return false
    await sleep(1500)
  }
}

type MainContext = ReturnType<typeof createContext>['context']

export function createNativeTtsService(params: { context: MainContext }): void {
  defineInvokeHandler(params.context, electronGetNativeTtsVoices, async () => {
    if (isWindows)
      return getWindowsVoices()
    if (isMacOS)
      return getMacVoices()
    if (isLinux)
      return getLinuxVoices()
    return []
  })

  defineInvokeHandler(params.context, electronListWindowsVoicePacks, async () => {
    if (!isWindows)
      return []
    const voices = await getWindowsVoices()
    return markWindowsVoicePacks(voices)
  })

  defineInvokeHandler(params.context, electronInstallWindowsVoicePack, async (payload) => {
    if (!isWindows)
      return { ok: false, code: 'failed' as const }
    const locale = payload?.locale ?? ''
    const capability = windowsVoicePackCapabilityName(locale)
    if (!capability)
      return { ok: false, code: 'failed' as const }

    const exitCode = await installTextToSpeechCapability(capability)
    // Registry can lag a few seconds after DISM exits with success.
    const installed = await waitForWindowsLocaleVoices(locale, exitCode === 0 || exitCode === 3010 ? 45_000 : 6_000)
    if (installed || exitCode === 0 || exitCode === 3010)
      return { ok: true, code: 'ready' as const }
    if (exitCode === 1223)
      return { ok: false, code: 'cancelled' as const }
    return { ok: false, code: 'failed' as const }
  })

  defineInvokeHandler(params.context, electronRemoveWindowsVoicePack, async (payload) => {
    if (!isWindows)
      return { ok: false, code: 'failed' as const }
    const locale = payload?.locale ?? ''
    const capability = windowsVoicePackCapabilityName(locale)
    if (!capability)
      return { ok: false, code: 'failed' as const }

    const exitCode = await removeTextToSpeechCapability(capability)
    const removed = await waitForWindowsLocaleVoicesGone(locale, exitCode === 0 || exitCode === 3010 ? 45_000 : 6_000)
    if (removed || exitCode === 0 || exitCode === 3010)
      return { ok: true, code: 'ready' as const }
    if (exitCode === 1223)
      return { ok: false, code: 'cancelled' as const }
    return { ok: false, code: 'failed' as const }
  })

  defineInvokeHandler(params.context, electronGenerateNativeTts, async (payload) => {
    if (!payload?.text)
      return null
    try {
      let buffer: Buffer
      if (isWindows)
        buffer = await generateWindowsTts(payload.text, payload.voiceId)
      else if (isMacOS)
        buffer = await generateMacTts(payload.text, payload.voiceId)
      else if (isLinux)
        buffer = await generateLinuxTts(payload.text, payload.voiceId)
      else
        return null

      return bufferToArrayBuffer(buffer)
    }
    catch (error) {
      console.error('[Native TTS Service] TTS generation error:', error)
      return null
    }
  })
}
