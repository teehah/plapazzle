import '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { cellsToGeometry, boardFrameGeometry, boardFrameLineGeometry } from './geometry'

type Props = {
  cells: Cell[]
  cellSize: number
  gridType: GridType
}

export function BoardMesh({ cells, cellSize, gridType }: Props) {
  const cellGeo = useMemo(
    () => cellsToGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  const frameGeo = useMemo(
    () => boardFrameGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  const frameLines = useMemo(
    () => boardFrameLineGeometry(cells, cellSize, gridType),
    [cells, cellSize, gridType],
  )

  return (
    <group position={[0, 0, -2]}>
      {/* グリッドセル */}
      <mesh geometry={cellGeo}>
        <meshStandardMaterial
          color="#d0d0d0"
          transparent
          opacity={0.5}
          roughness={0.2}
          metalness={0.0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 外枠フレーム */}
      <mesh geometry={frameGeo}>
        <meshStandardMaterial
          color="#b8b8b8"
          transparent
          opacity={0.6}
          roughness={0.15}
          metalness={0.05}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* フレーム外縁線 */}
      <lineLoop geometry={frameLines.outer}>
        <lineBasicMaterial color="#888888" linewidth={1} />
      </lineLoop>
      {/* フレーム内縁線 */}
      <lineLoop geometry={frameLines.inner}>
        <lineBasicMaterial color="#999999" linewidth={1} />
      </lineLoop>
    </group>
  )
}
