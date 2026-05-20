export type FormulaAutocompleteContext =
  | {
      kind: 'identifier'
      query: string
      replaceFrom: number
      replaceTo: number
    }
  | {
      kind: 'external_note'
      query: string
      replaceFrom: number
      replaceTo: number
    }
  | {
      kind: 'external_value'
      notePathRaw: string
      query: string
      replaceFrom: number
      replaceTo: number
    }

export function buildSameNoteValueReference(slug: string): string {
  return `[[${slug}]]`
}

export function buildExternalNoteValuePrefix(notePath: string): string {
  return `[[${notePath}.`
}

export function buildExternalNoteValueReference(notePath: string, slug: string): string {
  return `${buildExternalNoteValuePrefix(notePath)}${slug}]]`
}

export function getFormulaAutocompleteContext(
  expressionSource: string,
  cursorPosition: number,
  options: { force?: boolean; selectionEnd?: number | null } = {},
): FormulaAutocompleteContext | null {
  const cursor = Math.max(0, Math.min(cursorPosition, expressionSource.length))
  const selectionEnd =
    options.selectionEnd === undefined || options.selectionEnd === null
      ? cursor
      : Math.max(0, Math.min(options.selectionEnd, expressionSource.length))
  if (options.force && selectionEnd !== cursor) {
    return {
      kind: 'identifier',
      query: '',
      replaceFrom: Math.min(cursor, selectionEnd),
      replaceTo: Math.max(cursor, selectionEnd),
    }
  }

  const beforeCursor = expressionSource.slice(0, cursor)
  const wikiReplaceTo = getWikiReplaceTo(expressionSource, cursor)

  const externalValueMatch = beforeCursor.match(/\[\[([^\]]+)\.([A-Za-z0-9_-]*)$/)
  if (externalValueMatch) {
    return {
      kind: 'external_value',
      notePathRaw: externalValueMatch[1],
      query: externalValueMatch[2],
      replaceFrom: cursor - externalValueMatch[2].length,
      replaceTo: wikiReplaceTo,
    }
  }

  const openWikiIndex = beforeCursor.lastIndexOf('[[')
  const closeWikiIndex = beforeCursor.lastIndexOf(']]')
  if (openWikiIndex > closeWikiIndex) {
    const query = beforeCursor.slice(openWikiIndex + 2)
    return {
      kind: 'external_note',
      query,
      replaceFrom: openWikiIndex,
      replaceTo: wikiReplaceTo,
    }
  }

  const identifierMatch = beforeCursor.match(/([A-Za-z_][A-Za-z0-9_]*)$/)
  if (identifierMatch) {
    const replaceFrom = cursor - identifierMatch[1].length
    if (expressionSource[replaceFrom - 1] === '.') {
      return null
    }
    return {
      kind: 'identifier',
      query: identifierMatch[1],
      replaceFrom,
      replaceTo: cursor,
    }
  }

  if (options.force) {
    return {
      kind: 'identifier',
      query: '',
      replaceFrom: cursor,
      replaceTo: cursor,
    }
  }

  return null
}

function getWikiReplaceTo(expressionSource: string, cursorPosition: number): number {
  const closeIndex = expressionSource.indexOf(']]', cursorPosition)
  if (closeIndex === -1) {
    return cursorPosition
  }

  const nextOpenIndex = expressionSource.indexOf('[[', cursorPosition)
  if (nextOpenIndex !== -1 && nextOpenIndex < closeIndex) {
    return cursorPosition
  }

  return closeIndex + 2
}

export function applyFormulaAutocompleteInsertion(
  expressionSource: string,
  context: FormulaAutocompleteContext,
  insertedText: string,
): { expressionSource: string; cursorPosition: number } {
  const nextExpression =
    expressionSource.slice(0, context.replaceFrom) +
    insertedText +
    expressionSource.slice(context.replaceTo)
  const cursorOffset = insertedText.endsWith('()') ? insertedText.length - 1 : insertedText.length
  return {
    expressionSource: nextExpression,
    cursorPosition: context.replaceFrom + cursorOffset,
  }
}

export function rewriteSameNoteValueReferences(
  expressionSource: string,
  slugMap: ReadonlyMap<string, string>,
): string {
  return expressionSource.replace(/\[\[([^\]]+)]]/g, (match, rawTarget: string) => {
    const target = rawTarget.trim()
    if (target.includes('.')) return match

    const nextSlug = slugMap.get(target)
    return nextSlug ? buildSameNoteValueReference(nextSlug) : match
  })
}
