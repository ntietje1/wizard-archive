import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { blockNoteIdValidator } from '../blocks/schema'
import { NOTE_VALUE_ERROR_CODES } from '../../shared/note-values/types'
import type { Validator } from 'convex/values'
import type { PersistedNoteValueCompiledFormula } from '../../shared/note-values/types'

const noteValueCompileStatusValidator = literals('ok', 'error')
const noteValueErrorCodeValidator = literals(...NOTE_VALUE_ERROR_CODES)

const noteValueCompiledFormulaLeafValidator = v.union(
  v.object({
    kind: v.literal('number'),
    value: v.number(),
  }),
  v.object({
    kind: v.literal('binding'),
    key: v.string(),
  }),
)

export const shallowNoteValueCompiledFormulaValidator = v.union(
  noteValueCompiledFormulaLeafValidator,
  v.object({
    kind: v.literal('unary'),
    operator: literals('+', '-'),
    argument: v.any(),
  }),
  v.object({
    kind: v.literal('binary'),
    operator: literals('+', '-', '*', '/'),
    left: v.any(),
    right: v.any(),
  }),
  v.object({
    kind: v.literal('call'),
    callee: v.string(),
    args: v.array(v.any()),
  }),
) as unknown as Validator<PersistedNoteValueCompiledFormula, 'required'>

export const noteValueCompiledFormulaValidator = shallowNoteValueCompiledFormulaValidator

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
  compiledFormula: v.nullable(noteValueCompiledFormulaValidator),
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
