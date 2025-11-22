import { SidebarItem, SIDEBAR_ITEM_TYPES, AnySidebarItem } from "../sidebarItems/types";

export const UNTITLED_FOLDER_NAME = 'Untitled Folder';

export type Folder = SidebarItem<typeof SIDEBAR_ITEM_TYPES.folders> & {
  children?: AnySidebarItem[]
}

