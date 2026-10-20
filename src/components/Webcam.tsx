import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { describeCameraError, type CameraErrorInfo } from '../tracking/cameraErrors'
import './Webcam.css'

interface WebcamProps {
  onVideoReady: (video: HTMLVideoElement) => void
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

/** A chosen camera, or the front one; the landmark model downscales anyway, so a smaller capture is cheaper to grab and decode (H-8) */
function constraints(deviceId: string | null): MediaStreamConstraints {
  return {
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  }
}

async function openCamera(deviceId: string | null): Promise<MediaStream> {
  // Missing on non-secure pages (http on a LAN address): describeCameraError says so (O-4)
  const media = navigator.mediaDevices
  if (!media?.getUserMedia) throw new Error('navigator.mediaDevices is unavailable')
  try {
    return await media.getUserMedia(constraints(deviceId))
  } catch (err) {
    // A camera that can't meet even the ideal sizes: ask for anything it can do
    if ((err as { name?: string }).name !== 'OverconstrainedError') throw err
    return media.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false })
  }
}

export default function Webcam({ onVideoReady }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isWebcamVisible = useGameStore((state) => state.isWebcamVisible)
  const [error, setError] = useState<CameraErrorInfo | null>(null)
  // Other cameras to offer when the error suggests one might work (O-4)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  // Bumped by Retry to request the camera again
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // The request can resolve after unmount (exit during the permission prompt
    // or a slow camera start, or StrictMode's double mount). A late stream is
    // stopped at once so the camera never stays on (O-5).
    let cancelled = false
    let stream: MediaStream | null = null
    const video = videoRef.current

    openCamera(deviceId).then((s) => {
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
      const info = describeCameraError(err, Boolean(navigator.mediaDevices?.getUserMedia))
      setError(info)
      if (info.offerPicker) {
        navigator.mediaDevices.enumerateDevices?.()
          .then((devices) => { if (!cancelled) setCameras(devices.filter((d) => d.kind === 'videoinput' && d.deviceId)) })
          .catch(() => { /* no list: Retry only */ })
      }
    })

    return () => {
      cancelled = true
      if (stream) stopTracks(stream)
      if (video) {
        video.onloadedmetadata = null
        video.srcObject = null
      }
    }
  }, [attempt, deviceId, onVideoReady])

  const retry = (camera: string | null = deviceId) => {
    setError(null)
    setCameras([])
    setDeviceId(camera)
    setAttempt((n) => n + 1)
  }

  return (
    <>
      <video
        ref={videoRef}
        data-testid="webcam-video"
        className="webcam-preview"
        style={{ display: isWebcamVisible && !error ? 'block' : 'none' }}
        playsInline
      />
      {error && (
        <div role="alert" data-error={error.kind} style={{
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
          <h2>{error.title}</h2>
          <p style={{ maxWidth: 480, padding: '0 16px', textAlign: 'center' }}>{error.detail}</p>
          <button
            onClick={() => retry()}
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
          {cameras.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              <span style={{ width: '100%', textAlign: 'center' }}>Or try:</span>
              {cameras.map((camera, i) => (
                <button
                  key={camera.deviceId}
                  onClick={() => retry(camera.deviceId)}
                  style={{ padding: '8px 14px', background: 'transparent', color: 'white', border: '1px solid #00e5ff', borderRadius: 4, cursor: 'pointer' }}
                >
                  {camera.label || `Camera ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}