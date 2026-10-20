import { describe, expect, it } from 'vitest';
import { describeCameraError } from './cameraErrors';

const domError = (name: string) => Object.assign(new Error(name), { name });

describe('describeCameraError [O-4]', () => {
    it.each([
        ['NotAllowedError', 'denied', /blocked/],
        ['NotFoundError', 'not-found', /no camera/i],
        ['NotReadableError', 'in-use', /busy/],
        ['OverconstrainedError', 'unsupported', /couldn't start/],
    ])('%s says what is wrong: %s', (name, kind, title) => {
        const info = describeCameraError(domError(name));
        expect(info.kind).toBe(kind);
        expect(info.title).toMatch(title);
    });

    it('a page without navigator.mediaDevices (http on a LAN address) asks for https or localhost', () => {
        const info = describeCameraError(new TypeError("Cannot read properties of undefined (reading 'getUserMedia')"), false);
        expect(info.kind).toBe('insecure');
        expect(info.detail).toMatch(/https/);
        expect(info.offerPicker).toBe(false);
    });

    it('anything else keeps the browser message', () => {
        const info = describeCameraError(new Error('Something odd'));
        expect(info.kind).toBe('unknown');
        expect(info.detail).toMatch(/^Something odd\./);
    });

    it('offers another camera only where one might help', () => {
        expect(describeCameraError(domError('NotReadableError')).offerPicker).toBe(true);
        expect(describeCameraError(domError('NotAllowedError')).offerPicker).toBe(false);
    });
});
