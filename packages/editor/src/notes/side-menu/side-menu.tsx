import { SideMenu } from '@blocknote/react'
import { createContext, use, useState } from 'react'
import { BlockDragHandleButton } from './drag-handle/block-drag-handle-button'
import ShareSideMenuButton from './share/share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { BlocksShareSource } from '../../sharing/contracts'
import type { ReactNode } from 'react'

type SideMenuRuntime = {
  blockSharing: BlocksShareSource
  note: NoteItemWithContent
}

const SideMenuRuntimeContext = createContext<SideMenuRuntime | null>(null)

export function SideMenuRuntimeProvider({
  blockSharing,
  children,
  note,
}: SideMenuRuntime & { children: ReactNode }) {
  return (
    <SideMenuRuntimeContext.Provider value={{ blockSharing, note }}>
      {children}
    </SideMenuRuntimeContext.Provider>
  )
}

export function SideMenuRenderer(props: SideMenuProps) {
  const runtime = use(SideMenuRuntimeContext)
  const [dragHandleMenuOpen, setDragHandleMenuOpen] = useState(false)
  if (!runtime) throw new Error('SideMenuRenderer requires SideMenuRuntimeProvider')

  return (
    <SideMenu {...props}>
      <ShareSideMenuButton
        blockSharing={runtime.blockSharing}
        note={runtime.note}
        tooltipDisabled={dragHandleMenuOpen}
      />
      <BlockDragHandleButton
        note={runtime.note}
        menuOpen={dragHandleMenuOpen}
        onMenuOpenChange={setDragHandleMenuOpen}
      />
    </SideMenu>
  )
}
