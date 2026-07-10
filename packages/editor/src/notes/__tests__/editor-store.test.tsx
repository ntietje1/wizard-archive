import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { NoteEditorStoreProvider, useScopedNoteEditorStore } from '../editor-store'

describe('note editor store scope', () => {
  it('isolates active note editors between mounted runtime providers', () => {
    const firstEditor = { id: 'first-editor' } as unknown as CustomBlockNoteEditor
    const secondEditor = { id: 'second-editor' } as unknown as CustomBlockNoteEditor

    render(
      <>
        <NoteEditorStoreProvider>
          <ScopedEditorProbe editor={firstEditor} testId="first-editor-state" />
        </NoteEditorStoreProvider>
        <NoteEditorStoreProvider>
          <ScopedEditorProbe editor={secondEditor} testId="second-editor-state" />
        </NoteEditorStoreProvider>
      </>,
    )

    expect(screen.getByTestId('first-editor-state')).toHaveTextContent('own')
    expect(screen.getByTestId('second-editor-state')).toHaveTextContent('own')
  })
})

function ScopedEditorProbe({ editor, testId }: { editor: CustomBlockNoteEditor; testId: string }) {
  const currentEditor = useScopedNoteEditorStore((state) => state.editor)
  const claimEditor = useScopedNoteEditorStore((state) => state.claimEditor)

  useEffect(() => claimEditor(editor), [claimEditor, editor])

  return <output data-testid={testId}>{currentEditor === editor ? 'own' : 'other'}</output>
}
