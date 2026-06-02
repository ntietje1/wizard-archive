import { analyzeImportBoundaries, collectImportBoundarySources } from './import-boundaries.mjs'

const violations = analyzeImportBoundaries(collectImportBoundarySources(process.cwd()))

if (violations.length > 0) {
  console.error('Import boundary violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}
