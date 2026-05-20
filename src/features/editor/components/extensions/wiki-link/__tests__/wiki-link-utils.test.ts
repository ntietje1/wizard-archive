import { describe, expect, it } from 'vite-plus/test'
import { getWikiLinkContext, splitWikiLinkTargetAndDisplayName } from '../wiki-link-utils'
import type { WikiLinkContextEditor } from '../wiki-link-utils'
import { clampAutocompleteSelectedIndex } from '../wiki-link-autocomplete-model'

function editorWithTextCursor(text: string, cursor: number): WikiLinkContextEditor {
  return {
    _tiptapEditor: {
      state: {
        selection: {
          from: cursor,
          $from: {
            start: () => 0,
            end: () => text.length,
          },
        },
        doc: {
          textBetween: (from: number, to: number) => text.slice(from, to),
        },
      },
    },
  }
}

describe('splitWikiLinkTargetAndDisplayName', () => {
  it('returns the full query when no display name is present', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City#District')).toEqual({
      targetQuery: 'World/City#District',
      displayName: null,
    })
  })

  it('returns an empty target and null display name for empty input', () => {
    expect(splitWikiLinkTargetAndDisplayName('')).toEqual({
      targetQuery: '',
      displayName: null,
    })
  })

  it('separates a display name from the target query', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City#District|Capital')).toEqual({
      targetQuery: 'World/City#District',
      displayName: 'Capital',
    })
  })

  it('treats the last pipe as the display name separator', () => {
    expect(splitWikiLinkTargetAndDisplayName('World/City|Capital|Alias')).toEqual({
      targetQuery: 'World/City|Capital',
      displayName: 'Alias',
    })
  })

  it('preserves an empty display name after a trailing pipe', () => {
    expect(splitWikiLinkTargetAndDisplayName('Target|')).toEqual({
      targetQuery: 'Target',
      displayName: '',
    })
  })

  it('allows an empty target before the display name', () => {
    expect(splitWikiLinkTargetAndDisplayName('|DisplayOnly')).toEqual({
      targetQuery: '',
      displayName: 'DisplayOnly',
    })
  })
})

describe('getWikiLinkContext', () => {
  it('includes an existing closing bracket pair in the active replacement range', () => {
    const text = '[[Note.value]]'
    const cursor = text.indexOf(']]')

    expect(getWikiLinkContext(editorWithTextCursor(text, cursor))).toEqual({
      query: 'Note.value',
      startPos: 0,
      endPos: text.length,
    })
  })
})

describe('clampAutocompleteSelectedIndex', () => {
  it('keeps keyboard selection inside the current suggestion list', () => {
    expect(clampAutocompleteSelectedIndex(4, 3)).toBe(2)
    expect(clampAutocompleteSelectedIndex(-1, 3)).toBe(0)
    expect(clampAutocompleteSelectedIndex(2, 0)).toBe(0)
  })
})
