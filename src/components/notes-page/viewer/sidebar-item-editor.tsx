import { getViewerComponent, type EditorViewerProps } from "~/lib/editor-registry";

export function SidebarItemEditor({ item }: EditorViewerProps) {
    const ViewerComponent = getViewerComponent(item.type)!
    return <ViewerComponent item={item} />
}

