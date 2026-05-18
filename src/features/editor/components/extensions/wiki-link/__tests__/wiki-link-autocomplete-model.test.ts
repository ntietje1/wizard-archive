import { describe, expect, it } from 'vitest'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import {
  buildContinuedFolderPathText,
  buildContinuedFileLinkText,
  buildInsertedFileLinkText,
  buildInsertedHeadingLinkText,
  buildWikiLinkAutocompleteModel,
  getWikiLinkAutocompleteContext,
} from '../wiki-link-autocomplete-model'
import type { Heading } from 'convex/blocks/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

function modelFor(
  query: string,
  sidebarItems: Array<AnySidebarItem>,
  headings: Array<Heading> = [],
  sourceParentId?: Id<'sidebarItems'> | null,
) {
  const { itemsMap } = buildSidebarItemMaps(sidebarItems)
  const context = getWikiLinkAutocompleteContext(query, sidebarItems, itemsMap, sourceParentId)
  const model = buildWikiLinkAutocompleteModel({
    context,
    sidebarItems,
    itemsMap,
    headings,
  })

  return { context, model }
}

function heading(text: string, level: Heading['level']): Heading {
  return {
    blockNoteId: `00000000-0000-4000-8000-${text.toLowerCase().replace(/\W/g, '').padEnd(12, '0').slice(0, 12)}`,
    text,
    level,
    normalizedText: text.toLowerCase(),
  }
}

describe('wiki link autocomplete model', () => {
  it('builds suggestions only from the sidebar items passed to it', () => {
    const visibleNote = createNote({ name: 'Visible Note' })
    const hiddenNote = createNote({ name: 'Hidden Note' })

    const { model } = modelFor('', [visibleNote])

    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Visible Note'])
    expect(model.suggestions).not.toContainEqual(
      expect.objectContaining({ title: hiddenNote.name }),
    )
  })

  it('limits folder-path suggestions to the resolved folder children', () => {
    const folder = createFolder({ name: 'Encounters' })
    const childNote = createNote({ name: 'Bridge Ambush', parentId: folder._id })
    const rootNote = createNote({ name: 'Campaign Overview' })

    const { model } = modelFor('Encounters/', [folder, childNote, rootNote])

    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Bridge Ambush'])
  })

  it('builds nested heading suggestions from a resolved note', () => {
    const note = createNote({ name: 'Session Notes' })
    const headings = [heading('Arrival', 1), heading('Hidden Door', 2), heading('Treasure', 1)]

    const { model } = modelFor('Session Notes#Arrival#Hi', [note], headings)
    if (model.mode !== 'heading') throw new Error('expected heading model')
    const suggestion = model.suggestions[0]

    expect(suggestion).toMatchObject({
      kind: 'heading',
      title: 'Hidden Door',
      fullPath: ['Hidden Door'],
    })
    expect(buildInsertedHeadingLinkText(suggestion, model.context, null)).toBe(
      'Session Notes#Arrival#Hidden Door',
    )
  })

  it('keeps file insertion and continuation text in the model', () => {
    const folder = createFolder({ name: 'Places' })
    const note = createNote({ name: 'Clock Tower', parentId: folder._id })

    const { model } = modelFor('Places/Cl', [folder, note])
    if (model.mode !== 'file') throw new Error('expected file model')
    const suggestion = model.suggestions[0]

    expect(suggestion).toMatchObject({ kind: 'file', title: 'Clock Tower' })
    expect(buildInsertedFileLinkText(suggestion, model.context, null)).toBe(
      'Places/Clock Tower|Clock Tower',
    )
    expect(buildContinuedFileLinkText(suggestion, model.context)).toBe('Places/Clock Tower')
    expect(buildContinuedFolderPathText(suggestion, model.context)).toBe('Places/Clock Tower/')
  })

  it('resolves ./ file suggestions from the source parent folder', () => {
    const folder = createFolder({ name: 'Current Folder' })
    const localNote = createNote({ name: 'Local Note', parentId: folder._id })
    const rootNote = createNote({ name: 'Local Root' })

    const { context, model } = modelFor('./Local', [folder, localNote, rootNote], [], folder._id)

    expect(context).toMatchObject({
      mode: 'file',
      pathKind: 'relative',
      completedFolderPath: ['.'],
      resolvedParentId: folder._id,
    })
    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Local Note'])
  })

  it('resolves ../ folder paths from the source parent folder', () => {
    const parentFolder = createFolder({ name: 'Parent Folder' })
    const sourceFolder = createFolder({ name: 'Source Folder', parentId: parentFolder._id })
    const siblingFolder = createFolder({ name: 'Archive', parentId: parentFolder._id })
    const archivedNote = createNote({ name: 'Old Tower', parentId: siblingFolder._id })
    const sourceNote = createNote({ name: 'Old Source', parentId: sourceFolder._id })

    const { context, model } = modelFor(
      '../Archive/Old',
      [parentFolder, sourceFolder, siblingFolder, archivedNote, sourceNote],
      [],
      sourceFolder._id,
    )

    expect(context).toMatchObject({
      mode: 'file',
      pathKind: 'relative',
      completedFolderPath: ['..', 'Archive'],
      resolvedParentId: siblingFolder._id,
    })
    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Old Tower'])
  })
})
