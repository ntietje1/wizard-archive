import { evaluateNoteValueDefinitions } from '@wizard-archive/editor/notes/values-contract'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { noteValueRowToDefinition } from './noteValueRows'
import type {
  NoteValueDefinition,
  NoteValueRuntimeState,
} from '@wizard-archive/editor/notes/values-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

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

  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note || note.campaignId !== campaignId || !isActiveSidebarItem(note)) {
    rowsByNoteId.set(noteId, [])
    return []
  }
  if (note.type !== RESOURCE_TYPES.notes) {
    rowsByNoteId.set(noteId, [])
    return []
  }
  const noteItem = await getSidebarItem(ctx, noteId)
  if (!noteItem || noteItem.type !== RESOURCE_TYPES.notes) {
    rowsByNoteId.set(noteId, [])
    return []
  }
  const accessibleNote = await checkItemAccess(ctx, {
    rawItem: noteItem,
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
    blocks.map((block) =>
      enforceBlockSharePermissionsOrNull(ctx, {
        block,
        notePermissionLevel: accessibleNote.myPermissionLevel,
      }),
    ),
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

async function loadReachableDefinitions(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  rootNoteId: Id<'sidebarItems'>,
): Promise<Array<NoteValueDefinition<Id<'sidebarItems'>>>> {
  const definitionsByNoteId = new Map<
    Id<'sidebarItems'>,
    Array<NoteValueDefinition<Id<'sidebarItems'>>>
  >()
  const pendingNoteIds = [rootNoteId]
  const loadedNoteIds = new Set<Id<'sidebarItems'>>()

  while (pendingNoteIds.length > 0) {
    const noteId = pendingNoteIds.pop()!
    if (loadedNoteIds.has(noteId)) continue
    loadedNoteIds.add(noteId)
    const definitions = await loadDefinitionsForNote(ctx, campaignId, noteId, definitionsByNoteId)
    for (const targetNoteId of getReferencedNoteIds(definitions)) {
      if (!loadedNoteIds.has(targetNoteId)) pendingNoteIds.push(targetNoteId)
    }
  }

  return Array.from(definitionsByNoteId.values()).flat()
}

function getReferencedNoteIds(
  definitions: Array<NoteValueDefinition<Id<'sidebarItems'>>>,
): Array<Id<'sidebarItems'>> {
  return definitions.flatMap((definition) =>
    definition.compile.status === 'ok'
      ? definition.compile.bindings.map((binding) => binding.targetNoteId)
      : [],
  )
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
  const definitions = await loadReachableDefinitions(ctx, campaignId, noteId)
  return evaluateNoteValueDefinitions(definitions, () => null).filter(
    (state) => state.noteId === noteId,
  )
}
