import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import useHandTracking from './useHandTracking'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(),
  },
  HandLandmarker: {
    createFromOptions: vi.fn(),
    HAND_CONNECTIONS: [],
  },
}))

describe('useHandTracking', () => {
  beforeEach(() => {
    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue('wasm-binary' as any)
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue({
      detectForVideo: vi.fn(),
      close: vi.fn(),
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes HandLandmarker on mount', async () => {
    renderHook(() => useHandTracking())

    await waitFor(() => {
        expect(FilesetResolver.forVisionTasks).toHaveBeenCalled()
    })
    
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledWith(
        'wasm-binary',
        expect.objectContaining({
            baseOptions: expect.objectContaining({
                modelAssetPath: expect.stringContaining('hand_landmarker.task')
            }),
            runningMode: 'VIDEO',
        })
    )
  })
})
