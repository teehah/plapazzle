interface Node {
  L: Node; R: Node; U: Node; D: Node
  C: ColNode
  rowIndex: number
}

interface ColNode extends Node {
  size: number
  name: number
}

function makeNode(rowIndex: number, col: ColNode): Node {
  const n = { rowIndex, C: col } as unknown as Node
  n.L = n; n.R = n; n.U = n; n.D = n
  return n
}

function makeColNode(name: number): ColNode {
  const h = { size: 0, name, rowIndex: -1 } as unknown as ColNode
  h.L = h; h.R = h; h.U = h; h.D = h; h.C = h
  return h
}

function cover(c: ColNode) {
  c.R.L = c.L
  c.L.R = c.R
  for (let i = c.D; i !== c; i = i.D) {
    for (let j = i.R; j !== i; j = j.R) {
      j.D.U = j.U
      j.U.D = j.D
      j.C.size--
    }
  }
}

function uncover(c: ColNode) {
  for (let i = c.U; i !== c; i = i.U) {
    for (let j = i.L; j !== i; j = j.L) {
      j.C.size++
      j.D.U = j
      j.U.D = j
    }
  }
  c.R.L = c
  c.L.R = c
}

export function solveExactCover(
  numCols: number,
  rows: number[][],
  onSolution: (selectedRows: number[]) => void,
  shouldPrune?: (uncoveredCols: () => number[]) => boolean,
): void {
  const h = makeColNode(-1)

  const colNodes: ColNode[] = []
  let prev: ColNode | typeof h = h
  for (let i = 0; i < numCols; i++) {
    const c = makeColNode(i)
    c.L = prev; c.R = h
    prev.R = c; h.L = c
    colNodes.push(c)
    prev = c
  }

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    let first: Node | null = null
    let prevNode: Node | null = null
    for (const ci of row) {
      const col = colNodes[ci]
      const node = makeNode(ri, col)
      node.U = col.U; node.D = col
      col.U.D = node; col.U = node
      col.size++
      if (first === null) {
        first = node; prevNode = node
      } else {
        node.L = prevNode!; node.R = first
        prevNode!.R = node; first.L = node
        prevNode = node
      }
    }
  }

  // 未カバー列の列挙（pruning用）
  function getUncoveredCols(): number[] {
    const cols: number[] = []
    for (let j = h.R as ColNode; j !== h; j = j.R as ColNode) {
      cols.push(j.name)
    }
    return cols
  }

  const solution: number[] = []
  function search() {
    if (h.R === h) {
      onSolution([...solution])
      return
    }
    // S heuristic: 最小サイズの列を選ぶ
    let c = h.R as ColNode
    for (let j = c.R as ColNode; j !== h; j = j.R as ColNode) {
      if (j.size < c.size) c = j
    }
    cover(c)
    for (let r = c.D; r !== c; r = r.D) {
      solution.push(r.rowIndex)
      for (let j = r.R; j !== r; j = j.R) cover(j.C)

      if (!shouldPrune || !shouldPrune(getUncoveredCols)) {
        search()
      }

      for (let j = r.L; j !== r; j = j.L) uncover(j.C)
      solution.pop()
    }
    uncover(c)
  }
  search()
}
