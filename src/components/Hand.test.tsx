import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Hand from './Hand'

describe('Hand Component', () => {
  it('renders null when no result', () => {
    const { container } = render(<Hand result={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when empty landmarks', () => {
      const emptyResult = { landmarks: [], worldLandmarks: [], handedness: [] }
      const { container } = render(<Hand result={emptyResult} />)
      expect(container.firstChild).toBeNull()
  })
})
