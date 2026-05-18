import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { getWikiLinkContext, splitWikiLinkTargetAndDisplayName } from './wiki-link-utils'
import {
  buildContinuedFolderPathText,
  buildContinuedFileLinkText,
  buildContinuedHeadingLinkText,
  buildInsertedFileLinkText,
  buildInsertedHeadingLinkText,
  buildWikiLinkAutocompleteModel,
  getWikiLinkAutocompleteContext,
} from './wiki-link-autocomplete-model'
import type {
  ActiveAutocompleteModel,
  AutocompleteContext,
  FileAutocompleteContext,
  FileSuggestion,
  HeadingAutocompleteContext,
  HeadingSuggestion,
} from './wiki-link-autocomplete-model'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { SearchResultItem } from '~/features/search/components/search-result-item'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'

interface MenuState {
  show: boolean
  query: string
  pos: DOMRect | null
}

function menuFromWikiContext(
  query: string,
  startPos: number,
  tiptap: CustomBlockNoteEditor['_tiptapEditor'],
  preservedDisplayNameRef: React.RefObject<string | null>,
) {
  const coords = tiptap?.view?.coordsAtPos(startPos)
  const pos = coords ? new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top) : null

  if (preservedDisplayNameRef.current === null) {
    return { show: true, query, pos }
  }

  const { targetQuery, displayName } = splitWikiLinkTargetAndDisplayName(query)
  if (displayName !== null) preservedDisplayNameRef.current = displayName
  return { show: true, query: targetQuery, pos }
}

function useResetSelectedIndex(
  context: AutocompleteContext | null,
  setSelectedIndex: (index: number) => void,
) {
  const resetKey =
    context?.mode === 'heading'
      ? `heading\u001f${context.completedHeadingPath.join('#')}`
      : context?.mode === 'file'
        ? `file\u001f${context.completedFolderPath.join('/')}`
        : (context?.mode ?? '')
  const prevResetKeyRef = useRef(resetKey)

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return
    prevResetKeyRef.current = resetKey
    setSelectedIndex(0)
  }, [resetKey, setSelectedIndex])
}

function useAutocompleteTransactions({
  editor,
  editorEl,
  hasEditedRef,
  isDraggingRef,
  preservedDisplayNameRef,
  setMenu,
}: {
  editor: CustomBlockNoteEditor | undefined
  editorEl: HTMLElement | null
  hasEditedRef: React.RefObject<boolean>
  isDraggingRef: React.RefObject<boolean>
  preservedDisplayNameRef: React.RefObject<string | null>
  setMenu: (menu: MenuState) => void
}) {
  useEffect(() => {
    if (!editorEl) return
    const onDown = () => {
      isDraggingRef.current = true
      preservedDisplayNameRef.current = null
      setMenu({ show: false, query: '', pos: null })
    }
    const onUp = () => {
      isDraggingRef.current = false
    }
    editorEl.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup', onUp)
    return () => {
      editorEl.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
    }
  }, [editorEl, isDraggingRef, preservedDisplayNameRef, setMenu])

  useEffect(() => {
    const tiptap = editor?._tiptapEditor
    if (!tiptap) return

    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (isDraggingRef.current) return
      const ctx = getWikiLinkContext(editor)
      if (!ctx) {
        hasEditedRef.current = false
        preservedDisplayNameRef.current = null
        setMenu({ show: false, query: '', pos: null })
        return
      }

      if (transaction.docChanged) hasEditedRef.current = true
      if (!hasEditedRef.current) return
      setMenu(menuFromWikiContext(ctx.query, ctx.startPos, tiptap, preservedDisplayNameRef))
    }

    tiptap.on('transaction', onTransaction)
    return () => {
      tiptap.off('transaction', onTransaction)
    }
  }, [editor, hasEditedRef, isDraggingRef, preservedDisplayNameRef, setMenu])
}

function useForceOpenAutocomplete({
  editor,
  hasEditedRef,
  preservedDisplayNameRef,
  setMenu,
}: {
  editor: CustomBlockNoteEditor | undefined
  hasEditedRef: React.RefObject<boolean>
  preservedDisplayNameRef: React.RefObject<string | null>
  setMenu: (menu: MenuState) => void
}) {
  return useCallback(() => {
    if (!editor) return
    const tiptap = editor._tiptapEditor
    if (!tiptap) return
    const ctx = getWikiLinkContext(editor)
    if (!ctx) return

    const { targetQuery, displayName } = splitWikiLinkTargetAndDisplayName(ctx.query)
    const coords = tiptap.view?.coordsAtPos(ctx.startPos)
    const pos = coords ? new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top) : null

    hasEditedRef.current = true
    preservedDisplayNameRef.current = displayName
    setMenu({
      show: true,
      query: ctx.query.includes('|') ? targetQuery : ctx.query,
      pos,
    })
  }, [editor, hasEditedRef, preservedDisplayNameRef, setMenu])
}

function useClosedMenuEnterShortcut({
  editor,
  editorEl,
  forceOpen,
  menuShowing,
}: {
  editor: CustomBlockNoteEditor | undefined
  editorEl: HTMLElement | null
  forceOpen: () => void
  menuShowing: boolean
}) {
  useEffect(() => {
    if (!editor || !editorEl || menuShowing) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      const ctx = getWikiLinkContext(editor)
      if (!ctx) return
      event.preventDefault()
      event.stopPropagation()
      forceOpen()
    }

    editorEl.addEventListener('keydown', onKeyDown, true)
    return () => editorEl.removeEventListener('keydown', onKeyDown, true)
  }, [editor, editorEl, menuShowing, forceOpen])
}

function useAutocompleteKeyboard({
  closeMenu,
  continueFileLink,
  continueFolderPath,
  continueHeadingLink,
  editorEl,
  insertFileLink,
  insertHeadingLink,
  menuShowing,
  selectedIndex,
  setSelectedIndex,
  model,
}: {
  closeMenu: () => void
  model: ActiveAutocompleteModel | null
  continueFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  continueFolderPath: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  continueHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void
  editorEl: HTMLElement | null
  insertFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  insertHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void
  menuShowing: boolean
  selectedIndex: number
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
}) {
  useEffect(() => {
    if (!editorEl || !menuShowing || !model) return

    const onKeyDown = (event: KeyboardEvent) => {
      const len = model.suggestions.length || 1
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((index) => (index + 1) % len)
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex((index) => (index - 1 + len) % len)
          break
        case 'Enter':
          event.preventDefault()
          insertSelectedSuggestion(model, selectedIndex, insertFileLink, insertHeadingLink)
          break
        case 'Tab':
          event.preventDefault()
          continueSelectedSuggestion(
            model,
            selectedIndex,
            insertFileLink,
            continueFileLink,
            continueHeadingLink,
            continueFolderPath,
            closeMenu,
          )
          break
        case 'Escape':
          event.preventDefault()
          closeMenu()
          break
      }
    }

    editorEl.addEventListener('keydown', onKeyDown, true)
    return () => editorEl.removeEventListener('keydown', onKeyDown, true)
  }, [
    closeMenu,
    continueFileLink,
    continueFolderPath,
    continueHeadingLink,
    editorEl,
    insertFileLink,
    insertHeadingLink,
    menuShowing,
    model,
    selectedIndex,
    setSelectedIndex,
  ])
}

function insertSelectedSuggestion(
  model: ActiveAutocompleteModel,
  selectedIndex: number,
  insertFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void,
  insertHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void,
) {
  if (model.mode === 'file') {
    const suggestion = model.suggestions[selectedIndex]
    if (suggestion) insertFileLink(suggestion, model.context)
    return
  }

  const suggestion = model.suggestions[selectedIndex]
  if (suggestion) insertHeadingLink(suggestion, model.context)
}

function continueSelectedSuggestion(
  model: ActiveAutocompleteModel,
  selectedIndex: number,
  insertFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void,
  continueFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void,
  continueHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void,
  continueFolderPath: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void,
  closeMenu: () => void,
) {
  if (model.mode === 'heading') {
    const suggestion = model.suggestions[selectedIndex]
    if (!suggestion) {
      closeMenu()
      return
    }
    continueHeadingLink(suggestion, model.context)
    return
  }

  const suggestion = model.suggestions[selectedIndex]
  if (!suggestion) {
    closeMenu()
    return
  }

  if (suggestion.item.type === SIDEBAR_ITEM_TYPES.notes) {
    continueFileLink(suggestion, model.context)
  } else if (suggestion.item.type === SIDEBAR_ITEM_TYPES.folders) {
    continueFolderPath(suggestion, model.context)
  } else {
    insertFileLink(suggestion, model.context)
  }
}

export function WikiLinkAutocomplete({
  editor,
  onForceOpenRef,
  sourceNoteId,
}: {
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: React.RefObject<(() => void) | null>
  sourceNoteId?: Id<'sidebarItems'>
}) {
  const { data: sidebarItems, itemsMap } = useFilteredSidebarItems()
  const editorEl = useEditorDomElement(editor)

  const [menu, setMenu] = useState<MenuState>({
    show: false,
    query: '',
    pos: null,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const hasEditedRef = useRef(false)
  const isDraggingRef = useRef(false)
  const preservedDisplayNameRef = useRef<string | null>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)

  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined
  const context = menu.show
    ? getWikiLinkAutocompleteContext(menu.query, sidebarItems, itemsMap, sourceParentId)
    : null

  const headingsQuery = useCampaignQuery(
    api.blocks.queries.getHeadingsByNote,
    context?.mode === 'heading' ? { noteId: context.resolvedItem._id } : 'skip',
  )
  const model = buildWikiLinkAutocompleteModel({
    context,
    sidebarItems,
    itemsMap,
    headings: headingsQuery.data ?? [],
  })

  useResetSelectedIndex(context, setSelectedIndex)

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useAutocompleteTransactions({
    editor,
    editorEl,
    hasEditedRef,
    isDraggingRef,
    preservedDisplayNameRef,
    setMenu,
  })

  const forceOpen = useForceOpenAutocomplete({
    editor,
    hasEditedRef,
    preservedDisplayNameRef,
    setMenu,
  })

  useEffect(() => {
    if (onForceOpenRef) onForceOpenRef.current = forceOpen
    return () => {
      if (onForceOpenRef) onForceOpenRef.current = null
    }
  }, [onForceOpenRef, forceOpen])

  useClosedMenuEnterShortcut({ editor, editorEl, forceOpen, menuShowing: menu.show })

  const closeMenu = useCallback(() => {
    preservedDisplayNameRef.current = null
    setMenu({ show: false, query: '', pos: null })
  }, [])

  const replaceActiveWikiLink = useCallback(
    (linkText: string) => {
      if (!editor) return
      const wikiCtx = getWikiLinkContext(editor)
      const tiptap = editor._tiptapEditor
      if (!wikiCtx || !tiptap) return

      tiptap
        .chain()
        .focus()
        .insertContentAt({ from: wikiCtx.startPos, to: wikiCtx.endPos }, linkText)
        .run()
    },
    [editor],
  )

  const insertFileLink = useCallback(
    (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => {
      replaceActiveWikiLink(
        `[[${buildInsertedFileLinkText(suggestion, ctx, preservedDisplayNameRef.current)}]]`,
      )
      closeMenu()
    },
    [closeMenu, replaceActiveWikiLink],
  )

  const insertHeadingLink = useCallback(
    (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => {
      replaceActiveWikiLink(
        `[[${buildInsertedHeadingLinkText(suggestion, ctx, preservedDisplayNameRef.current)}]]`,
      )
      closeMenu()
    },
    [closeMenu, replaceActiveWikiLink],
  )

  const continueFileLink = useCallback(
    (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => {
      replaceActiveWikiLink(`[[${buildContinuedFileLinkText(suggestion, ctx)}#`)
    },
    [replaceActiveWikiLink],
  )

  const continueHeadingLink = useCallback(
    (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => {
      replaceActiveWikiLink(`[[${buildContinuedHeadingLinkText(suggestion, ctx)}#`)
    },
    [replaceActiveWikiLink],
  )

  const continueFolderPath = useCallback(
    (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => {
      replaceActiveWikiLink(`[[${buildContinuedFolderPathText(suggestion, ctx)}`)
    },
    [replaceActiveWikiLink],
  )

  const activeModel = model.mode === 'empty' ? null : model

  useAutocompleteKeyboard({
    closeMenu,
    continueFileLink,
    continueFolderPath,
    continueHeadingLink,
    editorEl,
    insertFileLink,
    insertHeadingLink,
    menuShowing: menu.show,
    model: activeModel,
    selectedIndex,
    setSelectedIndex,
  })

  if (!editor || !menu.show || !menu.pos || model.mode === 'empty') return null

  return (
    <AutocompleteMenu
      headingsPending={model.mode === 'heading' && headingsQuery.isPending}
      insertFileLink={insertFileLink}
      insertHeadingLink={insertHeadingLink}
      menuPos={menu.pos}
      model={model}
      selectedIndex={selectedIndex}
      selectedItemRef={selectedItemRef}
      setSelectedIndex={setSelectedIndex}
    />
  )
}

function AutocompleteMenu({
  headingsPending,
  insertFileLink,
  insertHeadingLink,
  menuPos,
  model,
  selectedIndex,
  selectedItemRef,
  setSelectedIndex,
}: {
  headingsPending: boolean
  insertFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  insertHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void
  menuPos: DOMRect
  model: ActiveAutocompleteModel
  selectedIndex: number
  selectedItemRef: React.RefObject<HTMLDivElement | null>
  setSelectedIndex: (index: number) => void
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: menuPos.left,
        top: menuPos.bottom + 4,
        zIndex: 40,
      }}
    >
      <div className="w-[340px] max-w-[90vw] max-h-80 flex flex-col bg-popover text-popover-foreground rounded-lg shadow-md border border-border text-[13px] overflow-hidden">
        <HeadingHeader model={model} />
        <ScrollArea className="flex-1 max-h-[calc(320px-32px)]">
          {headingsPending ? (
            <EmptyState>Loading headings…</EmptyState>
          ) : model.suggestions.length === 0 ? (
            <EmptyState>
              {model.mode === 'heading' ? 'No headings found' : 'No matches found'}
            </EmptyState>
          ) : (
            <SuggestionsList
              insertFileLink={insertFileLink}
              insertHeadingLink={insertHeadingLink}
              model={model}
              selectedIndex={selectedIndex}
              selectedItemRef={selectedItemRef}
              setSelectedIndex={setSelectedIndex}
            />
          )}
        </ScrollArea>
        <AutocompleteFooter truncatedCount={model.totalCount - model.suggestions.length} />
      </div>
    </div>,
    document.body,
  )
}

function HeadingHeader({ model }: { model: ActiveAutocompleteModel }) {
  if (model.mode !== 'heading') return null
  const { context } = model

  return (
    <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border/50 truncate">
      Headings in &ldquo;{context.resolvedItem.name}&rdquo;
      {context.completedHeadingPath.length > 0 && (
        <span className="text-muted-foreground/70">
          {' '}
          &gt; {context.completedHeadingPath.join(' > ')}
        </span>
      )}
    </div>
  )
}

function SuggestionsList({
  insertFileLink,
  insertHeadingLink,
  model,
  selectedIndex,
  selectedItemRef,
  setSelectedIndex,
}: {
  insertFileLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  insertHeadingLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void
  model: ActiveAutocompleteModel
  selectedIndex: number
  selectedItemRef: React.RefObject<HTMLDivElement | null>
  setSelectedIndex: (index: number) => void
}) {
  if (model.mode === 'heading') {
    return (
      <div className="p-0.5" role="listbox">
        {model.suggestions.map((suggestion, index) => (
          <HeadingItem
            key={suggestion.key}
            context={model.context}
            index={index}
            insertLink={insertHeadingLink}
            selectedIndex={selectedIndex}
            selectedItemRef={selectedItemRef}
            setSelectedIndex={setSelectedIndex}
            suggestion={suggestion}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="p-0.5" role="listbox">
      {model.suggestions.map((suggestion, index) => (
        <FileItem
          key={suggestion.key}
          context={model.context}
          index={index}
          insertLink={insertFileLink}
          selectedIndex={selectedIndex}
          selectedItemRef={selectedItemRef}
          setSelectedIndex={setSelectedIndex}
          suggestion={suggestion}
        />
      ))}
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-3 text-center text-xs text-muted-foreground">{children}</div>
}

function HeadingItem({
  context,
  index,
  insertLink,
  selectedIndex,
  selectedItemRef,
  setSelectedIndex,
  suggestion,
}: {
  context: HeadingAutocompleteContext
  index: number
  insertLink: (suggestion: HeadingSuggestion, ctx: HeadingAutocompleteContext) => void
  selectedIndex: number
  selectedItemRef: React.RefObject<HTMLDivElement | null>
  setSelectedIndex: (index: number) => void
  suggestion: HeadingSuggestion
}) {
  return (
    <div
      ref={index === selectedIndex ? selectedItemRef : undefined}
      role="option"
      aria-selected={index === selectedIndex}
      tabIndex={-1}
      onClick={() => insertLink(suggestion, context)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') insertLink(suggestion, context)
      }}
      onMouseEnter={() => setSelectedIndex(index)}
      className={`flex items-center justify-between gap-2 px-2 py-1 rounded-sm cursor-default select-none ${
        index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      }`}
    >
      <span
        className="font-medium truncate"
        style={{ paddingLeft: `${(suggestion.level - 1) * 12}px` }}
      >
        {'#'.repeat(suggestion.level)} {suggestion.title}
      </span>
      <span className="shrink-0 h-4 px-1.5 text-[10px] font-medium rounded-sm bg-muted text-muted-foreground border border-border inline-flex items-center">
        H{suggestion.level}
      </span>
    </div>
  )
}

function FileItem({
  context,
  index,
  insertLink,
  selectedIndex,
  selectedItemRef,
  setSelectedIndex,
  suggestion,
}: {
  context: FileAutocompleteContext
  index: number
  insertLink: (suggestion: FileSuggestion, ctx: FileAutocompleteContext) => void
  selectedIndex: number
  selectedItemRef: React.RefObject<HTMLDivElement | null>
  setSelectedIndex: (index: number) => void
  suggestion: FileSuggestion
}) {
  return (
    <div ref={index === selectedIndex ? selectedItemRef : undefined}>
      <SearchResultItem
        id={suggestion.key}
        icon={getSidebarItemIcon(suggestion.item)}
        title={suggestion.title}
        subtitle={suggestion.subtext || undefined}
        badge={suggestion.badge}
        isSelected={index === selectedIndex}
        onClick={() => insertLink(suggestion, context)}
        onMouseEnter={() => setSelectedIndex(index)}
      />
    </div>
  )
}

function AutocompleteFooter({ truncatedCount }: { truncatedCount: number }) {
  return (
    <div className="flex items-center justify-evenly gap-3 px-2 py-1 text-[10px] text-muted-foreground border-t border-border/50">
      {truncatedCount > 0 && <span>+{truncatedCount} more</span>}
      <span>↑↓ navigate</span>
      <span>↵ select</span>
      <span>tab continue</span>
      <span>esc close</span>
    </div>
  )
}
