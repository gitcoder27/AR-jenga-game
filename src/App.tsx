import { useState } from 'react'
import './App.css'
import Webcam from './components/Webcam'
import useHandTracking from './hooks/useHandTracking'

function App() {
  const { isReady } = useHandTracking()
  const [cameraActive, setCameraActive] = useState(false)

  return (
    <div className="app-container">
      <h1>Virtual Hand Jenga</h1>
      <Webcam onVideoReady={() => setCameraActive(true)} />
      <div style={{ position: 'absolute', top: 50, left: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 10 }}>
        <p>Camera Active: {cameraActive ? 'Yes' : 'No'}</p>
        <p>Tracking Ready: {isReady ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
}

export default App
