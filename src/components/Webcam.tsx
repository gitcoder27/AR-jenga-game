import { useEffect, useRef } from 'react'

interface WebcamProps {
  onVideoReady: (video: HTMLVideoElement) => void
}

export default function Webcam({ onVideoReady }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play()
             onVideoReady(videoRef.current!)
          }
        }
      } catch (err) {
        console.error('Error accessing webcam:', err)
      }
    }

    startWebcam()
  }, [onVideoReady])

  return (
    <video
      ref={videoRef}
      data-testid="webcam-video"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: 0, 
        width: 1, 
        height: 1,
        pointerEvents: 'none',
      }}
      playsInline
      // muted // Good practice for auto-play
    />
  )
}