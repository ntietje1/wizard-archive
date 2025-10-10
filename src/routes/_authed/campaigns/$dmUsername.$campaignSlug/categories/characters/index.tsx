import { createFileRoute } from '@tanstack/react-router'
import CharactersContent from './-components/characters-content'
import CharactersHeader from './-components/characters-header'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/',
)({
  component: CharactersIndexPage,
})

function CharactersIndexPage() {
  return (
    <div className="flex-1 p-6">
      <CharactersHeader />
      <CharactersContent />
    </div>
  )
}
