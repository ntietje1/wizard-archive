import { createElement, StrictMode } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import {
  createSampleLocalWorkspaceFixture,
  SAMPLE_LOCAL_RESOURCE_IDS,
} from '../sample-local-workspace'
import { useLocalWorkspaceRuntime } from '../use-local-workspace-runtime'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'

describe('useLocalWorkspaceRuntime', () => {
  it('retains fixture content through the development lifecycle check', () => {
    const { result } = renderHook(() => useLocalWorkspaceRuntime({}), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    })

    expect(
      requireRuntime(result.current).content.notes.get(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    ).toMatchObject({
      status: 'ready',
    })
  })

  it('loads the canonical fixture without a local filesystem projection', async () => {
    const { result } = renderHook(() => useLocalWorkspaceRuntime({}))

    await act(() =>
      requireRuntime(result.current).resources.loader.ensureCollection({
        parentId: null,
        lifecycle: 'active',
      }),
    )

    expect(
      requireRuntime(result.current)
        .resources.index.getSnapshot()
        .lookup(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    ).toMatchObject({ state: 'known', value: { title: 'The Lantern Market' } })
    expect(
      requireRuntime(result.current).content.notes.get(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    ).toMatchObject({
      status: 'ready',
    })
  })

  it('uses the fixture projection as an explicit write boundary', () => {
    const workspace = createSampleLocalWorkspaceFixture({ projection: 'player' })
    const { result } = renderHook(() => useLocalWorkspaceRuntime({ initialWorkspace: workspace }))

    expect(requireRuntime(result.current).resources.structure).toEqual({
      status: 'unavailable',
      reason: 'unauthorized',
    })
  })

  it('owns local navigation by canonical target', () => {
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({ initialResourceId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap }),
    )

    const runtime = requireRuntime(result.current)
    expect(runtime.navigation.current()).toEqual({
      kind: 'resource',
      resourceId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
    })
    const target = {
      kind: 'resource' as const,
      resourceId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
    }
    act(() => runtime.navigation.open(target))
    expect(runtime.navigation.current()).toBe(target)
  })
})

function requireRuntime(runtime: EditorRuntime | null): EditorRuntime {
  if (!runtime) throw new TypeError('Expected committed runtime')
  return runtime
}
