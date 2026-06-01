import { useEffect, useReducer, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import { handleError } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { getLinkAt } from '~/features/editor/utils/link-hit-testing'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { CREATE_PARENT_TARGET_KIND } from 'shared/sidebar-items/parent-target'
import type { CreateItemArgs } from '~/features/filesystem/useCreateFileSystemItem'
import type { ValidationResult } from 'shared/sidebar-items/name'

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
  campaignId: Id<'campaigns'> | undefined,
  sourceParentId: Id<'sidebarItems'> | null | undefined,
): CreateItemArgs | null {
  if (!campaignId || !hasCreatableLinkTarget(link)) {
    return null
  }

  return {
    type: SIDEBAR_ITEM_TYPES.notes,
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
  link,
  campaignId,
  sourceParentId,
  validateCreateItem,
}: {
  link: ReturnType<typeof getLinkAt>
  campaignId: Id<'campaigns'> | undefined
  sourceParentId: Id<'sidebarItems'> | null | undefined
  validateCreateItem: (args: CreateItemArgs) => ValidationResult
}): { createArgs: CreateItemArgs; tooltipText: string; isValid: boolean } | null {
  if (!link || link.exists || link.type === 'md-external') {
    return null
  }

  const createArgs = buildGhostCreateArgs(link, campaignId, sourceParentId)
  if (!createArgs) {
    return null
  }

  const validationResult = validateCreateItem(createArgs)
  return {
    createArgs,
    tooltipText: validationResult.valid
      ? `Click to create note: "${createArgs.name}"`
      : validationResult.error,
    isValid: validationResult.valid,
  }
}

function getHoverFeedback({
  link,
  editorMode,
  campaignId,
  sourceParentId,
  validateCreateItem,
}: {
  link: ReturnType<typeof getLinkAt>
  editorMode: 'editor' | 'viewer'
  campaignId: Id<'campaigns'> | undefined
  sourceParentId: Id<'sidebarItems'> | null | undefined
  validateCreateItem: (args: CreateItemArgs) => ValidationResult
}): { tooltipText: string } | null {
  if (editorMode !== 'editor') {
    return null
  }

  if (link?.exists) {
    return { tooltipText: 'Click to open' }
  }

  return getGhostLinkFeedback({
    link,
    campaignId,
    sourceParentId,
    validateCreateItem,
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

function getInternalLinkNavigation(link: LinkAtPoint & { href: string }) {
  const url = new URL(link.href, window.location.origin)
  const search: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    search[key] = value
  })
  if (link.heading) search.heading = link.heading
  return { url, search }
}

function handleExternalLinkClick({
  e,
  link,
  editorMode,
  isCtrlClick,
}: {
  e: MouseEvent
  link: LinkAtPoint
  editorMode: 'editor' | 'viewer'
  isCtrlClick: boolean
}) {
  if (link.type !== 'md-external' || !link.href) return false
  if (editorMode === 'editor' && !isCtrlClick) return true

  stopLinkClick(e)
  window.open(link.href, '_blank', 'noopener,noreferrer')
  return true
}

function handleExistingLinkClick({
  e,
  link,
  editorMode,
  isCtrlClick,
  navigate,
}: {
  e: MouseEvent
  link: LinkAtPoint
  editorMode: 'editor' | 'viewer'
  isCtrlClick: boolean
  navigate: (args: { to: string; search: Record<string, string> }) => unknown
}) {
  if (!link.exists || !link.href) return false
  if (editorMode === 'editor' && !isCtrlClick) return true

  stopLinkClick(e)
  const { url, search } = getInternalLinkNavigation(link as LinkAtPoint & { href: string })
  if (editorMode === 'viewer' && isCtrlClick) {
    if (link.heading) url.searchParams.set('heading', link.heading)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  } else {
    void navigate({ to: url.pathname, search })
  }
  return true
}

export function LinkClickHandler({
  editor,
  sourceNoteId,
}: {
  editor: CustomBlockNoteEditor | undefined
  sourceNoteId?: Id<'sidebarItems'>
}) {
  const navigate = useNavigate()
  const { navigateToItem } = useEditorNavigation()
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const { editorMode } = useEditorMode()
  const { createItem, validateCreateItem } = useCreateFileSystemItem()
  const { itemsMap } = useActiveSidebarItems()
  const editorEl = useEditorDomElement(editor)
  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined

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
        link,
        editorMode,
        campaignId: campaignData?._id,
        sourceParentId,
        validateCreateItem,
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
      const link = getLinkAt(e.clientX, e.clientY)
      if (!link) return

      const isCtrlClick = e.ctrlKey || e.metaKey

      if (handleExternalLinkClick({ e, link, editorMode, isCtrlClick })) return
      if (handleExistingLinkClick({ e, link, editorMode, isCtrlClick, navigate })) return

      const feedback = getGhostLinkFeedback({
        link,
        campaignId: campaignData?._id,
        sourceParentId,
        validateCreateItem,
      })
      if (!feedback || !isCtrlClick) {
        return
      }

      stopLinkClick(e)
      setTooltip(HIDDEN_TOOLTIP)

      const creationKey = getLinkCreationKey(link)
      const creatingLinks = creatingLinksRef.current
      if (!creatingLinks) throw new Error('Link creation tracker was not initialized')
      if (!creationKey || creatingLinks.has(creationKey)) return
      if (!feedback.isValid) return

      creatingLinks.add(creationKey)
      try {
        const result = await createItem(feedback.createArgs)
        if (result) void navigateToItem(result.slug)
      } catch (error) {
        handleError(error, 'Failed to create note')
      } finally {
        creatingLinks.delete(creationKey)
      }
    }

    editorEl.addEventListener('mousedown', onMouseDown, true)
    return () => editorEl.removeEventListener('mousedown', onMouseDown, true)
  }, [
    campaignData?._id,
    createItem,
    validateCreateItem,
    editorEl,
    editorMode,
    navigate,
    navigateToItem,
    sourceParentId,
  ])

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
