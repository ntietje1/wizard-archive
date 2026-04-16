import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { handleError } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { getLinkAt } from '~/features/editor/utils/link-hit-testing'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

const HIDDEN_TOOLTIP: TooltipState = { show: false, text: '', x: 0, y: 0 }

function getTooltipState(link: ReturnType<typeof getLinkAt>): TooltipState | null {
  if (!link || link.type === 'md-external' || link.exists || !link.itemName) {
    return null
  }

  const rect = link.element.getBoundingClientRect()
  return {
    show: true,
    text: link.itemName,
    x: rect.left,
    y: rect.bottom + 4,
  }
}

export function LinkClickHandler({ editor }: { editor: CustomBlockNoteEditor | undefined }) {
  const navigate = useNavigate()
  const { navigateToItem } = useEditorNavigation()
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const { editorMode } = useEditorMode()
  const { createItem } = useCreateSidebarItem()
  const editorEl = useEditorDomElement(editor)

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const isCreatingRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
        const mousePos = mousePosRef.current
        if (mousePos) {
          const link = getLinkAt(mousePos.x, mousePos.y)
          const nextTooltip = getTooltipState(link)
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
  }, [])

  useEffect(() => {
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }

      const link = getLinkAt(e.clientX, e.clientY)
      if (!ctrlHeld) {
        setTooltip(HIDDEN_TOOLTIP)
        return
      }

      const nextTooltip = getTooltipState(link)
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
  }, [ctrlHeld, editorEl])

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

      if (!link.exists && isCtrlClick && link.itemName && campaignData?._id) {
        e.preventDefault()
        e.stopPropagation()
        setTooltip(HIDDEN_TOOLTIP)

        if (isCreatingRef.current) return

        isCreatingRef.current = true
        try {
          const result = await createItem({
            campaignId: campaignData._id,
            type: SIDEBAR_ITEM_TYPES.notes,
            name: link.itemName,
            parentId: null,
            parentPath: link.itemPath.slice(0, -1),
          })
          if (result) void navigateToItem(result.slug)
        } catch (error) {
          handleError(error, 'Failed to create note')
        } finally {
          isCreatingRef.current = false
        }
      }
    }

    editorEl.addEventListener('mousedown', onMouseDown, true)
    return () => editorEl.removeEventListener('mousedown', onMouseDown, true)
  }, [campaignData?._id, createItem, editorEl, editorMode, navigate, navigateToItem])

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
          {`Click to create note: "${tooltip.text}"`}
        </div>
      )}
    </>
  )
}
