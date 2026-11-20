import type { Buffer } from 'node:buffer'

import type { NativeTtsVoice } from '../../../shared/eventa/native-tts'

import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'

import { parseOneCoreRegistryListing } from '@proj-airi/stage-shared'

// NOTICE:
// Why this workaround is needed.
// Build the PowerShell generic type name at runtime.
// Root cause summary.
// Hard-coded backtick names can break after Rolldown.
// Source/context (file, issue, URL, or node_modules reference).
// out/main/index.js SPEAK_SCRIPT.
// Removal condition (when it can be deleted).
// Delete when WinRT speak ends.
const SPEAK_SCRIPT = [
  '$ProgressPreference = \'SilentlyContinue\'',
  '$ErrorActionPreference = \'Stop\'',
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  '$asyncOpName = \'IAsyncOperation\' + [char]96 + \'1\'',
  '$asTask = $null',
  'foreach ($method in [System.WindowsRuntimeSystemExtensions].GetMethods()) {',
  '  if ($method.Name -ne \'AsTask\') { continue }',
  '  $parameters = $method.GetParameters()',
  '  if ($parameters.Count -ne 1) { continue }',
  '  if ($parameters[0].ParameterType.Name -ne $asyncOpName) { continue }',
  '  $asTask = $method',
  '  break',
  '}',
  'if ($null -eq $asTask) { throw \'Windows speech helper is missing AsTask\' }',
  'function Await-WinRt([object]$task, [type]$resultType) {',
  '  $method = $asTask.MakeGenericMethod($resultType)',
  '  $net = $method.Invoke($null, @($task))',
  '  $null = $net.Wait(-1)',
  '  if ($net.IsFaulted) { throw $net.Exception }',
  '  $net.Result',
  '}',
  '$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType=WindowsRuntime]',
  '$null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media, ContentType=WindowsRuntime]',
  '$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]',
  '$synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()',
  '$wanted = $env:AIRI_TTS_VOICE',
  'if ($wanted) {',
  '  $match = $null',
  '  foreach ($voice in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {',
  '    if ($voice.DisplayName -eq $wanted) {',
  '      $match = $voice',
  '      break',
  '    }',
  '  }',
  '  if ($null -eq $match) { throw "Windows voice not found: $wanted" }',
  '  $synth.Voice = $match',
  '}',
  '$text = [System.IO.File]::ReadAllText($env:AIRI_TTS_TEXT_FILE, (New-Object System.Text.UTF8Encoding $false))',
  '$stream = Await-WinRt ($synth.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])',
  '$size = [uint32]$stream.Size',
  'if ($size -lt 44) { throw \'Windows speech returned an empty audio stream\' }',
  '$reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))',
  '$null = Await-WinRt ($reader.LoadAsync($size)) ([uint32])',
  '$bytes = New-Object byte[] $size',
  '$reader.ReadBytes($bytes)',
  '[System.IO.File]::WriteAllBytes($env:AIRI_TTS_OUT, $bytes)',
].join('\n')

function capabilityScript(dismAction: '/Add-Capability' | '/Remove-Capability'): string {
  return [
    '$ErrorActionPreference = \'Stop\'',
    '$cap = $env:AIRI_VOICE_CAPABILITY',
    'if ($cap -notmatch \'^Language\\.TextToSpeech~~~[a-z]{2}-[A-Z]{2}~0\\.0\\.1\\.0$\') { exit 87 }',
    'try {',
    `  $proc = Start-Process -FilePath "$env:SystemRoot\\System32\\dism.exe" -ArgumentList @('/Online','${dismAction}',"/CapabilityName:$cap",'/NoRestart') -Verb RunAs -Wait -PassThru`,
    '  if ($null -eq $proc) { exit 1 }',
    '  if ($null -eq $proc.ExitCode) { exit 0 }',
    '  exit $proc.ExitCode',
    '} catch {',
    // NOTICE:
    // Why this workaround is needed.
    // Map only real UAC cancel text to 1223.
    // Root cause summary.
    // A broad catch treated Wait failures as cancel while DISM still ran.
    // Source/context (file, issue, URL, or node_modules reference).
    // Start-Process -Verb RunAs from a hidden PowerShell host.
    // Removal condition (when it can be deleted).
    // Delete when install uses a wait that never reports false cancel.
    '  $msg = [string]$_.Exception.Message',
    '  if ($msg -match \'(?i)cancel|1223|operation was canceled|operation was cancelled\') { exit 1223 }',
    '  Write-Error $msg',
    '  exit 1',
    '}',
  ].join('\n')
}

const INSTALL_SCRIPT = capabilityScript('/Add-Capability')
const REMOVE_SCRIPT = capabilityScript('/Remove-Capability')

let lastOneCoreVoices: NativeTtsVoice[] = []
let speakQueue: Promise<void> = Promise.resolve()
const installByCapability = new Map<string, Promise<number>>()
const removeByCapability = new Map<string, Promise<number>>()

function runPowerShell(script: string, extraEnv: Record<string, string>, windowsHide: boolean): Promise<{ code: number, stdout: string, stderr: string }> {
  const scriptPath = path.join(os.tmpdir(), `airi_ps_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`)
  return fs.writeFile(scriptPath, script, 'utf8').then(() => new Promise((resolve, reject) => {
    // NOTICE:
    // Why this workaround is needed.
    // Keep the install host visible so RunAs -Wait can finish with DISM.
    // Root cause summary.
    // Hidden PowerShell made Start-Process -Verb RunAs return cancel while DISM kept running.
    // Source/context (file, issue, URL, or node_modules reference).
    // installTextToSpeechCapability windowsHide=false path.
    // Removal condition (when it can be deleted).
    // Delete when install no longer uses Start-Process -Verb RunAs -Wait.
    const args = [
      '-NoProfile',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      ...(windowsHide ? ['-WindowStyle', 'Hidden'] as const : []),
      '-File',
      scriptPath,
    ]
    const child = spawn('powershell.exe', args, {
      windowsHide,
      env: { ...process.env, ...extraEnv },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      fs.unlink(scriptPath).catch(() => {})
      reject(error)
    })
    child.on('exit', (code) => {
      fs.unlink(scriptPath).catch(() => {})
      resolve({ code: code ?? 1, stdout, stderr })
    })
  }))
}

function readOneCoreRegistry(): Promise<{ ok: boolean, text: string }> {
  return new Promise((resolve) => {
    const child = spawn('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens', '/s'], {
      windowsHide: true,
    })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.on('error', () => resolve({ ok: false, text: '' }))
    child.on('exit', code => resolve({ ok: code === 0 || code === 1, text: stdout }))
  })
}

export async function listOneCoreVoices(): Promise<NativeTtsVoice[]> {
  // Registry listing stays available while chat TTS is busy. PowerShell WinRT
  // listing competed with speak scripts and sometimes returned an empty set.
  const { ok, text } = await readOneCoreRegistry()
  if (!ok)
    return lastOneCoreVoices
  // Trust a successful registry read, including an empty set after a pack remove.
  const voices = parseOneCoreRegistryListing(text)
  lastOneCoreVoices = voices
  return voices
}

export async function synthesizeOneCoreVoice(text: string, voiceId: string): Promise<Buffer> {
  const run = async (): Promise<Buffer> => {
    const textFile = path.join(os.tmpdir(), `airi_tts_text_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`)
    const outFile = path.join(os.tmpdir(), `airi_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`)
    await fs.writeFile(textFile, text, 'utf8')
    try {
      const { code, stderr } = await runPowerShell(SPEAK_SCRIPT, {
        AIRI_TTS_TEXT_FILE: textFile,
        AIRI_TTS_OUT: outFile,
        AIRI_TTS_VOICE: voiceId,
      }, true)
      if (code !== 0) {
        const detail = stderr.trim() || `exit code ${code}`
        throw new Error(`Windows voice synthesis failed: ${detail}`)
      }
      const audio = await fs.readFile(outFile)
      if (audio.byteLength < 44)
        throw new Error('Windows voice synthesis returned empty audio')
      return audio
    }
    finally {
      fs.unlink(textFile).catch(() => {})
      fs.unlink(outFile).catch(() => {})
    }
  }

  const queued = speakQueue.then(run, run)
  speakQueue = queued.then(() => undefined, () => undefined)
  return queued
}

function runCapabilityScript(
  capabilityName: string,
  script: string,
  kind: 'install' | 'remove',
): Promise<number> {
  const own = kind === 'install' ? installByCapability : removeByCapability
  const other = kind === 'install' ? removeByCapability : installByCapability
  const existing = own.get(capabilityName)
  if (existing)
    return existing

  const run = (async () => {
    const blocking = other.get(capabilityName)
    if (blocking)
      await blocking.catch(() => 0)
    const { code } = await runPowerShell(script, {
      AIRI_VOICE_CAPABILITY: capabilityName,
    }, false)
    return code
  })().finally(() => {
    own.delete(capabilityName)
  })

  own.set(capabilityName, run)
  return run
}

/** Ask Windows to download one text-to-speech language pack. Returns the process exit code. */
export async function installTextToSpeechCapability(capabilityName: string): Promise<number> {
  return runCapabilityScript(capabilityName, INSTALL_SCRIPT, 'install')
}

/** Ask Windows to remove one text-to-speech language pack. Returns the process exit code. */
export async function removeTextToSpeechCapability(capabilityName: string): Promise<number> {
  return runCapabilityScript(capabilityName, REMOVE_SCRIPT, 'remove')
}
