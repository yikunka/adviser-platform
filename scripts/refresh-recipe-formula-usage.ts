/**
 * Backfill cos_table_recipes.formula_is_used after migration.
 * Usage: npx tsx scripts/refresh-recipe-formula-usage.ts
 */
import { refreshAllFormulaIsUsedCache } from '../src/lib/cosmocoat/recipe-usage'

async function main() {
  await refreshAllFormulaIsUsedCache()
  console.log('formula_is_used cache refreshed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
