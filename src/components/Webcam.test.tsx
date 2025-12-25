import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Webcam from './Webcam'

describe('Webcam Component', () => {
  const getUserMediaMock = vi.fn()

  beforeEach(() => {
    // Mock navigator.mediaDevices
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
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
    getUserMediaMock.mockResolvedValue({ getTracks: () => [] } as any)

    render(<Webcam onVideoReady={() => {}} />)
    const videoElement = screen.getByTestId('webcam-video')
    expect(videoElement).toBeInTheDocument()
  })

  it('requests camera permissions on mount', () => {
    const mockStream = { getTracks: () => [] } as any
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

  it('shows error overlay when permission is denied', async () => {
    getUserMediaMock.mockRejectedValue(new Error('Permission denied'))

    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => {
        expect(screen.getByText(/Camera access required/i)).toBeInTheDocument()
    })
  })

  it('retries camera access when retry button is clicked', async () => {
    // First attempt fails
    getUserMediaMock.mockRejectedValueOnce(new Error('Permission denied'))
    
    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => {
        expect(screen.getByText(/Camera access required/i)).toBeInTheDocument()
    })

    // Second attempt succeeds
    getUserMediaMock.mockResolvedValue({ getTracks: () => [] } as any)

    const retryButton = screen.getByText(/Retry/i)
    fireEvent.click(retryButton)

    await waitFor(() => {
        expect(getUserMediaMock).toHaveBeenCalledTimes(2)
        expect(screen.queryByText(/Camera access required/i)).not.toBeInTheDocument()
    })
  })
})