import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'
import { blockNoteIdValidator } from '../blocks/schema'
import { NOTE_VALUE_ERROR_CODES } from '../../shared/note-values/types'

export const noteValueCompileStatusValidator = literals('ok', 'error')
export const noteValueErrorCodeValidator = literals(...NOTE_VALUE_ERROR_CODES)

export const noteValueBindingValidator = v.object({
  key: v.string(),
  targetNoteId: v.id('sidebarItems'),
  targetValueId: v.string(),
})

const noteValueTableFields = {
  campaignId: v.id('campaigns'),
  noteId: v.id('sidebarItems'),
  blockNoteId: blockNoteIdValidator,
  valueId: v.string(),
  slug: v.string(),
  expressionSource: v.string(),
  compiledFormula: v.nullable(v.any()),
  bindings: v.array(noteValueBindingValidator),
  compileStatus: noteValueCompileStatusValidator,
  errorCode: v.nullable(noteValueErrorCodeValidator),
  errorMessage: v.nullable(v.string()),
}

export const noteValuesTables = {
  noteValues: defineTable(noteValueTableFields)
    .index('by_campaign', ['campaignId'])
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_note_block', ['campaignId', 'noteId', 'blockNoteId'])
    .index('by_campaign_note_slug', ['campaignId', 'noteId', 'slug'])
    .index('by_campaign_note_valueId', ['campaignId', 'noteId', 'valueId']),
}

export const noteValueValidator = v.object({
  ...convexValidatorFields('noteValues'),
  ...noteValueTableFields,
})

export const noteValueRuntimeStateValidator = v.object({
  noteId: v.id('sidebarItems'),
  blockNoteId: blockNoteIdValidator,
  valueId: v.string(),
  slug: v.string(),
  status: literals('ok', 'error'),
  rawValue: v.union(v.number(), v.null()),
  formattedValue: v.string(),
  errorCode: v.nullable(noteValueErrorCodeValidator),
  errorMessage: v.nullable(v.string()),
})
