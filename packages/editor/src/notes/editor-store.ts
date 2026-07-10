import { createContext, createElement, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { CustomBlockNoteEditor } from './editor-schema'
import type { YjsCollaborationProvider } from '../collaboration/yjs-provider'

interface NoteEditorStore {
  editor: CustomBlockNoteEditor | null
  provider: YjsCollaborationProvider | null
  claimEditor: (
    editor: CustomBlockNoteEditor | null,
    provider?: YjsCollaborationProvider | null,
  ) => () => void
}

type NoteEditorStoreApi = StoreApi<NoteEditorStore>

function createNoteEditorStore(): NoteEditorStoreApi {
  let claimToken = 0

  return createStore<NoteEditorStore>()((set) => ({
    editor: null,
    provider: null,
    claimEditor: (editor, provider = null) => {
      const token = ++claimToken
      set({ editor, provider })
      return () => {
        if (claimToken === token) set({ editor: null, provider: null })
      }
    },
  }))
}

const defaultNoteEditorStore = createNoteEditorStore()

export const useNoteEditorStore = Object.assign(function useNoteEditorStore<TValue>(
  selector: (store: NoteEditorStore) => TValue,
): TValue {
  return useStore(useNoteEditorStoreApi(), selector)
}, defaultNoteEditorStore)

const NoteEditorStoreContext = createContext<NoteEditorStoreApi | null>(null)

export function NoteEditorStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<NoteEditorStoreApi | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createNoteEditorStore()
  }

  return createElement(NoteEditorStoreContext.Provider, { value: storeRef.current }, children)
}

function useNoteEditorStoreApi(): NoteEditorStoreApi {
  return useContext(NoteEditorStoreContext) ?? defaultNoteEditorStore
}

export function useScopedNoteEditorStore<TValue>(
  selector: (store: NoteEditorStore) => TValue,
): TValue {
  return useStore(useNoteEditorStoreApi(), selector)
}
