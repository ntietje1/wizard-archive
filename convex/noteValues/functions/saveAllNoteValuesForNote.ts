import { asyncMap } from 'convex-helpers'
import { parseWikiLinkText } from '../../links/linkParsers'
import { resolveParsedItemPath } from '../../links/linkResolution'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import {
  collectFormulaReferences,
  compileNoteValueDefinitions,
} from '../../../shared/note-values/formula'
import { extractNoteValueDefinitions } from './extractNoteValueDefinitions'
import { noteValueRowToDefinition } from './noteValueRows'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { AnySidebarItemRow } from '../../sidebarItems/types/types'
import type {
  FormulaReferenceToken,
  NoteValueAuthoringDefinition,
  NoteValueBinding,
  NoteValueCompiledFormula,
  NoteValueDefinition,
  NoteValueResolution,
} from '../../../shared/note-values/types'

type ExternalFormulaReferenceToken = Extract<FormulaReferenceToken, { kind: 'external' }>
type ParsedNotePath = ReturnType<typeof parseWikiLinkText>

function resolvePersistedValue<TNoteId>(
  matches: Array<string> | undefined,
  noteId: TNoteId,
  slug: string,
): NoteValueResolution<TNoteId> {
  if (!matches || matches.length === 0) {
    return {
      ok: false,
      errorCode: 'unknown_reference',
      errorMessage: `Unknown reference "[[${slug}]]"`,
    }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      errorCode: 'duplicate_slug',
      errorMessage: `Slug "${slug}" is duplicated in the target note`,
    }
  }
  return {
    ok: true,
    noteId,
    valueId: matches[0],
  }
}

function resolveExternalNoteId({
  notePathRaw,
  allItems,
  itemsMap,
  sourceParentId,
}: {
  notePathRaw: string
  allItems: Array<AnySidebarItemRow>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItemRow>
  sourceParentId: Id<'sidebarItems'> | null
}): Id<'sidebarItems'> | null {
  const parsed = parseWikiLinkText(notePathRaw)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }

  const resolvedItem = resolveParsedItemPath(
    parsed.pathKind,
    parsed.itemPath,
    allItems,
    itemsMap,
    sourceParentId,
  )
  if (!resolvedItem || resolvedItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    return null
  }

  return resolvedItem._id
}

function parseNotePath(notePathRaw: string): ParsedNotePath | null {
  const parsed = parseWikiLinkText(notePathRaw)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }
  return parsed
}

function resolveDurableExternalBinding(
  binding: NoteValueBinding<Id<'sidebarItems'>> | null,
): NoteValueResolution<Id<'sidebarItems'>> | null {
  return binding
    ? {
        ok: true,
        noteId: binding.targetNoteId,
        valueId: binding.targetValueId,
      }
    : null
}

function resolveLocalSlug({
  authoredDefinitions,
  noteId,
  slug,
}: {
  authoredDefinitions: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>>
  noteId: Id<'sidebarItems'>
  slug: string
}): NoteValueResolution<Id<'sidebarItems'>> {
  const localMatch = authoredDefinitions.filter((candidate) => candidate.slug === slug)
  if (localMatch.length === 0) {
    return {
      ok: false,
      errorCode: 'unknown_reference',
      errorMessage: `Unknown reference "[[${slug}]]"`,
    }
  }
  if (localMatch.length > 1) {
    return {
      ok: false,
      errorCode: 'duplicate_slug',
      errorMessage: `Slug "${slug}" is duplicated in this note`,
    }
  }
  return {
    ok: true,
    noteId,
    valueId: localMatch[0].valueId,
  }
}

function resolveParsedItem({
  parsed,
  sidebarItems,
  itemsMap,
  sourceParentId,
}: {
  parsed: ParsedNotePath
  sidebarItems: Array<AnySidebarItemRow>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItemRow>
  sourceParentId: Id<'sidebarItems'> | null
}): AnySidebarItemRow | null {
  const resolvedItem = resolveParsedItemPath(
    parsed.pathKind,
    parsed.itemPath,
    sidebarItems,
    itemsMap,
    sourceParentId,
  )
  return resolvedItem?.type === SIDEBAR_ITEM_TYPES.notes ? resolvedItem : null
}

function resolvePersistedForItem({
  persistedLookup,
  resolvedItem,
  slug,
  notePathRaw,
}: {
  persistedLookup: Map<Id<'sidebarItems'>, Map<string, Array<string>>>
  resolvedItem: AnySidebarItemRow
  slug: string
  notePathRaw: string
}): NoteValueResolution<Id<'sidebarItems'>> {
  const persistedMatch = resolvePersistedValue<Id<'sidebarItems'>>(
    persistedLookup.get(resolvedItem._id)?.get(slug),
    resolvedItem._id,
    slug,
  )
  if (!persistedMatch.ok && persistedMatch.errorCode === 'unknown_reference') {
    return {
      ...persistedMatch,
      errorMessage: `Unknown reference "[[${notePathRaw}.${slug}]]"`,
    }
  }
  return persistedMatch
}

function createDurableExternalBindingResolver<TNoteId>({
  currentNoteId,
  previousDefinitionsByValueId,
}: {
  currentNoteId: TNoteId
  previousDefinitionsByValueId: Map<string, NoteValueDefinition<TNoteId>>
}) {
  const externalBindingQueues = new Map<string, Array<NoteValueBinding<TNoteId> | null>>()

  const collectCompiledBindingKeys = (
    compiledFormula: NoteValueCompiledFormula,
    keys: Array<string>,
  ) => {
    switch (compiledFormula.kind) {
      case 'binding':
        keys.push(compiledFormula.key)
        return
      case 'unary':
        collectCompiledBindingKeys(compiledFormula.argument, keys)
        return
      case 'binary':
        collectCompiledBindingKeys(compiledFormula.left, keys)
        collectCompiledBindingKeys(compiledFormula.right, keys)
        return
      case 'call':
        for (const arg of compiledFormula.args) {
          collectCompiledBindingKeys(arg, keys)
        }
        return
      case 'number':
        return
    }
  }

  const buildExternalBindingQueue = (
    previousDefinition: NoteValueDefinition<TNoteId>,
  ): Array<NoteValueBinding<TNoteId> | null> => {
    if (!previousDefinition.compiledFormula) return []

    const references = collectFormulaReferences(previousDefinition.expressionSource)
    const bindingKeys: Array<string> = []
    collectCompiledBindingKeys(previousDefinition.compiledFormula, bindingKeys)
    const bindingsByKey = new Map(
      previousDefinition.bindings.map((binding) => [binding.key, binding]),
    )

    const queue: Array<NoteValueBinding<TNoteId> | null> = []
    references.forEach((reference, index) => {
      if (reference.kind !== 'external') return
      const binding = bindingsByKey.get(bindingKeys[index])
      if (binding && binding.targetNoteId !== currentNoteId) {
        queue.push(binding)
      } else {
        queue.push(null)
      }
    })
    return queue
  }

  return (definition: { valueId: string; expressionSource: string }) => {
    const previousDefinition = previousDefinitionsByValueId.get(definition.valueId)
    if (
      previousDefinition?.compileStatus !== 'ok' ||
      previousDefinition.compiledFormula === null ||
      previousDefinition.expressionSource !== definition.expressionSource
    ) {
      return null
    }

    let queue = externalBindingQueues.get(definition.valueId)
    if (!queue) {
      queue = buildExternalBindingQueue(previousDefinition)
      externalBindingQueues.set(definition.valueId, queue)
    }

    return queue.shift() ?? null
  }
}

async function buildReferencedExternalValueLookup({
  ctx,
  campaignId,
  currentNoteId,
  externalReferences,
  sidebarItems,
  itemsMap,
  sourceParentId,
}: {
  ctx: CampaignMutationCtx
  campaignId: Id<'campaigns'>
  currentNoteId: Id<'sidebarItems'>
  externalReferences: Array<ExternalFormulaReferenceToken>
  sidebarItems: Array<AnySidebarItemRow>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItemRow>
  sourceParentId: Id<'sidebarItems'> | null
}): Promise<Map<Id<'sidebarItems'>, Map<string, Array<string>>>> {
  const lookup = new Map<Id<'sidebarItems'>, Map<string, Array<string>>>()
  const queriedTargets = new Set<string>()

  for (const reference of externalReferences) {
    const targetNoteId = resolveExternalNoteId({
      notePathRaw: reference.notePathRaw,
      allItems: sidebarItems,
      itemsMap,
      sourceParentId,
    })
    if (!targetNoteId || targetNoteId === currentNoteId) {
      continue
    }

    const targetKey = `${targetNoteId}:${reference.slug}`
    if (queriedTargets.has(targetKey)) {
      continue
    }
    queriedTargets.add(targetKey)

    const rows = await ctx.db
      .query('noteValues')
      .withIndex('by_campaign_note_slug', (q) =>
        q.eq('campaignId', campaignId).eq('noteId', targetNoteId).eq('slug', reference.slug),
      )
      .collect()

    let valuesBySlug = lookup.get(targetNoteId)
    if (!valuesBySlug) {
      valuesBySlug = new Map()
      lookup.set(targetNoteId, valuesBySlug)
    }
    valuesBySlug.set(
      reference.slug,
      rows.map((row) => row.valueId),
    )
  }

  return lookup
}

export async function saveAllNoteValuesForNote(
  ctx: CampaignMutationCtx,
  {
    noteId,
    content,
  }: {
    noteId: Id<'sidebarItems'>
    content: Array<CustomBlock>
  },
): Promise<Array<NoteValueDefinition<Id<'sidebarItems'>>>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note || !isActiveSidebarItem(note)) {
    return []
  }

  const authoredDefinitions = extractNoteValueDefinitions(content, noteId)

  const existingRows = await ctx.db
    .query('noteValues')
    .withIndex('by_campaign_note', (q) => q.eq('campaignId', note.campaignId).eq('noteId', noteId))
    .collect()

  const externalReferences = authoredDefinitions
    .flatMap((definition) => collectFormulaReferences(definition.expressionSource))
    .filter(
      (reference): reference is ExternalFormulaReferenceToken => reference.kind === 'external',
    )

  let sidebarItems: Array<AnySidebarItemRow> = []
  let itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItemRow>()
  if (externalReferences.length > 0) {
    sidebarItems = await ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
        q.eq('campaignId', note.campaignId).eq('status', SIDEBAR_ITEM_STATUS.active),
      )
      .collect()
    itemsMap = new Map(sidebarItems.map((item) => [item._id, item]))
  }

  const persistedLookup =
    externalReferences.length > 0
      ? await buildReferencedExternalValueLookup({
          ctx,
          campaignId: note.campaignId,
          currentNoteId: noteId,
          externalReferences,
          sidebarItems,
          itemsMap,
          sourceParentId: note.parentId,
        })
      : new Map<Id<'sidebarItems'>, Map<string, Array<string>>>()
  const existingDefinitionsByValueId = new Map(
    existingRows.map((row) => [row.valueId, noteValueRowToDefinition(row)]),
  )
  const takeDurableExternalBinding = createDurableExternalBindingResolver({
    currentNoteId: noteId,
    previousDefinitionsByValueId: existingDefinitionsByValueId,
  })

  const compiledDefinitions: Array<NoteValueDefinition<Id<'sidebarItems'>>> =
    compileNoteValueDefinitions<Id<'sidebarItems'>>(authoredDefinitions, {
      currentNoteId: noteId,
      resolveExternal: (
        notePathRaw,
        slug,
        sourceDefinition,
      ): NoteValueResolution<Id<'sidebarItems'>> => {
        const parsed = parseNotePath(notePathRaw)
        if (!parsed) {
          return {
            ok: false,
            errorCode: 'parse_error',
            errorMessage: `Invalid note reference "[[${notePathRaw}]]"`,
          }
        }

        const durableResolution = resolveDurableExternalBinding(
          takeDurableExternalBinding(sourceDefinition),
        )
        if (durableResolution) {
          return durableResolution
        }

        const resolvedItem = resolveParsedItem({
          parsed,
          sidebarItems,
          itemsMap,
          sourceParentId: note.parentId,
        })
        if (!resolvedItem) {
          return {
            ok: false,
            errorCode: 'unknown_reference',
            errorMessage: `Unknown note reference "[[${notePathRaw}]]"`,
          }
        }

        if (resolvedItem._id === noteId) {
          return resolveLocalSlug({
            authoredDefinitions,
            noteId,
            slug,
          })
        }

        return resolvePersistedForItem({
          persistedLookup,
          resolvedItem,
          slug,
          notePathRaw,
        })
      },
    })

  const getDefinitionRowKey = (definition: { blockNoteId: string; valueId: string }) =>
    `${definition.blockNoteId}:${definition.valueId}`
  const compiledRowKeys = new Set(compiledDefinitions.map(getDefinitionRowKey))
  await asyncMap(existingRows, async (row) => {
    if (!compiledRowKeys.has(getDefinitionRowKey(row))) {
      await ctx.db.delete('noteValues', row._id)
    }
  })

  const existingRowsByKey = new Map(existingRows.map((row) => [getDefinitionRowKey(row), row]))
  await asyncMap(compiledDefinitions, async (definition) => {
    const row = existingRowsByKey.get(getDefinitionRowKey(definition))
    const fields = {
      campaignId: note.campaignId,
      noteId,
      blockNoteId: definition.blockNoteId,
      valueId: definition.valueId,
      slug: definition.slug,
      expressionSource: definition.expressionSource,
      compiledFormula: definition.compiledFormula,
      bindings: definition.bindings,
      compileStatus: definition.compileStatus,
      errorCode: definition.errorCode,
      errorMessage: definition.errorMessage,
    }
    if (row) {
      await ctx.db.patch('noteValues', row._id, fields)
    } else {
      await ctx.db.insert('noteValues', fields)
    }
  })
  return compiledDefinitions
}
