<template>
  <div id="app">
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h1>🧠 Second Brain</h1>
          <p class="subtitle">Your Personal Organizer</p>
        </div>

        <nav class="nav-menu">
          <button
            v-for="item in menuItems"
            :key="item.id"
            :class="['nav-item', { active: currentView === item.id }]"
            @click="currentView = item.id"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <p>v0.1.0</p>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-wrapper">
          <GameManager v-if="currentView === 'games'" />
          <BookManager v-if="currentView === 'books'" />
          <MovieManager v-if="currentView === 'movies'" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GameManager from './components/GameManager.vue'
import BookManager from './components/BookManager.vue'
import MovieManager from './components/MovieManager.vue'

const currentView = ref('games')

const menuItems = [
  { id: 'games', icon: '🎮', label: 'Games' },
  { id: 'books', icon: '📚', label: 'Books' },
  { id: 'movies', icon: '🎬', label: 'Movies' }
]
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar Styles */
.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 30px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  font-size: 28px;
  margin-bottom: 5px;
}

.subtitle {
  font-size: 14px;
  opacity: 0.8;
}

.nav-menu {
  flex: 1;
  padding: 20px 0;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px 25px;
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  border-left-color: white;
  font-weight: 600;
}

.nav-icon {
  font-size: 24px;
}

.nav-label {
  font-size: 16px;
}

.sidebar-footer {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Main Content Styles */
.main-content {
  flex: 1;
  overflow: auto;
  background: #f5f5f5;
}

.content-wrapper {
  min-height: 100%;
  padding: 30px;
  background: white;
  border-radius: 0;
}
</style>