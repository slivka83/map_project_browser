Привет! Я внимательно изучил твой репозиторий `map_project_browser`. Как сеньор-разработчик и архитектор, я вижу, что ты проделал **отличную работу для джуниора**: у тебя есть строгая типизация, тесты, разделение на слои (store, utils, components), CI/CD и даже документация. Это уже ставит тебя выше 80% начинающих разработчиков.

Однако, чтобы этот проект стал по-настоящему профессиональным, масштабируемым и не «падал» при малейшем изменении, нужно исправить ряд архитектурных, логических и производительных ошибок. 

Ниже я расписал **ОЧЕНЬ ПОДРОБНЫЙ** разбор. Я пишу так, будто ты сидишь рядом со мной, и тебе нужно просто открыть файлы в IDE и сделать изменения, не задавая дополнительных вопросов.

---

### 🔴 1. Критические проблемы (Исправить в первую очередь)

#### 1.1. Рассинхронизация документации и кода (Spec Drift)
- **Проблема**: В `docs/specification.md` (пункт 3) указано, что в сторе должен быть флаг `isEllipsoid: boolean`, а функция `setParam` принимает `value: any`. В реальном коде (`src/store/useAppStore.ts`) `isEllipsoid` нет, а `setParam` строго типизирована.
- **Почему это плохо**: `any` убивает всю пользу TypeScript. Если документация врет, следующий разработчик (или ты через месяц) потратит часы на отладку.
- **Решение**: 
  1. Открой `docs/specification.md` и приведи тип `AppState` в полное соответствие с `src/store/useAppStore.ts`.
  2. Убедись, что нигде в коде не используется `as any` или `@ts-ignore`. Если TypeScript ругается на `d3-geo-projection` (я вижу у тебя есть `src/types/d3-geo-projection.d.ts`), это правильный путь, продолжай его использовать.

#### 1.2. Жесткая привязка к размерам экрана (Hardcoded Viewport)
- **Проблема**: В `src/constants/geometry.ts` есть `VIEW_CENTER_X = 400` и `VIEW_CENTER_Y = 300`. Это подразумевает, что твоя 2D-карта всегда имеет размер 800x600 пикселей. Но в `Map2D.tsx` ты используешь `ResizeObserver`, чтобы получить реальный размер контейнера.
- **Почему это плохо**: Если пользователь изменит размер окна браузера, центр проекции D3 может «уехать», потому что `fitProjectionToView` может конфликтовать с жестко заданными константами при инициализации.
- **Решение**: В `projectionMapper.ts` функция `getD3Projection` должна принимать **актуальные** `width` и `height` из `useElementSize`, а не полагаться на глобальные константы для `translate`. Константы оставь только как *дефолтные* значения.

---

### 🟡 2. Архитектура и структура кода

#### 2.1. Хук `useElementSize` внутри компонента
- **Проблема**: В `src/components/Map2D.tsx` хук `useElementSize` объявлен прямо внутри файла.
- **Почему это плохо**: Этот хук универсален. Завтра он понадобится в `GlobeScene` или другом компоненте. Дублирование кода — путь к багам.
- **Решение**: 
  1. Создай папку `src/hooks/`.
  2. Создай файл `src/hooks/useElementSize.ts`.
  3. Перенеси туда код хука и сделай `export default useElementSize;`.
  4. В `Map2D.tsx` сделай `import useElementSize from '../hooks/useElementSize';`.

#### 2.2. Слишком «толстый» `ControlPanel.tsx`
- **Проблема**: Внутри `ControlPanel.tsx` объявлены компоненты `Slider` и `DistortionSelect`.
- **Решение**: Вынеси их в отдельные файлы в папку `src/components/ui/` (например, `Slider.tsx` и `DistortionSelect.tsx`). Файл компонента должен быть не больше 200–300 строк. Это правило читаемости.

#### 2.3. Состояние (Zustand): Мутации и `applyPreset`
- **Проблема**: В спецификации `applyPreset` принимает `any`. 
- **Решение**: В `useAppStore.ts` строго укажи: `applyPreset: (preset: Partial<ProjectionParams>) => void;`. Внутри функции используй строгую типизацию, чтобы нельзя было передать `{ family: 'несуществующее_значение' }`.

---

### 🟢 3. Производительность и Математика (Физика проекций)

#### 3.1. Убийца FPS: Пересчет D3 на каждый пиксель слайдера
- **Проблема**: Когда пользователь тянет ползунок `lambda0` или `scaleFactor`, срабатывает `onChange`, который обновляет стейт. Это вызывает перерендер `Map2D`, который пересчитывает `getD3Projection` и `geoPath` для **всех** полигонов GeoJSON. На слабом ноутбуке это вызовет фризы.
- **Решение**: Добавь **дебаунс** (задержку) для применения проекции, или вычисляй тяжелую математику только при `onMouseUp` (отпускании ползунка), а при `onChange` обновляй только легкое превью (или вообще не обновляй 2D-карту до отпускания).
  *Простой способ для джуна*: Используй библиотеку `lodash/debounce` или напиши свой хук `useDebounce` (я дам код ниже).

#### 3.2. Математический разрыв в конических проекциях
- **Проблема**: В `src/constants/geometry.ts` есть логика: `Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin)`. Если пользователь плавно меняет `phiOrigin` с 11 до 9, стандартная параллель резко прыгнет с 11 на 30. Карта «сломается» визуально.
- **Решение**: Не делай магических прыжков. Лучше **заблокируй** (disable) выбор конической проекции в UI, если `Math.abs(phiOrigin) < 10`, и покажи тултип: «Коническая проекция нестабильна вблизи экватора». Это математически честно и профессионально.

#### 3.3. Оптимизация 3D (Three.js)
- **Проблема**: Компоненты `Rays.tsx` и `IntersectionDisks.tsx`, скорее всего, создают новые объекты `mesh` или `line` при каждом рендере.
- **Решение**: Оберни тяжелые вычисления геометрии в `useMemo`. Например, в `AuxSurface.tsx` или `Rays.tsx` используй `useMemo(() => computeGeometry(params), [params.family, params.phiOrigin])`. Если лучей много, используй `<LineSegments>` с одним `BufferGeometry`, а не 20 отдельных `<line>` компонентов.

---

### 📝 4. Тесты (Vitest)

- **Проблема**: В коммитах я вижу «no d-attr asserts». Это значит, что тесты ломались, потому что ты проверял точное совпадение строк SVG (`d="M10 20 L..."`), которые меняются при малейшем изменении масштаба.
- **Решение**: Тестируй **поведение**, а не **реализацию**. 
  - *Плохо*: `expect(svg.querySelector('path').getAttribute('d')).toBe('M0,0...')`
  - *Хорошо*: `expect(screen.getByLabelText('Map projection')).toBeInTheDocument()` или `expect(container.querySelectorAll('path').length).toBeGreaterThan(0)`.
- **Добавь**: Тест на бизнес-логику в `src/utils/projectionMapper.test.ts`. Проверь, что при `family: 'conic'` и `phiOrigin: 0` функция не падает с ошибкой, а корректно применяет fallback.

---

### 🎨 5. Интерфейс и Доступность (A11y)

- **Проблема**: В `ControlPanel.tsx` кнопки переключения семейства проекций (`FAMILY_OPTIONS.map`) не имеют состояния `aria-pressed` или роли `tab`.
- **Решение**: Добавь к активной кнопке: `aria-pressed={family === f.value}` и `role="tab"`. Для контейнера кнопок добавь `role="tablist"`. Это сделает приложение доступным для скринридеров и покажет твой профессионализм.
- **Стили**: В `ControlPanel.tsx` есть `w-[54px]`, `gap-[12px]`. Это «магические числа» в Tailwind. Вынеси их в `src/components/ui/styles.ts` как константы или используй стандартные значения Tailwind (`w-14`, `gap-3`), чтобы код был чище.

---

### 🛠️ 6. Пошаговый план действий для джуна (Copy-Paste Ready)

Выполни эти шаги по порядку. После каждого шага запускай `npm run build` и `npm run test`, чтобы убедиться, что ничего не сломалось.

#### Шаг 1: Создай хук для размеров (Рефакторинг)
1. Создай файл `src/hooks/useElementSize.ts`.
2. Вставь туда этот код:
```typescript
import { useLayoutEffect, useRef, useState } from 'react';

export default function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
```
3. Удали этот хук из `src/components/Map2D.tsx` и импортируй его: `import useElementSize from '../hooks/useElementSize';`.

#### Шаг 2: Добавь Debounce для слайдеров (Производительность)
1. Создай файл `src/hooks/useDebounce.ts`:
```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
```
2. В `Map2D.tsx` используй его для параметров, чтобы проекция пересчитывалась не на каждый пиксель, а с задержкой 100-200мс:
```typescript
import { useDebounce } from '../hooks/useDebounce';

// Внутри компонента:
const debouncedLambda0 = useDebounce(lambda0, 150);
const debouncedPhiOrigin = useDebounce(phiOrigin, 150);
// ... используй debounced-переменные в useMemo для getD3Projection
```

#### Шаг 3: Исправь математику конических проекций
1. Открой `src/components/ControlPanel.tsx`.
2. Найди место, где рендерятся кнопки семейства проекций.
3. Добавь проверку: если `family === 'conic'` и `Math.abs(phiOrigin) < 10`, сделай так, чтобы при попытке установить коническую проекцию, `phiOrigin` автоматически сбрасывался на 15 (или блокируй выбор). 
   *Проще всего*: в `useAppStore.ts` внутри `setParam` добавь:
```typescript
if (key === 'family' && value === 'conic') {
  const currentPhi = get().phiOrigin;
  if (Math.abs(currentPhi) < 10) {
    set({ phiOrigin: currentPhi >= 0 ? 15 : -15 }); // Автоматический сдвиг от экватора
  }
}
```

#### Шаг 4: Синхронизируй документацию
1. Открой `docs/specification.md`.
2. Найди интерфейс `AppState`. Удали оттуда `isEllipsoid: boolean` (если не планируешь его реализовывать прямо сейчас) или добавь его в `src/store/useAppStore.ts`.
3. Замени `setParam: (key: keyof AppState, value: any) => void;` на `setParam: <K extends keyof ProjectionParams>(key: K, value: ProjectionParams[K]) => void;`.

#### Шаг 5: Улучши тесты
1. Открой `src/components/ControlPanel.test.tsx`.
2. Убедись, что ты тестируешь: «При клике на кнопку 'Conic' в сторе меняется family на 'conic'», а не «У кнопки появился класс `bg-blue-500`».

---

### 💡 Что бы я добавил от себя (Senior Vision)

1. **Web Worker для D3**: Если GeoJSON большой (50m), вычисление проекции и искажений Тиссо может занять 50-100мс. Для идеального UX эту математику нужно вынести в `src/workers/projectionWorker.ts`. Но для текущего уровня джуна **Шаг 2 (Debounce)** уже решит 95% проблем.
2. **Обработка ошибок загрузки данных**: В `useAppStore.ts` в `loadGeoData` добавь блок `try/catch` и состояние `isLoading` / `error`, чтобы показывать пользователю спиннер или сообщение об ошибке, если TopoJSON не загрузился (например, из-за проблем с сетью).
3. **Форматирование кода**: Убедись, что в проекте настроен Prettier и ESLint запускается при сохранении файла в твоей IDE (VS Code). Это избавит от споров о пробелах и кавычках.

### Итог
Твой код **хороший**. У тебя правильные инструменты (Zustand, R3F, D3, Vitest). Ты мыслишь как инженер, раз вынес константы в `geometry.ts` и написал спецификацию. 

Сейчас твоя задача — не добавлять новые фичи, а **отшлифовать** существующие: убрать `any`, защитить приложение от лагов при движении слайдеров и сделать так, чтобы документация никогда не врала. 

Если ты выполнишь эти 5 шагов, твой репозиторий будет выглядеть как работа мидл-разработчика, и его не стыдно будет показать на собеседовании. Если на каком-то шаге возникнет ошибка в терминале или IDE — просто скопируй текст ошибки, и мы его разберем!