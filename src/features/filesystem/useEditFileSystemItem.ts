import { coerceSidebarItemColorForInput } from 'convex/sidebarItems/validation/color'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import { coerceSidebarItemIconNameForInput } from 'convex/sidebarItems/validation/icon'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import type { SidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useFileSystem } from '~/features/filesystem/useFileSystem'

interface EditItemBase {
  name?: string
  iconName?: string | null
  color?: string | null
}

type EditItemResult = { slug: SidebarItemSlug }

type EditItemFn = (args: EditItemBase & { item: AnySidebarItem }) => Promise<EditItemResult>

type NormalizedSidebarMetadataUpdate = {
  name?: SidebarItemName
  iconName?: SidebarItemIconName | null
  color?: SidebarItemColor | null
}

function normalizeSidebarMetadataUpdate(
  args: EditItemBase & { item: AnySidebarItem },
  validation: SidebarValidation,
): NormalizedSidebarMetadataUpdate {
  const trimmedName = args.name === undefined ? undefined : args.name.trim()
  if (trimmedName !== undefined) {
    const result = validation.validateName(trimmedName, args.item.parentId, args.item._id)
    if (!result.valid) throw new Error(result.error)
  }

  return {
    name: trimmedName === undefined ? undefined : assertSidebarItemName(trimmedName),
    iconName:
      args.iconName === undefined || args.iconName === null
        ? args.iconName
        : coerceSidebarItemIconNameForInput(args.iconName),
    color:
      args.color === undefined || args.color === null
        ? args.color
        : coerceSidebarItemColorForInput(args.color),
  }
}

export function useEditFileSystemItem() {
  const validation = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const filesystem = useFileSystem()

  const editItem: EditItemFn = async (
    args: EditItemBase & { item: AnySidebarItem },
  ): Promise<EditItemResult> => {
    const { item } = args
    const metadataUpdate = normalizeSidebarMetadataUpdate(args, validation)

    const currentSlug = getSelectedSlug()
    const isCurrentItem = item.slug === currentSlug

    const hasMetadataUpdate =
      metadataUpdate.name !== undefined ||
      metadataUpdate.iconName !== undefined ||
      metadataUpdate.color !== undefined
    const rename = hasMetadataUpdate
      ? await filesystem.renameItem({
          itemId: item._id,
          name: metadataUpdate.name,
          iconName: metadataUpdate.iconName,
          color: metadataUpdate.color,
        })
      : null
    const slug = rename?.slug ?? item.slug

    if (slug !== item.slug && isCurrentItem) {
      await navigateToItem(slug, true)
    }

    return { slug }
  }

  return { editItem }
}
