import { create } from 'zustand'
import type { CampaignViewAsSelection } from 'shared/campaigns/actor'

interface CampaignViewAsState {
  viewAsPlayer: CampaignViewAsSelection | null
  setViewAsPlayer: (state: CampaignViewAsSelection | null) => void
}

export const useCampaignViewAsStore = create<CampaignViewAsState>()((set) => ({
  viewAsPlayer: null,
  setViewAsPlayer: (viewAsPlayer) => set({ viewAsPlayer }),
}))
