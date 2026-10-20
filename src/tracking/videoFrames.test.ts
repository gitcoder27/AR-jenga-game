import { describe, it, expect, vi, afterEach } from 'vitest'
import { onVideoFrames } from './videoFrames'

describe('onVideoFrames (H-8)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('uses requestVideoFrameCallback: one call per camera frame, until stopped', () => {
        let pending: ((now: number) => void) | null = null
        const video = {
            requestVideoFrameCallback: vi.fn((cb: (now: number) => void) => { pending = cb; return 7 }),
            cancelVideoFrameCallback: vi.fn(),
        } as unknown as HTMLVideoElement
        const onFrame = vi.fn()
        const stop = onVideoFrames(video, onFrame)
        pending!(10)
        pending!(43)
        expect(onFrame.mock.calls).toEqual([[10], [43]])
        stop()
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7)
        pending!(76)
        expect(onFrame).toHaveBeenCalledTimes(2)
    })

    it('without it, polls animation frames but skips frames whose video time has not changed', () => {
        const frames: ((now: number) => void)[] = []
        vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => frames.push(cb))
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        const video = { currentTime: 0 } as HTMLVideoElement
        const onFrame = vi.fn()
        const stop = onVideoFrames(video, onFrame)
        // 120 Hz display, 30 fps camera: 4 animation frames per camera frame
        for (let i = 0; i < 8; i++) {
            video.currentTime = Math.floor(i / 4) / 30 + 0.001
            frames.at(-1)!(i * 8.3)
        }
        expect(onFrame).toHaveBeenCalledTimes(2)
        stop()
    })
})
