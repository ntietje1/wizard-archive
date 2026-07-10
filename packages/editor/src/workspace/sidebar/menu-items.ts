import { ExternalLink, Eye, SquareArrowOutUpRight } from 'lucide-react'

export const sidebarItemOpenMenuItem = {
  id: 'open',
  label: 'Open',
  icon: SquareArrowOutUpRight,
  group: 'primary',
  priority: 0,
} as const

export const sidebarItemOpenInNewTabMenuItem = {
  id: 'open-in-new-tab',
  label: 'Open in New Tab',
  icon: ExternalLink,
  group: 'primary',
  priority: 1,
} as const

export const sidebarRevealMenuItem = {
  id: 'show-in-sidebar',
  label: 'Show in Sidebar',
  icon: Eye,
  group: 'primary',
  priority: 3,
} as const
