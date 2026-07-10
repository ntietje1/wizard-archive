import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import {
  CanvasFeatureDemo,
  HeroProductDemo,
  MapFeatureDemo,
  SharingFeatureDemo,
  TemplateFeatureDemo,
  WorkspaceFeatureDemo,
} from '../landing-feature-demos'

describe('landing feature demos', () => {
  it('renders landing demo wrapper loading fallbacks inside elevated frames', () => {
    render(
      <>
        <HeroProductDemo />
        <WorkspaceFeatureDemo />
        <CanvasFeatureDemo />
        <MapFeatureDemo />
        <SharingFeatureDemo />
        <TemplateFeatureDemo />
      </>,
    )

    expect(
      screen.getByRole('status', { name: 'Loading landing campaign workspace preview' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading workspace demo' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading canvas preview' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading map preview' })).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Loading collaborative note preview' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Loading template note preview' }),
    ).toBeInTheDocument()
  })
})
