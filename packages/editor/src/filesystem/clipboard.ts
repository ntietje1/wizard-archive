import type { SidebarItemId } from '../../../../shared/common/ids'
import { create } from 'zustand'

type FileSystemClipboardMode = 'copy' | 'cut'

export type FileSystemClipboard = {
  mode: FileSystemClipboardMode
  workspaceId: string
  itemIds: ReadonlyArray<SidebarItemId>
}

type FileSystemClipboardState = {
  clipboard: FileSystemClipboard | null
  setClipboard: (clipboard: FileSystemClipboard | null) => void
  clearClipboard: () => void
}

const useFileSystemClipboardStore = create<FileSystemClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) =>
    set({ clipboard: clipboard && clipboard.itemIds.length > 0 ? clipboard : null }),
  clearClipboard: () => set({ clipboard: null }),
}))

export function setFileSystemClipboard(clipboard: FileSystemClipboard | null) {
  useFileSystemClipboardStore.getState().setClipboard(clipboard)
}

export function getFileSystemClipboard() {
  return useFileSystemClipboardStore.getState().clipboard
}

export function useFileSystemClipboard() {
  return useFileSystemClipboardStore((state) => state.clipboard)
}

export function useCutFileSystemItemIds(): ReadonlyArray<SidebarItemId> | null {
  return useFileSystemClipboardStore((state) =>
    state.clipboard?.mode === 'cut' ? state.clipboard.itemIds : null,
  )
}
