# 🐍 雙蛇貪食蛇

雙人操作貪食蛇遊戲 — 左右各有一個 10×20 的遊戲網格，兩條蛇同時移動，分數共用。

## 遊戲規則

- **右蛇**：方向鍵控制，**正常方向**
- **左蛇**：方向鍵控制，**鏡像方向**（↑/↓ 同向，←/→ 反向）
- **食物**：兩邊各有一顆食物，都吃掉後才一起重生，每次 **+20 分**
- **加速**：每吃 10 顆減少間隔時間（初始 150ms → 最快 60ms）
- **穿牆**：蛇碰到邊緣會從另一邊穿出
- **Game Over**：任一條蛇撞到自己即結束

## 操作

| 按鍵 | 功能 |
|------|------|
| 方向鍵 | 控制右蛇方向（左蛇鏡像反向） |
| 空白鍵 | 開始 / 暫停 / 繼續 |
| 任意鍵 | 初始畫面或 Game Over 時開始遊戲 |

## 排行榜

- 遊戲結束後可輸入名稱儲存分數（留空即匿名）
- 記錄在瀏覽器 `localStorage`，最多保留 10 筆
- 可手動清空排行榜

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint

```sh
npm run lint
```

## 技術棧

- Vue 3 (Composition API + `<script setup>`)
- TypeScript
- Vite
- Pinia
- Vue Router
- CSS Grid
