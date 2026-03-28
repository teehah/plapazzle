import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { cellsToGeometry } from '../geometry'
import type { Cell } from '../../core/grid'

describe('cellsToGeometry + centering', () => {
  it('正方形グリッドの1セルジオメトリが生成される', () => {
    const cells: Cell[] = [{ row: 0, col: 0, dir: 0 }]
    const geo = cellsToGeometry(cells, 30, 'square')
    expect(geo).toBeInstanceOf(THREE.BufferGeometry)
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    // SVG coords: (0,0), (30,0), (30,30), (0,30)
    // Three.js: (0,0), (30,0), (30,-30), (0,-30) + extrusion
    expect(box.min.x).toBeCloseTo(0, 0)
    expect(box.max.x).toBeCloseTo(30, 0)
  })

  it('センタリング後にバウンディングボックスが原点中心になる', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
      { row: 0, col: 2, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')

    // センタリング前
    geo.computeBoundingBox()
    const before = geo.boundingBox!.clone()
    expect(before.min.x).toBeCloseTo(0, 0) // SVG x starts at 0

    // センタリング実行（PieceMesh と同じロジック）
    const cx = (before.min.x + before.max.x) / 2
    const cy = (before.min.y + before.max.y) / 2
    geo.translate(-cx, -cy, 0)

    // センタリング後
    geo.computeBoundingBox()
    const after = geo.boundingBox!
    const centerX = (after.min.x + after.max.x) / 2
    const centerY = (after.min.y + after.max.y) / 2
    expect(centerX).toBeCloseTo(0, 0)
    expect(centerY).toBeCloseTo(0, 0)
  })

  it('ワールド位置がmesh.positionと一致する', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 0, col: 1, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')

    // センタリング
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    geo.translate(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      0,
    )

    // mesh を作成して位置を設定
    const mesh = new THREE.Mesh(geo)
    mesh.position.set(100, -50, 0)
    mesh.updateMatrixWorld(true)

    // ワールドバウンディングボックスの中心が mesh.position に一致
    const worldBox = new THREE.Box3().setFromObject(mesh)
    const worldCenter = new THREE.Vector3()
    worldBox.getCenter(worldCenter)

    expect(worldCenter.x).toBeCloseTo(100, 0)
    expect(worldCenter.y).toBeCloseTo(-50, 0)
  })

  it('group に position を設定した場合もワールド位置が一致する', () => {
    const cells: Cell[] = [
      { row: 0, col: 0, dir: 0 },
      { row: 1, col: 0, dir: 0 },
      { row: 1, col: 1, dir: 0 },
    ]
    const geo = cellsToGeometry(cells, 30, 'square')

    // センタリング
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    geo.translate(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      0,
    )

    // group > mesh 構造（GameScreen と同じ）
    const group = new THREE.Group()
    group.position.set(200, 100, 5)
    const mesh = new THREE.Mesh(geo)
    // PieceMesh は position=[0,0,0]
    group.add(mesh)
    group.updateMatrixWorld(true)

    const worldBox = new THREE.Box3().setFromObject(group)
    const worldCenter = new THREE.Vector3()
    worldBox.getCenter(worldCenter)

    expect(worldCenter.x).toBeCloseTo(200, 0)
    expect(worldCenter.y).toBeCloseTo(100, 0)
    // z はジオメトリの extrusion depth (3) + bevel 分だけオフセットされる
    expect(worldCenter.z).toBeGreaterThan(4)
    expect(worldCenter.z).toBeLessThan(8)
  })
})
