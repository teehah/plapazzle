import '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { cellsToGeometry } from './geometry'

type Props = {
  cells: Cell[]
  cellSize: number
  gridType: GridType
}

export function BoardMesh({ cells, cellSize, gridType }: Props) {
  const geometry = useMemo(
    () => cellsToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  // cellsToGeometry がセンタリング済みなので、原点に配置
  return (
    <mesh geometry={geometry} position={[0, 0, -2]}>
      <meshPhysicalMaterial
        transmission={0.9}
        roughness={0.1}
        ior={1.5}
        thickness={2}
        color="#ffffff"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
