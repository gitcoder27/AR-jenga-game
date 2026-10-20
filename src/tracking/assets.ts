/**
 * Self-hosted runtime assets, served from public/ (see scripts/fetch-assets.mjs).
 * No third-party CDN is contacted at runtime (O-3, H-9).
 */
const base = import.meta.env.BASE_URL

/** MediaPipe WASM, copied from the installed @mediapipe/tasks-vision so versions always match */
export const MEDIAPIPE_WASM_PATH = `${base}mediapipe/wasm`
export const HAND_MODEL_PATH = `${base}mediapipe/hand_landmarker.task`
/** The studio HDR drei's preset="studio" would fetch from a CDN */
export const STUDIO_HDR_PATH = `${base}hdri/studio_small_03_1k.hdr`
