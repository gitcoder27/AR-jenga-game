# AR Jenga Game 🧱🖐️

A web-based Augmented Reality Jenga game that allows you to interact with a 3D Jenga tower using hand gestures through your webcam. Built with React, Three.js, and MediaPipe.

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 📖 Overview

This project simulates the classic "Jenga" game in a 3D virtual environment. Instead of using a mouse or keyboard, you control a virtual hand using your real hand captured by your webcam. The game features realistic physics interactions, allowing you to push, pull, and stack blocks just like in real life.

## 🚀 Features

- **Real-time Hand Tracking**: Powered by [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker), tracking 21 hand landmarks with high precision.
- **Physics Simulation**: Realistic rigid body physics using [React Three Rapier](https://github.com/pmndrs/react-three-rapier) (based on the Rapier engine). Blocks have mass, friction, and collision detection.
- **Gesture Control**:
  - **Move**: Your virtual hand mimics your real hand's position in real-time.
  - **Grab**: Pinch your thumb and index finger together to grab and hold blocks.
  - **Depth Control**: Move your hand closer to the camera to push the virtual hand forward (Z-axis), and pull back to retract it.
- **Interactive Gameplay**: Carefully remove blocks from the tower and stack them on top without toppling the structure.
- **Immersive Environment**: Features a 3D studio room environment, dynamic lighting, shadows, and high-quality block materials.
- **HUD**: Heads-Up Display showing your score and current game status.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **3D Engine**: [Three.js](https://threejs.org/) & [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- **Physics**: [React Three Rapier](https://github.com/pmndrs/react-three-rapier)
- **Computer Vision**: [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Testing**: [Vitest](https://vitest.dev/) & [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ar-jenga-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## 🎮 How to Run

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open the application**
   Open your browser and navigate to `http://localhost:5173` (or the URL shown in your terminal).

3. **Grant Permissions**
   The application will request access to your webcam. Click "Allow" to enable hand tracking.

## 🕹️ Controls

1. **Positioning**: Ensure you are in a well-lit room and your hand is clearly visible to the webcam.
2. **Movement**:
   - **X/Y Axis**: Move your hand left, right, up, or down to move the virtual hand.
   - **Z Axis (Depth)**: Move your hand **closer** to the camera to reach **forward** into the scene. Move your hand **away** to pull **back**.
3. **Actions**:
   - **Push**: Simply move your hand into blocks to nudge them.
   - **Grab**: Pinch your **Thumb** and **Index Finger** together to grab a block. Keep pinching to hold it.
   - **Release**: Open your fingers to release the block.

## 📂 Project Structure

```
src/
├── components/       # UI and 3D components
│   ├── HUD/          # Heads-Up Display components
│   ├── materials/    # Three.js materials
│   ├── Hand.tsx      # Virtual hand tracking and rendering
│   ├── Tower.tsx     # Jenga tower logic and generation
│   ├── Block.tsx     # Individual block component with physics
│   ├── Webcam.tsx    # Webcam feed integration
│   └── ...           # Environment components (Floor, Table, StudioRoom)
├── hooks/            # Custom hooks
│   ├── useHandTracking.ts # MediaPipe integration logic
│   └── useGesture.ts      # Pinch detection logic
├── store/            # Global state management
│   └── gameStore.ts  # Game state (score, game over, etc.)
├── utils/            # Helper functions
│   ├── coordinates.ts # Mapping 2D webcam coords to 3D world
│   ├── depth.ts       # Z-axis depth calculation
│   └── smoothing.ts   # Movement smoothing (Lerp)
└── App.tsx           # Main application entry point
```

## 🧪 Testing

Run the test suite using Vitest:

```bash
npm run test
```

## 📄 License

This project is licensed under the MIT License.
