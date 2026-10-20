import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { HAND_MODEL_PATH, MEDIAPIPE_WASM_PATH } from '../tracking/assets'
import { useGameStore, type TrackingDelegate } from '../store/gameStore'

const DELEGATES: TrackingDelegate[] = ['GPU', 'CPU']

/**
 * Loads the MediaPipe hand landmarker from self-hosted assets, trying the GPU
 * delegate first and falling back to CPU. Progress and failures go to the
 * store's trackingStatus so the HUD can show them (H-9).
 */
export default function useHandTracking() {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const attempt = useGameStore((state) => state.trackingAttempt)

  useEffect(() => {
    // StrictMode mounts twice and Retry re-runs this: an instance that finishes
    // loading after cleanup is closed instead of leaking a second model.
    let cancelled = false
    const { setTrackingStatus, setTrackingDelegate } = useGameStore.getState()
    setTrackingStatus('loading')

    const create = async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)
      let lastError: unknown = null
      for (const delegate of DELEGATES) {
        try {
          const landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate },
            runningMode: 'VIDEO',
            numHands: 1,
          })
          return { landmarker, delegate }
        } catch (error) {
          console.warn(`HandLandmarker ${delegate} delegate failed:`, error)
          lastError = error
        }
      }
      throw lastError
    }

    create().then(({ landmarker, delegate }) => {
      if (cancelled) {
        landmarker.close()
        return
      }
      handLandmarkerRef.current = landmarker
      setTrackingDelegate(delegate)
      setTrackingStatus('no-hand')
      setIsReady(true)
    }).catch((error) => {
      if (cancelled) return
      console.error('Error initializing HandLandmarker:', error)
      setTrackingStatus('error', error instanceof Error ? error.message : String(error))
    })

    return () => {
      cancelled = true
      handLandmarkerRef.current?.close()
      handLandmarkerRef.current = null
      setIsReady(false)
    }
  }, [attempt])

  const detect = useCallback((video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
    if (!handLandmarkerRef.current || !isReady) return null
    if (video.videoWidth === 0 || video.videoHeight === 0) return null
    return handLandmarkerRef.current.detectForVideo(video, timestamp)
  }, [isReady])

  return { detect, isReady }
}
