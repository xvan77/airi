import type { VoiceProfile } from '../../libs/speech/voice-profile'

export interface AudioEffectsResult {
  lastNode: AudioNode
  cleanup: () => void
}

export function applyVoiceProfileEffects(
  audioContext: AudioContext,
  source: AudioBufferSourceNode,
  effects: VoiceProfile['effects'],
): AudioEffectsResult {
  const nodesToDisconnect: AudioNode[] = []

  const pitchFactor = 1 + (effects.pitch / 100) * 0.5
  const speedFactor = effects.rate || 1.0
  source.playbackRate.value = speedFactor * pitchFactor

  let lastNode: AudioNode = source

  const asmrVal = effects.asmr || 0
  if (asmrVal > 0) {
    const asmrLowpass = audioContext.createBiquadFilter()
    asmrLowpass.type = 'lowpass'
    asmrLowpass.frequency.value = 20000 - (asmrVal / 100) * 18200

    const compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -30
    compressor.knee.value = 40
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    lastNode.connect(asmrLowpass)
    asmrLowpass.connect(compressor)

    nodesToDisconnect.push(asmrLowpass, compressor)
    lastNode = compressor
  }

  const radioVal = effects.radio || 0
  if (radioVal > 0) {
    const radioHighpass = audioContext.createBiquadFilter()
    radioHighpass.type = 'highpass'
    radioHighpass.frequency.value = 10 + (radioVal / 100) * 490

    const radioLowpass = audioContext.createBiquadFilter()
    radioLowpass.type = 'lowpass'
    radioLowpass.frequency.value = 20000 - (radioVal / 100) * 17500

    lastNode.connect(radioHighpass)
    radioHighpass.connect(radioLowpass)

    nodesToDisconnect.push(radioHighpass, radioLowpass)
    lastNode = radioLowpass
  }

  const robotVal = effects.robot || 0
  if (robotVal > 0) {
    const delayNode = audioContext.createDelay()
    delayNode.delayTime.value = 0.002

    const feedbackGain = audioContext.createGain()
    feedbackGain.gain.value = (robotVal / 100) * 0.85

    const wetGain = audioContext.createGain()
    wetGain.gain.value = (robotVal / 100) * 0.7

    const robotOutput = audioContext.createGain()

    lastNode.connect(robotOutput)
    lastNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(delayNode)
    delayNode.connect(wetGain)
    wetGain.connect(robotOutput)

    nodesToDisconnect.push(delayNode, feedbackGain, wetGain, robotOutput)
    lastNode = robotOutput
  }

  const reverbVal = effects.reverb || 0
  if (reverbVal > 0) {
    const delayNode = audioContext.createDelay()
    delayNode.delayTime.value = 0.35

    const feedbackGain = audioContext.createGain()
    feedbackGain.gain.value = 0.1 + (reverbVal / 100) * 0.6

    const wetGain = audioContext.createGain()
    wetGain.gain.value = (reverbVal / 100) * 0.65

    const reverbOutput = audioContext.createGain()

    lastNode.connect(reverbOutput)
    lastNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(delayNode)
    delayNode.connect(wetGain)
    wetGain.connect(reverbOutput)

    nodesToDisconnect.push(delayNode, feedbackGain, wetGain, reverbOutput)
    lastNode = reverbOutput
  }

  const spatialVal = effects.spatial || 0
  const panner = audioContext.createStereoPanner()
  panner.pan.value = spatialVal / 100
  lastNode.connect(panner)
  nodesToDisconnect.push(panner)
  lastNode = panner

  const cleanup = () => {
    try {
      source.disconnect()
    }
    catch {}
    for (const node of nodesToDisconnect) {
      try {
        node.disconnect()
      }
      catch {}
    }
  }

  return {
    lastNode,
    cleanup,
  }
}
