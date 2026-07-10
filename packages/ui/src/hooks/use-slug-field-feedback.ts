import { useEffect, useRef, useState } from 'react'

export function useSlugFieldFeedback(delayMs = 400) {
  const [showFeedback, setShowFeedback] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFeedbackTimer = () => {
    if (!timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const scheduleFeedback = () => {
    setShowFeedback(false)
    clearFeedbackTimer()
    timerRef.current = setTimeout(() => {
      setShowFeedback(true)
      timerRef.current = null
    }, delayMs)
  }

  const showFeedbackNow = () => {
    clearFeedbackTimer()
    setShowFeedback(true)
  }

  useEffect(
    () => () => {
      if (!timerRef.current) return
      clearTimeout(timerRef.current)
      timerRef.current = null
    },
    [],
  )

  return {
    showFeedback,
    scheduleFeedback,
    showFeedbackNow,
  }
}
