import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

interface WebcamProps {
  onVideoReady: (video: HTMLVideoElement) => void
}

export default function Webcam({ onVideoReady }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isWebcamVisible = useGameStore((state) => state.isWebcamVisible)
  const [error, setError] = useState<string | null>(null)

  const startWebcam = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          onVideoReady(videoRef.current!)
        }
      }
    } catch (err) {
      console.error('Error accessing webcam:', err)
      setError('Camera access required')
    }
  }, [onVideoReady])

  useEffect(() => {
    startWebcam()

    return () => {
      console.log('Webcam cleanup running...')
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('Webcam track stopped:', track.label)
        })
        streamRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        data-testid="webcam-video"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 240,
          height: 135,
          border: '2px solid #00e5ff',
          borderRadius: '8px',
          zIndex: 150,
          transform: 'scaleX(-1)', // Mirror
          display: isWebcamVisible && !error ? 'block' : 'none',
          pointerEvents: 'none',
          objectFit: 'cover',
          boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)'
        }}
        playsInline
      />
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          color: 'white',
          fontFamily: 'sans-serif'
        }}>
          <h2>Camera access required</h2>
          <p>Please enable camera access to play.</p>
          <button
            onClick={startWebcam}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              fontSize: 16,
              background: '#00e5ff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
    </>
  )
}