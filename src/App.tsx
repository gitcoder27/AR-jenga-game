import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import './App.css'
import Webcam from './components/Webcam'
import Hand from './components/Hand'
import Floor from './components/Floor'
import Tower from './components/Tower'
import useHandTracking from './hooks/useHandTracking'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

function App() {
  const { detect, isReady } = useHandTracking()
  const [cameraActive, setCameraActive] = useState(false)
  const [result, setResult] = useState<HandLandmarkerResult | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const requestRef = useRef<number>(0)

  useEffect(() => {
    if (isReady && videoElement && cameraActive) {
        const loop = () => {
            const res = detect(videoElement, performance.now())
            if (res) setResult(res)
            requestRef.current = requestAnimationFrame(loop)
        }
        loop()
        return () => cancelAnimationFrame(requestRef.current)
    }
  }, [isReady, videoElement, cameraActive, detect])

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Webcam onVideoReady={(vid) => {
          setCameraActive(true)
          setVideoElement(vid)
      }} />
      
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 10 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Virtual Hand Jenga</h1>
        <p>Camera: {cameraActive ? 'Active' : 'Initializing...'}</p>
        <p>Tracking: {isReady ? 'Ready' : 'Loading Model...'}</p>
        <p>Hands Detected: {result?.landmarks?.length || 0}</p>
      </div>

      <Canvas camera={{ position: [0, 10, 20] }}>
          <Physics gravity={[0, -9.81, 0]}>
              <color attach="background" args={['#111']} />
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              
              <Floor />
              <Tower />
              <Hand result={result} />
              
              <OrbitControls />
              <gridHelper args={[20, 20]} />
          </Physics>
      </Canvas>
    </div>
  )
}

export default App
