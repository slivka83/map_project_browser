import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './useAppStore';
import type { ProjectionParams } from './useAppStore';

export const useProjectionParams = (): ProjectionParams =>
  useAppStore(
    useShallow((s): ProjectionParams => ({
      variant: s.variant,
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
