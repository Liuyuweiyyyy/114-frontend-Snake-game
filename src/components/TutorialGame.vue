<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'complete', destination?: string): void
}>()

type TutorialStep = 'move' | 'aiSpawn' | 'aiEat' | 'noFood' | 'showDefender' | 'useDefender' | 'complete'

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Position {
  x: number
  y: number
}

const GRID_WIDTH = 20
const GRID_HEIGHT = 20
const PLAYER_AREA_MIN_Y = 10
const AI_AREA_MAX_Y = 9
const BASE_SPEED = 150

const gameStatus = ref<'playing' | 'gameover'>('playing')
const score = ref(0)

const snake = ref<Position[]>([
  { x: 10, y: 15 },
  { x: 9, y: 15 },
  { x: 8, y: 15 },
])
const direction = ref<Direction>('RIGHT')
const food = ref<Position>({ x: 12, y: 16 })

const aiFood = ref<Position>({ x: 10, y: 5 })

const tutorialStep = ref<TutorialStep>('move')
const showHint = ref('')
const showCompletionModal = ref(false)

const defenderActive = ref(false)
const defenderSnake = ref<Position[]>([])
const defenderDirection = ref<Direction>('RIGHT')
let defenderTimer: ReturnType<typeof setInterval> | null = null

interface AISnake {
  positions: Position[]
  direction: Direction
  stunned: boolean
  paused: boolean
  pauseStepCount: number
  stunTimer: ReturnType<typeof setTimeout> | null
  pauseTimer: ReturnType<typeof setTimeout> | null
  hitDuringStun: boolean
}

const aiSnakes = ref<AISnake[]>([])
let aiTimer: ReturnType<typeof setInterval> | null = null
let gameTimer: ReturnType<typeof setInterval> | null = null
let pendingDirection: Direction | null = null

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

  snake.unshift(head)

  const ate = head.x === food.x && head.y === food.y
  if (!ate || !grow) {
    snake.pop()
  }
  return { died: false, ate }
}

function getAIDirection(snake: Position[], food: Position, currentDir: Direction): Direction {
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
    if (dir === opposites[currentDir]) continue

    const next = { x: head.x, y: head.y }
    if (dir === 'UP') next.y--
    if (dir === 'DOWN') next.y++
    if (dir === 'LEFT') next.x--
    if (dir === 'RIGHT') next.x++

    next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

    const allSnakes = [...snake, ...aiSnakes.value.flatMap(s => s.positions)]
    if (!allSnakes.some(seg => seg.x === next.x && seg.y === next.y)) {
      return dir
    }
  }

  return candidates[0]!
}

function getDefenderTargetDirection(defender: Position[], targets: AISnake[]): Direction {
  if (targets.length === 0) return 'RIGHT'
  
  const head = defender[0]!
  
  let nearestTarget = targets[0]!
  let minDist = Infinity
  
  for (const target of targets) {
    if (target.stunned || target.paused) continue
    const targetHead = target.positions[0]!
    const dist = Math.abs(targetHead.x - head.x) + Math.abs(targetHead.y - head.y)
    if (dist < minDist) {
      minDist = dist
      nearestTarget = target
    }
  }
  
  const targetHead = nearestTarget.positions[0]!
  const dx = targetHead.x - head.x
  const dy = targetHead.y - head.y

  const candidates: Direction[] = []
  if (dy < 0) candidates.push('UP')
  else if (dy > 0) candidates.push('DOWN')
  if (dx < 0) candidates.push('LEFT')
  else if (dx > 0) candidates.push('RIGHT')

  if (candidates.length === 0) return 'RIGHT'
  if (candidates.length === 1) return candidates[0]!

  for (const dir of candidates) {
    const next = { x: head.x, y: head.y }
    if (dir === 'UP') next.y--
    if (dir === 'DOWN') next.y++
    if (dir === 'LEFT') next.x--
    if (dir === 'RIGHT') next.x++

    next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

    const allSnakes = [
      ...snake.value,
      ...aiSnakes.value.flatMap(s => s.positions),
      ...defender
    ]
    if (!allSnakes.some(seg => seg.x === next.x && seg.y === next.y)) {
      return dir
    }
  }

  return candidates[0]!
}

const movePlayer = () => {
  if (gameStatus.value !== 'playing') return
  if (tutorialStep.value === 'complete') return

  if (pendingDirection !== null) {
    direction.value = pendingDirection
    pendingDirection = null
  }

  const result = moveSnake(snake.value, food.value, direction.value)
  
  if (result.ate) {
    score.value += 20
    
    if (tutorialStep.value === 'move') {
      tutorialStep.value = 'aiSpawn'
      showHint.value = '等待敵蛇...'
      food.value = { x: -1, y: -1 }
      setTimeout(() => {
        initAI()
        tutorialStep.value = 'aiEat'
        showHint.value = '敵蛇正在進食...'
        if (gameTimer) {
          clearInterval(gameTimer)
          gameTimer = setInterval(movePlayer, BASE_SPEED)
        }
      }, 1500)
    } else {
      food.value = { x: -1, y: -1 }
    }
  }
}

const initAI = () => {
  aiSnakes.value = [{
    positions: [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    direction: 'RIGHT',
    stunned: false,
    paused: false,
    pauseStepCount: 0,
    stunTimer: null,
    pauseTimer: null,
    hitDuringStun: false,
  }]
  
  aiFood.value = { x: 10, y: 5 }
  
  if (aiTimer) clearInterval(aiTimer)
  aiTimer = setInterval(moveAISnake, BASE_SPEED / 0.6)
}

const moveAISnake = () => {
  if (gameStatus.value !== 'playing') return

  const ai = aiSnakes.value[0]
  if (!ai) return

  if (ai.stunned) return
  
  if (ai.paused) {
    if (ai.pauseStepCount % 2 === 1) {
      ai.pauseStepCount++
      return
    }
    ai.pauseStepCount++
  }

  ai.direction = getAIDirection(ai.positions, aiFood.value, ai.direction)
  const result = moveSnake(ai.positions, aiFood.value, ai.direction, false)
  
  if (result.ate) {
    score.value = Math.max(0, score.value - 10)
    aiFood.value = { x: -1, y: -1 }
    
    if (tutorialStep.value === 'aiEat') {
      tutorialStep.value = 'noFood'
      showHint.value = '敵蛇沒有食物，正在前進...'
      
      setTimeout(() => {
        tutorialStep.value = 'showDefender'
        showHint.value = '按空白鍵召喚守護蛇！'
      }, 1500)
    }
  }
}

const activateDefender = () => {
  if (tutorialStep.value !== 'showDefender' && tutorialStep.value !== 'useDefender') return
  if (defenderActive.value) return

  const head = snake.value[0]!
  defenderSnake.value = [
    { x: head.x + 1, y: head.y },
  ]
  defenderDirection.value = 'RIGHT'
  defenderActive.value = true
  tutorialStep.value = 'useDefender'

  if (defenderTimer) clearInterval(defenderTimer)
  defenderTimer = setInterval(moveDefenderSnake, BASE_SPEED / 1.5)
}

const moveDefenderSnake = () => {
  if (gameStatus.value !== 'playing' || !defenderActive.value) return

  const ai = aiSnakes.value[0]
  if (!ai) return

  defenderDirection.value = getDefenderTargetDirection(defenderSnake.value, aiSnakes.value)
  
  moveSnake(defenderSnake.value, { x: -1, y: -1 }, defenderDirection.value, false)

  const defenderHead = defenderSnake.value[0]!
  const aiHead = ai.positions[0]!

  if (defenderHead.x === aiHead.x && defenderHead.y === aiHead.y) {
    if (ai.stunned) {
      ai.hitDuringStun = true
    } else {
      ai.stunned = true
      if (ai.stunTimer) clearTimeout(ai.stunTimer)
      ai.stunTimer = setTimeout(() => {
        ai.stunned = false
        if (ai.hitDuringStun) {
          ai.paused = true
          ai.pauseStepCount = 0
          ai.hitDuringStun = false
          ai.pauseTimer = setTimeout(() => {
            ai.paused = false
            ai.pauseStepCount = 0
          }, 3000)
        }
      }, 1000)
    }
    
    defenderActive.value = false
    defenderSnake.value = []
    if (defenderTimer) {
      clearInterval(defenderTimer)
      defenderTimer = null
    }
    
    showHint.value = '教學完成！'
    setTimeout(() => {
      showCompletionModal.value = true
    }, 2000)
  }
}

const getCellType = (index: number): string | null => {
  const x = (index - 1) % GRID_WIDTH
  const y = Math.floor((index - 1) / GRID_WIDTH)

  for (const ai of aiSnakes.value) {
    const aiHead = ai.positions[0]!
    if (aiHead.x === x && aiHead.y === y) {
      return 'ai-head'
    }
    for (const seg of ai.positions) {
      if (seg.x === x && seg.y === y) return 'ai-snake'
    }
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
  if (aiFood.value.x === x && aiFood.value.y === y) return 'ai-food'
  
  return null
}

const changeDirection = (newDir: Direction) => {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  if (newDir !== opposites[direction.value]) {
    pendingDirection = newDir
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === ' ') {
    e.preventDefault()
    activateDefender()
    return
  }

  const map: Record<string, Direction> = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  }
  const dir = map[e.key]
  if (dir) {
    e.preventDefault()
    changeDirection(dir)
  }
}

const goToMenu = () => {
  showCompletionModal.value = false
  emit('complete', 'menu')
}

const startGame = () => {
  showCompletionModal.value = false
  emit('complete', 'game')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  showHint.value = '使用方向鍵移動, 並吃到下半部的紅色果子'
  
  if (gameTimer) clearInterval(gameTimer)
  gameTimer = setInterval(movePlayer, BASE_SPEED)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (gameTimer) clearInterval(gameTimer)
  if (aiTimer) clearInterval(aiTimer)
  if (defenderTimer) clearInterval(defenderTimer)
})
</script>

<template>
  <div class="snake-game">
    <div class="header">
      <h1>🐍 教學關卡</h1>
      <div class="score">分數：{{ score }}</div>
    </div>

    <div class="hint">{{ showHint }}</div>

    <div class="grid-container">
      <div
        v-for="i in GRID_WIDTH * GRID_HEIGHT"
        :key="i"
        class="cell"
        :class="getCellType(i)"
      ></div>
    </div>

    <div class="info">
      <template v-if="tutorialStep === 'move'">按方向鍵移動吃食物</template>
      <template v-else-if="tutorialStep === 'aiSpawn'">敵蛇即將出現...</template>
      <template v-else-if="tutorialStep === 'aiEat'">敵蛇正在進食...</template>
      <template v-else-if="tutorialStep === 'noFood'">敵蛇沒有食物，正在前進...</template>
      <template v-else-if="tutorialStep === 'showDefender'">按空白鍵召喚守護蛇！</template>
      <template v-else-if="tutorialStep === 'useDefender'">守護蛇出擊！</template>
      <template v-else-if="tutorialStep === 'complete'">教學完成！</template>
    </div>

    <div v-if="showCompletionModal" class="modal-overlay">
      <div class="modal">
        <h2>教學完成！</h2>
        <div class="modal-buttons">
          <button @click="goToMenu">返回主畫面</button>
          <button @click="startGame">開始遊戲</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  padding: 40px 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f4fd 0%, #b3d9f2 100%);
}

.header {
  display: flex;
  align-items: center;
  gap: 32px;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 28px;
  color: #1a5276;
}

.score {
  font-size: 24px;
  font-weight: bold;
  color: #27ae60;
}

.hint {
  font-size: 20px;
  color: #1a5276;
  margin-bottom: 16px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
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

.cell.ai-food {
  background-color: #e67e22;
  border-radius: 50%;
  border: 2px dashed #d35400;
}

.info {
  margin-top: 16px;
  font-size: 14px;
  color: #2c7bb6;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: white;
  padding: 32px 48px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  font-size: 28px;
  color: #1a5276;
  margin-bottom: 24px;
}

.modal-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.modal-buttons button {
  padding: 12px 32px;
  font-size: 18px;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #27ae60, #1a7a3a);
  color: white;
  transition: transform 0.2s;
  width: 200px;
}

.modal-buttons button:hover {
  transform: scale(1.05);
}
</style>