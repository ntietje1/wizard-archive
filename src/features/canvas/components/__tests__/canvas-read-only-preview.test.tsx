import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasReadOnlyPreview } from '../canvas-read-only-preview'
import type { CanvasDocumentNode } from '../../types/canvas-domain-types'
import { testId } from '~/test/helpers/test-id'

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: () => ({
    data: {
      _id: 'note-1',
      content: [],
      name: 'Note',
      type: 'notes',
    },
    error: null,
    isLoading: false,
  }),
}))

vi.mock('~/features/previews/components/sidebar-item-preview-content', () => ({
  SidebarItemPreviewContent: () => <div data-testid="sidebar-item-preview-content" />,
}))

describe('CanvasReadOnlyPreview', () => {
  it('applies embed text color to read-only preview nodes', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 240,
            height: 180,
            data: {
              sidebarItemId: testId<'sidebarItems'>('note-1'),
              textColor: 'var(--t-purple)',
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
      />,
    )

    const previewEl = await screen.findByTestId('sidebar-item-preview-content')

    await waitFor(() => {
      expect(previewEl.parentElement).toHaveStyle({
        color: 'var(--t-purple)',
      })
    })
  })
})
