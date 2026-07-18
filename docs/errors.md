# Ошибки и недоделки — план исправления

Сформировано по результатам сверки `docs/to_do.md` с реальным кодом.
Тесты пройдены: **508/508**, сборка `tsc -b && vite build` — успешно, линт — чистый.

---

## 1. Критические (влияют на функциональность приложения)

### 1.1. `obliqueMercator`: параметры орбиты не показываются

**Файл:** `src/utils/projectionVariants.ts`  
**Строка:** определение `obliqueMercator` в `CYLINDRICAL_VARIANTS`

**Проблема:** поле `showOrbitalParams` имеет значение `false`. Спецификация §3.3 требует `true`, чтобы в ControlPanel отображались слайдеры наклонения, периода и долготы узла SOM.

**Исправление:**
```diff
- showOrbitalParams: false,
+ showOrbitalParams: true,
```

---

### 1.2. `makeTiltedPerspective` не существует

**Файл:** `src/utils/projectionMapper.ts`  
**Строка:** в `getD3Projection`, ветка `tiltedPerspective`

**Проблема:** функция `makeTiltedPerspective(heightKm, tiltDeg, azimuthDeg)` не создана. `tiltedPerspective` переиспользует `makeVerticalPerspective(azHeight)` без учёта наклона (`azTiltDeg`) и азимута (`azAzimuthDeg`) — проекция идентична вертикальной.

**Исправление:**
1. Создать функцию `makeTiltedPerspective(heightKm: number, tiltDeg: number, azimuthDeg: number, earthRadiusKm = 6371): GeoRawProjection`
   - Базовая формула как у `makeVerticalPerspective`: `k = (R+H)/(H + R·(1 - cos(c)))`, где `c` — угловое расстояние от точки касания.
   - Вектор направления наблюдателя повёрнут на `tiltDeg` от нормали в направлении `azimuthDeg`.
   - После вычисления `x,y` в плоскости камеры — повернуть результат на `-azimuthDeg`.
2. В `getD3Projection`, ветка `tiltedPerspective`: вызывать `makeTiltedPerspective(azHeight, azTiltDeg, azAzimuthDeg)`.
3. Разобрать `azTiltDeg`, `azAzimuthDeg` из `state` (сейчас они не деструктурируются).

---

### 1.3. Map2D: клик для установки точки касания (азимутальные проекции)

**Файл:** `src/components/Map2D.tsx`  
**Метод:** `handleMapClick`

**Проблема:** `handleMapClick` обрабатывает только режим линейки. Спецификация §19.6 требует: когда не в режиме линейки И азимутальная проекция с `showTouchPointPresets` — клик по карте устанавливает `phiOrigin` и `lambda0`.

**Исправление:** добавить ветку в `handleMapClick`:
```tsx
const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
  if (!projRef) return;
  // Получить (x,y) → инвертировать в (lon, lat)
  // (та же логика вычисления координат, что в handlePointerMove)
  const [lon, lat] = inv;

  if (rulerActive) {
    // существующая логика линейки
  } else if (def.showTouchPointPresets) {
    setParam('phiOrigin', lat);
    setParam('lambda0', lon);
  }
};
```
Нужно получить `def` (variant definition) и `setParam` в компоненте Map2D.

---

## 2. Важные (влияют на тестовое покрытие)

### 2.1. `geometry.test.ts` — нет тестов для новых хелперов (секция 45)

**Файл для создания/дополнения:** `src/constants/geometry.test.ts`

**Требуемые тесты:**
```ts
import { utmZoneToCentralMeridian, centralMeridianToUtmZone, circleRadiusToScale, scaleToCircleRadius, k0ToStandardParallel, standardParallelToK0, EARTH_HALF_CIRCUM_KM } from './geometry';

describe('utmZoneToCentralMeridian', () => {
  it('zone 1 = -177', () => expect(utmZoneToCentralMeridian(1)).toBe(-177));
  it('zone 60 = 177', () => expect(utmZoneToCentralMeridian(60)).toBe(177));
  it('zone 31 = 3 (центральная Европа)', () => expect(utmZoneToCentralMeridian(31)).toBe(3));
});

describe('centralMeridianToUtmZone', () => {
  it('0° = зона 31', () => expect(centralMeridianToUtmZone(0)).toBe(31));
  it('-177° = зона 1', () => expect(centralMeridianToUtmZone(-177)).toBe(1));
  it('177° = зона 60', () => expect(centralMeridianToUtmZone(177)).toBe(60));
});

describe('circleRadiusToScale / scaleToCircleRadius', () => {
  it('полуокружность → scale ≈ 1', () => {
    expect(circleRadiusToScale(EARTH_HALF_CIRCUM_KM)).toBeCloseTo(1, 3);
  });
  it('round-trip', () => {
    expect(scaleToCircleRadius(circleRadiusToScale(10000))).toBeCloseTo(10000, 0);
  });
});

describe('k0ToStandardParallel / standardParallelToK0', () => {
  it('k0=1 → parallel ≈ 0°', () => expect(k0ToStandardParallel(1)).toBeCloseTo(0, 1));
  it('parallel=0 → k0=1', () => expect(standardParallelToK0(0)).toBe(1));
  it('k0=0.7 → parallel ≈ 45.6°', () => expect(k0ToStandardParallel(0.7)).toBeCloseTo(45.6, 0));
  it('round-trip', () => {
    expect(standardParallelToK0(k0ToStandardParallel(0.8))).toBeCloseTo(0.8, 3);
  });
});
```

---

### 2.2. `auxSurfaceGeometry.test.ts` — нет тестов для новых функций (секция 40)

**Файл для дополнения:** `src/utils/auxSurfaceGeometry.test.ts`

Требуется **9 новых `describe`-блоков**:

#### 2.2.1. `computePerpendicularNormals`
```ts
describe('computePerpendicularNormals', () => {
  it('возвращает непустой массив нормалей для цилиндрической поверхности', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const normals = computePerpendicularNormals(surface, 30);
    expect(normals.length).toBeGreaterThan(0);
    for (const n of normals) {
      expect(n.length).toBeGreaterThanOrEqual(0);
      expect(n.globePoint).toHaveLength(3);
      expect(n.surfacePoint).toHaveLength(3);
    }
  });
  it('работает для конической поверхности', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 45, 1)!;
    expect(computePerpendicularNormals(surface, 30).length).toBeGreaterThan(0);
  });
  it('работает для плоскости', () => {
    const surface = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
    expect(computePerpendicularNormals(surface, 30).length).toBeGreaterThan(0);
  });
});
```

#### 2.2.2. `computeParticleTrajectories`
```ts
describe('computeParticleTrajectories', () => {
  it('содержит start и end точки для каждого трека', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const trajs = computeParticleTrajectories(surface, 'cylindrical', 30);
    expect(trajs.length).toBeGreaterThan(0);
    for (const tr of trajs) {
      expect(tr.globePoint).toHaveLength(3);
      expect(tr.surfacePoint).toHaveLength(3);
      expect(tr.controlPoints).toHaveLength(3);
    }
  });
});
```

#### 2.2.3. `computeMagneticFieldLines`
```ts
describe('computeMagneticFieldLines', () => {
  it('возвращает numLines линий', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const lines = computeMagneticFieldLines(surface, 'cylindrical', 8);
    expect(lines).toHaveLength(8);
  });
});
```

#### 2.2.4. `computeLaserScanRing`
```ts
describe('computeLaserScanRing', () => {
  it('возвращает кольцо + проекцию для заданной широты', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const frame = computeLaserScanRing(surface, 0, 'cylindrical', 32);
    expect(frame.ringPoints.length).toBeGreaterThan(0);
    expect(frame.projectedPoints.length).toBeGreaterThan(0);
    expect(frame.latitude).toBe(0);
  });
});
```

#### 2.2.5. `computeCutLine`
```ts
describe('computeCutLine', () => {
  it('для цилиндра: линия вдоль образующей', () => {
    const surface = computeAuxSurfaceParams('cylindrical', 0, 0, 1)!;
    const pts = computeCutLine(surface, 0, 'cylindrical', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
  it('для конуса: линия вдоль образующей', () => {
    const surface = computeAuxSurfaceParams('conic', 0, 45, 1)!;
    const pts = computeCutLine(surface, 0, 'conic', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
  it('для плоскости: окружность', () => {
    const surface = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
    const pts = computeCutLine(surface, 0, 'azimuthalPerspective', 16);
    expect(pts.length).toBeGreaterThan(0);
  });
});
```

#### 2.2.6. `computeSatellitePosition`
```ts
describe('computeSatellitePosition', () => {
  it('позиция вне глобуса (дальше RADIUS от центра)', () => {
    const pos = computeSatellitePosition(0, 0, 400, 6371, RADIUS);
    expect(Math.hypot(pos[0], pos[1], pos[2])).toBeGreaterThan(RADIUS);
  });
  it('направление совпадает с нормалью точки касания', () => { /* dot product ≈ 1 */ });
});
```

#### 2.2.7. `computeOrbitalPath`
```ts
describe('computeOrbitalPath', () => {
  it('орбита периодична: t=0 и t=1 дают одну точку', () => {
    const a = computeOrbitalPath(0, 98, 100, 0);
    const b = computeOrbitalPath(1, 98, 100, 0);
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[2]).toBeCloseTo(b[2], 6);
  });
});
```

#### 2.2.8. `vec3Distance` / `vec3Normalize`
```ts
describe('vec3Distance', () => {
  it('расстояние от (0,0,0) до (3,4,0) = 5', () => {
    expect(vec3Distance([0,0,0], [3,4,0])).toBe(5);
  });
});
describe('vec3Normalize', () => {
  it('нормализованный вектор имеет длину 1', () => {
    const n = vec3Normalize([3, 4, 0]);
    expect(vec3Distance(n, [0,0,0])).toBeCloseTo(1, 6);
  });
});
```

#### 2.2.9. `computeAuxSurfaceParams` для новых семейств
```ts
it('azimuthalPerspective: плоскость касания', () => {
  const surface = computeAuxSurfaceParams('azimuthalPerspective', 0, 30, 1)!;
  expect(surface.kind).toBe('plane');
  expect(surface.size).toBeGreaterThan(0);
});
it('azimuthalMath: плоскость касания', () => {
  const surface = computeAuxSurfaceParams('azimuthalMath', 0, 30, 1, RADIUS, null, 0, 'equalArea', 'math', 'lambertAzimuthalEqualArea', 400, 10000)!;
  expect(surface.kind).toBe('plane');
});
```

---

### 2.3. `projectionMapper.test.ts` — неполные тесты (секция 39)

**Файл для дополнения:** `src/utils/projectionMapper.test.ts`

Требуется добавить:

1. **`makeVerticalPerspective`:**
```ts
describe('makeVerticalPerspective', () => {
  it('на высоте 400 км проекция конечна (центр проецируется)', () => {
    const p = getD3Projection(makeState({ variant: 'verticalPerspective', family: 'azimuthalPerspective', azLight: 'center', azHeight: 400 }));
    const c = p([0, 0]);
    expect(c).not.toBeNull();
    expect(Number.isFinite(c![0])).toBe(true);
  });
  it('на высоте 1 500 000 км приближается к ортографической', () => {
    const vp = getD3Projection(makeState({ variant: 'verticalPerspective', family: 'azimuthalPerspective', azLight: 'center', azHeight: 1500000 }));
    const ortho = getD3Projection(makeState({ variant: 'orthographic', family: 'azimuthalPerspective', azLight: 'infinity' }));
    const a = vp([30, 30]);
    const b = ortho([30, 30]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Math.abs(a![0] - b![0])).toBeLessThan(5);
  });
});
```

2. **UTM zone round-trip:**
```ts
it('UTM зона 31 → центральный меридиан 3°', () => {
  const p = getD3Projection(makeState({ variant: 'transverseMercator', family: 'cylindrical', utmZone: 31 }));
  expect(p.rotate()).toBeDefined();
});
```

3. **`circleRadiusToScale` / `scaleToCircleRadius`:**
```ts
it('circleRadiusToScale возвращает scaleFactor для azMath', () => {
  const s = circleRadiusToScale(EARTH_HALF_CIRCUM_KM);
  expect(s).toBeCloseTo(1, 3);
});
```

4. **Все 14 вариантов разрешаются в конечную проекцию:**
```ts
it('все 14 вариантов дают конечную проекцию в центре', () => {
  const variants = ['equirectangular', 'mercator', 'transverseMercator', 'obliqueMercator', 'lambertConformal', 'albers', 'equidistantConic', 'gnomonic', 'stereographic', 'orthographic', 'verticalPerspective', 'tiltedPerspective', 'lambertAzimuthalEqualArea', 'azimuthalEquidistant'];
  for (const v of variants) {
    const p = getD3Projection(makeState({ variant: v as ProjectionVariant }));
    const c = p([0, 0]);
    expect(c).not.toBeNull();
    expect(Number.isFinite(c![0])).toBe(true);
  }
});
```
Нужен импорт `circleRadiusToScale, EARTH_HALF_CIRCUM_KM` и `ProjectionVariant`.

---

### 2.4. `ControlPanel.test.tsx` — неполные тесты (секция 41)

**Файл для дополнения:** `src/components/ControlPanel.test.tsx`

Требуется добавить проверки (каждая — отдельный `it`):
1. Контекстно-зависимые контролы видны/скрыты для каждой из 14 групп (выбрать 2-3 репрезентативных варианта).
2. Пресеты (`PresetChips`) кликабельны и меняют `phiOrigin`/`lambda0`.
3. UTM zone dropdown меняет `lambda0` (через `setParam`).
4. Радио Север/Юг меняет `coneHemisphere`.
5. Тумблеры панели визуализации (Tissot, сетка, лучи, линейка) переключают состояние store.
6. Dropdown метода визуализации меняет `vizMethod`.

---

### 2.5. `Map2D.test.tsx` — неполные тесты (секция 42)

**Файл для дополнения:** `src/components/Map2D.test.tsx`

Требуется добавить:
1. **Градусная сетка:** при `graticuleStep=5` сетка рисуется с соответствующим количеством линий.
2. **Тепловая карта:** при `showHeatmap=true` в DOM присутствует `data-testid="heatmap-layer"`.
3. **Тестовые фигуры:** при `testFigureType='circles'` рендерится `data-testid="test-figures-layer"`.
4. **Линейка:** при `rulerActive=true`, клик по карте ставит `rulerPoint1` (красный кружок `data-testid="ruler-point-1"`), второй клик — `rulerPoint2` + линия `data-testid="ruler-line"`.
5. **UTM-маска:** для `transverseMercator` с `utmZone=31` рендерится `data-testid="utm-mask"`.

---

### 2.6. `physics.test.ts` — нет тестов для новых проекций (секция 44)

**Файл для дополнения:** `src/__tests__/physics.test.ts`

Добавить:
1. Round-trip (globe → map → globe) для Vertical Perspective (azHeight=400) и Tilted Perspective.
2. Проверка UTM zone → central meridian: `utmZoneToCentralMeridian(31)` = 3.
3. Проверка `circleRadius` → масштаб: при `circleRadiusKm=10000` азимутальная мат. проекция имеет разумный масштаб.

---

### 2.7. `epsgPresets.test.ts` — не проверяется новое поле в пресетах (секция 46)

**Уже частично сделано.** Дополнительно:
```ts
it('пресет verticalPerspective содержит azHeight', () => {
  const vp = EPSG_PRESETS.find(e => e.params.variant === 'verticalPerspective');
  expect(vp).toBeDefined();
  expect(vp!.params.azHeight).toBe(400);
});
```

---

### 2.8. `EpsgCatalog.test.tsx` — неполная фильтрация (секция 47)

**Файл для дополнения:** `src/components/EpsgCatalog.test.tsx`

Добавить:
- Проверка фильтрации по всем 4 группам (выбрать группу → видны только варианты этой группы).
- Поиск по тексту фильтрует внутри группы.

---

### 2.9. `docsConsistency.test.ts` — не проверяет новые exports (секция 43)

**Файл для дополнения:** `src/__tests__/docsConsistency.test.ts`

Добавить в массив проверяемых exports (секция `docs ↔ code: key exports are documented`):
```
'computePerpendicularNormals',
'computeParticleTrajectories',
'computeMagneticFieldLines',
'computeLaserScanRing',
'computeCutLine',
'computeSatellitePosition',
'computeOrbitalPath',
'vec3Distance',
'vec3Normalize',
```

И в проверку констант — `EARTH_RADIUS_KM`, `UTM_ZONE_WIDTH`, `CIRCLE_RADIUS_MIN`, `CIRCLE_RADIUS_MAX`.

---

## 3. Мелкие (не влияют на работу)

### 3.1. Satellite — не отдельный компонент в Canvas (секция 20.3)

**Файлы:** `src/components/GlobeScene.tsx`, `src/components/LightSource.tsx`

**Проблема:** спутник для вертикальной/наклонной перспективы рендерится внутри `LightSource.tsx`, а не как отдельный элемент в JSX-дереве `GlobeScene`. Функционально идентично, но спецификация ожидает `<Satellite position={...} />` в `<Canvas>`.

**Исправление (опционально):**
1. В `GlobeScene.tsx` вычислить позицию спутника через `computeSatellitePosition` (для `verticalPerspective` / `tiltedPerspective`).
2. Отрендерить `<Satellite position={satPos} />` в `<Canvas>`.
3. Убрать дублирующую логику из `LightSource.tsx`.

---

## Порядок исправления (рекомендуемый)

1. **Критические:** 1.1 (`showOrbitalParams`), 1.2 (`makeTiltedPerspective`)
2. **Критические:** 1.3 (Map2D клик точки касания)
3. **Тесты:** 2.1 (`geometry.test.ts`), 2.2 (`auxSurfaceGeometry.test.ts`)
4. **Тесты:** 2.3 (`projectionMapper.test.ts`)
5. **Тесты:** 2.4 (`ControlPanel.test.tsx`), 2.5 (`Map2D.test.tsx`)
6. **Тесты:** 2.6 (`physics.test.ts`), 2.7 (`epsgPresets.test.ts`)
7. **Тесты:** 2.8 (`EpsgCatalog.test.tsx`), 2.9 (`docsConsistency.test.ts`)
8. **Мелкие:** 3.1 (Satellite в Canvas, опционально)

После каждого шага: `npm run test`, `npm run lint`, `npm run build`.
