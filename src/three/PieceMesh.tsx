import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshTransmissionMaterial } from '@react-three/drei'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { pieceToGeometry, pieceRimLineGeometry } from './geometry'

type Props = {
  cells: Cell[]
  cellSize: number
  gridType: GridType
  color: string
  position: [number, number, number]
  scale?: number
}

export function PieceMesh({
  cells, cellSize, gridType, color, position, scale = 1,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(
    () => pieceToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  const rimLines = useMemo(
    () => pieceRimLineGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  const rimColor = useMemo(() => {
    const c = new THREE.Color(color)
    c.multiplyScalar(0.5)
    return c
  }, [color])

  const attenuationColor = useMemo(() => new THREE.Color(color), [color])

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* フェイクコースティクス: ライト方向にオフセット + 拡大 + 多層ぼかし */}
      <mesh geometry={geometry} position={[3, -2, -2.2]} scale={[1.15, 1.15, 1]}>
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry} position={[2.5, -1.5, -2.1]} scale={[1.08, 1.08, 1]}>
        <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry} position={[2, -1, -2]} scale={[1.03, 1.03, 1]}>
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef} geometry={geometry}>
        <MeshTransmissionMaterial
          transmission={0.6}
          roughness={0.03}
          thickness={6}
          ior={1.5}
          chromaticAberration={0.02}
          anisotropy={0}
          color={color}
          attenuationColor={attenuationColor}
          attenuationDistance={30}
          envMapIntensity={3}
          samples={4}
          resolution={256}
        />
      </mesh>
      <lineLoop geometry={rimLines.outer}>
        <lineBasicMaterial color={rimColor} linewidth={1} />
      </lineLoop>
      <lineLoop geometry={rimLines.inner}>
        <lineBasicMaterial color={rimColor} linewidth={1} />
      </lineLoop>
    </group>
  )
}
