import { describe, it, expect } from 'vitest'
import { Z_LAYERS, Z_LAYER_ORDER, zLayerValue } from './zLayers'

describe('z layer scale', () => {
  it('is strictly ascending in the documented order', () => {
    const values = Z_LAYER_ORDER.map(zLayerValue)
    for (let index = 1; index < values.length; index++) {
      expect(values[index]).toBeGreaterThan(values[index - 1])
    }
  })

  it('keeps notifications above every modal layer and below the lock screen', () => {
    expect(zLayerValue('toast')).toBeGreaterThan(zLayerValue('sheet'))
    expect(zLayerValue('toast')).toBeGreaterThan(zLayerValue('hint'))
    expect(zLayerValue('lockScreen')).toBeGreaterThan(zLayerValue('toast'))
  })

  it('covers every declared layer in the order list', () => {
    expect([...Z_LAYER_ORDER].sort()).toEqual(Object.keys(Z_LAYERS).sort())
  })
})
