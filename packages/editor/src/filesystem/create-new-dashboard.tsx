import { useState } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import { CreateNewDashboardSurface } from './create-new-dashboard-surface'
import type { CreateItemOption } from './create-item-options'
import { handleError } from '../errors/handle-error'
import type { CreateItemSource } from './create-item-source'

interface CreateNewDashboardProps {
  parentId: SidebarItemId | null
  folderPath?: string
  source: CreateItemSource
}

export function CreateNewDashboard({ parentId, folderPath, source }: CreateNewDashboardProps) {
  const [creatingKey, setCreatingKey] = useState<CreateItemOption['key'] | null>(null)

  const isDisabled = creatingKey !== null

  const handleCreate = async (option: CreateItemOption) => {
    if (isDisabled) return

    setCreatingKey(option.key)
    try {
      const result = await source.createItem({
        name: option.defaultName,
        type: option.type,
        parentId,
      })
      if (result.status !== 'completed') {
        handleError(new Error(`Create item returned ${result.status}`), 'Failed to create item')
        return
      }
      try {
        await source.openItem(result.id)
      } catch (error) {
        handleError(error, 'Created item, but failed to open it')
      }
    } catch (error) {
      handleError(error, 'Failed to create item')
    } finally {
      setCreatingKey(null)
    }
  }

  return (
    <CreateNewDashboardSurface
      folderPath={folderPath}
      creatingKey={creatingKey}
      disabled={isDisabled}
      onCreate={(option) => void handleCreate(option)}
    />
  )
}
