import { useCallback, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'
import { validateSidebarItemName } from '~/lib/sidebar-validation'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import './wiki-link.css'

interface TooltipState {
  show: boolean
  text: string
  x: number
  y: number
}

const HIDDEN_TOOLTIP: TooltipState = { show: false, text: '', x: 0, y: 0 }

/** Extract wiki link data from an element at a position */
function getWikiLinkAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y)?.closest('.wiki-link-content')
  if (!el) return null
  return {
    element: el,
    exists: el.getAttribute('data-wiki-link-exists') === 'true',
    itemName:
      el.getAttribute('data-wiki-link-item-name') ||
      el.getAttribute('data-wiki-link'),
    href: el.getAttribute('data-href'),
    heading: el.getAttribute('data-wiki-link-heading'),
  }
}

export function WikiLinkClickHandler({
  editor,
}: {
  editor: CustomBlockNoteEditor | undefined
}) {
  const navigate = useNavigate()
  const { navigateToNote } = useEditorNavigation()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const { editorMode } = useEditorMode()
  const { parentItemsMap } = useAllSidebarItems()

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )

  const createNoteMutation = useConvexMutation(api.notes.mutations.createNote)
  const { mutateAsync: createNote } = useMutation({
    mutationFn: createNoteMutation,
  })

  const hideTooltip = useCallback(() => setTooltip(HIDDEN_TOOLTIP), [])

  const showTooltipFor = useCallback(
    (link: ReturnType<typeof getWikiLinkAt>) => {
      if (!link || link.exists || !link.itemName) return
      const rect = link.element.getBoundingClientRect()
      setTooltip({
        show: true,
        text: link.itemName,
        x: rect.left,
        y: rect.bottom + 4,
      })
    },
    [],
  )

  // Track ctrl key - show tooltip when held over ghost link
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
        // Check if already hovering over a ghost link
        if (mousePos) {
          const link = getWikiLinkAt(mousePos.x, mousePos.y)
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

  // Mouse tracking for ghost link tooltips
  useEffect(() => {
    const editorEl = editor?.domElement
    if (!editorEl) return

    const onMouseMove = (e: MouseEvent) => {
      // Always track mouse position
      setMousePos({ x: e.clientX, y: e.clientY })

      if (!ctrlHeld) {
        hideTooltip()
        return
      }
      const link = getWikiLinkAt(e.clientX, e.clientY)
      if (!link || link.exists) {
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
  }, [editor, ctrlHeld, hideTooltip, showTooltipFor])

  // Click handling
  useEffect(() => {
    const editorEl = editor?.domElement
    if (!editorEl) return

    const onMouseDown = async (e: MouseEvent) => {
      const link = getWikiLinkAt(e.clientX, e.clientY)
      if (!link) return

      const isCtrlClick = e.ctrlKey || e.metaKey

      if (link.exists && link.href) {
        const url = new URL(link.href, window.location.origin)
        const searchParams: Record<string, string> = {}
        url.searchParams.forEach((v, k) => {
          searchParams[k] = v
        })
        if (link.heading) searchParams.heading = link.heading

        if (editorMode === 'editor') {
          // Editor: ctrl+click navigates, regular click positions cursor
          if (!isCtrlClick) return
          e.preventDefault()
          e.stopPropagation()
          navigate({ to: url.pathname, search: searchParams })
        } else {
          // Viewer: click navigates, ctrl+click opens new tab
          e.preventDefault()
          e.stopPropagation()
          if (isCtrlClick) {
            if (link.heading) url.searchParams.set('heading', link.heading)
            window.open(url.toString(), '_blank', 'noopener,noreferrer')
          } else {
            navigate({ to: url.pathname, search: searchParams })
          }
        }
        return
      }

      // Ghost link: ctrl+click creates note
      if (!link.exists && isCtrlClick && link.itemName && campaign?._id) {
        e.preventDefault()
        e.stopPropagation()
        hideTooltip()

        const validation = validateSidebarItemName({
          name: link.itemName,
          siblings: parentItemsMap.get(undefined),
        })
        if (!validation.valid) {
          toast.error(validation.error)
          return
        }
        try {
          const result = await createNote({
            campaignId: campaign._id,
            name: link.itemName,
          })
          if (result) navigateToNote(result.slug)
        } catch (err) {
          console.error('Failed to create note:', err)
          toast.error('Failed to create note')
        }
      }
    }

    editorEl.addEventListener('mousedown', onMouseDown, true)
    return () => editorEl.removeEventListener('mousedown', onMouseDown, true)
  }, [
    editor,
    navigate,
    campaign?._id,
    createNote,
    navigateToNote,
    editorMode,
    parentItemsMap,
    hideTooltip,
  ])

  if (!tooltip.show) return null

  return (
    <div
      className="wiki-link-tooltip"
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
