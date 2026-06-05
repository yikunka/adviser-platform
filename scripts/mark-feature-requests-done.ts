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
      { title: { contains: '新建配方时包装要求字段保持为空' } },
      { title: { contains: '配方详情页新增独立QC区块' } },
      { title: { contains: 'CosmoCoat Recipes - 包装要求快速选择改为按钮' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmps4v2fh001gpyw50mglri50' } },
      { title: { contains: '日记账导入模板增加按会计科目名称匹配模式' } },
      { title: { contains: '优化颜色匹配公式详情打印格式' } },
      { title: { contains: 'Pantone色号预览区域放大300%' } },
      { title: { contains: 'CosmoCoat 产品总表增加粘度列显示' } },
      { title: { contains: '颜色配方管理产品分类筛选修复及功能移除' } },
      { title: { contains: '移除调色配方列表区"新建配方"按钮' } },
      { title: { contains: 'Color Matching Formulas 页面分类筛选改为单选模式' } },
      { title: { contains: '调色配方打印功能优化' } },
      { pageUrl: { contains: 'cosmocoat-color-formulas/cmpxgcv320004g5w5co61eb51' } },
      { title: { contains: '颜色配方适用产品行支持编辑数量和单价自动获取' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpw8u640001bs9w57i7rt5pz' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpw85fu9000cs9w5bv7inptc' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpo3rjth000zhcw5wkfljy1d' } },
      { pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/journal' } },
      { title: { contains: '日记账F1快捷键连续录入' } },
      { title: { contains: '日记账列表列顺序调整' } },
      { pageUrl: { contains: '/admin/financial/cmpuo422m00163iw5o0isz8e1/journal' } },
      { title: { contains: '配方页面产品选择控件优化与BUG修复' } },
      { pageUrl: { contains: 'cosmocoat-production-orders/new' } },
      { title: { contains: '财务报表恒等式校验与提示' } },
      { title: { contains: '一级科目自动汇总二级科目期初余额' } },
      { pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/accounts' } },
      { pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' } },
      { title: { contains: '移除调色配方待选物料的参考配方下拉筛选' } },
      { title: { contains: '生产单详情"本次实投"数据无法保存' } },
      { title: { contains: 'CosmoCoat 工厂产品黏度字段改为手动输入' } },
      { title: { contains: '财务报表移除货币符号' } },
      { title: { contains: '工艺产品列表添加修改功能' } },
      { pageUrl: { contains: '/admin/financial/cmpuo63sq001a3iw5bwz5xlg4/reports' } },
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
