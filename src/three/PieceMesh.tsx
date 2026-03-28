import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { cellsToGeometry } from './geometry'

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
    () => cellsToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      scale={[scale, scale, scale]}
    >
      <meshPhysicalMaterial
        transmission={0.7}
        roughness={0.15}
        ior={1.45}
        thickness={1.5}
        color={color}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
