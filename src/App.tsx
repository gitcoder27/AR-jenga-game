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
import { HandTracker, type TrackedHand } from './tracking/handTracker'
import { onVideoFrames } from './tracking/videoFrames'
import { CameraClutch } from './tracking/cameraClutch'
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
  // The latest tracked hand: a ref, read in the frame loop, so detections don't re-render the scene (M-1)
  const handRef = useRef<TrackedHand | null>(null)
  // Filtering, outlier rejection and gestures, once per detection (H-6, H-7)
  const [tracker] = useState(() => new HandTracker())
  // When the hand enters and leaves camera mode, on the same detections (H-2)
  const [clutch] = useState(() => new CameraClutch())
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const orbitControlsRef = useRef<OrbitControlsImpl>(null)

  const gameId = useGameStore((state) => state.gameId)
  const resetGame = useGameStore((state) => state.resetGame)

  const handleVideoReady = useCallback((vid: HTMLVideoElement) => {
    setCameraActive(true)
    setVideoElement(vid)
  }, [])

  useEffect(() => {
    if (isReady && videoElement && cameraActive) {
      const { setTrackingStatus } = useGameStore.getState()
      // Once per camera frame, not per display frame (H-8)
      return onVideoFrames(videoElement, (now) => {
        const res = detect(videoElement, now)
        if (res) {
          // MediaPipe landmarks are normalized per axis; gestures and filtering need the frame's aspect
          const aspect = videoElement.videoHeight ? videoElement.videoWidth / videoElement.videoHeight : 1
          handRef.current = tracker.update(res.landmarks[0], now, aspect)
          const { isCameraMode, heldBlockId, setCameraMode } = useGameStore.getState()
          const change = clutch.update(handRef.current, isCameraMode, heldBlockId !== null)
          if (change) setCameraMode(change === 'enter')
          const status = res.landmarks.length > 0 ? 'ready' : 'no-hand'
          if (useGameStore.getState().trackingStatus !== status) setTrackingStatus(status)
        }
      })
    }
  }, [isReady, videoElement, cameraActive, detect, tracker, clutch])

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
            <GameRules key={gameId} />
            <Hand handRef={handRef} clutch={clutch} />

            <CameraControls controlsRef={orbitControlsRef} />
            <GestureOrbitController handRef={handRef} controlsRef={orbitControlsRef} />
          </Physics>
        </Canvas>
      </SceneErrorBoundary>

      <HUD />
    </div>
  )
}

export default App
