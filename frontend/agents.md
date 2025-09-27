# Codex Agent Guide — Slither Client

## Цель
Преобразовать существующий статичный файл **html_for_project.html** в полноценное React-приложение, работающее внутри текущего проекта (Vite + React).  
В результате должен получиться структурированный код на React, который полностью повторяет логику и UI из html_for_project.html.

---

## Задачи для агента
1. **Извлечь структуру HTML**
    - Вынести `<body>` разметку в React-компоненты.
    - Все панели (`scorePanel`, `leaderboard`, `minimapPanel`, `touchControls`, `cashoutControl`, `nicknameScreen`, `deathScreen`, `cashoutScreen`) должны стать отдельными React-компонентами внутри `src/components`.

2. **Статические стили**
    - CSS из `<style>` перенести в `src/styles/main.css`.
    - В JSX подключать через `import '../styles/main.css'`.
    - Классы не трогать, просто перенести.

3. **JavaScript-логика**
    - Весь `<script>` разделить на хуки и утилиты:
        - `src/hooks/useGame.ts` — состояние игры (state, snakes, foods, account, ws).
        - `src/hooks/useCanvas.ts` — отрисовка canvas и loop.
        - `src/hooks/useJoystick.ts` — логика джойстика.
        - `src/utils/drawing.ts` — функции `drawBackground`, `drawFoods`, `drawSnakes`, `drawMinimap`, `strokeSmoothPath`.
        - `src/utils/helpers.ts` — функции `lerp`, `lerpAngle`, `shadeColor`, `withAlpha`, `formatNumber` и т. д.

4. **Состояние**
    - Использовать `useReducer` или `useState` для хранения состояния (account, snakes, foods, leaderboard).
    - WebSocket подключение (`connect`) вынести в отдельный хук `useConnection`.

5. **Компоненты**
    - `ScorePanel.tsx`
    - `Leaderboard.tsx`
    - `Minimap.tsx`
    - `TouchControls.tsx`
    - `CashoutControl.tsx`
    - `NicknameScreen.tsx`
    - `DeathScreen.tsx`
    - `CashoutScreen.tsx`

   Все они импортируются в `App.tsx`, который рендерит `<canvas>` + эти панели.

6. **Canvas**
    - `<canvas id="canvas">` остаётся внутри `App.tsx`.
    - Логика ресайза и DPR перемещается в хук `useCanvas`.

7. **Интерактивность**
    - Все `document.getElementById` переписать на `useRef` + `useEffect`.
    - События (`mousemove`, `keydown`, `touchstart`) переписать через `useEffect` с `addEventListener` и `cleanup`.

---

## Результат
- `src/` содержит:
    - `components/` (UI панели)
    - `hooks/` (игровая логика, WebSocket, джойстик, канвас)
    - `utils/` (вспомогательные функции)
    - `App.tsx` (главный компонент)
    - `main.tsx` (точка входа Vite)

- Приложение запускается командой:
  ```bash
  npm run dev
  ```

## Дополнительно: аутентификация
- Модальное окно входа/регистрации реализовано в `components/AuthModal.tsx`; оно автоматически отображается, пока пользователь не авторизован.
- Хук `useAuth.ts` отвечает за хранение JWT в `localStorage`, запрос `/api/auth/me` и синхронизацию баланса с HUD.
- `useConnection.ts` обязательно отправляет `token` в `join` и реагирует на ошибки `auth_required`/`invalid_token`/`insufficient_balance`, чтобы вернуть игрока на экран никнейма.
- Никнейм на экране выбора блокируется для авторизованных игроков (управляется через `GameController.setNicknameLock`).
