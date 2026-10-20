/**
 * Call `onFrame` once per new video frame, with a timestamp on the
 * performance.now() clock (H-8). Uses requestVideoFrameCallback where the
 * browser has it. Otherwise it polls on animation frames and skips frames
 * whose `currentTime` hasn't changed, so a 120 Hz display doesn't run
 * inference 4× on each 30 fps camera image. Returns a function that stops it.
 */
export function onVideoFrames(video: HTMLVideoElement, onFrame: (now: number) => void): () => void {
    let stopped = false;
    if (typeof video.requestVideoFrameCallback === 'function') {
        let handle = 0;
        const tick = (now: number) => {
            if (stopped) return;
            onFrame(now);
            handle = video.requestVideoFrameCallback(tick);
        };
        handle = video.requestVideoFrameCallback(tick);
        return () => {
            stopped = true;
            video.cancelVideoFrameCallback(handle);
        };
    }

    let lastTime = -1;
    let raf = 0;
    const loop = (now: number) => {
        if (stopped) return;
        if (video.currentTime !== lastTime) {
            lastTime = video.currentTime;
            onFrame(now);
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
        stopped = true;
        cancelAnimationFrame(raf);
    };
}
