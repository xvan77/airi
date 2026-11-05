import { describe, expect, it } from 'vitest'

import { cacheUrlMatchesKokoroQuantization } from './kokoro-speech-model-download-state'

describe('cacheUrlMatchesKokoroQuantization', () => {
  it('matches q4 without matching q4f16', () => {
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q4.onnx', 'q4')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q4f16.onnx', 'q4')).toBe(false)
  })

  it('matches q4f16 only for q4f16 paths', () => {
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q4f16.onnx', 'q4f16')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q4.onnx', 'q4f16')).toBe(false)
  })

  it('matches fp16 paths for fp16 quant', () => {
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/kokoro-82m/fp16/model.onnx', 'fp16')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/kokoro-82m/fp32/model_fp32.onnx', 'fp16')).toBe(false)
  })

  it('matches q8 and fp32 onnx paths', () => {
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_quantized.onnx', 'q8')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q8f16.onnx', 'q8')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx', 'fp32')).toBe(true)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_fp16.onnx', 'fp32')).toBe(false)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_quantized.onnx', 'fp32')).toBe(false)
  })

  it('does not treat q8f16 weights as fp16 wasm', () => {
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_q8f16.onnx', 'fp16')).toBe(false)
    expect(cacheUrlMatchesKokoroQuantization('https://cdn.example/onnx/model_fp16.onnx', 'fp16')).toBe(true)
  })
})
