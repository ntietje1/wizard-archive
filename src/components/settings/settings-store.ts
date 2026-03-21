import { create } from 'zustand'

export type SettingsTab =
  | 'profile'
  | 'preferences'
  | 'billing'
  | 'campaign-general'
  | 'campaign-people'
  | 'campaign-import'
  | 'emoji'
  | 'connections'

type SettingsStore = {
  isOpen: boolean
  activeTab: SettingsTab
  open: (tab?: SettingsTab) => void
  close: () => void
  setActiveTab: (tab: SettingsTab) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  activeTab: 'profile',
  open: (tab) => set({ isOpen: true, activeTab: tab ?? 'profile' }),
  close: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
