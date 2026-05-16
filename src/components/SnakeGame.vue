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

interface AISnake {
  positions: Position[]
  direction: Direction
  stunned: boolean
  paused: boolean
  pauseStepCount: number
  stunTimer: ReturnType<typeof setTimeout> | null
  pauseTimer: ReturnType<typeof setTimeout> | null
  hitDuringStun: boolean
  slowed: boolean
  slowMultiplier: number
  slowTimer: ReturnType<typeof setTimeout> | null
}

const aiSnakes = ref<AISnake[]>([])
let aiTimers: ReturnType<typeof setInterval>[] = []

// 技能等级系统
const defenderSkill = ref({
  level: 1,
  unlocked: true
})

const lightningSkill = ref({
  level: 0,
  unlocked: false,
  cooldown: 0
})

const iceSkill = ref({
  level: 0,
  unlocked: false,
  cooldown: 0
})
const ICE_COOLDOWN = 5000
const iceActive = ref(false)
let iceDurationTimer: ReturnType<typeof setTimeout> | null = null
let iceCooldownTimer: ReturnType<typeof setInterval> | null = null

const defenderSnake: Ref<Position[]> = ref([])
const defenderSnake2: Ref<Position[]> = ref([])
const defenderActive = ref(false)
const defenderActive2 = ref(false)
const defenderCooldown = ref(0)
const DEFENDER_COOLDOWN = 5000
let defenderTimer: ReturnType<typeof setInterval> | null = null
let defenderTimer2: ReturnType<typeof setInterval> | null = null
let defenderCooldownTimer: ReturnType<typeof setInterval> | null = null

// 升级卡牌系统
const showSkillCards = ref(false)
const availableSkills = ref<{ key: string; name: string; desc: string; isUnlock: boolean }[]>([])

const food: Ref<Position> = ref({ x: 15, y: 10 })

const direction: Ref<Direction> = ref('RIGHT')
const defenderDirection: Ref<Direction> = ref('RIGHT')

const AI_SPEED_MULTIPLIER = 0.6
const STUN_DURATION = 2000

// 玩家速度加成（闪电技能触发时）
let playerSpeedMultiplier = 1.0
let playerSpeedBoostTimer: ReturnType<typeof setTimeout> | null = null
const playerSpeedBoosted = ref(false)

// 闪电技能
const LIGHTNING_COOLDOWN = 5000
const lightningActive = ref(false)
const lightningPosition = ref<Position | null>(null)
const lightningPhase = ref<'none' | 'warning' | 'strike'>('none')
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

function generateAvailableSkills(): void {
  availableSkills.value = []
  
  // 检查是否需要添加新的 AI 蛇
  const playerLevel = Math.floor(eatenCount.value / 5) + 1
  const targetAICount = Math.floor((playerLevel - 1) / 3) + 1
  
  while (aiSnakes.value.length < targetAICount) {
    const newSnake = createAISnake()
    aiSnakes.value.push(newSnake)
    const aiSpeed = currentSpeed() / AI_SPEED_MULTIPLIER
    aiTimers.push(setInterval(() => moveAISnake(aiSnakes.value.length - 1), aiSpeed))
  }
  
  // 守护蛇升级选项
  if (defenderSkill.value.level < 3) {
    const nextLevel = defenderSkill.value.level + 1
    let desc = ''
    if (nextLevel === 2) {
      desc = '守護蛇速度加快'
    } else if (nextLevel === 3) {
      desc = '召喚兩隻蛇，若眩暈時再次撞擊，則眩暈完使敵人<span class="tooltip-text">停頓</span>'
    }
    availableSkills.value.push({
      key: 'defender',
      name: '守護蛇',
      desc: desc,
      isUnlock: false
    })
  }
  
  // 闪电解锁选项
  if (lightningSkill.value.level === 0) {
    availableSkills.value.push({
      key: 'lightning',
      name: '閃電',
      desc: '4×4 範圍，預警2秒後雷擊，敵人眩暈，玩家加速',
      isUnlock: true
    })
  }
  
  // 闪电升级选项
  if (lightningSkill.value.level > 0 && lightningSkill.value.level < 3) {
    const nextLevel = lightningSkill.value.level + 1
    let desc = ''
    if (nextLevel === 2) {
      desc = '眩暈時間延長，玩家加速倍率提高'
    } else if (nextLevel === 3) {
      desc = '範圍擴大'
    }
    availableSkills.value.push({
      key: 'lightning',
      name: '閃電',
      desc: desc,
      isUnlock: false
    })
}
   
  // 冰冻解锁选项
  if (iceSkill.value.level === 0) {
    availableSkills.value.push({
      key: 'ice',
      name: '冰凍',
      desc: '生成冰凍領域，減速敵人',
      isUnlock: true
    })
  }
   
  // 冰冻升级选项
  if (iceSkill.value.level > 0 && iceSkill.value.level < 3) {
    const nextLevel = iceSkill.value.level + 1
    const desc = nextLevel === 2 ? '減速效果增強' : '範圍擴大'
    availableSkills.value.push({
      key: 'ice',
      name: '冰凍',
      desc: desc,
      isUnlock: false
    })
  }
   
  // 填充分数+100选项到3个
  while (availableSkills.value.length < 3) {
    availableSkills.value.push({
      key: 'score',
      name: '分數+100',
      desc: '獲得 100 分',
      isUnlock: false
    })
  }
}

function selectSkill(skillKey: string): void {
  if (skillKey === 'defender') {
    defenderSkill.value.level++
  } else if (skillKey === 'lightning') {
    if (lightningSkill.value.level === 0) {
      lightningSkill.value.level = 1
      lightningSkill.value.unlocked = true
    } else {
      lightningSkill.value.level++
    }
  } else if (skillKey === 'score') {
    score.value += 100
  } else if (skillKey === 'ice') {
    if (iceSkill.value.level === 0) {
      iceSkill.value.level = 1
      iceSkill.value.unlocked = true
    } else {
      iceSkill.value.level++
    }
  }
  
  showSkillCards.value = false
  gameStatus.value = 'playing'
  gameLoop()
}

function getCellType(index: number): 'snake' | 'head' | 'food' | 'ai-snake' | 'ai-head' | 'defender-snake' | 'defender-head' | 'lightning-warning' | 'lightning-strike' | 'snake-boosted' | 'head-boosted' | 'ai-snake-slowed' | 'ai-head-slowed' | 'ice-field' | null {
  const x = (index - 1) % GRID_WIDTH
  const y = Math.floor((index - 1) / GRID_WIDTH)

  for (const ai of aiSnakes.value) {
    const aiHead = ai.positions[0]!
    if (aiHead.x === x && aiHead.y === y) return ai.slowed ? 'ai-head-slowed' : 'ai-head'
    for (const seg of ai.positions) {
      if (seg.x === x && seg.y === y) return ai.slowed ? 'ai-snake-slowed' : 'ai-snake'
    }
  }

  if (defenderActive.value) {
    const defenderHead = defenderSnake.value[0]!
    if (defenderHead.x === x && defenderHead.y === y) return 'defender-head'
    for (const seg of defenderSnake.value) {
      if (seg.x === x && seg.y === y) return 'defender-snake'
    }
  }

  if (defenderActive2.value) {
    const defenderHead2 = defenderSnake2.value[0]!
    if (defenderHead2.x === x && defenderHead2.y === y) return 'defender-head'
    for (const seg of defenderSnake2.value) {
      if (seg.x === x && seg.y === y) return 'defender-snake'
    }
  }

  const head = snake.value[0]!
  if (head.x === x && head.y === y) return playerSpeedBoosted.value ? 'head-boosted' : 'head'
  for (const seg of snake.value) {
    if (seg.x === x && seg.y === y) return playerSpeedBoosted.value ? 'snake-boosted' : 'snake'
  }
  
  if (food.value.x === x && food.value.y === y) return 'food'
  
  // 冰冻效果渲染（跟随玩家蛇头，在食物之后）
  if (iceActive.value) {
    const iceSize = iceSkill.value.level >= 3 ? 5 : 3
    const halfSize = Math.floor(iceSize / 2)
    if (x >= head.x - halfSize && x <= head.x + halfSize &&
        y >= head.y - halfSize && y <= head.y + halfSize) {
      return 'ice-field'
    }
  }
  
  // 闪电效果渲染（最后，在最上层）
  if (lightningActive.value && lightningPosition.value && lightningPhase.value !== 'none') {
    const lx = lightningPosition.value.x
    const ly = lightningPosition.value.y
    const lightningSize = lightningSkill.value.level >= 3 ? 5 : 4
    if (x >= lx && x < lx + lightningSize && y >= ly && y < ly + lightningSize) {
      if (lightningPhase.value === 'warning') return 'lightning-warning'
      if (lightningPhase.value === 'strike') return 'lightning-strike'
    }
  }
  
  return null
}

function createAISnake(): AISnake {
  const startX = Math.floor(Math.random() * (GRID_WIDTH - 3))
  const startY = Math.floor(Math.random() * GRID_HEIGHT)
  return {
    positions: [
      { x: startX, y: startY },
      { x: startX + 1, y: startY },
      { x: startX + 2, y: startY },
    ],
    direction: 'LEFT',
    stunned: false,
    paused: false,
    pauseStepCount: 0,
    stunTimer: null,
    pauseTimer: null,
    hitDuringStun: false,
    slowed: false,
    slowMultiplier: 1.0,
    slowTimer: null,
  }
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
    const prevLevel = Math.floor((eatenCount.value - 1) / 5)
    const currentLevel = Math.floor(eatenCount.value / 5)
    if (currentLevel > prevLevel && gameTimer !== null) {
      clearInterval(gameTimer)
      gameTimer = setInterval(move, currentSpeed())
      // 触发技能卡牌选择
      gameStatus.value = 'paused'
      if (gameTimer !== null) {
        clearInterval(gameTimer)
        gameTimer = null
      }      
      showSkillCards.value = true
      generateAvailableSkills()
    }
    food.value = generateFood([...snake.value, ...aiSnakes.value.flatMap(s => s.positions)])
  }

  // 自动释放闪电技能（已解锁，CD 完毕）
  if (lightningSkill.value.level > 0 && lightningSkill.value.cooldown <= 0 && !lightningActive.value) {
    activateLightning()
  }
  
  // 自动释放冰冻技能（已解锁，CD 完毕）
  if (iceSkill.value.level > 0 && iceSkill.value.cooldown <= 0 && !iceActive.value) {
    activateIce()
  }
}

function activateLightning(): void {
  if (lightningActive.value || lightningSkill.value.cooldown > 0) return

  const lightningSize = lightningSkill.value.level >= 3 ? 5 : 4
  const lx = Math.floor(Math.random() * (GRID_WIDTH - lightningSize))
  const ly = Math.floor(Math.random() * (GRID_HEIGHT - lightningSize))
  lightningPosition.value = { x: lx, y: ly }
  lightningActive.value = true
  lightningPhase.value = 'warning'

  if (lightningWarningTimer !== null) clearTimeout(lightningWarningTimer)
  lightningWarningTimer = setTimeout(() => {
    lightningPhase.value = 'strike'

    const playerHit = snake.value.some(seg => 
      seg.x >= lx && seg.x < lx + lightningSize && seg.y >= ly && seg.y < ly + lightningSize
    )

    if (playerHit) {
      playerSpeedMultiplier = lightningSkill.value.level >= 2 ? 1.5 : 1.2
      playerSpeedBoosted.value = true
      if (playerSpeedBoostTimer !== null) clearTimeout(playerSpeedBoostTimer)
      playerSpeedBoostTimer = setTimeout(() => {
        playerSpeedMultiplier = 1.0
        playerSpeedBoosted.value = false
      }, 3000)
    }

    for (const ai of aiSnakes.value) {
      const isHit = ai.positions.some(seg => 
        seg.x >= lx && seg.x < lx + lightningSize && seg.y >= ly && seg.y < ly + lightningSize
      )
      if (isHit) {
        ai.stunned = true
        if (ai.stunTimer) clearTimeout(ai.stunTimer)
        ai.stunTimer = setTimeout(() => {
          ai.stunned = false
        }, lightningSkill.value.level >= 2 ? 4000 : 3000)
      }
    }

    if (lightningStrikeTimer !== null) clearTimeout(lightningStrikeTimer)
    lightningStrikeTimer = setTimeout(() => {
      lightningActive.value = false
      lightningPosition.value = null
      lightningPhase.value = 'none'

      lightningSkill.value.cooldown = LIGHTNING_COOLDOWN
      if (lightningCooldownTimer !== null) clearInterval(lightningCooldownTimer)
      lightningCooldownTimer = setInterval(() => {
        lightningSkill.value.cooldown -= 100
        if (lightningSkill.value.cooldown <= 0) {
          lightningSkill.value.cooldown = 0
          if (lightningCooldownTimer !== null) {
            clearInterval(lightningCooldownTimer)
            lightningCooldownTimer = null
          }
        }
      }, 100)
    }, 300)
  }, 2000)
}

function activateIce(): void {
  if (iceActive.value || iceSkill.value.cooldown > 0) return

  iceActive.value = true

  if (iceDurationTimer) clearTimeout(iceDurationTimer)
  iceDurationTimer = setTimeout(() => {
    iceActive.value = false

    iceSkill.value.cooldown = ICE_COOLDOWN
    if (iceCooldownTimer) clearInterval(iceCooldownTimer)
    iceCooldownTimer = setInterval(() => {
      iceSkill.value.cooldown -= 100
      if (iceSkill.value.cooldown <= 0) {
        iceSkill.value.cooldown = 0
        if (iceCooldownTimer) {
          clearInterval(iceCooldownTimer)
          iceCooldownTimer = null
        }
      }
    }, 100)
  }, 3000)
}

function changeDirection(newDir: Direction): void {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  if (newDir !== opposites[direction.value]) {
    pendingDirection = newDir
  }
}

function moveAISnake(index: number): void {
  if (gameStatus.value !== 'playing') return
  
  const ai = aiSnakes.value[index]
  if(!ai)  return
  
  // 冰冻减速逻辑（移到眩晕检查之前，这样眩晕时也能减速）
  if (iceActive.value) {
    const playerHead = snake.value[0]!
    const iceSize = iceSkill.value.level >= 3 ? 5 : 3
    const halfSize = Math.floor(iceSize / 2)

    // 检查 AI 蛇任意部位是否在冰冻范围内
    const inIceRange = ai.positions.some(seg => {
      const dx = Math.abs(seg.x - playerHead.x)
      const dy = Math.abs(seg.y - playerHead.y)
      return dx <= halfSize && dy <= halfSize
    })
    
    if (inIceRange) {
      ai.slowMultiplier = iceSkill.value.level >= 2 ? 0.5 : 0.7
      ai.slowed = true
      if (ai.slowTimer) {
        clearTimeout(ai.slowTimer)
        ai.slowTimer = null
      }
    } else if (ai.slowed && !ai.slowTimer) {
      ai.slowMultiplier = iceSkill.value.level >= 2 ? 0.7 : 0.8
      ai.slowTimer = setTimeout(() => {
        ai.slowMultiplier = 1.0
        ai.slowed = false
        ai.slowTimer = null
      }, 3000)
    }
  }

  if (ai.stunned) return
  
  if (ai.paused) {
    if (ai.pauseStepCount % 2 === 1) {
      ai.pauseStepCount++
      return
    }
    ai.pauseStepCount++
  }

  // 重新设置定时器间隔（动态调整速度）
  if (aiTimers[index]) {
    clearInterval(aiTimers[index])
  }
  const newSpeed = currentSpeed() / AI_SPEED_MULTIPLIER / ai.slowMultiplier
  aiTimers[index] = setInterval(() => moveAISnake(index), newSpeed)

  ai.direction = getAIDirection(ai.positions, food.value, ai.direction)
  const aiResult = moveSnake(ai.positions, food.value, ai.direction, false)

  if (aiResult.ate) {
    score.value = Math.max(0, score.value - 10)
    const allAISnakePositions = aiSnakes.value.flatMap(s => s.positions)
    food.value = generateFood([...snake.value, ...allAISnakePositions])
  }
}

function getDefenderTargetDirection(defender: Position[], targets: AISnake[]): Direction {
  if (targets.length === 0) return 'RIGHT'
  
  const head = defender[0]!
  
  // 找到最近的 AI 蛇
  let nearestTarget = targets[0]!
  let minDist = Infinity
  
  for (const target of targets) {
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

  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }

  for (const dir of candidates) {
    if (dir === opposites[defenderDirection.value]) continue

    const next = { x: head.x, y: head.y }
    if (dir === 'UP') next.y--
    if (dir === 'DOWN') next.y++
    if (dir === 'LEFT') next.x--
    if (dir === 'RIGHT') next.x++

    next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
    next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT

    const allSnakes = [...snake.value, ...aiSnakes.value.flatMap(s => s.positions), ...defender]
    if (!allSnakes.some(seg => seg.x === next.x && seg.y === next.y)) {
      return dir
    }
  }

  return candidates[0]!
}

function moveDefenderSnake(): void {
  if (gameStatus.value !== 'playing' || !defenderActive.value) return

  defenderDirection.value = getDefenderTargetDirection(defenderSnake.value, aiSnakes.value)

  moveSnake(defenderSnake.value, { x: -1, y: -1 }, defenderDirection.value, false)

  const defenderHead = defenderSnake.value[0]!
  for (const ai of aiSnakes.value) {
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
        }, STUN_DURATION)
      }
      
      defenderActive.value = false
      defenderSnake.value = []
      if (defenderTimer !== null) {
        clearInterval(defenderTimer)
        defenderTimer = null
      }
      break
    }
  }
}

const defenderDirection2 = ref<Direction>('LEFT')

function moveDefenderSnake2(): void {
  if (gameStatus.value !== 'playing' || !defenderActive2.value) return

  defenderDirection2.value = getDefenderTargetDirection(defenderSnake2.value, aiSnakes.value)

  moveSnake(defenderSnake2.value, { x: -1, y: -1 }, defenderDirection2.value, false)

  const defenderHead = defenderSnake2.value[0]!
  for (const ai of aiSnakes.value) {
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
        }, STUN_DURATION)
      }
      
      defenderActive2.value = false
      defenderSnake2.value = []
      if (defenderTimer2 !== null) {
        clearInterval(defenderTimer2)
        defenderTimer2 = null
      }
      break
    }
  }
}

function activateDefender(): void {
  if (defenderActive.value || defenderCooldown.value || gameStatus.value !== 'playing') return

  const head = snake.value[0]!
  const speedMultiplier = defenderSkill.value.level >= 2 ? 2.0 : 1.5
  
  // 第一只守护蛇（右侧）
  defenderSnake.value = [
    { x: head.x + 1, y: head.y },
  ]
  defenderDirection.value = 'RIGHT'
  defenderActive.value = true

  if (defenderTimer !== null) clearInterval(defenderTimer)
  const defenderSpeed = BASE_SPEED / speedMultiplier
  defenderTimer = setInterval(moveDefenderSnake, defenderSpeed)

  // Lv.3 第二只守护蛇（左侧）
  if (defenderSkill.value.level >= 3) {
    defenderSnake2.value = [
      { x: head.x - 1, y: head.y },
    ]
    defenderActive2.value = true
    if (defenderTimer2 !== null) clearInterval(defenderTimer2)
    defenderTimer2 = setInterval(moveDefenderSnake2, defenderSpeed)
  }

  setTimeout(() => {
    defenderActive.value = false
    defenderSnake.value = []
    if (defenderTimer !== null) {
      clearInterval(defenderTimer)
      defenderTimer = null
    }
    defenderActive2.value = false
    defenderSnake2.value = []
    if (defenderTimer2 !== null) {
      clearInterval(defenderTimer2)
      defenderTimer2 = null
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
  gameTimer = setInterval(move, currentSpeed())
}

function startGame(): void {
  playerSpeedBoosted.value = false
  
  // 重置技能等级
  defenderSkill.value.level = 1
  lightningSkill.value.level = 0
  lightningSkill.value.cooldown = 0
  iceSkill.value.level = 0
  iceSkill.value.cooldown = 0
  iceActive.value = false
  
  if (gameTimer !== null) clearInterval(gameTimer)
  for (const timer of aiTimers) {
    if (timer) clearInterval(timer)
  }
  aiTimers = []
  
  snake.value = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]
  aiSnakes.value = [createAISnake()]
  direction.value = 'RIGHT'
  score.value = 0
  eatenCount.value = 0
  
  const allAISnakePositions = aiSnakes.value.flatMap(s => s.positions)
  food.value = generateFood([...snake.value, ...allAISnakePositions])
  gameStatus.value = 'playing'
  gameLoop()
  startAllAITimers()
}

function startAllAITimers(): void {
  for (const timer of aiTimers) {
    if (timer) clearInterval(timer)
  }
  aiTimers = []
  
  const aiSpeed = currentSpeed() / AI_SPEED_MULTIPLIER
  for (let i = 0; i < aiSnakes.value.length; i++) {
    aiTimers.push(setInterval(() => moveAISnake(i), aiSpeed))
  }
}

function togglePause(): void {
  if (gameStatus.value === 'playing') {
    gameStatus.value = 'paused'
    if (gameTimer !== null) {
      clearInterval(gameTimer)
      gameTimer = null
    }
    for (const timer of aiTimers) {
      if (timer) clearInterval(timer)
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
    startAllAITimers()
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
    if (lightningSkill.value.cooldown > 0 && lightningCooldownTimer === null) {
      lightningCooldownTimer = setInterval(() => {
        lightningSkill.value.cooldown -= 100
        if (lightningSkill.value.cooldown <= 0) {
          lightningSkill.value.cooldown = 0
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
          <span class="skill-level">{{ defenderSkill.level }}</span>
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

      <div v-if="lightningSkill.level > 0" class="skill-icon" :class="{ cooling: lightningSkill.cooldown > 0 }">
        <div class="skill-content">
          <span class="lightning-emoji">⚡</span>
          <span class="skill-level">{{ lightningSkill.level }}</span>
        </div>
        <svg class="cooldown-ring" viewBox="0 0 36 36">
          <circle class="cooldown-bg" cx="18" cy="18" r="16" />
          <circle 
            class="cooldown-progress" 
            cx="18" 
            cy="18" 
            r="16"
            :style="{ 
              strokeDashoffset: lightningSkill.cooldown > 0 ? (lightningSkill.cooldown / LIGHTNING_COOLDOWN) * 100 : 0 
            }"
          />
        </svg>
      </div>

      <div v-if="iceSkill.level > 0" class="skill-icon" :class="{ cooling: iceSkill.cooldown > 0 }">
        <div class="skill-content">
          <span class="ice-emoji">❄️</span>
          <span class="skill-level">{{ iceSkill.level }}</span>
        </div>
        <svg class="cooldown-ring" viewBox="0 0 36 36">
          <circle class="cooldown-bg" cx="18" cy="18" r="16" />
          <circle 
            class="cooldown-progress" 
            cx="18" 
            cy="18" 
            r="16"
            :style="{ 
              strokeDashoffset: iceSkill.cooldown > 0 ? (iceSkill.cooldown / ICE_COOLDOWN) * 100 : 0 
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

    <div class="overlay skill-card-overlay" :class="{ visible: showSkillCards }">
      <div class="skill-card-content">
        <h2>選擇技能</h2>
        <div class="skill-cards">
          <div 
            v-for="skill in availableSkills" 
            :key="skill.key"
            class="skill-card"
            @click="selectSkill(skill.key)"
          >
            <h3>{{ skill.name }}</h3>
            <p class="skill-action">{{ skill.isUnlock ? '解鎖' : '升級' }}</p>
            <p class="skill-desc" v-html="skill.desc"></p>
          </div>
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

.skill-level {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 12px;
  font-weight: bold;
  color: #1a5276;
  background: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightning-emoji {
  font-size: 24px;
}

.ice-emoji {
  font-size: 24px;
}

.skill-icon.cooling .lightning-emoji {
  opacity: 0.3;
}

.skill-icon.cooling .ice-emoji {
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

.cell.snake-boosted {
  background-color: #27ae60;
  box-shadow: 0 0 8px 3px #f39c12;
}

.cell.head-boosted {
  background-color: #1a7a3a;
  box-shadow: 0 0 10px 4px #f39c12;
}

.cell.ai-snake {
  background-color: #f5b7b1;
}

.cell.ai-head {
  background-color: #e74c3c;
}

.cell.ai-snake-slowed {
  background-color: #f5b7b1;
  box-shadow: 0 0 8px 3px #87ceeb;
}

.cell.ai-head-slowed {
  background-color: #e74c3c;
  box-shadow: 0 0 10px 4px #87ceeb;
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

.cell.ice-field {
  background-color: rgba(173, 216, 230, 0.5);
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

.skill-card-overlay .skill-card-content {
  background: #f0f8ff;
  padding: 32px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.skill-card-overlay h2 {
  margin: 0 0 24px;
  color: #1a5276;
  font-size: 24px;
}

.skill-cards {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.skill-card {
  background: linear-gradient(135deg, #fff, #e8f4fd);
  border: 2px solid #7fb3d8;
  border-radius: 12px;
  padding: 20px;
  width: 180px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.skill-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.skill-card h3 {
  margin: 0 0 8px;
  color: #1a5276;
  font-size: 18px;
}

.skill-card .skill-action {
  color: #27ae60;
  font-weight: bold;
  font-size: 14px;
  margin: 0 0 8px;
}

.skill-card .skill-desc {
  color: #666;
  font-size: 13px;
  margin: 0;
  line-height: 1.4;
}

.skill-card .skill-desc :deep(.tooltip-text) {
  text-decoration: underline;
  cursor: help;
  position: relative;
}

.skill-card .skill-desc :deep(.tooltip-text):hover::after {
  content: '敵人會走一步停一步';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 10;
}
</style>
