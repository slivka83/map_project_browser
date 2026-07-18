import type { ProjectionParams } from '../store/useAppStore';

export interface EpsgEntry {
  code: string;
  name: string;
  type: string; // Mercator, Albers, …
  units: string; // метры / градусы
  params: Partial<ProjectionParams> & Pick<ProjectionParams, 'family' | 'variant' | 'distortion'>;
}

// Each preset maps to one of the 14 named variants plus its central latitude
// and other distinguishing params. New optional fields (utmZone, azHeight,
// circleRadiusKm, …) are added where a preset exercises that feature.
export const EPSG_PRESETS: EpsgEntry[] = [
  { code: 'EPSG:3395', name: 'Меркатор', type: 'Mercator', units: 'градусы', params: { variant: 'mercator', family: 'cylindrical', distortion: 'conformal', phiOrigin: 0 } },
  { code: 'EPSG:3857', name: 'Веб-Меркатор', type: 'Mercator', units: 'метры', params: { variant: 'mercator', family: 'cylindrical', distortion: 'conformal', phiOrigin: 0 } },
  { code: 'EPSG:32662', name: 'Равнопромежуточная (Платте-Карре)', type: 'Платте-Карре', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equidistant', phiOrigin: 0 } },
  { code: 'CYL-EA-GALL-PETERS', name: 'Галль–Петерс', type: 'Галль–Петерс', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 45 } },
  { code: 'CYL-EA-BEHRMANN', name: 'Бергман', type: 'Бергман', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 30 } },
  { code: 'CYL-EA-HOBO-DYER', name: 'Хобо–Дайер', type: 'Хобо–Дайер', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 37.5 } },
  { code: 'CYL-EA-TRYSTAN-EDWARDS', name: 'Тристан-Эдвардс', type: 'Тристан-Эдвардс', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 37.5 } },
  { code: 'CYL-EA-BALTHASART', name: 'Бальтасар', type: 'Бальтасар', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 50 } },
  { code: 'EPSG:9834', name: 'Цилиндрическая равновеликая Ламберта', type: 'Ламберт (цилиндр)', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 0 } },
  { code: 'CYL-EA-CRASTER', name: 'Крастер (равновеликая)', type: 'Крастер', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equalArea', phiOrigin: 62 } },
  { code: 'EPSG:32663', name: 'Равнопромежуточная цилиндрическая (φ=30°)', type: 'Равнопромежуточная (цилиндр)', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equidistant', phiOrigin: 30 } },
  { code: 'EPSG:32664', name: 'Равнопромежуточная цилиндрическая (φ=45°)', type: 'Равнопромежуточная (цилиндр)', units: 'градусы', params: { variant: 'equirectangular', family: 'cylindrical', distortion: 'equidistant', phiOrigin: 45 } },
  { code: 'EPSG:32601', name: 'Поперечный Меркатор (зона 1)', type: 'Поперечный Меркатор', units: 'метры', params: { variant: 'transverseMercator', family: 'cylindrical', distortion: 'conformal', phiOrigin: 0, utmZone: 1 } },
  { code: 'EPSG:32631', name: 'Поперечный Меркатор (зона 31)', type: 'Поперечный Меркатор', units: 'метры', params: { variant: 'transverseMercator', family: 'cylindrical', distortion: 'conformal', phiOrigin: 0, utmZone: 31 } },
  { code: 'EPSG:9801', name: 'Коническая равноугольная Ламберта', type: 'Ламберт (конус)', units: 'метры', params: { variant: 'lambertConformal', family: 'conic', distortion: 'conformal', phiOrigin: 45 } },
  { code: 'EPSG:3329', name: 'Коническая равноугольная (США)', type: 'Ламберт (конус)', units: 'метры', params: { variant: 'lambertConformal', family: 'conic', distortion: 'conformal', phiOrigin: 39 } },
  { code: 'EPSG:3034', name: 'Коническая равноугольная (Европа)', type: 'Ламберт (конус)', units: 'метры', params: { variant: 'lambertConformal', family: 'conic', distortion: 'conformal', phiOrigin: 50 } },
  { code: 'EPSG:9822', name: 'Коническая равновеликая (Альберс)', type: 'Альберс', units: 'метры', params: { variant: 'albers', family: 'conic', distortion: 'equalArea', phiOrigin: 35 } },
  { code: 'EPSG:3310', name: 'Коническая равновеликая (Альберс, США)', type: 'Альберс', units: 'метры', params: { variant: 'albers', family: 'conic', distortion: 'equalArea', phiOrigin: 37.5 } },
  { code: 'EPSG:9820', name: 'Коническая равновеликая (1 параллель)', type: 'Альберс', units: 'метры', params: { variant: 'albers', family: 'conic', distortion: 'equalArea', phiOrigin: 30 } },
  { code: 'EPSG:9823', name: 'Коническая равнопромежуточная', type: 'Равнопромежуточная (конус)', units: 'градусы', params: { variant: 'equidistantConic', family: 'conic', distortion: 'equidistant', phiOrigin: 40 } },
  { code: 'EPSG:54001', name: 'Коническая равнопромежуточная (Франция)', type: 'Равнопромежуточная (конус)', units: 'градусы', params: { variant: 'equidistantConic', family: 'conic', distortion: 'equidistant', phiOrigin: 46.65 } },
  { code: 'EPSG:9810', name: 'Стереографическая (Северный полюс)', type: 'Стереографическая', units: 'градусы', params: { variant: 'stereographic', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: 90, azLight: 'antipode' } },
  { code: 'STEREO-SOUTH', name: 'Стереографическая (Южный полюс)', type: 'Стереографическая', units: 'градусы', params: { variant: 'stereographic', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: -90, azLight: 'antipode' } },
  { code: 'EPSG:9809', name: 'Стереографическая (косая)', type: 'Стереографическая', units: 'градусы', params: { variant: 'stereographic', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: 0, azLight: 'antipode' } },
  { code: 'EPSG:9830', name: 'Азимутальная равновеликая Ламберта (Север)', type: 'Ламберт (азимут)', units: 'градусы', params: { variant: 'lambertAzimuthalEqualArea', family: 'azimuthalMath', distortion: 'equalArea', phiOrigin: 90 } },
  { code: 'EPSG:9831', name: 'Азимутальная равновеликая Ламберта (Юг)', type: 'Ламберт (азимут)', units: 'градусы', params: { variant: 'lambertAzimuthalEqualArea', family: 'azimuthalMath', distortion: 'equalArea', phiOrigin: -90 } },
  { code: 'EPSG:9832', name: 'Азимутальная равновеликая Ламберта (косая)', type: 'Ламберт (азимут)', units: 'градусы', params: { variant: 'lambertAzimuthalEqualArea', family: 'azimuthalMath', distortion: 'equalArea', phiOrigin: 0 } },
  { code: 'EPSG:9824', name: 'Азимутальная равнопромежуточная (Северный полюс)', type: 'Азимутальная равнопромежуточная', units: 'градусы', params: { variant: 'azimuthalEquidistant', family: 'azimuthalMath', distortion: 'equidistant', phiOrigin: 90 } },
  { code: 'AZ-EQ-WORLD', name: 'Азимутальная равнопромежуточная (Мир)', type: 'Азимутальная равнопромежуточная', units: 'градусы', params: { variant: 'azimuthalEquidistant', family: 'azimuthalMath', distortion: 'equidistant', phiOrigin: 0 } },
  { code: 'EPSG:4839', name: 'Вертикальная перспектива (400 км)', type: 'Вертикальная перспектива', units: 'градусы', params: { variant: 'verticalPerspective', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: 0, azLight: 'center', azHeight: 400 } },
  { code: 'EPSG:9840', name: 'Гномоническая', type: 'Гномоническая', units: 'градусы', params: { variant: 'gnomonic', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: 0, azLight: 'center' } },
  { code: 'EPSG:9841', name: 'Ортографическая', type: 'Ортографическая', units: 'градусы', params: { variant: 'orthographic', family: 'azimuthalPerspective', distortion: 'conformal', phiOrigin: 0, azLight: 'infinity' } },
];
