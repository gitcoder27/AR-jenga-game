import '@testing-library/jest-dom';

// Polyfill for ResizeObserver which is needed by @react-three/fiber's Canvas
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};