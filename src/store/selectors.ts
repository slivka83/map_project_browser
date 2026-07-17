import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './useAppStore';
import type { ProjectionParams } from './useAppStore';

// Memoized selector returning the projection-parameter slice as a single object,
// so 3D/2D consumers can read it without subscribing to every individual field.
export const useProjectionParams = (): ProjectionParams =>
  useAppStore(
    useShallow((s): ProjectionParams => ({
      family: s.family,
      distortion: s.distortion,
      lambda0: s.lambda0,
      phiOrigin: s.phiOrigin,
      scaleFactor: s.scaleFactor,
      falseEasting: s.falseEasting,
      falseNorthing: s.falseNorthing,
      gamma: s.gamma,
      stdParallel2: s.stdParallel2,
      azLight: s.azLight,
    })),
  );
