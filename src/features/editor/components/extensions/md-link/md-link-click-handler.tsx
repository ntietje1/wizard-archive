import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { logger } from '~/shared/utils/logger'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'
import { validateSidebarItemName } from '~/features/sidebar/utils/sidebar-validation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import './md-link.css'

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

const HIDDEN_TOOLTIP: TooltipState = { show: false, text: '', x: 0, y: 0 }

/** Extract markdown link data from an element at a position */
function getMdLinkAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)
  const displayEl = el?.closest('.md-link-display')

  if (!displayEl) return null
  return {
    element: displayEl,
    type: displayEl.getAttribute('data-md-link-type') as
      | 'external'
      | 'internal'
      | null,
    exists: displayEl.getAttribute('data-md-link-exists') === 'true',
    itemName: displayEl.getAttribute('data-md-link-item-name'),
    target: displayEl.getAttribute('data-md-link-target'),
    href: displayEl.getAttribute('data-href'),
    heading: displayEl.getAttribute('data-md-link-heading'),
  }
}

export function MdLinkClickHandler({
  editor,
}: {
  editor: CustomBlockNoteEditor | undefined
}) {
  const navigate = useNavigate()
  const { navigateToItem } = useEditorNavigation()
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const { editorMode } = useEditorMode()
  const { parentItemsMap } = useActiveSidebarItems()
  const editorEl = useEditorDomElement(editor)

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )

  const { mutateAsync: createNote } = useAppMutation(
    api.notes.mutations.createNote,
    { errorMessage: 'Failed to create note' },
  )

  const hideTooltip = () => setTooltip(HIDDEN_TOOLTIP)

  const showTooltipFor = (link: ReturnType<typeof getMdLinkAt>) => {
    if (!link || link.type !== 'internal' || link.exists || !link.itemName)
      return
    const rect = link.element.getBoundingClientRect()
    setTooltip({
      show: true,
      text: link.itemName,
      x: rect.left,
      y: rect.bottom + 4,
    })
  }

  // Track ctrl key - show tooltip when held over ghost link
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
        if (mousePos) {
          const link = getMdLinkAt(mousePos.x, mousePos.y)
          if (link && link.type === 'internal' && !link.exists) {
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

  // Mouse tracking for ghost link tooltips
  useEffect(() => {
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })

      if (!ctrlHeld) {
        hideTooltip()
        return
      }
      const link = getMdLinkAt(e.clientX, e.clientY)
      if (!link || link.type !== 'internal' || link.exists) {
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

  // Click handling for md-links
  useEffect(() => {
    if (!editorEl) return

    const onMouseDown = async (e: MouseEvent) => {
      const mdLink = getMdLinkAt(e.clientX, e.clientY)
      if (!mdLink) return

      const isCtrlClick = e.ctrlKey || e.metaKey

      // External links
      if (mdLink.type === 'external' && mdLink.target) {
        if (editorMode === 'editor') {
          if (!isCtrlClick) return
          e.preventDefault()
          e.stopPropagation()
          window.open(mdLink.target, '_blank', 'noopener,noreferrer')
        } else {
          e.preventDefault()
          e.stopPropagation()
          window.open(mdLink.target, '_blank', 'noopener,noreferrer')
        }
        return
      }

      // Internal links that exist
      if (mdLink.type === 'internal' && mdLink.exists && mdLink.href) {
        const url = new URL(mdLink.href, window.location.origin)
        const searchParams: Record<string, string> = {}
        url.searchParams.forEach((v, k) => {
          searchParams[k] = v
        })
        if (mdLink.heading) searchParams.heading = mdLink.heading

        if (editorMode === 'editor') {
          if (!isCtrlClick) return
          e.preventDefault()
          e.stopPropagation()
          navigate({ to: url.pathname, search: searchParams })
        } else {
          e.preventDefault()
          e.stopPropagation()
          if (isCtrlClick) {
            if (mdLink.heading) url.searchParams.set('heading', mdLink.heading)
            window.open(url.toString(), '_blank', 'noopener,noreferrer')
          } else {
            navigate({ to: url.pathname, search: searchParams })
          }
        }
        return
      }

      // Ghost internal link: ctrl+click creates note
      if (
        mdLink.type === 'internal' &&
        !mdLink.exists &&
        isCtrlClick &&
        mdLink.itemName &&
        campaignData?._id
      ) {
        e.preventDefault()
        e.stopPropagation()
        hideTooltip()

        const validation = validateSidebarItemName({
          name: mdLink.itemName,
          siblings: parentItemsMap.get(null),
        })
        if (!validation.valid) {
          toast.error(validation.error)
          return
        }
        try {
          const result = await createNote({
            campaignId: campaignData._id,
            name: mdLink.itemName,
            parentId: null,
          })
          if (result) navigateToItem(result.slug)
        } catch (error) {
          logger.error(error)
        }
      }
    }

    editorEl.addEventListener('mousedown', onMouseDown, true)
    return () => editorEl.removeEventListener('mousedown', onMouseDown, true)
  }, [
    editorEl,
    navigate,
    campaignData?._id,
    createNote,
    navigateToItem,
    editorMode,
    parentItemsMap,
    hideTooltip,
  ])

  if (!tooltip.show) return null

  return (
    <div
      className="md-link-tooltip"
      style={{
        position: 'fixed',
        top: tooltip.y,
        left: tooltip.x,
        zIndex: 9999,
      }}
    >
      Click to create "{tooltip.text}"
    </div>
  )
}
