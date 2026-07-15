import { createElement, StrictMode } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import {
  createSampleLocalWorkspaceFixture,
  SAMPLE_LOCAL_RESOURCE_IDS,
} from '../sample-local-workspace'
import { useLocalWorkspaceRuntime } from '../use-local-workspace-runtime'

describe('useLocalWorkspaceRuntime', () => {
  it('retains fixture content through the development lifecycle check', () => {
    const { result } = renderHook(() => useLocalWorkspaceRuntime({}), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    })

    expect(result.current.content.notes.get(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)).toMatchObject({
      status: 'ready',
    })
  })

  it('loads the canonical fixture without a local filesystem projection', async () => {
    const { result } = renderHook(() => useLocalWorkspaceRuntime({}))

    await act(() =>
      result.current.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' }),
    )

    expect(
      result.current.resources.index.getSnapshot().lookup(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    ).toMatchObject({ state: 'known', value: { title: 'The Lantern Market' } })
    expect(result.current.content.notes.get(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)).toMatchObject({
      status: 'ready',
    })
  })

  it('uses the fixture projection as an explicit write boundary', () => {
    const workspace = createSampleLocalWorkspaceFixture({ projection: 'player' })
    const { result } = renderHook(() => useLocalWorkspaceRuntime({ initialWorkspace: workspace }))

    expect(result.current.resources.structure).toEqual({
      status: 'unavailable',
      reason: 'unauthorized',
    })
  })

  it('owns local navigation by canonical resource ID', () => {
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({ initialResourceId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap }),
    )

    expect(result.current.navigation.current()).toBe(SAMPLE_LOCAL_RESOURCE_IDS.docksMap)
    act(() => result.current.navigation.open(SAMPLE_LOCAL_RESOURCE_IDS.marketNote))
    expect(result.current.navigation.current()).toBe(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)
  })
})
