import { SideMenu, SideMenuController } from '@blocknote/react'
import type { SideMenuProps } from '@blocknote/react'
import { createContext, use } from 'react'
import { BlockDragHandleButton } from '../rich-text/side-menu/block-drag-handle-button'
import { duplicateCanvasTextBlock } from './text/duplicate-block'

const CanvasTextSideMenuState = createContext<{
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
} | null>(null)

export function CanvasTextSideMenuController({
  menuOpen,
  onMenuOpenChange,
}: {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  return (
    <CanvasTextSideMenuState value={{ menuOpen, setMenuOpen: onMenuOpenChange }}>
      <SideMenuController sideMenu={CanvasTextSideMenu} />
    </CanvasTextSideMenuState>
  )
}

function CanvasTextSideMenu(props: SideMenuProps) {
  const state = use(CanvasTextSideMenuState)
  if (!state) throw new TypeError('Canvas text side menu requires its controller')

  return (
    <SideMenu {...props}>
      <BlockDragHandleButton
        menuOpen={state.menuOpen}
        onDuplicate={duplicateCanvasTextBlock}
        onMenuOpenChange={state.setMenuOpen}
        variant="canvas-text"
      />
    </SideMenu>
  )
}
