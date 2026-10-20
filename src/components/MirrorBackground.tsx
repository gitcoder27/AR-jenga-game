import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { frameTextureTransform } from '../tracking/mapping';
import { onVideoFrames } from '../tracking/videoFrames';

/**
 * Mirror AR (review feature #10): the webcam image behind the table, mirrored
 * and lined up with the hand mapping, so the virtual pinch point sits on the
 * player's real fingertips. Replaces the scene's background colour while mounted.
 *
 * Each camera frame is copied through a 2D canvas, once per frame like detection
 * (H-8). Uploading the <video> itself is black under SwiftShader, which is what
 * Chrome falls back to on a blocklisted GPU (and what the E2E suite runs on).
 */
export function MirrorBackground({ video }: { video: HTMLVideoElement }) {
    const texture = useMemo(() => {
        const t = new THREE.CanvasTexture(document.createElement('canvas'));
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        const { repeat, offset } = frameTextureTransform();
        t.repeat.set(...repeat);
        t.offset.set(...offset);
        return t;
    }, []);
    useEffect(() => {
        const canvas = texture.image as HTMLCanvasElement;
        const context = canvas.getContext('2d', { alpha: false });
        const stop = onVideoFrames(video, () => {
            const { videoWidth: width, videoHeight: height } = video;
            if (!context || !width || !height) return;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                texture.dispose(); // re-created at the new size on the next upload
            }
            context.drawImage(video, 0, 0);
            texture.needsUpdate = true;
        });
        return () => {
            stop();
            texture.dispose();
        };
    }, [video, texture]);
    return <primitive object={texture} attach="background" />;
}
