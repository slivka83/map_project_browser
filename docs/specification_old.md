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
├── assets/           # world-110m.topojson
├── components/
│   ├── UI/           # Слайдеры, селекторы, кнопка EPSG
│   ├── Scene3D/      # Globe, Surface, Rays
│   └── Map2D/        # SVG с картой
├── store/
│   └── useAppStore.ts # Единый источник истины
├── utils/
│   ├── projectionMapper.ts # Маппинг параметров в D3 функции
│   └── rayCalculator.ts    # Математика 3D лучей
└── types/            # Интерфейсы проекций

```

## 3. Модель данных (Zustand Store)

Все параметры плоские. Никаких вложенностей.

```typescript
interface AppState {
  // Параметры
  family: 'cylindrical' | 'conic' | 'azimuthal';
  distortion: 'conformal' | 'equalArea' | 'equidistant';
  lambda0: number;      // -180...180
  phiOrigin: number;    // -90...90
  scaleFactor: number;  // 0.9...1.1
  falseEasting: number; // -1000...1000
  falseNorthing: number;// -1000...1000
  isEllipsoid: boolean; // boolean
  
  // Управление
  setParam: (key: keyof AppState, value: any) => void;
  applyPreset: (preset: Partial<AppState>) => void;
}

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
    .rotate([-state.lambda0, -state.phiOrigin]) // Вращение
    .scale(100 * state.scaleFactor) // Масштаб
    .translate([400 + state.falseEasting, 300 + state.falseNorthing]); // Смещение
    
  return proj;
};

```

## 5. UI: Дизайн-система (Tailwind)

**Цветовая палитра:**

* `bg`: `#05050A`
* `panel`: `bg-white/5` + `backdrop-blur-md` + `border border-white/10`
* `neon-blue`: `#00e5ff`
* `neon-orange`: `#ff6a00`

**Правило:** Весь текст — `text-gray-300`, активные элементы — `text-[#00e5ff]` со свечением `drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]`.

## 6. Визуализация 3D (R3F)

* **Глобус:** Сфера (radius 10). Текстура — Canvas, на который D3 рисует береговую линию (ортографическая проекция).
* **Вспомогательная фигура:**
* Cylinder/Cone/Plane с материалом `meshPhysicalMaterial` (`color: #ff6a00`, `opacity: 0.2`, `transparent: true`).
* Если `scaleFactor < 1`, фигура должна быть меньше радиуса глобуса.


* **Лучи (Rays):**
* Создать массив из 20 точек (широта от -90 до 90, долгота = `lambda0`).
* Для каждой точки:
* `Start` = координаты на сфере.
* `End` = координаты точки, пропущенной через D3-проекцию (как если бы она упала на плоскость/цилиндр).


* Рендер: `<Line End]} color="#ff6a00" points="{[Start,"/>`.



## 7. Каталог EPSG (Modal)

* Создать JSON-файл `epsg.json` с массивом объектов (код, название, тип, ед.изм, параметры_проекции).
* При клике на строку таблицы: `applyPreset(row.params)`.

## 8. 2D-Карта

* Использовать SVG.
* `d3.geoPath().projection(proj)`.
* При отрисовке индикаторов Тиссо: итерация по сетке [-180:180, -90:90], отрисовка кругов `d3.geoCircle` (радиус константа 5px).

## 9. Стратегия тестирования (Vitest)

Разработчик обязан написать тесты для следующих модулей:

### 9.1. Unit-тесты для Store (`useAppStore.test.ts`)

* Проверить изменение каждого параметра (`lambda0`, `family`, `isEllipsoid`) через `setParam`.
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