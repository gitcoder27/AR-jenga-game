import { useState, useEffect, useRef } from 'react'
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

function App() {
  const { detect, isReady } = useHandTracking()
  const [cameraActive, setCameraActive] = useState(false)
  const [result, setResult] = useState<HandLandmarkerResult | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const requestRef = useRef<number>(0)
  
  const gameState = useGameStore((state) => state.gameState)
  const resetGame = useGameStore((state) => state.resetGame)
  const score = useGameStore((state) => state.score)
  const gameId = useGameStore((state) => state.gameId)

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
        <p>Score: {score}</p>
      </div>

      {gameState === 'GAME_OVER' && (
          <div style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 20, color: 'white'
          }}>
              <h1 style={{ fontSize: '3rem', margin: '0 0 20px 0' }}>Game Over</h1>
              <p style={{ fontSize: '1.5rem' }}>Final Score: {score}</p>
              <button 
                onClick={resetGame}
                style={{
                    padding: '10px 20px', fontSize: '1.2rem',
                    cursor: 'pointer', background: 'white', border: 'none', borderRadius: '5px'
                }}
              >
                  Reset Game
              </button>
          </div>
      )}

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
    </div>
  )
}

export default App
