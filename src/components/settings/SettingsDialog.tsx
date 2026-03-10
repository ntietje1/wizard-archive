import { api } from 'convex/_generated/api'
import { useSettingsStore } from './settings-store'
import { ProfileTab } from './tabs/ProfileTab'
import { PreferencesTab } from './tabs/PreferencesTab'
import { StubTab } from './tabs/StubTab'
import type { SettingsTab } from './settings-store'
import type { LucideIcon } from '~/lib/icons'
import {
  Cable,
  CreditCard,
  Import,
  Paintbrush,
  Settings,
  Smile,
  Users,
} from '~/lib/icons'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { cn } from '~/lib/shadcn/utils'
import { useAuthQuery } from '~/hooks/useAuthQuery'

type TabDefinition = {
  id: SettingsTab
  label: string
  icon: LucideIcon
}

type TabGroup = {
  label: string
  tabs: Array<TabDefinition>
}

const tabGroups: Array<TabGroup> = [
  {
    label: 'Account',
    tabs: [
      { id: 'preferences', label: 'Preferences', icon: Paintbrush },
      { id: 'billing', label: 'Billing', icon: CreditCard },
    ],
  },
  {
    label: 'Campaign',
    tabs: [
      { id: 'campaign-general', label: 'General', icon: Settings },
      { id: 'campaign-people', label: 'People', icon: Users },
      { id: 'campaign-import', label: 'Import', icon: Import },
    ],
  },
  {
    label: 'Features',
    tabs: [
      { id: 'emoji', label: 'Emoji', icon: Smile },
      { id: 'connections', label: 'Connections', icon: Cable },
    ],
  },
]

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
  'campaign-people': (
    <StubTab
      category="Campaign"
      title="People"
      description="Manage players, invitations, and role assignments"
      icon={Users}
    />
  ),
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

function getInitials(name?: string, email?: string): string {
  const trimmedName = name?.trim()
  const trimmedEmail = email?.trim()
  if (trimmedName) {
    const initials = trimmedName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    if (initials) return initials
  }
  if (trimmedEmail) return trimmedEmail[0].toUpperCase()
  return 'U'
}

export function SettingsDialog() {
  const { isOpen, close, activeTab, setActiveTab } = useSettingsStore()
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
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
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer',
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
                  </button>
                )}
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer',
                      activeTab === tab.id
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Right content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6">{tabContent[activeTab]}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
