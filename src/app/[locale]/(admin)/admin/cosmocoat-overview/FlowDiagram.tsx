'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type NodeId = string

interface GraphNode {
  id: NodeId
  code: string
  name: string
  category?: string
  layer: number
  x: number
  y: number
  type: 'rawMaterial' | 'recipe' | 'semiFinished' | 'factoryProduct' | 'colorFormula' | 'processKit'
}

interface GraphEdge {
  from: NodeId
  to: NodeId
  color: string
}

interface OverviewData {
  nodes: {
    rawMaterials: { id: string; code: string; name: string; category?: string }[]
    recipes: { id: string; code: string; name: string }[]
    semiFinished: { id: string; code: string; name: string }[]
    factoryProducts: { id: string; code: string; name: string }[]
    colorFormulas: { id: string; code: string; name: string }[]
    processKits: { id: string; code: string; name: string }[]
  }
  edges: {
    rawToRecipe: { from: string; to: string }[]
    recipeToRecipe: { from: string; to: string }[]
    semiToRecipe: { from: string; to: string }[]
    recipeToProduct: { from: string; to: string }[]
    recipeToColorFormula: { from: string; to: string }[]
    rawToColorFormula: { from: string; to: string }[]
    semiToColorFormula: { from: string; to: string }[]
    productToColorFormula: { from: string; to: string }[]
    productToProcessKit: { from: string; to: string }[]
  }
}

const LAYER_COLORS: Record<string, string> = {
  rawMaterial: '#4ade80',
  recipe: '#60a5fa',
  semiFinished: '#f59e0b',
  factoryProduct: '#a78bfa',
  colorFormula: '#f472b6',
  processKit: '#fb923c',
}

const LAYER_LABELS: Record<string, string> = {
  rawMaterial: '原材料',
  recipe: '配方',
  semiFinished: '半成品',
  factoryProduct: '工厂产品',
  colorFormula: '调色单',
  processKit: '工艺书',
}

const LAYER_Y = [80, 240, 380, 520, 660]

function buildGraph(data: OverviewData): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const nodeMap = new Map<string, GraphNode>()

  const addNodes = (
    items: { id: string; code: string; name: string; category?: string }[],
    type: GraphNode['type'],
    layer: number,
  ) => {
    items.forEach((item, i) => {
      const node: GraphNode = {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        layer,
        type,
        x: 0,
        y: LAYER_Y[layer] ?? 80 + layer * 140,
      }
      nodes.push(node)
      nodeMap.set(item.id, node)
    })
  }

  addNodes(data.nodes.rawMaterials, 'rawMaterial', 0)
  addNodes(data.nodes.recipes, 'recipe', 1)
  addNodes(data.nodes.semiFinished, 'semiFinished', 2)
  addNodes(data.nodes.factoryProducts, 'factoryProduct', 3)
  addNodes([...data.nodes.colorFormulas, ...data.nodes.processKits], 'colorFormula', 4)
  data.nodes.processKits.forEach(k => {
    const n = nodeMap.get(k.id)
    if (n) n.type = 'processKit'
  })

  // Assign x positions within each layer
  const layerNodes: Map<number, GraphNode[]> = new Map()
  for (const n of nodes) {
    if (!layerNodes.has(n.layer)) layerNodes.set(n.layer, [])
    layerNodes.get(n.layer)!.push(n)
  }

  const NODE_SPACING = 36
  const MIN_PADDING = 60

  layerNodes.forEach((layerItems) => {
    const totalWidth = Math.max(
      800,
      layerItems.length * NODE_SPACING + MIN_PADDING * 2,
    )
    layerItems.forEach((node, i) => {
      node.x = MIN_PADDING + (i / Math.max(1, layerItems.length - 1)) * (totalWidth - MIN_PADDING * 2)
    })
  })

  // Build edges
  const edges: GraphEdge[] = []

  const addEdges = (
    pairs: { from: string; to: string }[],
    color: string,
  ) => {
    for (const { from, to } of pairs) {
      if (nodeMap.has(from) && nodeMap.has(to)) {
        edges.push({ from, to, color })
      }
    }
  }

  addEdges(data.edges.rawToRecipe, LAYER_COLORS.rawMaterial)
  addEdges(data.edges.recipeToRecipe, LAYER_COLORS.recipe)
  addEdges(data.edges.semiToRecipe, LAYER_COLORS.semiFinished)
  addEdges(data.edges.recipeToProduct, LAYER_COLORS.recipe)
  addEdges(data.edges.recipeToColorFormula, LAYER_COLORS.recipe)
  addEdges(data.edges.rawToColorFormula, LAYER_COLORS.rawMaterial)
  addEdges(data.edges.semiToColorFormula, LAYER_COLORS.semiFinished)
  addEdges(data.edges.productToColorFormula, LAYER_COLORS.factoryProduct)
  addEdges(data.edges.productToProcessKit, LAYER_COLORS.factoryProduct)

  return { nodes, edges: edges.slice(0, 3000) }
}

function edgePath(
  fromNode: GraphNode,
  toNode: GraphNode,
): string {
  const x1 = fromNode.x
  const y1 = fromNode.y + 7
  const x2 = toNode.x
  const y2 = toNode.y - 7
  const cy = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`
}

function computeViewBox(nodes: GraphNode[]): { width: number; height: number } {
  if (nodes.length === 0) return { width: 900, height: 780 }
  const maxX = Math.max(...nodes.map(n => n.x)) + 60
  const maxY = Math.max(...nodes.map(n => n.y)) + 60
  return { width: Math.max(900, maxX), height: Math.max(780, maxY) }
}

interface TooltipInfo {
  screenX: number
  screenY: number
  node: GraphNode
  connectedCount: number
}

export function FlowDiagram() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [highlightEdges, setHighlightEdges] = useState<Set<string>>(new Set())
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetch('/api/admin/cosmocoat/overview-graph')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError('加载数据失败')
        setLoading(false)
      })
  }, [])

  const { nodes, edges } = data ? buildGraph(data) : { nodes: [], edges: [] }
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const { width: vbWidth, height: vbHeight } = computeViewBox(nodes)

  const handleNodeEnter = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      const node = nodeMap.get(nodeId)
      if (!node) return
      const relatedEdges = new Set<string>()
      let count = 0
      for (const edge of edges) {
        if (edge.from === nodeId || edge.to === nodeId) {
          relatedEdges.add(`${edge.from}::${edge.to}`)
          count++
        }
      }
      setHoveredId(nodeId)
      setHighlightEdges(relatedEdges)
      setTooltip({ screenX: e.clientX, screenY: e.clientY, node, connectedCount: count })
    },
    [edges, nodeMap],
  )

  const handleNodeLeave = useCallback(() => {
    setHoveredId(null)
    setHighlightEdges(new Set())
    setTooltip(null)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--muted-foreground)' }}>
        <div className="text-center space-y-2">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }}
          />
          <p className="text-sm">正在加载物料流向图…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const totalEdges = edges.length
  const hasData = nodes.length > 0

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {(Object.entries(LAYER_LABELS) as [string, string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: LAYER_COLORS[type] }}
            />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {label}
            </span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>
          共 {nodes.length} 个节点 · {totalEdges} 条关联
        </span>
      </div>

      {!hasData ? (
        <div
          className="flex items-center justify-center h-64 rounded-lg border border-dashed text-sm"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        >
          暂无数据，请先录入原材料和配方
        </div>
      ) : (
        <div
          className="overflow-auto rounded-lg"
          style={{ background: '#0a0a0a', border: '1px solid var(--sidebar-border)' }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${vbWidth} ${vbHeight}`}
            width={vbWidth}
            height={vbHeight}
            style={{ display: 'block', minWidth: '100%' }}
          >
            <defs>
              {/* Animated gradient for flow effect on edges */}
              {(Object.entries(LAYER_COLORS) as [string, string][]).map(([type, color]) => (
                <linearGradient
                  key={type}
                  id={`grad-${type}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={color} stopOpacity="0" />
                  <stop offset="40%" stopColor={color} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.9" />
                </linearGradient>
              ))}

              {/* Glow filters per color */}
              {(Object.entries(LAYER_COLORS) as [string, string][]).map(([type, color]) => (
                <filter key={`glow-${type}`} id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>

            {/* Layer band backgrounds */}
            {[
              { layer: 0, type: 'rawMaterial', label: '原材料' },
              { layer: 1, type: 'recipe', label: '配方' },
              { layer: 2, type: 'semiFinished', label: '半成品' },
              { layer: 3, type: 'factoryProduct', label: '工厂产品' },
              { layer: 4, type: 'colorFormula', label: '调色单 / 工艺书' },
            ].map(({ layer, type, label }) => {
              const layerNodes = nodes.filter(n => n.layer === layer)
              if (layerNodes.length === 0) return null
              const yCenter = LAYER_Y[layer] ?? 80 + layer * 140
              return (
                <g key={layer}>
                  <rect
                    x={0}
                    y={yCenter - 30}
                    width={vbWidth}
                    height={60}
                    fill={LAYER_COLORS[type]}
                    fillOpacity={0.04}
                    rx={0}
                  />
                  <text
                    x={12}
                    y={yCenter + 4}
                    fontSize={10}
                    fill={LAYER_COLORS[type]}
                    fillOpacity={0.6}
                    fontWeight={600}
                    letterSpacing={2}
                  >
                    {label.toUpperCase()}
                  </text>
                </g>
              )
            })}

            {/* Edges - background (dim) */}
            <g opacity={hoveredId ? 0.08 : 1}>
              {edges.map((e, i) => {
                const from = nodeMap.get(e.from)
                const to = nodeMap.get(e.to)
                if (!from || !to) return null
                return (
                  <path
                    key={i}
                    d={edgePath(from, to)}
                    stroke={e.color}
                    strokeWidth={1}
                    fill="none"
                    strokeOpacity={0.25}
                  />
                )
              })}
            </g>

            {/* Highlighted edges */}
            {hoveredId && (
              <g>
                {edges
                  .filter(e => highlightEdges.has(`${e.from}::${e.to}`))
                  .map((e, i) => {
                    const from = nodeMap.get(e.from)
                    const to = nodeMap.get(e.to)
                    if (!from || !to) return null
                    const pathId = `hpath-${i}`
                    const d = edgePath(from, to)
                    return (
                      <g key={i}>
                        <path
                          id={pathId}
                          d={d}
                          stroke={e.color}
                          strokeWidth={2}
                          fill="none"
                          strokeOpacity={0.8}
                          filter={`url(#glow-${from.type})`}
                        />
                        {/* Animated particle */}
                        <circle r={3} fill={e.color} fillOpacity={0.9}>
                          <animateMotion
                            dur="1.2s"
                            repeatCount="indefinite"
                            rotate="auto"
                          >
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </circle>
                      </g>
                    )
                  })}
              </g>
            )}

            {/* Ambient animated particles on all edges (sparse) */}
            {!hoveredId && edges.filter((_, i) => i % 5 === 0).map((e, i) => {
              const from = nodeMap.get(e.from)
              const to = nodeMap.get(e.to)
              if (!from || !to) return null
              const pathId = `apath-${i}`
              const d = edgePath(from, to)
              const delay = (i * 0.37) % 3
              return (
                <g key={`amb-${i}`}>
                  <path id={pathId} d={d} fill="none" stroke="none" />
                  <circle r={2} fill={e.color} fillOpacity={0.7}>
                    <animateMotion
                      dur="2.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    >
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const color = LAYER_COLORS[node.type]
              const isHovered = hoveredId === node.id
              const isConnected =
                hoveredId &&
                edges.some(
                  e =>
                    (e.from === hoveredId && e.to === node.id) ||
                    (e.to === hoveredId && e.from === node.id),
                )
              const opacity =
                !hoveredId ? 1 : isHovered || isConnected ? 1 : 0.2

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => handleNodeEnter(node.id, e)}
                  onMouseLeave={handleNodeLeave}
                  opacity={opacity}
                >
                  {/* Hit area */}
                  <circle r={14} fill="transparent" />

                  {/* Node ring */}
                  <circle
                    r={isHovered ? 9 : 6}
                    fill={color}
                    fillOpacity={isHovered ? 0.25 : 0.15}
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeOpacity={isHovered ? 1 : 0.8}
                    style={{ transition: 'r 0.15s, fill-opacity 0.15s' }}
                  />

                  {/* Center dot */}
                  <circle r={2.5} fill={color} fillOpacity={isHovered ? 1 : 0.9} />

                  {/* Label on hover */}
                  {isHovered && (
                    <text
                      y={-14}
                      textAnchor="middle"
                      fontSize={9}
                      fill={color}
                      fontWeight={600}
                    >
                      {node.code}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Floating tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none fixed z-50 max-w-xs rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{
                background: '#111',
                border: `1px solid ${LAYER_COLORS[tooltip.node.type]}44`,
                color: 'var(--foreground)',
                transform: 'translate(-50%, calc(-100% - 12px))',
                left: `${tooltip.screenX}px`,
                top: `${tooltip.screenY}px`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: LAYER_COLORS[tooltip.node.type] }}
                />
                <span className="font-semibold" style={{ color: LAYER_COLORS[tooltip.node.type] }}>
                  {LAYER_LABELS[tooltip.node.type]}
                </span>
              </div>
              <div className="font-medium leading-snug">{tooltip.node.name}</div>
              <div style={{ color: 'var(--muted-foreground)' }}>{tooltip.node.code}</div>
              {tooltip.connectedCount > 0 && (
                <div className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {tooltip.connectedCount} 条关联
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
