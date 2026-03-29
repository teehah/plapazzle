import { useMemo } from 'react'
import * as THREE from 'three'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

type Props = {
  /** ヒント対象のセル群（ボード座標） */
  cells: Cell[]
  cellSize: number
  gridType: GridType
  color: string
  /** ボードのセンタリングオフセット */
  boardOffset: { x: number; y: number }
}

/**
 * ヒント用オーバーレイ。ボード上に半透明のセルをハイライト表示する。
 * ボードと同じ座標系で描画する。
 */
export function HintOverlay({ cells, cellSize, gridType, color, boardOffset }: Props) {
  const geometry = useMemo(() => {
    const ops = GRID_OPS[gridType]
    const shapes: THREE.Shape[] = []

    for (const cell of cells) {
      const pts = ops.cellToSvgPoints(cell, cellSize)
      const shape = new THREE.Shape()
      shape.moveTo(pts[0][0], -pts[0][1])
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(pts[i][0], -pts[i][1])
      }
      shape.closePath()
      shapes.push(shape)
    }

    if (shapes.length === 0) return new THREE.BufferGeometry()

    const geo = new THREE.ShapeGeometry(shapes)
    return geo
  }, [cells, cellSize, gridType])

  const threeColor = useMemo(() => new THREE.Color(color), [color])

  return (
    <group position={[-boardOffset.x, -boardOffset.y, 8]}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </group>
  )
}
