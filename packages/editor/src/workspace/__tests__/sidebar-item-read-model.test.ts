import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../items-persistence-contract'
import { createWorkspaceResourceReadModel } from '../items'
import { createFolder, createNote } from '../../test/sidebar-item-factory'

describe('sidebar item read model', () => {
  it('indexes items by id and slug', () => {
    const note = createNote({ id: 'note-1' as ResourceId, name: 'Note' })
    const model = createWorkspaceResourceReadModel([note])

    expect(model.getItem(note.id)).toBe(note)
    expect(model.getItemBySlug(note.slug)).toBe(note)
  })

  it('throws when duplicate ids are supplied', () => {
    const first = createNote({ id: 'note-1' as ResourceId, name: 'First' })
    const second = createNote({ id: 'note-1' as ResourceId, name: 'Second' })

    expect(() => createWorkspaceResourceReadModel([first, second])).toThrow(/Duplicate resource id/)
  })

  it('throws when duplicate slugs are supplied', () => {
    const first = createNote({
      id: 'note-1' as ResourceId,
      name: 'First',
      slug: 'same',
    })
    const second = createNote({
      id: 'note-2' as ResourceId,
      name: 'Second',
      slug: 'same',
    })

    expect(() => createWorkspaceResourceReadModel([first, second])).toThrow(
      /Duplicate resource slug/,
    )
  })

  it('rejects invalid persisted slugs before indexing', () => {
    const note = {
      ...createNote({
        id: 'note-1' as ResourceId,
        name: 'Note',
      }),
      slug: 'bad slug',
    }

    expect(() => createWorkspaceResourceReadModel([note])).toThrow('Slug cannot contain spaces')
  })

  it('indexes active children only', () => {
    const folder = createFolder({ id: 'folder-1' as ResourceId, name: 'Folder' })
    const activeChild = createNote({
      id: 'note-1' as ResourceId,
      name: 'Active',
      parentId: folder.id,
    })
    const trashedChild = createNote({
      id: 'note-2' as ResourceId,
      name: 'Trashed',
      parentId: folder.id,
      status: RESOURCE_STATUS.trashed,
    })
    const model = createWorkspaceResourceReadModel([folder, activeChild, trashedChild])

    expect(model.getActiveChildren(folder.id)).toEqual([activeChild])
  })

  it('walks active ancestors through the loaded tree', () => {
    const grandparent = createFolder({
      id: 'folder-grandparent' as ResourceId,
      name: 'Grandparent',
    })
    const parent = createFolder({
      id: 'folder-parent' as ResourceId,
      name: 'Parent',
      parentId: grandparent.id,
    })
    const note = createNote({
      id: 'note-child' as ResourceId,
      name: 'Child',
      parentId: parent.id,
    })
    const model = createWorkspaceResourceReadModel([grandparent, parent, note])

    expect(model.getActiveAncestors(note.id)).toEqual([parent, grandparent])
  })

  it('returns loaded items and throws for missing required items', () => {
    const first = createNote({ id: 'note-1' as ResourceId, name: 'First' })
    const second = createNote({ id: 'note-2' as ResourceId, name: 'Second' })
    const missingId = 'missing' as ResourceId
    const model = createWorkspaceResourceReadModel([first, second])

    expect(model.getItems([first.id, missingId, second.id])).toEqual([first, second])
    expect(() => model.requireItems([first.id, missingId])).toThrow(/missing resources/)
  })

  it('exposes immutable collections and keeps query methods isolated', () => {
    const folder = createFolder({ id: 'folder-1' as ResourceId, name: 'Folder' })
    const note = createNote({
      id: 'note-1' as ResourceId,
      name: 'Note',
      parentId: folder.id,
    })
    const injected = createNote({
      id: 'note-injected' as ResourceId,
      name: 'Injected',
      parentId: folder.id,
    })
    const model = createWorkspaceResourceReadModel([folder, note])

    expect(() => (model.items as Array<typeof injected>).push(injected)).toThrow(TypeError)
    expect(() =>
      (model.itemsById as Map<ResourceId, typeof injected>).set(injected.id, injected),
    ).toThrow(TypeError)
    expect(() =>
      (model.itemsBySlug as Map<typeof injected.slug, typeof injected>).set(
        injected.slug,
        injected,
      ),
    ).toThrow(TypeError)
    expect(() =>
      (model.activeChildrenByParent.get(folder.id) as Array<typeof injected>).push(injected),
    ).toThrow(TypeError)

    expect(model.getItem(injected.id)).toBeUndefined()
    expect(model.getItemBySlug(injected.slug)).toBeUndefined()
    expect(model.getItems([injected.id])).toEqual([])
    expect(model.getActiveChildren(folder.id)).toEqual([note])
  })
})
