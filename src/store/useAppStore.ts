import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

export type ProjectionFamily = 'cylindrical' | 'conic' | 'azimuthal';
export type DistortionModel = 'conformal' | 'equalArea' | 'equidistant';

type ProjectionParams = {
  family: ProjectionFamily;
  distortion: DistortionModel;
  lambda0: number;
  phi1: number;
  phi2: number;
};

export type EpsgPreset = ProjectionParams;

interface AppState extends ProjectionParams {
  showTissot: boolean;
  geoJsonData: FeatureCollection | null;

  setParam: <K extends keyof ProjectionParams>(key: K, value: ProjectionParams[K]) => void;
  setShowTissot: (value: boolean) => void;
  loadGeoData: () => Promise<void>;
  applyEpsgPreset: (preset: EpsgPreset) => void;
}

export const useAppStore = create<AppState>((set) => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phi1: 0,
  phi2: 45,
  showTissot: false,
  geoJsonData: null,

  setParam: (key, value) => set({ [key]: value } as Pick<AppState, typeof key>),
  setShowTissot: (value) => set({ showTissot: value }),
  applyEpsgPreset: (preset) => set({ ...preset }),
  loadGeoData: async () => {
    const response = await fetch('/world-110m.topojson');
    const topology = (await response.json()) as Topology;
    const land = topology.objects.land as GeometryCollection;
    const geojson = feature(topology, land) as FeatureCollection;
    set({ geoJsonData: geojson });
  },
}));
