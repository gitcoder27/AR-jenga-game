import { useEffect, useRef, useState, useCallback } from 'react'
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'

export default function useHandTracking() {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const createHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        )
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
        
        setIsReady(true)
      } catch (error) {
        console.error('Error initializing HandLandmarker:', error)
      }
    }

    createHandLandmarker()

    return () => {
        handLandmarkerRef.current?.close()
    }
  }, [])

  const detect = useCallback((video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
      if (!handLandmarkerRef.current || !isReady) return null
      if (video.videoWidth === 0 || video.videoHeight === 0) return null
      return handLandmarkerRef.current.detectForVideo(video, timestamp)
  }, [isReady])

  return { detect, isReady }
}