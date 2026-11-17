const DEFAULT_LOCAL_LLM_MODELS_URL = 'http://localhost:39000/v1/models'

/** One in-flight poll loop per models URL so startup and provider code do not hammer the port. */
const sharedPollByUrl = new Map<string, Promise<boolean>>()

let installedProbe: LocalLlmServerReadyProbe | undefined

export type LocalLlmServerReadyProbe = (options: WaitForLocalLlmServerReadyOptions) => Promise<boolean>

/**
 * Tamagotchi installs a main-process probe so renderers do not spam DevTools with HTTP 503 polls.
 */
export function installLocalLlmServerReadyProbe(probe: LocalLlmServerReadyProbe | undefined) {
  installedProbe = probe
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface WaitForLocalLlmServerReadyOptions {
  /** Stop polling after this many milliseconds. */
  timeoutMs?: number
  /** Delay between polls while the server reports HTTP 503 or the port is closed. */
  pollMs?: number
  modelsUrl?: string
}

/**
 * Polls the local llama-server models endpoint until it returns HTTP 200.
 * HTTP 503 ("Loading model") and connection errors keep polling until timeout.
 */
async function pollLocalLlmServerReady(
  deadline: number,
  pollMs: number,
  modelsUrl: string,
): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(modelsUrl)
      if (response.ok)
        return true
      if (response.status !== 503)
        return false
    }
    catch {
      // Port closed or server still booting.
    }
    await sleep(pollMs)
  }

  return false
}

export async function waitForLocalLlmServerReady(options: WaitForLocalLlmServerReadyOptions = {}): Promise<boolean> {
  if (installedProbe)
    return installedProbe(options)

  const timeoutMs = options.timeoutMs ?? 120_000
  const pollMs = options.pollMs ?? 1_000
  const modelsUrl = options.modelsUrl ?? DEFAULT_LOCAL_LLM_MODELS_URL
  const deadline = Date.now() + timeoutMs

  const existing = sharedPollByUrl.get(modelsUrl)
  if (existing) {
    return Promise.race([
      existing,
      sleep(timeoutMs).then(() => false),
    ])
  }

  const poll = pollLocalLlmServerReady(deadline, pollMs, modelsUrl).finally(() => {
    sharedPollByUrl.delete(modelsUrl)
  })
  sharedPollByUrl.set(modelsUrl, poll)
  return poll
}
