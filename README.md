# 🐍 貪食蛇

單人操作貪食蛇遊戲 — 玩家蛇對抗機器敵人蛇，並可使用守護蛇技能。

## 遊戲規則

- **玩家蛇**：方向鍵控制，綠色
- **敵人蛇**：自動追蹤食物，淡紅色，長度固定 3
- **食物**：吃到 +20 分
- **加速**：每吃 5 顆升一等級並加速（初始 150ms → 最快 60ms）
- **穿牆**：蛇碰到邊緣會從另一邊穿出
- **Game Over**：玩家蛇撞到自己即結束

## 操作
   
|       按鍵    |           功能        |
|---------------|----------------------|
|      方向鍵    |     控制玩家蛇方向    |
|      空白鍵    | 召喚守護蛇（眩暈 AI） |
|        R      |       暫停 / 繼續     |
|      任意鍵    |   初始畫面開始遊戲    |
| 空白鍵 / 方向鍵 | Game Over 後重新開始 |

## 守護蛇技能

- 按空白鍵在玩家蛇右側生成一條青綠色守護蛇
- 守護蛇長度 1，100% 追蹤 AI 蛇
- 撞到 AI 蛇時，AI 蛇眩暈 2 秒無法移動
- 持續 3 秒後消失
- 技能冷卻 5 秒

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
- CSS Grid