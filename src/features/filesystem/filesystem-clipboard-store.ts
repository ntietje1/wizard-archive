import type { Id } from 'convex/_generated/dataModel'
import { create } from 'zustand'

type FileSystemClipboardMode = 'copy' | 'cut'

export type FileSystemClipboard = {
  mode: FileSystemClipboardMode
  campaignId: Id<'campaigns'>
  itemIds: ReadonlyArray<Id<'sidebarItems'>>
}

type FileSystemClipboardState = {
  clipboard: FileSystemClipboard | null
  setClipboard: (clipboard: FileSystemClipboard | null) => void
  clearClipboard: () => void
}

export const useFileSystemClipboardStore = create<FileSystemClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) =>
    set({ clipboard: clipboard && clipboard.itemIds.length > 0 ? clipboard : null }),
  clearClipboard: () => set({ clipboard: null }),
}))

export function setFileSystemClipboard(clipboard: FileSystemClipboard | null) {
  useFileSystemClipboardStore.getState().setClipboard(clipboard)
}

export function useFileSystemClipboard() {
  return useFileSystemClipboardStore((state) => state.clipboard)
}

export function useCutFileSystemItemIds(): ReadonlyArray<Id<'sidebarItems'>> | null {
  return useFileSystemClipboardStore((state) =>
    state.clipboard?.mode === 'cut' ? state.clipboard.itemIds : null,
  )
}
