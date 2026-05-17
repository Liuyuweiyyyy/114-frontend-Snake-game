<script setup lang="ts">
import { ref, type Ref } from 'vue'
import { useLeaderboard } from '../composables/useLeaderboard'

const emit = defineEmits<{
  (e: 'goMenu'): void
}>()

const GRID_WIDTH = 20
const GRID_HEIGHT = 20

interface Position {
  x: number
  y: number
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type GameStatus = 'idle' | 'playing' | 'paused' | 'levelup' | 'gameover'
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
  frozen: boolean
  frozenTimer: ReturnType<typeof setTimeout> | null
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

const thunderDragonSkill = ref({
  level: 0,
  unlocked: false,
  cooldown: 0
})
interface ChainLightning {
  key: string
  position: Position
  phase: 'warning' | 'strike'
  warningTimer: ReturnType<typeof setTimeout> | null
  strikeTimer: ReturnType<typeof setTimeout> | null
}

const chainLightnings = ref<ChainLightning[]>([])

// 極寒領主技能
const FROST_LORD_COOLDOWN = 5000
const frostLordSkill = ref({ level: 0, unlocked: false, cooldown: 0 })
let frostLordCooldownTimer: ReturnType<typeof setInterval> | null = null

const frostLordActive = ref(false)
let frostLordDurationTimer: ReturnType<typeof setTimeout> | null = null

const frostLordSnake = ref<Position[]>([])
let frostLordAngle = 0
let frostLordMoveTimer: ReturnType<typeof setInterval> | null = null

interface FrostLordPath {
  position: Position
  timer: ReturnType<typeof setTimeout>
}
const frostLordPath = ref<FrostLordPath[]>([])

// 凜冬雷暴技能
const STORM_COOLDOWN = 5000
const stormSkill = ref({ level: 0, unlocked: false, cooldown: 0 })
let stormCooldownTimer: ReturnType<typeof setInterval> | null = null

const stormActive = ref(false)
let stormDurationTimer: ReturnType<typeof setTimeout> | null = null

const stormSnake = ref<{ position: Position; direction: Direction; length: number }[]>([])
let stormMoveTimer: ReturnType<typeof setInterval> | null = null

// 混亂狀態
const confusedAIs = ref<Set<string>>(new Set())
const confusionTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

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

// 天譴之龍技能
const THUNDER_DRAGON_COOLDOWN = 5000
let thunderCooldownTimer: ReturnType<typeof setInterval> | null = null
const thunderDragons = ref<{ position: Position; direction: Direction }[]>([])
let thunderDragonTimers: ReturnType<typeof setInterval>[] = []
const aiHitCounts = ref<Map<string, number>>(new Map())

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
const { leaderboard, loadLeaderboard, addScore, clearLeaderboard } = useLeaderboard()
const spacePressCount = ref(0)
const rPressCount = ref(0)

function saveScore(): void {
  addScore(playerName.value, score.value)
  gameStatus.value = 'idle'
  playerName.value = ''
}

function saveScoreAndRestart(): void {
  addScore(playerName.value, score.value)
  playerName.value = ''
  spacePressCount.value = 0
  rPressCount.value = 0
  resetGame()
  gameStatus.value = 'idle'
}

function goToMenu(): void {
  addScore(playerName.value, score.value)
  gameStatus.value = 'idle'
  playerName.value = ''
  spacePressCount.value = 0
  emit('goMenu')
}

function generateAvailableSkills(): void {
  availableSkills.value = []
  
  // 检查是否需要添加新的 AI 蛇
  const playerLevel = Math.floor(eatenCount.value / 5) + 1
  const targetAICount = Math.floor((playerLevel - 1) / 4) + 1
  
  while (aiSnakes.value.length < targetAICount && aiSnakes.value.length < 5) {
    const newSnake = createAISnake()
    aiSnakes.value.push(newSnake)
    const aiSpeed = currentSpeed() / AI_SPEED_MULTIPLIER
    aiTimers.push(setInterval(() => moveAISnake(aiSnakes.value.length - 1), aiSpeed))
  }
  
  // 守护蛇升级选项（天譴之龍/極寒領主解鎖後隱藏）
  if (defenderSkill.value.level < 3 && !thunderDragonSkill.value.unlocked && !frostLordSkill.value.unlocked) {
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
  
  // 闪电解锁选项（天譴之龍/凜冬雷暴解鎖後隱藏）
  if (lightningSkill.value.level === 0 && !thunderDragonSkill.value.unlocked && !stormSkill.value.unlocked) {
    availableSkills.value.push({
      key: 'lightning',
      name: '閃電',
      desc: '4×4 範圍，預警2秒後雷擊，敵人眩暈，玩家加速',
      isUnlock: true
    })
  }
  
  // 闪电升级选项（天譴之龍/凜冬雷暴解鎖後隱藏）
  if (lightningSkill.value.level > 0 && lightningSkill.value.level < 3 && !thunderDragonSkill.value.unlocked && !stormSkill.value.unlocked) {
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
   
// 冰冻解锁选项（極寒領主/凜冬雷暴解鎖後隱藏）
  if (iceSkill.value.level === 0 && !frostLordSkill.value.unlocked && !stormSkill.value.unlocked) {
    availableSkills.value.push({
      key: 'ice',
      name: '冰凍',
      desc: '生成冰凍領域，減速敵人',
      isUnlock: true
    })
  }
    
// 冰冻升级选项（極寒領主/凜冬雷暴解鎖後隱藏）
  if (iceSkill.value.level > 0 && iceSkill.value.level < 3 && !frostLordSkill.value.unlocked && !stormSkill.value.unlocked) {
    const nextLevel = iceSkill.value.level + 1
    const desc = nextLevel === 2 ? '減速效果增強' : '範圍擴大'
    availableSkills.value.push({
      key: 'ice',
      name: '冰凍',
      desc: desc,
      isUnlock: false
    })
  }
  
  // 天譴之龍解锁选项（守護蛇满级 + 閃電满级，且未解鎖凜冬雷暴）
  if (defenderSkill.value.level === 3 && lightningSkill.value.level === 3 && thunderDragonSkill.value.level === 0 && !stormSkill.value.unlocked) {
    availableSkills.value.push({
      key: 'thunderDragon',
      name: '天譴之龍',
      desc: '召喚6隻天譴之龍，撞擊效果依次眩暈→<span class="tooltip-text">停頓</span>→<span class="tooltip-text-chain">連續雷擊</span>',
      isUnlock: true
    })
  }
  
  // 極寒領主解锁选项（守護蛇满级 + 冰凍满级）
  if (defenderSkill.value.level === 3 && iceSkill.value.level === 3 && frostLordSkill.value.level === 0 && !stormSkill.value.unlocked) {
    availableSkills.value.push({
      key: 'frostLord',
      name: '極寒領主',
      desc: '召喚極寒領主，撞到敵人會造成冰凍，行進路線會形成<span class="tooltip-text-road">冰路</span>',
      isUnlock: true
    })
  }
  
  // 凜冬雷暴解锁选项（冰凍满级 + 閃電满级）
  if (iceSkill.value.level === 3 && lightningSkill.value.level === 3 && stormSkill.value.level === 0 && !thunderDragonSkill.value.unlocked && !frostLordSkill.value.unlocked) {
    availableSkills.value.push({
      key: 'storm',
      name: '凜冬雷暴',
      desc: '召喚雷暴，範圍內敵人會繞著風暴打轉，結束後敵人<span class="tooltip-text-confused">錯亂</span>',
      isUnlock: true
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
  } else if (skillKey === 'thunderDragon') {
    thunderDragonSkill.value.level = 1
    thunderDragonSkill.value.unlocked = true
  } else if (skillKey === 'frostLord') {
    frostLordSkill.value.level = 1
    frostLordSkill.value.unlocked = true
    frostLordSkill.value.cooldown = 0
    iceActive.value = false
    if (iceDurationTimer) clearTimeout(iceDurationTimer)
  } else if (skillKey === 'storm') {
    stormSkill.value.level = 1
    stormSkill.value.unlocked = true
    stormSkill.value.cooldown = 0
  }
  
  showSkillCards.value = false
  gameStatus.value = 'playing'
  gameLoop()
  
  // 重新啟動冷卻計時器
  if (lightningSkill.value.cooldown > 0 && lightningCooldownTimer === null) {
    lightningCooldownTimer = setInterval(() => {
      lightningSkill.value.cooldown -= 100
      if (lightningSkill.value.cooldown <= 0) {
        lightningSkill.value.cooldown = 0
        if (lightningCooldownTimer) {
          clearInterval(lightningCooldownTimer)
          lightningCooldownTimer = null
        }
      }
    }, 100)
  }
  if (iceSkill.value.cooldown > 0 && iceCooldownTimer === null) {
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
  }
  if (thunderDragonSkill.value.cooldown > 0 && thunderCooldownTimer === null) {
    thunderCooldownTimer = setInterval(() => {
      thunderDragonSkill.value.cooldown -= 100
      if (thunderDragonSkill.value.cooldown <= 0) {
        thunderDragonSkill.value.cooldown = 0
        if (thunderCooldownTimer) {
          clearInterval(thunderCooldownTimer)
          thunderCooldownTimer = null
        }
      }
    }, 100)
  }
  if (frostLordSkill.value.cooldown > 0 && frostLordCooldownTimer === null) {
    frostLordCooldownTimer = setInterval(() => {
      frostLordSkill.value.cooldown -= 100
      if (frostLordSkill.value.cooldown <= 0) {
        frostLordSkill.value.cooldown = 0
        if (frostLordCooldownTimer) {
          clearInterval(frostLordCooldownTimer)
          frostLordCooldownTimer = null
        }
      }
    }, 100)
  }
  if (stormSkill.value.cooldown > 0 && stormCooldownTimer === null) {
    stormCooldownTimer = setInterval(() => {
      stormSkill.value.cooldown -= 100
      if (stormSkill.value.cooldown <= 0) {
        stormSkill.value.cooldown = 0
        if (stormCooldownTimer) {
          clearInterval(stormCooldownTimer)
          stormCooldownTimer = null
        }
      }
    }, 100)
  }
}

function resumeFromLevelUp(): void {
  showSkillCards.value = false
  gameStatus.value = 'playing'
  gameLoop()
  
  // 重新啟動冷卻計時器
  if (lightningSkill.value.cooldown > 0 && lightningCooldownTimer === null) {
    lightningCooldownTimer = setInterval(() => {
      lightningSkill.value.cooldown -= 100
      if (lightningSkill.value.cooldown <= 0) {
        lightningSkill.value.cooldown = 0
        if (lightningCooldownTimer) {
          clearInterval(lightningCooldownTimer)
          lightningCooldownTimer = null
        }
      }
    }, 100)
  }
  if (iceSkill.value.cooldown > 0 && iceCooldownTimer === null) {
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
  }
  if (thunderDragonSkill.value.cooldown > 0 && thunderCooldownTimer === null) {
    thunderCooldownTimer = setInterval(() => {
      thunderDragonSkill.value.cooldown -= 100
      if (thunderDragonSkill.value.cooldown <= 0) {
        thunderDragonSkill.value.cooldown = 0
        if (thunderCooldownTimer) {
          clearInterval(thunderCooldownTimer)
          thunderCooldownTimer = null
        }
      }
    }, 100)
  }
  if (frostLordSkill.value.cooldown > 0 && frostLordCooldownTimer === null) {
    frostLordCooldownTimer = setInterval(() => {
      frostLordSkill.value.cooldown -= 100
      if (frostLordSkill.value.cooldown <= 0) {
        frostLordSkill.value.cooldown = 0
        if (frostLordCooldownTimer) {
          clearInterval(frostLordCooldownTimer)
          frostLordCooldownTimer = null
        }
      }
    }, 100)
  }
  if (stormSkill.value.cooldown > 0 && stormCooldownTimer === null) {
    stormCooldownTimer = setInterval(() => {
      stormSkill.value.cooldown -= 100
      if (stormSkill.value.cooldown <= 0) {
        stormSkill.value.cooldown = 0
        if (stormCooldownTimer) {
          clearInterval(stormCooldownTimer)
          stormCooldownTimer = null
        }
      }
    }, 100)
  }
}

function getCellType(index: number): 'snake' | 'head' | 'food' | 'ai-snake' | 'ai-head' | 'defender-snake' | 'defender-head' | 'lightning-warning' | 'lightning-strike' | 'snake-boosted' | 'head-boosted' | 'ai-snake-slowed' | 'ai-head-slowed' | 'ice-field' | 'thunder-dragon' | 'chain-lightning-warning' | 'chain-lightning-strike' | 'frost-lord-head'  | 'frost-lord-path'  | 'frost-lord-field' | 'storm-field' | 'storm-snake' | 'storm-head' | null {
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
  
  // 凜冬雷暴風暴蛇
  if (stormSnake.value.length > 0) {
    for (let i = stormSnake.value.length - 1; i >= 0; i--) {
      const seg = stormSnake.value[i]!
      if (seg.position.x === x && seg.position.y === y) {
        return i === 0 ? 'storm-head' : 'storm-snake'
      }
    }
  }
  
  // 极寒领主淡蓝色蛇头
  if (frostLordSnake.value.length > 0) {
    const head = frostLordSnake.value[0]!
    if (head.x === x && head.y === y) {
      return 'frost-lord-head'
    }
  }
  
  // 极寒领主白色路径
  for (const path of frostLordPath.value) {
    if (path.position.x === x && path.position.y === y) return 'frost-lord-path'
  }
  
  // 冰冻效果渲染
  if (iceActive.value && !stormSkill.value.unlocked) {
    const iceSize = iceSkill.value.level >= 3 ? 5 : 3
    const halfSize = Math.floor(iceSize / 2)
    if (x >= head.x - halfSize && x <= head.x + halfSize &&
        y >= head.y - halfSize && y <= head.y + halfSize) {
      return 'ice-field'
    }
  }
  
  // 极寒领主减速范围
  if (frostLordActive.value) {
    const frostHalfSize = 2
    if (x >= head.x - frostHalfSize && x <= head.x + frostHalfSize &&
        y >= head.y - frostHalfSize && y <= head.y + frostHalfSize) {
      return 'frost-lord-field'
    }
  }
    
  // 闪电效果渲染
  if (lightningActive.value && lightningPosition.value && lightningPhase.value !== 'none' && !stormSkill.value.unlocked) {
    const lx = lightningPosition.value.x
    const ly = lightningPosition.value.y
    const lightningSize = lightningSkill.value.level >= 3 ? 5 : 4
    if (x >= lx && x < lx + lightningSize && y >= ly && y < ly + lightningSize) {
      if (lightningPhase.value === 'warning') return 'lightning-warning'
      if (lightningPhase.value === 'strike') return 'lightning-strike'
    }
  }
  
  // 天譴之龍渲染
  for (const dragon of thunderDragons.value) {
    if (dragon.position.x === x && dragon.position.y === y) return 'thunder-dragon'
  }

  // 凜冬雷暴 5×5 範圍
  if (stormActive.value && stormSnake.value.length > 0) {
    const stormHead = stormSnake.value[0]!
    if (x >= stormHead.position.x - 2 && x <= stormHead.position.x + 2 &&
        y >= stormHead.position.y - 2 && y <= stormHead.position.y + 2) {
      return 'storm-field'
    }
  }
  
  // 连锁雷击渲染
  for (const cl of chainLightnings.value) {
    if (x >= cl.position.x && x < cl.position.x + 5 && y >= cl.position.y && y < cl.position.y + 5) {
      if (cl.phase === 'strike') return 'chain-lightning-strike'
      if (cl.phase === 'warning') return 'chain-lightning-warning'
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
    frozen: false,
    frozenTimer: null,
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
      playerSpeedMultiplier = 1.0
      playerSpeedBoosted.value = false
      if (playerSpeedBoostTimer) {
        clearTimeout(playerSpeedBoostTimer)
        playerSpeedBoostTimer = null
      }
      clearInterval(gameTimer)
      gameTimer = setInterval(move, currentSpeed())
      gameStatus.value = 'levelup'
      if (gameTimer !== null) {
        clearInterval(gameTimer)
        gameTimer = null
      }
      // 清除所有冷卻計時器（技能選擇時暫停冷卻）
      if (lightningCooldownTimer !== null) {
        clearInterval(lightningCooldownTimer)
        lightningCooldownTimer = null
      }
      if (iceCooldownTimer !== null) {
        clearInterval(iceCooldownTimer)
        iceCooldownTimer = null
      }
      if (thunderCooldownTimer !== null) {
        clearInterval(thunderCooldownTimer)
        thunderCooldownTimer = null
      }
      if (frostLordCooldownTimer !== null) {
        clearInterval(frostLordCooldownTimer)
        frostLordCooldownTimer = null
      }
      if (stormCooldownTimer !== null) {
        clearInterval(stormCooldownTimer)
        stormCooldownTimer = null
      }
      showSkillCards.value = true
      generateAvailableSkills()
    }
    food.value = generateFood([...snake.value, ...aiSnakes.value.flatMap(s => s.positions)])
  }

  // 自动释放闪电技能（已解锁，CD 完毕，天譴之龍/凜冬雷暴解鎖後不觸發）
  if (lightningSkill.value.level > 0 && lightningSkill.value.cooldown <= 0 && !lightningActive.value && !thunderDragonSkill.value.unlocked && !stormSkill.value.unlocked) {
    activateLightning()
  }
  
  // 自动释放冰冻技能（已解锁，CD 完毕，極寒領主/凜冬雷暴解鎖後不觸發）
  if (iceSkill.value.level > 0 && iceSkill.value.cooldown <= 0 && !iceActive.value && !frostLordSkill.value.unlocked && !stormSkill.value.unlocked) {
    activateIce()
  }
  
  // 自动释放天譴之龍技能（已解锁，CD 完毕）
  if (thunderDragonSkill.value.unlocked && thunderDragonSkill.value.cooldown <= 0 && thunderDragons.value.length === 0) {
    activateThunderDragon()
  }
  
  // 自动释放极寒领主技能（已解锁，CD 完毕，未激活）
  if (frostLordSkill.value.unlocked && frostLordSkill.value.cooldown <= 0 && !frostLordActive.value) {
    activateFrostLord()
  }
  
  // 自动释放凜冬雷暴技能（已解锁，CD 完毕，未激活）
  if (stormSkill.value.unlocked && stormSkill.value.cooldown <= 0 && !stormActive.value) {
    activateStorm()
  }
}

function activateThunderDragon(): void {
  if (thunderDragonSkill.value.cooldown > 0 || thunderDragons.value.length > 0) return
  
  const head = snake.value[0]!
  const radius = 5
  
  // 生成6只天譴之龍
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 / 6) * i
    const x = Math.round(head.x + radius * Math.cos(angle))
    const y = Math.round(head.y + radius * Math.sin(angle))
    
    thunderDragons.value.push({
      position: { x, y },
      direction: 'RIGHT'
    })
    
    const speed = BASE_SPEED / 2.0
    const timer = setInterval(() => moveThunderDragon(i), speed)
    thunderDragonTimers.push(timer)
  }
  
  // 3秒后结束
  setTimeout(() => {
    for (const timer of thunderDragonTimers) {
      clearInterval(timer)
    }
    thunderDragonTimers = []
    thunderDragons.value = []
    aiHitCounts.value.clear()
    
    thunderDragonSkill.value.cooldown = THUNDER_DRAGON_COOLDOWN
    if (thunderCooldownTimer) clearInterval(thunderCooldownTimer)
    thunderCooldownTimer = setInterval(() => {
      thunderDragonSkill.value.cooldown -= 100
      if (thunderDragonSkill.value.cooldown <= 0) {
        thunderDragonSkill.value.cooldown = 0
        if (thunderCooldownTimer) {
          clearInterval(thunderCooldownTimer)
          thunderCooldownTimer = null
        }
      }
    }, 100)
  }, 3000)
}

function activateFrostLord(): void {
  if (frostLordActive.value || frostLordSkill.value.cooldown > 0) return
  
  const head = snake.value[0]!
  const radius = 3
  
  // 初始化角度，从正右方开始（0度）
  frostLordAngle = 0
  const px = Math.round(head.x + radius * Math.cos(frostLordAngle))
  const py = Math.round(head.y + radius * Math.sin(frostLordAngle))
  frostLordSnake.value = [{ x: px, y: py }]
  
  frostLordActive.value = true
  
  if (frostLordDurationTimer) clearTimeout(frostLordDurationTimer)
  frostLordDurationTimer = setTimeout(() => {
    deactivateFrostLord()
  }, 3000)
  
  if (frostLordMoveTimer) clearInterval(frostLordMoveTimer)
  frostLordMoveTimer = setInterval(moveFrostLordSnake, BASE_SPEED)
}

function deactivateFrostLord(): void {
  frostLordActive.value = false
  frostLordSnake.value = []
  // 冰路保留，让每格独立3秒后消失
  
  if (frostLordMoveTimer) {
    clearInterval(frostLordMoveTimer)
    frostLordMoveTimer = null
  }
  if (frostLordDurationTimer) {
    clearTimeout(frostLordDurationTimer)
    frostLordDurationTimer = null
  }
  
  frostLordSkill.value.cooldown = FROST_LORD_COOLDOWN
  if (frostLordCooldownTimer) clearInterval(frostLordCooldownTimer)
  frostLordCooldownTimer = setInterval(() => {
    frostLordSkill.value.cooldown -= 100
    if (frostLordSkill.value.cooldown <= 0) {
      frostLordSkill.value.cooldown = 0
      if (frostLordCooldownTimer) {
        clearInterval(frostLordCooldownTimer)
        frostLordCooldownTimer = null
      }
    }
  }, 100)
}

// 凜冬雷暴技能
function activateStorm(): void {
  if (stormActive.value || stormSkill.value.cooldown > 0) return
  
  const head = snake.value[0]!
  
  // 初始化風暴蛇（在玩家右側）
  stormSnake.value = []
  for (let i = 0; i < 5; i++) {
    stormSnake.value.push({
      position: { x: head.x + i + 1, y: head.y },
      direction: 'LEFT',
      length: 5
    })
  }
  
  stormActive.value = true
  
  if (stormDurationTimer) clearTimeout(stormDurationTimer)
  stormDurationTimer = setTimeout(() => {
    endStorm()
  }, 3000)
  
  if (stormMoveTimer) clearInterval(stormMoveTimer)
  stormMoveTimer = setInterval(moveStormSnake, BASE_SPEED / 2.0)
}

function moveStormSnake(): void {
  if (gameStatus.value !== 'playing' || !stormActive.value || stormSnake.value.length === 0) return
  
  const stormHead = stormSnake.value[0]!
  const stormPos = stormHead.position
  
  // 檢查是否有 AI 蛇在風暴範圍外
  const aiOutsideStorm = aiSnakes.value.some(ai => {
    const aiHead = ai.positions[0]!
    const dx = Math.abs(aiHead.x - stormPos.x)
    const dy = Math.abs(aiHead.y - stormPos.y)
    return dx > 2 || dy > 2
  })
  
  let targetDir: Direction
  
  if (aiOutsideStorm) {
    // 有 AI 在風暴外 → 追蹤最近的外面 AI
    let nearestAI = aiSnakes.value[0]!
    let minDist = Infinity
    
    for (const ai of aiSnakes.value) {
      const aiHead = ai.positions[0]!
      const dx = aiHead.x - stormPos.x
      const dy = aiHead.y - stormPos.y
      
      // 只追蹤範圍外的 AI
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        const dist = Math.abs(dx) + Math.abs(dy)
        if (dist < minDist) {
          minDist = dist
          nearestAI = ai
        }
      }
    }
    
    const aiHead = nearestAI.positions[0]!
    const dx = aiHead.x - stormPos.x
    const dy = aiHead.y - stormPos.y
    
    if (Math.abs(dx) > Math.abs(dy)) {
      targetDir = dx > 0 ? 'RIGHT' : 'LEFT'
    } else {
      targetDir = dy > 0 ? 'DOWN' : 'UP'
    }
  } else {
    // 所有 AI 都在風暴內 → 隨機亂走
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    targetDir = directions[Math.floor(Math.random() * directions.length)]!
  }
  
  stormHead.direction = targetDir
  
  const next = { ...stormHead.position }
  switch (targetDir) {
    case 'UP':    next.y--; break
    case 'DOWN':  next.y++; break
    case 'LEFT':  next.x--; break
    case 'RIGHT': next.x++; break
  }
  
  // 穿牆
  next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
  next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT
  stormHead.position = next
  
  // 更新身体（向后移动）
  for (let i = stormSnake.value.length - 1; i > 0; i--) {
    stormSnake.value[i]!.position = { ...stormSnake.value[i - 1]!.position }
  }
  
  // 5×5 范围内的 AI 被吸附，绕着风暴中心逆时针打转
  const stormCenter = stormSnake.value[0]!
  for (const ai of aiSnakes.value) {
    const aiHead = ai.positions[0]!
    const dx = Math.abs(aiHead.x - stormCenter.position.x)
    const dy = Math.abs(aiHead.y - stormCenter.position.y)
    
    if (dx <= 2 && dy <= 2) {
      // 计算绕行方向（逆时针）
      const toCenterX = stormCenter.position.x - aiHead.x
      const toCenterY = stormCenter.position.y - aiHead.y
      
      // 逆时针切线方向：(-dy, dx)
      let tangentX = -toCenterY
      let tangentY = toCenterX
      
      // 归一化
      const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
      if (len > 0) {
        tangentX /= len
        tangentY /= len
        
        // 选择最接近的方向
        if (Math.abs(tangentX) > Math.abs(tangentY)) {
          ai.direction = tangentX > 0 ? 'RIGHT' : 'LEFT'
        } else {
          ai.direction = tangentY > 0 ? 'DOWN' : 'UP'
        }
      }
    }
  }
}

function endStorm(): void {
  const stormCenter = stormSnake.value[0]?.position
  if (stormCenter) {
    // 对 5×5 范围内的 AI 施加混亂
    for (let i = 0; i < aiSnakes.value.length; i++) {
      const ai = aiSnakes.value[i]
      if(!ai)  continue
      const aiHead = ai.positions[0]!
      const dx = Math.abs(aiHead.x - stormCenter.x)
      const dy = Math.abs(aiHead.y - stormCenter.y)
      
      if (dx <= 2 && dy <= 2) {
        const aiId = String(i)
        confusedAIs.value.add(aiId)
        
        const existingTimer = confusionTimers.value.get(aiId)
        if (existingTimer) clearTimeout(existingTimer)
        
        confusionTimers.value.set(aiId, setTimeout(() => {
          confusedAIs.value.delete(aiId)
          confusionTimers.value.delete(aiId)
        }, 3000))
      }
    }
  }
  
  stormActive.value = false
  stormSnake.value = []
  
  if (stormMoveTimer) {
    clearInterval(stormMoveTimer)
    stormMoveTimer = null
  }
  if (stormDurationTimer) {
    clearTimeout(stormDurationTimer)
    stormDurationTimer = null
  }
  
  stormSkill.value.cooldown = STORM_COOLDOWN
  if (stormCooldownTimer) clearInterval(stormCooldownTimer)
  stormCooldownTimer = setInterval(() => {
    stormSkill.value.cooldown -= 100
    if (stormSkill.value.cooldown <= 0) {
      stormSkill.value.cooldown = 0
      if (stormCooldownTimer) {
        clearInterval(stormCooldownTimer)
        stormCooldownTimer = null
      }
    }
  }, 100)
}

// 冰蛇使用圆周运动，围绕玩家蛇头旋转
function moveFrostLordSnake(): void {
  if (gameStatus.value !== 'playing' || !frostLordActive.value) return
  
  const head = snake.value[0]!
  const radius = 3
  
  // 每次只转15度（更平滑），逆时针
  frostLordAngle -= Math.PI / 12
  
  // 根据当前角度计算新位置
  const px = Math.round(head.x + radius * Math.cos(frostLordAngle))
  const py = Math.round(head.y + radius * Math.sin(frostLordAngle))
  
  const nextX = px
  const nextY = py
  
  // 更新位置
  const newPositions = [{ x: nextX, y: nextY }]
  
  const oldHead = frostLordSnake.value[0]
  if (oldHead) {
    const pathEntry = { 
      position: { ...oldHead },
      timer: setTimeout(() => {
        const idx = frostLordPath.value.findIndex(p => 
          p.position.x === oldHead.x && p.position.y === oldHead.y
        )
        if (idx > -1) frostLordPath.value.splice(idx, 1)
      }, 3000)
    }
    frostLordPath.value.push(pathEntry)
  }
  
  frostLordSnake.value = newPositions
  
  for (const ai of aiSnakes.value) {
    const aiHead = ai.positions[0]!
    for (const seg of frostLordSnake.value) {
      if (seg.x === aiHead.x && seg.y === aiHead.y) {
        ai.frozen = true
        if (ai.frozenTimer) clearTimeout(ai.frozenTimer)
        ai.frozenTimer = setTimeout(() => {
          ai.frozen = false
        }, 5000)
        break
      }
    }
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

function getThunderDragonTargetDirection(head: Position): Direction {
  if (aiSnakes.value.length === 0) return 'RIGHT'
  
  let nearestTarget = aiSnakes.value[0]!
  let minDist = Infinity
  
  for (const ai of aiSnakes.value) {
    const aiHead = ai.positions[0]!
    const dist = Math.abs(aiHead.x - head.x) + Math.abs(aiHead.y - head.y)
    if (dist < minDist) {
      minDist = dist
      nearestTarget = ai
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

  return candidates[0]!
}

function triggerChainLightning(targetAI: AISnake, dragonIndex: number): void {
  const targetHead = targetAI.positions[0]!
  const chainSize = 5
  const halfSize = Math.floor(chainSize / 2)
  const targetKey = `dragon-${dragonIndex}`
  
  for (const ai of aiSnakes.value) {
    if (ai === targetAI) continue
    const aiHead = ai.positions[0]!
    if (Math.abs(aiHead.x - targetHead.x) <= halfSize && Math.abs(aiHead.y - targetHead.y) <= halfSize) {
      ai.stunned = true
      if (ai.stunTimer) clearTimeout(ai.stunTimer)
      ai.stunTimer = setTimeout(() => {
        ai.stunned = false
        ai.paused = true
        ai.pauseStepCount = 0
        if (ai.pauseTimer) clearTimeout(ai.pauseTimer)
        ai.pauseTimer = setTimeout(() => {
          ai.paused = false
          ai.pauseStepCount = 0
        }, 1000)
      }, 1000)
    }
  }
  
  playerSpeedMultiplier = 2.0
  playerSpeedBoosted.value = true
  if (playerSpeedBoostTimer) clearTimeout(playerSpeedBoostTimer)
  playerSpeedBoostTimer = setTimeout(() => {
    playerSpeedMultiplier = 1.0
    playerSpeedBoosted.value = false
  }, 2000)
  
  const warningTimer = setTimeout(() => {
    const cl = chainLightnings.value.find(c => c.key === targetKey)
    if (cl) {
      cl.phase = 'strike'
      cl.strikeTimer = setTimeout(() => {
        const idx = chainLightnings.value.indexOf(cl)
        if (idx > -1) chainLightnings.value.splice(idx, 1)
      }, 300)
    }
  }, 2000)
  
  const existing = chainLightnings.value.find(c => c.key === targetKey)
  if (existing) {
    if (existing.warningTimer) clearTimeout(existing.warningTimer)
    if (existing.strikeTimer) clearTimeout(existing.strikeTimer)
    existing.position = { x: targetHead.x - 2, y: targetHead.y - 2 }
    existing.phase = 'warning'
    existing.warningTimer = warningTimer
    existing.strikeTimer = null
  } else {
    chainLightnings.value.push({
      key: targetKey,
      position: { x: targetHead.x - 2, y: targetHead.y - 2 },
      phase: 'warning',
      warningTimer,
      strikeTimer: null
    })
  }
}

function changeDirection(newDir: Direction): void {
  const opposites: Record<Direction, Direction> = {
    UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
  }
  if (newDir !== opposites[direction.value]) {
    pendingDirection = newDir
  }
}

function moveThunderDragon(index: number): void {
  if (gameStatus.value !== 'playing' || !thunderDragons.value[index]) return
  
  const dragon = thunderDragons.value[index]
  const head = snake.value[0]!
  
  dragon.direction = getThunderDragonTargetDirection(dragon.position)
  
  const next = { ...dragon.position }
  switch (dragon.direction) {
    case 'UP':    next.y--; break
    case 'DOWN':  next.y++; break
    case 'LEFT':  next.x--; break
    case 'RIGHT': next.x++; break
  }
  next.x = ((next.x % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH
  next.y = ((next.y % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT
  dragon.position = next
  
  for (let i = 0; i < aiSnakes.value.length; i++) {
    const ai = aiSnakes.value[i]
    if (!ai) continue
    const aiHead = ai.positions[0]!
    if (dragon.position.x === aiHead.x && dragon.position.y === aiHead.y) {
      const key = `${index}-${i}`
      const hitCount = (aiHitCounts.value.get(key) || 0) + 1
      aiHitCounts.value.set(key, hitCount)
      
      const effectType = hitCount % 3
      
      if (effectType === 1) {
        ai.stunned = true
        if (ai.stunTimer) clearTimeout(ai.stunTimer)
        ai.stunTimer = setTimeout(() => {
          ai.stunned = false
        }, 2000)
      } else if (effectType === 2) {
        ai.paused = true
        ai.pauseStepCount = 0
        if (ai.pauseTimer) clearTimeout(ai.pauseTimer)
        ai.pauseTimer = setTimeout(() => {
          ai.paused = false
          ai.pauseStepCount = 0
        }, 3000)
      } else if (effectType === 0) {
        triggerChainLightning(ai, index)
      }
      break
    }
  }
}

function moveAISnake(index: number): void {
  if (gameStatus.value !== 'playing') return
  
  const ai = aiSnakes.value[index]
  if(!ai)  return
  
  // 冰冻减速逻辑
  if (iceActive.value) {
    const playerHead = snake.value[0]!
    const iceSize = iceSkill.value.level >= 3 ? 5 : 3
    const halfSize = Math.floor(iceSize / 2)

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
  
  // 极寒领主范围减速
  if (frostLordActive.value) {
    const playerHead = snake.value[0]!
    const inRange = ai.positions.some(seg => {
      return Math.abs(seg.x - playerHead.x) <= 2 && Math.abs(seg.y - playerHead.y) <= 2
    })
    if (inRange) {
      ai.slowMultiplier = 0.5
      ai.slowed = true
      if (ai.slowTimer) {
        clearTimeout(ai.slowTimer)
        ai.slowTimer = null
      }
    } else if (ai.slowed && !ai.slowTimer) {
      ai.slowMultiplier = 0.7
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

  // 白色路径上无法转向前辑
  const aiHead = ai.positions[0]!
  const onPath = frostLordPath.value.some(path => 
    path.position.x === aiHead.x && path.position.y === aiHead.y
  )
  
  // 風暴範圍內檢測
  const onStorm = stormActive.value && stormSnake.value.length > 0 && (() => {
    const stormCenter = stormSnake.value[0]!
    return Math.abs(aiHead.x - stormCenter.position.x) <= 2 && 
           Math.abs(aiHead.y - stormCenter.position.y) <= 2
  })()
  
  // 混亂狀態：100% 隨機變向
  const aiId = String(index)
  const isConfused = confusedAIs.value.has(aiId)
  
  if (isConfused) {
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    ai.direction = directions[Math.floor(Math.random() * directions.length)]!
  } else if (onStorm) {
    // 在風暴範圍內：保持 storm 設定的方向，不呼叫 getAIDirection
  } else if (onPath) {
    // 保持原方向，不调用 getAIDirection
  } else {
    ai.direction = getAIDirection(ai.positions, food.value, ai.direction)
  }
  
  // 冰冻状态（无法移动）
  if (ai.frozen) {
    return
  }

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
  if (thunderDragonSkill.value.unlocked || frostLordSkill.value.unlocked) return
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

function resetGame(): void {
  playerSpeedMultiplier = 1.0
  playerSpeedBoosted.value = false
  iceActive.value = false
  
  defenderSkill.value.level = 1
  lightningSkill.value.level = 0
  lightningSkill.value.cooldown = 0
  iceSkill.value.level = 0
  iceSkill.value.cooldown = 0
  
  lightningActive.value = false
  lightningPosition.value = null
  lightningPhase.value = 'none'
  if (lightningWarningTimer !== null) {
    clearTimeout(lightningWarningTimer)
    lightningWarningTimer = null
  }
  if (lightningStrikeTimer !== null) {
    clearTimeout(lightningStrikeTimer)
    lightningStrikeTimer = null
  }
  if (lightningCooldownTimer !== null) {
    clearInterval(lightningCooldownTimer)
    lightningCooldownTimer = null
  }
  
  defenderActive.value = false
  defenderActive2.value = false
  defenderSnake.value = []
  defenderSnake2.value = []
  if (defenderTimer !== null) {
    clearInterval(defenderTimer)
    defenderTimer = null
  }
  if (defenderTimer2 !== null) {
    clearInterval(defenderTimer2)
    defenderTimer2 = null
  }
  defenderCooldown.value = 0
  if (defenderCooldownTimer !== null) {
    clearInterval(defenderCooldownTimer)
    defenderCooldownTimer = null
  }
  
  thunderDragonSkill.value.level = 0
  thunderDragonSkill.value.unlocked = false
  thunderDragonSkill.value.cooldown = 0
  if (thunderCooldownTimer !== null) {
    clearInterval(thunderCooldownTimer)
    thunderCooldownTimer = null
  }
  for (const timer of thunderDragonTimers) {
    clearInterval(timer)
  }
  thunderDragonTimers = []
  thunderDragons.value = []
  aiHitCounts.value.clear()
  for (const cl of chainLightnings.value) {
    if (cl.warningTimer) clearTimeout(cl.warningTimer)
    if (cl.strikeTimer) clearTimeout(cl.strikeTimer)
  }
  chainLightnings.value = []
  
  frostLordSkill.value.level = 0
  frostLordSkill.value.unlocked = false
  frostLordSkill.value.cooldown = 0
  if (frostLordCooldownTimer) clearInterval(frostLordCooldownTimer)
  frostLordCooldownTimer = null
  
  frostLordActive.value = false
  if (frostLordDurationTimer) clearTimeout(frostLordDurationTimer)
  frostLordDurationTimer = null
  if (frostLordMoveTimer) clearInterval(frostLordMoveTimer)
  frostLordMoveTimer = null
  frostLordSnake.value = []
  for (const path of frostLordPath.value) {
    clearTimeout(path.timer)
  }
  frostLordPath.value = []
  
  stormSkill.value.level = 0
  stormSkill.value.unlocked = false
  stormSkill.value.cooldown = 0
  if (stormCooldownTimer) clearInterval(stormCooldownTimer)
  stormCooldownTimer = null
  
  stormActive.value = false
  if (stormDurationTimer) clearTimeout(stormDurationTimer)
  stormDurationTimer = null
  if (stormMoveTimer) clearInterval(stormMoveTimer)
  stormMoveTimer = null
  stormSnake.value = []
  confusedAIs.value.clear()
  for (const timer of confusionTimers.value.values()) {
    clearTimeout(timer)
  }
  confusionTimers.value.clear()
  
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
}

function startGame(): void {
  resetGame()
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
    if (iceCooldownTimer !== null) {
      clearInterval(iceCooldownTimer)
      iceCooldownTimer = null
    }
    if (thunderCooldownTimer !== null) {
      clearInterval(thunderCooldownTimer)
      thunderCooldownTimer = null
    }
    if (frostLordCooldownTimer !== null) {
      clearInterval(frostLordCooldownTimer)
      frostLordCooldownTimer = null
    }
    if (stormCooldownTimer !== null) {
      clearInterval(stormCooldownTimer)
      stormCooldownTimer = null
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
    // 如果冰冻冷却中，重新启动冷却计时器
    if (iceSkill.value.cooldown > 0 && iceCooldownTimer === null) {
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
    }
    // 如果天譴之龍冷却中，重新启动冷却计时器
    if (thunderDragonSkill.value.cooldown > 0 && thunderCooldownTimer === null) {
      thunderCooldownTimer = setInterval(() => {
        thunderDragonSkill.value.cooldown -= 100
        if (thunderDragonSkill.value.cooldown <= 0) {
          thunderDragonSkill.value.cooldown = 0
          if (thunderCooldownTimer) {
            clearInterval(thunderCooldownTimer)
            thunderCooldownTimer = null
          }
        }
      }, 100)
    }
    // 如果极寒领主冷却中，重新启动冷却计时器
    if (frostLordSkill.value.cooldown > 0 && frostLordCooldownTimer === null) {
      frostLordCooldownTimer = setInterval(() => {
        frostLordSkill.value.cooldown -= 100
        if (frostLordSkill.value.cooldown <= 0) {
          frostLordSkill.value.cooldown = 0
          if (frostLordCooldownTimer) {
            clearInterval(frostLordCooldownTimer)
            frostLordCooldownTimer = null
          }
        }
      }, 100)
    }
    // 如果凜冬雷暴冷却中，重新启动冷却计时器
    if (stormSkill.value.cooldown > 0 && stormCooldownTimer === null) {
      stormCooldownTimer = setInterval(() => {
        stormSkill.value.cooldown -= 100
        if (stormSkill.value.cooldown <= 0) {
          stormSkill.value.cooldown = 0
          if (stormCooldownTimer) {
            clearInterval(stormCooldownTimer)
            stormCooldownTimer = null
          }
        }
      }, 100)
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)

  if (gameStatus.value === 'gameover') {
    if (e.key === ' ') {
      e.preventDefault()
      spacePressCount.value++
      if (spacePressCount.value >= 2) {
        spacePressCount.value = 0
        saveScore()
        startGame()
      }
      return
    }
    return
  }

  if (gameStatus.value === 'idle') {
    e.preventDefault()
    startGame()
    const dir = ({ ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' } as Record<string, Direction>)[e.key]
    if (dir && dir !== 'LEFT') {
      pendingDirection = dir
    }
    return
  }

  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault()
    if (gameStatus.value === 'paused') {
      rPressCount.value++
      if (rPressCount.value >= 2) {
        rPressCount.value = 0
        togglePause()
      }
    } else if (gameStatus.value === 'playing') {
      togglePause()
    } else if (gameStatus.value === 'levelup') {
      rPressCount.value++
      if (rPressCount.value >= 2) {
        rPressCount.value = 0
        resumeFromLevelUp()
      }
    }
    return
  }

  if (showSkillCards.value) {
    const num = parseInt(e.key)
    if (num >= 1 && num <= 3 && availableSkills.value[num - 1]) {
      e.preventDefault()
      selectSkill(availableSkills.value[num - 1]!.key)
    }
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
      <button class="back-btn" @click="goToMenu">返回主畫面</button>
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
      <div class="skills-container">
        <div v-if="!thunderDragonSkill.unlocked && !frostLordSkill.unlocked" class="skill-icon" :class="{ cooling: defenderCooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/snake.png" alt="守護蛇" class="skill-img" />
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

        <div v-if="lightningSkill.level > 0 && !thunderDragonSkill.unlocked && !stormSkill.unlocked" class="skill-icon" :class="{ cooling: lightningSkill.cooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/flash.png" alt="閃電" class="skill-img" />
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

        <div v-if="iceSkill.level > 0 && !frostLordSkill.unlocked && !stormSkill.unlocked" class="skill-icon" :class="{ cooling: iceSkill.cooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/ice.png" alt="冰凍" class="skill-img" />
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

        <div v-if="thunderDragonSkill.unlocked" class="skill-icon" :class="{ cooling: thunderDragonSkill.cooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/flash_dragon.png" alt="天譴之龍" class="skill-img" />
            <span class="skill-level">{{ thunderDragonSkill.level }}</span>
          </div>
          <svg class="cooldown-ring" viewBox="0 0 36 36">
            <circle class="cooldown-bg" cx="18" cy="18" r="16" />
            <circle 
              class="cooldown-progress" 
              cx="18" 
              cy="18" 
              r="16"
              :style="{ 
                strokeDashoffset: thunderDragonSkill.cooldown > 0 ? (thunderDragonSkill.cooldown / THUNDER_DRAGON_COOLDOWN) * 100 : 0 
              }"
            />
          </svg>
        </div>

        <div v-if="frostLordSkill.unlocked" class="skill-icon" :class="{ cooling: frostLordSkill.cooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/ice_dragon.png" alt="極寒領主" class="skill-img" />
            <span class="skill-level">{{ frostLordSkill.level }}</span>
          </div>
          <svg class="cooldown-ring" viewBox="0 0 36 36">
            <circle class="cooldown-bg" cx="18" cy="18" r="16" />
            <circle 
              class="cooldown-progress" 
              cx="18" 
              cy="18" 
              r="16"
              :style="{ 
                strokeDashoffset: frostLordSkill.cooldown > 0 ? (frostLordSkill.cooldown / FROST_LORD_COOLDOWN) * 100 : 0 
              }"
            />
          </svg>
        </div>

        <div v-if="stormSkill.unlocked" class="skill-icon" :class="{ cooling: stormSkill.cooldown > 0 }">
          <div class="skill-content">
            <img src="@/image/storm.png" alt="凜冬雷暴" class="skill-img" />
            <span class="skill-level">{{ stormSkill.level }}</span>
          </div>
          <svg class="cooldown-ring" viewBox="0 0 36 36">
            <circle class="cooldown-bg" cx="18" cy="18" r="16" />
            <circle 
              class="cooldown-progress" 
              cx="18" 
              cy="18" 
              r="16"
              :style="{ 
                strokeDashoffset: stormSkill.cooldown > 0 ? (stormSkill.cooldown / STORM_COOLDOWN) * 100 : 0 
              }"
            />
          </svg>
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
        <p class="skill-skip-hint">按 1、2、3 選擇 或 兩次 R 鍵跳過</p>
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
          <button class="btn" @click="saveScoreAndRestart">重新開始</button>
          <button class="btn" @click="goToMenu">返回主畫面</button>
        </div>
        <p class="restart-hint">按兩次空白鍵重新開始</p>
      </div>
    </div>

    <div class="overlay" :class="{ visible: gameStatus === 'paused' && !showSkillCards }">
      <div class="overlay-content">
        <h2>暫停中</h2>
        <div class="overlay-actions">
          <button class="btn" @click="saveScoreAndRestart">重新開始</button>
          <button class="btn" @click="goToMenu">返回主畫面</button>
        </div>
        <p class="restart-hint">按兩次 R 鍵繼續遊戲</p>
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

.skills-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  align-items: left;
}

.skill-icon {
  position: relative;
  width: 50px;
  height: 50px;
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

.skill-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
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

.back-btn {
  position: absolute;
  top: 0;
  left: 0;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  border-radius: 6px;
  background-color: #95a5a6;
  color: #fff;
  transition: background-color 0.2s;
  z-index: 10;
}

.back-btn:hover {
  background-color: #7f8c8d;
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

.cell.chain-lightning-warning {
  background-color: #ffeaa7;
}

.cell.chain-lightning-strike {
  background-color: #fff;
  animation: lightning-flash 0.15s ease-in-out 2;
}

.cell.ice-field {
  background-color: rgba(173, 216, 230, 0.5);
}

.cell.thunder-dragon {
  background-color: #f1c40f;
  box-shadow: 0 0 10px 4px #f39c12;
}

.cell.frost-lord-snake {
  background-color: #4682B4;
}

.cell.frost-lord-head {
  background-color: #1E90FF;
  box-shadow: 0 0 10px 4px #0000CD;
}

.cell.frost-lord-path {
  background-color: #87CEEB;
}

.cell.frost-lord-field {
  background-color: rgba(135, 206, 235, 0.3);
}

.cell.storm-field {
  background-color: rgba(179, 157, 219, 0.3);
}

.cell.storm-snake {
  background-color: #B39DDB;
}

.cell.storm-head {
  background-color: #9575CD;
  box-shadow: 0 0 10px 4px #7E57C2;
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
  width: 140px;
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

.skill-skip-hint {
  margin-top: 20px;
  color: #7fb3d8;
  font-size: 14px;
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

.skill-card .skill-desc :deep(.tooltip-text-chain) {
  text-decoration: underline;
  cursor: help;
  position: relative;
}

.skill-card .skill-desc :deep(.tooltip-text-chain):hover::after {
  content: '以敵人蛇為中心 5×5 雷區爆炸，周圍敵人全部短暫眩暈1秒，且眩暈完停頓持續1秒';
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

.skill-card .skill-desc :deep(.tooltip-text-road) {
  text-decoration: underline;
  cursor: help;
  position: relative;
}

.skill-card .skill-desc :deep(.tooltip-text-road):hover::after {
  content: '在上面的敵蛇無法改變方向';
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

.skill-card .skill-desc :deep(.tooltip-text-confused) {
  text-decoration: underline;
  cursor: help;
  position: relative;
}

.skill-card .skill-desc :deep(.tooltip-text-confused):hover::after {
  content: '使敵蛇方向混亂';
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
