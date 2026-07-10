import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { blockNoteIdValidator } from '../blocks/schema'
import { NOTE_VALUE_ERROR_CODES } from '@wizard-archive/editor/notes/values-contract'

const noteValueErrorCodeValidator = literals(...NOTE_VALUE_ERROR_CODES)

const noteValueBindingValidator = v.object({
  key: v.string(),
  targetNoteId: v.id('sidebarItems'),
  targetValueId: v.string(),
})

export const noteValueCompileStateValidator = v.union(
  v.object({
    status: v.literal('ok'),
    formula: v.any(),
    bindings: v.array(noteValueBindingValidator),
  }),
  v.object({
    status: v.literal('error'),
    errorCode: noteValueErrorCodeValidator,
    errorMessage: v.string(),
  }),
)

const noteValueTableFields = {
  campaignId: v.id('campaigns'),
  noteId: v.id('sidebarItems'),
  blockNoteId: blockNoteIdValidator,
  valueId: v.string(),
  slug: v.string(),
  expressionSource: v.string(),
  compile: noteValueCompileStateValidator,
}

export const noteValuesTables = {
  noteValues: defineTable(noteValueTableFields)
    .index('by_campaign_note', ['campaignId', 'noteId'])
    .index('by_campaign_note_slug', ['campaignId', 'noteId', 'slug']),
}

const noteValueRuntimeStateIdentityValidators = {
  noteId: v.id('sidebarItems'),
  noteBlockId: blockNoteIdValidator,
  valueId: v.string(),
  slug: v.string(),
}

export const noteValueRuntimeStateValidator = v.union(
  v.object({
    ...noteValueRuntimeStateIdentityValidators,
    status: v.literal('ok'),
    rawValue: v.number(),
    formattedValue: v.string(),
  }),
  v.object({
    ...noteValueRuntimeStateIdentityValidators,
    status: v.literal('error'),
    errorCode: noteValueErrorCodeValidator,
    errorMessage: v.string(),
  }),
)
