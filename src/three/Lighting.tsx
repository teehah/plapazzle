import '@react-three/fiber'

type Props = { darkMode: boolean }

export function Lighting({ darkMode }: Props) {
  if (darkMode) {
    return (
      <>
        <ambientLight intensity={0.2} />
        <spotLight
          position={[0, 0, 50]}
          angle={0.5}
          penumbra={0.8}
          intensity={1.5}
          castShadow
        />
      </>
    )
  }
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 30]} intensity={0.8} castShadow />
    </>
  )
}
