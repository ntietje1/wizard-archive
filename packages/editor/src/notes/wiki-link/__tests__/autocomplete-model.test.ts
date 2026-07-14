import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import {
  buildContinuedFolderPathText,
  buildContinuedFileLinkText,
  buildInsertedFileLinkText,
  buildInsertedHeadingLinkText,
  buildWikiLinkAutocompleteModelFromSource,
  getWikiLinkAutocompleteContextFromSource,
} from '../autocomplete-model'
import type {
  FileAutocompleteContext,
  FileSuggestion,
  WikiLinkAutocompleteItemSource,
} from '../autocomplete-model'
import type { Heading } from '../../document/model'
import { canonicalizeResourceItemTitle } from '../../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { testCampaignMemberId } from '../../../../../../shared/test/campaign-member-id'
import { testCampaignId } from '../../../../../../shared/test/campaign-id'
import { createResourceCatalogModel } from '../../../filesystem/catalog'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { testNoteBlockId } from '../../../test/blocknote-id'
function modelFor(
  query: string,
  sidebarItems: Array<AnyItem>,
  headings: Array<Heading> = [],
  sourceNoteId?: ResourceId,
) {
  const itemSource = createTestAutocompleteItemSource(sidebarItems)
  const context = getWikiLinkAutocompleteContextFromSource(query, itemSource, sourceNoteId)
  const model = buildWikiLinkAutocompleteModelFromSource({
    context,
    itemSource,
    headings,
  })

  return { context, model }
}

let testIdCounter = 0

function createSidebarItemId(label: string): ResourceId {
  testIdCounter += 1
  return `${label}-${testIdCounter}` as ResourceId
}

function createCampaignId() {
  return testCampaignId('campaign-1')
}

function createBaseItem({
  name,
  parentId = null,
  type,
}: {
  name: string
  parentId?: ResourceId | null
  type: AnyItem['type']
}): AnyItem {
  const id = createSidebarItemId(name.toLowerCase().replace(/\W+/g, '-'))
  return {
    id: id,
    createdAt: 0,
    allPermissionLevel: null,
    campaignId: createCampaignId(),
    color: null,
    createdBy: testCampaignMemberId('user-1'),
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.VIEW,
    name: canonicalizeResourceItemTitle(name),
    parentId,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    status: RESOURCE_STATUS.active,
    type,
    updatedBy: null,
    updatedTime: null,
  } as AnyItem
}

function createNote({ name, parentId }: { name: string; parentId?: ResourceId | null }) {
  return createBaseItem({ name, parentId, type: RESOURCE_TYPES.notes })
}

function createFolder({ name, parentId }: { name: string; parentId?: ResourceId | null }) {
  return {
    ...createBaseItem({ name, parentId, type: RESOURCE_TYPES.folders }),
    inheritShares: false,
  } as AnyItem
}

function createTestAutocompleteItemSource(
  sidebarItems: Array<AnyItem>,
): WikiLinkAutocompleteItemSource {
  const { catalog, paths } = createResourceCatalogModel({
    activeItems: sidebarItems,
    trashItems: [],
  })
  return {
    getItemBreadcrumbs: () => '',
    getItemLinkPath: paths.getVisibleItemLinkPath,
    queryItems: (input) => [...catalog.queryVisibleItems(input)],
    resolveFolderPath: paths.resolveVisibleFolderPath,
    resolveItemPath: paths.resolveVisibleItemPath,
    resolveNotePath: paths.resolveVisibleNotePath,
  }
}

function heading(text: string, level: Heading['level']): Heading {
  return {
    noteBlockId: testNoteBlockId(text),
    text,
    level,
    normalizedText: text.toLowerCase(),
  }
}

describe('wiki link autocomplete model', () => {
  it('builds suggestions only from the sidebar items passed to it', () => {
    const visibleNote = createNote({ name: 'Visible Note' })

    const { model } = modelFor('', [visibleNote])

    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Visible Note'])
  })

  it('limits folder-path suggestions to the resolved folder children', () => {
    const folder = createFolder({ name: 'Encounters' })
    const childNote = createNote({ name: 'Bridge Ambush', parentId: folder.id })
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
    const note = createNote({ name: 'Clock Tower', parentId: folder.id })

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

  it('continues global file suggestions with their full nested path', () => {
    const suggestion = {
      kind: 'file',
      key: 'clock-tower' as ResourceId,
      title: 'Clock Tower',
      subtext: 'Places',
      badge: 'Note',
      item: createNote({ name: 'Clock Tower' }),
      linkPath: ['Places', 'Clock Tower'],
    } satisfies FileSuggestion
    const context = {
      mode: 'file',
      pathKind: 'global',
      fileQuery: 'Cl',
      completedFolderPath: [],
      resolvedParentId: null,
    } satisfies FileAutocompleteContext

    expect(buildContinuedFileLinkText(suggestion, context)).toBe('Places/Clock Tower')
  })

  it('resolves ./ file suggestions from the source parent folder', () => {
    const folder = createFolder({ name: 'Current Folder' })
    const localNote = createNote({ name: 'Local Note', parentId: folder.id })
    const sourceNote = createNote({ name: 'Current Note', parentId: folder.id })
    const rootNote = createNote({ name: 'Local Root' })

    const { context, model } = modelFor(
      './Local',
      [folder, localNote, sourceNote, rootNote],
      [],
      sourceNote.id,
    )

    expect(context).toMatchObject({
      mode: 'file',
      pathKind: 'relative',
      completedFolderPath: ['.'],
      resolvedParentId: folder.id,
    })
    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Local Note'])
  })

  it('resolves ../ folder paths from the source parent folder', () => {
    const parentFolder = createFolder({ name: 'Parent Folder' })
    const sourceFolder = createFolder({ name: 'Source Folder', parentId: parentFolder.id })
    const siblingFolder = createFolder({ name: 'Archive', parentId: parentFolder.id })
    const archivedNote = createNote({ name: 'Old Tower', parentId: siblingFolder.id })
    const sourceNote = createNote({ name: 'Old Source', parentId: sourceFolder.id })

    const { context, model } = modelFor(
      '../Archive/Old',
      [parentFolder, sourceFolder, siblingFolder, archivedNote, sourceNote],
      [],
      sourceNote.id,
    )

    expect(context).toMatchObject({
      mode: 'file',
      pathKind: 'relative',
      completedFolderPath: ['..', 'Archive'],
      resolvedParentId: siblingFolder.id,
    })
    expect(model.suggestions.map((suggestion) => suggestion.title)).toEqual(['Old Tower'])
  })

  it('rejects non-note ids from value autocomplete sources', () => {
    const file = createBaseItem({ name: 'Handout', type: RESOURCE_TYPES.files })
    const source = createTestAutocompleteItemSource([file])
    const context = getWikiLinkAutocompleteContextFromSource('Handout.secret', {
      ...source,
      resolveNotePath: () => file as never,
    })

    expect(context.mode).toBe('file')
  })
})
