import { createContext, useContext, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvex } from '@convex-dev/react-query'
import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import type { QueryCollectionUtils } from '@tanstack/query-db-collection'
import type { Collection } from '@tanstack/db'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'

export type SidebarItemsCollection = Collection<
  AnySidebarItem,
  string,
  QueryCollectionUtils<AnySidebarItem, string, AnySidebarItem>
>

const SidebarItemsCollectionContext =
  createContext<SidebarItemsCollection | null>(null)

export function useSidebarItemsCollection(): SidebarItemsCollection | null {
  return useContext(SidebarItemsCollectionContext)
}

export function SidebarItemsCollectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const campaignId = campaignWithMembership.data?.campaign._id
  const queryClient = useQueryClient()
  const convex = useConvex()

  const collection = useMemo(() => {
    if (!campaignId) return null

    const options = queryCollectionOptions({
      id: `sidebar-items-${campaignId}-${viewAsPlayerId ?? 'dm'}`,
      queryKey: ['sidebarItemsCollection', campaignId, viewAsPlayerId ?? 'dm'],
      queryFn: async (): Promise<Array<AnySidebarItem>> => {
        return await convex.query(api.sidebarItems.queries.getAllSidebarItems, {
          campaignId,
          viewAsPlayerId,
        })
      },
      getKey: (item) => item._id as string,
      queryClient,
      refetchInterval: 3000,
      onUpdate: async ({ transaction }) => {
        const mutations = transaction.mutations
        for (const m of mutations) {
          const item = m.original
          const changes = m.changes

          if (
            changes.parentId !== undefined &&
            changes.parentId !== item.parentId
          ) {
            const newParentId = changes.parentId as Id<'folders'> | undefined
            switch (item.type) {
              case SIDEBAR_ITEM_TYPES.notes:
                await convex.mutation(api.notes.mutations.moveNote, {
                  noteId: item._id,
                  parentId: newParentId,
                })
                break
              case SIDEBAR_ITEM_TYPES.folders:
                await convex.mutation(api.folders.mutations.moveFolder, {
                  folderId: item._id,
                  parentId: newParentId,
                })
                break
              case SIDEBAR_ITEM_TYPES.gameMaps:
                await convex.mutation(api.gameMaps.mutations.moveMap, {
                  mapId: item._id,
                  parentId: newParentId,
                })
                break
              case SIDEBAR_ITEM_TYPES.files:
                await convex.mutation(api.files.mutations.moveFile, {
                  fileId: item._id,
                  parentId: newParentId,
                })
                break
            }
          } else {
            await convex.mutation(
              api.sidebarItems.mutations.updateSidebarItem,
              {
                itemId: item._id,
                name: changes.name,
                iconName:
                  changes.iconName !== undefined
                    ? (changes.iconName ?? null)
                    : undefined,
                color:
                  changes.color !== undefined
                    ? (changes.color ?? null)
                    : undefined,
              },
            )
          }
        }
      },
      onDelete: async ({ transaction }) => {
        const mutations = transaction.mutations
        for (const m of mutations) {
          const item = m.original
          switch (item.type) {
            case SIDEBAR_ITEM_TYPES.notes:
              await convex.mutation(api.notes.mutations.deleteNote, {
                noteId: item._id,
              })
              break
            case SIDEBAR_ITEM_TYPES.folders:
              await convex.mutation(api.folders.mutations.deleteFolder, {
                folderId: item._id,
              })
              break
            case SIDEBAR_ITEM_TYPES.gameMaps:
              await convex.mutation(api.gameMaps.mutations.deleteMap, {
                mapId: item._id,
              })
              break
            case SIDEBAR_ITEM_TYPES.files:
              await convex.mutation(api.files.mutations.deleteFile, {
                fileId: item._id,
              })
              break
          }
        }
      },
    })

    return createCollection(options)
  }, [campaignId, viewAsPlayerId, queryClient, convex])

  return (
    <SidebarItemsCollectionContext.Provider value={collection}>
      {children}
    </SidebarItemsCollectionContext.Provider>
  )
}
