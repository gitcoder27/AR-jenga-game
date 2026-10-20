import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import useHandTracking from './useHandTracking'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { useGameStore } from '../store/gameStore'
import { HAND_MODEL_PATH, MEDIAPIPE_WASM_PATH } from '../tracking/assets'

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(),
  },
  HandLandmarker: {
    createFromOptions: vi.fn(),
    HAND_CONNECTIONS: [],
  },
}))

type Landmarker = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>
type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
const fakeLandmarker = () => ({ detectForVideo: vi.fn(), close: vi.fn() }) as unknown as Landmarker
const delegateOf = (call: unknown[]) => (call[1] as { baseOptions: { delegate: string } }).baseOptions.delegate

describe('useHandTracking', () => {
  beforeEach(() => {
    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue('wasm-binary' as unknown as Fileset)
    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(fakeLandmarker())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('loads the self-hosted WASM and model on the GPU and reports no-hand when ready', async () => {
    const { result } = renderHook(() => useHandTracking())

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(MEDIAPIPE_WASM_PATH)
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledWith(
      'wasm-binary',
      expect.objectContaining({
        baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate: 'GPU' },
        runningMode: 'VIDEO',
      }),
    )
    expect(useGameStore.getState()).toMatchObject({ trackingStatus: 'no-hand', trackingDelegate: 'GPU' })
  })

  it('falls back to the CPU delegate when the GPU fails', async () => {
    vi.mocked(HandLandmarker.createFromOptions)
      .mockRejectedValueOnce(new Error('WebGL unavailable'))
      .mockResolvedValueOnce(fakeLandmarker())
    const { result } = renderHook(() => useHandTracking())

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(vi.mocked(HandLandmarker.createFromOptions).mock.calls.map(delegateOf)).toEqual(['GPU', 'CPU'])
    expect(useGameStore.getState().trackingDelegate).toBe('CPU')
  })

  it('reports an error when the model cannot load, and retries on request', async () => {
    vi.mocked(HandLandmarker.createFromOptions).mockRejectedValue(new Error('model blocked'))
    const { result } = renderHook(() => useHandTracking())

    await waitFor(() => expect(useGameStore.getState().trackingStatus).toBe('error'))
    expect(useGameStore.getState().trackingError).toBe('model blocked')

    vi.mocked(HandLandmarker.createFromOptions).mockResolvedValue(fakeLandmarker())
    act(() => useGameStore.getState().retryTracking())
    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(useGameStore.getState().trackingStatus).toBe('no-hand')
  })

  it('closes a landmarker that finishes loading after unmount', async () => {
    const late = fakeLandmarker()
    let resolve!: (l: Landmarker) => void
    vi.mocked(HandLandmarker.createFromOptions).mockReturnValue(new Promise((r) => { resolve = r }))
    const { unmount } = renderHook(() => useHandTracking())
    await waitFor(() => expect(HandLandmarker.createFromOptions).toHaveBeenCalled())

    unmount()
    resolve(late)
    await waitFor(() => expect(late.close).toHaveBeenCalled())
  })
})
