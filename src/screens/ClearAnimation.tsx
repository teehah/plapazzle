import { useEffect } from 'react'

type Props = { onComplete: () => void }

export function ClearAnimation({ onComplete }: Props) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle, rgba(255,200,50,0.2) 0%, rgba(0,0,0,0.9) 100%)',
      zIndex: 100,
    }}>
      <div style={{
        fontSize: 48, fontWeight: 800, color: '#f39c12',
        textShadow: '0 0 40px rgba(243,156,18,0.5)',
        animation: 'pulse 1s ease-in-out infinite',
        fontFamily: 'sans-serif',
      }}>
        ✨ COMPLETE ✨
      </div>
      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
    </div>
  )
}
