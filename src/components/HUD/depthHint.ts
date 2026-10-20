/** What the hand does in the scene as it moves toward the webcam (H-3) */
export function depthHint(reachIn: boolean): string {
    return reachIn ? 'HAND NEARER THE CAMERA = DEEPER INTO THE SCENE' : 'HAND NEARER THE CAMERA = NEARER TO YOU';
}
