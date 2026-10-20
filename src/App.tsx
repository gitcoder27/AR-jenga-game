import { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
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
import { HUD } from './components/HUD/HUD'
import StartScreen from './components/StartScreen/StartScreen'
import GestureOrbitController from './components/GestureOrbitController'
import GameRules from './components/GameRules'
import CameraControls from './components/CameraControls'
import SceneErrorBoundary from './components/SceneErrorBoundary'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CAMERA_FOV, CAMERA_POSITION } from './game/config'

function App() {
  // Created once, so the model loads while the menu is showing
  const handTracking = useHandTracking()
  const gameMode = useGameStore((state) => state.gameMode)

  if (gameMode === 'MENU') {
    return <StartScreen />
  }
  // Keyed by mode: leaving or switching modes drops the last tracking result,
  // the (stopped) video element and the camera state (O-7).
  return <Game key={gameMode} {...handTracking} />
}

function Game({ detect, isReady }: ReturnType<typeof useHandTracking>) {
  const [cameraActive, setCameraActive] = useState(false)
  const [result, setResult] = useState<HandLandmarkerResult | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const requestRef = useRef<number>(0)
  const orbitControlsRef = useRef<OrbitControlsImpl>(null)

  const gameId = useGameStore((state) => state.gameId)
  const resetGame = useGameStore((state) => state.resetGame)

  // MediaPipe landmarks are normalized per axis; gestures need the frame's aspect
  const videoAspect = videoElement && videoElement.videoHeight ? videoElement.videoWidth / videoElement.videoHeight : 1

  const handleVideoReady = useCallback((vid: HTMLVideoElement) => {
    setCameraActive(true)
    setVideoElement(vid)
  }, [])

  useEffect(() => {
    if (isReady && videoElement && cameraActive) {
      const { setTrackingStatus } = useGameStore.getState()
      const loop = () => {
        const res = detect(videoElement, performance.now())
        if (res) {
          setResult(res)
          const status = res.landmarks.length > 0 ? 'ready' : 'no-hand'
          if (useGameStore.getState().trackingStatus !== status) setTrackingStatus(status)
        }
        requestRef.current = requestAnimationFrame(loop)
      }
      loop()
      return () => cancelAnimationFrame(requestRef.current)
    }
  }, [isReady, videoElement, cameraActive, detect])

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <Webcam onVideoReady={handleVideoReady} />

      <SceneErrorBoundary onRestart={resetGame}>
        <Canvas shadows camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}>
          <Physics gravity={[0, -9.81, 0]}>
            <color attach="background" args={['#111']} />
            <Lighting />
            <EnvironmentSetup />
            <StudioRoom />

            <Floor />
            <Table />
            <Tower key={gameId} />
            <GameRules />
            <Hand result={result} aspect={videoAspect} />

            <CameraControls controlsRef={orbitControlsRef} />
            <GestureOrbitController result={result} controlsRef={orbitControlsRef} aspect={videoAspect} />
          </Physics>
        </Canvas>
      </SceneErrorBoundary>

      <HUD />
    </div>
  )
}

export default App
