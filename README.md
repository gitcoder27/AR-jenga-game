# Robotic Jenga 🧱🖐️

Robotic Jenga is a web-based augmented reality Jenga game that allows you to interact with a 3D Jenga tower using hand gestures through your webcam. Built with React, Three.js, and MediaPipe.

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
  - **Depth**: Works like a mirror by default. Bring your hand closer to the webcam and the virtual hand comes toward you; move it away and the virtual hand moves toward the tower. Prefer reaching in? Switch to **INTO THE SCENE** under **SETTINGS**. A gauge on the right shows where your hand is against the tower.
  - **Camera**: Hold an open palm still, then move your hand to turn the view. You can also press **C**, use the TURN VIEW button, or drag with the mouse.
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

   The MediaPipe WASM, hand model and studio HDR are served from `public/`, not from third-party CDNs. `npm run dev` and `npm run build` fetch them on first run (`npm run assets`), so the first run needs network access.

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

1. **Set up**: Use a well-lit room and keep your hand clearly visible to the webcam. The chip in the top bar shows the tracking state (loading, no hand, tracking).
2. **Move**:
   - **Left, right, up, down**: Move your hand and the virtual hand follows, mirrored like a reflection.
   - **Depth (mirror, the default)**: Bring your hand **closer to the webcam** to bring the virtual hand **toward you**. Move your hand **away from the webcam** to reach **into the scene**, toward the tower.
   - **Depth (reach-in)**: Under **SETTINGS**, choose **INTO THE SCENE** to flip it: a hand closer to the webcam reaches deeper into the scene.
   - **Depth gauge**: The bar on the right edge runs from FAR (top) to NEAR (bottom). The orange band is the tower, and the cyan line is your hand.
   - **Calibrate**: Under **SETTINGS → CALIBRATE (5 S)**, hold your hand as near the webcam as is comfortable, then as far. That range then spans the whole scene, whatever your hand size or seating. The game remembers it, and the depth direction, in this browser.
3. **Act**:
   - **Push**: Move the hand into a block to nudge it.
   - **Grab**: Open your hand near a block, then pinch your **thumb** and **index finger**. The block under the pinch turns cyan when it can be grabbed and green while you hold it. A pinch that closes on nothing shows a red ring; open your hand and try again.
   - **Release**: Open your fingers. A marker on the surface below shows where a held block will land.
4. **Camera**:
   - Hold an **open palm** (all fingers spread) **still** for about half a second. The cursor fills up, then the view-turning mode starts and a violet banner says so.
   - Then move your hand to turn the view. Meanwhile the hand can't touch or grab blocks.
   - Pinch or close your hand to stop. Losing the hand also stops it.
   - Press **C**, or use the **TURN VIEW** button, to switch it on or off without the gesture. It is unavailable while you hold a block.
   - Drag with the mouse to orbit, or scroll to zoom. The view can't go under the table or zoom out of reach.
   - **SETTINGS → RESET VIEW** restores the default framing.
5. **Rules**:
   - **Classic**: Take blocks out of the tower and stack them on top. The game ends when any block other than the one you last moved touches the floor. Placements don't score yet: the score stays at 0 until the classic-rules work (GAME_REVIEW.md C-1) lands.
   - **Sandbox**: No score or game over. **RESET TOWER** rebuilds the tower.

## 📂 Project Structure

```
src/
├── components/       # UI and 3D components
│   ├── HUD/          # Heads-up display: score, tracking status, buttons
│   ├── StartScreen/  # Mode selection
│   ├── Hand.tsx      # Virtual hand: landmarks → kinematic bodies
│   ├── DepthCursor.tsx # Pinch cursor, grab feedback and drop marker
│   ├── Tower.tsx     # Seeded tower layout
│   ├── Block.tsx     # One block: physics body and floor rule
│   └── ...           # Webcam, camera controls, environment (Table, Floor, StudioRoom)
├── game/             # Game logic shared by components and tests
│   ├── config.ts     # Physics, camera and grab constants
│   ├── grab.ts       # Grab candidate query and hand physics (soft grab, release, tracking loss)
│   ├── fingertip.ts  # The hand's one collider: a speed- and force-capped fingertip
│   ├── rules.ts      # Win and loss rules
│   └── towerLayout.ts # Seeded block layout
├── hooks/            # useHandTracking (MediaPipe)
├── store/            # gameStore.ts: game, tracking and view state (Zustand)
├── tracking/         # HandTracker (filtering, gestures), camera-mode clutch, landmark → world mapping, asset paths
├── utils/            # Depth, gesture classification
├── test/             # Test helpers: hand poses, e2e driver, store mocks
└── App.tsx           # Application root
tests/physics/        # Headless Rapier physics tests
e2e/                  # Playwright tests with a scripted hand
scripts/fetch-assets.mjs # Self-hosts the MediaPipe WASM, hand model and HDR
```

## 🧪 Testing

```bash
npm test          # unit tests and headless physics tests (Vitest)
npm run test:e2e  # browser tests with a scripted hand (Playwright, fake webcam)
npm run lint
```

The E2E suite replaces MediaPipe with a stub that plays scripted hand poses, so it needs no webcam. Tests for known, not-yet-fixed bugs run as expected failures; set `SHOW_KNOWN_BUGS=1` to run them as normal tests.

## 📄 License

This project is licensed under the MIT License.
