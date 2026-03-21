import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { authClient } from '~/lib/auth-client'

type UseAutoSignInOnVerifyArgs = {
  email: string
  password: string
  enabled?: boolean
  onSuccess: () => void
}

export function useAutoSignInOnVerify({
  email,
  password,
  enabled = true,
  onSuccess,
}: UseAutoSignInOnVerifyArgs) {
  const [signingIn, setSigningIn] = useState(false)
  const [autoSignInFailed, setAutoSignInFailed] = useState(false)
  const autoSignInAttempted = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const { data: verified } = useQuery({
    ...convexQuery(api.users.queries.isEmailVerified, { email }),
    enabled,
  })

  useEffect(() => {
    if (!verified || autoSignInAttempted.current) return
    autoSignInAttempted.current = true
    setSigningIn(true)

    authClient.signIn
      .email(
        { email, password },
        {
          onSuccess: () => {
            setSigningIn(false)
            onSuccess()
          },
          onError: () => {
            setSigningIn(false)
            setAutoSignInFailed(true)
          },
        },
      )
      .catch(() => {
        setSigningIn(false)
        setAutoSignInFailed(true)
      })
  }, [verified, email, password, onSuccess])

  return { verified, signingIn, autoSignInFailed }
}
