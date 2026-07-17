import type { ProjectionParams } from '../store/useAppStore';

export interface EpsgEntry {
  code: string;
  name: string;
  type: string; // Mercator, Albers, …
  units: string; // метры / градусы
  params: ProjectionParams;
}

const base: Omit<ProjectionParams, 'variant' | 'family' | 'distortion' | 'phiOrigin'> = {
  lambda0: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'math',
};

const p = (
  family: ProjectionParams['family'],
  distortion: ProjectionParams['distortion'],
  phiOrigin: number,
): ProjectionParams => ({ ...base, family, distortion, phiOrigin });

// ~30 common normal (untransformed) projections, each mapped to one of the
// supported family × distortion combinations with its central latitude.
export const EPSG_PRESETS: EpsgEntry[] = [
  { code: 'EPSG:3395', name: 'Меркатор', type: 'Mercator', units: 'градусы', params: p('cylindrical', 'conformal', 0) },
  { code: 'EPSG:3857', name: 'Веб-Меркатор', type: 'Mercator', units: 'метры', params: p('cylindrical', 'conformal', 0) },
  { code: 'EPSG:54003', name: 'Цилиндрическая Миллера', type: 'Miller', units: 'градусы', params: p('cylindrical', 'conformal', 0) },
  { code: 'EPSG:32662', name: 'Равнопромежуточная (Платте-Карре)', type: 'Платте-Карре', units: 'градусы', params: p('cylindrical', 'equidistant', 0) },
  { code: 'EPSG:53010', name: 'Галль–Петерс', type: 'Галль–Петерс', units: 'градусы', params: p('cylindrical', 'equalArea', 45) },
  { code: 'EPSG:54004', name: 'Бергман', type: 'Бергман', units: 'градусы', params: p('cylindrical', 'equalArea', 30) },
  { code: 'EPSG:54008', name: 'Хобо–Дайер', type: 'Хобо–Дайер', units: 'градусы', params: p('cylindrical', 'equalArea', 37.5) },
  { code: 'EPSG:54009', name: 'Тристан-Эдвардс', type: 'Тристан-Эдвардс', units: 'градусы', params: p('cylindrical', 'equalArea', 37.5) },
  { code: 'EPSG:54006', name: 'Бальтасар', type: 'Бальтасар', units: 'градусы', params: p('cylindrical', 'equalArea', 50) },
  { code: 'EPSG:9834', name: 'Цилиндрическая равновеликая Ламберта', type: 'Ламберт (цилиндр)', units: 'градусы', params: p('cylindrical', 'equalArea', 0) },
  { code: 'EPSG:54007', name: 'Крастер (равновеликая)', type: 'Крастер', units: 'градусы', params: p('cylindrical', 'equalArea', 62) },
  { code: 'EPSG:32663', name: 'Равнопромежуточная цилиндрическая (φ=30°)', type: 'Равнопромежуточная (цилиндр)', units: 'градусы', params: p('cylindrical', 'equidistant', 30) },
  { code: 'EPSG:32664', name: 'Равнопромежуточная цилиндрическая (φ=45°)', type: 'Равнопромежуточная (цилиндр)', units: 'градусы', params: p('cylindrical', 'equidistant', 45) },
  { code: 'EPSG:9801', name: 'Коническая равноугольная Ламберта', type: 'Ламберт (конус)', units: 'метры', params: p('conic', 'conformal', 45) },
  { code: 'EPSG:3329', name: 'Коническая равноугольная (США)', type: 'Ламберт (конус)', units: 'метры', params: p('conic', 'conformal', 39) },
  { code: 'EPSG:3034', name: 'Коническая равноугольная (Европа)', type: 'Ламберт (конус)', units: 'метры', params: p('conic', 'conformal', 50) },
  { code: 'EPSG:9822', name: 'Коническая равновеликая (Альберс)', type: 'Альберс', units: 'метры', params: p('conic', 'equalArea', 35) },
  { code: 'EPSG:3310', name: 'Коническая равновеликая (Альберс, США)', type: 'Альберс', units: 'метры', params: p('conic', 'equalArea', 37.5) },
  { code: 'EPSG:9820', name: 'Коническая равновеликая (1 параллель)', type: 'Альберс', units: 'метры', params: p('conic', 'equalArea', 30) },
  { code: 'EPSG:9823', name: 'Коническая равнопромежуточная', type: 'Равнопромежуточная (конус)', units: 'градусы', params: p('conic', 'equidistant', 40) },
  { code: 'EPSG:54001', name: 'Коническая равнопромежуточная (Франция)', type: 'Равнопромежуточная (конус)', units: 'градусы', params: p('conic', 'equidistant', 46.65) },
  { code: 'EPSG:54001b', name: 'Коническая равнопромежуточная (1 параллель)', type: 'Равнопромежуточная (конус)', units: 'градусы', params: p('conic', 'equidistant', 30) },
  { code: 'EPSG:9810', name: 'Стереографическая (Северный полюс)', type: 'Стереографическая', units: 'градусы', params: p('azimuthal', 'conformal', 90) },
  { code: 'EPSG:9820b', name: 'Стереографическая (Южный полюс)', type: 'Стереографическая', units: 'градусы', params: p('azimuthal', 'conformal', -90) },
  { code: 'EPSG:9809', name: 'Стереографическая (косая)', type: 'Стереографическая', units: 'градусы', params: p('azimuthal', 'conformal', 0) },
  { code: 'EPSG:9830', name: 'Азимутальная равновеликая Ламберта (Север)', type: 'Ламберт (азимут)', units: 'градусы', params: p('azimuthal', 'equalArea', 90) },
  { code: 'EPSG:9831', name: 'Азимутальная равновеликая Ламберта (Юг)', type: 'Ламберт (азимут)', units: 'градусы', params: p('azimuthal', 'equalArea', -90) },
  { code: 'EPSG:9832', name: 'Азимутальная равновеликая Ламберта (косая)', type: 'Ламберт (азимут)', units: 'градусы', params: p('azimuthal', 'equalArea', 0) },
  { code: 'EPSG:9824', name: 'Азимутальная равнопромежуточная (Северный полюс)', type: 'Азимутальная равнопромежуточная', units: 'градусы', params: p('azimuthal', 'equidistant', 90) },
  { code: 'EPSG:54001c', name: 'Азимутальная равнопромежуточная (Мир)', type: 'Азимутальная равнопромежуточная', units: 'градусы', params: p('azimuthal', 'equidistant', 0) },
];
