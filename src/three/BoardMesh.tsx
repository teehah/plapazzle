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

  const center = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    return new THREE.Vector3(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      0,
    )
  }, [geometry])

  return (
    <mesh geometry={geometry} position={[center.x, center.y, -2]}>
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
