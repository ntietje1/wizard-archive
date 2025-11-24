import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export const useMapActions = () => {
  const updateMap = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.updateMap),
  })

  return {
    updateMap,
  }
}

