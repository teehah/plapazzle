import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { cellsToGeometry } from '../geometry'
import type { Cell } from '../../core/grid'

describe('cellsToGeometry (auto-centered)', () => {
  it('正方形グリッドの1セルジオメトリが生成される', () => {
    const cells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const geo = cellsToGeometry(cells, 30, 'square')
    expect(geo).toBeInstanceOf(THREE.BufferGeometry)
  })

  it('生成されたジオメトリは原点にセンタリングされている', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    const cx = (box.min.x + box.max.x) / 2
    const cy = (box.min.y + box.max.y) / 2
    expect(cx).toBeCloseTo(0, 0)
    expect(cy).toBeCloseTo(0, 0)
  })

  it('mesh.position でワールド位置を制御できる', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')
    const mesh = new THREE.Mesh(geo)
    mesh.position.set(100, -50, 0)
    mesh.updateMatrixWorld(true)

    const worldBox = new THREE.Box3().setFromObject(mesh)
    const worldCenter = new THREE.Vector3()
    worldBox.getCenter(worldCenter)

    expect(worldCenter.x).toBeCloseTo(100, 0)
    expect(worldCenter.y).toBeCloseTo(-50, 0)
  })

  it('group > mesh 構造でもワールド位置が一致する', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 1, col: 1, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')
    const group = new THREE.Group()
    group.position.set(200, 100, 5)
    const mesh = new THREE.Mesh(geo)
    group.add(mesh)
    group.updateMatrixWorld(true)

    const worldBox = new THREE.Box3().setFromObject(group)
    const worldCenter = new THREE.Vector3()
    worldBox.getCenter(worldCenter)

    expect(worldCenter.x).toBeCloseTo(200, 0)
    expect(worldCenter.y).toBeCloseTo(100, 0)
  })
})
