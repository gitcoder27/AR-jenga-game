# Product Guide: Virtual Hand Jenga

## Initial Concept
A browser-based 3D simulation of the classic game "Jenga" controlled entirely via webcam hand gestures. The game takes place in a fully 3D virtual environment where the user's real-life hand movements control a "virtual hand" on screen to push, pinch, and pull blocks. The focus is on high-fidelity physics, smooth interactions, and satisfying graphics.

## Target Audience
*   **Casual Gamers:** Individuals looking for accessible, engaging, and quick web-based gaming experiences that don't require heavy downloads or specialized hardware.
*   **Tech Enthusiasts:** Users interested in exploring the capabilities of modern web technologies, specifically Augmented Reality (AR), Virtual Reality (VR), and computer vision (hand tracking) directly in the browser.

## Key Features (MVP)
*   **Webcam-Based Hand Tracking:** Real-time, markerless hand tracking using MediaPipe, allowing users to control the game using natural hand movements without VR headsets or gloves.
*   **High-Fidelity Physics:** A realistic physics simulation powered by Rapier.js, ensuring that blocks behave authentically with correct friction, gravity, and collision responses.
*   **Gesture Recognition:** Intuitive "Pinch to Grab" gesture control, enabling precise manipulation of Jenga blocks for strategic gameplay.
*   **Immersive 3D Environment:** A visually polished 3D scene built with Three.js and React Three Fiber, featuring realistic lighting and materials.
*   **Futuristic HUD & UI:** A professional Heads-Up Display (HUD) providing real-time score, game status LED, and contextual instructions without breaking immersion.
*   **Win/Loss Logic:** Automated detection of tower collapse, triggering a "Game Over" state with score tracking and restart functionality.

## Primary Goal
To create a "fun and playable tech demo" that not only showcases the advanced capabilities of web-based AR and physics engines but also delivers a genuinely enjoyable and replayable gaming experience. The success of the project is defined by the balance between technical innovation and game design—making the technology feel invisible and the gameplay feel natural.
