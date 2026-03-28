import type { ThreeEvent } from '@react-three/fiber'
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
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void
}

export function PieceMesh({
  cells,
  cellSize,
  gridType,
  color,
  position,
  scale = 1,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
