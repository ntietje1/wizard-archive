import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import {
  MD_LINK_REGEX,
  WIKI_LINK_REGEX,
  parseMdLinkTarget,
  parseWikiLinkText,
} from '../../../../../shared/links/parsing'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { LinkResolver } from '../references/resolver'
import type { MdLinkDecorationMatch } from './md-decorations'
import type { WikiLinkDecorationMatch } from './wiki-decorations'
import { buildMdLinkDecorationEntries } from './md-decorations'
import { registerLinkPlugins } from './plugin-registration'
import { buildWikiLinkDecorationEntries } from './wiki-decorations'
import type { LinkPluginEditor } from './plugin-registration'

const PLUGIN_KEY = new PluginKey('linkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('linkSelectionStabilizer')
const INLINE_ATOM_TEXT = '\uFFFC'
const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
])

interface PluginState {
  decorations: DecorationSet
  linkRanges: Array<LinkRange>
  selFrom: number
  selTo: number
}

interface LinkDecorationEditor {
  _tiptapEditor?: LinkPluginEditor
}

interface LinkRange {
  from: number
  to: number
}

interface WikiLinkTextMatch extends LinkRange {
  innerText: string
}

interface MdLinkTextMatch extends LinkRange {
  displayText: string
  target: string
}

export function useNoteLinkDecorations(
  editor: LinkDecorationEditor | undefined,
  resolver: LinkResolver,
  isViewerMode = resolver.isViewerMode,
) {
  const tiptapEditor = editor?._tiptapEditor
  const resolverRef = useRef(resolver)
  const isViewerModeRef = useRef(isViewerMode)
  const refreshRef = useRef<{
    editor: LinkDecorationEditor | undefined
    resolverRevision: string
    isViewerMode: boolean
  } | null>(null)
  resolverRef.current = resolver
  isViewerModeRef.current = isViewerMode

  useEffect(() => {
    if (!tiptapEditor) return

    return registerLinkPlugins({
      tiptapEditor,
      pluginKey: PLUGIN_KEY,
      stabilizerKey: SELECTION_STABILIZER_KEY,
      createDecorationPlugin: () =>
        createLinkDecorationPlugin(
          () => resolverRef.current,
          () => isViewerModeRef.current,
        ),
    })
  }, [tiptapEditor])

  useEffect(() => {
    const previous = refreshRef.current
    refreshRef.current = { editor, resolverRevision: resolver.revision, isViewerMode }
    if (!previous || previous.editor !== editor) return
    if (previous.resolverRevision === resolver.revision && previous.isViewerMode === isViewerMode) {
      return
    }

    const view = editor?._tiptapEditor?.view
    if (isDispatchableEditorView(view)) {
      try {
        view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, true))
      } catch (error) {
        if (editor?._tiptapEditor?.view === view) {
          console.error('useNoteLinkDecorations dispatch failed', {
            pluginKey: PLUGIN_KEY,
            error,
          })
        }
      }
    }
  }, [editor, resolver, isViewerMode])
}

function isDispatchableEditorView(view: unknown): view is {
  state: { tr: { setMeta: (key: PluginKey, value: boolean) => unknown } }
  dispatch: (tr: unknown) => void
} {
  return (
    typeof view === 'object' &&
    view !== null &&
    'state' in view &&
    'dispatch' in view &&
    typeof view.dispatch === 'function'
  )
}

function createLinkDecorationPlugin(
  getResolver: () => LinkResolver,
  getIsViewerMode: () => boolean,
): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: PLUGIN_KEY,
    state: {
      init(_, { doc, selection }) {
        return createPluginState(
          doc,
          getResolver(),
          getIsViewerMode(),
          selection.from,
          selection.to,
        )
      },
      apply(tr, oldState, _, newEditorState) {
        const resolver = getResolver()
        const isViewerMode = getIsViewerMode()
        const forceRebuild = tr.getMeta(PLUGIN_KEY)
        const { from: selFrom, to: selTo } = newEditorState.selection

        if (tr.docChanged || forceRebuild) {
          return createPluginState(newEditorState.doc, resolver, isViewerMode, selFrom, selTo)
        }

        if (tr.selectionSet && !isViewerMode) {
          const oldOverlapping = oldState.linkRanges.filter((match) =>
            selectionOverlapsLink(oldState.selFrom, oldState.selTo, match),
          )
          const newOverlapping = oldState.linkRanges.filter((match) =>
            selectionOverlapsLink(selFrom, selTo, match),
          )
          const overlappingChanged = !linkRangesEqual(oldOverlapping, newOverlapping)

          if (overlappingChanged) {
            return createPluginState(newEditorState.doc, resolver, isViewerMode, selFrom, selTo)
          }
        }

        return {
          decorations: oldState.decorations.map(tr.mapping, tr.doc),
          linkRanges: oldState.linkRanges,
          selFrom,
          selTo,
        }
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations || DecorationSet.empty
      },
    },
  })
}

function linkRangesEqual(left: Array<LinkRange>, right: Array<LinkRange>): boolean {
  return (
    left.length === right.length &&
    left.every((leftRange) =>
      right.some(
        (rightRange) => leftRange.from === rightRange.from && leftRange.to === rightRange.to,
      ),
    )
  )
}

function createPluginState(
  doc: ProseMirrorNode,
  resolver: LinkResolver,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): PluginState {
  const decorations = [
    ...findWikiLinks(doc, resolver).flatMap((match) =>
      buildWikiLinkDecorationEntries(match, {
        isViewerMode,
        isActive: !isViewerMode && selectionOverlapsLink(selFrom, selTo, match),
      }),
    ),
    ...findMdLinks(doc, resolver).flatMap((match) =>
      buildMdLinkDecorationEntries(match, {
        isViewerMode,
        isActive: !isViewerMode && selectionOverlapsLink(selFrom, selTo, match),
      }),
    ),
  ]

  return {
    decorations: DecorationSet.create(doc, decorations),
    linkRanges: findLinkRanges(doc),
    selFrom,
    selTo,
  }
}

function selectionOverlapsLink(selFrom: number, selTo: number, range: LinkRange): boolean {
  if (selFrom === selTo) {
    return selFrom >= range.from && selFrom < range.to
  }

  return selFrom < range.to && selTo > range.from
}

function findLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  return [...findWikiLinkRanges(doc), ...findMdLinkRanges(doc)]
}

function findWikiLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  return findWikiLinkTextMatches(doc).map(({ from, to }) => ({ from, to }))
}

function findMdLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  return findMdLinkTextMatches(doc).map(({ from, to }) => ({ from, to }))
}

function findWikiLinks(
  doc: ProseMirrorNode,
  resolver: LinkResolver,
): Array<WikiLinkDecorationMatch> {
  return findWikiLinkTextMatches(doc).map(({ from, to, innerText }) => {
    const parsed = parseWikiLinkText(innerText)
    const resolved = resolver.resolveLink({
      syntax: 'wiki',
      pathKind: parsed.pathKind,
      itemPath: parsed.itemPath,
      itemName: parsed.itemName,
      headingPath: parsed.headingPath,
      displayName: parsed.displayName,
      rawTarget: innerText,
      isExternal: false,
    })
    return { from, to, innerText, parsed, resolved }
  })
}

function findMdLinks(doc: ProseMirrorNode, resolver: LinkResolver): Array<MdLinkDecorationMatch> {
  return findMdLinkTextMatches(doc).map(({ from, to, displayText, target }) => {
    const parsed = { displayText, ...parseMdLinkTarget(target) }
    const resolved = resolver.resolveLink({
      syntax: 'md',
      pathKind: parsed.pathKind,
      itemPath: parsed.itemPath,
      itemName: parsed.itemName,
      headingPath: parsed.headingPath,
      displayName: displayText,
      rawTarget: target,
      isExternal: parsed.isExternal,
    })
    return { from, to, displayText, target, parsed, resolved }
  })
}

function findWikiLinkTextMatches(doc: ProseMirrorNode): Array<WikiLinkTextMatch> {
  return findLinkTextMatches(doc, WIKI_LINK_REGEX, (match, from, to) => ({
    from,
    to,
    innerText: match[1],
  }))
}

function findMdLinkTextMatches(doc: ProseMirrorNode): Array<MdLinkTextMatch> {
  return findLinkTextMatches(doc, MD_LINK_REGEX, (match, from, to) => ({
    from,
    to,
    displayText: match[1],
    target: match[2],
  }))
}

function findLinkTextMatches<TMatch extends LinkRange>(
  doc: ProseMirrorNode,
  sourceRegex: RegExp,
  createMatch: (match: RegExpExecArray, from: number, to: number) => TMatch,
): Array<TMatch> {
  const matches: Array<TMatch> = []
  const regex = new RegExp(sourceRegex.source, 'g')
  doc.descendants((node, pos) => {
    if (!TEXT_BLOCK_TYPES.has(node.type.name)) return

    const nodeStart = pos
    const nodeEnd = pos + node.nodeSize
    const text = doc.textBetween(nodeStart, nodeEnd, '', INLINE_ATOM_TEXT)
    if (!text) return

    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const from = nodeStart + 1 + match.index
      const to = from + match[0].length
      matches.push(createMatch(match, from, to))
    }
  })

  return matches
}
