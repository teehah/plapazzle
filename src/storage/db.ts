import { get, set, clear as clearAll } from 'idb-keyval'

export interface ClearRecord {
  puzzleId: string
  solutionId: number
  clearTimeMs: number
  actions: Array<{
    type: string
    pieceId?: string
    position?: { x: number; y: number }
    gridPosition?: { row: number; col: number }
    orientationIndex?: number
    timestamp: number
  }>
  clearedAt: string
}

export interface PuzzleRecord {
  bestTimeMs: number | null
  discoveredSolutionIds: number[]
  totalClears: number
}

export interface KVStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  clear(): Promise<void>
}

class IdbKVStore implements KVStore {
  async get<T>(key: string): Promise<T | undefined> {
    return get<T>(key)
  }
  async set(key: string, value: unknown): Promise<void> {
    return set(key, value)
  }
  async clear(): Promise<void> {
    return clearAll()
  }
}

export class MemoryKVStore implements KVStore {
  private store = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined
  }
  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value)
  }
  async clear(): Promise<void> {
    this.store.clear()
  }
}

function defaultPuzzleRecord(): PuzzleRecord {
  return { bestTimeMs: null, discoveredSolutionIds: [], totalClears: 0 }
}

function createDefaultStore(): KVStore {
  try {
    if (typeof indexedDB !== 'undefined') {
      return new IdbKVStore()
    }
  } catch {
    // indexedDB not available
  }
  return new MemoryKVStore()
}

export class GameStorage {
  private kv: KVStore

  constructor(store?: KVStore) {
    this.kv = store ?? createDefaultStore()
  }

  async getPuzzleRecord(puzzleId: string): Promise<PuzzleRecord> {
    const record = await this.kv.get<PuzzleRecord>(`puzzle:${puzzleId}`)
    return record ?? defaultPuzzleRecord()
  }

  async saveClear(clearRecord: ClearRecord): Promise<void> {
    const { puzzleId, solutionId, clearTimeMs } = clearRecord

    // Update puzzle record
    const record = await this.getPuzzleRecord(puzzleId)

    if (record.bestTimeMs === null || clearTimeMs < record.bestTimeMs) {
      record.bestTimeMs = clearTimeMs
    }

    if (!record.discoveredSolutionIds.includes(solutionId)) {
      record.discoveredSolutionIds.push(solutionId)
    }

    record.totalClears += 1

    await this.kv.set(`puzzle:${puzzleId}`, record)

    // Append to clears list
    const clears = await this.getClears(puzzleId)
    clears.push(clearRecord)
    await this.kv.set(`clears:${puzzleId}`, clears)
  }

  async getClears(puzzleId: string): Promise<ClearRecord[]> {
    const clears = await this.kv.get<ClearRecord[]>(`clears:${puzzleId}`)
    return clears ?? []
  }

  async getSoundEnabled(): Promise<boolean> {
    const enabled = await this.kv.get<boolean>('soundEnabled')
    return enabled ?? false
  }

  async setSoundEnabled(enabled: boolean): Promise<void> {
    await this.kv.set('soundEnabled', enabled)
  }

  clear(): void {
    void this.kv.clear()
  }
}
