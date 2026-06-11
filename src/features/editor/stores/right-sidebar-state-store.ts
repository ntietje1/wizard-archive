import { create } from 'zustand'
import {
  canShowRightSidebarContent,
  getDefaultRightSidebarContent,
} from '~/features/editor/components/right-sidebar/right-sidebar-model'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarItemType } from '~/features/editor/components/right-sidebar/right-sidebar-model'

interface RightSidebarState {
  activeContentByItemType: Partial<Record<RightSidebarItemType, RightSidebarContentId>>
  setActiveContent: (itemType: RightSidebarItemType, contentId: RightSidebarContentId) => void
  clearActiveContent: (itemType: RightSidebarItemType) => void
}

export const useRightSidebarStateStore = create<RightSidebarState>()((set) => ({
  activeContentByItemType: {},

  setActiveContent: (itemType, contentId) =>
    set((prev) => ({
      activeContentByItemType: {
        ...prev.activeContentByItemType,
        [itemType]: canShowRightSidebarContent(itemType, contentId)
          ? contentId
          : getDefaultRightSidebarContent(itemType),
      },
    })),

  clearActiveContent: (itemType) =>
    set((prev) => {
      const next = { ...prev.activeContentByItemType }
      delete next[itemType]
      return { activeContentByItemType: next }
    }),
}))
