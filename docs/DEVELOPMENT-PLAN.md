Here is the **Master Development Roadmap**. Each phase is a standalone milestone.

---

## **Phase 1: Foundation & "The Ghost Hand"**

**Goal:** Establish the project structure and get a stable 3D hand moving on screen controlled by the webcam. No physics yet, just tracking.

### **1.1 Project Setup**

* [ ] **Initialize Repository:** Set up a React project using Vite (faster than Create-React-App).
* [ ] **Install Dependencies:**
* `three` (Core 3D engine)
* `@react-three/fiber` (React bridge)
* `@react-three/drei` (Helpers like OrbitControls, Environment)
* `@mediapipe/tasks-vision` (Hand tracking AI)
* `zustand` (State management for game status)



### **1.2 MediaPipe Integration**

* [ ] **Webcam Component:** Create a hidden HTML `<video>` element that requests camera permissions.
* [ ] **Hand Landmarker Service:** Implement a service that constantly feeds video frames to MediaPipe.
* [ ] **Coordinate Normalization:** Convert MediaPipe's 2D coordinates (0 to 1) into Three.js 3D world coordinates (e.g., -5 to +5).
* *Crucial Task:* Invert the X-axis so movement mirrors the user (moving right moves hand right).



### **1.3 The Virtual Hand Rig**

* [ ] **Visual Debugger:** Render small spheres for all 21 hand landmarks (joints) in the 3D scene.
* [ ] **Depth Logic (Z-Axis):** Implement a depth calculator.
* *Logic:* Calculate the distance between the **Wrist** and **Middle Finger MCP**. If the distance increases (hand looks bigger), move the 3D hand closer to the camera (Z-axis).


* [ ] **Smoothing (Lerp):** Apply Linear Interpolation to the coordinates to remove webcam jitter. The hand should "float" rather than "stutter."

**Outcome of Phase 1:** A blank 3D screen where a virtual skeletal hand follows your real hand smoothly in X, Y, and Z axes.

---

## **Phase 2: The Physics Core**

**Goal:** Implement the "Jenga" physics and make the hand capable of colliding with objects.

### **2.1 Physics Engine Setup**

* [ ] **Install Rapier:** `@react-three/rapier`.
* [ ] **World Config:** Set gravity to realistic earth gravity `[0, -9.81, 0]`.
* [ ] **Ground Plane:** Add a static floor (RigidBody: Fixed) with high friction.

### **2.2 The Tower Generator**

* [ ] **Block Asset:** Create a single Jenga block component (dimensions: 2.5 x 1.5 x 7.5 units).
* [ ] **Tower Algorithm:** Write a loop to generate 18 layers (54 blocks).
* *Logic:* Every odd layer is rotated 90 degrees.
* *Spacing:* Add a tiny gap (e.g., 0.05 units) between blocks so they don't spawn inside each other and explode.


* [ ] **Block Physics Properties:**
* **Mass:** High enough to feel heavy.
* **Friction:** High (0.8 - 1.0) to prevent sliding.
* **Restitution (Bounciness):** Near zero (wood doesn't bounce).



### **2.3 Hand-Physics Interaction**

* [ ] **Kinematic Hand:** Convert the visual hand from Phase 1 into a **KinematicPosition** RigidBody.
* *Note:* Kinematic bodies are moved by code (your hand) but affect dynamic bodies (the blocks).


* [ ] **Collision Test:** Verify that moving the virtual finger into a block pushes it.

**Outcome of Phase 2:** A Jenga tower sits on a table. You can knock it over by swinging your hand into it.

---

## **Phase 3: Advanced Interaction & Game Logic**

**Goal:** Implement the "Pinch to Grab" mechanic and the Win/Loss rules.

### **3.1 Pinch Detection System**

* [ ] **Gesture Logic:** Calculate the Euclidean distance between `Index_Finger_Tip` and `Thumb_Tip`.
* If distance < threshold (e.g., 2cm), set state `isPinching = true`.


* [ ] **Visual Feedback:** Change the hand color (e.g., from White to Blue) when a pinch is detected.

### **3.2 Grabbing Mechanics (The Hard Part)**

* [ ] **Raycasting/Proximity Check:** When `isPinching` is true, check if the midpoint of the pinch is touching a block.
* [ ] **Physics Lock:**
* *Option A (Simpler):* Create a temporary "FixedJoint" connecting the block to the hand.
* *Option B (Realistic):* Use physics forces to clamp the block (harder to stabilize). *Start with Option A.*


* [ ] **Release Logic:** When `isPinching` becomes false, destroy the joint/release the block.

### **3.3 Game State Manager**

* [ ] **Stability Check:** Track the velocity of all blocks. If blocks are moving > 0.1 speed, the game is "Unstable".
* [ ] **Loss Condition:** Detect if any block touches the "Floor" (y < table_height).
* *Exception:* The block currently being held by the user does not trigger a loss.


* [ ] **Reset Function:** A button to delete all blocks and re-run the Tower Generator.

**Outcome of Phase 3:** A fully playable game. You can pick up blocks, place them, and lose if the tower falls.

---

## **Phase 4: Visual Polish & Atmosphere**

**Goal:** Make it look like a high-end game, not a tech demo.

### **4.1 Environment & Lighting**

* [ ] **HDR Environment:** Use `@react-three/drei`'s `Environment` component to load a studio lighting map (makes reflections look real).
* [ ] **Shadows:** Enable Soft Shadows. Ensure the hand casts a shadow on the tower (crucial for depth perception).
* [ ] **Room Model:** Import a low-poly room model (table, background wall) so the tower isn't floating in a void.

### **4.2 Textures & Materials**

* [ ] **Wood Material:** Apply a wood texture map + normal map (for grain bumps) + roughness map (so it's not too shiny).
* [ ] **Hand Model:** Replace the "Spheres" from Phase 1 with a skinned mesh hand model or a robotic glove model.

### **4.3 UI Overlay (HUD)**

* [ ] **Camera Feed:** Add a small box in the bottom-right showing the raw webcam feed (mirrored).
* [ ] **Instructions:** Simple overlay: "Pinch to Grab," "Fist to Reset."
* [ ] **Game Over Screen:** "Tower Collapsed! Restart?" overlay.

---

## **Phase 5: Optimization & Deployment**

**Goal:** Ensure 60 FPS performance and public access.

### **5.1 Performance Tuning**

* [ ] **Instance Mesh:** (Optional) If the tower lags, switch to InstancedMesh (though 54 blocks usually runs fine without it).
* [ ] **Sleep Thresholds:** Aggressively put blocks to "sleep" in Rapier when they stop moving.
* [ ] **Asset Compression:** Use `.glb` files compressed with Draco.

### **5.2 Browser Compatibility**

* [ ] **Mobile Check:** Ensure the webcam works on mobile browsers (though gameplay might be hard on small screens).
* [ ] **Permission Handling:** Graceful error message if the user denies Camera access.

### **5.3 Deployment**

* [ ] **Build:** `npm run build`.
* [ ] **Hosting:** Deploy to Vercel or Netlify (Zero config needed for Vite apps).
