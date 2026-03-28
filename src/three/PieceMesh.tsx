import { useMemo, useRef } from 'react'
import * as THREE from 'three'
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
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial
          color={color}
          transmission={1.0}
          transparent
          opacity={1.0}
          roughness={0.1}
          metalness={0}
          ior={1.5}
          thickness={0.5}
          attenuationColor={attenuationColor}
          attenuationDistance={10}
          clearcoat={0.3}
          clearcoatRoughness={0.1}
          envMapIntensity={1.5}
          side={THREE.DoubleSide}
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
