import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'
import './wiki-link.css'
import { validateSidebarItemName } from '~/lib/sidebar-validation'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

interface WikiLinkClickHandlerProps {
  editor: CustomBlockNoteEditor | undefined
}

interface TooltipState {
  show: boolean
  linkText: string
  position: { x: number; y: number }
}

export function WikiLinkClickHandler({ editor }: WikiLinkClickHandlerProps) {
  const navigate = useNavigate()
  const { navigateToNote } = useEditorNavigation()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const { editorMode } = useEditorMode()
  const { parentItemsMap } = useAllSidebarItems()

  const [tooltip, setTooltip] = useState<TooltipState>({
    show: false,
    linkText: '',
    position: { x: 0, y: 0 },
  })
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  )

  // Create note mutation
  const createNoteMutation = useConvexMutation(api.notes.mutations.createNote)
  const { mutateAsync: createNote } = useMutation({
    mutationFn: createNoteMutation,
  })

  // Helper to check for ghost link at position
  const checkGhostLinkAtPosition = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)
    if (!element) return

    const wikiLinkElement = element.closest('.wiki-link-content')
    if (!wikiLinkElement) return

    const isExistingLink =
      wikiLinkElement.getAttribute('data-wiki-link-exists') === 'true'
    if (isExistingLink) return

    const linkText = wikiLinkElement.getAttribute('data-wiki-link')
    if (!linkText) return

    const rect = wikiLinkElement.getBoundingClientRect()
    setTooltip({
      show: true,
      linkText,
      position: { x: rect.left, y: rect.bottom + 4 },
    })
  }

  // Track ctrl key state
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setCtrlHeld(true)
        // Check if already hovering over a ghost link
        if (mousePos) {
          checkGhostLinkAtPosition(mousePos.x, mousePos.y)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setCtrlHeld(false)
        setTooltip((prev) => ({ ...prev, show: false }))
      }
    }

    // Also hide when window loses focus
    const handleBlur = () => {
      setCtrlHeld(false)
      setTooltip((prev) => ({ ...prev, show: false }))
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [mousePos])

  // Track mouse position and hover over ghost links when ctrl is held
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.domElement
    if (!editorElement) return

    const handleMouseMove = (event: MouseEvent) => {
      // Always track mouse position
      setMousePos({ x: event.clientX, y: event.clientY })

      if (!ctrlHeld) {
        if (tooltip.show) {
          setTooltip((prev) => ({ ...prev, show: false }))
        }
        return
      }

      const target = event.target as HTMLElement
      const wikiLinkElement = target.closest('.wiki-link-content')

      if (!wikiLinkElement) {
        if (tooltip.show) {
          setTooltip((prev) => ({ ...prev, show: false }))
        }
        return
      }

      const isExistingLink =
        wikiLinkElement.getAttribute('data-wiki-link-exists') === 'true'
      if (isExistingLink) {
        if (tooltip.show) {
          setTooltip((prev) => ({ ...prev, show: false }))
        }
        return
      }

      const linkText = wikiLinkElement.getAttribute('data-wiki-link')
      if (!linkText) return

      const rect = wikiLinkElement.getBoundingClientRect()
      setTooltip({
        show: true,
        linkText,
        position: { x: rect.left, y: rect.bottom + 4 },
      })
    }

    const handleMouseLeave = () => {
      setMousePos(null)
      setTooltip((prev) => ({ ...prev, show: false }))
    }

    editorElement.addEventListener('mousemove', handleMouseMove)
    editorElement.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      editorElement.removeEventListener('mousemove', handleMouseMove)
      editorElement.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [editor, ctrlHeld, tooltip.show])

  // Handle clicks on wiki-links
  // Use mousedown with capturing to intercept before BlockNote's ctrl+click selection
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.domElement
    if (!editorElement) return

    const handleMouseDown = async (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Check if we clicked on a wiki-link content element
      const wikiLinkElement = target.closest('.wiki-link-content')
      if (!wikiLinkElement) return

      const linkText = wikiLinkElement.getAttribute('data-wiki-link')
      if (!linkText) return

      const isExistingLink =
        wikiLinkElement.getAttribute('data-wiki-link-exists') === 'true'
      const isCtrlClick = event.ctrlKey || event.metaKey

      if (isExistingLink) {
        const href = wikiLinkElement.getAttribute('data-href')
        if (href) {
          if (editorMode === 'editor') {
            // In editor mode: only ctrl+click navigates (allows normal cursor positioning)
            if (isCtrlClick) {
              event.preventDefault()
              event.stopPropagation()
              navigate({ to: href })
            }
            // Regular click: do nothing, allow cursor positioning
          } else {
            // In viewer mode: regular click navigates, ctrl+click opens new tab
            event.preventDefault()
            event.stopPropagation()
            if (isCtrlClick) {
              const a = document.createElement('a')
              a.href = href
              a.target = '_blank'
              a.rel = 'noopener noreferrer'
              a.click()
            } else {
              navigate({ to: href })
            }
          }
        }
        return
      }

      // For ghost links: ctrl+click creates the note directly
      if (isCtrlClick && campaign?._id) {
        event.preventDefault()
        event.stopPropagation()
        setTooltip((prev) => ({ ...prev, show: false }))

        try {
          const validationResult = validateSidebarItemName({
            name: linkText,
            siblings: parentItemsMap.get(undefined),
          })
          if (!validationResult.valid) {
            toast.error(validationResult.error)
            return
          }
          const result = await createNote({
            campaignId: campaign._id,
            name: linkText,
          })
          if (result) {
            navigateToNote(result.slug)
          }
        } catch (error) {
          console.error('Failed to create note:', error)
        }
      }
    }

    // Use capturing phase to intercept before BlockNote handles ctrl+click
    editorElement.addEventListener('mousedown', handleMouseDown, true)
    return () =>
      editorElement.removeEventListener('mousedown', handleMouseDown, true)
  }, [editor, navigate, campaign?._id, createNote, navigateToNote, editorMode])

  // Tooltip for ghost links
  if (!tooltip.show) return null

  return (
    <div
      className="wiki-link-tooltip"
      style={{
        position: 'fixed',
        top: tooltip.position.y,
        left: tooltip.position.x,
        zIndex: 9999,
      }}
    >
      Click to create "{tooltip.linkText}"
    </div>
  )
}
