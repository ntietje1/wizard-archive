import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { validateSidebarItemName } from '~/features/sidebar/utils/sidebar-validation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

const HIDDEN_TOOLTIP: TooltipState = { show: false, text: '', x: 0, y: 0 }

function parseLinkElement(linkEl: Element) {
  return {
    element: linkEl,
    exists: linkEl.getAttribute('data-link-exists') === 'true',
    itemName: linkEl.getAttribute('data-link-item-name'),
    href: linkEl.getAttribute('data-link-href'),
    heading: linkEl.getAttribute('data-link-heading'),
    type: linkEl.getAttribute('data-link-type') as 'wiki' | 'md-internal' | 'md-external' | null,
  }
}

function getLinkAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)
  const linkEl = el?.closest('.wiki-link-content') || el?.closest('.md-link-display')
  return linkEl ? parseLinkElement(linkEl) : null
}

export function LinkClickHandler({ editor }: { editor: CustomBlockNoteEditor | undefined }) {
  const navigate = useNavigate()
  const { navigateToItem } = useEditorNavigation()
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const { editorMode } = useEditorMode()
  const { parentItemsMap } = useActiveSidebarItems()
  const editorEl = useEditorDomElement(editor)

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const isCreatingRef = useRef(false)

  const { mutateAsync: createNote } = useAppMutation(api.notes.mutations.createNote)

  const hideTooltip = useCallback(() => setTooltip(HIDDEN_TOOLTIP), [])

  const showTooltipFor = useCallback((link: ReturnType<typeof getLinkAt>) => {
    if (!link) return
    if (link.type === 'md-external') return

    const isGhost = !link.exists
    if (!isGhost) return
    if (!link.itemName) return

    const rect = link.element.getBoundingClientRect()
    setTooltip({
      show: true,
      text: link.itemName!,
      x: rect.left,
      y: rect.bottom + 4,
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
        if (mousePos) {
          const link = getLinkAt(mousePos.x, mousePos.y)
          if (link && !link.exists) {
            showTooltipFor(link)
          }
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(false)
        hideTooltip()
      }
    }
    const onBlur = () => {
      setCtrlHeld(false)
      hideTooltip()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [hideTooltip, mousePos, showTooltipFor])

  useEffect(() => {
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })

      const link = getLinkAt(e.clientX, e.clientY)
      if (!ctrlHeld || !link || link.exists) {
        hideTooltip()
        return
      }
      showTooltipFor(link)
    }

    const onMouseLeave = () => {
      setMousePos(null)
      hideTooltip()
    }

    editorEl.addEventListener('mousemove', onMouseMove)
    editorEl.addEventListener('mouseleave', onMouseLeave)
    return () => {
      editorEl.removeEventListener('mousemove', onMouseMove)
      editorEl.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [editorEl, ctrlHeld, hideTooltip, showTooltipFor])

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
        hideTooltip()

        if (isCreatingRef.current) return

        const validation = validateSidebarItemName({
          name: link.itemName,
          siblings: parentItemsMap.get(null),
        })
        if (!validation.valid) {
          toast.error(validation.error)
          return
        }
        isCreatingRef.current = true
        try {
          const result = await createNote({
            campaignId: campaignData._id,
            name: link.itemName,
            parentId: null,
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
  }, [
    editorEl,
    editor,
    navigate,
    campaignData?._id,
    createNote,
    navigateToItem,
    editorMode,
    parentItemsMap,
    hideTooltip,
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
          {`Click to create "${tooltip.text}"`}
        </div>
      )}
    </>
  )
}
