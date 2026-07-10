import { createContext } from 'react'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { BlockShareTargetBlock } from '../contracts'

export type MenuPosition = {
  x: number
  y: number
}

type SideMenuController = {
  freezeMenu: () => void
  unfreezeMenu: () => void
}

export type BlockShareMenuState = {
  blocks: Array<BlockShareTargetBlock>
  note: NoteItemWithContent
  position: MenuPosition
  sideMenuController?: SideMenuController
  title: string
}

type BlockShareMenuContextValue = {
  open: (state: BlockShareMenuState) => void
  close: () => void
}

export const BlockShareMenuContext = createContext<BlockShareMenuContextValue | null>(null)
