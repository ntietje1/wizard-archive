import { FileText, FolderOpen } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { buildSidebarTreeSurfaceItems } from '../sidebar-tree-projection'

describe('buildSidebarTreeSurfaceItems', () => {
  it('builds nested sidebar surface rows from source-owned row data', () => {
    const onFolderClick = vi.fn()
    const onNoteClick = vi.fn()

    const rows = buildSidebarTreeSurfaceItems([
      {
        id: 'folder-1',
        icon: FolderOpen,
        name: assertSidebarItemName('Folder'),
        parentId: null,
        visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
        expanded: true,
        showChevron: true,
        onClick: onFolderClick,
      },
      {
        id: 'note-1',
        icon: FileText,
        name: assertSidebarItemName('Note'),
        parentId: 'folder-1',
        visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
        onClick: onNoteClick,
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'folder-1',
      name: 'Folder',
      expanded: true,
      showChevron: true,
    })
    expect(rows[0]?.children).toHaveLength(1)
    expect(rows[0]?.children?.[0]).toMatchObject({
      id: 'note-1',
      name: 'Note',
      visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
    })
    expect(rows[0]?.onClick).toBe(onFolderClick)
    expect(rows[0]?.children?.[0]?.onClick).toBe(onNoteClick)
  })

  it('attaches children when the child row appears before the parent row', () => {
    const rows = buildSidebarTreeSurfaceItems([
      {
        id: 'note-1',
        icon: FileText,
        name: assertSidebarItemName('Note'),
        parentId: 'folder-1',
        visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
      },
      {
        id: 'folder-1',
        icon: FolderOpen,
        name: assertSidebarItemName('Folder'),
        parentId: null,
        visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
        expanded: true,
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('folder-1')
    expect(rows[0]?.children?.[0]?.id).toBe('note-1')
  })

  it('keeps rows with missing parents as roots', () => {
    const rows = buildSidebarTreeSurfaceItems([
      {
        id: 'note-1',
        icon: FileText,
        name: assertSidebarItemName('Note'),
        parentId: 'missing-folder',
        visualState: { isSelected: false, isViewing: false, isMultiSelected: false },
      },
      {
        id: 'folder-1',
        icon: FolderOpen,
        name: assertSidebarItemName('Folder'),
        parentId: null,
        visualState: { isSelected: true, isViewing: true, isMultiSelected: false },
      },
    ])

    expect(rows.map((row) => row.id)).toEqual(['note-1', 'folder-1'])
    expect(rows[0]?.children).toBeUndefined()
  })
})
