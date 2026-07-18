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
      rulerMode: s.rulerMode,
      rulerPoint1: s.rulerPoint1,
      rulerPoint2: s.rulerPoint2,
      utmZone: s.utmZone,
      azHeight: s.azHeight,
      azTiltDeg: s.azTiltDeg,
      azAzimuthDeg: s.azAzimuthDeg,
      coneHemisphere: s.coneHemisphere,
      somInclination: s.somInclination,
      somPeriod: s.somPeriod,
      somNodeLongitude: s.somNodeLongitude,
      circleRadiusKm: s.circleRadiusKm,
    })),
  );

// Visualization / interaction params (separate from the projection math so a
// viz-method change never re-runs the projection math).
export function useVisualizationParams() {
  return useAppStore(
    useShallow((s) => ({
      vizMethod: s.vizMethod,
      showHeatmap: s.showHeatmap,
      heatmapType: s.heatmapType,
      graticuleStep: s.graticuleStep,
      showGraticule: s.showGraticule,
      testFigureType: s.testFigureType,
      showRays: s.showRays,
      rulerActive: s.rulerActive,
      rulerMode: s.rulerMode,
      rulerPoint1: s.rulerPoint1,
      rulerPoint2: s.rulerPoint2,
      unfoldTrigger: s.unfoldTrigger,
    })),
  );
}
