/**
 * One-off: mark implemented feedback items as DONE.
 * Run: npx tsx scripts/mark-feature-requests-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat 配方成本单价应按百分比计算' } },
      { title: { contains: '取消配方页面包装要求字段自动预填' } },
      { title: { contains: '配方詳情包裝要求預設選項' } },
      { title: { contains: '日记账导入模板增加按会计科目名称匹配模式' } },
      { title: { contains: '优化颜色匹配公式详情打印格式' } },
      { title: { contains: 'Pantone色号预览区域放大300%' } },
      { title: { contains: 'CosmoCoat 产品总表增加粘度列显示' } },
      { title: { contains: '颜色配方管理产品分类筛选修复及功能移除' } },
      { title: { contains: '移除调色配方列表区"新建配方"按钮' } },
      { title: { contains: 'Color Matching Formulas 页面分类筛选改为单选模式' } },
      { title: { contains: '颜色配方适用产品行支持编辑数量和单价自动获取' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpw8u640001bs9w57i7rt5pz' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpw85fu9000cs9w5bv7inptc' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpo3rjth000zhcw5wkfljy1d' } },
      { pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/journal' } },
    ],
  },
})

for (const item of items) {
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total updated:', items.length)
await prisma.$disconnect()
