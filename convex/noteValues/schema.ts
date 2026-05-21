import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { blockNoteIdValidator } from '../blocks/schema'
import { NOTE_VALUE_ERROR_CODES } from '../../shared/note-values/types'

const noteValueCompileStatusValidator = literals('ok', 'error')
const noteValueErrorCodeValidator = literals(...NOTE_VALUE_ERROR_CODES)

// Produced by compileNoteValueDefinitions in shared/note-values/formula; Convex cannot compactly encode the recursive AST.
const compiledFormulaAstValidator = v.any()

const noteValueBindingValidator = v.object({
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
  compiledFormula: compiledFormulaAstValidator,
  bindings: v.array(noteValueBindingValidator),
  compileStatus: noteValueCompileStatusValidator,
  errorCode: v.nullable(noteValueErrorCodeValidator),
  errorMessage: v.nullable(v.string()),
}

export const noteValuesTables = {
  noteValues: defineTable(noteValueTableFields)
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_note_slug', ['campaignId', 'noteId', 'slug']),
}

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
