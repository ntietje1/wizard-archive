import { generateUuidV7 } from '../../resources/domain-id'
import type { NoteValueProps } from './schema'

export function createCopiedNoteValueIdMap(
  originalValueIds: Iterable<string>,
): ReadonlyMap<string, string> {
  const copiedIdByOriginalId = new Map<string, string>()
  for (const originalValueId of originalValueIds) {
    if (originalValueId && !copiedIdByOriginalId.has(originalValueId)) {
      copiedIdByOriginalId.set(originalValueId, generateUuidV7())
    }
  }
  return copiedIdByOriginalId
}

export function copyNoteValueProps(
  props: NoteValueProps,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
): NoteValueProps {
  return {
    ...props,
    valueId: copiedIdByOriginalId.get(props.valueId) ?? generateUuidV7(),
    expressionSource: rewriteCopiedNoteValueFormula(props.expressionSource, copiedIdByOriginalId),
  }
}

function rewriteCopiedNoteValueFormula(
  expressionSource: string,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
) {
  return expressionSource.replace(/\{\{([^}]+)}}/g, (reference, rawValueId: string) => {
    const copiedId = copiedIdByOriginalId.get(rawValueId.trim())
    return copiedId ? `{{${copiedId}}}` : reference
  })
}
