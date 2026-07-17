import { SideMenu } from '@blocknote/react'
import { useState } from 'react'
import { BlockDragHandleButton } from './drag-handle/block-drag-handle-button'
import type { SideMenuProps } from '@blocknote/react'

export function NoteSideMenu(props: SideMenuProps) {
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)

  return (
    <SideMenu {...props}>
      <BlockDragHandleButton
        menuOpen={dragHandleMenuOpen}
        onMenuOpenChange={setDragHandleMenuOpen}
      />
    </SideMenu>
  )
}
