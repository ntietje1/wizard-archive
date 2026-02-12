import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvex } from '@convex-dev/react-query'
import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { CreateItemArgs } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import {
  PendingCreateArgsContext,
  PendingItemNameContext,
  SidebarItemsCollectionContext,
} from '~/hooks/useSidebarItemsCollection'

export function SidebarItemsCollectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const queryClient = useQueryClient()
  const convex = useConvex()
  const pendingCreateArgsRef = useRef<Map<string, CreateItemArgs>>(new Map())
  const [pendingItemName, setPendingItemName] = useState('')

  const collection = useMemo(() => {
    if (!campaignId) return null

    const pendingCreateArgs = pendingCreateArgsRef.current

    const options = queryCollectionOptions({
      id: `sidebar-items-${campaignId}`,
      queryKey: ['sidebarItemsCollection', campaignId],
      queryFn: async (): Promise<Array<AnySidebarItem>> => {
        try {
          return await convex.query(
            api.sidebarItems.queries.getAllSidebarItems,
            { campaignId },
          )
        } catch {
          // Auth may not be ready yet; return empty and let refetchInterval retry
          return []
        }
      },
      getKey: (item) => item._id as string,
      queryClient,
      refetchInterval: 3000,
      onInsert: async ({ transaction }) => {
        for (const m of transaction.mutations) {
          const item = m.modified
          const args = pendingCreateArgs.get(item._id as string)
          pendingCreateArgs.delete(item._id as string)

          if (!args) continue

          switch (args.type) {
            case SIDEBAR_ITEM_TYPES.notes:
              await convex.mutation(api.notes.mutations.createNote, {
                campaignId: args.campaignId,
                name: args.name,
                parentId: args.parentId,
                iconName: args.iconName,
                color: args.color,
                content: args.content,
                slug: item.slug,
              })
              break
            case SIDEBAR_ITEM_TYPES.folders:
              await convex.mutation(api.folders.mutations.createFolder, {
                campaignId: args.campaignId,
                name: args.name,
                parentId: args.parentId,
                slug: item.slug,
                iconName: args.iconName,
                color: args.color,
              })
              break
            case SIDEBAR_ITEM_TYPES.gameMaps:
              await convex.mutation(api.gameMaps.mutations.createMap, {
                campaignId: args.campaignId,
                name: args.name,
                parentId: args.parentId,
                imageStorageId: args.imageStorageId,
                slug: item.slug,
                iconName: args.iconName,
                color: args.color,
              })
              break
            case SIDEBAR_ITEM_TYPES.files:
              await convex.mutation(api.files.mutations.createFile, {
                campaignId: args.campaignId,
                name: args.name,
                parentId: args.parentId,
                storageId: args.storageId,
                slug: item.slug,
                iconName: args.iconName,
                color: args.color,
              })
              break
          }
        }
      },
      onUpdate: async ({ transaction }) => {
        const mutations = transaction.mutations
        for (const m of mutations) {
          const item = m.original
          if (item._optimistic) continue
          const changes = m.changes

          if (
            changes.parentId !== undefined &&
            changes.parentId !== item.parentId
          ) {
            const newParentId = changes.parentId
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
                slug: changes.slug,
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
          if (item._optimistic) continue
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
  }, [campaignId, queryClient, convex])

  const pendingItemNameValue = useMemo(
    () => ({ pendingItemName, setPendingItemName }),
    [pendingItemName],
  )

  return (
    <SidebarItemsCollectionContext.Provider value={collection}>
      <PendingCreateArgsContext.Provider value={pendingCreateArgsRef}>
        <PendingItemNameContext.Provider value={pendingItemNameValue}>
          {children}
        </PendingItemNameContext.Provider>
      </PendingCreateArgsContext.Provider>
    </SidebarItemsCollectionContext.Provider>
  )
}
