export type CameraErrorKind = 'insecure' | 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown';

export interface CameraErrorInfo {
    kind: CameraErrorKind;
    title: string;
    /** What to do about it */
    detail: string;
    /** Whether choosing another camera might help */
    offerPicker: boolean;
}

const NAMES: Record<string, CameraErrorKind> = {
    NotAllowedError: 'denied',
    PermissionDeniedError: 'denied',
    SecurityError: 'denied',
    NotFoundError: 'not-found',
    DevicesNotFoundError: 'not-found',
    NotReadableError: 'in-use',
    TrackStartError: 'in-use',
    AbortError: 'in-use',
    OverconstrainedError: 'unsupported',
    ConstraintNotSatisfiedError: 'unsupported',
};

const GUIDANCE: Record<CameraErrorKind, Omit<CameraErrorInfo, 'kind'>> = {
    insecure: {
        title: 'The camera needs a secure page',
        detail: 'Browsers only allow the camera on https:// pages and on localhost. Open the game over https, or as localhost on this computer.',
        offerPicker: false,
    },
    denied: {
        title: 'Camera access is blocked',
        detail: "Allow the camera for this site (the camera icon in the address bar, or the browser's site settings), then press Retry.",
        offerPicker: false,
    },
    'not-found': {
        title: 'No camera found',
        detail: 'Plug in a webcam, or turn it on in your system settings, then press Retry.',
        offerPicker: true,
    },
    'in-use': {
        title: 'The camera is busy',
        detail: 'Another app or browser tab may be using it. Close that, then press Retry, or try another camera.',
        offerPicker: true,
    },
    unsupported: {
        title: "This camera couldn't start",
        detail: "It doesn't support the video settings the game asked for. Try another camera, or press Retry.",
        offerPicker: true,
    },
    unknown: {
        title: "Couldn't start the camera",
        detail: 'Press Retry, or try another camera.',
        offerPicker: true,
    },
};

/**
 * Specific guidance for a camera start-up failure (O-4), from the
 * getUserMedia error's name, or from navigator.mediaDevices being missing,
 * which browsers do on non-secure pages (http on a LAN address).
 */
export function describeCameraError(error: unknown, hasMediaDevices = true): CameraErrorInfo {
    const kind: CameraErrorKind = !hasMediaDevices ? 'insecure' : NAMES[(error as { name?: string } | null)?.name ?? ''] ?? 'unknown';
    const info = { kind, ...GUIDANCE[kind] };
    if (kind === 'unknown' && error instanceof Error && error.message) info.detail = `${error.message}. ${info.detail}`;
    return info;
}
