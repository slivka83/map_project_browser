# План работ по отзыву `docs/feedback_1.md`

## Контекст
Отзыв эксперта проанализирован и сверён с реальным состоянием кода.
Многие утверждения ревьюера основаны на устаревшей или неверной информации
(он ссылается на `docs/specification.md`, которого никогда не существовало —
см. `AGENTS.md`). Ниже — решения по каждому пункту.

## Сводная таблица решений

| № | Пункт отзыва | Решение | Обоснование |
|---|---|---|---|
| 1 | Разделить стор на 3 части | ❌ Не делать | Стор намеренно один (`AGENTS.md`); селекторы `useProjectionParams`/`useVisualizationParams` с `useShallow` уже устраняют лишние ре-рендеры. Разделение сломает атомарные переключения варианта проекции (семья+искажение+azLight+locked-параметры) и потребует ручной синхронизации между сторами |
| 2 | Тесты для `getD3Projection` | ❌ Не делать | Уже реализовано: `projectionMapper.test.ts` (690 строк), `physics.test.ts` (985), `auxSurfaceGeometry.test.ts` (1107) + тесты стора/компонентов. Всего ~4165 строк. Ревьюер работал по неверной информации о проекте |
| 3 | Ре-рендеры 3D-сцены | ❌ Не делать | Уже оптимизировано лучше, чем предлагает ревьюер: селекторы с `useShallow`, `surface` мемоизируется один раз на изменение параметров, `Globe` разбит на `GlobeShell`/`Coastlines`/`Graticule` с независимыми `useMemo`, береговая линия в один `lineSegments` (1 draw call). Предложение `useFrame` хуже — оно бежит каждый кадр, а лучи меняются только при изменении параметров |
| 4 | Дублирование маппинга проекций | ❌ Не делать | Конфигурация уже вынесена в `projectionVariants.ts` — единая `Record<ProjectionVariant, VariantDef>` для всех 14 проекций (~30 полей на вариант: family, distortion, azLight, locked-параметры, лейблы, флаги видимости контролов). Добавление новой проекции = одна запись. Предложение ревьюера (таблица `family × distortion`) — регрессия, покрывает 9 комбинаций вместо 14 |
| 5 | Несоответствие дизайн-токенов | ❌ Не делать | Токены уже централизованы в `designTokens.ts` (TS) + `index.css` (`@theme` для Tailwind v4). `grep` подтверждает: хардкод hex есть только в этих двух файлах-источниках и в `docsConsistency.test.ts`. Ни один компонент не хардкодит цвета — все импортируют константы. Соответствие токенов доке проверяется билдом |
| 6 | Адаптивность для мобильных | ❌ Не делать | Базовая адаптивность уже есть: `App.tsx` использует `flex-col lg:flex-row`, на узких экранах колонки стекаются вертикально (задокументировано в `AGENTS.md`). Для учебного инструмента этого достаточно. Полный mobile-layout с табами — overengineering для текущей целевой аудитории |
| 7 | API-документация | ✅ Выполнено | AGENTS.md почищен: исправлена фактическая ошибка про gamma (игнорируется для cylindrical, а не «сворачивается в phiOrigin»); добавлены незадокументированные экспорты `projectionMapper.ts` (`localAreaScale`, `referenceAreaScale`, `cellAreaDistortion`, `makeCircleFitSphere`) и `auxSurfaceGeometry.ts` (`vec3ToLonLat`, `computeAuxSphereIntersectionsLonLat`); описан модуль `tissot.ts` и `computeTissotCircles(density)`. `docsConsistency.test.ts` расширен: список проверяемых экспортов увеличен с 22 до 31 + добавлен регрессионный тест, что ложное утверждение «gamma folded into phiOrigin» не возвращается в доку. Комментарий в `projectionMapper.ts:18-25` также исправлен. Все 604 теста проходят, lint чист, build успешен |
| 8 | Предзагрузка геоданных | ❌ Не делать | Initial render НЕ блокируется — `loadGeoData` запускается в `useEffect` (`App.tsx:11`), fetch идёт асинхронно. Частичные сбои уже разнесены (один неудачный fetch не валиит остальные). Для bundled-TopoJSON (~МБ) загрузка идёт миллисекунды на локали. Suspense не нужен (он для React.lazy, не для fetch) |
| 9 | FSD-рефакторинг | ❌ Не делать | Overengineering для проекта такого размера. Все «фичи» (проекция, геоданные, визуализация) жёстко связаны через единый стор — это одна предметная область, не три независимых. ~4kLOC кода, 28 компонентов. FSD добавит 3-4 уровня вложенности директорий и сложность импортов без реального выигрыша, плюс большой churn + придется переписывать `docsConsistency.test.ts` (он проверяет `src/components/...` пути) |
| 10 | ErrorBoundary / fallback | ✅ Сделать | Реальная robustness-проблема: при отсутствии WebGL (старый браузер, отключено администратором, нет GPU) 3D-сцена падает с белым экраном. Создать `src/components/ErrorBoundary.tsx` (класс-компонент с `componentDidCatch`), обернуть `GlobeScene` с fallback-сообщением «WebGL недоступен, используйте 2D карту». 2D-карта (SVG) продолжит работать в любом случае. Без новых зависимостей, ~1 час работы |
| 11 | Пресеты проекций | ❌ Не делать | Уже реализовано лучше: `EpsgCatalog.tsx` (каталог реальных EPSG-проекций, выбор → `applyPreset`) + `ProjectionCatalog.tsx` (все 14 именованных проекций с поиском по тексту, сгруппированы по 4 семействам) + touch-point presets для азимутальных (Северный полюс / Экватор / Москва / Южный полюс). Предложение ревьюера — подмножество. Робинсона в списке 14 вариантов нет |
| 12 | Экспорт PNG/SVG | ❌ Не делать | За пределами текущих требований (пользователь не считает нужным для учебного инструмента на данном этапе). Может быть revisited позже |
| 13 | Интерактивный туториал | ❌ Не делать | Пользователь не считает нужным на данном этапе. Подсказки на отдельных контролах уже есть (`tooltips` в `VariantDef` — `GAMMA_DISABLED_TOOLTIP`, `K0_TOOLTIP` и т.д.). Может быть revisited позже, если реальная пользовательская обратка покажет потребность |

## Детали по принятым решениям

Из 13 пунктов отзыва **принято к реализации 2**:

### ✅ Работа 1 (пункт 7): Почистить `AGENTS.md` + расширить `docsConsistency.test.ts`

**Что исправить в `AGENTS.md`:**

1. **Фактическая ошибка про gamma.** В описании `projectionMapper.ts` сказано: «for the **cylindrical** family `gamma` is folded into `phiOrigin` (`rotate([-(lambda0), -(phiOrigin + gamma), 0])`)». На самом деле код (`projectionMapper.ts:230-233`) использует `rotate([-(effLambda0), -phiOrigin, 0])` — gamma для cylindrical **игнорируется**, а не сворачивается. Тест `projectionMapper.test.ts:147-159` явно фиксирует это поведение. Комментарий в самом `projectionMapper.ts:18-20` тоже содержит это устаревшее утверждение («a d3 rotation of `[-lambda0, -phiOrigin, -gamma]` brings the globe into this frame, so the tilt is absorbed BEFORE this runs») — его тоже нужно поправить.

2. **Добавить незадокументированные экспорты `projectionMapper.ts`:**
   - `localAreaScale(proj, lon, lat, d)` — локальный масштаб площади (используется в `Map2D` через `cellAreaDistortion`/`referenceAreaScale`).
   - `referenceAreaScale(params)` — референсный масштаб площади для heatmap.
   - `cellAreaDistortion(proj, reference, lon, lat, d)` — искажение площади в одной ячейке.
   - `makeCircleFitSphere(lambda0, phiOrigin, capDeg)` — fit-таргет для азимутальных проекций (сферический колпак).

3. **Добавить незадокументированные экспорты `auxSurfaceGeometry.ts`:**
   - `vec3ToLonLat(v)` — обратное преобразование (используется в `GlobeScene` для hover).
   - `computeAuxSphereIntersectionsLonLat(...)` — пересечения в (lon, lat) (используется в `Map2D` для отрисовки колец на 2D-карте).

4. **Описать модуль `src/utils/tissot.ts`** в архитектурном разделе: функция `computeTissotCircles(density)` строит индикатрисы Тиссо (5°-окружности на сетке с шагом `density`, по умолчанию 30°, со staggered-сдвигом по чётным/нечётным рядам широты) — используется в `Map2D` через `showTissot`.

**Что добавить в `docsConsistency.test.ts`:**

Расширить список `exported` (строки ~159-182) следующими именами: `localAreaScale`, `referenceAreaScale`, `cellAreaDistortion`, `makeCircleFitSphere`, `vec3ToLonLat`, `computeAuxSphereIntersectionsLonLat`, `computeTissotCircles`. Тест уже умеет проверять «экспорт существует И упомянут в доке» — нужно только добавить имена в список. После этого любой будущий дрифт (удалили экспорт / забыли описать) упадёт в CI.

**Тесты для самой работы:** после исправлений запустить `npm run test` — `docsConsistency.test.ts` должен проходить (он проверяет, что новые имена упомянуты в `AGENTS.md`), а `projectionMapper.test.ts` уже фиксирует gamma-игнорирование.

### ✅ Работа 2 (пункт 10): ErrorBoundary для `GlobeScene`

**Что сделать:**

1. Создать `src/components/ErrorBoundary.tsx` — класс-компонент с `componentDidCatch` и `getDerivedStateFromError`. Props: `children`, `fallback`. Состояние `hasError: boolean`. На ошибке рендерит `fallback` вместо детей. Без новой зависимости.

2. В `App.tsx` обернуть `<GlobeScene />` в `<ErrorBoundary fallback={<WebGLUnavailableMessage />}>`. Fallback — небольшой неоновый блок в стиле панели с текстом: «WebGL недоступен на вашем устройстве — 3D-глобус отключён. Используйте 2D-карту справа». 2D-карта (`Map2D`, SVG) продолжает работать независимо.

3. (Опционально, если выяснится что нужно) — индивидуальные `ErrorBoundary` вокруг `VizMethodRenderer` или отдельных визуализационных рендереров, чтобы сбой в одном методе не валил всю сцену. На первом этапе — один общий ErrorBoundary вокруг `GlobeScene`.

**Тесты:** добавить `src/components/ErrorBoundary.test.tsx` — проверить, что (a) без ошибки рендерит children, (b) при ошибке рендерит fallback, (c) children не падает наружу. Использовать тестовый компонент, бросающий ошибку в render.

---

## Порядок реализации

1. ~~**Сначала работа 1** (чистка `AGENTS.md` + расширение теста)~~ — ✅ выполнено. AGENTS.md и `projectionMapper.ts` исправлены, `docsConsistency.test.ts` расширен (31 экспорт + регрессия на ложное утверждение про gamma). 604 теста зелёные, lint чист, build успешен.
2. **Затем работа 2** (ErrorBoundary) — добавление нового компонента автоматически подхватится `docsConsistency.test.ts` (он проверяет, что все `src/components/*.tsx` упомянуты в доке), так что параллельно надо будет описать `ErrorBoundary.tsx` в `AGENTS.md`.

После каждой работы: `npm run lint && npm run test && npm run build`. Коммит и push после полного зелёного цикла (согласно workflow rules в `AGENTS.md`).

---

