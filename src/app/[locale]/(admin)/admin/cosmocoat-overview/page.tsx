import { FlowDiagram } from './FlowDiagram'

export default function CosmoCoatOverviewPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          物料流向总览
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          展示原材料 → 配方 → 半成品 → 工厂产品 → 调色单 / 工艺书的完整关联关系。鼠标悬停节点可高亮关联路径。
        </p>
      </div>
      <FlowDiagram />
    </div>
  )
}
