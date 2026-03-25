import { Outlet, useRouteContext } from '@tanstack/react-router'
import { CampaignNotFoundWrapper } from '../components/campaign-not-found'
import { CampaignProvider } from '~/features/campaigns/contexts/campaign-context'
import { AllSidebarItemsProvider } from '~/features/sidebar/contexts/all-sidebar-items-provider'
import { SidebarLayout } from '~/features/sidebar/components/sidebar-layout'
import { SidebarLayoutProvider } from '~/features/sidebar/contexts/sidebar-layout-context'
import { DndProvider } from '~/features/dnd/contexts/dnd-provider'
import { ViewAsBanner } from '~/features/editor/components/view-as-banner'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function CampaignLayout() {
  const { initialSidebarWidth, initialSidebarExpanded } = useRouteContext({
    from: '__root__',
  })

  return (
    <CampaignProvider>
      <CampaignNotFoundWrapper>
        <AllSidebarItemsProvider>
          <DndProvider>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-1 min-h-0">
                <SidebarLayoutProvider
                  initialSidebarWidth={initialSidebarWidth}
                  initialSidebarExpanded={initialSidebarExpanded}
                >
                  <SidebarLayout>
                    <ErrorBoundary FallbackComponent={ErrorFallback}>
                      <Outlet />
                    </ErrorBoundary>
                  </SidebarLayout>
                </SidebarLayoutProvider>
              </div>
              <ViewAsBanner />
            </div>
          </DndProvider>
        </AllSidebarItemsProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}
