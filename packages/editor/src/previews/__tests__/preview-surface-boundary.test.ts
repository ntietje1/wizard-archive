import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vite-plus/test'

function importedModules(source: string) {
  const ast = ts.createSourceFile(
    'canvas-resource-embed-surface.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  return ast.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((specifier) => specifier.text)
}

describe('preview surface ownership', () => {
  it('keeps canvas resource embeds on the shared preview surface instead of the workspace sidebar delegate', () => {
    const source = readFileSync(
      'packages/editor/src/embeds/components/canvas-resource-embed-surface.tsx',
      'utf8',
    )

    const imports = importedModules(source)
    expect(imports).toContain('../../previews/resource-preview-surface')
    expect(imports).not.toContain('../../workspace/sidebar/preview-content')
  })
})
