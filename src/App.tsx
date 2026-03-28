import { useState, useCallback, useEffect } from 'react'
import { PUZZLES } from './data/puzzles'
import { TitleScreen } from './screens/TitleScreen'
import { PuzzleSelectScreen } from './screens/PuzzleSelectScreen'
import { GameScreen } from './screens/GameScreen'
import { ClearAnimation } from './screens/ClearAnimation'
import { ResultScreen } from './screens/ResultScreen'
import { SolutionGalleryScreen } from './screens/SolutionGalleryScreen'
import { SoundEngine } from './audio/sound'
import { GameStorage } from './storage/db'
import type { PuzzleRecord } from './storage/db'
import type { GameState } from './game/state'

type AppState =
  | { screen: 'title' }
  | { screen: 'puzzle-select' }
  | { screen: 'game'; puzzleId: string }
  | { screen: 'clear-animation'; puzzleId: string; clearTimeMs: number; solutionId: number; gameState: GameState }
  | { screen: 'result'; puzzleId: string; clearTimeMs: number; solutionId: number }
  | { screen: 'solution-gallery'; puzzleId: string }

const soundEngine = new SoundEngine(false)
const storage = new GameStorage()

function screenParent(state: AppState): AppState | null {
  switch (state.screen) {
    case 'title': return null
    case 'puzzle-select': return { screen: 'title' }
    case 'game': return { screen: 'puzzle-select' }
    case 'clear-animation': return null
    case 'result': return { screen: 'puzzle-select' }
    case 'solution-gallery': return { screen: 'puzzle-select' }
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'title' })
  const [records, setRecords] = useState<Map<string, PuzzleRecord>>(new Map())
  const [soundEnabled, setSoundEnabled] = useState(false)

  const navigate = useCallback((next: AppState) => {
    history.pushState({ screen: next.screen }, '')
    setAppState(next)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setAppState(prev => {
        const parent = screenParent(prev)
        return parent ?? prev
      })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const loadRecords = useCallback(async () => {
    const map = new Map<string, PuzzleRecord>()
    for (const p of PUZZLES) {
      map.set(p.id, await storage.getPuzzleRecord(p.id))
    }
    setRecords(map)
  }, [])

  useEffect(() => { loadRecords() }, [loadRecords])

  useEffect(() => {
    storage.getSoundEnabled().then(enabled => {
      setSoundEnabled(enabled)
      soundEngine.setEnabled(enabled)
    })
  }, [])

  const handleToggleSound = useCallback(async () => {
    const newEnabled = !soundEnabled
    setSoundEnabled(newEnabled)
    soundEngine.setEnabled(newEnabled)
    await storage.setSoundEnabled(newEnabled)
  }, [soundEnabled])

  const handleClear = useCallback(async (gameState: GameState, clearTimeMs: number) => {
    const solutionId = 0  // TODO: solution matching after solution data generation
    navigate({
      screen: 'clear-animation',
      puzzleId: gameState.puzzleId,
      clearTimeMs,
      solutionId,
      gameState,
    })
  }, [navigate])

  const handleClearAnimationComplete = useCallback(async () => {
    if (appState.screen !== 'clear-animation') return
    const { puzzleId, clearTimeMs, solutionId, gameState } = appState
    await storage.saveClear({
      puzzleId,
      solutionId,
      clearTimeMs,
      actions: gameState.actions,
      clearedAt: new Date().toISOString(),
    })
    await loadRecords()
    navigate({ screen: 'result', puzzleId, clearTimeMs, solutionId })
  }, [appState, loadRecords, navigate])

  switch (appState.screen) {
    case 'title':
      return <TitleScreen onStart={() => navigate({ screen: 'puzzle-select' })} />

    case 'puzzle-select':
      return (
        <PuzzleSelectScreen
          puzzles={PUZZLES}
          records={records}
          onSelect={id => navigate({ screen: 'game', puzzleId: id })}
          onGallery={id => navigate({ screen: 'solution-gallery', puzzleId: id })}
        />
      )

    case 'game': {
      const puzzle = PUZZLES.find(p => p.id === appState.puzzleId)!
      return <GameScreen puzzle={puzzle} soundEngine={soundEngine} soundEnabled={soundEnabled} onToggleSound={handleToggleSound} onClear={handleClear} />
    }

    case 'clear-animation':
      return <ClearAnimation onComplete={handleClearAnimationComplete} />

    case 'result':
      return (
        <ResultScreen
          clearTimeMs={appState.clearTimeMs}
          solutionId={appState.solutionId}
          onPlayAgain={() => navigate({ screen: 'game', puzzleId: appState.puzzleId })}
          onBack={() => navigate({ screen: 'puzzle-select' })}
        />
      )

    case 'solution-gallery': {
      const record = records.get(appState.puzzleId)
      return (
        <SolutionGalleryScreen
          puzzleId={appState.puzzleId}
          discoveredIds={record?.discoveredSolutionIds ?? []}
          onBack={() => navigate({ screen: 'puzzle-select' })}
        />
      )
    }
  }
}
