import { Outlet } from '@tanstack/react-router'
import { NavigationSidebar } from '../components/navigation-sidebar'
import { CampaignNotFoundWrapper } from '../components/campaign-not-found'
import { CampaignProvider } from '~/features/campaigns/contexts/CampaignContext'
import { AllSidebarItemsProvider } from '~/features/sidebar/contexts/AllSidebarItemsProvider'
import { SidebarItemMutationsProvider } from '~/features/sidebar/contexts/SidebarItemMutationsProvider'
import { SidebarLayout } from '~/features/sidebar/components/sidebar-layout'
import { SidebarLayoutProvider } from '~/features/sidebar/contexts/SidebarLayoutContext'
import { SessionProvider } from '~/features/sidebar/contexts/SessionContext'
import { EditorNavigationProvider } from '~/features/sidebar/contexts/EditorNavigationProvider'
import { DndProvider } from '~/features/dnd/contexts/DndProvider'
import { ViewAsBanner } from '~/features/editor/components/view-as-banner'
import { ErrorBoundary } from '~/features/shared/components/error-boundary'
import { ErrorFallback } from '~/features/shared/components/error-fallback'

export function CampaignLayout() {
  return (
    <CampaignProvider>
      <CampaignNotFoundWrapper>
        <SessionProvider>
          <AllSidebarItemsProvider>
            <SidebarItemMutationsProvider>
              <EditorNavigationProvider>
                <DndProvider>
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex flex-1 min-h-0">
                      <SidebarLayoutProvider>
                        <ErrorBoundary FallbackComponent={ErrorFallback}>
                          <NavigationSidebar />
                          <SidebarLayout>
                            <ErrorBoundary FallbackComponent={ErrorFallback}>
                              <Outlet />
                            </ErrorBoundary>
                          </SidebarLayout>
                        </ErrorBoundary>
                      </SidebarLayoutProvider>
                    </div>
                    <ViewAsBanner />
                  </div>
                </DndProvider>
              </EditorNavigationProvider>
            </SidebarItemMutationsProvider>
          </AllSidebarItemsProvider>
        </SessionProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}
