import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/$characterId',
)({
  component: CharacterDetailPage,
})

function CharacterDetailPage() {
  const characterId = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/$characterId',
  })?.characterId

  const character = useQuery(
    convexQuery(api.characters.queries.getCharacterById, {
      characterId: characterId as Id<'characters'>,
    }),
  )

  if (character.status === 'error') {
    return <div>Error</div>
  }

  if (character.status === 'pending') {
    return <div>Loading...</div>
  }

  return <div>{character.data?.name}</div>
}
