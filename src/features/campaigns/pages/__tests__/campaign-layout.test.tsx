import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CampaignLayout } from '../campaign-layout'

const routeState = vi.hoisted(() => ({
  campaignId: '018f2e40-7c00-7000-8000-000000000003',
  shouldThrow: true,
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => {
    if (routeState.shouldThrow) throw new Error('Campaign route failed')
    return <div>Healthy campaign</div>
  },
}))

vi.mock('~/features/campaigns/contexts/campaign-context', () => ({
  CampaignProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: routeState.campaignId,
  }),
}))

vi.mock('@wizard-archive/ui/components/error-fallback', () => ({
  ErrorFallback: ({ error }: { error: Error }) => <div>{error.message}</div>,
}))

describe('CampaignLayout', () => {
  beforeEach(() => {
    routeState.campaignId = '018f2e40-7c00-7000-8000-000000000003'
    routeState.shouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('resets route failure state only when the campaign route identity changes', () => {
    const { rerender } = render(<CampaignLayout />)
    expect(screen.getByText('Campaign route failed')).toBeInTheDocument()

    routeState.shouldThrow = false
    rerender(<CampaignLayout />)
    expect(screen.getByText('Campaign route failed')).toBeInTheDocument()

    routeState.campaignId = '018f2e40-7c00-7000-8000-000000000004'
    rerender(<CampaignLayout />)
    expect(screen.getByText('Healthy campaign')).toBeInTheDocument()
    expect(screen.queryByText('Campaign route failed')).not.toBeInTheDocument()
  })
})
