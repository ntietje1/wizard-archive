import type { ResourceId } from '../../resources/domain-id'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { ResourceContentSource, ResourceContentState } from '../resource-content-source'
import { ResourceContentSourceProvider, useResourceContentState } from '../resource-content-context'

describe('ResourceContentSourceProvider', () => {
  it('ensures and reads content state from available sources', async () => {
    const itemId = sidebarItemId('note-provider')
    const contentState: ResourceContentState = {
      status: 'loading',
      label: 'Loaded through source',
      item: undefined,
      folderChildren: [],
      isLoading: true,
      error: null,
    }
    const source: ResourceContentSource = {
      status: 'available',
      ensureContentState: vi.fn(),
      getContentState: vi.fn(() => contentState),
      resolveItem: vi.fn(() => null),
    }

    render(
      <ResourceContentSourceProvider source={source}>
        <ContentStateProbe itemId={itemId} fallbackLabel="Fallback page" />
      </ResourceContentSourceProvider>,
    )

    expect(screen.getByTestId('content-state')).toHaveTextContent('loading:Loaded through source')
    expect(source.getContentState).toHaveBeenCalledWith(itemId, 'Fallback page')
    await waitFor(() => expect(source.ensureContentState).toHaveBeenCalledExactlyOnceWith(itemId))
  })

  it('returns a stable unsupported state without a provider', () => {
    const states: Array<ResourceContentState> = []

    const { rerender } = render(
      <ContentStateProbe
        itemId={sidebarItemId('missing-item')}
        fallbackLabel="Missing fallback"
        onState={(state) => states.push(state)}
      />,
    )

    rerender(
      <ContentStateProbe
        itemId={sidebarItemId('missing-item')}
        fallbackLabel="Missing fallback"
        onState={(state) => states.push(state)}
      />,
    )

    expect(screen.getByTestId('content-state')).toHaveTextContent('unsupported:Missing fallback')
    expect(states).toHaveLength(2)
    expect(states[1]).toBe(states[0])
  })
})

function ContentStateProbe({
  fallbackLabel,
  itemId,
  onState,
}: {
  fallbackLabel: string
  itemId: ResourceId
  onState?: (state: ResourceContentState) => void
}) {
  const state = useResourceContentState(itemId, fallbackLabel)
  onState?.(state)
  return <div data-testid="content-state">{`${state.status}:${state.label}`}</div>
}

function sidebarItemId(value: string) {
  return value as ResourceId
}
