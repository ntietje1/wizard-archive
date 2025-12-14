import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'

export const useTagActions = () => {
  const updateTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTag),
  })
  const deleteTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTag),
  })
  const moveTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.moveTag),
  })

  return {
    updateTag,
    deleteTag,
    moveTag,
  }
}
