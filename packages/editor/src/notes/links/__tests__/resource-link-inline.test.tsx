import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '../../../resources/component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import type { ResourceNavigation } from '../../../resources/editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../../../resources/in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../../../resources/resource-index-contract'
import { canonicalizeResourceTitle } from '../../../resources/resource-record'
import type { ResourceRecord } from '../../../resources/resource-record'
import { serializeAuthoredDestination } from '../../../resources/authored-destination'
import { NoteResourceRuntimeProvider } from '../../note-resource-runtime'
import { NoteResourceLinkInline } from '../resource-link-inline'

describe('NoteResourceLinkInline', () => {
  it('opens the exact canonical target through the native editable and viewer interactions', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const target = {
      kind: 'noteBlock' as const,
      resourceId: targetResourceId,
      blockId,
      presentation: 'heading' as const,
    }
    const open = vi.fn<ResourceNavigation['open']>()
    const core = createInMemoryEditorRuntime({
      scope: {
        campaignId,
        actorId,
        projection: 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot: {
        campaignId,
        resources: [
          await resource(sourceResourceId, campaignId, actorId, 'Source note'),
          await resource(targetResourceId, campaignId, actorId, 'Rules reference'),
        ],
        tombstones: [],
        aliases: [],
        assetsFolderId: null,
      },
      navigation: navigation(open),
    })
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    const binding = {
      renderNote: () => null,
      runtime: core.runtime,
      sourceResourceId,
    }
    const props = {
      destination: serializeAuthoredDestination({ kind: 'internal', target }),
      label: 'Character creation',
    }
    const view = render(
      <NoteResourceRuntimeProvider binding={binding} editable>
        <NoteResourceLinkInline props={props} />
      </NoteResourceRuntimeProvider>,
    )
    const link = screen.getByRole('button', { name: 'Open Character creation' })

    fireEvent.click(link)
    expect(open).not.toHaveBeenCalled()

    fireEvent.click(link, { ctrlKey: true })
    expect(open).toHaveBeenCalledWith(target)

    open.mockClear()
    view.rerender(
      <NoteResourceRuntimeProvider binding={binding} editable={false}>
        <NoteResourceLinkInline props={props} />
      </NoteResourceRuntimeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open Character creation' }))
    expect(open).toHaveBeenCalledWith(target)

    view.unmount()
    core.dispose()
  })

  it('keeps unresolved links inert when no resource capability is present', () => {
    const destination = serializeAuthoredDestination({
      kind: 'unresolved',
      rawTarget: 'Private notes',
    })
    render(
      <NoteResourceRuntimeProvider editable={false}>
        <NoteResourceLinkInline props={{ destination, label: 'Private notes' }} />
      </NoteResourceRuntimeProvider>,
    )

    expect(screen.getByRole('button', { name: 'Private notes' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

async function resource(
  id: ResourceRecord['id'],
  campaignId: ResourceRecord['campaignId'],
  actorId: ResourceRecord['created']['by'],
  title: string,
): Promise<ResourceRecord> {
  const metadataVersion = initialVersion(await sha256Digest(new TextEncoder().encode(title)))
  return {
    id,
    campaignId,
    parentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle: { state: 'active' },
    metadataVersion,
    created: { at: 1, by: actorId },
    updated: { at: 1, by: actorId },
  }
}

function navigation(open: ResourceNavigation['open']): ResourceNavigation {
  return {
    current: () => null,
    open,
    subscribe: () => () => undefined,
  }
}
