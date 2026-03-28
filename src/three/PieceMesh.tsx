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

  const geometry = useMemo(() => {
    const geo = cellsToGeometry(cells, cellSize, gridType)
    // ジオメトリをセンタリング: position がピースの視覚的中心と一致するようにする
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    const cx = (box.min.x + box.max.x) / 2
    const cy = (box.min.y + box.max.y) / 2
    geo.translate(-cx, -cy, 0)
    return geo
  }, [cells, cellSize, gridType])

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
