import { useCallback, useEffect } from 'react'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import {
  validateTagDescription,
  validateTagName,
} from '../generic-tag-form/validators.ts'
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type TagCategoryConfig,
} from '../base-tag-form/types.ts'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { useEditorNavigation } from '~/hooks/useEditorNavigation.ts'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Character } from 'convex/characters/types.ts'
import {
  defaultCharacterFormValues,
  type CharacterFormValues,
} from './types.ts'
import {
  NameField,
  DescriptionField,
  ColorField,
  ImageUploadField,
  SubmitButtons,
} from '../generic-tag-form/fields.tsx'
import { PlayerField } from './fields.tsx'

interface CharacterTagFormProps {
  mode: 'create' | 'edit'
  character?: Character
  config: TagCategoryConfig
  parentId?: SidebarItemId
  isOpen: boolean
  onClose: () => void
}

export default function CharacterTagForm({
  mode,
  character,
  config,
  parentId,
  isOpen,
  onClose,
}: CharacterTagFormProps) {
  const convex = useConvex()
  const { campaignWithMembership } = useCampaign()
  const { navigateToTag } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaign = campaignWithMembership?.data?.campaign

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
            campaignId: campaign?._id,
          }
        : 'skip',
    ),
  )

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign?._id,
            slug: config.categorySlug,
          }
        : 'skip',
    ),
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

  const getInitialValues = useCallback((): CharacterFormValues => {
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
  }, [character, mode])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  useEffect(() => {
    form.reset(getInitialValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?._id, parentId])

  async function handleSubmit(value: CharacterFormValues) {
    if (!campaign) {
      toast.error('Campaign not found')
      return
    }

    if (!getCategory.data) {
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
        const result = await createMutation.mutateAsync({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentId: parentId ?? getCategory.data._id,
          playerId: value.playerId || undefined,
        })

        // Open parent folders and get the tag to navigate to it
        await openParentFolders(result.tagId)
        const tag = await convex.query(api.tags.queries.getTag, {
          campaignId: campaign._id,
          tagId: result.tagId,
        })
        if (tag?.slug) {
          navigateToTag(tag.slug)
        }

        toast.success(`${config.singular} created successfully`)
        onClose()
      } else if (mode === 'edit' && character) {
        await updateCharacterMutation.mutateAsync({
          characterId: character.characterId,
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId,
          playerId: value.playerId || undefined,
        })

        toast.success(`${config.singular} updated successfully`)
        onClose()
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${config.singular.toLowerCase()}`)
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
            config={config}
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
            config={config}
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
            categoryDefaultColor={getCategory.data?.defaultColor}
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
