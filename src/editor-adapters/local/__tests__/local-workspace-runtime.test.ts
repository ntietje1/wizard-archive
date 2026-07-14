import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import {
  createSampleLocalWorkspaceFixture,
  SAMPLE_LOCAL_RESOURCE_IDS,
} from '../sample-local-workspace'
import { useLocalWorkspaceRuntime } from '../use-local-workspace-runtime'

describe('useLocalWorkspaceRuntime', () => {
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

  it('uses the fixture projection as a hard write boundary', async () => {
    const workspace = createSampleLocalWorkspaceFixture({ projection: 'player' })
    const { result } = renderHook(() => useLocalWorkspaceRuntime({ initialWorkspace: workspace }))

    const delivery = await act(() =>
      result.current.resources.structure.execute({
        campaignId: workspace.scope.campaignId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
          kind: 'folder',
          parentId: null,
          title: canonicalizeResourceTitle('Player folder'),
          icon: null,
          color: null,
        },
      }),
    )

    expect(delivery).toMatchObject({
      status: 'received',
      result: { status: 'rejected', reason: 'unauthorized' },
    })
  })

  it('owns local navigation by canonical resource ID', () => {
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({ initialItemId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap }),
    )

    expect(result.current.navigation.current()).toBe(SAMPLE_LOCAL_RESOURCE_IDS.docksMap)
    act(() => result.current.navigation.open(SAMPLE_LOCAL_RESOURCE_IDS.marketNote))
    expect(result.current.navigation.current()).toBe(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)
  })
})
