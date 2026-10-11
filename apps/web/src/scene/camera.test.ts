import { describe, expect, it, vi } from 'vitest';
import { attachGestures, CameraRig } from './camera.ts';

type Handler = (e: unknown) => void;

/** A stand-in canvas: records listeners so a test can replay a touch tap. */
function fakeCanvas() {
  const on = new Map<string, Handler>();
  const el = {
    addEventListener: (t: string, h: Handler) => on.set(t, h),
    removeEventListener: (t: string) => on.delete(t),
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
  };
  return { el: el as unknown as HTMLElement, fire: (t: string, e: unknown) => on.get(t)?.(e), on };
}

describe('map gestures', () => {
  it('a touch tap selects once and cancels the compatibility click that would hit the new sheet', () => {
    vi.stubGlobal('performance', { now: () => 1000 });
    const { el, fire, on } = fakeCanvas();
    const rig = new CameraRig();
    rig.resize(300, 300);
    const onTap = vi.fn();
    const detach = attachGestures(el, rig, { onChange: () => {}, onTap });
    fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 120 });
    fire('pointerup', { pointerId: 1, clientX: 101, clientY: 120 });
    const touchEnd = { cancelable: true, preventDefault: vi.fn() };
    fire('touchend', touchEnd);
    expect(onTap).toHaveBeenCalledOnce();
    expect(onTap).toHaveBeenCalledWith(101, 120);
    // Without this, the browser's mousedown/mouseup/click land on the sheet the tap just opened.
    expect(touchEnd.preventDefault).toHaveBeenCalledOnce();
    detach();
    expect(on.has('touchend')).toBe(false);
    vi.unstubAllGlobals();
  });
});
