import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { assertSha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { ResourceCard } from '../workspace/resource-card'
import type { WorkspaceActions } from '../workspace/resource-operations'
import { EMPTY_WORKSPACE_SELECTION } from '../workspace-selection'

describe('ResourceCard', () => {
  it('opens its overflow menu without selecting or opening the resource', () => {
    const resource = noteResource()
    const open = vi.fn()
    const onOpenContextMenu = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <ResourceCard
        actions={{ open } as unknown as WorkspaceActions}
        ambiguous={false}
        canEdit
        resource={resource}
        runtime={
          {
            resources: {
              previews: { status: 'unavailable', reason: 'capability_not_supported' },
            },
          } as unknown as EditorRuntime
        }
        selected={false}
        selection={EMPTY_WORKSPACE_SELECTION}
        visibleIds={[resource.id]}
        onOpenContextMenu={onOpenContextMenu}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More options for Note' }), {
      clientX: 18,
      clientY: 24,
    })

    expect(onOpenContextMenu).toHaveBeenCalledWith({ resource, x: 18, y: 24 })
    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

function noteResource(): AuthorizedResourceSummary {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.resource),
    campaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
    displayParentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle('Note'),
    icon: null,
    color: null,
    lifecycle: 'active',
    permission: 'edit',
    metadataVersion: {
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest: assertSha256Digest('0'.repeat(64)),
    },
    createdAt: 1,
    updatedAt: 1,
  }
}
