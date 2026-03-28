import { describe, it, expect, beforeEach } from 'vitest'
import { GameStorage, MemoryKVStore } from '../db'

describe('GameStorage', () => {
  let storage: GameStorage

  beforeEach(() => {
    storage = new GameStorage(new MemoryKVStore())
    storage.clear()
  })

  it('初期状態でベストタイムはnull', async () => {
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBeNull()
  })

  it('クリア記録を保存すると取得できる', async () => {
    await storage.saveClear({
      puzzleId: 'no6', solutionId: 42, clearTimeMs: 5000,
      actions: [], clearedAt: new Date().toISOString(),
    })
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBe(5000)
    expect(record.discoveredSolutionIds).toContain(42)
    expect(record.totalClears).toBe(1)
  })

  it('ベストタイムは最小値が保持される', async () => {
    await storage.saveClear({ puzzleId: 'no6', solutionId: 1, clearTimeMs: 10000, actions: [], clearedAt: new Date().toISOString() })
    await storage.saveClear({ puzzleId: 'no6', solutionId: 2, clearTimeMs: 5000, actions: [], clearedAt: new Date().toISOString() })
    await storage.saveClear({ puzzleId: 'no6', solutionId: 3, clearTimeMs: 8000, actions: [], clearedAt: new Date().toISOString() })
    const record = await storage.getPuzzleRecord('no6')
    expect(record.bestTimeMs).toBe(5000)
    expect(record.totalClears).toBe(3)
  })

  it('サウンド設定を保存・取得できる', async () => {
    expect(await storage.getSoundEnabled()).toBe(false)
    await storage.setSoundEnabled(true)
    expect(await storage.getSoundEnabled()).toBe(true)
  })

  it('同じsolutionIdは重複しない', async () => {
    await storage.saveClear({ puzzleId: 'no6', solutionId: 42, clearTimeMs: 5000, actions: [], clearedAt: new Date().toISOString() })
    await storage.saveClear({ puzzleId: 'no6', solutionId: 42, clearTimeMs: 3000, actions: [], clearedAt: new Date().toISOString() })
    const record = await storage.getPuzzleRecord('no6')
    expect(record.discoveredSolutionIds.filter(id => id === 42)).toHaveLength(1)
  })
})
