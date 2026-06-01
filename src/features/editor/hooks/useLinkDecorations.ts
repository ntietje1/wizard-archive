import { useEffect, useRef } from 'react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import {
  MD_LINK_REGEX,
  WIKI_LINK_REGEX,
  parseMdLinkTarget,
  parseWikiLinkText,
} from 'shared/links/parsing'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { LinkResolver } from './useLinkResolver'
import type { MdLinkDecorationMatch } from '~/features/editor/utils/md-link-decorations'
import type { WikiLinkDecorationMatch } from '~/features/editor/utils/wiki-link-decorations'
import { buildMdLinkDecorationEntries } from '~/features/editor/utils/md-link-decorations'
import { registerLinkPlugins } from '~/features/editor/utils/link-extension-utils'
import { buildWikiLinkDecorationEntries } from '~/features/editor/utils/wiki-link-decorations'

const PLUGIN_KEY = new PluginKey('linkDecoration')
const SELECTION_STABILIZER_KEY = new PluginKey('linkSelectionStabilizer')
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
  selFrom: number
  selTo: number
}

interface LinkRange {
  from: number
  to: number
}

export function useLinkDecorations(
  editor: CustomBlockNoteEditor | undefined,
  resolver: LinkResolver,
  isViewerMode = resolver.isViewerMode,
) {
  const resolverRef = useRef(resolver)
  const isViewerModeRef = useRef(isViewerMode)
  const refreshRef = useRef<{
    editor: CustomBlockNoteEditor | undefined
    resolver: LinkResolver
    isViewerMode: boolean
  } | null>(null)
  resolverRef.current = resolver
  isViewerModeRef.current = isViewerMode

  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
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
  }, [editor])

  useEffect(() => {
    const previous = refreshRef.current
    refreshRef.current = { editor, resolver, isViewerMode }
    if (!previous || previous.editor !== editor) return
    if (previous.resolver === resolver && previous.isViewerMode === isViewerMode) return

    const view = editor?._tiptapEditor?.view
    if (view) {
      try {
        view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, true))
      } catch (error) {
        if (editor?._tiptapEditor?.view === view) {
          console.error('useLinkDecorations dispatch failed', {
            pluginKey: PLUGIN_KEY,
            editor,
            error,
          })
        }
      }
    }
  }, [editor, resolver, isViewerMode])
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
          const matches = findLinkRanges(newEditorState.doc)
          const oldOverlapping = matches.filter(
            (match) => oldState.selFrom <= match.to && oldState.selTo >= match.from,
          )
          const newOverlapping = matches.filter(
            (match) => selFrom <= match.to && selTo >= match.from,
          )
          const overlappingChanged = !linkRangesEqual(oldOverlapping, newOverlapping)

          if (overlappingChanged) {
            return createPluginState(newEditorState.doc, resolver, isViewerMode, selFrom, selTo)
          }
        }

        return {
          decorations: oldState.decorations.map(tr.mapping, tr.doc),
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
        isActive: !isViewerMode && match.from <= selTo && match.to >= selFrom,
      }),
    ),
    ...findMdLinks(doc, resolver).flatMap((match) =>
      buildMdLinkDecorationEntries(match, {
        isViewerMode,
        isActive: !isViewerMode && match.from <= selTo && match.to >= selFrom,
      }),
    ),
  ]

  return {
    decorations: DecorationSet.create(doc, decorations),
    selFrom,
    selTo,
  }
}

function findLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  return [...findWikiLinkRanges(doc), ...findMdLinkRanges(doc)]
}

function findWikiLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  const ranges: Array<LinkRange> = []
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    let match
    while ((match = regex.exec(node.text)) !== null) {
      ranges.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      })
    }
  })

  return ranges
}

function findMdLinkRanges(doc: ProseMirrorNode): Array<LinkRange> {
  const ranges: Array<LinkRange> = []
  const regex = new RegExp(MD_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!TEXT_BLOCK_TYPES.has(node.type.name)) return

    const nodeStart = pos
    const nodeEnd = pos + node.nodeSize
    const text = doc.textBetween(nodeStart, nodeEnd)
    if (!text) return

    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      ranges.push({
        from: nodeStart + 1 + match.index,
        to: nodeStart + 1 + match.index + match[0].length,
      })
    }
  })

  return ranges
}

function findWikiLinks(
  doc: ProseMirrorNode,
  resolver: LinkResolver,
): Array<WikiLinkDecorationMatch> {
  const matches: Array<WikiLinkDecorationMatch> = []
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    let match
    while ((match = regex.exec(node.text)) !== null) {
      const from = pos + match.index
      const to = pos + match.index + match[0].length
      const innerText = match[1]
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
      matches.push({ from, to, innerText, parsed, resolved })
    }
  })

  return matches
}

function findMdLinks(doc: ProseMirrorNode, resolver: LinkResolver): Array<MdLinkDecorationMatch> {
  const matches: Array<MdLinkDecorationMatch> = []
  const regex = new RegExp(MD_LINK_REGEX.source, 'g')

  doc.descendants((node, pos) => {
    if (!TEXT_BLOCK_TYPES.has(node.type.name)) return

    const nodeStart = pos
    const nodeEnd = pos + node.nodeSize
    const text = doc.textBetween(nodeStart, nodeEnd)
    if (!text) return

    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const from = nodeStart + 1 + match.index
      const to = nodeStart + 1 + match.index + match[0].length
      const displayText = match[1]
      const target = match[2]
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
      matches.push({ from, to, displayText, target, parsed, resolved })
    }
  })

  return matches
}
