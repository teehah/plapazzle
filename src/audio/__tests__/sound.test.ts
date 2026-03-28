import { describe, it, expect } from 'vitest'
import { SoundEngine } from '../sound'

describe('SoundEngine', () => {
  it('enabled=false の時 play は何もしない', () => {
    const engine = new SoundEngine(false)
    expect(() => engine.playClick()).not.toThrow()
    expect(() => engine.playSnap()).not.toThrow()
    expect(() => engine.playFanfare()).not.toThrow()
  })

  it('setEnabled で切り替えられる', () => {
    const engine = new SoundEngine(false)
    expect(engine.isEnabled()).toBe(false)
    engine.setEnabled(true)
    expect(engine.isEnabled()).toBe(true)
  })

  it('playRotate は例外を投げない', () => {
    const engine = new SoundEngine(false)
    expect(() => engine.playRotate()).not.toThrow()
  })

  it('playFlip は例外を投げない', () => {
    const engine = new SoundEngine(false)
    expect(() => engine.playFlip()).not.toThrow()
  })
})
