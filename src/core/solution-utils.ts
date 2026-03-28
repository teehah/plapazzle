import type { Solution } from './solver'

/** Solution マップをソート済み文字列に変換（重複排除用） */
export function normalizeSolution(sol: Solution): string {
  return [...sol.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join('|')
}

/** 同一配置の解を除去 */
export function deduplicateSolutions(solutions: Solution[]): Solution[] {
  const seen = new Set<string>()
  const result: Solution[] = []
  for (const sol of solutions) {
    const key = normalizeSolution(sol)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(sol)
    }
  }
  return result
}
