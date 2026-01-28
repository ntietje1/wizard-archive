import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export function NavigationProgress() {
  const { isLoading, location, resolvedLocation } = useRouterState({
    select: (s) => ({
      isLoading: s.isLoading,
      location: s.location,
      resolvedLocation: s.resolvedLocation,
    }),
  })

  const isSamePage =
    location.pathname === resolvedLocation?.pathname &&
    location.searchStr === resolvedLocation?.searchStr
  const [state, setState] = useState<
    'idle' | 'loading' | 'completing' | 'fading'
  >('idle')

  useEffect(() => {
    if (isLoading && !isSamePage) {
      setState('loading')
    } else if (state === 'loading') {
      setState('completing')
    }
  }, [isLoading, isSamePage, state])

  useEffect(() => {
    if (state === 'completing') {
      const fadeTimeout = setTimeout(() => setState('fading'), 500)
      return () => clearTimeout(fadeTimeout)
    } else if (state === 'fading') {
      const unmountTimeout = setTimeout(() => setState('idle'), 200)
      return () => clearTimeout(unmountTimeout)
    }
  }, [state])

  if (state === 'idle') return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 h-0.5 origin-top transition-transform duration-200 ease-out ${
        state === 'fading' ? 'scale-y-0' : 'scale-y-100'
      }`}
    >
      <div
        className={`h-full w-full origin-left bg-purple-500 ${
          state === 'loading'
            ? 'animate-progress-load'
            : 'animate-progress-complete'
        }`}
      />
    </div>
  )
}
