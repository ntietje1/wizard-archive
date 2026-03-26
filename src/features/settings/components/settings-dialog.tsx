import { api } from 'convex/_generated/api'
import {
  Cable,
  CreditCard,
  Import,
  Paintbrush,
  Settings,
  Smile,
  Users,
} from 'lucide-react'
import { useMatch } from '@tanstack/react-router'
import { useSettingsStore } from '../hooks/settings-store'
import { ProfileTab } from './tabs/account-profile/profile-tab'
import { PreferencesTab } from './tabs/account-preferences/preferences-tab'
import { PeopleTab } from './tabs/campaign-people/people-tab'
import { StubTab } from './tabs/stub-tab'
import type { SettingsTab } from '../hooks/settings-store'
import type { LucideIcon } from 'lucide-react'
import { getInitials } from '~/shared/utils/get-initials'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { Button } from '~/features/shadcn/components/button'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

type TabDefinition = {
  id: SettingsTab
  label: string
  icon: LucideIcon
}

type TabGroup = {
  label: string
  tabs: Array<TabDefinition>
}

const accountGroup: TabGroup = {
  label: 'Account',
  tabs: [
    { id: 'preferences', label: 'Preferences', icon: Paintbrush },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ],
}

const campaignGroup: TabGroup = {
  label: 'Campaign',
  tabs: [
    { id: 'campaign-general', label: 'General', icon: Settings },
    { id: 'campaign-people', label: 'People', icon: Users },
    { id: 'campaign-import', label: 'Import', icon: Import },
  ],
}

const featuresGroup: TabGroup = {
  label: 'Features',
  tabs: [
    { id: 'emoji', label: 'Emoji', icon: Smile },
    { id: 'connections', label: 'Connections', icon: Cable },
  ],
}

const tabContent: Record<SettingsTab, React.ReactNode> = {
  profile: <ProfileTab />,
  preferences: <PreferencesTab />,
  billing: (
    <StubTab
      category="Account"
      title="Billing"
      description="Manage your subscription, payment methods, and billing history"
      icon={CreditCard}
    />
  ),
  'campaign-general': (
    <StubTab
      category="Campaign"
      title="General"
      description="Configure your campaign's basic settings and preferences"
      icon={Settings}
    />
  ),
  'campaign-people': <PeopleTab />,
  'campaign-import': (
    <StubTab
      category="Campaign"
      title="Import"
      description="Import content from other tools and platforms"
      icon={Import}
    />
  ),
  emoji: (
    <StubTab
      category="Features"
      title="Emoji"
      description="Customize emoji reactions and shortcuts for your campaigns"
      icon={Smile}
    />
  ),
  connections: (
    <StubTab
      category="Features"
      title="Connections"
      description="Connect third-party services and integrations"
      icon={Cable}
    />
  ),
}

export function SettingsDialog() {
  const { isOpen, close, activeTab, setActiveTab } = useSettingsStore()
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const campaignMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
    shouldThrow: false,
  })
  const isInCampaign = !!campaignMatch

  const tabGroups: Array<TabGroup> = [
    accountGroup,
    ...(isInCampaign ? [campaignGroup] : []),
    featuresGroup,
  ]

  const isCampaignTab = activeTab.startsWith('campaign-')
  const resolvedTab = isCampaignTab && !isInCampaign ? 'profile' : activeTab

  const profile = profileQuery.data

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton
        className="sm:max-w-4xl h-[90vh] max-h-[90vh] flex flex-row gap-0 p-0 overflow-hidden !transition-none"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>

        {/* Left sidebar */}
        <nav className="w-52 shrink-0 border-r border-border bg-background p-3 flex flex-col gap-4 overflow-y-auto">
          {tabGroups.map((group) => (
            <div key={group.label}>
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </span>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {/* Profile entry under Account */}
                {group.label === 'Account' && (
                  <Button
                    variant="ghost"
                    onClick={() => setActiveTab('profile')}
                    className={cn(
                      'h-auto w-full justify-start gap-2.5 px-2 py-1.5 text-sm font-normal',
                      activeTab === 'profile'
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <Avatar size="sm">
                      {profile?.imageUrl && (
                        <AvatarImage
                          src={profile.imageUrl}
                          alt={profile.name ?? ''}
                        />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(profile?.name, profile?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {profile?.name ?? profile?.email ?? 'Profile'}
                    </span>
                  </Button>
                )}
                {group.tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm font-normal',
                      activeTab === tab.id
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Right content */}
        <ScrollArea className="flex-1 min-h-0">
          <ErrorBoundary FallbackComponent={ErrorFallback} key={resolvedTab}>
            <div className="p-6">{tabContent[resolvedTab]}</div>
          </ErrorBoundary>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
