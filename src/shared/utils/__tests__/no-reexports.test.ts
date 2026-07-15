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

  it('blocks exported value aliases of imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: ["import { Upstream } from './upstream'", 'export const Public = Upstream'].join(
            '\n',
          ),
        },
      ]),
    ).toEqual(['src/example.ts:2 exported imported alias: Public = Upstream'])
  })

  it('blocks exported type aliases of imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { UpstreamType } from './upstream'",
            'export type PublicType = UpstreamType',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:2 exported imported alias: PublicType = UpstreamType'])
  })

  it('blocks empty exported interfaces that project imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { UpstreamType } from './upstream'",
            'export interface PublicType extends UpstreamType {}',
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:2 exported imported interface projection: PublicType = UpstreamType',
    ])
  })

  it('blocks exported value aliases of imported namespace members', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import * as Upstream from './upstream'",
            'export const Public = Upstream.Member',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:2 exported imported alias: Public = Upstream.Member'])
  })

  it('blocks export clauses for local value aliases of imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import { Upstream } from './upstream'",
            'const Public = Upstream',
            'export { Public }',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:3 exported imported alias: Public = Upstream'])
  })

  it('blocks export clauses for local type aliases of imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { UpstreamType } from './upstream'",
            'type PublicType = UpstreamType',
            'export type { PublicType }',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:3 exported imported alias: PublicType = UpstreamType'])
  })

  it('blocks export clauses for local aliases of imported namespace members', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import * as Upstream from './upstream'",
            'const Public = Upstream.Member',
            'export { Public }',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:3 exported imported alias: Public = Upstream.Member'])
  })

  it('blocks default exports of local aliases of imported bindings', () => {
    expect(
      analyzeNoReexports([
        {
          filePath: 'src/example.ts',
          source: [
            "import { Upstream } from './upstream'",
            'const Public = Upstream',
            'export default Public',
          ].join('\n'),
        },
      ]),
    ).toEqual(['src/example.ts:3 default-exported imported alias: Public = Upstream'])
  })
})
