import { useMemo } from 'react'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  validateTagDescription,
  validateTagName,
} from '../generic-tag-form/validators.ts'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from '../base-tag-form/types.ts'
import {
  ColorField,
  DescriptionField,
  ImageUploadField,
  NameField,
  SubmitButtons,
} from '../generic-tag-form/fields.tsx'
import { defaultCharacterFormValues } from './types.ts'
import { PlayerField } from './fields.tsx'
import type { Id } from 'convex/_generated/dataModel'
import type { CharacterFormValues, CharacterTagFormProps } from './types.ts'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export default function CharacterTagForm({
  mode,
  character,
  campaignId,
  categoryId,
  parentId,
  isOpen,
  onClose,
}: CharacterTagFormProps) {
  const { campaignWithMembership } = useCampaign()
  const { navigateToTag } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaign = campaignWithMembership.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.mutations.createCharacter),
  })

  const updateCharacterMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.mutations.updateCharacter),
  })

  const playersQuery = useQuery(
    convexQuery(
      api.campaigns.queries.getPlayersByCampaign,
      campaign?._id
        ? {
            campaignId: campaign._id,
          }
        : 'skip',
    ),
  )

  const categoryQuery = useQuery(
    convexQuery(api.tags.queries.getTagCategory, { campaignId, categoryId }),
  )

  const imageUpload = useFileWithPreview({
    isOpen,
    fileStorageId: character?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  // Get initial values based on current props
  const defaultValues = useMemo((): CharacterFormValues => {
    if (mode === 'edit' && character) {
      return {
        name: character.name || '',
        description: character.description || '',
        color: character.color ?? null,
        playerId: character.playerId || undefined,
      }
    } else {
      return {
        ...defaultCharacterFormValues,
        color: null,
      }
    }
  }, [mode, character])

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  async function handleSubmit(value: CharacterFormValues) {
    if (!campaign) {
      toast.error('Campaign not found')
      return
    }

    if (!categoryQuery.data) {
      toast.error(`Category not found`)
      return
    }

    try {
      let imageStorageId: Id<'_storage'> | undefined = undefined

      if (imageUpload.file) {
        try {
          imageStorageId = await imageUpload.handleSubmit()
        } catch (error) {
          toast.error('Failed to upload image')
          console.error('Failed to upload image:', error)
          return
        }
      }

      if (mode === 'create') {
        const { tagId, slug } = await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId,
          campaignId: campaign._id,
          categoryId: categoryQuery.data._id,
          parentId: parentId ?? categoryQuery.data._id,
          playerId: value.playerId || undefined,
        })

        await openParentFolders(tagId)
        navigateToTag(slug)
        toast.success(
          `${categoryQuery.data.name || 'Tag'} created successfully`,
        )
        onClose()
      } else if (character) {
        await updateCharacterMutation.mutateAsync({
          characterId: character.characterId,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId,
          playerId: value.playerId || undefined,
        })

        toast.success(
          `${categoryQuery.data.name || 'Tag'} updated successfully`,
        )
        onClose()
      } else {
        toast.error('Invalid form state: missing character')
        return
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${categoryQuery.data.name || 'Tag'}`)
    }
  }

  const isFormDisabled = form.state.isSubmitting || imageUpload.isUploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      {/* Name Field */}
      <form.Field
        name="name"
        validators={{
          onMount: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
          onChange: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
        }}
      >
        {(field) => (
          <NameField
            field={field}
            categoryName={categoryQuery.data?.name || 'Tag'}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Description Field */}
      <form.Field
        name="description"
        validators={{
          onChange: ({ value }: { value: string }) =>
            validateTagDescription(value, MAX_DESCRIPTION_LENGTH),
        }}
      >
        {(field) => (
          <DescriptionField
            field={field}
            categoryName={categoryQuery.data?.name || 'Tag'}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Color Picker */}
      <form.Field name="color">
        {(field) => (
          <ColorField
            field={field}
            isDisabled={isFormDisabled}
            categoryDefaultColor={categoryQuery.data?.defaultColor}
          />
        )}
      </form.Field>

      {/* Player */}
      <form.Field name="playerId">
        {(field) => (
          <PlayerField
            field={field}
            players={playersQuery.data || []}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Image Upload Section */}
      <ImageUploadField
        label="Image"
        fileUpload={imageUpload}
        isSubmitting={form.state.isSubmitting}
        handleFileSelect={imageUpload.handleFileSelect}
      />

      {/* Submit Buttons */}
      <form.Subscribe
        selector={(s: { canSubmit: boolean; isSubmitting: boolean }) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => {
          return (
            <SubmitButtons
              mode={mode}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              imageUpload={imageUpload}
              nameValue={form.state.values.name}
              onClose={onClose}
            />
          )
        }}
      </form.Subscribe>
    </form>
  )
}
