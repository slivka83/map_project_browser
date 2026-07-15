> **⚠️ Статус документа.** Это **исходное техническое задание**. Ряд пунктов устарел или теоретически некорректен и на практике реализован иначе (см. пометки **АКТУАЛЬНО** внутри). **Авторитетный источник истины — `AGENTS.md`** в корне репозитория; при расхождении с ним следует считать правильным `AGENTS.md`, а не этот файл.

Это Техническое Задание (ТЗ) составлено так, чтобы исключить любую двусмысленность. Если разработчик будет следовать пунктам 1–9, он реализует проект ровно по бизнес-требованиям.

---

# Техническое задание: Реализация проекта «Carto-Space»

## 1. Стек технологий

* **Язык:** TypeScript (строгая типизация).
* **Фреймворк:** React 18+ (Vite).
* **Стейт-менеджер:** Zustand.
* **3D-движок:** `@react-three/fiber` (R3F), `@react-three/drei`.
* **Математика и 2D:** `d3-geo`, `d3-geo-projection`.
* **Стилизация:** Tailwind CSS.

## 2. Структура проекта (Обязательная)

```text
src/
├── components/       # Плоская структура (без Scene3D/ подпапок):
│   ├── ControlPanel.tsx, Dropdown.tsx, EpsgCatalog.tsx  # UI/селекторы/EPSG
│   ├── Globe.tsx, AuxSurface.tsx, IntersectionDisks.tsx, Rays.tsx, LightSource.tsx, GlobeScene.tsx  # 3D
│   ├── Map2D.tsx     # SVG с картой
│   └── ui/           # Общие иконки (icons.tsx), стили (styles.ts), подписи (labels.ts)
├── store/
│   ├── useAppStore.ts  # Единый источник истины
│   └── selectors.ts    # useProjectionParams() / useGeoData()
├── utils/
│   ├── projectionMapper.ts     # Маппинг параметров в D3 функции
│   ├── auxSurfaceGeometry.ts   # Единый источник геометрии поверхности/колец/лучей
│   └── threeHelpers.ts         # quatFromNormal (кватернион поворота)
├── constants/       # designTokens.ts, geometry.ts, epsgPresets.ts
└── types/           # index.ts (реэкспорт типов), d3-geo-projection.d.ts (декларация)

```
Геоданные лежат в `public/` (не в `src/assets/`): `world-110m.topojson`, `land-50m.json`,
`countries-50m.json` — все три являются **TopoJSON** (`{type:'Topology'}`).


## 3. Модель данных (Zustand Store)

Все параметры плоские. Никаких вложенностей.

```typescript
interface AppState {
  // Параметры
  family: 'cylindrical' | 'conic' | 'azimuthal';
  distortion: 'conformal' | 'equalArea' | 'equidistant';
  lambda0: number;      // -180...180
  phiOrigin: number;    // -90...90
  scaleFactor: number;  // 0.9...1.1 (conic/azimuthal); 0.5...1.0 for cylindrical (1.0 = cylinder diameter = Earth diameter, 0.5 = half)
  falseEasting: number; // -1000...1000
  falseNorthing: number;// -1000...1000
  azLight: 'center' | 'antipode' | 'infinity' | 'math'; // источник света (азимутальные)
  stdParallel2: number | null; // φ₂ (секущий конус); null = касательный

  // Управление (строгая типизация, без any)
  setParam: <K extends keyof AppState>(key: K, value: AppState[K]) => void;
  applyPreset: (preset: Partial<AppState>) => void;
}

> **АКТУАЛЬНО:** Переключатель `isEllipsoid` (Сфера/Эллипсоид) **удалён** — модель только
> сферическая. `d3-geo` проецирует исключительно сферу, поэтому эллипсоидальный режим был
> нереализуем на выбранном стеке. Сигнатура `setParam` — строго типизированный дженерик
> (без `any`), иначе запрет `any` из §157 нарушался бы самой же моделью данных.

```

## 4. Логика маппинга (projectionMapper.ts)

Для разработчика: функция принимает параметры из Store и возвращает сконфигурированный объект D3.

```typescript
export const getD3Projection = (state: AppState) => {
  let proj;
  // Логика выбора: 
  // - цилиндрическая -> d3.geoMercator / CylindricalEqualArea и т.д.
  // - коническая -> d3.geoConic...
  // - азимутальная -> d3.geoStereographic...
  
  // ПРИМЕНЕНИЕ:
  proj = proj
    .rotate([-state.lambda0, -state.phiOrigin, -state.gamma]) // Вращение (отрицательные знаки; 3-й компонент — наклон)
    .scale(MAP_SCALE * state.scaleFactor) // Масштаб (MAP_SCALE = 100); константа из src/constants/geometry.ts
    .translate([VIEW_CENTER_X + state.falseEasting, VIEW_CENTER_Y + state.falseNorthing]); // Смещение
    // Константы MAP_SCALE / VIEW_CENTER_X(400) / VIEW_CENTER_Y(300) — в src/constants/geometry.ts
    
  return proj;
};

> **АКТУАЛЬНО:** базовый `.scale(MAP_SCALE * scaleFactor)` устанавливает только масштаб
> математики лучей (3D-сцена). 2D-карта (`Map2D.tsx`) **всегда** подгоняется под вьюпорт
> через `fitProjectionToView` (режим object-fit: contain), поэтому карта заполняет доступную
> область при любом `scaleFactor`, а диаметр цилиндра виден через изменение пропорций карты
> (равнопромежуточная/равновеликая уже сужаются при уменьшении цилиндра), а не через её размер.
> Прямое использование `.scale(MAP_SCALE*scaleFactor)` для финального отображения давало бы
> карту, не влезающую во вьюпорт.

```

## 5. UI: Дизайн-система (Tailwind)

**Цветовая палитра:**

* `bg`: `#05050A`
* `panel`: `bg-white/5` + `backdrop-blur-md` + `border border-white/10`
* `neon-blue`: `#00e5ff`
* `neon-orange`: `#ff6a00`

**Правило:** Весь текст — `text-gray-300`, активные элементы — `text-[#00e5ff]` со свечением `drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]`.

## 6. Визуализация 3D (R3F)

* **Глобус:** Сфера (radius 10). Береговая линия и сетка параллелей/меридианов рисуются **3D-линиями** (`@react-three/drei` `<Line>`, неоново-синий), а не через `CanvasTexture` — это даёт чёткие неоновые очертания и точное совпадение с 2D-картой.
* **Вспомогательная фигура:** `AuxSurface.tsx` — полупрозрачный неоново-оранжевый **каркас** (wireframe) развёртываемой поверхности: цилиндр (цилиндрические), конус (конические), плоскость (азимутальные). Geometry — единый источник `auxSurfaceGeometry.ts`. Если `scaleFactor < 1`, цилиндр меньше радиуса глобуса и пересекает его (видны кольца пересечения в `IntersectionDisks.tsx`).


* **Лучи (Rays):** аналитический веер (`computeCentralMeridianRays` в `auxSurfaceGeometry.ts`). Для точек центрального меридиана луч идёт от **источника света** через точку на глобусе к точке, где эта точка **приземляется на вспомогательную поверхность** (развёртка = 2D-карта). Концы лучей ставятся в мировые координаты 3D-сцены (`auxPointToWorld`), совпадая с каркасом `AuxSurface`. Цвет лучей — неоново-жёлтый (`NEON_YELLOW`).
* **Источник света:** `LightSource.tsx` рисует точечную лампу в центре/антиподе для азимутальных и вершину конуса для конических; для цилиндрических ничего не рисуется (глобус просто разворачивается на цилиндр).

> **АКТУАЛЬНО (исправления оригинального пункта §6):** Глобус — **не** `CanvasTexture` (векторные 3D-линии точнее). Наивная модель «`End` = точка через D3-проекцию» геометрически некорректна: D3-проекция возвращает 2D-экранные пиксели, а не точку на 3D-поверхности — реализовано как луч к развёртке в мировых координатах. Цвет лучей — жёлтый (`NEON_YELLOW`), а не оранжевый. Файл `TangencyRings.tsx` переименован в `IntersectionDisks.tsx` (кольца = реальные пересечения поверхности с глобусом, а не только касания).

## 7. Каталог EPSG (Modal)

* Каталог — `constants/epsgPresets.ts` (типизированный массив `EPSG_PRESETS`, а не отдельный JSON-файл). При клике на строку таблицы: `applyPreset(row.params)`.

> **АКТУАЛЬНО:** вместо `epsg.json` пресеты хранятся в `src/constants/epsgPresets.ts` (типобезопасно, без доп. fetch).

## 8. 2D-Карта

* Использовать SVG.
* `d3.geoPath().projection(proj)`.
* При отрисовке индикаторов Тиссо: итерация по сетке [-180:180, -90:90] (шаг ~30°), отрисовка кругов `d3.geoCircle` с радиусом в **градусах** (константа 5° — угловая мера дуги, а не 5px).

## 9. Стратегия тестирования (Vitest)

Разработчик обязан написать тесты для следующих модулей:

### 9.1. Unit-тесты для Store (`useAppStore.test.ts`)

* Проверить изменение каждого параметра (`lambda0`, `family`, `azLight`) через `setParam`.
* Проверить, что `applyPreset` корректно перезаписывает сразу несколько полей.

### 9.2. Unit-тесты для маппинга (`projectionMapper.test.ts`)

* Создать тестовые данные (State с разными параметрами).
* Вызвать `getD3Projection`.
* **Ассерты:** Проверить, что возвращаемый объект содержит правильные значения `rotate`, `scale`, `translate` (внутренние методы D3).

### 9.3. Проверка каталога

* Проверить, что нажатие на пресет «Mercator» в EPSG-каталоге действительно устанавливает `distortion = 'conformal'` и `family = 'cylindrical'`.

---

**Инструкция по разработке:**

1. **Неделя 1:** Создание Store, настройка 2D-карты (отображение SVG).
2. **Неделя 2:** 3D-сцена и синхронизация (лучи должны двигаться вместе со слайдерами).
3. **Неделя 3:** EPSG-каталог, дизайн "космос", тестирование.

**Запрещено:**

* Использовать `any` в TypeScript (только строгие интерфейсы).
* Делать вычисления в render-методах (использовать `useMemo`).
* Добавлять скрытые уровни управления — всё должно быть видно сразу.