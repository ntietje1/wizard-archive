import { Link } from '@tanstack/react-router'
import { useCampaign } from '~/hooks/useCampaign'
import { FileText, Home, Settings, Users } from '~/lib/icons'
import { cn } from '~/lib/shadcn/utils'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'

const navigationItems = [
  {
    name: 'Overview',
    to: '/campaigns/$dmUsername/$campaignSlug',
    icon: Home,
    exact: true,
  },
  {
    name: 'Notes',
    to: '/campaigns/$dmUsername/$campaignSlug/editor',
    icon: FileText,
  },
  {
    name: 'Players',
    to: '/campaigns/$dmUsername/$campaignSlug/players',
    icon: Users,
  },
  {
    name: 'Settings',
    to: '/campaigns/$dmUsername/$campaignSlug/settings',
    icon: Settings,
  },
]

export const NavigationSidebar = () => {
  const { dmUsername, campaignSlug } = useCampaign()

  return (
    <div className="w-16 h-full min-h-0 bg-white border-r border-slate-200 flex flex-col items-center py-4">
      <ScrollArea className="flex-1 w-full h-full pl-1">
        <div className="flex flex-col items-center space-y-2">
          {/* Overview, Players, Notes */}
          {navigationItems.map((item) => {
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger>
                  <Link
                    to={item.to}
                    params={{ dmUsername, campaignSlug }}
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                      'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    title={item.name}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
