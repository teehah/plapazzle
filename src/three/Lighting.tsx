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
      <ambientLight intensity={0.8} />
      <directionalLight position={[12, 7, 10]} intensity={3.0} />
      <directionalLight position={[-10, -5, 6]} intensity={1.5} />
      <Environment preset="city" />
    </>
  )
}
