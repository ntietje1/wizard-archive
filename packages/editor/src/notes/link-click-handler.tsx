import { useEffect, useReducer, useRef } from 'react'
import type { CustomBlockNoteEditor } from './editor-schema'
import { getLinkAt } from './links/hit-testing'
import { useEditorDomElement } from '../rich-text/blocknote/use-editor-dom-element'
import { CREATE_PARENT_TARGET_KIND } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { SidebarItemId } from '../../../../shared/common/ids'
import { toast } from 'sonner'
import type {
  LinkClickCreateItemArgs,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  OpenInternalLinkInput,
} from './runtime'

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

const HIDDEN_TOOLTIP: TooltipState = { show: false, text: '', x: 0, y: 0 }
type LinkAtPoint = NonNullable<ReturnType<typeof getLinkAt>>

function hasCreatableLinkTarget(
  link: ReturnType<typeof getLinkAt>,
): link is LinkAtPoint & { itemName: string } {
  return !!link?.itemName
}

function buildGhostCreateArgs(
  link: ReturnType<typeof getLinkAt>,
  sourceParentId: SidebarItemId | null | undefined,
): LinkClickCreateItemArgs | null {
  if (!hasCreatableLinkTarget(link)) {
    return null
  }

  return {
    type: RESOURCE_TYPES.notes,
    name: link.itemName,
    parentTarget: {
      kind: CREATE_PARENT_TARGET_KIND.path,
      baseParentId: link.pathKind === 'relative' ? (sourceParentId ?? null) : null,
      pathSegments: link.itemPath.slice(0, -1),
    },
  }
}

function getTooltipState(link: ReturnType<typeof getLinkAt>, text: string): TooltipState | null {
  if (!link) {
    return null
  }

  const rect = link.element.getBoundingClientRect()
  return {
    show: true,
    text,
    x: rect.left,
    y: rect.bottom + 4,
  }
}

function getGhostLinkFeedback({
  linkCreation,
  link,
  sourceParentId,
}: {
  linkCreation: NoteLinkCreationSource | null | undefined
  link: ReturnType<typeof getLinkAt>
  sourceParentId: SidebarItemId | null | undefined
}): { createArgs: LinkClickCreateItemArgs; tooltipText: string; isValid: boolean } | null {
  if (!linkCreation || !link || link.exists || link.type === 'md-external') {
    return null
  }

  const createArgs = buildGhostCreateArgs(link, sourceParentId)
  if (!createArgs) {
    return null
  }

  const validationResult = linkCreation.validateCreateItem(createArgs)
  return {
    createArgs,
    tooltipText: validationResult.valid
      ? `Click to create note: "${createArgs.name}"`
      : validationResult.error,
    isValid: validationResult.valid,
  }
}

function getHoverFeedback({
  linkCreation,
  link,
  editorMode,
  sourceParentId,
}: {
  linkCreation: NoteLinkCreationSource | null | undefined
  link: ReturnType<typeof getLinkAt>
  editorMode: 'editor' | 'viewer'
  sourceParentId: SidebarItemId | null | undefined
}): { tooltipText: string } | null {
  if (link?.status === 'rejected') {
    return { tooltipText: 'Blocked unsafe link' }
  }
  if (editorMode !== 'editor') {
    return null
  }

  if (link?.exists) {
    return { tooltipText: 'Click to open' }
  }

  return getGhostLinkFeedback({
    link,
    linkCreation,
    sourceParentId,
  })
}

function getLinkCreationKey(link: ReturnType<typeof getLinkAt>): string | null {
  if (!hasCreatableLinkTarget(link)) return null

  return `${link.pathKind}:${link.itemPath.join('/') || link.itemName}`
}

function stopLinkClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function handleExternalLinkClick({
  e,
  link,
  editorMode,
  isCtrlClick,
  openExternalLink,
}: {
  e: MouseEvent
  link: LinkAtPoint
  editorMode: 'editor' | 'viewer'
  isCtrlClick: boolean
  openExternalLink: (url: string) => unknown
}) {
  if (link.type !== 'md-external' || !link.href) return false
  if (editorMode === 'editor' && !isCtrlClick) return true

  stopLinkClick(e)
  void openExternalLink(link.href)
  return true
}

function handleExistingLinkClick({
  e,
  link,
  editorMode,
  isCtrlClick,
  openInternalLink,
  openInternalLinkSeparately,
}: {
  e: MouseEvent
  link: LinkAtPoint
  editorMode: 'editor' | 'viewer'
  isCtrlClick: boolean
  openInternalLink: (input: OpenInternalLinkInput) => unknown
  openInternalLinkSeparately: (input: OpenInternalLinkInput) => unknown
}) {
  if (!link.exists || link.type === 'md-external') return false
  if (!link.itemId) return false
  if (editorMode === 'editor' && !isCtrlClick) return true

  stopLinkClick(e)
  if (editorMode === 'viewer' && isCtrlClick) {
    void openInternalLinkSeparately({ itemId: link.itemId, heading: link.heading ?? undefined })
  } else {
    void openInternalLink({ itemId: link.itemId, heading: link.heading ?? undefined })
  }
  return true
}

function handleLinkNavigationMouseDown({
  e,
  editorMode,
  isCtrlClick,
  link,
  linkNavigation,
}: {
  e: MouseEvent
  editorMode: 'editor' | 'viewer'
  isCtrlClick: boolean
  link: LinkAtPoint
  linkNavigation: NoteLinkNavigationSource | null
}) {
  if (!linkNavigation) return false
  return (
    handleExternalLinkClick({
      e,
      link,
      editorMode,
      isCtrlClick,
      openExternalLink: linkNavigation.openExternalLink,
    }) ||
    handleExistingLinkClick({
      e,
      link,
      editorMode,
      isCtrlClick,
      openInternalLink: linkNavigation.openInternalLink,
      openInternalLinkSeparately: linkNavigation.openInternalLinkSeparately,
    })
  )
}

async function handleGhostLinkMouseDown({
  creatingLinks,
  e,
  editorMode,
  feedback,
  forceOpenLinkPopover,
  hideTooltip,
  isCtrlClick,
  link,
  linkCreation,
}: {
  creatingLinks: Set<string>
  e: MouseEvent
  editorMode: 'editor' | 'viewer'
  feedback: ReturnType<typeof getGhostLinkFeedback>
  forceOpenLinkPopover: (() => void) | undefined
  hideTooltip: () => void
  isCtrlClick: boolean
  link: LinkAtPoint
  linkCreation: NoteLinkCreationSource | null
}) {
  if (feedback && !isCtrlClick && editorMode === 'editor' && forceOpenLinkPopover) {
    requestAnimationFrame(forceOpenLinkPopover)
    return
  }
  if (!feedback || !isCtrlClick || !linkCreation) return

  stopLinkClick(e)
  hideTooltip()

  const creationKey = getLinkCreationKey(link)
  if (!creationKey || creatingLinks.has(creationKey) || !feedback.isValid) return

  creatingLinks.add(creationKey)
  try {
    await linkCreation.createLinkedNote(feedback.createArgs)
  } catch (error) {
    toast.error('Could not create note. Please try again.')
    console.error(error)
  } finally {
    creatingLinks.delete(creationKey)
  }
}

export function LinkClickHandlerSurface({
  editor,
  editorMode,
  forceOpenLinkPopover,
  linkCreation,
  linkNavigation,
  sourceParentId,
}: {
  editor: CustomBlockNoteEditor | undefined
  editorMode: 'editor' | 'viewer'
  forceOpenLinkPopover?: () => void
  linkCreation: NoteLinkCreationSource | null
  linkNavigation: NoteLinkNavigationSource | null
  sourceParentId: SidebarItemId | null | undefined
}) {
  const editorEl = useEditorDomElement(editor)

  const [tooltip, setTooltip] = useReducer(
    (_state: TooltipState, next: TooltipState) => next,
    HIDDEN_TOOLTIP,
  )
  const ctrlHeldRef = useRef(false)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const creatingLinksRef = useRef<Set<string> | null>(null)
  if (creatingLinksRef.current === null) {
    creatingLinksRef.current = new Set()
  }
  const tooltipActionsRef = useRef({
    hide: () => setTooltip(HIDDEN_TOOLTIP),
    showForPoint: (_x: number, _y: number) => {},
  })
  tooltipActionsRef.current = {
    hide: () => setTooltip(HIDDEN_TOOLTIP),
    showForPoint: (x: number, y: number) => {
      const link = getLinkAt(x, y)
      const feedback = getHoverFeedback({
        linkCreation,
        link,
        editorMode,
        sourceParentId,
      })
      const nextTooltip = feedback ? getTooltipState(link, feedback.tooltipText) : null
      setTooltip(nextTooltip ?? HIDDEN_TOOLTIP)
    },
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        ctrlHeldRef.current = true
        const mousePos = mousePosRef.current
        if (mousePos) {
          tooltipActionsRef.current.showForPoint(mousePos.x, mousePos.y)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        ctrlHeldRef.current = false
        tooltipActionsRef.current.hide()
      }
    }
    const onBlur = () => {
      ctrlHeldRef.current = false
      tooltipActionsRef.current.hide()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }

      if (!ctrlHeldRef.current) {
        tooltipActionsRef.current.hide()
        return
      }

      tooltipActionsRef.current.showForPoint(e.clientX, e.clientY)
    }

    const onMouseLeave = () => {
      mousePosRef.current = null
      tooltipActionsRef.current.hide()
    }

    editorEl.addEventListener('mousemove', onMouseMove)
    editorEl.addEventListener('mouseleave', onMouseLeave)
    return () => {
      editorEl.removeEventListener('mousemove', onMouseMove)
      editorEl.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [editorEl])

  useEffect(() => {
    if (!editorEl) return

    const onMouseDown = async (e: MouseEvent) => {
      if (e.button !== 0) return

      const link = getLinkAt(e.clientX, e.clientY)
      if (!link) return

      if (link.status === 'rejected') {
        stopLinkClick(e)
        return
      }

      const isCtrlClick = e.ctrlKey || e.metaKey

      if (handleLinkNavigationMouseDown({ e, link, editorMode, isCtrlClick, linkNavigation }))
        return

      const feedback = getGhostLinkFeedback({
        link,
        linkCreation,
        sourceParentId,
      })
      const creatingLinks = creatingLinksRef.current
      if (!creatingLinks) throw new Error('Link creation tracker was not initialized')
      await handleGhostLinkMouseDown({
        creatingLinks,
        e,
        editorMode,
        feedback,
        forceOpenLinkPopover,
        hideTooltip: () => setTooltip(HIDDEN_TOOLTIP),
        isCtrlClick,
        link,
        linkCreation,
      })
    }

    editorEl.addEventListener('mousedown', onMouseDown, true)
    return () => editorEl.removeEventListener('mousedown', onMouseDown, true)
  }, [editorEl, editorMode, forceOpenLinkPopover, linkCreation, linkNavigation, sourceParentId])

  return (
    <>
      {tooltip.show && (
        <div
          className="wiki-link-tooltip z-50"
          style={{
            position: 'fixed',
            top: tooltip.y,
            left: tooltip.x,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
