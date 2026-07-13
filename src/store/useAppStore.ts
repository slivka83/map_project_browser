import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

export type ProjectionFamily = 'cylindrical' | 'conic' | 'azimuthal';
export type DistortionModel = 'conformal' | 'equalArea' | 'equidistant';

export interface ProjectionParams {
  family: ProjectionFamily;
  distortion: DistortionModel;
  lambda0: number; // -180...180  (central meridian)
  phiOrigin: number; // -90...90   (central latitude)
  scaleFactor: number; // 0.9...1.1 (aux-figure immersion)
  falseEasting: number; // -1000...1000
  falseNorthing: number; // -1000...1000
}

export type EpsgPreset = ProjectionParams;

interface AppState extends ProjectionParams {
  showTissot: boolean;
  geoJsonData: FeatureCollection | null;

  setParam: <K extends keyof ProjectionParams>(key: K, value: ProjectionParams[K]) => void;
  setShowTissot: (value: boolean) => void;
  loadGeoData: () => Promise<void>;
  applyPreset: (preset: Partial<AppState>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  showTissot: false,
  geoJsonData: null,

  setParam: (key, value) => set({ [key]: value } as Pick<AppState, typeof key>),
  setShowTissot: (value) => set({ showTissot: value }),
  applyPreset: (preset) => set({ ...preset }),
  loadGeoData: async () => {
    const response = await fetch('/world-110m.topojson');
    const topology = (await response.json()) as Topology;
    const land = topology.objects.land as GeometryCollection;
    const geojson = feature(topology, land) as FeatureCollection;
    set({ geoJsonData: geojson });
  },
}));
