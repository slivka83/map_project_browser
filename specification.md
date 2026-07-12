# Техническое задание (ТЗ) для разработчика: Интерактивный симулятор картографических проекций

## 1. Стек технологий и инициализация проекта

* **Сборщик:** Vite (шаблон React + TypeScript).
* **UI/Стилизация:** Tailwind CSS. Допустимо использование Radix UI (или shadcn/ui) для доступных слайдеров и селекторов, чтобы не писать их с нуля.
* **Стейт-менеджер:** Zustand (идеален для связи React и Three.js без лишних ререндеров).
* **3D-графика:** `three` и `@react-three/fiber` (R3F) + `@react-three/drei` (полезные хелперы).
* **2D-карта и математика:** `d3-geo`, `d3-geo-projection`, `d3-scale`.
* **Геоданные:** `topojson-client` (для конвертации TopoJSON в GeoJSON на лету).

## 2. Глобальное состояние (Zustand Store)

Создай файл `src/store/useAppStore.ts`. Это сердце приложения. Все компоненты (UI, 3D, 2D) только читают отсюда данные или вызывают методы `set`.

```typescript
import { create } from 'zustand';

// Доступные комбинации математики и геометрии
export type ProjectionFamily = 'cylindrical' | 'conic' | 'azimuthal';
export type DistortionModel = 'conformal' | 'equalArea' | 'equidistant';

interface AppState {
  // 1. Текущие параметры проекции
  family: ProjectionFamily;
  distortion: DistortionModel;
  lambda0: number; // Центральный меридиан (-180 to 180)
  phi1: number;    // Стандартная параллель 1 (-90 to 90)
  phi2: number;    // Стандартная параллель 2 (-90 to 90)
  
  // 2. Настройки UI
  showTissot: boolean;
  
  // 3. Геоданные
  geoJsonData: any | null; // Сюда положим распакованный FeatureCollection материков
  
  // 4. Методы (Actions)
  setParam: (key: keyof AppState, value: any) => void;
  loadGeoData: () => Promise<void>;
  applyEpsgPreset: (preset: Omit<AppState, 'geoJsonData' | 'showTissot' | 'setParam' | 'loadGeoData' | 'applyEpsgPreset'>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phi1: 0,
  phi2: 45,
  showTissot: false,
  geoJsonData: null,

  setParam: (key, value) => set({ [key]: value }),
  applyEpsgPreset: (preset) => set({ ...preset }),
  loadGeoData: async () => {
    // 1. Скачай файл 'world-110m.v1.topojson' (из пакета world-atlas или d3)
    // 2. Положи в папку public
    const response = await fetch('/world-110m.topojson');
    const topology = await response.json();
    const geojson = topojson.feature(topology, topology.objects.land);
    set({ geoJsonData: geojson });
  }
}));

```

## 3. Маппинг D3 Проекций (Математическое ядро)

Создай утилиту `src/utils/projectionMapper.ts`. Джуны часто путаются, какую функцию D3 вызвать. Вот жесткая таблица зависимости.

```typescript
import * as d3Geo from 'd3-geo';
import * as d3GeoProj from 'd3-geo-projection'; // Нужно установить этот пакет дополнительно

export const getD3Projection = (family: string, distortion: string, lambda0: number, phi1: number, phi2: number) => {
  let projFn;

  // Комбинации
  if (family === 'cylindrical') {
    if (distortion === 'conformal') projFn = d3Geo.geoMercator();
    else if (distortion === 'equalArea') projFn = d3Geo.geoCylindricalEqualArea().parallel(phi1);
    else projFn = d3Geo.geoEquirectangular();
  } 
  else if (family === 'conic') {
    if (distortion === 'conformal') projFn = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') projFn = d3Geo.geoConicEqualArea();
    else projFn = d3Geo.geoConicEquidistant();
    projFn = projFn.parallels([phi1, phi2]);
  } 
  else if (family === 'azimuthal') {
    if (distortion === 'conformal') projFn = d3Geo.geoStereographic();
    else if (distortion === 'equalArea') projFn = d3Geo.geoAzimuthalEqualArea();
    else projFn = d3Geo.geoAzimuthalEquidistant();
  }

  // Общие параметры для всех (вращение по долготе)
  // Примечание: D3 принимает вращение с обратным знаком для lambda
  if (projFn) {
     projFn.rotate([-lambda0, 0, 0]).center([0, 0]).translate([0, 0]); // translate установим позже под размер Canvas/SVG
  }
  
  return projFn;
};

```

## 4. Визуальный стиль (Дизайн-система "Космос")

Используй Tailwind конфигурацию или CSS переменные:

* **Фон приложения:** `#05050A` (очень темный синий/черный).
* **Стиль панелей:** Полупрозрачные подложки `bg-white/5` с размытием фона `backdrop-blur-md` и тонкой рамкой `border-white/10`.
* **Неоновый синий (Глобус, Материки, Тексты):** `#00e5ff`. Эффект свечения достигается через CSS `drop-shadow(0 0 5px #00e5ff)`.
* **Неоновый оранжевый (Вспомогательная фигура, Лучи):** `#ff6a00`.

## 5. Блок 2D-Карты (Правая панель)

Компонент `<Map2D/>`. Используй `<svg>` для рендеринга (он проще для джуна, чем Canvas).

**Логика отрисовки:**

1. Подпишись на изменения стейта через `useAppStore`.
2. Получи генератор проекции через `getD3Projection`.
3. Установи масштаб (`scale`) и смещение (`translate`), чтобы карта вписывалась в размер SVG-контейнера (используй хук `useMeasure` или `react-use` для получения width/height родительского div'а).
4. Создай генератор путей: `const pathGenerator = d3Geo.geoPath().projection(projFn)`.

**Слои SVG (строго в таком порядке):**

1. `<path class="graticule" d={pathGenerator(d3Geo.geoGraticule10())} fill="none" stroke="#334155" strokeWidth={0.5} />`
2. Обход `geoJsonData.features` через `.map()` -> `<path fill="#05050A" stroke="#00e5ff" strokeWidth={1} d={pathGenerator(feature)} />`
3. **Индикатрисы Тиссо (если включены):**
* Создай массив точек сетки: цикл от -180 до +180 по долготе и от -60 до +60 по широте с шагом 30.
* Для каждой точки создай круг: `const circle = d3Geo.geoCircle().center([lon, lat]).radius(5)();`
* Отрисуй каждый круг: `<path d={pathGenerator(circle)} fill="rgba(255, 106, 0, 0.4)" stroke="#ff6a00" />`.



## 6. Блок 3D-Сцены (Левая нижняя панель)

Используй `<Canvas>` из `@react-three/fiber`.

### 6.1. Глобус (Земля)

* `<Sphere 64, 64]} args="{[10,">` (радиус 10).
* **Материал:** `<meshBasicMaterial color="#05050A" />` (черный шар).
* **Как нанести неоновые материки на 3D шар?** *Важное указание для джуна!* Самый простой и производительный способ — нарисовать D3-карту в проекции `geoEquirectangular` на невидимом HTML5 `<canvas>` (2048x1024 px) неоновым синим цветом, а затем использовать этот Canvas как текстуру для глобуса через `new THREE.CanvasTexture(canvas)`.

### 6.2. Вспомогательная поверхность (Полупрозрачная оранжевая)

Свитч (switch) по параметру `family` из Zustand. Материал везде: `<meshPhysicalMaterial color="#ff6a00" transparent opacity={0.2} side={THREE.DoubleSide} />`.

* **Cylindrical:** `<Cylinder 1, 10, 30, 64, args="{[10," true]}>` (радиус 10, открытые концы). Вращение: `rotation={[0, lambda0 * Math.PI/180, 0]}`.
* **Azimuthal:** `<Plane 30]} args="{[30,">`. Позиция: поднята над Северным полюсом `position={[0, 10, 0]}`, повернута лицом к экрану `rotation={[-Math.PI/2, 0, 0]}`.
* **Conic:** `<Cone 1, 20, 64, args="{[10," true]}>`. Центрировать над полюсом. (Для MVP не требуем точного совпадения угла конуса с `phi1/phi2`, достаточно схематичного конуса, накрывающего Северное полушарие).

### 6.3. Лучи проецирования (Самая важная фича)

Лучи рисуются для нулевого меридиана (центрального) от Северного до Южного полюса.

* **Логика:**
1. В компоненте `Rays` используй `useMemo`. Создай массив широт от -80 до 80 с шагом 10 градусов. Долгота = `lambda0`.
2. Для каждой широты вычисли две 3D-точки: Старт и Финиш.
3. **Старт (на глобусе):** Переведи `(lat, lon)` в 3D координаты сферы радиуса 10. Формула: `x = 10 * cos(lat) * cos(lon)`, `y = 10 * sin(lat)`, `z = -10 * cos(lat) * sin(lon)`.
4. **Финиш (на поверхности):** Пропусти `(lat, lon)` через функцию D3 `getD3Projection(...)`. Она вернет экранные `[x, y]`. Тебе нужно нормализовать их и превратить в 3D координаты цилиндра/конуса. *(Подсказка джуну: для MVP на цилиндре финиш будет равен: `x = 10 * cos(lon)`, `y = D3_Y * scaleFactor`, `z = -10 * sin(lon)`).*
5. Отрисуй линии: Используй компонент `<Line>` из `@react-three/drei` от точки Старт до точки Финиш. Цвет `"#ff6a00"`.



## 7. Блок UI и Управления (Левая верхняя панель)

* **Селектор Семейства:** Вкладки (Tabs) — «Цилиндрическая», «Коническая», «Азимутальная».
* **Селектор Искажения:** Радиокнопки — «Равноугольная», «Равновеликая», «Равнопромежуточная».
* **Слайдер Центрального меридиана:** От -180 до 180, шаг 1. Вызывает `setParam('lambda0', value)`.
* **Слайдеры Параллелей (рендерить только если выбрана Коническая проекция):** `phi1` и `phi2` от -90 до 90.
* **Чекбокс:** «Индикатрисы Тиссо».

### Каталог EPSG (Пресеты)

Сделай выпадающий список (Dropdown) со статичным массивом:

```json
[
  { "name": "Mercator (EPSG:3395)", "preset": { "family": "cylindrical", "distortion": "conformal", "lambda0": 0, "phi1": 0, "phi2": 0 } },
  { "name": "Gall-Peters (Равновеликая)", "preset": { "family": "cylindrical", "distortion": "equalArea", "lambda0": 0, "phi1": 45, "phi2": 0 } },
  { "name": "Stereographic (Северный полюс)", "preset": { "family": "azimuthal", "distortion": "conformal", "lambda0": 0, "phi1": 0, "phi2": 0 } }
]

```

При клике вызывай `applyEpsgPreset(item.preset)`.

## 8. Ограничения для разработчика (Strict Rules)

1. **Никаких дополнительных библиотек** для UI компонентов, если это раздует бандл (Material UI запрещен из-за веса, Tailwind — стандарт).
2. **Никакого бэкенда.** Данные грузятся из `public/world-110m.topojson`.
3. **Оптимизация D3:** Оборачивай расчет генератора путей (`pathGenerator`) в `useMemo`, чтобы не пересчитывать математику проекции на каждый фрейм React, если параметры не менялись.
4. **Строгий TypeScript:** Никаких `any` в пропсах компонентов. Опиши интерфейсы для `FeatureCollection` из TopoJSON.

---

**Совет наставника разработчику:** Начни разработку с шагов 1 и 2 (Store и Геоданные). Затем выведи 2D-карту (Шаг 5). Убедись, что ползунки и D3-проекции работают. Только после того, как 2D-карта будет плавно реагировать на слайдеры, приступай к 3D-модулю.


## 9. Стратегия тестирования (Unit & Integration Tests)

Так как проект содержит сложную математику (D3) и 3D-рендеринг (Three.js), подходы к тестированию должны быть строго разделены. Пытаться тестировать отрисовку WebGL-канваса через юнит-тесты **запрещено** (это приведет к хрупким тестам и потере времени).

**Инструменты:** Используй **Vitest** (так как сборщик Vite, он интегрируется из коробки и работает быстрее Jest) + **React Testing Library (RTL)** для UI-компонентов.

### 9.1. Что тестировать обязательно (Покрытие 100%)

**1. Глобальное состояние (Zustand Store):**
Стейт полностью отвязан от UI, поэтому тестируется простыми функциями.

* *Тест-кейсы:*
* Проверка дефолтных значений при инициализации.
* Проверка метода `setParam` (изменяется только переданный параметр, остальной стейт не мутирует).
* Проверка метода `applyEpsgPreset` (все параметры пресета корректно перезаписывают текущие значения).



**2. Математическое ядро (`getD3Projection`):**
Это критическая бизнес-логика. D3 тестировать не нужно (библиотека уже протестирована авторами), но нужно протестировать наш **маппер**.

* *Тест-кейсы:*
* Передача `family="cylindrical", distortion="conformal"` возвращает именно `geoMercator`.
* Передача параметров `lambda0=45` корректно устанавливает `.rotate([-45, 0, 0])` у возвращаемой функции (можно проверить через вызов возвращенной функции с тестовыми координатами).



### 9.2. Что тестировать выборочно (UI и Интеграция)

**1. Панель управления:**

* *Тест-кейсы:*
* Рендер селекторов и ползунков.
* При изменении значения в слайдере «Центральный меридиан» вызывается функция `setParam` из Store с правильным ключом и значением (использовать мок (mock) для стора или проверять итоговое состояние).



**2. Вызов загрузки геоданных:**

* Проверить, что при монтировании главного компонента один раз вызывается метод `loadGeoData()`.

### 9.3. Что НЕ тестировать (Игнорировать в Vitest)

* **Компоненты внутри `<Canvas>` (Three.js / R3F):** Не пиши тесты на то, отрендерилась ли сфера или лучи. JSDOM (среда выполнения тестов) не поддерживает WebGL, тесты будут падать. Эта часть проверяется только мануально (ручным тестированием).
* **SVG пути (атрибут `d` в `<path>`):** Не нужно писать `expect(path).toHaveAttribute('d', 'M0,0 L...')`, так как D3-математика сложна и значения зависят от размеров экрана при рендере.

### 9.4. Пример конфигурации и первого теста (шпаргалка для разработчика)

**Установка:**
`npm install -D vitest @testing-library/react jsdom`

**Пример теста для Store (`useAppStore.test.ts`):**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';

describe('useAppStore', () => {
  // Сбрасываем стейт перед каждым тестом
  beforeEach(() => {
    useAppStore.setState({
      family: 'cylindrical',
      lambda0: 0,
      showTissot: false
    });
  });

  it('должен изменять параметр через setParam', () => {
    useAppStore.getState().setParam('lambda0', 90);
    expect(useAppStore.getState().lambda0).toBe(90);
  });

  it('должен применять EPSG пресет', () => {
    const preset = {
      family: 'azimuthal' as const,
      distortion: 'conformal' as const,
      lambda0: 45,
      phi1: 0,
      phi2: 0,
    };
    useAppStore.getState().applyEpsgPreset(preset);
    
    const state = useAppStore.getState();
    expect(state.family).toBe('azimuthal');
    expect(state.lambda0).toBe(45);
    // showTissot не должен был измениться
    expect(state.showTissot).toBe(false); 
  });
});

```