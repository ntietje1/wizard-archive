import {
  creationContextMenuCommands,
  creationContextMenuContributors,
} from './registry/creation-menu'
import {
  downloadContextMenuCommands,
  downloadContextMenuContributors,
} from './registry/download-menu'
import {
  editorPanelContextMenuCommands,
  editorPanelContextMenuContributors,
} from './registry/editor-panel-menu'
import {
  filesystemContextMenuCommands,
  filesystemContextMenuContributors,
} from './registry/filesystem-menu'
import { mapPinContextMenuCommands, mapPinContextMenuContributors } from './registry/map-pin-menu'
import { noteContextMenuCommands, noteContextMenuContributors } from './registry/note-menu'
import { sharingContextMenuCommands, sharingContextMenuContributors } from './registry/sharing-menu'
import {
  sidebarItemContextMenuCommands,
  sidebarItemContextMenuContributors,
} from './registry/sidebar-item-menu'
import { sessionContextMenuCommands, sessionContextMenuContributors } from './registry/session-menu'
import type { ContextMenuGroupConfig } from './types'

export const editorContextMenuCommands = {
  ...noteContextMenuCommands,
  ...sidebarItemContextMenuCommands,
  ...creationContextMenuCommands,
  ...mapPinContextMenuCommands,
  ...sessionContextMenuCommands,
  ...editorPanelContextMenuCommands,
  ...sharingContextMenuCommands,
  ...downloadContextMenuCommands,
  ...filesystemContextMenuCommands,
}

export const editorContextMenuContributors = [
  ...noteContextMenuContributors,
  ...sidebarItemContextMenuContributors,
  ...creationContextMenuContributors,
  ...mapPinContextMenuContributors,
  ...sessionContextMenuContributors,
  ...editorPanelContextMenuContributors,
  ...sharingContextMenuContributors,
  ...downloadContextMenuContributors,
  ...filesystemContextMenuContributors,
]

export const groupConfig: ContextMenuGroupConfig = {
  primary: { label: null, priority: 0 },
  create: { label: null, priority: 1 },
  share: { label: null, priority: 2 },
  download: { label: null, priority: 3 },
  edit: { label: null, priority: 4 },
  navigation: { label: null, priority: 5 },
  'pin-actions': { label: null, priority: 6 },
  panels: { label: null, priority: 7 },
  danger: { label: null, priority: 99 },
}
