import { ClientOnly, Link } from '@tanstack/react-router'
import { PanelLeft, PanelLeftOpen } from 'lucide-react'
import type { LucideIcon } from '~/features/shared/utils/icons'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { FileText, Users } from '~/features/shared/utils/icons'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/features/shared/components/tooltip-button'
import { Separator } from '~/features/shadcn/components/separator'
import { useSidebarLayout } from '~/features/sidebar/hooks/useSidebarLayout'
import { UserMenu } from '~/features/auth/components/UserMenu'

type NavigationItem = {
  name: string
  icon: LucideIcon
  to: string
  search?: EditorSearch
}

export const NavigationSidebar = () => {
  const { dmUsername, campaignSlug } = useCampaign()
  const { lastSelectedItemSearch } = useLastEditorItem()
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebarLayout()

  const navigationItems: Array<NavigationItem> = [
    {
      name: 'Notes',
      to: '/campaigns/$dmUsername/$campaignSlug/editor',
      icon: FileText,
      search: lastSelectedItemSearch,
    },
    {
      name: 'Players',
      to: '/campaigns/$dmUsername/$campaignSlug/players',
      icon: Users,
    },
  ]

  return (
    <div className="w-12 h-full min-h-0 bg-background border-r border-border flex flex-col items-center py-2">
      {/* Navigation items */}
      <div className="flex flex-col items-center space-y-1 flex-1">
        <TooltipButton
          tooltip={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          side="right"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          >
            {isSidebarExpanded ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </TooltipButton>
        <Separator className="w-full" />
        {navigationItems.map((item) => {
          return (
            <TooltipButton key={item.name} tooltip={item.name} side="right">
              <Link
                to={item.to}
                params={{ dmUsername, campaignSlug }}
                search={item.search}
                activeOptions={{ includeSearch: false }}
              >
                {({ isActive }) => (
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="icon"
                  >
                    <item.icon className="h-4 w-4" />
                  </Button>
                )}
              </Link>
            </TooltipButton>
          )
        })}
      </div>

      {/* User profile at bottom */}
      <ClientOnly>
        <UserMenu />
      </ClientOnly>
    </div>
  )
}
