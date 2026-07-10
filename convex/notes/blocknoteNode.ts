'use node'

import { decodeNoteYjsUpdatesToBlocks } from '@wizard-archive/editor/notes/document-yjs'
import { parseBlockNoteBlocks } from '../blocks/parseBlockNoteBlocks'
import { ERROR_CODE, getClientErrorMessage } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { Doc } from '../_generated/dataModel'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'

const DOCUMENT_FRAGMENT_NAME = 'document'

export function yjsUpdatesToBlocks(
  updates: Array<Pick<Doc<'yjsUpdates'>, 'update'>>,
): Array<NoteBlock> {
  let rawBlocks: unknown
  try {
    rawBlocks = normalizeForConvex(decodeNoteYjsUpdatesToBlocks(updates, DOCUMENT_FRAGMENT_NAME))
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Failed to decode BlockNote Yjs updates for fragment "${DOCUMENT_FRAGMENT_NAME}": ${formatError(error)}`,
    )
  }

  try {
    return parseBlockNoteBlocks(rawBlocks)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Invalid BlockNote output for fragment "${DOCUMENT_FRAGMENT_NAME}" (${formatBlockNoteOutputSummary(rawBlocks)}): ${formatError(error)}`,
    )
  }
}

function formatBlockNoteOutputSummary(value: unknown): string {
  if (Array.isArray(value)) {
    const counts = countArrayItemShapes(value)
    return `array(length=${value.length}, objects=${counts.objects}, arrays=${counts.arrays}, strings=${counts.strings}, numbers=${counts.numbers}, booleans=${counts.booleans}, nulls=${counts.nulls}, other=${counts.other})`
  }
  if (value === null) return 'null'
  if (typeof value === 'string') return `string(length=${value.length})`
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'object') return `object(keys=${Object.keys(value).length})`
  return typeof value
}

function countArrayItemShapes(values: Array<unknown>) {
  const counts = {
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    other: 0,
  }

  for (const value of values) {
    if (value === null) counts.nulls += 1
    else if (Array.isArray(value)) counts.arrays += 1
    else if (typeof value === 'object') counts.objects += 1
    else if (typeof value === 'string') counts.strings += 1
    else if (typeof value === 'number') counts.numbers += 1
    else if (typeof value === 'boolean') counts.booleans += 1
    else counts.other += 1
  }

  return counts
}

function formatError(error: unknown): string {
  const clientMessage = getClientErrorMessage(error)
  if (clientMessage) return clientMessage
  return error instanceof Error ? error.message : String(error)
}

function normalizeForConvex(value: unknown): unknown {
  if (value === undefined) return null
  if (Array.isArray(value)) return value.map(normalizeForConvex)
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue !== undefined) {
      result[key] = normalizeForConvex(nestedValue)
    }
  }
  return result
}
