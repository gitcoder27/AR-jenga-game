import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface WebcamProps {
  onVideoReady: (video: HTMLVideoElement) => void
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

export default function Webcam({ onVideoReady }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isWebcamVisible = useGameStore((state) => state.isWebcamVisible)
  const [error, setError] = useState<string | null>(null)
  // Bumped by Retry to request the camera again
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // The request can resolve after unmount (exit during the permission prompt
    // or a slow camera start, or StrictMode's double mount). A late stream is
    // stopped at once so the camera never stays on (O-5).
    let cancelled = false
    let stream: MediaStream | null = null
    const video = videoRef.current

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    }).then((s) => {
      if (cancelled) {
        stopTracks(s)
        return
      }
      stream = s
      if (!video) return
      video.srcObject = s
      video.onloadedmetadata = () => {
        if (cancelled) return
        video.play().catch(() => { /* interrupted by unmount */ })
        onVideoReady(video)
      }
    }).catch((err) => {
      if (cancelled) return
      console.error('Error accessing webcam:', err)
      setError('Camera access required')
    })

    return () => {
      cancelled = true
      if (stream) stopTracks(stream)
      if (video) {
        video.onloadedmetadata = null
        video.srcObject = null
      }
    }
  }, [attempt, onVideoReady])

  const retry = () => {
    setError(null)
    setAttempt((n) => n + 1)
  }

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
            onClick={retry}
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