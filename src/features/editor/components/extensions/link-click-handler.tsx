import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import { handleError } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { getLinkAt } from '~/features/editor/utils/link-hit-testing'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { CREATE_PARENT_TARGET_KIND } from 'convex/sidebarItems/validation/parent'
import type { CreateItemArgs } from '~/features/sidebar/hooks/useCreateSidebarItem'
import type { ValidationResult } from 'convex/sidebarItems/validation/name'

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
    campaignId,
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
  const { createItem, validateCreateItem } = useCreateSidebarItem()
  const { itemsMap } = useActiveSidebarItems()
  const editorEl = useEditorDomElement(editor)
  const sourceParentId = sourceNoteId ? itemsMap.get(sourceNoteId)?.parentId : undefined

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const creatingLinksRef = useRef(new Set<string>())

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
        const mousePos = mousePosRef.current
        if (mousePos) {
          const link = getLinkAt(mousePos.x, mousePos.y)
          const feedback = getHoverFeedback({
            link,
            editorMode,
            campaignId: campaignData?._id,
            sourceParentId,
            validateCreateItem,
          })
          const nextTooltip = feedback ? getTooltipState(link, feedback.tooltipText) : null
          setTooltip(nextTooltip ?? HIDDEN_TOOLTIP)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(false)
        setTooltip(HIDDEN_TOOLTIP)
      }
    }
    const onBlur = () => {
      setCtrlHeld(false)
      setTooltip(HIDDEN_TOOLTIP)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [campaignData?._id, editorMode, sourceParentId, validateCreateItem])

  useEffect(() => {
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }

      const link = getLinkAt(e.clientX, e.clientY)
      if (!ctrlHeld) {
        setTooltip(HIDDEN_TOOLTIP)
        return
      }

      const feedback = getHoverFeedback({
        link,
        editorMode,
        campaignId: campaignData?._id,
        sourceParentId,
        validateCreateItem,
      })
      const nextTooltip = feedback ? getTooltipState(link, feedback.tooltipText) : null
      setTooltip(nextTooltip ?? HIDDEN_TOOLTIP)
    }

    const onMouseLeave = () => {
      mousePosRef.current = null
      setTooltip(HIDDEN_TOOLTIP)
    }

    editorEl.addEventListener('mousemove', onMouseMove)
    editorEl.addEventListener('mouseleave', onMouseLeave)
    return () => {
      editorEl.removeEventListener('mousemove', onMouseMove)
      editorEl.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [campaignData?._id, ctrlHeld, editorEl, editorMode, sourceParentId, validateCreateItem])

  useEffect(() => {
    if (!editorEl) return

    const onMouseDown = async (e: MouseEvent) => {
      const link = getLinkAt(e.clientX, e.clientY)
      if (!link) return

      const isCtrlClick = e.ctrlKey || e.metaKey

      if (link.type === 'md-external' && link.href) {
        if (editorMode === 'editor' && !isCtrlClick) return
        e.preventDefault()
        e.stopPropagation()
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return
      }

      if (link.exists && link.href) {
        const url = new URL(link.href, window.location.origin)
        const searchParams: Record<string, string> = {}
        url.searchParams.forEach((v, k) => {
          searchParams[k] = v
        })
        if (link.heading) searchParams.heading = link.heading

        if (editorMode === 'editor') {
          if (!isCtrlClick) return
          e.preventDefault()
          e.stopPropagation()
          void navigate({ to: url.pathname, search: searchParams })
        } else {
          e.preventDefault()
          e.stopPropagation()
          if (isCtrlClick) {
            if (link.heading) url.searchParams.set('heading', link.heading)
            window.open(url.toString(), '_blank', 'noopener,noreferrer')
          } else {
            void navigate({ to: url.pathname, search: searchParams })
          }
        }
        return
      }

      const feedback = getGhostLinkFeedback({
        link,
        campaignId: campaignData?._id,
        sourceParentId,
        validateCreateItem,
      })
      if (feedback && isCtrlClick) {
        e.preventDefault()
        e.stopPropagation()
        setTooltip(HIDDEN_TOOLTIP)

        const creationKey = getLinkCreationKey(link)
        if (!creationKey || creatingLinksRef.current.has(creationKey)) return
        if (!feedback.isValid) return

        creatingLinksRef.current.add(creationKey)
        try {
          const result = await createItem(feedback.createArgs)
          if (result) void navigateToItem(result.slug)
        } catch (error) {
          handleError(error, 'Failed to create note')
        } finally {
          creatingLinksRef.current.delete(creationKey)
        }
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
          className="wiki-link-tooltip"
          style={{
            position: 'fixed',
            top: tooltip.y,
            left: tooltip.x,
            zIndex: 9999,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
