import { SideMenu } from '@blocknote/react'
import { useState } from 'react'
import { BlockDragHandleButton } from './drag-handle/block-drag-handle-button'
import { ShareSideMenuButton } from './share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'

export function NoteSideMenu(props: SideMenuProps) {
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)

  return (
    <SideMenu {...props}>
      <ShareSideMenuButton tooltipDisabled={dragHandleMenuOpen} />
      <BlockDragHandleButton
        menuOpen={dragHandleMenuOpen}
        onMenuOpenChange={setDragHandleMenuOpen}
      />
    </SideMenu>
  )
}
