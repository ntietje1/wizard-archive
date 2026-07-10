import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import { useLastWorkspaceItem } from '../use-last-workspace-item'

const workspaceState = vi.hoisted(() => ({
  workspaceRecordId: 'campaign_1' as string | undefined,
}))
const persistedState = vi.hoisted(() => ({
  key: null as string | null,
  value: null as string | null,
  setValue: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: workspaceState.workspaceRecordId }),
}))

vi.mock('@wizard-archive/ui/hooks/use-persisted-state', () => ({
  default: (key: string | null) => {
    persistedState.key = key
    return [persistedState.value, persistedState.setValue]
  },
}))

describe('useLastWorkspaceItem', () => {
  beforeEach(() => {
    workspaceState.workspaceRecordId = 'campaign_1'
    persistedState.key = null
    persistedState.value = null
    persistedState.setValue.mockClear()
    persistedState.setValue.mockImplementation((next: string | null) => {
      persistedState.value = next
    })
  })

  it('uses the current workspace scoped persistence key', () => {
    renderHook(() => useLastWorkspaceItem())

    expect(persistedState.key).toBe('last-editor-item-campaign_1')
  })

  it('projects the stored sidebar item slug into workspace search', () => {
    persistedState.value = 'last-note'

    const { result } = renderHook(() => useLastWorkspaceItem())

    expect(result.current.lastSelectedItem).toBe('last-note')
    expect(result.current.lastSelectedWorkspaceItemSearch).toEqual({ item: 'last-note' })
  })

  it('drops malformed stored slugs', () => {
    persistedState.value = '../private-note'

    const { result } = renderHook(() => useLastWorkspaceItem())

    expect(result.current.lastSelectedItem).toBeNull()
    expect(result.current.lastSelectedWorkspaceItemSearch).toBeUndefined()
  })

  it('does not read a workspace scoped key without a workspace context', () => {
    workspaceState.workspaceRecordId = undefined

    renderHook(() => useLastWorkspaceItem())

    expect(persistedState.key).toBeNull()
  })

  it('stores the selected sidebar item slug', () => {
    const { result } = renderHook(() => useLastWorkspaceItem())

    act(() => {
      result.current.setLastSelectedItem(testResourceSlug('next-note'))
    })

    expect(persistedState.setValue).toHaveBeenCalledExactlyOnceWith('next-note')
    expect(persistedState.value).toBe('next-note')
  })
})

function testResourceSlug(value: string): WizardEditorResourceSlug {
  const slug = parseWizardEditorResourceSlug(value)
  if (!slug) {
    throw new Error(`Invalid test resource slug: ${value}`)
  }
  return slug
}
