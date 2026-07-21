import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ContextMenu, ContextMenuContent } from '@wizard-archive/ui/shadcn/components/context-menu'
import type { ContextMenuRef } from '@wizard-archive/ui/shadcn/components/context-menu'
import { RichTextBlockMenuItems } from './block-menu'
import type { RichTextBlockMenuBlock, RichTextBlockMenuEditor } from './block-menu'
import { resolveRichTextContextBlock } from './resolve-context-block'

type BlockContextMenuRequest = Readonly<{
  block: RichTextBlockMenuBlock
  position: Readonly<{ x: number; y: number }>
}>

export function RichTextBlockContextMenu({
  children,
  editor,
  enabled,
  onCopyLink,
  onDuplicate,
  onOpenVisibility,
}: {
  children: ReactNode
  editor: RichTextBlockMenuEditor
  enabled: boolean
  onCopyLink?: (block: RichTextBlockMenuBlock) => void
  onDuplicate: (editor: RichTextBlockMenuEditor, block: RichTextBlockMenuBlock) => void
  onOpenVisibility?: (
    block: RichTextBlockMenuBlock,
    position: Readonly<{ x: number; y: number }>,
  ) => void
}) {
  const menu = useRef<ContextMenuRef>(null)
  const openFrame = useRef<number | null>(null)
  const [request, setRequest] = useState<BlockContextMenuRequest | null>(null)

  useEffect(() => {
    if (!enabled) return
    const editorElement = editor.prosemirrorView.dom
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      if (event.target.closest('[data-slot="context-menu-trigger"]')) return
      const block = resolveRichTextContextBlock(editor, {
        position: { x: event.clientX, y: event.clientY },
        target: event.target,
      })
      if (!block) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const nextRequest = {
        block,
        position: { x: event.clientX, y: event.clientY },
      }
      setRequest(nextRequest)
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current)
      openFrame.current = requestAnimationFrame(() => {
        openFrame.current = null
        menu.current?.openAt(nextRequest.position)
      })
    }
    editorElement.addEventListener('contextmenu', open, { capture: true })
    return () => {
      editorElement.removeEventListener('contextmenu', open, { capture: true })
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current)
    }
  }, [editor, enabled])

  return (
    <>
      {children}
      <ContextMenu
        ref={menu}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRequest(null)
        }}
      >
        {request && (
          <ContextMenuContent className="w-52" data-testid="block-context-menu">
            <RichTextBlockMenuItems
              block={request.block}
              editor={editor}
              onCopyLink={onCopyLink}
              onDuplicate={onDuplicate}
              onOpenVisibility={
                onOpenVisibility ? (block) => onOpenVisibility(block, request.position) : undefined
              }
              surface="context"
            />
          </ContextMenuContent>
        )}
      </ContextMenu>
    </>
  )
}
