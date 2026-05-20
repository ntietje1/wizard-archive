import { evaluateNoteValueDefinitions } from '../../../shared/note-values/formula'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { noteValueRowToDefinition } from './noteValueRows'
import type { NoteValueDefinition, NoteValueRuntimeState } from '../../../shared/note-values/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { NoteFromDb } from '../../notes/types'

interface ResolvedNoteStates {
  states: Array<NoteValueRuntimeState<Id<'sidebarItems'>>>
  stateMap: Map<string, NoteValueRuntimeState<Id<'sidebarItems'>>>
}

function makeCyclicState(
  definition: NoteValueDefinition<Id<'sidebarItems'>>,
): NoteValueRuntimeState<Id<'sidebarItems'>> {
  return {
    noteId: definition.noteId,
    blockNoteId: definition.blockNoteId,
    valueId: definition.valueId,
    slug: definition.slug,
    status: 'error',
    rawValue: null,
    formattedValue: 'Cyclic dependency detected',
    errorCode: 'cyclic_dependency',
    errorMessage: 'Cyclic dependency detected',
  }
}

async function loadDefinitionsForNote(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
  rowsByNoteId: Map<Id<'sidebarItems'>, Array<NoteValueDefinition<Id<'sidebarItems'>>>>,
): Promise<Array<NoteValueDefinition<Id<'sidebarItems'>>>> {
  const cached = rowsByNoteId.get(noteId)
  if (cached) {
    return cached
  }

  const note = await ctx.db.get(noteId)
  if (!note || note.campaignId !== campaignId || !isActiveSidebarItem(note)) {
    rowsByNoteId.set(noteId, [])
    return []
  }
  if (note.type !== SIDEBAR_ITEM_TYPES.notes) {
    rowsByNoteId.set(noteId, [])
    return []
  }
  const accessibleNote = await checkItemAccess(ctx, {
    rawItem: note as NoteFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!accessibleNote) {
    rowsByNoteId.set(noteId, [])
    return []
  }

  const [rows, blocks] = await Promise.all([
    ctx.db
      .query('noteValues')
      .withIndex('by_campaign_note', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
      .collect(),
    getAllBlocksByNote(ctx, { noteId }),
  ])
  const visibleBlocks = await Promise.all(
    blocks.map((block) => enforceBlockSharePermissionsOrNull(ctx, { block })),
  )
  const visibleBlockNoteIds = new Set(
    visibleBlocks.flatMap((result) => (result ? [result.block.blockNoteId] : [])),
  )
  const definitions = rows
    .filter((row) => visibleBlockNoteIds.has(row.blockNoteId))
    .map(noteValueRowToDefinition)
  rowsByNoteId.set(noteId, definitions)
  return definitions
}

async function resolveNoteStates(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'sidebarItems'>,
  rowsByNoteId: Map<Id<'sidebarItems'>, Array<NoteValueDefinition<Id<'sidebarItems'>>>>,
  statesByNoteId: Map<Id<'sidebarItems'>, ResolvedNoteStates>,
  resolvingNotes: Set<Id<'sidebarItems'>>,
): Promise<ResolvedNoteStates> {
  const cached = statesByNoteId.get(noteId)
  if (cached) {
    return cached
  }

  const definitions = await loadDefinitionsForNote(ctx, campaignId, noteId, rowsByNoteId)
  if (resolvingNotes.has(noteId)) {
    const states = definitions.map(makeCyclicState)
    return { states, stateMap: new Map(states.map((state) => [state.valueId, state])) }
  }

  resolvingNotes.add(noteId)
  try {
    const externalNoteIds = new Set<Id<'sidebarItems'>>()
    for (const definition of definitions) {
      for (const binding of definition.bindings) {
        if (binding.targetNoteId !== noteId) {
          externalNoteIds.add(binding.targetNoteId)
        }
      }
    }

    const externalStateMaps = new Map<
      Id<'sidebarItems'>,
      Map<string, NoteValueRuntimeState<Id<'sidebarItems'>>>
    >()

    for (const externalNoteId of externalNoteIds) {
      externalStateMaps.set(
        externalNoteId,
        (
          await resolveNoteStates(
            ctx,
            campaignId,
            externalNoteId,
            rowsByNoteId,
            statesByNoteId,
            resolvingNotes,
          )
        ).stateMap,
      )
    }

    const states = evaluateNoteValueDefinitions(
      definitions,
      (dependencyNoteId, dependencyValueId) => {
        if (dependencyNoteId === noteId) {
          return null
        }
        return externalStateMaps.get(dependencyNoteId)?.get(dependencyValueId) ?? null
      },
    )

    const stateMap = new Map(states.map((state) => [state.valueId, state]))
    const result = { states, stateMap }
    statesByNoteId.set(noteId, result)
    return result
  } finally {
    resolvingNotes.delete(noteId)
  }
}

export async function getPersistedNoteValueStates(
  ctx: CampaignQueryCtx,
  {
    campaignId,
    noteId,
  }: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
  },
): Promise<Array<NoteValueRuntimeState<Id<'sidebarItems'>>>> {
  const rowsByNoteId = new Map<Id<'sidebarItems'>, Array<NoteValueDefinition<Id<'sidebarItems'>>>>()
  const statesByNoteId = new Map<Id<'sidebarItems'>, ResolvedNoteStates>()
  const { states } = await resolveNoteStates(
    ctx,
    campaignId,
    noteId,
    rowsByNoteId,
    statesByNoteId,
    new Set(),
  )
  return states
}
