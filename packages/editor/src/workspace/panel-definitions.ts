import { RIGHT_SIDEBAR_DEFAULTS, RIGHT_SIDEBAR_PANEL_ID } from './right-sidebar/constants'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
} from './sidebar/components/sidebar-toolbar/constants'

const EDITOR_LEFT_SIDEBAR_PANEL = {
  panelId: LEFT_SIDEBAR_PANEL_ID,
  defaults: LEFT_SIDEBAR_DEFAULTS,
} as const

const EDITOR_RIGHT_SIDEBAR_PANEL = {
  panelId: RIGHT_SIDEBAR_PANEL_ID,
  defaults: RIGHT_SIDEBAR_DEFAULTS,
} as const

export const EDITOR_WORKSPACE_PANEL_DEFINITIONS = [
  EDITOR_LEFT_SIDEBAR_PANEL,
  EDITOR_RIGHT_SIDEBAR_PANEL,
] as const
