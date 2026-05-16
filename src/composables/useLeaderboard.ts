import { ref } from 'vue'

export interface LeaderboardEntry {
  name: string
  score: number
}

const leaderboard = ref<LeaderboardEntry[]>([])
const STORAGE_KEY = 'snake-game-leaderboard'

export function useLeaderboard() {
  function loadLeaderboard(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      leaderboard.value = JSON.parse(raw) as LeaderboardEntry[]
    }
  }

  function saveLeaderboard(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard.value))
  }

  function addScore(name: string, score: number): void {
    const trimmedName = name.trim() || '匿名'
    leaderboard.value.push({ name: trimmedName, score })
    leaderboard.value.sort((a, b) => b.score - a.score)
    if (leaderboard.value.length > 10) {
      leaderboard.value = leaderboard.value.slice(0, 10)
    }
    saveLeaderboard()
  }

  function clearLeaderboard(): void {
    leaderboard.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    leaderboard,
    loadLeaderboard,
    saveLeaderboard,
    addScore,
    clearLeaderboard,
  }
}