import { create } from 'zustand'
import { canShowRightSidebarContent, getDefaultRightSidebarContent } from './model'
import type { RightSidebarContentId } from './content'
import type { ResourceKind } from '../resource-contract'

interface RightSidebarState {
  activeContentByItemType: Partial<Record<ResourceKind, RightSidebarContentId>>
  setActiveContent: (itemType: ResourceKind, contentId: RightSidebarContentId) => void
  clearActiveContent: (itemType: ResourceKind) => void
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
