import { createContext } from 'react'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'

export type MenuPosition = {
  x: number
  y: number
}

type SideMenuController = {
  freezeMenu: () => void
  unfreezeMenu: () => void
}

export type BlockShareMenuState = {
  blocks: Array<CustomBlock>
  note: NoteWithContent
  position: MenuPosition
  sideMenuController: SideMenuController
  title: string
}

type BlockShareMenuContextValue = {
  open: (state: BlockShareMenuState) => void
  close: () => void
}

export const BlockShareMenuContext = createContext<BlockShareMenuContextValue | null>(null)
