<template>
  <div id="app">
    <div class="app-header">
      <h1>🧠 Second Brain</h1>
      <p class="subtitle">Your Personal Data Organizer</p>
    </div>
    
    <div class="app-content">
      <GameManager />
    </div>
  </div>
</template>

<script setup lang="ts">
import GameManager from './components/GameManager.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.app-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.app-header h1 {
  font-size: 48px;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 18px;
  opacity: 0.9;
}

.app-content {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  min-height: 600px;
}
</style>