import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import {
  EMPTY_WORKSPACE_SELECTION,
  updateWorkspaceSelection,
  workspaceSelectionIntent,
} from '../workspace-selection'

const resourceIds = ['01', '02', '03', '04'].map((suffix) =>
  assertDomainId(DOMAIN_ID_KIND.resource, `01980c1a-5e70-7000-8000-0000000004${suffix}`),
)

describe('workspace selection', () => {
  it('distinguishes platform toggle and range gestures', () => {
    expect(
      workspaceSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: true }, 'other'),
    ).toBe('toggle')
    expect(
      workspaceSelectionIntent({ shiftKey: false, metaKey: false, ctrlKey: true }, 'mac'),
    ).toBe('single')
    expect(workspaceSelectionIntent({ shiftKey: true, metaKey: true, ctrlKey: true }, 'mac')).toBe(
      'range',
    )
  })

  it('selects a visible range from a stable anchor', () => {
    const single = updateWorkspaceSelection(EMPTY_WORKSPACE_SELECTION, {
      type: 'select',
      resourceId: resourceIds[1],
      visibleIds: resourceIds,
      intent: 'single',
    })
    const range = updateWorkspaceSelection(single, {
      type: 'select',
      resourceId: resourceIds[3],
      visibleIds: resourceIds,
      intent: 'range',
    })

    expect(range).toEqual({
      selectedIds: resourceIds.slice(1),
      anchorId: resourceIds[1],
      focusedId: resourceIds[3],
    })
  })

  it('moves focus and extends selection without wrapping', () => {
    const start = updateWorkspaceSelection(EMPTY_WORKSPACE_SELECTION, {
      type: 'select',
      resourceId: resourceIds[1],
      visibleIds: resourceIds,
      intent: 'single',
    })
    const extended = updateWorkspaceSelection(start, {
      type: 'moveFocus',
      direction: 'next',
      visibleIds: resourceIds,
      extend: true,
    })

    expect(extended.selectedIds).toEqual(resourceIds.slice(1, 3))
    expect(extended.anchorId).toBe(resourceIds[1])
    expect(extended.focusedId).toBe(resourceIds[2])
  })

  it('normalizes context selection only for an unselected resource', () => {
    const selected = {
      selectedIds: resourceIds.slice(0, 2),
      anchorId: resourceIds[0],
      focusedId: resourceIds[1],
    }

    expect(
      updateWorkspaceSelection(selected, {
        type: 'normalizeContext',
        resourceId: resourceIds[1],
      }),
    ).toBe(selected)
    expect(
      updateWorkspaceSelection(selected, {
        type: 'normalizeContext',
        resourceId: resourceIds[3],
      }).selectedIds,
    ).toEqual([resourceIds[3]])
  })
})
