# План реализации новой спецификации

---

## 1. Store — `src/store/useAppStore.ts`

### 1.1. Типы — что изменить

```ts
// БЫЛО:
export type ProjectionFamily = 'cylindrical' | 'conic' | 'azimuthal';

// СТАЛО:
export type ProjectionFamily = 'cylindrical' | 'conic' | 'azimuthalPerspective' | 'azimuthalMath';
```

Добавить новые типы:
```ts
export type VizMethod =
  | 'none' | 'normals' | 'particles' | 'magnetic'
  | 'peel' | 'wave' | 'laser' | 'construction' | 'shadow';
export type HeatmapType = 'area' | 'angle' | 'scale';
export type TestFigureType = 'circles' | 'squares' | 'faces';
export type GraticuleStep = 1 | 5 | 10 | 15 | 30;
export type ConeHemisphere = 'north' | 'south';
```

### 1.2. `ProjectionParams` — добавить поля

```ts
rulerMode: 'off' | 'first' | 'second' | 'done';
rulerPoint1: [number, number] | null;
rulerPoint2: [number, number] | null;
utmZone: number | null;
azHeight: number;           // км, 100–1500000
azTiltDeg: number;          // градусы, 0–89
azAzimuthDeg: number;       // градусы, 0–360
coneHemisphere: ConeHemisphere;
somInclination: number;     // градусы, 0–180
somPeriod: number;          // минуты, 1–1440
somNodeLongitude: number;   // градусы
circleRadiusKm: number;     // км, 1000–20000
```

### 1.3. `AppState` — добавить непараметрические поля

```ts
vizMethod: VizMethod;
showHeatmap: boolean;
heatmapType: HeatmapType;
graticuleStep: GraticuleStep;
showGraticule: boolean;
testFigureType: TestFigureType | null;
showRays: boolean;
rulerActive: boolean;
unfoldTrigger: boolean;
```

### 1.4. Новые экшены

`setVizMethod`, `setShowHeatmap`, `setHeatmapType`, `setGraticuleStep`, `setShowGraticule`, `setTestFigureType`, `setShowRays`, `setRulerActive`, `setRulerMode`, `setRulerPoint1`, `setRulerPoint2`, `setUtmZone`, `setAzHeight`, `setAzTiltDeg`, `setAzAzimuthDeg`, `setConeHemisphere`, `setSomInclination`, `setSomPeriod`, `setSomNodeLongitude`, `setCircleRadiusKm`, `startUnfold`, `finishUnfold`

### 1.5. Значения по умолчанию в `create()`

```ts
vizMethod: 'none', showHeatmap: false, heatmapType: 'area', graticuleStep: 15,
showGraticule: true, testFigureType: null, showRays: true, rulerActive: false,
rulerMode: 'off', rulerPoint1: null, rulerPoint2: null, utmZone: null,
azHeight: 400, azTiltDeg: 0, azAzimuthDeg: 0, coneHemisphere: 'north',
somInclination: 98, somPeriod: 100, somNodeLongitude: 0,
circleRadiusKm: 10000, unfoldTrigger: false,
```

### 1.6. `setVariant` — сбрасывать новые поля

При вызове `setVariant(v)` сбрасывать все новые поля к дефолтам варианта (из `VariantDef`).

### 1.7. `resetParams` — аналогично `setVariant`.

### 1.8. `applyPreset` — принимать новые поля.

### 1.9. `DEFAULT_DISTORTION` — обновить

```ts
export const DEFAULT_DISTORTION: Record<ProjectionFamily, DistortionModel> = {
  cylindrical: 'conformal', conic: 'equidistant',
  azimuthalPerspective: 'conformal', azimuthalMath: 'equalArea',
};
```

### 1.10. Убрать логику `setParam` для conformal→antipode

При `distortion='conformal'` в азимутальной семье принудительно ставился `azLight='antipode'`. Теперь `azLight` определяется вариантом. Убрать.

### 1.11. `defaultParamsForFamily` — добавить `azimuthalPerspective` и `azimuthalMath`.

---

## 2. Selectors — `src/store/selectors.ts`

### 2.1. `useProjectionParams()` — добавить новые поля

Добавить в возвращаемый объект: `utmZone`, `azHeight`, `azTiltDeg`, `azAzimuthDeg`, `coneHemisphere`, `circleRadiusKm`, `somInclination`, `somPeriod`, `somNodeLongitude`, `rulerMode`, `rulerPoint1`, `rulerPoint2`.

### 2.2. Новый селектор `useVisualizationParams()`

```ts
export function useVisualizationParams() {
  return useAppStore((s) => ({
    vizMethod: s.vizMethod, showHeatmap: s.showHeatmap, heatmapType: s.heatmapType,
    graticuleStep: s.graticuleStep, showGraticule: s.showGraticule,
    testFigureType: s.testFigureType, showRays: s.showRays,
    rulerActive: s.rulerActive, rulerMode: s.rulerMode,
    rulerPoint1: s.rulerPoint1, rulerPoint2: s.rulerPoint2,
    unfoldTrigger: s.unfoldTrigger,
  }));
}
```

---

## 3. ProjectionVariants — `src/utils/projectionVariants.ts`

### 3.1. Новые типы вариантов

```ts
export type CylindricalVariant = 'equirectangular' | 'mercator' | 'transverseMercator' | 'obliqueMercator';
export type ConicVariant = 'lambertConformal' | 'albers' | 'equidistantConic';
export type AzimuthalPerspectiveVariant = 'gnomonic' | 'stereographic' | 'orthographic' | 'verticalPerspective' | 'tiltedPerspective';
export type AzimuthalMathVariant = 'lambertAzimuthalEqualArea' | 'azimuthalEquidistant';
export type ProjectionVariant = CylindricalVariant | ConicVariant | AzimuthalPerspectiveVariant | AzimuthalMathVariant;
```

**Удалить:** `miller`, `gallPeters`, `lambertCylEqualArea`, `polyconic`.

### 3.2. Новые поля `VariantDef`

```ts
surfaceTypeLabel: string;        // "Цилиндр", "Конус", "Плоскость", "Плоскость + наблюдатель"
propertyLabel: string;           // "Сохраняет углы", "Компромиссная" и т.д.
poleDistortionLabel: string | null; // "Полюса = линии", null
applicationLabel: string | null; // текст применения, null

// Флаги видимости контролов:
showCylinderOrientation: boolean;
cylinderOrientationEditable: boolean;
showUtmZone: boolean;
showParallel1: boolean;
showParallel2: boolean;
parallel2Editable: boolean;
showK0: boolean;
k0Editable: boolean;
showNorthSouth: boolean;
showAzHeight: boolean;
showAzTilt: boolean;
showAzAzimuth: boolean;
showTouchPointPresets: boolean;
showCircleRadius: boolean;
showOrbitalParams: boolean;

recommendedVizMethod: VizMethod;
touchPointPresets: { label: string; phi: number; lambda: number }[] | null;
defaultAzHeight: number | null;
defaultSomInclination: number | null;
defaultSomPeriod: number | null;
```

### 3.3. Цилиндрические (4 варианта)

| Вариант | dist. | surfaceTypeLabel | propertyLabel | ключевые show-флаги |
|---|---|---|---|---|
| `equirectangular` | equidistant | "Цилиндр" | "Компромиссная" | showParallel1, showK0 (k0Editable: true), showCylinderOrientation |
| `mercator` | conformal | "Цилиндр" | "Сохраняет углы" | showParallel1, showParallel2 (read-only), showK0, showCylinderOrientation |
| `transverseMercator` | conformal | "Цилиндр (на боку)" | "Сохраняет углы" | showUtmZone, showK0 (k0Editable: true), showCylinderOrientation, lockedGamma=90 |
| `obliqueMercator` | conformal | "Цилиндр (наклонный)" | "Сохраняет углы" | showK0, showOrbitalParams, showCylinderOrientation, lockedGamma=null |

### 3.4. Конические (3 варианта)

Все с `showParallel1`, `showParallel2` (editable), `showNorthSouth`.
Различаются `distortion` и `propertyLabel`:
- `lambertConformal` — conformal, "Сохраняет углы (формы)"
- `albers` — equalArea, "Сохраняет площади"
- `equidistantConic` — equidistant, "Сохраняет расстояния вдоль меридианов"

### 3.5. Азимутальные перспективные (5 вариантов)

`family = 'azimuthalPerspective'`. Все с `showTouchPointPresets`.
- `gnomonic` — azLight=center, hasRays=true
- `stereographic` — azLight=antipode, hasRays=true
- `orthographic` — azLight=infinity, hasRays=true
- `verticalPerspective` — showAzHeight, azLight=center
- `tiltedPerspective` — showAzHeight, showAzTilt, showAzAzimuth, azLight=center

### 3.6. Азимутальные математические (2 варианта)

`family = 'azimuthalMath'`. `hasRays=false`, `hasLamp=false`, `azLight='math'`.
- `lambertAzimuthalEqualArea` — equalArea, "Сохраняет площади", showCircleRadius
- `azimuthalEquidistant` — equidistant, "Сохраняет расстояния от центра", showCircleRadius

### 3.7. `variantDef()`, `defaultVariant()`, `toOptions` — обновить

- `variantDef` — добавить проверку для `AZIMUTHAL_PERSPECTIVE_VARIANTS` и `AZIMUTHAL_MATH_VARIANTS`
- `defaultVariant` — вернуть `'mercator'`/`'lambertConformal'`/`'gnomonic'`/`'lambertAzimuthalEqualArea'`
- Экспортировать `*_OPTIONS` для всех четырёх групп

---

## 4. Constants: Geometry — `src/constants/geometry.ts`

### Новые константы

```ts
export const UTM_ZONE_WIDTH = 6;
export const UTM_ZONE1_MERIDIAN = -177;
export const UTM_TOTAL_ZONES = 60;
export const EARTH_RADIUS_KM = 6371;
export const EARTH_HALF_CIRCUM_KM = Math.PI * EARTH_RADIUS_KM;
export const AZ_HEIGHT_MIN = 100;
export const AZ_HEIGHT_MAX = 1500000;
export const AZ_HEIGHT_STEP = 100;
export const CIRCLE_RADIUS_MIN = 1000;
export const CIRCLE_RADIUS_MAX = EARTH_HALF_CIRCUM_KM;
export const SOM_INCLINATION_MIN = 0;
export const SOM_INCLINATION_MAX = 180;
export const SOM_PERIOD_MIN = 1;
export const SOM_PERIOD_MAX = 1440;
```

### Новые хелперы

- `utmZoneToCentralMeridian(zone: number): number` — зона → центральный меридиан
- `centralMeridianToUtmZone(lambda0: number): number` — меридиан → ближайшая зона
- `circleRadiusToScale(radiusKm: number): number` — радиус в км → scaleFactor
- `scaleToCircleRadius(scale: number): number` — scaleFactor → радиус в км
- `k0ToStandardParallel(k0: number): number` — k₀ → стандартная параллель (φ = arccos(k₀))
- `standardParallelToK0(phi: number): number` — параллель → k₀ (cos(φ))

---

## 5. Constants: Design Tokens — `src/constants/designTokens.ts`

Добавить:
```ts
export const NEON_GREEN = '#00ff66';       // зелёное кольцо касания
export const NEON_RED = '#ff3333';         // красная линия разреза
export const PARTICLE_COLOR = '#ffe600';   // частицы
export const WAVE_COLOR = 'rgba(0, 229, 255, 0.15)';
export const LASER_COLOR = '#ff00ff';      // лазерный сканер
export const NORMAL_COLOR = 'rgba(255, 255, 255, 0.6)';
```

---

## 6. Constants: EPSG Presets — `src/constants/epsgPresets.ts`

- Удалить пресеты с `miller`, `gallPeters`, `lambertCylEqualArea`, `polyconic`
- `externalPerspective` → заменить на `verticalPerspective` + добавить `azHeight`
- Тип `EpsgPreset` расширить опциональными полями: `utmZone`, `azHeight`, `azTiltDeg`, `azAzimuthDeg`, `coneHemisphere`, `circleRadiusKm`, `somInclination`, `somPeriod`, `somNodeLongitude`

---

## 7. UI: Labels — `src/components/ui/labels.ts`

- `FAMILY_LABEL` — добавить `azimuthalPerspective: 'Азимутальная перспективная'`, `azimuthalMath: 'Азимутальная математическая'`
- Экспортировать `*_OPTIONS` для всех 4 групп
- Добавить словари: `VIZ_METHOD_LABELS`, `HEATMAP_TYPE_LABELS`, `TEST_FIGURE_LABELS`, `GRATICULE_STEP_OPTIONS`, `CYLINDER_ORIENTATION_LABELS`, `CONE_HEMISPHERE_OPTIONS`, `UTM_ZONE_OPTIONS`, `AZ_LIGHT_LABEL_MAP`, `AZ_LIGHT_ICON_MAP`

---

## 8. UI: Styles — `src/components/ui/styles.ts`

Добавить CSS-классы: `badgeClass`, `badgeMuted`, `toggleTrack`, `toggleTrackOn`, `toggleTrackOff`, `toggleThumb`, `toggleThumbOn`, `toggleThumbOff`, `circularSliderTrack`, `circularSliderFill`, `circularSliderThumb`, `radioGroup`, `radioOption`, `radioOptionActive`, `radioOptionInactive`, `presetChip`, `presetChipActive`, `numberInput`.

---

## 9. UI: Icons — `src/components/ui/icons.tsx`

Добавить 9 новых SVG-иконок (16×16, stroke-based, currentColor):
- `RulerIcon` — линейка
- `HeatmapIcon` — тепловая карта
- `FiguresIcon` — тестовые фигуры
- `RaysIcon` — лучи
- `GraticuleIcon` — сетка
- `UnfoldIcon` — развёртывание
- `NorthSouthIcon` — север/юг
- `SatelliteIcon` — спутник
- `PinIcon` — булавка

Плюс 4 иконки для новых групп в каталоге: `CylinderSurfaceIcon`, `ConeSurfaceIcon`, `LightSourceIcon`, `PlaneMathIcon`.

---

## 10. ProjectionMapper — `src/utils/projectionMapper.ts`

### 10.1. Удалить
- Функцию `makeMillerProjection` целиком
- Ветку `if (state.variant === 'miller')` в `getD3Projection`

### 10.2. Добавить: `makeVerticalPerspective(heightKm)`

Вертикальная (Near-Sided) перспективная проекция. Наблюдатель на расстоянии `heightKm` км над точкой касания. Формула:
- Для точки с угловым расстоянием `c` от точки касания:
  - `k = (R+H) / (H + R*(1-cos(c)))`
  - `x = k * R * sin(c) * sin(az)`, `y = k * R * sin(c) * cos(az)`
- При H→∞ стремится к ортографической.

### 10.3. Добавить: `makeTiltedPerspective(heightKm, tiltDeg, azimuthDeg)`

Комбинация Vertical Perspective + поворот плоскости на tiltDeg + азимут azimuthDeg.

### 10.4. `getD3Projection` — полностью переписать

Обрабатывать 4 семейства:
- **cylindrical** — как сейчас (makeCylindricalProjection), но для UTM использовать `utmZoneToCentralMeridian(utmZone)` вместо `lambda0`
- **conic** — знак параллелей из `coneHemisphere`
- **azimuthalPerspective** — вертикальная/наклонная/гномоническая/стереографическая/ортографическая
- **azimuthalMath** — lambertAzimuthalEqualArea / azimuthalEquidistant, scale из `circleRadiusToScale(circleRadiusKm)`

### 10.5. `computeAreaDistortion` — обновить

Для `azimuthalMath` использовать `circleRadiusToScale`. Для `verticalPerspective`/`tiltedPerspective` — базовый расчёт.

---

## 11. AuxSurfaceGeometry — `src/utils/auxSurfaceGeometry.ts`

### 11.1. Новые экспортируемые типы

```ts
export interface NormalLine { globePoint: Vec3; surfacePoint: Vec3; length: number; }
export interface ParticleTrajectory { globePoint: Vec3; surfacePoint: Vec3; controlPoints: Vec3[]; }
export interface LaserScanFrame { ringPoints: Vec3[]; projectedPoints: Vec3[]; latitude: number; }
```

### 11.2. Новые экспортируемые функции

| Функция | Метод | Назначение |
|---|---|---|
| `computePerpendicularNormals(surface, gridStep, radius)` | 1 | Короткие нормали от точек глобуса к поверхности |
| `computeParticleTrajectories(surface, family, gridStep, radius)` | 2 | Траектории частиц |
| `computeMagneticFieldLines(surface, family, numLines, radius)` | 3 | Изогнутые магнитные линии |
| `computeLaserScanRing(surface, latitude, family, numPoints, radius)` | 6 | Кольцо сканера + проекция |
| `computeCutLine(surface, lambda0, family, numPoints, radius)` | — | Красная линия разреза |
| `computeSatellitePosition(phi0, lambda0, heightKm, earthRadiusKm, modelRadius)` | — | Позиция спутника |
| `computeOrbitalPath(time, inclination, period, nodeLongitude, modelRadius, orbitRadius)` | — | Точка на орбите SOM |
| `vec3Distance(a, b)` | — | Расстояние между Vec3 |
| `vec3Normalize(v)` | — | Нормализация Vec3 |

### 11.3. `computeAuxSurfaceParams` — расширить

Добавить обработку `azimuthalPerspective` (плоскость с учётом azHeight для vertical/tilted) и `azimuthalMath` (плоскость без источника, размер из circleRadiusKm).

### 11.4. `computeCentralMeridianRays` — обновить

Для `verticalPerspective` — лучи от спутника (на высоте azHeight) через точки глобуса к плоскости.

---

## 12. Tissot — `src/utils/tissot.ts`

### 12.1. Параметризовать плотность сетки

Добавить параметр `density` в `computeTissotGrid()` (сейчас жёстко 30°). Использовать значение `graticuleStep` из store для согласованности.

---

## 13. CircularSlider — `src/components/CircularSlider.tsx` (НОВЫЙ)

Круговой слайдер-циферблат для угловых параметров.

**Props:** `value`, `min` (default -180), `max` (default 180), `step` (default 1), `onChange`, `disabled`, `size` (default 80), `title`, `centerLabel`.

**Реализация:**
- SVG с круглой дорожкой (`stroke-white/10`, толщина 3px)
- Заполненная дуга (`stroke-neon-blue`) от 0 до текущего значения
- Бегунок на конце дуги (радиус 6px, `fill-neon-blue`)
- В центре — текущее значение + `°`
- Взаимодействие: mousedown → mousemove → вычисление угла → onChange
- Touch-события для мобильных
- Анимация: `transition: stroke-dashoffset 0.15s`

---

## 14. Toggle — `src/components/Toggle.tsx` (НОВЫЙ)

Тумблер вкл/выкл.

**Props:** `checked`, `onChange`, `label`, `icon?`, `disabled?`, `size?` ('sm' | 'md').

**Реализация:**
- Горизонтальный ряд: иконка + лейбл + переключатель
- Переключатель: трек (w-9 h-5) + бегунок (w-4 h-4)
- Вкл: `bg-neon-blue/30`, бегунок `translate-x-4`
- Выкл: `bg-white/10`, бегунок `translate-x-0`
- Анимация: `transition-colors duration-200`, `transition-transform duration-200`
- Доступность: `<button role="switch" aria-checked={checked}>`

---

## 15. Badge — `src/components/ui/Badge.tsx` (НОВЫЙ)

Стеклянный бейдж для read-only информации.

**Props:** `label`, `icon?`, `variant?` ('default' | 'green' | 'red').

**Реализация:** `<span>` с `badgeClass badgeMuted`. Иконка слева, размер 12×12.

---

## 16. ControlPanel — `src/components/ControlPanel.tsx`

**Полная перезапись.** Компонент разбивается на подкомпоненты:

### 16.1. `ControlPanel` (основной)
Рендерит:
- `<TopRow>` — кнопки (Выбрать проекцию, Инфо, Сброс)
- `<BadgeRow>` — бейджи (тип поверхности + свойство)
- `<ProjectionParamsSection>` — контекстно-зависимые контролы
- `<VisualizationSection>` — универсальная панель визуализации
- Модальные окна: `ProjectionCatalog`, `ProjectionSummary`

### 16.2. `ProjectionParamsSection` — рендерит в зависимости от `def.show*`:
- **Ориентация цилиндра** (Dropdown или read-only текст)
- **UTM зона** (Dropdown 1–60)
- **λ₀** (CircularSlider / скрыт при UTM)
- **Параллель 1** (ParamSlider)
- **k₀** (range + синхронизация с Параллелью 1 для Меркатора)
- **Параллель 2** (StdParallel2Control)
- **Север/Юг** (радио-кнопки)
- **Высота фонарика** (ParamSlider 100–1.5M км)
- **Наклон камеры** (ParamSlider 0–89°)
- **Азимут камеры** (CircularSlider 0–360°)
- **Точка касания φ₀** (ParamSlider)
- **Пресеты** (PresetChips)
- **Радиус круга** (ParamSlider 1000–20000 км)
- **Орбитальные параметры** (3 × ParamSlider: наклонение, период, долгота узла)
- **γ / Азимут** (ParamSlider / CircularSlider для косого)
- **Источник света** (read-only с иконкой)
- **Искажение полюсов** (read-only текст)
- **Применение** (read-only текст)

### 16.3. `VisualizationSection` — рендерит:
- Dropdown «Метод визуализации» (9 опций)
- Toggle «Индикатрисы Тиссо»
- Toggle «Сетка» + Dropdown шага (1/5/10/15/30°)
- Toggle «Тепловая карта» + Dropdown типа (площади/углы/масштаб)
- Dropdown «Тестовые фигуры» (нет/круги/квадраты/лица)
- Toggle «Лучи света» (только для hasRays)
- Кнопка «Развернуть» (для цилиндрических/конических)
- Toggle «Линейка»

### 16.4. `PresetChips`
Кнопки пресетов точки касания. Активный пресет подсвечивается.

---

## 17. ProjectionCatalog — `src/components/ProjectionCatalog.tsx`

Реорганизация на **4 группы**:
1. 🟫 Цилиндрические (4)
2. 🔺 Конические (3)
3. ⬜ Азимутальные перспективные (5)
4. 🟡 Азимутальные математические (2)

Поиск по всем 14 вариантам.

---

## 18. ProjectionSummary — `src/components/ProjectionSummary.tsx`

Добавить в таблицу новые параметры: зона UTM, высота источника, наклон камеры, азимут камеры, полушарие конуса, радиус круга, орбитальные параметры.

---

## 19. Map2D — `src/components/Map2D.tsx`

### 19.1. Градусная сетка — параметризованный шаг
Читать `graticuleStep` из `useVisualizationParams()`. Строить сетку через `d3Geo.geoGraticule().step([step, step])`.

### 19.2. Тепловая карта искажений
Новый слой `<g>` когда `showHeatmap === true`. Компонент `HeatmapOverlay` (можно внутри Map2D или отдельно):
- Сетка ячеек (напр. 2°×2°)
- Вычисление distortion для каждой ячейки
- Рендер `<path>` с цветом от зелёного к красному

### 19.3. Тестовые фигуры
Новый слой когда `testFigureType !== null`. Компонент `TestFiguresOverlay`:
- Рендер circle/square/face через D3-проекцию на сетке 30°

### 19.4. Линейка
Когда `rulerActive === true`:
- Клик ставит точку (не hover)
- `rulerPoint1` — красный кружок
- `rulerPoint2` — красный кружок + линия между точками (жёлтый dash)

### 19.5. UTM — затемнение
Для `transverseMercator` с `utmZone !== null`: рендерить полупрозрачный overlay вне зоны 6°. Компонент `UTMZoneMask`.

### 19.6. Клик для точки касания
Когда не в режиме линейки и азимутальная проекция с `showTouchPointPresets`: клик по карте → устанавливает φ₀, λ₀.

---

## 20. GlobeScene — `src/components/GlobeScene.tsx`

### 20.1. Передача новых параметров в `computeAuxSurfaceParams`
Добавить `azHeight`, `azTiltDeg`, `variant`, `circleRadiusKm` в вызов.

### 20.2. Условный рендеринг лучей
```tsx
{showRays && def.hasRays && <Rays params={params} surface={surface} />}
```

### 20.3. Новые 3D-компоненты
В `<Canvas>` добавить:
- `<TouchPointPin>` — для азимутальных
- `<CutLine>` — для цилиндрических/конических
- `<Satellite>` — для Vertical/Tilted Perspective
- `<VizMethodRenderer>` — диспетчер метода визуализации

---

## 21. Globe — `src/components/Globe.tsx`

- Шаг градусной сетки из `graticuleStep`
- Условный рендеринг сетки: `showGraticule`

---

## 22. AuxSurface — `src/components/AuxSurface.tsx`

- Для `azimuthalMath` — не рендерить aux-поверхность (только плоскость)
- Для `tiltedPerspective` — наклонённая плоскость

---

## 23. IntersectionDisks — `src/components/IntersectionDisks.tsx`

Перекрасить кольца касания в `NEON_GREEN` (вместо `NEON_WHITE`).

---

## 24. LightSource — `src/components/LightSource.tsx`

- Для `verticalPerspective`: маркер на позиции `computeSatellitePosition(...)`
- Для `tiltedPerspective`: аналогично
- Для `azimuthalMath`: не рендерить

---

## 25. Rays — `src/components/Rays.tsx`

- Рендерить только когда `showRays === true` и `def.hasRays`
- Для `verticalPerspective`: лучи от спутника к плоскости

---

## 26. TouchPointPin — `src/components/TouchPointPin.tsx` (НОВЫЙ)

Перетаскиваемая булавка на 3D-глобусе.

**Props:** `lambda0`, `phiOrigin`, `onChange(lon, lat)`.

**Реализация:**
- Сфера-маркер (r=0.3, NEON_YELLOW) в `lonLatToVec3(lambda0, phiOrigin, RADIUS)`
- Drag: mousedown → mousemove (raycasting → lon/lat → onChange)
- Точка всегда на сфере

---

## 27. CutLine — `src/components/CutLine.tsx` (НОВЫЙ)

Красная неоновая линия разреза на aux-поверхности.

**Props:** `surface`, `lambda0`, `family`.

**Реализация:**
- `computeCutLine(surface, lambda0, family)` → массив Vec3
- THREE.Line с `LineBasicMaterial({ color: NEON_RED })`

---

## 28. Satellite — `src/components/Satellite.tsx` (НОВЫЙ)

Маркер спутника/наблюдателя.

**Props:** `position`, `animated?`.

**Реализация:** box/sphere (r=0.2) в позиции. NEON_YELLOW. Для анимированного: `useFrame` обновляет позицию.

---

## 29. VizMethodRenderer — `src/components/VizMethodRenderer.tsx` (НОВЫЙ)

Диспетчер методов визуализации.

**Props:** `method`, `surface`, `params`.

**Реализация:** switch по `method` → рендерит соответствующий компонент:
- `normals` → PerpendicularNormals
- `particles` → ParticleTransfer
- `magnetic` → MagneticField
- `peel` → PeelOff
- `wave` → WaveProjection
- `laser` → LaserScanner
- `construction` → GeometricConstruction
- `shadow` → ShadowPlay
- `none` → null

---

## 30. PerpendicularNormals — `src/components/PerpendicularNormals.tsx` (НОВЫЙ)

**Метод 1: Перпендикулярные нормали.**

- `computePerpendicularNormals(surface, 30)` — сетка 30°
- Рендерит ~50 THREE.Line (NORMAL_COLOR, opacity 0.6)
- Длина линии = искажение в точке

---

## 31. ParticleTransfer — `src/components/ParticleTransfer.tsx` (НОВЫЙ)

**Метод 2: Капли и частицы.**

- `computeParticleTrajectories(surface, family, 30)` — траектории
- ~50-100 маленьких сфер (частиц, r=0.08, PARTICLE_COLOR)
- Анимация: `useFrame` обновляет прогресс (0→1) с задержкой от экватора к полюсам
- Для Меркатора: частицы у полюсов улетают по спирали вверх
- Опционально: trail из последних позиций

---

## 32. MagneticField — `src/components/MagneticField.tsx` (НОВЫЙ)

**Метод 3: Магнитное притяжение.**

- `computeMagneticFieldLines(surface, family, 16)` — 16 линий
- THREE.Line с catmull-rom кривой, NEON_ORANGE
- Линии изогнуты к поверхности

---

## 33. PeelOff — `src/components/PeelOff.tsx` (НОВЫЙ)

**Метод 4: Снятие шкуры.**

Упрощённая реализация:
- Полупрозрачная сфера (NEON_BLUE, opacity 0.3) поверх глобуса
- При активации (unfoldTrigger) сфера деформируется к aux-поверхности
- `useFrame` для morph-анимации

---

## 34. WaveProjection — `src/components/WaveProjection.tsx` (НОВЫЙ)

**Метод 5: Волновое проецирование.**

- Полупрозрачная расширяющаяся сфера (WAVE_COLOR)
- Анимация: `useFrame` увеличивает радиус
- При достижении aux-поверхности — сброс

---

## 35. LaserScanner — `src/components/LaserScanner.tsx` (НОВЫЙ)

**Метод 6: Лазерное сканирование.**

- `computeLaserScanRing(surface, lat, family)` для каждой широты
- Вращающееся кольцо (LASER_COLOR) + точки проекции на поверхности
- Анимация: `useFrame` двигает широту от -85° до +85°

---

## 36. GeometricConstruction — `src/components/GeometricConstruction.tsx` (НОВЫЙ)

**Метод 7: Геометрическое построение.**

- Виртуальные инструменты: линейка, циркуль, угольник
- Статичная демонстрация построения для выбранной проекции
- (Упрощённая реализация: показываем только ключевые линии построения)

---

## 37. ShadowPlay — `src/components/ShadowPlay.tsx` (НОВЫЙ)

**Метод 8: Театр теней.**

- 2-3 направленных источника света вокруг глобуса
- Тени от глобуса на aux-поверхность
- (Упрощённая реализация: показываем проекции теней как геометрические линии)

---

## 38. Тесты: Store — `src/store/useAppStore.test.ts`

- Добавить тесты для всех новых экшенов
- Проверить `setVariant` сбрасывает новые поля
- Проверить `resetParams` для всех 4 семейств
- Проверить `applyPreset` с новыми полями
- Проверить `DEFAULT_DISTORTION` для новых семейств
- Проверить что `setParam('distortion', 'conformal')` не меняет `azLight`

---

## 39. Тесты: ProjectionMapper — `src/utils/projectionMapper.test.ts`

- Удалить тесты для `miller`, `gallPeters`, `lambertCylEqualArea`
- Добавить тесты для `makeVerticalPerspective`:
  - На высоте 400 км: проекция конечна
  - На высоте 1.5M км: стремится к ортографической
- Добавить тесты для `makeTiltedPerspective`
- Добавить тесты для UTM: `utmZoneToCentralMeridian` round-trip
- Добавить тесты для `circleRadiusToScale` / `scaleToCircleRadius`
- Проверить `getD3Projection` для всех 14 вариантов

---

## 40. Тесты: AuxSurfaceGeometry — `src/utils/auxSurfaceGeometry.test.ts`

- `computePerpendicularNormals` — нормали не пусты, длины ≥ 0
- `computeParticleTrajectories` — траектории не пусты, содержат start и end
- `computeMagneticFieldLines` — линии не пусты
- `computeLaserScanRing` — кольцо содержит точки
- `computeCutLine` — линия на поверхности цилиндра/конуса
- `computeSatellitePosition` — позиция вне глобуса
- `computeOrbitalPath` — орбита замкнута (позиция возвращается через период)
- `vec3Distance`, `vec3Normalize` — базовые проверки
- `computeAuxSurfaceParams` для `azimuthalPerspective` и `azimuthalMath`

---

## 41. Тесты: ControlPanel — `src/components/ControlPanel.test.tsx`

Полный rewrite:
- Рендерит бейджи типа поверхности и свойства
- Рендерит контекстно-зависимые контролы для каждой из 14 групп
- Не рендерит нерелевантные контролы
- Кнопки пресетов работают
- UTM zone dropdown меняет lambda0
- Радио Север/Юг меняет coneHemisphere
- k₀ синхронизирует Параллель 1 для Меркатора
- Тумблеры визуализации переключаются
- Метод визуализации меняется через dropdown

---

## 42. Тесты: Map2D — `src/components/Map2D.test.tsx`

- Шаг градусной сетки из store
- Тепловая карта рендерится при showHeatmap
- Тестовые фигуры рендерятся при testFigureType
- Линейка: клик ставит точку
- UTM затемнение рендерится

---

## 43. Тесты: DocsConsistency — `src/__tests__/docsConsistency.test.ts`

Обновить все проверки:
- Новые файлы компонентов существуют
- Store поля документированы
- Все 14 вариантов в AGENTS.md
- Новые константы в geometry.ts документированы
- Новые exports из auxSurfaceGeometry.ts документированы

---

## 44. Тесты: Physics — `src/__tests__/physics.test.ts`

- Добавить round-trip тесты для Vertical/Tilted Perspective
- Добавить тесты для пересечений aux-поверхности для новых проекций
- Проверить что UTM zone → central meridian даёт правильный центр зоны
- Проверить что circleRadius влияет на масштаб азимутальной мат. проекции

---

## 45. Тесты: Geometry — `src/constants/geometry.test.ts`

- `utmZoneToCentralMeridian(1)` = -177
- `utmZoneToCentralMeridian(60)` = 177
- `centralMeridianToUtmZone(0)` = 31
- `circleRadiusToScale(EARTH_HALF_CIRCUM_KM)` ≈ 1
- `k0ToStandardParallel(1)` ≈ 0
- `standardParallelToK0(0)` = 1
- `k0ToStandardParallel(0.7)` ≈ 45.6

---

## 46. Тесты: EPSG Presets — `src/constants/epsgPresets.test.ts`

- Проверить что все пресеты ссылаются на существующие варианты
- Проверить что удалённые варианты не упоминаются
- Проверить что `verticalPerspective` используется вместо `externalPerspective`

---

## 47. Тесты: EpsgCatalog — `src/components/EpsgCatalog.test.tsx`

- Обновить под новый набор вариантов
- Проверить фильтрацию по 4 группам

---

## 48. Тесты: App — `src/App.test.tsx`

- Без изменений (проверяет что App рендерится)

---

## 49. AGENTS.md

Полная перезапись разделов:
- **Project status** — обновить описание (14 вариантов, 4 семейства)
- **Architecture** — описать новые 4 семейства, контекстно-зависимые контролы, панель визуализации, 8 методов
- **Store shape** — документировать все новые поля
- **Hard rules** — обновить под новую структуру
- Описать новые компоненты: CircularSlider, Toggle, Badge, TouchPointPin, CutLine, Satellite, VizMethodRenderer + 8 методов

---

## 50. docs/BRD.md

- Обновить описание проекционных групп (4 вместо 3, 14 вместо 17)
- Описать новые контролы и их контекстную зависимость
- Описать панель визуализации

---

## 51. docs/specification.md

- Добавить раздел «Методы визуализации» с описанием 8 методов
- Обновить раздел «Проекции» под новую структуру
- Описать UTM, Vertical/Tilted Perspective, SOM

---

## 52. README.md

Обновить количество проекций, упомянуть новые возможности.

---

## 53. Порядок реализации

Рекомендуемый порядок (зависимости):

```
1.  constants/geometry.ts          (новые константы + хелперы)
2.  constants/designTokens.ts      (новые токены)
3.  projectionVariants.ts          (14 новых вариантов + VariantDef)
4.  store/useAppStore.ts           (новые поля + экшены)
5.  store/selectors.ts             (useVisualizationParams)
6.  projectionsMapper.ts           (новые/удалённые проекции)
7.  auxSurfaceGeometry.ts          (новые geometry-функции)
8.  tissot.ts                      (параметр density)
9.  --- UI-компоненты ---
10. ui/styles.ts                   (новые CSS-классы)
11. ui/icons.tsx                   (новые иконки)
12. ui/labels.ts                   (новые словари)
13. ui/Badge.tsx                   (НОВЫЙ)
14. CircularSlider.tsx             (НОВЫЙ)
15. Toggle.tsx                     (НОВЫЙ)
16. ControlPanel.tsx               (полная перезапись)
17. ProjectionCatalog.tsx          (4 группы)
18. ProjectionSummary.tsx          (новые параметры)
19. Map2D.tsx                      (heatmap, фигуры, линейка, UTM mask)
20. Globe.tsx                      (graticuleStep)
21. AuxSurface.tsx                 (новые family)
22. IntersectionDisks.tsx          (зелёный цвет)
23. LightSource.tsx                (Vertical/Tilted/azimuthalMath)
24. Rays.tsx                       (showRays toggle)
25. TouchPointPin.tsx              (НОВЫЙ)
26. CutLine.tsx                    (НОВЫЙ)
27. Satellite.tsx                  (НОВЫЙ)
28. VizMethodRenderer.tsx          (НОВЫЙ)
29. PerpendicularNormals.tsx       (НОВЫЙ)
30. ParticleTransfer.tsx           (НОВЫЙ)
31. MagneticField.tsx              (НОВЫЙ)
32. PeelOff.tsx                    (НОВЫЙ)
33. WaveProjection.tsx             (НОВЫЙ)
34. LaserScanner.tsx               (НОВЫЙ)
35. GeometricConstruction.tsx      (НОВЫЙ)
36. ShadowPlay.tsx                 (НОВЫЙ)
37. GlobeScene.tsx                 (интеграция новых компонентов)
38. epsgPresets.ts                 (удаление/обновление пресетов)
39. --- ТЕСТЫ (можно параллельно с кодом) ---
40. geometry.test.ts               (новые хелперы)
41. projectionMapper.test.ts       (новые проекции)
42. auxSurfaceGeometry.test.ts     (новые функции)
43. useAppStore.test.ts            (новые поля/экшены)
44. ControlPanel.test.tsx          (полный rewrite)
45. Map2D.test.tsx                 (новые слои)
46. epsgPresets.test.ts            (обновление)
47. EpsgCatalog.test.tsx           (обновление)
48. physics.test.ts                (новые инварианты)
49. docsConsistency.test.ts        (полное обновление)
50. --- ДОКУМЕНТАЦИЯ ---
51. AGENTS.md
52. docs/BRD.md
53. docs/specification.md
54. README.md
```

---

## Сводка: все затронутые файлы

### Изменяемые (29 файлов)

| Файл | Характер изменений |
|---|---|
| `src/store/useAppStore.ts` | +15 полей + 20 экшенов, изменён setVariant/resetParams/applyPreset |
| `src/store/selectors.ts` | +useVisualizationParams, расширен useProjectionParams |
| `src/utils/projectionVariants.ts` | -4 +1 вариантов, +18 полей VariantDef, 4 группы |
| `src/utils/projectionMapper.ts` | -makeMiller, +makeVerticalPerspective, +makeTiltedPerspective, переписан getD3Projection |
| `src/utils/auxSurfaceGeometry.ts` | +9 функций, расширен computeAuxSurfaceParams |
| `src/utils/tissot.ts` | +параметр density |
| `src/constants/geometry.ts` | +15 констант, +6 хелперов |
| `src/constants/designTokens.ts` | +6 токенов |
| `src/constants/epsgPresets.ts` | удаление/обновление пресетов, расширен тип |
| `src/components/ControlPanel.tsx` | **ПОЛНАЯ ПЕРЕЗАПИСЬ** |
| `src/components/ProjectionCatalog.tsx` | 4 группы вместо 3 |
| `src/components/ProjectionSummary.tsx` | новые параметры в таблице |
| `src/components/Map2D.tsx` | +heatmap, +figures, +ruler, +UTM mask, graticuleStep |
| `src/components/GlobeScene.tsx` | +TouchPointPin, +CutLine, +Satellite, +VizMethodRenderer |
| `src/components/Globe.tsx` | graticuleStep, showGraticule |
| `src/components/AuxSurface.tsx` | azimuthalMath, tiltedPerspective |
| `src/components/IntersectionDisks.tsx` | NEON_GREEN |
| `src/components/LightSource.tsx` | Vertical/Tilted/azimuthalMath |
| `src/components/Rays.tsx` | showRays toggle |
| `src/components/ui/styles.ts` | +15 CSS-классов |
| `src/components/ui/icons.tsx` | +13 иконок |
| `src/components/ui/labels.ts` | +словари, 4 группы |
| `src/components/Dropdown.tsx` | без изменений |
| `src/components/EpsgCatalog.tsx` | обновление под новые варианты |
| `src/__tests__/docsConsistency.test.ts` | полное обновление |
| `src/__tests__/physics.test.ts` | +тесты для новых проекций |
| `src/store/useAppStore.test.ts` | +тесты для новых полей/экшенов |
| `src/utils/projectionMapper.test.ts` | -старые +новые тесты |
| `src/constants/geometry.test.ts` | +тесты для новых хелперов |

### Новые файлы (13 файлов)

| Файл | Назначение |
|---|---|
| `src/components/CircularSlider.tsx` | Круговой слайдер-циферблат |
| `src/components/Toggle.tsx` | Тумблер вкл/выкл |
| `src/components/ui/Badge.tsx` | Стеклянный бейдж |
| `src/components/TouchPointPin.tsx` | Перетаскиваемая булавка на глобусе |
| `src/components/CutLine.tsx` | Красная линия разреза |
| `src/components/Satellite.tsx` | Маркер спутника |
| `src/components/VizMethodRenderer.tsx` | Диспетчер методов визуализации |
| `src/components/PerpendicularNormals.tsx` | Метод 1: нормали |
| `src/components/ParticleTransfer.tsx` | Метод 2: частицы |
| `src/components/MagneticField.tsx` | Метод 3: магнитное поле |
| `src/components/PeelOff.tsx` | Метод 4: снятие шкуры |
| `src/components/WaveProjection.tsx` | Метод 5: волна |
| `src/components/LaserScanner.tsx` | Метод 6: лазерный сканер |

### Документация (4 файла)

| Файл | Характер изменений |
|---|---|
| `AGENTS.md` | Полная перезапись |
| `docs/BRD.md` | Обновление |
| `docs/specification.md` | Обновление + новый раздел |
| `README.md` | Обновление |

### Не затронуты

`main.tsx`, `App.tsx`, `App.test.tsx`, `index.css`, `Dropdown.test.tsx`, `vite-env.d.ts`, `EpsgCatalog.test.tsx` (частично), публичные GeoJSON/TopoJSON файлы.

**Итого: ~42 файла (29 изменяемых + 13 новых), ~4 файла документации.**
