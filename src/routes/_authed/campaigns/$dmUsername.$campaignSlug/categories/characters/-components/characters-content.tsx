import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { Users, Edit, Plus, Trash2 } from '~/lib/icons'
import { toast } from 'sonner'
import { useRouter } from '@tanstack/react-router'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import type { Character } from 'convex/characters/types'
import { CHARACTER_CONFIG } from '~/components/forms/category-tag-dialogs/character-tag-dialog/types'
import CharacterDialog from '~/components/forms/category-tag-dialogs/character-tag-dialog/character-dialog'

export default function CharactersContent() {
  const { campaignWithMembership, dmUsername, campaignSlug } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const router = useRouter()

  const [creatingCharacter, setCreatingCharacter] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  )
  const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const characters = useQuery(
    convexQuery(
      api.characters.queries.getCharactersByCampaign,
      campaign?._id
        ? {
            campaignId: campaign?._id,
          }
        : 'skip',
    ),
  )

  const deleteCharacter = useMutation({
    mutationFn: useConvexMutation(api.characters.mutations.deleteCharacter),
  })

  const handleDeleteCharacter = async () => {
    if (!deletingCharacter) return

    setIsDeleting(true)

    try {
      await deleteCharacter.mutateAsync({
        characterId: deletingCharacter.characterId,
      })

      toast.success('Character deleted successfully')
      setDeletingCharacter(null)
    } catch (_) {
      toast.error('Failed to delete character')
    } finally {
      setIsDeleting(false)
    }
  }

  if (
    campaignWithMembership.status === 'pending' ||
    characters.status === 'pending' ||
    !characters.data
  ) {
    return <CharactersContentLoading />
  }

  return (
    <>
      <ContentGrid>
        {characters.data?.length > 0 && (
          <CreateActionCard
            onClick={() => setCreatingCharacter(true)}
            title="New Character"
            description="Add a new character to your campaign"
            icon={Users}
          />
        )}

        {characters.data?.map((character) => (
          <ContentCard
            key={character.characterId}
            title={character.name}
            description={character.description}
            color={character.color}
            badges={[
              {
                text: 'Character',
                icon: Users,
                variant: 'secondary',
              },
            ]}
            onClick={() =>
              router.navigate({
                to: '/campaigns/$dmUsername/$campaignSlug/categories/characters/$characterId',
                params: {
                  dmUsername,
                  campaignSlug,
                  characterId: character.characterId,
                },
              })
            }
            actionButtons={[
              {
                icon: Edit,
                onClick: (e) => {
                  e.stopPropagation()
                  setEditingCharacter(character)
                },
                'aria-label': 'Edit character',
              },
              {
                icon: Trash2,
                onClick: (e) => {
                  e.stopPropagation()
                  setDeletingCharacter(character)
                },
                'aria-label': 'Delete character',
                variant: 'destructive-subtle',
              },
            ]}
          />
        ))}

        {characters.data?.length === 0 && (
          <EmptyState
            icon={Users}
            title="No characters yet"
            description="Create your first character to start building your campaign's cast. Each character will automatically get a tag for use in your notes."
            action={{
              label: 'Create First Character',
              onClick: () => setCreatingCharacter(true),
              icon: Plus,
            }}
          />
        )}
      </ContentGrid>

      {creatingCharacter && (
        <CharacterDialog
          mode="create"
          isOpen={creatingCharacter}
          config={CHARACTER_CONFIG}
          onClose={() => setCreatingCharacter(false)}
        />
      )}

      {editingCharacter && (
        <CharacterDialog
          mode="edit"
          isOpen={true}
          onClose={() => setEditingCharacter(null)}
          config={CHARACTER_CONFIG}
          tag={editingCharacter}
        />
      )}

      <ConfirmationDialog
        isOpen={!!deletingCharacter}
        onClose={() => setDeletingCharacter(null)}
        onConfirm={handleDeleteCharacter}
        title="Delete Character"
        description={`Are you sure you want to delete "${deletingCharacter?.name}"? This will also remove all references to this character in your notes. This action cannot be undone.`}
        confirmLabel="Delete Character"
        isLoading={isDeleting}
        icon={Users}
      />
    </>
  )
}

function CharactersContentLoading() {
  return (
    <CardGridSkeleton count={6} showCreateCard={true} cardHeight="h-[180px]" />
  )
}
