<template>
  <div class="game-manager">
    <div class="header">
      <h2>🎮 Games Collection</h2>
      <button @click="showAddForm = true" class="btn-add">+ Add Game</button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showAddForm" class="modal">
      <div class="modal-content">
        <h3>{{ editingGame ? 'Edit Game' : 'Add New Game' }}</h3>
        <form @submit.prevent="saveGame">
          <div class="form-group">
            <label>Title *</label>
            <input v-model="formData.title" type="text" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Release Date</label>
              <input v-model="formData.releaseDate" type="date" />
            </div>
            <div class="form-group">
              <label>Genre</label>
              <input v-model="formData.genre" type="text" placeholder="RPG, Action, etc." />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Rating (1-10)</label>
              <input v-model.number="formData.rating" type="number" min="1" max="10" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="formData.status">
                <option value="">Select...</option>
                <option value="Planning">Planning</option>
                <option value="Playing">Playing</option>
                <option value="Completed">Completed</option>
                <option value="Dropped">Dropped</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="formData.note" rows="3" placeholder="Your thoughts..."></textarea>
          </div>

          <div class="form-actions">
            <button type="button" @click="cancelForm" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">{{ editingGame ? 'Update' : 'Add' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Search and Filter -->
    <div class="filters">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="🔍 Search games..." 
        class="search-input"
      />
      <select v-model="filterStatus" class="filter-select">
        <option value="">All Status</option>
        <option value="Planning">Planning</option>
        <option value="Playing">Playing</option>
        <option value="Completed">Completed</option>
        <option value="Dropped">Dropped</option>
        <option value="On Hold">On Hold</option>
      </select>
    </div>

    <!-- Games Table -->
    <div class="table-container">
      <table v-if="filteredGames.length > 0">
        <thead>
          <tr>
            <th>Title</th>
            <th>Release Date</th>
            <th>Genre</th>
            <th>Rating</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="game in filteredGames" :key="game.id">
            <td><strong>{{ game.title }}</strong></td>
            <td>{{ formatDate(game.release_date) }}</td>
            <td>{{ game.genre || '-' }}</td>
            <td>
              <span v-if="game.rating" class="rating">⭐ {{ game.rating }}/10</span>
              <span v-else>-</span>
            </td>
            <td>
              <span :class="'status-badge status-' + (game.status || 'none').toLowerCase().replace(' ', '-')">
                {{ game.status || '-' }}
              </span>
            </td>
            <td class="notes-cell">{{ game.note || '-' }}</td>
            <td class="actions-cell">
              <button @click="editGame(game)" class="btn-edit">✏️</button>
              <button @click="deleteGame(game.id)" class="btn-delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p>No games found. Add your first game to get started! 🎮</p>
      </div>
    </div>

    <div class="stats">
      Total Games: {{ games.length }} | Showing: {{ filteredGames.length }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Game {
  id?: number
  title: string
  release_date?: string
  genre?: string
  rating?: number
  status?: string
  note?: string
}

const games = ref<Game[]>([])
const showAddForm = ref(false)
const editingGame = ref<Game | null>(null)
const searchQuery = ref('')
const filterStatus = ref('')

const formData = ref<Game>({
  title: '',
  release_date: '',
  genre: '',
  rating: undefined,
  status: '',
  note: ''
})

const filteredGames = computed(() => {
  let filtered = games.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(game =>
      game.title.toLowerCase().includes(query) ||
      (game.genre?.toLowerCase().includes(query)) ||
      (game.note?.toLowerCase().includes(query))
    )
  }

  if (filterStatus.value) {
    filtered = filtered.filter(game => game.status === filterStatus.value)
  }

  return filtered
})

async function loadGames() {
  games.value = await window.electronAPI.getGames()
}

function resetForm() {
  formData.value = {
    title: '',
    release_date: '',
    genre: '',
    rating: undefined,
    status: '',
    note: ''
  }
  editingGame.value = null
}

function cancelForm() {
  showAddForm.value = false
  resetForm()
}

async function saveGame() {
  if (editingGame.value) {
    await window.electronAPI.updateGame({
      id: editingGame.value.id,
      title: formData.value.title,
      releaseDate: formData.value.release_date,
      genre: formData.value.genre,
      rating: formData.value.rating,
      status: formData.value.status,
      note: formData.value.note
    })
  } else {
    await window.electronAPI.addGame({
      title: formData.value.title,
      releaseDate: formData.value.release_date,
      genre: formData.value.genre,
      rating: formData.value.rating,
      status: formData.value.status,
      note: formData.value.note
    })
  }

  await loadGames()
  showAddForm.value = false
  resetForm()
}

function editGame(game: Game) {
  editingGame.value = game
  formData.value = {
    title: game.title,
    release_date: game.release_date || '',
    genre: game.genre || '',
    rating: game.rating,
    status: game.status || '',
    note: game.note || ''
  }
  showAddForm.value = true
}

async function deleteGame(id: number) {
  if (confirm('Are you sure you want to delete this game?')) {
    await window.electronAPI.deleteGame(id)
    await loadGames()
  }
}

function formatDate(date?: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  loadGames()
})
</script>

<style scoped>
.game-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin: 0;
  font-size: 28px;
  color: #2c3e50;
}

.btn-add {
  background: #42b983;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: background 0.3s;
}

.btn-add:hover {
  background: #359268;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-top: 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #42b983;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
}

.btn-cancel,
.btn-save {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.btn-cancel {
  background: #e0e0e0;
  color: #666;
}

.btn-save {
  background: #42b983;
  color: white;
}

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.filter-select {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  min-width: 150px;
}

.table-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e0e0e0;
}

td {
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
}

tr:hover {
  background: #f8f9fa;
}

.rating {
  color: #f39c12;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.status-planning {
  background: #e3f2fd;
  color: #1976d2;
}

.status-playing {
  background: #fff3e0;
  color: #f57c00;
}

.status-completed {
  background: #e8f5e9;
  color: #388e3c;
}

.status-dropped {
  background: #ffebee;
  color: #d32f2f;
}

.status-on-hold {
  background: #f3e5f5;
  color: #7b1fa2;
}

.notes-cell {
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions-cell {
  white-space: nowrap;
}

.btn-edit,
.btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 5px 10px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-edit:hover,
.btn-delete:hover {
  opacity: 1;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #999;
  font-size: 16px;
}

.stats {
  margin-top: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
</style>