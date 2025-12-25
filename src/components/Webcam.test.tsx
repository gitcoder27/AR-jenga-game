import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Webcam from './Webcam'

describe('Webcam Component', () => {
  const getUserMediaMock = vi.fn()

  beforeEach(() => {
    // Mock navigator.mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
      },
      writable: true,
      configurable: true, 
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a video element', () => {
    getUserMediaMock.mockResolvedValue({} as MediaStream)

    render(<Webcam onVideoReady={() => {}} />)
    // Should fail because we return <div></div>
    const videoElement = screen.getByTestId('webcam-video')
    expect(videoElement).toBeInTheDocument()
  })

  it('requests camera permissions on mount', () => {
    const mockStream = {} as MediaStream
    getUserMediaMock.mockResolvedValue(mockStream)

    render(<Webcam onVideoReady={() => {}} />)

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
  })
})
