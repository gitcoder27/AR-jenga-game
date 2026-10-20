import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SceneErrorBoundary from './SceneErrorBoundary'

let shouldThrow = true
function Scene() {
    if (shouldThrow) throw new Error('RuntimeError: unreachable')
    return <div>scene</div>
}

describe('SceneErrorBoundary', () => {
    it('shows a Restart prompt instead of a blank screen, and remounts the scene on restart', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const onRestart = vi.fn()
        render(<SceneErrorBoundary onRestart={onRestart}><Scene /></SceneErrorBoundary>)

        expect(screen.getByRole('alert')).toHaveTextContent('unreachable')
        shouldThrow = false
        fireEvent.click(screen.getByRole('button', { name: 'RESTART' }))

        expect(onRestart).toHaveBeenCalledOnce()
        expect(screen.getByText('scene')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).toBeNull()
    })
})
