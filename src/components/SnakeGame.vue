<script setup lang="ts">
import { ref, type Ref } from 'vue'

const GRID_WIDTH = 10
const GRID_HEIGHT = 20

interface Position {
  x: number
  y: number
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover'
type GridType = 'player' | 'ai'

const playerSnake: Ref<Position[]> = ref([
  { x: 5, y: 10 },
  { x: 4, y: 10 },
  { x: 3, y: 10 },
])
const aiSnake: Ref<Position[]> = ref([
  { x: 4, y: 10 },
  { x: 5, y: 10 },
  { x: 6, y: 10 },
])

const playerFood: Ref<Position> = ref({ x: 8, y: 10 })
const aiFood: Ref<Position> = ref({ x: 1, y: 10 })

const playerDirection: Ref<Direction> = ref('RIGHT')
const aiDirection: Ref<Direction> = ref('LEFT')

const score = ref(0)
const eatenCount = ref(0)

const BASE_SPEED = 150
const MIN_SPEED = 60
const SPEED_STEP = 10

function currentSpeed(): number {
  return Math.max(MIN_SPEED, BASE_SPEED - Math.floor(eatenCount.value / 10) * SPEED_STEP)
}

const gameStatus: Ref<GameStatus> = ref('idle')

let gameTimer: ReturnType<typeof setInterval> | null = null
let pendingDirection: Direction | null = null
let playerFoodEaten = false
let aiFoodEaten = false

interface LeaderboardEntry {
  name: string
  score: number
}

const playerName = ref('')
const leaderboard = ref<LeaderboardEntry[]>([])
const STORAGE_KEY = 'snake-game-leaderboard'

function loadLeaderboard(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    leaderboard.value = JSON.parse(raw) as LeaderboardEntry[]
  }
}

function saveLeaderboard(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard.value))
}

function saveScore(): void {
  const name = playerName.value.trim() || '匿名'
  leaderboard.value.push({ name, score: score.value })
  leaderboard.value.sort((a, b) => b.score - a.score)
  if (leaderboard.value.length > 10) {
    leaderboard.value = leaderboard.value.slice(0, 10)
  }
  saveLeaderboard()
  gameStatus.value = 'idle'
  playerName.value = ''
}

function clearLeaderboard(): void {
  leaderboard.value = []
  localStorage.removeItem(STORAGE_KEY)
}

function getMirrorDirection(dir: Direction): Direction {
  return ({ UP: 'UP', DOWN: 'DOWN', LEFT: 'RIGHT', RIGHT: 'LEFT' } as Record<Direction, Direction>)[dir]
}

function getCellType(index: number, grid: GridType): 'snake' | 'head' | 'food' | null {
  const x = (index - 1) % GRID_WIDTH
  const y = Math.floor((index - 1) / GRID_WIDTH)

  const snake = grid === 'player' ? playerSnake.value : aiSnake.value
  const food = grid === 'player' ? playerFood.value : aiFood.value

  const head = snake[0]!
  if (head.x === x && head.y === y) return 'head'
  for (const seg of snake) {
    if (seg.x === x && seg.y === y) return 'snake'
  }
  if (food.x === x && food.y === y) return 'food'
  return null
}

function generateFood(snake: Position[]): Position {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`))
  const empty: Position[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!occupied.has(`${x},${y}`)) empty.push({ x, y })
    }
  }
  if (empty.length === 0) return { x: 0, y: 0 }
  return empty[Math.floor(Math.random() * empty.length)]!
}

function checkSelfCollision(head: Position, snake: Position[]): boolean {
  for (let i = 1; i < snake.length; i++) {
    if (snake[i]!.x === head.x && snake[i]!.y === head.y) return true
  }
  return false
}

function moveSnake(
  snake: Position[],
  food: Position,
  dir: Direction,
): { died: boolean; ate: boolean } {
  const head = { ...snake[0]! }
  switch (dir) {
    case 'UP':    head.y--; break
    case 'DOWN':  head.y++; break
    case 'LEFT':  head.x--; break
    case 'RIGHT': head.x++; break
  }

  head.x = ((head.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
  head.y = ((head.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

  if (checkSelfCollision(head, snake)) {
    return { died: true, ate: false }
  }

  snake.unshift(head)

  if (head.x === food.x && head.y === food.y) {
    return { died: false, ate: true }
  } else {
    snake.pop()
    return { died: false, ate: false }
  }
}

function move(): void {
  if (gameStatus.value !== 'playing') return

  if (pendingDirection !== null) {
    playerDirection.value = pendingDirection
    pendingDirection = null
  }

  aiDirection.value = getMirrorDirection(playerDirection.value)

  const playerResult = moveSnake(playerSnake.value, playerFood.value, playerDirection.value)
  if (playerResult.ate) { playerFoodEaten = true; playerFood.value = { x: -1, y: -1 } }
  if (playerResult.died) {
    gameStatus.value = 'gameover'
    return
  }

  const aiResult = moveSnake(aiSnake.value, aiFood.value, aiDirection.value)
  if (aiResult.ate) { aiFoodEaten = true; aiFood.value = { x: -1, y: -1 } }
  if (aiResult.died) {
    gameStatus.value = 'gameover'
    return
  }

  if (playerFoodEaten && aiFoodEaten) {
    const prevLevel = Math.floor(eatenCount.value / 10)
    score.value += 40
    eatenCount.value += 2
    if (Math.floor(eatenCount.value / 10) > prevLevel && gameTimer !== null) {
      clearInterval(gameTimer)
      gameTimer = setInterval(move, currentSpeed())
    }
    playerFood.value = generateFood(playerSnake.value)
    const mirrorX = GRID_WIDTH - 1 - playerFood.value.x
    aiFood.value = { x: mirrorX, y: Math.floor(Math.random() * GRID_HEIGHT) }
    playerFoodEaten = false
    aiFoodEaten = false
  }
}

function changeDirection(newDir: Direction): void {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  if (newDir !== opposites[playerDirection.value]) {
    pendingDirection = newDir
  }
}

function gameLoop(): void {
  if (gameTimer !== null) clearInterval(gameTimer)
  gameTimer = setInterval(move, currentSpeed())
}

function startGame(): void {
  if (gameTimer !== null) clearInterval(gameTimer)
  playerSnake.value = [
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ]
  aiSnake.value = [
    { x: 4, y: 10 },
    { x: 5, y: 10 },
    { x: 6, y: 10 },
  ]
  playerDirection.value = 'RIGHT'
  aiDirection.value = 'LEFT'
  score.value = 0
  eatenCount.value = 0
  playerFood.value = generateFood(playerSnake.value)
  aiFood.value = generateFood(aiSnake.value)
  gameStatus.value = 'playing'
  gameLoop()
}

function togglePause(): void {
  if (gameStatus.value === 'playing') {
    gameStatus.value = 'paused'
    if (gameTimer !== null) {
      clearInterval(gameTimer)
      gameTimer = null
    }
  } else if (gameStatus.value === 'paused') {
    gameStatus.value = 'playing'
    gameLoop()
  }
}

function handleKeydown(e: KeyboardEvent): void {
  const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)

  if (gameStatus.value === 'gameover') {
    e.preventDefault()
    saveScore()
    startGame()
    if (isArrow) pendingDirection = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' } as Record<string, Direction>)[e.key] ?? null
    return
  }

  if (gameStatus.value === 'idle') {
    e.preventDefault()
    startGame()
    if (isArrow) pendingDirection = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' } as Record<string, Direction>)[e.key] ?? null
    return
  }

  if (e.key === ' ') {
    e.preventDefault()
    togglePause()
    return
  }

  if (gameStatus.value !== 'playing') return

  const map: Record<string, Direction> = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  }
  const dir = map[e.key]
  if (dir) {
    e.preventDefault()
    changeDirection(dir)
  }
}

import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  loadLeaderboard()
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="snake-game">
    <div class="leaderboard">
      <h3>排行榜</h3>
      <button v-if="leaderboard.length > 0" class="clear-btn" @click="clearLeaderboard">清空</button>
      <table v-if="leaderboard.length > 0">
        <thead>
          <tr>
            <th>#</th>
            <th>名稱</th>
            <th>分數</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, i) in leaderboard" :key="i">
            <td>{{ i + 1 }}</td>
            <td>{{ entry.name }}</td>
            <td>{{ entry.score }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">暫無紀錄</p>
    </div>

    <div class="game-area">
      <div class="header">
        <h1>貪食蛇 — 雙蛇</h1>
      </div>

      <div class="grids-container">
        <div class="grid-wrapper">
          <div class="grid-label left-label">左蛇</div>
          <div class="grid-container">
            <div
              v-for="i in GRID_WIDTH * GRID_HEIGHT"
              :key="i"
              class="cell"
              :class="getCellType(i, 'ai')"
            ></div>
          </div>
          <div class="grid-mode">鏡像</div>
        </div>

        <div class="grid-wrapper">
          <div class="grid-label right-label">右蛇</div>
          <div class="grid-container">
            <div
              v-for="i in GRID_WIDTH * GRID_HEIGHT"
              :key="i"
              class="cell"
              :class="getCellType(i, 'player')"
            ></div>
          </div>
          <div class="grid-mode">正常</div>
        </div>
      </div>

      <div class="info">
        <template v-if="gameStatus === 'idle'">按空白鍵或任意鍵開始</template>
        <template v-else-if="gameStatus === 'paused'">已暫停，按空白鍵繼續</template>
      </div>
    </div>

    <div class="side-info">
      <div class="info-card score-card">
        <span class="info-label">分數</span>
        <span class="info-value">{{ score }}</span>
      </div>
      <div class="info-card level-card">
        <span class="info-label">等級</span>
        <span class="info-value">Lv.{{ Math.floor(eatenCount / 10) + 1 }}</span>
      </div>
    </div>

    <div class="overlay" :class="{ visible: gameStatus === 'gameover' }">
      <div class="overlay-content">
        <h2>遊戲結束</h2>
        <p>分數：<span>{{ score }}</span></p>
        <div class="name-input">
          <input
            v-model="playerName"
            placeholder="輸入名稱（留空即匿名）"
            @keydown.enter="saveScore"
          />
        </div>
        <div class="overlay-actions">
          <button class="btn" @click="saveScore">儲存分數</button>
          <button class="btn btn-secondary" @click="startGame">重新開始</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-game {
  position: relative;
  display: flex;
  justify-content: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  padding: 40px 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f4fd 0%, #b3d9f2 100%);
}

.game-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header {
  text-align: center;
  margin-bottom: 16px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  color: #1a5276;
}

.grids-container {
  display: flex;
  gap: 0;
}

.grid-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grid-label {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.grid-label.left-label {
  color: #e67e22;
}

.grid-label.right-label {
  color: #27ae60;
}

.grid-mode {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(10, 24px);
  grid-template-rows: repeat(20, 24px);
  gap: 1px;
  background-color: #7fb3d8;
  border: 2px solid #5a95b8;
  border-radius: 4px;
}

.cell {
  width: 24px;
  height: 24px;
  background-color: #d4eaf7;
}

.grid-wrapper:first-child .cell.snake {
  background-color: #e67e22;
}

.grid-wrapper:first-child .cell.head {
  background-color: #d35400;
}

.grid-wrapper:last-child .cell.snake {
  background-color: #27ae60;
}

.grid-wrapper:last-child .cell.head {
  background-color: #1a7a3a;
}

.cell.food {
  background-color: #e74c3c;
  border-radius: 50%;
}

.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(26, 82, 118, 0.6);
  justify-content: center;
  align-items: center;
}

.overlay.visible {
  display: flex;
}

.overlay-content {
  background: #f0f8ff;
  padding: 32px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.overlay-content h2 {
  margin: 0 0 8px;
  color: #c0392b;
}

.overlay-content p {
  color: #2c7bb6;
  font-size: 18px;
}

.btn {
  padding: 10px 24px;
  font-size: 16px;
  cursor: pointer;
  border: none;
  border-radius: 6px;
  background-color: #2ecc71;
  color: #fff;
  transition: background-color 0.2s;
}

.btn:hover {
  background-color: #27ae60;
}

.btn-secondary {
  background-color: #95a5a6;
}

.btn-secondary:hover {
  background-color: #7f8c8d;
}

.name-input {
  margin: 16px 0;
}

.name-input input {
  padding: 8px 12px;
  font-size: 16px;
  border: 2px solid #7fb3d8;
  border-radius: 6px;
  outline: none;
  width: 200px;
}

.name-input input:focus {
  border-color: #2c7bb6;
}

.overlay-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.leaderboard {
  position: absolute;
  left: calc(50% - 505px);
  top: 40px;
  width: 220px;
}

.side-info {
  position: absolute;
  left: calc(50% + 285px);
  top: 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 130px;
}

.info-card {
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
}

.info-card.score-card {
  background: linear-gradient(135deg, #27ae60, #1a7a3a);
}

.info-card.level-card {
  background: linear-gradient(135deg, #2c7bb6, #1a5276);
}

.info-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.info-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.leaderboard h3 {
  text-align: center;
  color: #1a5276;
  margin: 0 0 12px;
  font-size: 20px;
}

.clear-btn {
  display: block;
  margin: 0 auto 12px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f8ff;
  color: #999;
  transition: color 0.2s, border-color 0.2s;
}

.clear-btn:hover {
  color: #c0392b;
  border-color: #c0392b;
}

.leaderboard table {
  width: 100%;
  border-collapse: collapse;
  background: #f0f8ff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.leaderboard th {
  background: #2c7bb6;
  color: #fff;
  padding: 8px;
  font-size: 14px;
}

.leaderboard td {
  padding: 6px 8px;
  text-align: center;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #d4eaf7;
}

.leaderboard tr:last-child td {
  border-bottom: none;
}

.leaderboard .empty {
  text-align: center;
  color: #999;
  font-size: 14px;
}

.info {
  margin-top: 16px;
  font-size: 14px;
  color: #2c7bb6;
}
</style>
