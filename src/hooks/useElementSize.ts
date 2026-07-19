import { useLayoutEffect, useRef, useState } from 'react';

// Tracks the size of a container element via `ResizeObserver`. Returns a
// `ref` to attach to the measured element and the current `{ width, height }`
// in pixels. The first measurement fires synchronously in `useLayoutEffect`
// (so the consumer paints with a real size on the first frame, not 0×0),
// then the observer keeps it up to date as the element resizes.
//
// Used by `Map2D` to fit the D3 projection to its container. Generic enough
// to be reused by any component that needs its layout box (e.g. a future 3D
// canvas that must match the 2D map's pixel size).
export default function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
