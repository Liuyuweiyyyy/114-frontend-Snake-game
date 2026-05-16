<script setup lang="ts">
import { onMounted } from 'vue'
import { ref } from 'vue'
import SnakeGame from './components/SnakeGame.vue'
import TutorialGame from './components/TutorialGame.vue'
import { useLeaderboard } from './composables/useLeaderboard'

type ViewType = 'menu' | 'game' | 'tutorial' | 'leaderboard'

const currentView = ref<ViewType>('menu')
const { leaderboard, loadLeaderboard, clearLeaderboard } = useLeaderboard()

function startGame() {
  currentView.value = 'game'
}

function onGoToMenu() {
  currentView.value = 'menu'
}

function showLeaderboard() {
  loadLeaderboard()
  currentView.value = 'leaderboard'
}

function startTutorial() {
  currentView.value = 'tutorial'
}

function goBackToMenu() {
  currentView.value = 'menu'
}

function onTutorialComplete(destination?: string) {
  if (destination === 'menu') {
    currentView.value = 'menu'
  } else {
    currentView.value = 'game'
  }
}

onMounted(() => {
  loadLeaderboard()
})
</script>

<template>
  <div v-if="currentView === 'menu'" class="main-menu">
    <a href="https://github.com/Liuyuweiyyyy/114-frontend-Snake-game" target="_blank" class="github-link">
      <svg height="24" viewBox="0 0 16 16" version="1.1" width="24" aria-hidden="true">
        <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
      </svg>
    </a>
    <h1>🐍 貪食蛇</h1>
    <button @click="startGame">開始遊戲</button>
    <button @click="showLeaderboard">排行榜</button>
    <button @click="startTutorial">教學關卡</button>
  </div>

  <div v-if="currentView === 'leaderboard'" class="leaderboard-view">
    <h2>排行榜</h2>
    <div class="leaderboard-content">
      <div v-if="leaderboard.length === 0" class="empty">尚無記錄</div>
      <table v-else>
        <thead>
          <tr>
            <th>排名</th>
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
    </div>
    <button @click="goBackToMenu">返回</button>
  </div>

  <SnakeGame v-if="currentView === 'game'" @go-menu="onGoToMenu" />

  <TutorialGame v-if="currentView === 'tutorial'" @complete="onTutorialComplete" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.main-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f4fd 0%, #b3d9f2 100%);
  position: relative;
}

.github-link {
  position: absolute;
  top: 20px;
  right: 20px;
  color: #1a5276;
  transition: transform 0.2s;
}

.github-link:hover {
  transform: scale(1.2);
}

.main-menu h1 {
  font-size: 48px;
  color: #1a5276;
  margin-bottom: 48px;
}

.main-menu button {
  padding: 16px 64px;
  font-size: 20px;
  margin: 12px;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #27ae60, #1a7a3a);
  color: #fff;
  transition: transform 0.2s, box-shadow 0.2s;
  width: 220px;
}

.main-menu button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.main-menu button:active {
  transform: scale(0.98);
}

.leaderboard-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f4fd 0%, #b3d9f2 100%);
}

.leaderboard-view h2 {
  font-size: 36px;
  color: #1a5276;
  margin-bottom: 24px;
}

.leaderboard-view .coming-soon {
  font-size: 24px;
  color: #7fb3d8;
  margin-bottom: 32px;
}

.leaderboard-content {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  min-width: 300px;
}

.leaderboard-content .empty {
  text-align: center;
  color: #7fb3d8;
  font-size: 18px;
  padding: 20px;
}

.leaderboard-content table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-content th,
.leaderboard-content td {
  padding: 12px;
  text-align: center;
}

.leaderboard-content th {
  background: #1a5276;
  color: white;
}

.leaderboard-content td {
  border-bottom: 1px solid #b3d9f2;
}

.leaderboard-content tr:nth-child(even) td {
  background: rgba(179, 217, 242, 0.3);
}

.leaderboard-view button {
  padding: 12px 48px;
  font-size: 18px;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #27ae60, #1a7a3a);
  color: #fff;
  transition: transform 0.2s;
}

.leaderboard-view button:hover {
  transform: scale(1.05);
}
</style>