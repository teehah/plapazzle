import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Cell } from '../core/grid'
import type { GridType } from '../core/grid-ops'
import { GRID_OPS } from '../core/grid-ops'

const EXTRUDE_DEPTH = 3
const BEVEL_SIZE = 0.3
const BEVEL_SEGMENTS = 2

/**
 * Cell array -> merged ExtrudeGeometry.
 * Each cell becomes a Shape (from its SVG points), extruded into a thin prism.
 * All cells are merged into a single BufferGeometry.
 */
export function cellsToGeometry(
  cells: Cell[],
  cellSize: number,
  gridType: GridType,
): THREE.BufferGeometry {
  const ops = GRID_OPS[gridType]
  const geometries: THREE.ExtrudeGeometry[] = []

  for (const cell of cells) {
    const pts = ops.cellToSvgPoints(cell, cellSize)
    const shape = new THREE.Shape()
    shape.moveTo(pts[0][0], -pts[0][1]) // Flip Y for Three.js
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0], -pts[i][1])
    }
    shape.closePath()

    geometries.push(
      new THREE.ExtrudeGeometry(shape, {
        depth: EXTRUDE_DEPTH,
        bevelEnabled: true,
        bevelSize: BEVEL_SIZE,
        bevelThickness: BEVEL_SIZE,
        bevelSegments: BEVEL_SEGMENTS,
      }),
    )
  }

  if (geometries.length === 0) return new THREE.BufferGeometry()

  let result: THREE.BufferGeometry
  if (geometries.length === 1) {
    result = geometries[0]
  } else {
    result = mergeGeometries(geometries) ?? geometries[0]
    geometries.forEach((g) => g.dispose())
  }

  // センタリング: bounding box 中心を原点に移動
  result.computeBoundingBox()
  const box = result.boundingBox!
  result.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    0,
  )

  return result
}
