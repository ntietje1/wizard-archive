import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { ErrorFallback } from '../error-fallback'

describe('ErrorFallback', () => {
  it('links the stack trace toggle to the controlled stack panel', () => {
    const error = new Error('Broken')
    error.stack = 'Broken stack'

    render(<ErrorFallback error={error} />)

    const toggle = screen.getByRole('button', { name: 'Stack trace' })
    const stackTraceId = toggle.getAttribute('aria-controls')
    expect(stackTraceId).toBeTruthy()

    const stackTrace = document.getElementById(stackTraceId ?? '')
    expect(stackTrace).toHaveAttribute('hidden')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(stackTrace).not.toHaveAttribute('hidden')
  })
})
