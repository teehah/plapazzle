/**
 * ミリ秒を "M:SS" 形式にフォーマットする。
 */
export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

/**
 * ミリ秒を "M:SS.CC" 形式（10ms精度）にフォーマットする。
 */
export function formatTimePrecise(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${m}:${sec.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}
