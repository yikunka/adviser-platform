'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────
type NodeType = 'rawMaterial' | 'recipe' | 'semiFinished' | 'factoryProduct' | 'colorFormula' | 'processKit'

interface RawNode {
  id: string
  code: string
  name: string
  category?: string
}

interface GraphNode extends RawNode {
  type: NodeType
  layer: number
  x: number
  y: number
  connected: boolean
}

interface GraphEdge {
  from: string
  to: string
  color: string
  key: string
}

interface OverviewData {
  nodes: {
    rawMaterials: RawNode[]
    recipes: RawNode[]
    semiFinished: RawNode[]
    factoryProducts: RawNode[]
    colorFormulas: RawNode[]
    processKits: RawNode[]
  }
  edges: {
    rawToRecipe: { from: string; to: string }[]
    recipeToRecipe: { from: string; to: string }[]
    semiToRecipe: { from: string; to: string }[]
    recipeToSemiFinished: { from: string; to: string }[]
    recipeToProduct: { from: string; to: string }[]
    recipeToColorFormula: { from: string; to: string }[]
    rawToColorFormula: { from: string; to: string }[]
    semiToColorFormula: { from: string; to: string }[]
    productToColorFormula: { from: string; to: string }[]
    productToProcessKit: { from: string; to: string }[]
  }
}

// ── Visual constants ───────────────────────────────────────────────
const TYPE_COLOR: Record<NodeType, string> = {
  rawMaterial:   '#4ade80',
  recipe:        '#60a5fa',
  semiFinished:  '#f59e0b',
  factoryProduct:'#a78bfa',
  colorFormula:  '#f472b6',
  processKit:    '#fb923c',
}

const TYPE_LABEL: Record<NodeType, string> = {
  rawMaterial:   '原材料',
  recipe:        '配方',
  semiFinished:  '半成品',
  factoryProduct:'工厂产品',
  colorFormula:  '调色单',
  processKit:    '工艺书',
}

// Layout
const NODES_PER_ROW = 30
const H_SPACING    = 36   // horizontal gap between node centres
const V_ROW_GAP    = 32   // vertical gap between rows within a band
const BAND_PAD_TOP = 20
const BAND_PAD_BOT = 14
const INTER_GAP    = 60   // vertical space between bands (for edges)
const NODE_R       = 5
const CANVAS_H_PAD = 48

// ── Build graph ────────────────────────────────────────────────────
interface Band { type: NodeType; label: string; y: number; height: number }

function buildGraph(data: OverviewData) {
  const kitIds = new Set(data.nodes.processKits.map(k => k.id))

  // All raw edge pairs
  const allPairs: { from: string; to: string; color: string }[] = [
    ...data.edges.rawToRecipe.map(e => ({ ...e, color: TYPE_COLOR.rawMaterial })),
    ...data.edges.recipeToRecipe.map(e => ({ ...e, color: TYPE_COLOR.recipe })),
    ...data.edges.semiToRecipe.map(e => ({ ...e, color: TYPE_COLOR.semiFinished })),
    ...(data.edges.recipeToSemiFinished ?? []).map(e => ({ ...e, color: TYPE_COLOR.recipe })),
    ...data.edges.recipeToProduct.map(e => ({ ...e, color: TYPE_COLOR.recipe })),
    ...data.edges.recipeToColorFormula.map(e => ({ ...e, color: TYPE_COLOR.recipe })),
    ...data.edges.rawToColorFormula.map(e => ({ ...e, color: TYPE_COLOR.rawMaterial })),
    ...data.edges.semiToColorFormula.map(e => ({ ...e, color: TYPE_COLOR.semiFinished })),
    ...data.edges.productToColorFormula.map(e => ({ ...e, color: TYPE_COLOR.factoryProduct })),
    ...data.edges.productToProcessKit.map(e => ({ ...e, color: TYPE_COLOR.factoryProduct })),
  ]

  // Dedup
  const pairSet = new Set<string>()
  const dedupedPairs: typeof allPairs = []
  for (const p of allPairs) {
    const k = `${p.from}::${p.to}`
    if (!pairSet.has(k)) { pairSet.add(k); dedupedPairs.push(p) }
  }

  const connectedIds = new Set<string>()
  for (const p of dedupedPairs) {
    connectedIds.add(p.from)
    connectedIds.add(p.to)
  }

  // Layer definitions
  const LAYERS: { type: NodeType; label: string; items: RawNode[] }[] = [
    { type: 'rawMaterial',    label: '原材料',          items: data.nodes.rawMaterials },
    { type: 'recipe',         label: '配方',            items: data.nodes.recipes },
    { type: 'semiFinished',   label: '半成品',          items: data.nodes.semiFinished },
    { type: 'factoryProduct', label: '工厂产品',        items: data.nodes.factoryProducts },
    {
      type: 'colorFormula',
      label: '调色单 / 工艺书',
      items: [...data.nodes.colorFormulas, ...data.nodes.processKits],
    },
  ]

  const nodes: GraphNode[] = []
  const bands: Band[] = []
  let currentY = 16
  const canvasWidth = NODES_PER_ROW * H_SPACING + CANVAS_H_PAD * 2

  for (let li = 0; li < LAYERS.length; li++) {
    const { type, label, items } = LAYERS[li]

    if (items.length === 0) continue

    // Sort: connected first, then by code
    const sorted = [...items].sort((a, b) => {
      const ac = connectedIds.has(a.id) ? 0 : 1
      const bc = connectedIds.has(b.id) ? 0 : 1
      if (ac !== bc) return ac - bc
      return a.code.localeCompare(b.code)
    })

    const numRows = Math.ceil(sorted.length / NODES_PER_ROW)
    const bandH = BAND_PAD_TOP + numRows * V_ROW_GAP + BAND_PAD_BOT

    bands.push({ type, label, y: currentY, height: bandH })

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i]
      const row = Math.floor(i / NODES_PER_ROW)
      const col = i % NODES_PER_ROW
      const countInRow = Math.min(NODES_PER_ROW, sorted.length - row * NODES_PER_ROW)
      // Centre the last (possibly shorter) row
      const rowStartX = CANVAS_H_PAD + ((NODES_PER_ROW - countInRow) / 2) * H_SPACING

      const nodeType: NodeType =
        type === 'colorFormula' && kitIds.has(item.id) ? 'processKit' : type

      nodes.push({
        ...item,
        type: nodeType,
        layer: li,
        x: rowStartX + col * H_SPACING,
        y: currentY + BAND_PAD_TOP + row * V_ROW_GAP,
        connected: connectedIds.has(item.id),
      })
    }

    currentY += bandH + INTER_GAP
  }

  const canvasHeight = currentY + 16

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const edges: GraphEdge[] = dedupedPairs
    .filter(p => nodeMap.has(p.from) && nodeMap.has(p.to))
    .map(p => ({ from: p.from, to: p.to, color: p.color, key: `${p.from}::${p.to}` }))

  return { nodes, edges, nodeMap, bands, canvasWidth, canvasHeight }
}

// ── Edge path (bezier) ─────────────────────────────────────────────
function edgePath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x, y1 = from.y + NODE_R
  const x2 = to.x,   y2 = to.y - NODE_R

  if (from.layer === to.layer) {
    // Same-layer arc (recipe→recipe)
    const arc = Math.abs(x2 - x1) * 0.25 + 18
    return `M ${x1} ${y1} C ${x1} ${y1 + arc}, ${x2} ${y2 + arc}, ${x2} ${y2}`
  }
  if (from.layer > to.layer) {
    // Upward (semi→recipe): curve going up and left
    const ctrl = (from.y - to.y) * 0.55
    return `M ${x1} ${y1} C ${x1} ${y1 - ctrl}, ${x2} ${y2 + ctrl}, ${x2} ${y2}`
  }
  // Normal downward
  const cy = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`
}

// ── Full-chain BFS (both directions) ─────────────────────────────
function getFullChain(startId: string, edges: GraphEdge[]) {
  const fwd = new Map<string, string[]>()
  const bwd = new Map<string, string[]>()
  for (const e of edges) {
    if (!fwd.has(e.from)) fwd.set(e.from, [])
    fwd.get(e.from)!.push(e.to)
    if (!bwd.has(e.to)) bwd.set(e.to, [])
    bwd.get(e.to)!.push(e.from)
  }

  const chainNodes = new Set<string>([startId])
  const chainEdges = new Set<string>()

  const bfs = (adj: Map<string, string[]>, getEdgeKey: (cur: string, nb: string) => string) => {
    const queue = [startId]
    const visited = new Set([startId])
    while (queue.length) {
      const cur = queue.shift()!
      for (const nb of (adj.get(cur) ?? [])) {
        chainEdges.add(getEdgeKey(cur, nb))
        if (!visited.has(nb)) {
          visited.add(nb)
          chainNodes.add(nb)
          queue.push(nb)
        }
      }
    }
  }

  bfs(fwd, (c, n) => `${c}::${n}`)
  bfs(bwd, (c, n) => `${n}::${c}`)

  return { chainNodes, chainEdges }
}

// ── Component ──────────────────────────────────────────────────────
export function FlowDiagram() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{
    node: GraphNode
    screenX: number
    screenY: number
    connCount: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/admin/cosmocoat/overview-graph')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('加载数据失败'); setLoading(false) })
  }, [])

  const graph = useMemo(() => data ? buildGraph(data) : null, [data])

  const chain = useMemo(
    () => selected && graph ? getFullChain(selected, graph.edges) : null,
    [selected, graph],
  )

  const handleNodeClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(prev => (prev === id ? null : id))
  }, [])

  const handleNodeHover = useCallback(
    (node: GraphNode | null, e?: React.MouseEvent) => {
      if (!node || !graph) { setTooltip(null); return }
      const connCount = graph.edges.filter(ed => ed.from === node.id || ed.to === node.id).length
      setTooltip({ node, screenX: e!.clientX, screenY: e!.clientY, connCount })
    },
    [graph],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 220px)', color: 'var(--muted-foreground)' }}>
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          <p className="text-sm">正在加载物料流向图…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400 text-sm">{error}</div>
    )
  }

  if (!graph) return null

  const { nodes, edges, nodeMap, bands, canvasWidth, canvasHeight } = graph
  const totalEdges = edges.length

  // Ambient path IDs (every 6th edge for ambient particles)
  const ambientEdges = edges.filter((_, i) => i % 6 === 0)
  // Chain edges for particles
  const chainEdgeList = chain
    ? edges.filter(e => chain.chainEdges.has(e.key))
    : []

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 220px)' }}>
      {/* ── Legend bar ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 flex-shrink-0">
        {(Object.entries(TYPE_LABEL) as [NodeType, string][]).map(([t, label]) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: TYPE_COLOR[t] }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>
          {nodes.length} 节点 · {totalEdges} 关联
          {chain && ` · 链路 ${chain.chainNodes.size} 个节点`}
        </span>
        {selected && (
          <button onClick={() => setSelected(null)}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
            清除选择
          </button>
        )}
      </div>

      {/* ── SVG canvas ── */}
      <div
        className="overflow-auto rounded-lg flex-1 relative"
        style={{ background: '#070707', border: '1px solid var(--sidebar-border)' }}
        onClick={() => setSelected(null)}
      >
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm"
            style={{ color: 'var(--muted-foreground)' }}>
            暂无数据，请先录入原材料和配方
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            width={canvasWidth}
            height={canvasHeight}
            style={{ display: 'block' }}
          >
            <defs>
              {/* Glow filters */}
              {(Object.entries(TYPE_COLOR) as [NodeType, string][]).map(([t, c]) => (
                <filter key={t} id={`glow-${t}`} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              ))}

              {/* Path defs for ambient particles */}
              {!selected && ambientEdges.map((e, i) => {
                const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to)
                if (!fn || !tn) return null
                return <path key={`adef-${i}`} id={`apath-${i}`} d={edgePath(fn, tn)} fill="none" />
              })}

              {/* Path defs for chain particles */}
              {chainEdgeList.map((e, i) => {
                const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to)
                if (!fn || !tn) return null
                return <path key={`cdef-${i}`} id={`cpath-${i}`} d={edgePath(fn, tn)} fill="none" />
              })}
            </defs>

            {/* ── Band backgrounds ── */}
            {bands.map(b => (
              <g key={b.type}>
                <rect x={0} y={b.y} width={canvasWidth} height={b.height}
                  fill={TYPE_COLOR[b.type]} fillOpacity={0.04} />
                <text x={10} y={b.y + 13} fontSize={9}
                  fill={TYPE_COLOR[b.type]} fillOpacity={0.5}
                  fontWeight={700} letterSpacing={1.5} fontFamily="monospace">
                  {b.label.toUpperCase()}
                </text>
              </g>
            ))}

            {/* ── Edges ── */}
            {edges.map(e => {
              const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to)
              if (!fn || !tn) return null
              const inChain = chain?.chainEdges.has(e.key)

              if (selected) {
                if (!inChain) return (
                  <path key={e.key} d={edgePath(fn, tn)}
                    stroke={e.color} strokeWidth={0.5} fill="none" strokeOpacity={0.04} />
                )
                return (
                  <path key={e.key} d={edgePath(fn, tn)}
                    stroke={e.color} strokeWidth={1.5} fill="none" strokeOpacity={0.75}
                    filter={`url(#glow-${fn.type})`} />
                )
              }
              return (
                <path key={e.key} d={edgePath(fn, tn)}
                  stroke={e.color} strokeWidth={0.7} fill="none" strokeOpacity={0.18} />
              )
            })}

            {/* ── Ambient particles (idle state) ── */}
            {!selected && ambientEdges.map((e, i) => {
              const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to)
              if (!fn || !tn) return null
              return (
                <circle key={`ap-${i}`} r={1.5} fill={e.color} fillOpacity={0.55}>
                  <animateMotion dur="3.5s" begin={`${(i * 0.43) % 4}s`} repeatCount="indefinite">
                    <mpath href={`#apath-${i}`} />
                  </animateMotion>
                </circle>
              )
            })}

            {/* ── Chain particles (selection state) ── */}
            {chainEdgeList.map((e, i) => {
              const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to)
              if (!fn || !tn) return null
              return (
                <circle key={`cp-${i}`} r={2.5} fill={e.color} fillOpacity={0.95}>
                  <animateMotion dur="1.4s" begin={`${(i * 0.28) % 1.4}s`} repeatCount="indefinite">
                    <mpath href={`#cpath-${i}`} />
                  </animateMotion>
                </circle>
              )
            })}

            {/* ── Nodes ── */}
            {nodes.map(node => {
              const color = TYPE_COLOR[node.type]
              const isSelected = selected === node.id
              const inChain = chain?.chainNodes.has(node.id)
              const opacity = selected ? (inChain ? 1 : 0.08) : 1
              const r = isSelected ? NODE_R + 3 : NODE_R

              return (
                <g key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={opacity}
                  style={{ cursor: 'pointer' }}
                  onClick={ev => handleNodeClick(node.id, ev)}
                  onMouseEnter={ev => handleNodeHover(node, ev)}
                  onMouseLeave={() => handleNodeHover(null)}
                >
                  {/* Invisible hit area */}
                  <circle r={12} fill="transparent" />

                  {node.connected ? (
                    <circle r={r}
                      fill={color}
                      fillOpacity={isSelected ? 0.35 : 0.14}
                      stroke={color}
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeOpacity={isSelected ? 1 : 0.75}
                    />
                  ) : (
                    // Unconnected: dashed dim ring
                    <circle r={NODE_R}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Centre dot */}
                  <circle r={isSelected ? 3 : 2}
                    fill={color} fillOpacity={node.connected ? 0.95 : 0.3} />

                  {/* Label on hover / select */}
                  {isSelected && (
                    <text y={-r - 5} textAnchor="middle"
                      fontSize={8} fill={color} fontWeight={700}>
                      {node.code}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className="pointer-events-none fixed z-50 max-w-xs rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            background: '#101010',
            border: `1px solid ${TYPE_COLOR[tooltip.node.type]}44`,
            color: 'var(--foreground)',
            left: `${tooltip.screenX}px`,
            top: `${tooltip.screenY}px`,
            transform: 'translate(-50%, calc(-100% - 12px))',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: TYPE_COLOR[tooltip.node.type] }} />
            <span className="font-semibold" style={{ color: TYPE_COLOR[tooltip.node.type] }}>
              {TYPE_LABEL[tooltip.node.type]}
            </span>
          </div>
          <div className="font-medium leading-snug">{tooltip.node.name}</div>
          <div className="mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{tooltip.node.code}</div>
          {!tooltip.node.connected && (
            <div className="mt-1 text-amber-400">未被使用</div>
          )}
          {tooltip.connCount > 0 && (
            <div className="mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {tooltip.connCount} 条关联 · 点击高亮全链路
            </div>
          )}
        </div>
      )}
    </div>
  )
}
