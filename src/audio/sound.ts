export class SoundEngine {
  private enabled: boolean
  private ctx: AudioContext | null = null

  constructor(enabled: boolean = false) {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    return this.ctx
  }

  private playTone(frequency: number, duration: number): void {
    const ctx = this.getContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = frequency
    osc.connect(gain)
    gain.connect(ctx.destination)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration / 1000)
  }

  private playChord(frequencies: number[], duration: number): void {
    for (const freq of frequencies) {
      this.playTone(freq, duration)
    }
  }

  /** ピース移動: 200Hz, 50ms */
  playClick(): void {
    if (!this.enabled) return
    this.playTone(200, 50)
  }

  /** 回転: 400Hz, 30ms */
  playRotate(): void {
    if (!this.enabled) return
    this.playTone(400, 30)
  }

  /** 反転: 150Hz+300Hz, 80ms */
  playFlip(): void {
    if (!this.enabled) return
    this.playChord([150, 300], 80)
  }

  /** スナップ: 500Hz+1000Hz, 100ms */
  playSnap(): void {
    if (!this.enabled) return
    this.playChord([500, 1000], 100)
  }

  /** クリア: C-E-G-C ascending */
  playFanfare(): void {
    if (!this.enabled) return
    const ctx = this.getContext()
    if (!ctx) return

    const notes = [261.63, 329.63, 392.0, 523.25] // C4, E4, G4, C5
    const noteDuration = 150 // ms per note

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)

      const startTime = ctx.currentTime + (i * noteDuration) / 1000
      const endTime = startTime + noteDuration / 1000

      gain.gain.setValueAtTime(0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, endTime)

      osc.start(startTime)
      osc.stop(endTime)
    })
  }
}
