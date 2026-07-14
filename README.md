# Интерактивный симулятор картографических проекций

Веб-приложение, наглядно показывающее связь между 3D-глобусом Земли и плоской 2D-картой.
Главная фича — визуализация того, как математика проекции переносит точки с поверхности
Земли на вспомогательную фигуру (цилиндр, конус или плоскость) и как при этом искажаются
формы, площади и расстояния.

Поддерживаются только **нормальные (прямые)** проекции без поперечных/косых смещений.

## Технологии

- **Vite 6** + **React 19** + **TypeScript 5.8** (строгий режим, без `any` в пропсах)
- **Tailwind CSS v4** — стилизация (тёмная «космическая» тема)
- **Zustand** — глобальное состояние
- **three** + **@react-three/fiber** + **@react-three/drei** — 3D-сцена
- **d3-geo**, **d3-geo-projection**, **topojson-client** — 2D-карта и проекционная математика
- **Vitest** + **React Testing Library** + **jsdom** — тесты

Приложение полностью клиентское (SPA), без бэкенда и внешних API.

## Быстрый старт

```bash
npm install      # установка зависимостей
npm run dev      # дев-сервер (http://localhost:5173)
```

Откройте http://localhost:5173. Слева сверху — панель управления, слева снизу — 3D-глобус
с лучами проекции, справа (2/3 экрана) — плоская 2D-карта.

## Команды

| Команда           | Назначение                                          |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Дев-сервер Vite с HMR                               |
| `npm run build`   | `tsc -b` (проверка типов) + сборка продакшн-бандла  |
| `npm run lint`    | ESLint                                              |
| `npm run test`    | Vitest (`vitest run`)                               |
| `npm run preview` | Предпросмотр собранного приложения                  |

## Архитектура

Всё состояние хранится в одном сторе; UI, 2D- и 3D-компоненты только читают из него
и вызывают его экшены.

| Модуль                       | Роль                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `src/store/useAppStore.ts`   | Единый источник правды: параметры проекции, геоданные, экшены        |
| `src/utils/projectionMapper.ts` | Маппинг `(family × distortion)` → конкретная D3-проекция          |
| `src/utils/auxSurfaceGeometry.ts` | Единый источник геометрии 3D: вспомогательная поверхность, кольца касания, лучи |
| `src/components/Map2D.tsx`   | Адаптивная SVG-карта: проекция подгоняется под контейнер (`fitProjectionToView`), чтобы глобус всегда заполнял доступную площадь с небольшими отступами; гратула, берега, индикатрисы Тиссо |
| `src/components/ControlPanel.tsx` | Панель управления: семейство, искажения, слайдеры, пресеты EPSG |
| `src/components/Dropdown.tsx` | Кастомный тёмный дропдаун (варианты `button` / `inline`)            |
| `src/components/GlobeScene.tsx` | 3D-сцена, компонует `Globe` / `AuxSurface` / `IntersectionDisks` / `LightSource` / `Rays` |
| `src/components/Globe.tsx`   | Прозрачный глобус с неоновыми 3D-линиями берегов и гратулы          |
| `src/components/AuxSurface.tsx` | Вспомогательная поверхность — прозрачный неоновый каркас (цилиндр / конус / плоскость) |
| `src/components/IntersectionDisks.tsx` | Полые белые неоновые кольца в местах реального пересечения поверхности с глобусом (0, 1 или 2 окружности) |
| `src/components/LightSource.tsx` | Жёлтый светящийся «источник света» в центре глобуса            |
| `src/components/Rays.tsx`    | Жёлтый веер лучей проекции от центра глобуса к вспомогательной поверхности |
| `src/components/EpsgCatalog.tsx` | Модальный каталог EPSG-пресетов (через `createPortal`)          |
| `src/constants/designTokens.ts` | Общая палитра `NEON_BLUE` / `NEON_ORANGE` / `BG` и производные  |
| `src/constants/geometry.ts`  | Общие числовые константы (`MAP_SCALE`, `VIEW_CENTER_*`, `RADIUS`, `RAY_COUNT`, …) и `standardParallelDeg` |
| `src/store/selectors.ts`     | `useProjectionParams()` / `useGeoData()` — мемоизированные селекторы стора |
| `src/utils/threeHelpers.ts`  | `quatFromNormal` — кватернион поворота +Z на нормаль (3D-сцена) |
| `src/components/ui/`         | Общие иконки (`icons.tsx`), стили (`styles.ts`) и подписи (`labels.ts`) |
| `src/App.tsx`                | Компоновка из трёх панелей + загрузка геоданных при монтировании   |

### Математическое ядро

`getD3Projection(params)` (где `params` — объект `ProjectionParams` из стора)
возвращает D3-проекцию по жёсткой таблице:

| Семейство (`family`) | Conformal (равноугольная) | EqualArea (равновеликая) | Equidistant (равнопромежуточная) |
| -------------------- | ------------------------- | ------------------------- | --------------------------------- |
| `cylindrical`        | Mercator                  | CylindricalEqualArea      | Equirectangular                   |
| `conic`              | ConicConformal            | ConicEqualArea            | ConicEquidistant                  |
| `azimuthal`          | Stereographic             | AzimuthalEqualArea        | AzimuthalEquidistant              |

Вращение использует **отрицательные** знаки: `.rotate([-lambda0, -phiOrigin])`; для
конических проекций берётся одна касательная параллель `parallels([|phiOrigin|, |phiOrigin|])`
(при `|phiOrigin| < 10` параллель берётся `30°`, т.к. у экватора конус вырожден —
совпадает с геометрией вспомогательной поверхности). 2D-карта дополнительно
подгоняется под размер контейнера через `fitProjectionToView`, чтобы глобус всегда
заполнял окно с небольшими отступами.
Вся геометрия 3D (поверхность, кольцо касания, лучи) выводится из одного модуля
`auxSurfaceGeometry.ts`, поэтому фигуры не могут рассинхронизироваться.

### Геоданные

Берега материков грузятся из `public/world-110m.topojson` (land, `objects.land`) и
преобразуются из TopoJSON в GeoJSON на лету через `topojson-client`.

### Дизайн-токены

Экспортируются из `src/constants/designTokens.ts` — не хардкодьте hex в компонентах.
Цвета продублированы как CSS-переменные в `src/index.css` (`@theme`), чтобы Tailwind
генерировал утилиты вроде `bg-panel-bg` / `drop-shadow-[…var(--color-neon-blue-soft)]`.

- `BG` — фон приложения: `#05050A`
- `NEON_BLUE` `#00e5ff` — глобус, берега, текст
- `NEON_ORANGE` `#ff6a00` — каркас вспомогательной поверхности
- `NEON_YELLOW` `#ffe600` — источник света и лучи проекции
- `NEON_WHITE` `#ffffff` — диски пересечения вспомогательной поверхности с глобусом
- `PANEL_BG` `#0b0b14` — фон стеклянных панелей
- `NEON_BLUE_SOFT` / `NEON_BLUE_LINE` / `NEON_ORANGE_SOFT` — альфа-варианты неона
- Стеклянные панели: `bg-white/5 backdrop-blur-md border-white/10`

## Тестирование

```bash
npm run test
```

Покрываются: стор, маппер проекций, геометрия `auxSurfaceGeometry`, `ControlPanel`,
`Map2D`, `EpsgCatalog`, `Dropdown` и монтирование `App`. Намеренно **не** тестируются
WebGL/`<Canvas>` и атрибуты `d` SVG-путей (хрупко и зависит от размеров экрана) —
это проверяется только вручную.

При push/PR выполняется CI (`.github/workflows/ci.yml`): `npm ci` → lint → build → test.

## Примечание по окружению разработки (DrvFS)

Если вы работаете в смонтированном Windows-диске (`/mnt/d`, 9P/DrvFS), `npm install`
там падает с `ENOTDIR` при создании `node_modules`, а испорченный dentry не удаляется
изнутри контейнера. В этом окружении зависимости устанавливаются на нативную ФС
(`/tmp/opencode/mbp-deps/node_modules`), а `node_modules` в проекте — симлинк на неё
(исходники остаются локальными, `preserveSymlinks` не нужен); `vite.config.ts`
использует `server.watch.usePolling`, так как DrvFS не шлёт `inotify`-события и HMR
иначе не срабатывает. На обычных Linux/macOS/CI это не нужно — достаточно
`npm install` в корне проекта.
