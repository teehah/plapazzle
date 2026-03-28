import '@react-three/fiber'
import { Environment } from '@react-three/drei'

type Props = { darkMode: boolean }

export function Lighting({ darkMode }: Props) {
  if (darkMode) {
    return (
      <>
        <ambientLight intensity={0.3} />
        <spotLight position={[0, 0, 50]} angle={0.5} penumbra={0.8} intensity={2.0} castShadow />
        <Environment preset="night" />
      </>
    )
  }
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 30]} intensity={0.8} castShadow />
      <directionalLight position={[-5, -5, 20]} intensity={0.3} />
      <Environment preset="apartment" />
    </>
  )
}
