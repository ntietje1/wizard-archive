import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { FolderListContentSimple } from '../folder-list-content-simple'

describe('FolderListContentSimple', () => {
  it('renders the supplied folder children', () => {
    const visibleNote = createNoteItem('Visible Note')
    render(<FolderListContentSimple items={[visibleNote]} />)

    expect(screen.getByText('Visible Note')).toBeInTheDocument()
  })

  it('renders an empty-folder state when there are no children', () => {
    render(<FolderListContentSimple items={[]} />)

    expect(screen.getByText('Empty folder')).toBeInTheDocument()
  })
})

function createNoteItem(name: string): AnyItem {
  return {
    id: 'note-1',
    createdAt: 0,
    name,
    iconName: null,
    color: null,
    slug: 'visible-note',
    campaignId: 'campaign-1',
    parentId: 'folder-1',
    type: RESOURCE_TYPES.notes,
    allPermissionLevel: null,
    location: 'root',
    status: 'active',
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-1',
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.VIEW,
    previewUrl: null,
    isActive: false,
    isTrashed: false,
  } as unknown as AnyItem
}
