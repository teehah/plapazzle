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
    c.multiplyScalar(0.6)
    return c
  }, [color])

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.8}
          roughness={0.15}
          metalness={0.1}
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
