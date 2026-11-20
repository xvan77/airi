import type { AudioConsoleEffectsSettings } from '../../libs/speech/voice-profile'

export interface AudioEffectsResult {
  lastNode: AudioNode
  cleanup: () => void
}

export const MAX_EQ_DB = 14

export function eqDbFromPercent(percent: number): number {
  return (percent / 100) * MAX_EQ_DB
}

export function distortionCurveForPercent(percent: number): Float32Array {
  const amount = 1 + (percent / 100) * 35
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount)
  }
  return curve
}

function connectFilter(
  lastNode: AudioNode,
  nodesToDisconnect: AudioNode[],
  filter: BiquadFilterNode,
): AudioNode {
  lastNode.connect(filter)
  nodesToDisconnect.push(filter)
  return filter
}

export function applyVoiceProfileEffects(
  audioContext: AudioContext,
  source: AudioBufferSourceNode,
  effects: AudioConsoleEffectsSettings,
): AudioEffectsResult {
  const nodesToDisconnect: AudioNode[] = []
  const oscillatorsToStop: OscillatorNode[] = []

  const pitchFactor = 1 + (effects.pitch / 100) * 0.5
  const rateFactor = effects.rate > 0 ? effects.rate : 1
  source.playbackRate.value = pitchFactor * rateFactor

  let lastNode: AudioNode = source

  const highpassVal = effects.highpass || 0
  if (highpassVal > 0) {
    const highpass = audioContext.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 50 + (highpassVal / 100) * 350
    lastNode = connectFilter(lastNode, nodesToDisconnect, highpass)
  }

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
    wetGain.gain.value = (robotVal / 100) * 0.82

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
    wetGain.gain.value = (reverbVal / 100) * 0.78

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

  const bass = effects.eqBass || 0
  if (bass !== 0) {
    const lowshelf = audioContext.createBiquadFilter()
    lowshelf.type = 'lowshelf'
    lowshelf.frequency.value = 200
    lowshelf.gain.value = eqDbFromPercent(bass)
    lastNode = connectFilter(lastNode, nodesToDisconnect, lowshelf)
  }

  const mid = effects.eqMid || 0
  if (mid !== 0) {
    const peaking = audioContext.createBiquadFilter()
    peaking.type = 'peaking'
    peaking.frequency.value = 1200
    peaking.Q.value = 0.9
    peaking.gain.value = eqDbFromPercent(mid)
    lastNode = connectFilter(lastNode, nodesToDisconnect, peaking)
  }

  const treble = effects.eqTreble || 0
  if (treble !== 0) {
    const highshelf = audioContext.createBiquadFilter()
    highshelf.type = 'highshelf'
    highshelf.frequency.value = 4000
    highshelf.gain.value = eqDbFromPercent(treble)
    lastNode = connectFilter(lastNode, nodesToDisconnect, highshelf)
  }

  const deesserVal = effects.deesser || 0
  if (deesserVal > 0) {
    const deesser = audioContext.createBiquadFilter()
    deesser.type = 'peaking'
    deesser.frequency.value = 6500
    deesser.Q.value = 2
    deesser.gain.value = -(deesserVal / 100) * 12
    lastNode = connectFilter(lastNode, nodesToDisconnect, deesser)
  }

  const chorusVal = effects.chorus || 0
  if (chorusVal > 0) {
    const wet = chorusVal / 100
    const delay = audioContext.createDelay(0.08)
    delay.delayTime.value = 0.022

    const lfo = audioContext.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.4 + wet * 2.2
    const lfoGain = audioContext.createGain()
    lfoGain.gain.value = 0.0015 + wet * 0.01
    lfo.connect(lfoGain)
    lfoGain.connect(delay.delayTime)
    lfo.start(0)
    oscillatorsToStop.push(lfo)

    const wetGain = audioContext.createGain()
    wetGain.gain.value = 0.22 + wet * 0.68
    const dryGain = audioContext.createGain()
    dryGain.gain.value = Math.max(0.25, 1 - wet * 0.35)
    const mix = audioContext.createGain()

    lastNode.connect(dryGain)
    dryGain.connect(mix)
    lastNode.connect(delay)
    delay.connect(wetGain)
    wetGain.connect(mix)

    nodesToDisconnect.push(delay, lfoGain, wetGain, dryGain, mix)
    lastNode = mix
  }

  const gritVal = effects.grit || 0
  if (gritVal > 0) {
    const shaper = audioContext.createWaveShaper()
    shaper.curve = new Float32Array(distortionCurveForPercent(gritVal))
    shaper.oversample = gritVal > 40 ? '2x' : 'none'
    const gritPre = audioContext.createGain()
    gritPre.gain.value = 1 + (gritVal / 100) * 1.5
    const gritPost = audioContext.createGain()
    gritPost.gain.value = 1 / (1 + (gritVal / 100) * 0.9)

    lastNode.connect(gritPre)
    gritPre.connect(shaper)
    shaper.connect(gritPost)

    nodesToDisconnect.push(gritPre, shaper, gritPost)
    lastNode = gritPost
  }

  const gateVal = effects.gate || 0
  if (gateVal > 0) {
    const gate = audioContext.createDynamicsCompressor()
    const t = gateVal / 100
    gate.threshold.value = -48 + t * 30
    gate.knee.value = 2
    gate.ratio.value = 4 + t * 16
    gate.attack.value = 0.002
    gate.release.value = 0.04 + t * 0.22
    lastNode.connect(gate)
    nodesToDisconnect.push(gate)
    lastNode = gate
  }

  const volumeGain = audioContext.createGain()
  volumeGain.gain.value = Math.max(0, (effects.volume ?? 100) / 100)
  lastNode.connect(volumeGain)
  nodesToDisconnect.push(volumeGain)
  lastNode = volumeGain

  const limiterVal = effects.limiter || 0
  if (limiterVal > 0) {
    const limiter = audioContext.createDynamicsCompressor()
    limiter.threshold.value = -2 - (limiterVal / 100) * 18
    limiter.knee.value = 0
    limiter.ratio.value = 8 + (limiterVal / 100) * 12
    limiter.attack.value = 0.002
    limiter.release.value = 0.08
    lastNode.connect(limiter)
    nodesToDisconnect.push(limiter)
    lastNode = limiter
  }

  const spatialVal = effects.spatial || 0
  const panner = audioContext.createStereoPanner()
  panner.pan.value = spatialVal / 100
  lastNode.connect(panner)
  nodesToDisconnect.push(panner)
  lastNode = panner

  const cleanup = () => {
    for (const oscillator of oscillatorsToStop) {
      try {
        oscillator.stop()
      }
      catch {}
    }
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
