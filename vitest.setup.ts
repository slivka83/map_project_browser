class ResizeObserverMock {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe() {
    // Fire asynchronously so React can flush the resulting state update.
    setTimeout(() => {
      this.cb(
        [{ contentRect: { width: 800, height: 600 } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }, 0);
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom's PointerEvent (where present) does not honour clientX / clientY in its
// init dict, so `fireEvent.pointerMove(node, { clientX, clientY })` produced
// events with `undefined` coordinates. Every Map2D hover test silently took
// the "off-globe" branch (NaN → not over globe) and never exercised the
// on-globe tracking path at all. Backing the pointer event with jsdom's fully
// supported MouseEvent constructor restores real coordinates.
class PointerEventMock extends MouseEvent {}
globalThis.PointerEvent = PointerEventMock as unknown as typeof PointerEvent;
