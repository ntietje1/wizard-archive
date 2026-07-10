import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { useDocumentDropUploadTarget } from '../use-document-drop-upload-target'

describe('useDocumentDropUploadTarget', () => {
  it('leaves file drops outside the target for other editor drop surfaces', () => {
    const onFileDrop = vi.fn()
    render(<DocumentDropTarget onFileDrop={onFileDrop} />)
    const file = new File(['portrait'], 'portrait.png', { type: 'image/png' })

    const dropEvent = createDropTargetEvent('drop', {
      files: [file],
      types: ['Files'],
    })
    screen.getByTestId('outside-target').dispatchEvent(dropEvent)

    expect(dropEvent.defaultPrevented).toBe(false)
    expect(onFileDrop).not.toHaveBeenCalled()
  })

  it('handles target drops that contain files', () => {
    const onFileDrop = vi.fn()
    const file = new File(['portrait'], 'portrait.png', { type: 'image/png' })
    render(<DocumentDropTarget onFileDrop={onFileDrop} />)

    const dragEvent = createDropTargetEvent('dragover', {
      files: [file],
      types: ['Files'],
    })
    const dropEvent = createDropTargetEvent('drop', {
      files: [file],
      types: ['Files'],
    })
    const target = screen.getByTestId('drop-target')

    target.dispatchEvent(dragEvent)
    target.dispatchEvent(dropEvent)

    expect(dragEvent.defaultPrevented).toBe(true)
    expect(dropEvent.defaultPrevented).toBe(true)
    expect(onFileDrop).toHaveBeenCalledExactlyOnceWith(file)
  })
})

function DocumentDropTarget({ onFileDrop }: { onFileDrop: (file: File) => void }) {
  const dropTargetProps = useDocumentDropUploadTarget(onFileDrop)
  return (
    <div>
      <div data-testid="outside-target" />
      <div data-testid="drop-target" {...dropTargetProps} />
    </div>
  )
}

function createDropTargetEvent(
  type: 'dragover' | 'drop',
  dataTransfer: { files?: Array<File>; types: Array<string> },
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: dataTransfer.files ?? [],
      types: dataTransfer.types,
    },
  })
  return event
}
