import { describe, expect, it } from 'vite-plus/test'

const noReexportsModule = await import('../../../../scripts/check-no-reexports.mjs')

const {
  analyzeNoReexports,
}: {
  analyzeNoReexports: (files: Array<{ filePath: string; source: string }>) => Array<string>
} = noReexportsModule

describe('no re-export checks', () => {
  it('blocks imported default type bindings from being exported later', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: ["import type Foo from './foo'", 'export type { Foo }'].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:2 exported imported binding: Foo'])
  })

  it('blocks imported type namespace bindings from being exported later', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: ["import type * as Foo from './foo'", 'export type { Foo }'].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:2 exported imported binding: Foo'])
  })
})
