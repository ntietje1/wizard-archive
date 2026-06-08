export function getDeleteBlockInlineContentProjectionFieldPatch(block: {
  inlineContent?: unknown
}): { inlineContent: undefined } | null {
  if (!('inlineContent' in block)) return null
  return { inlineContent: undefined }
}
