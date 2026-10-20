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
    getUserMediaMock.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream)

    render(<Webcam onVideoReady={() => {}} />)
    const videoElement = screen.getByTestId('webcam-video')
    expect(videoElement).toBeInTheDocument()
  })

  it('requests camera permissions on mount', () => {
    const mockStream = { getTracks: () => [] } as unknown as MediaStream
    getUserMediaMock.mockResolvedValue(mockStream)

    render(<Webcam onVideoReady={() => {}} />)

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    })
  })

  const denied = () => Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })

  it('shows error overlay when permission is denied', async () => {
    getUserMediaMock.mockRejectedValue(denied())

    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => {
        expect(screen.getByText(/Camera access is blocked/i)).toBeInTheDocument()
    })
  })

  // O-4: each failure says what to do about it
  it('says the camera is busy, and offers the other cameras', async () => {
    getUserMediaMock.mockRejectedValue(Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' }))
    Object.assign(navigator.mediaDevices, {
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'a', label: 'Front camera' },
        { kind: 'audioinput', deviceId: 'm', label: 'Mic' },
        { kind: 'videoinput', deviceId: 'b', label: '' },
      ]),
    })

    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => expect(screen.getByText(/The camera is busy/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Front camera' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Camera 2' }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenLastCalledWith(expect.objectContaining({
      video: expect.objectContaining({ deviceId: { exact: 'b' } }),
    })))
  })

  it('retries with any video mode when the camera cannot meet the requested size', async () => {
    getUserMediaMock
      .mockRejectedValueOnce(Object.assign(new Error('width'), { name: 'OverconstrainedError' }))
      .mockResolvedValueOnce({ getTracks: () => [] } as unknown as MediaStream)

    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => expect(getUserMediaMock).toHaveBeenLastCalledWith({ video: true, audio: false }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('on a page without navigator.mediaDevices, asks for https or localhost', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: undefined, writable: true, configurable: true })

    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => expect(screen.getByText(/needs a secure page/i)).toBeInTheDocument())
  })

  it('retries camera access when retry button is clicked', async () => {
    // First attempt fails
    getUserMediaMock.mockRejectedValueOnce(denied())
    
    render(<Webcam onVideoReady={() => {}} />)

    await waitFor(() => {
        expect(screen.getByText(/Camera access is blocked/i)).toBeInTheDocument()
    })

    // Second attempt succeeds
    getUserMediaMock.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream)

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    await waitFor(() => {
        expect(getUserMediaMock).toHaveBeenCalledTimes(2)
        expect(screen.queryByText(/Camera access is blocked/i)).not.toBeInTheDocument()
    })
  })

  // O-5: the camera must never stay on after the game is left
  it('stops a stream that resolves after unmount', async () => {
    const stop = vi.fn()
    let resolve!: (stream: MediaStream) => void
    getUserMediaMock.mockReturnValue(new Promise((r) => { resolve = r }))

    const { unmount } = render(<Webcam onVideoReady={() => {}} />)
    unmount()
    resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream)

    await waitFor(() => expect(stop).toHaveBeenCalled())
  })

  it('stops the stream on unmount', async () => {
    const stop = vi.fn()
    getUserMediaMock.mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream)

    const { unmount } = render(<Webcam onVideoReady={() => {}} />)
    await new Promise((r) => setTimeout(r, 0))
    unmount()

    expect(stop).toHaveBeenCalled()
  })
})
