<script setup lang="ts">
import { ref, type Ref } from 'vue'

const GRID_WIDTH = 20
const GRID_HEIGHT = 20

interface Position {
  x: number
  y: number
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover'
const snake: Ref<Position[]> = ref([
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
])

const aiSnake: Ref<Position[]> = ref([
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 7, y: 5 },
])

const defenderSnake: Ref<Position[]> = ref([])
const defenderActive = ref(false)
const defenderCooldown = ref(0)  // 剩余冷却毫秒数
const DEFENDER_COOLDOWN = 5000
let defenderTimer: ReturnType<typeof setInterval> | null = null
let defenderCooldownTimer: ReturnType<typeof setInterval> | null = null
let aiStunned = false
let aiStunTimer: ReturnType<typeof setInterval> | null = null

const food: Ref<Position> = ref({ x: 15, y: 10 })

const direction: Ref<Direction> = ref('RIGHT')
const aiDirection: Ref<Direction> = ref('LEFT')
const defenderDirection: Ref<Direction> = ref('RIGHT')

const AI_SPEED_MULTIPLIER = 0.6
const STUN_DURATION = 2000

// 玩家速度加成（闪电技能触发时）
let playerSpeedMultiplier = 1.0

// 闪电技能
const LIGHTNING_COOLDOWN = 5000
const lightningActive = ref(false)
const lightningPosition = ref<Position | null>(null)
const lightningPhase = ref<'none' | 'warning' | 'strike'>('none')
let lightningCooldown = 0
let lightningCooldownTimer: ReturnType<typeof setInterval> | null = null
let lightningWarningTimer: ReturnType<typeof setTimeout> | null = null
let lightningStrikeTimer: ReturnType<typeof setTimeout> | null = null

const score = ref(0)
const eatenCount = ref(0)

const BASE_SPEED = 150
const MIN_SPEED = 60
const SPEED_STEP = 10

function currentSpeed(): number {
  const baseSpeed = BASE_SPEED - Math.floor(eatenCount.value / 5) * SPEED_STEP
  return Math.max(MIN_SPEED, baseSpeed / playerSpeedMultiplier)
}

const gameStatus: Ref<GameStatus> = ref('idle')

let gameTimer: ReturnType<typeof setInterval> | null = null
let aiTimer: ReturnType<typeof setInterval> | null = null
let pendingDirection: Direction | null = null

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

function getCellType(index: number): 'snake' | 'head' | 'food' | 'ai-snake' | 'ai-head' | 'defender-snake' | 'defender-head' | 'lightning-warning' | 'lightning-strike' | null {
  const x = (index - 1) % GRID_WIDTH
  const y = Math.floor((index - 1) / GRID_WIDTH)

  // 闪电效果渲染
  if (lightningActive.value && lightningPosition.value && lightningPhase.value !== 'none') {
    const lx = lightningPosition.value.x
    const ly = lightningPosition.value.y
    if (x >= lx && x < lx + 4 && y >= ly && y < ly + 4) {
      if (lightningPhase.value === 'warning') return 'lightning-warning'
      if (lightningPhase.value === 'strike') return 'lightning-strike'
    }
  }

  const aiHead = aiSnake.value[0]!
  if (aiHead.x === x && aiHead.y === y) return 'ai-head'
  for (const seg of aiSnake.value) {
    if (seg.x === x && seg.y === y) return 'ai-snake'
  }

  if (defenderActive.value) {
    const defenderHead = defenderSnake.value[0]!
    if (defenderHead.x === x && defenderHead.y === y) return 'defender-head'
    for (const seg of defenderSnake.value) {
      if (seg.x === x && seg.y === y) return 'defender-snake'
    }
  }

  const head = snake.value[0]!
  if (head.x === x && head.y === y) return 'head'
  for (const seg of snake.value) {
    if (seg.x === x && seg.y === y) return 'snake'
  }
  if (food.value.x === x && food.value.y === y) return 'food'
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
  grow: boolean = true,
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

  const ate = head.x === food.x && head.y === food.y
  if (!ate || !grow) {
    snake.pop()
  }
  return { died: false, ate }
}

function getAIDirection(snake: Position[], food: Position): Direction {
  const head = snake[0]!
  const dx = food.x - head.x
  const dy = food.y - head.y

  const candidates: Direction[] = []
  if (dy < 0) candidates.push('UP')
  else if (dy > 0) candidates.push('DOWN')
  if (dx < 0) candidates.push('LEFT')
  else if (dx > 0) candidates.push('RIGHT')

  if (candidates.length === 0) return 'RIGHT'
  if (candidates.length === 1) return candidates[0]!

  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }

  for (const dir of candidates) {
    if (dir === opposites[aiDirection.value]) continue

    let next = { x: head.x, y: head.y }
    if (dir === 'UP') next.y--
    if (dir === 'DOWN') next.y++
    if (dir === 'LEFT') next.x--
    if (dir === 'RIGHT') next.x++

    next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

    const allSnakes = [...snake, ...aiSnake.value]
    if (!allSnakes.some(seg => seg.x === next.x && seg.y === next.y)) {
      return dir
    }
  }

  return candidates[0]!
}

function move(): void {
  if (gameStatus.value !== 'playing') return

  if (pendingDirection !== null) {
    direction.value = pendingDirection
    pendingDirection = null
  }

  const result = moveSnake(snake.value, food.value, direction.value)
  if (result.died) {
    gameStatus.value = 'gameover'
    return
  }

  if (result.ate) {
    score.value += 20
    eatenCount.value++
    const prevLevel = Math.floor((eatenCount.value - 1) / 10)
    if (Math.floor(eatenCount.value / 5) > prevLevel && gameTimer !== null) {
      clearInterval(gameTimer)
      gameTimer = setInterval(move, currentSpeed())
      if (aiTimer !== null) {
        clearInterval(aiTimer)
        aiTimer = setInterval(moveAISnake, currentSpeed() / AI_SPEED_MULTIPLIER)
      }
    }
    food.value = generateFood([...snake.value, ...aiSnake.value])
  }

  // 自动释放闪电技能（Lv.2 解锁，CD 完毕）
  const currentLevel = Math.floor(eatenCount.value / 5) + 1
  if (currentLevel >= 2 && lightningCooldown <= 0 && !lightningActive.value) {
    activateLightning()
  }
}

function activateLightning(): void {
  if (lightningActive.value || lightningCooldown > 0) return

  // 随机生成 4x4 位置
  const lx = Math.floor(Math.random() * (GRID_WIDTH - 3))
  const ly = Math.floor(Math.random() * (GRID_HEIGHT - 3))
  lightningPosition.value = { x: lx, y: ly }
  lightningActive.value = true
  lightningPhase.value = 'warning'

  // 2秒后触发闪电
  if (lightningWarningTimer !== null) clearTimeout(lightningWarningTimer)
  lightningWarningTimer = setTimeout(() => {
    lightningPhase.value = 'strike'

    // 检查是否击中目标
    const playerHead = snake.value[0]!
    const aiHead = aiSnake.value[0]!

    // 检查玩家是否在范围内
    if (playerHead.x >= lx && playerHead.x < lx + 4 &&
        playerHead.y >= ly && playerHead.y < ly + 4) {
      playerSpeedMultiplier = 1.2
      if (playerSpeedBoostTimer !== null) clearTimeout(playerSpeedBoostTimer)
      playerSpeedBoostTimer = setTimeout(() => {
        playerSpeedMultiplier = 1.0
      }, 3000)
    }

    // 检查 AI 是否在范围内
    if (aiHead.x >= lx && aiHead.x < lx + 4 &&
        aiHead.y >= ly && aiHead.y < ly + 4) {
      aiStunned = true
      if (aiStunTimer !== null) clearTimeout(aiStunTimer)
      aiStunTimer = setTimeout(() => {
        aiStunned = false
      }, 3000)
    }

    // 闪电特效持续 0.3 秒后消失
    if (lightningStrikeTimer !== null) clearTimeout(lightningStrikeTimer)
    lightningStrikeTimer = setTimeout(() => {
      lightningActive.value = false
      lightningPosition.value = null
      lightningPhase.value = 'none'

      // 开始冷却
      lightningCooldown = LIGHTNING_COOLDOWN
      if (lightningCooldownTimer !== null) clearInterval(lightningCooldownTimer)
      lightningCooldownTimer = setInterval(() => {
        lightningCooldown -= 100
        if (lightningCooldown <= 0) {
          lightningCooldown = 0
          if (lightningCooldownTimer !== null) {
            clearInterval(lightningCooldownTimer)
            lightningCooldownTimer = null
          }
        }
      }, 100)
    }, 300)
  }, 2000)
}

function changeDirection(newDir: Direction): void {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  if (newDir !== opposites[direction.value]) {
    pendingDirection = newDir
  }
}

function moveAISnake(): void {
  if (gameStatus.value !== 'playing') return
  if (aiStunned) return

  aiDirection.value = getAIDirection(aiSnake.value, food.value)
  const aiResult = moveSnake(aiSnake.value, food.value, aiDirection.value, false)

  if (aiResult.ate) {
    score.value = Math.max(0, score.value - 10)
    food.value = generateFood([...snake.value, ...aiSnake.value])
  }
}

function getDefenderTargetDirection(defender: Position[], target: Position[]): Direction {
  const head = defender[0]!
  const targetHead = target[0]!
  const dx = targetHead.x - head.x
  const dy = targetHead.y - head.y

  const candidates: Direction[] = []
  if (dy < 0) candidates.push('UP')
  else if (dy > 0) candidates.push('DOWN')
  if (dx < 0) candidates.push('LEFT')
  else if (dx > 0) candidates.push('RIGHT')

  if (candidates.length === 0) return 'RIGHT'
  if (candidates.length === 1) return candidates[0]!

  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }

  for (const dir of candidates) {
    if (dir === opposites[defenderDirection.value]) continue

    let next = { x: head.x, y: head.y }
    if (dir === 'UP') next.y--
    if (dir === 'DOWN') next.y++
    if (dir === 'LEFT') next.x--
    if (dir === 'RIGHT') next.x++

    next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

    const allSnakes = [...snake.value, ...aiSnake.value, ...defender]
    if (!allSnakes.some(seg => seg.x === next.x && seg.y === next.y)) {
      return dir
    }
  }

  return candidates[0]!
}

function moveDefenderSnake(): void {
  if (gameStatus.value !== 'playing' || !defenderActive.value) return

  defenderDirection.value = getDefenderTargetDirection(defenderSnake.value, aiSnake.value)

  const result = moveSnake(defenderSnake.value, { x: -1, y: -1 }, defenderDirection.value, false)

  const aiHead = aiSnake.value[0]!
  const defenderHead = defenderSnake.value[0]!
  if (defenderHead.x === aiHead.x && defenderHead.y === aiHead.y) {
    aiStunned = true
    if (aiStunTimer !== null) clearTimeout(aiStunTimer)
    aiStunTimer = setTimeout(() => {
      aiStunned = false
    }, STUN_DURATION)
  }
}

function activateDefender(): void {
  if (defenderActive.value || defenderCooldown.value || gameStatus.value !== 'playing') return

  const head = snake.value[0]!
  defenderSnake.value = [
    { x: head.x + 1, y: head.y },
  ]
  defenderDirection.value = 'RIGHT'
  defenderActive.value = true

  if (defenderTimer !== null) clearInterval(defenderTimer)
  const defenderSpeed = BASE_SPEED / 1.5
  defenderTimer = setInterval(moveDefenderSnake, defenderSpeed)

  setTimeout(() => {
    defenderActive.value = false
    defenderSnake.value = []
    if (defenderTimer !== null) {
      clearInterval(defenderTimer)
      defenderTimer = null
    }

    // 开始冷却
    defenderCooldown.value = DEFENDER_COOLDOWN
    if (defenderCooldownTimer !== null) clearInterval(defenderCooldownTimer)
    defenderCooldownTimer = setInterval(() => {
      defenderCooldown.value -= 100
      if (defenderCooldown.value <= 0) {
        defenderCooldown.value = 0
        if (defenderCooldownTimer !== null) {
          clearInterval(defenderCooldownTimer)
          defenderCooldownTimer = null
        }
      }
    }, 100)
  }, 3000)
}

function gameLoop(): void {
  if (gameTimer !== null) clearInterval(gameTimer)
  if (aiTimer !== null) clearInterval(aiTimer)
  gameTimer = setInterval(move, currentSpeed())
  const aiSpeed = currentSpeed() / AI_SPEED_MULTIPLIER
  aiTimer = setInterval(moveAISnake, aiSpeed)
}

function startGame(): void {
  if (gameTimer !== null) clearInterval(gameTimer)
  if (aiTimer !== null) clearInterval(aiTimer)
  snake.value = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]
  aiSnake.value = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 7, y: 5 },
  ]
  aiDirection.value = 'LEFT'
  direction.value = 'RIGHT'
  score.value = 0
  eatenCount.value = 0
  food.value = generateFood([...snake.value, ...aiSnake.value])
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
    if (aiTimer !== null) {
      clearInterval(aiTimer)
      aiTimer = null
    }
    if (defenderCooldownTimer !== null) {
      clearInterval(defenderCooldownTimer)
      defenderCooldownTimer = null
    }
    if (defenderTimer !== null) {
      clearInterval(defenderTimer)
      defenderTimer = null
    }
    if (lightningCooldownTimer !== null) {
      clearInterval(lightningCooldownTimer)
      lightningCooldownTimer = null
    }
    if (lightningWarningTimer !== null) {
      clearTimeout(lightningWarningTimer)
      lightningWarningTimer = null
    }
    if (lightningStrikeTimer !== null) {
      clearTimeout(lightningStrikeTimer)
      lightningStrikeTimer = null
    }
  } else if (gameStatus.value === 'paused') {
    gameStatus.value = 'playing'
    gameLoop()
    // 如果防御者冷却中，重新启动冷却计时器
    if (defenderCooldown.value > 0 && defenderCooldownTimer === null) {
      defenderCooldownTimer = setInterval(() => {
        defenderCooldown.value -= 100
        if (defenderCooldown.value <= 0) {
          defenderCooldown.value = 0
          if (defenderCooldownTimer !== null) {
            clearInterval(defenderCooldownTimer)
            defenderCooldownTimer = null
          }
        }
      }, 100)
    }
    // 如果闪电冷却中，重新启动冷却计时器
    if (lightningCooldown > 0 && lightningCooldownTimer === null) {
      lightningCooldownTimer = setInterval(() => {
        lightningCooldown -= 100
        if (lightningCooldown <= 0) {
          lightningCooldown = 0
          if (lightningCooldownTimer !== null) {
            clearInterval(lightningCooldownTimer)
            lightningCooldownTimer = null
          }
        }
      }, 100)
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)

  if (gameStatus.value === 'gameover') {
    if (isArrow || e.key === ' ') {
      e.preventDefault()
      saveScore()
      startGame()
      if (isArrow) pendingDirection = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' } as Record<string, Direction>)[e.key] ?? null
    }
    return
  }

  if (gameStatus.value === 'idle') {
    e.preventDefault()
    startGame()
    if (isArrow) pendingDirection = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' } as Record<string, Direction>)[e.key] ?? null
    return
  }

  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault()
    togglePause()
    return
  }

  if (e.key === ' ') {
    e.preventDefault()
    activateDefender()
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
        <h1>貪食蛇</h1>
      </div>

      <div class="grid-container">
        <div
          v-for="i in GRID_WIDTH * GRID_HEIGHT"
          :key="i"
          class="cell"
          :class="getCellType(i)"
        ></div>
      </div>

      <div class="info">
        <template v-if="gameStatus === 'idle'">按任意鍵開始，按 R 鍵暫停</template>
        <template v-else-if="gameStatus === 'paused'">已暫停，按 R 鍵繼續</template>
      </div>

      <div class="skill-icon" :class="{ cooling: defenderCooldown > 0 }">
        <div class="skill-content">
          <span class="snake-emoji">🐍</span>
        </div>
        <svg class="cooldown-ring" viewBox="0 0 36 36">
          <circle class="cooldown-bg" cx="18" cy="18" r="16" />
          <circle 
            class="cooldown-progress" 
            cx="18" 
            cy="18" 
            r="16"
            :style="{ 
              strokeDashoffset: defenderCooldown > 0 ? (defenderCooldown / DEFENDER_COOLDOWN) * 100 : 0 
            }"
          />
        </svg>
      </div>

      <div v-if="Math.floor(eatenCount / 5) + 1 >= 2" class="skill-icon" :class="{ cooling: lightningCooldown > 0 }">
        <div class="skill-content">
          <span class="lightning-emoji">⚡</span>
        </div>
        <svg class="cooldown-ring" viewBox="0 0 36 36">
          <circle class="cooldown-bg" cx="18" cy="18" r="16" />
          <circle 
            class="cooldown-progress" 
            cx="18" 
            cy="18" 
            r="16"
            :style="{ 
              strokeDashoffset: lightningCooldown > 0 ? (lightningCooldown / LIGHTNING_COOLDOWN) * 100 : 0 
            }"
          />
        </svg>
      </div>
    </div>

    <div class="side-info">
      <div class="info-card score-card">
        <span class="info-label">分數</span>
        <span class="info-value">{{ score }}</span>
      </div>
      <div class="info-card level-card">
        <span class="info-label">等級</span>
        <span class="info-value">Lv.{{ Math.floor(eatenCount / 5) + 1 }}</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (eatenCount % 5) * 20 + '%' }"></div>
        </div>
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
        </div>
        <p class="restart-hint">按空白鍵或方向鍵重新開始</p>
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
  position: relative;
}

.skill-icon {
  position: absolute;
  right: -60px;
  bottom: 195px;
  width: 50px;
  height: 50px;
}

.skill-icon:last-of-type {
  bottom: 135px;
}

.skill-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #a3e4d7;
  border-radius: 50%;
  z-index: 1;
  transition: opacity 0.3s ease;
}

.skill-icon.cooling .skill-content,
.skill-icon.cooling .snake-emoji {
  opacity: 0.3;
}

.snake-emoji {
  font-size: 24px;
}

.lightning-emoji {
  font-size: 24px;
}

.skill-icon.cooling .lightning-emoji {
  opacity: 0.3;
}

.cooldown-ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.cooldown-bg {
  fill: none;
  stroke: #ddd;
  stroke-width: 3;
}

.cooldown-progress {
  fill: none;
  stroke: #48c9b0;
  stroke-width: 3;
  stroke-dasharray: 100;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.1s linear;
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

.grid-container {
  display: grid;
  grid-template-columns: repeat(20, 24px);
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

.cell.snake {
  background-color: #27ae60;
}

.cell.head {
  background-color: #1a7a3a;
}

.cell.ai-snake {
  background-color: #f5b7b1;
}

.cell.ai-head {
  background-color: #e74c3c;
}

.cell.defender-snake {
  background-color: #a3e4d7;
}

.cell.defender-head {
  background-color: #48c9b0;
}

.cell.food {
  background-color: #e74c3c;
  border-radius: 50%;
}

.cell.lightning-warning {
  background-color: #ffeaa7;
}

.cell.lightning-strike {
  background-color: #fff;
  animation: lightning-flash 0.15s ease-in-out 2;
}

@keyframes lightning-flash {
  0%, 100% { background-color: #fff; }
  50% { background-color: #f0f8ff; }
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

.restart-hint {
  margin-top: 12px;
  font-size: 14px;
  color: #666;
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

.progress-bar {
  width: 100%;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #f39c12;
  border-radius: 3px;
  transition: width 0.2s ease;
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
