# 貪食蛇遊戲開發記錄

## 專案背景
- 基底專案：Vue 3 + TypeScript + Vite
- 遊戲範圍：20×20 網格
- 開發方式：三步驟逐步實作

---

## Step 1 — HTML 架構

### 用戶需求
建立遊戲的 HTML 架構。

### 實作內容
- 在 `src/components/SnakeGame.vue` 建立貪食蛇元件
- 使用 CSS Grid 產生 20×20 網格（400 個 `.cell` div，用 `v-for` 產生）
- 每個格子預留 snake / head / food 三種動態 class
- 包含標題「貪食蛇」、計分板、開始按鈕、遊戲結束 overlay
- 修改 `App.vue` 只顯示 `<SnakeGame />`

---

## Step 2 — 變數設計

### 用戶需求
定義遊戲所需的核心變數。

### 實作內容
在 `<script setup lang="ts">` 中宣告：

| 變數 | 類型 | 說明 |
|------|------|------|
| `gridSize` | `number` | 網格大小 (20) |
| `snake` | `Ref<Position[]>` | 蛇身座標陣列（頭在第 0 項） |
| `food` | `Ref<Position>` | 食物座標 |
| `direction` | `Ref<Direction>` | 當前方向 (`'UP'` / `'DOWN'` / `'LEFT'` / `'RIGHT'`) |
| `score` | `Ref<number>` | 分數 |
| `gameStatus` | `Ref<GameStatus>` | 遊戲狀態 (`'idle'` / `'playing'` / `'paused'` / `'gameover'`) |
| `gameTimer` | `ReturnType<typeof setInterval> \| null` | setInterval 計時器 ID |
| `pendingDirection` | `Direction \| null` | 暫存的下個方向（防止 180° 回頭） |

### 補充說明
- `interface Position` 定義座標結構 `{ x: number; y: number }`
- `type Direction` 為聯合型別（類似 C++ enum）
- `type GameStatus` 定義四種遊戲狀態

---

## Step 3 — Function 實作

### 用戶需求
完成所有遊戲邏輯函式。

### 實作內容
所有 function 寫在 `<script setup lang="ts">` 中：

| 函式 | 說明 |
|------|------|
| `getCellType(index)` | 根據格子索引回傳 `'head'` / `'snake'` / `'food'` / `null` |
| `generateFood()` | 隨機生成食物（避開蛇身） |
| `checkSelfCollision(head)` | 檢查蛇頭是否撞到身體 |
| `move()` | 每 tick 移動蛇：計算新蛇頭、穿牆、碰撞判斷、吃食物 |
| `changeDirection(newDir)` | 防 180° 回頭的方向切換 |
| `gameLoop()` | 啟動 setInterval（每 150ms 呼叫 move） |
| `startGame()` | 重置所有狀態並開始遊戲 |
| `togglePause()` | 暫停／繼續切換 |
| `handleKeydown(e)` | 鍵盤事件處理 |
| `onMounted / onUnmounted` | 註冊／移除鍵盤監聽 |

### 涉及修改
- Template 中 `:class` 改為 `:class="getCellType(i)"`
- 分數改為動態綁定 `{{ score }}`
- 按鈕綁定 `@click` 事件
- Overlay 加上 `:class="{ visible: ... }"` 控制顯示

---

## 後續調整記錄

### Bug 修復：每次重新開始會加速
- **原因**：`startGame()` 和 `gameLoop()` 未清除舊的 `setInterval`，導致多個 timer 疊加
- **解決**：在 `gameLoop()` 和 `startGame()` 開頭加上 `clearInterval`

### 調整：移除開始按鈕，改為任意鍵開始
- **需求**：取消畫面上的「開始遊戲」按鈕，按任意鍵開始
- **做法**：
  - 移除 controls 中的 idle/gameover 按鈕區塊
  - 在 `handleKeydown` 中判斷 idle/gameover 時呼叫 `startGame()`

### 調整：暫停/繼續改為空白鍵觸發
- **需求**：移除暫停/繼續按鈕，改由空白鍵控制
- **做法**：
  - 移除 controls 中的 playing/paused 按鈕
  - `handleKeydown` 中 `e.key === ' '` 時呼叫 `togglePause()`
  - 新增提示文字「按空白鍵或任意鍵開始」「已暫停，按空白鍵繼續」

### 狀態區分：idle / paused
- **問題**：`'idle'` 同時代表初始狀態和暫停狀態，造成衝突
- **解決**：新增 `'paused'` 狀態，`togglePause()` 改為在 `'playing'` ↔ `'paused'` 之間切換

### 調整：穿牆機制
- **需求**：碰到牆壁不死亡，改為從另一邊穿出來
- **做法**：
  - `move()` 中計算新蛇頭後，用 `((x % gridSize) + gridSize) % gridSize` 進行座標繞圈
  - `checkSelfCollision` 只檢查是否撞到自己（移除牆壁碰撞檢查）

### 調整：配色改為淡藍色系
- **需求**：以淡藍色為基底
- **修改**：
  - 背景：淡藍色漸層 `#e8f4fd → #b3d9f2`
  - 空格：`#d4eaf7`
  - 蛇身：`#27ae60`（翠綠）
  - 蛇頭：`#1a7a3a`（深綠）
  - 食物：`#e74c3c`（紅色圓形）
  - 標題/按鈕/文字配合藍色系調整

### 新增：排行榜
- **需求**：遊戲結束後可輸入名稱儲存分數，留空則為「匿名」
- **做法**：
  - `leaderboard` 陣列存於 `localStorage`，最多保留 10 筆，按分數降冪排列
  - Game over overlay 新增名稱輸入框 +「儲存分數」按鈕
  - 排行榜顯示在網格左側（`position: absolute`）
  - 檔案：`src/components/SnakeGame.vue` 全部實作，未拆檔案

### 調整：方向鍵也可開始遊戲
- **需求**：在初始畫面或 Game Over 時，按方向鍵也能開始遊戲
- **做法**：`handleKeydown` 中 idle/gameover 狀態時攔截方向鍵，同時設定初始方向

### 調整：Game Over 時按任意鍵先存分數再開始
- **需求**：Game Over 時按空白鍵或任意鍵重新開始，同時也要記錄分數
- **做法**：`handleKeydown` 中 gameover 狀態時先呼叫 `saveScore()`，再呼叫 `startGame()`；idle 時則直接 `startGame()`

### 調整：加速系統
- **需求**：每吃 10 顆食物加速一次
- **做法**：
  - 新增 `eatenCount` 追蹤已吃食物數
  - 基礎間隔 150ms，每吃 10 顆縮短 10ms，最快到 60ms（Lv.10 封頂）
  - `move()` 中吃到食物時 `eatenCount++`，若為 10 的倍數則重建 `setInterval`
  - 分數旁顯示當前等級 `Lv.1` / `Lv.2` / ...

### 調整：分數和等級移到右側面板
- **需求**：右邊顯示分數和等級，中間標題區去掉分數
- **做法**：
  - 新增 `.side-info` 固定在遊戲區右側
  - 分數卡片（藍色漸層）、等級卡片（綠色漸層）
  - 移除標題區的分數顯示

### 新增：雙蛇模式（兩塊 10×20 螢幕）
- **需求**：遊戲區分割為左右兩塊 10×20 螢幕，各自一條蛇、各自一個食物
- **做法**：
  - `GRID_WIDTH = 10`、`GRID_HEIGHT = 20`
  - 新增 `playerSnake`（右蛇，綠色）、`aiSnake`（左蛇，橙色）
  - 各自獨立食物、方向、碰撞判斷
  - Template 改為 `.grids-container` 內含兩個 `.grid-wrapper`

### 調整：鏡像操控模式
- **需求**：左蛇操控反向僅左右相反，上下同向
- **做法**：
  - `getMirrorDirection()`：↑/↓ 回傳同向，←/→ 回傳反向
  - 每 tick `aiDirection = getMirrorDirection(playerDirection)`

### 調整：食物必須兩邊都吃完才重生
- **需求**：兩邊的食物都要被吃掉才一起重生新食物
- **做法**：
  - 新增 `playerFoodEaten` / `aiFoodEaten` 旗標
  - 蛇吃到食物 → 食物消失（設為 `{x: -1, y: -1}`），不給分數
  - 兩旗標皆 true → 同時重生兩邊食物，+20 分，+2 eatenCount
  - 加速判斷依 `eatenCount` 跨過 10 的倍數觸發

### 調整：左蛇速度 1.3 倍（後續取消）
- **需求**：左蛇移動間隔為右蛇 1.3 倍
- **做法**：使用 `leftAccumulator` 累積 tick，累積達 13 才移動左蛇（每 13 tick 移動 10 次）
- **後續取消**：改為鏡像模式後移除，兩邊速度相同

### 新增：控制模式標籤
- **需求**：網格下方顯示操控模式
- **做法**：
  - 左蛇網格下方顯示「鏡像」
  - 右蛇網格下方顯示「正常」

### 新增：清空排行榜按鈕
- **需求**：提供清空排行榜的功能
- **做法**：
  - 排行榜標題旁新增「清空」按鈕
  - 點擊後清除 `leaderboard` 陣列並刪除 `localStorage` 資料

### 調整：食物鏡像位置
- **需求**：兩邊食物的 x 座標鏡像對稱，y 各自隨機
- **做法**：
  - 右食物用 `generateFood()` 隨機生成
  - 左食物 x = `GRID_WIDTH - 1 - 右食物.x`，y 獨立亂數

### 調整：分數改為每顆 20 分
- **需求**：一顆食物加 20 分
- **做法**：兩邊都吃完時 `score += 40`（每顆 20）

### 調整：移除兩個遊戲網格間距
- **需求**：左右網格緊貼不留縫
- **做法**：`gap: 24px` → `gap: 0`
