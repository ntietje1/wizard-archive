import { asyncMap } from 'convex-helpers'
import { parseResolvableWikiItemPath } from '../../../shared/links/resolution'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import {
  collectFormulaReferences,
  compileNoteValueDefinitions,
  extractNoteValueDefinitions,
} from '@wizard-archive/editor/notes/values-contract'
import { noteValueRowToDefinition } from './noteValueRows'
import { requireValidNoteValueCompileState } from '../compileState'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { CampaignMemberRow } from '../../campaigns/rows'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type { AccessibleResourcePathResolver } from '../../sidebarItems/functions/resourcePathResolver'
import type {
  FormulaReferenceToken,
  NoteValueAuthoringDefinition,
  NoteValueBinding,
  NoteValueCompiledFormula,
  NoteValueDefinition,
  NoteValueResolution,
} from '@wizard-archive/editor/notes/values-contract'

type ExternalFormulaReferenceToken = Extract<FormulaReferenceToken, { kind: 'external' }>
type ParsedNotePath = NonNullable<ReturnType<typeof parseResolvableWikiItemPath>>

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

function parseNotePath(notePathRaw: string): ParsedNotePath | null {
  return parseResolvableWikiItemPath(notePathRaw)
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

function resolvePersistedForItem({
  persistedLookup,
  resolvedItem,
  slug,
  notePathRaw,
}: {
  persistedLookup: Map<Id<'sidebarItems'>, Map<string, Array<string>>>
  resolvedItem: Doc<'sidebarItems'>
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
  accessibleExternalNoteIds,
  currentNoteId,
  previousDefinitionsByValueId,
}: {
  accessibleExternalNoteIds: Set<TNoteId>
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
    if (previousDefinition.compile.status !== 'ok') return []

    const references = collectFormulaReferences(previousDefinition.expressionSource)
    const bindingKeys: Array<string> = []
    collectCompiledBindingKeys(previousDefinition.compile.formula, bindingKeys)
    const bindingsByKey = new Map(
      previousDefinition.compile.bindings.map((binding) => [binding.key, binding]),
    )

    const queue: Array<NoteValueBinding<TNoteId> | null> = []
    references.forEach((reference, index) => {
      if (reference.kind !== 'external') return
      const binding = bindingsByKey.get(bindingKeys[index])
      if (
        binding &&
        binding.targetNoteId !== currentNoteId &&
        accessibleExternalNoteIds.has(binding.targetNoteId)
      ) {
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
      previousDefinition?.compile.status !== 'ok' ||
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

async function buildExternalReferenceIndex({
  ctx,
  campaignId,
  currentNoteId,
  externalReferences,
  resourcePathResolver,
  sourceParentId,
}: {
  ctx: Pick<MutationCtx, 'db'>
  campaignId: Id<'campaigns'>
  currentNoteId: Id<'sidebarItems'>
  externalReferences: Array<ExternalFormulaReferenceToken>
  resourcePathResolver: AccessibleResourcePathResolver
  sourceParentId: Id<'sidebarItems'> | null
}) {
  const resolvedItemsByPath = new Map<string, Doc<'sidebarItems'> | null>()
  await Promise.all(
    [...new Set(externalReferences.map((reference) => reference.notePathRaw))].map(
      async (notePathRaw) => {
        const parsed = parseNotePath(notePathRaw)
        const resolvedItem = parsed
          ? await resourcePathResolver.resolvePath({
              pathKind: parsed.pathKind,
              pathSegments: parsed.itemPath,
              sourceParentId,
            })
          : null
        resolvedItemsByPath.set(
          notePathRaw,
          resolvedItem?.type === RESOURCE_TYPES.notes ? resolvedItem : null,
        )
      },
    ),
  )

  const lookup = new Map<Id<'sidebarItems'>, Map<string, Array<string>>>()
  const queriedTargets = new Set<string>()
  const targets: Array<{ noteId: Id<'sidebarItems'>; slug: string }> = []
  for (const reference of externalReferences) {
    const targetNoteId = resolvedItemsByPath.get(reference.notePathRaw)?._id ?? null
    if (!targetNoteId || targetNoteId === currentNoteId) {
      continue
    }

    const targetKey = `${targetNoteId}:${reference.slug}`
    if (queriedTargets.has(targetKey)) {
      continue
    }
    queriedTargets.add(targetKey)
    targets.push({ noteId: targetNoteId, slug: reference.slug })
  }
  await Promise.all(
    targets.map(async ({ noteId, slug }) => {
      const rows = await ctx.db
        .query('noteValues')
        .withIndex('by_campaign_note_slug', (q) =>
          q.eq('campaignId', campaignId).eq('noteId', noteId).eq('slug', slug),
        )
        .collect()
      let valuesBySlug = lookup.get(noteId)
      if (!valuesBySlug) {
        valuesBySlug = new Map()
        lookup.set(noteId, valuesBySlug)
      }
      valuesBySlug.set(
        slug,
        rows.map((row) => row.valueId),
      )
    }),
  )

  return { lookup, resolvedItemsByPath }
}

export async function saveAllNoteValuesForNote(
  ctx: Pick<MutationCtx, 'db'> & { membership?: CampaignMemberRow },
  {
    noteId,
    content,
    resourcePathResolver,
  }: {
    noteId: Id<'sidebarItems'>
    content: Array<NoteBlock>
    resourcePathResolver: AccessibleResourcePathResolver
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
  const existingDefinitionsByValueId = new Map(
    existingRows.map((row) => [row.valueId, noteValueRowToDefinition(row)]),
  )
  const externalReferenceIndex =
    externalReferences.length > 0
      ? await buildExternalReferenceIndex({
          ctx,
          campaignId: note.campaignId,
          currentNoteId: noteId,
          externalReferences,
          resourcePathResolver,
          sourceParentId: note.parentId,
        })
      : {
          lookup: new Map<Id<'sidebarItems'>, Map<string, Array<string>>>(),
          resolvedItemsByPath: new Map<string, Doc<'sidebarItems'> | null>(),
        }
  const durableTargetIds = new Set(
    [...existingDefinitionsByValueId.values()].flatMap((definition) =>
      definition.compile.status === 'ok'
        ? definition.compile.bindings.flatMap((binding) =>
            binding.targetNoteId === noteId ? [] : [binding.targetNoteId],
          )
        : [],
    ),
  )
  const accessibleDurableItems = await Promise.all(
    [...durableTargetIds].map((targetNoteId) =>
      resourcePathResolver.getAccessibleItem(targetNoteId),
    ),
  )
  const accessibleExternalNoteIds = new Set([
    ...[...externalReferenceIndex.resolvedItemsByPath.values()].flatMap((item) =>
      item && item._id !== noteId ? [item._id] : [],
    ),
    ...accessibleDurableItems.flatMap((item) =>
      item?.type === RESOURCE_TYPES.notes && item._id !== noteId ? [item._id] : [],
    ),
  ])
  const takeDurableExternalBinding = createDurableExternalBindingResolver({
    accessibleExternalNoteIds,
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

        const resolvedItem = externalReferenceIndex.resolvedItemsByPath.get(notePathRaw) ?? null
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
          persistedLookup: externalReferenceIndex.lookup,
          resolvedItem,
          slug,
          notePathRaw,
        })
      },
    })

  const getDefinitionRowKey = (definition: { noteBlockId: string; valueId: string }) =>
    `${definition.noteBlockId}:${definition.valueId}`
  const getRowKey = (row: { blockNoteId: string; valueId: string }) =>
    `${row.blockNoteId}:${row.valueId}`
  const compiledRowKeys = new Set(compiledDefinitions.map(getDefinitionRowKey))
  await asyncMap(existingRows, async (row) => {
    if (!compiledRowKeys.has(getRowKey(row))) {
      await ctx.db.delete('noteValues', row._id)
    }
  })

  const existingRowsByKey = new Map(existingRows.map((row) => [getRowKey(row), row]))
  await asyncMap(compiledDefinitions, async (definition) => {
    const row = existingRowsByKey.get(getDefinitionRowKey(definition))
    const compile = requireValidNoteValueCompileState(definition.compile)
    const fields = {
      campaignId: note.campaignId,
      noteId,
      blockNoteId: definition.noteBlockId,
      valueId: definition.valueId,
      slug: definition.slug,
      expressionSource: definition.expressionSource,
      compile,
    }
    if (row) {
      await ctx.db.patch('noteValues', row._id, fields)
    } else {
      await ctx.db.insert('noteValues', fields)
    }
  })
  return compiledDefinitions
}
