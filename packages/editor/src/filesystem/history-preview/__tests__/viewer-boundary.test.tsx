import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { HistoryPreviewViewer } from '../viewer'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

const { historyDocumentPreviewMock } = vi.hoisted(() => ({
  historyDocumentPreviewMock: vi.fn(),
}))

vi.mock('../document-preview', () => ({
  HistoryDocumentPreview: (props: unknown) => {
    historyDocumentPreviewMock(props)
    return <div data-testid="history-document-preview" />
  },
}))

describe('HistoryPreviewViewer document boundary', () => {
  it('delegates ready snapshot rendering to the historical document preview surface', () => {
    const snapshot = {
      kind: 'note-yjs' as const,
      noteId: 'note-1' as SidebarItemId,
      data: new ArrayBuffer(0),
    }

    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot,
        }}
      />,
    )

    expect(screen.getByTestId('history-document-preview')).toBeInTheDocument()
    expect(historyDocumentPreviewMock).toHaveBeenCalledWith({ snapshot })
  })
})
