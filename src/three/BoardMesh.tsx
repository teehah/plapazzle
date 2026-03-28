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
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          roughness={0.05}
          metalness={0}
          ior={1.5}
          thickness={2}
          attenuationColor={new THREE.Color('#e0e0e0')}
          attenuationDistance={2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 外枠フレーム */}
      <mesh geometry={frameGeo}>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.85}
          roughness={0.05}
          metalness={0}
          ior={1.5}
          thickness={3}
          attenuationColor={new THREE.Color('#d0d0d0')}
          attenuationDistance={2}
          clearcoat={0.5}
          clearcoatRoughness={0.1}
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
