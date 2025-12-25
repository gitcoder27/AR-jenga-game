import { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import './App.css'
import Webcam from './components/Webcam'
import Hand from './components/Hand'
import Floor from './components/Floor'
import Table from './components/Table'
import Tower from './components/Tower'
import useHandTracking from './hooks/useHandTracking'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useGameStore } from './store/gameStore'
import { Lighting } from './components/Lighting'
import { EnvironmentSetup } from './components/EnvironmentSetup'
import { StudioRoom } from './components/StudioRoom'
import { DepthCursor } from './components/DepthCursor'
import { HUD } from './components/HUD/HUD'
import StartScreen from './components/StartScreen/StartScreen'

function App() {
  const { detect, isReady } = useHandTracking()
  const [cameraActive, setCameraActive] = useState(false)
  const [result, setResult] = useState<HandLandmarkerResult | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const requestRef = useRef<number>(0)

  const gameId = useGameStore((state) => state.gameId)
  const gameMode = useGameStore((state) => state.gameMode)

  const handleVideoReady = useCallback((vid: HTMLVideoElement) => {
    setCameraActive(true)
    setVideoElement(vid)
  }, [])

  useEffect(() => {
    if (isReady && videoElement && cameraActive && gameMode !== 'MENU') {
      const loop = () => {
        const res = detect(videoElement, performance.now())
        if (res) setResult(res)
        requestRef.current = requestAnimationFrame(loop)
      }
      loop()
      return () => cancelAnimationFrame(requestRef.current)
    }
  }, [isReady, videoElement, cameraActive, detect, gameMode])

  if (gameMode === 'MENU') {
    return <StartScreen />
  }

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <Webcam key={gameMode} onVideoReady={handleVideoReady} />

      <Canvas shadows camera={{ position: [0, 10, 20] }}>
        <Physics gravity={[0, -9.81, 0]}>
          <color attach="background" args={['#111']} />
          <Lighting />
          <EnvironmentSetup />
          <StudioRoom />

          <Floor />
          <Table />
          <Tower key={gameId} />
          <Hand result={result} />
          <DepthCursor result={result} />

          <OrbitControls />
          <gridHelper args={[20, 20]} />
        </Physics>
      </Canvas>

      <HUD />
    </div>
  )
}

export default App
