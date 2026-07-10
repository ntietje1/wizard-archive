import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import {
  ResourceContentSourceProvider,
  useResourceContentState,
} from '../../filesystem/resource-content-context'
import type { ResourceContentSource } from '../../filesystem/resource-content-source'
import { createNote } from '../../test/sidebar-item-factory'
import type { AnyItemWithContent } from '../../workspace/items'
import { ResourcePreviewSurface } from '../resource-preview-surface'

describe('resource content hover readiness', () => {
  it('lets resource surfaces ensure and render content without embed-specific state', async () => {
    const note = {
      ...createNote({ id: 'note-a' as SidebarItemId, name: 'Session Notes' }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [],
    } as AnyItemWithContent
    const ensureContentState = vi.fn()
    const source: ResourceContentSource = {
      status: 'available',
      ensureContentState,
      getContentState: () => ({
        status: 'ready',
        label: note.name,
        item: note,
        folderChildren: [],
        isLoading: false,
        error: null,
      }),
      resolveItem: () => note,
    }

    render(
      <ResourceContentSourceProvider source={source}>
        <HoverPreviewProbe itemId={note.id} />
      </ResourceContentSourceProvider>,
    )

    await waitFor(() => expect(ensureContentState).toHaveBeenCalledExactlyOnceWith(note.id))
    expect(screen.getByText('Note preview unavailable')).toBeInTheDocument()
  })
})

function HoverPreviewProbe({ itemId }: { itemId: SidebarItemId }) {
  const state = useResourceContentState(itemId, 'Item')
  if (state.status !== 'ready') return <div>{state.status}</div>
  return <ResourcePreviewSurface item={state.item} folderChildren={state.folderChildren} />
}
