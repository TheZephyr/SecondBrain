import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Games
  getGames: () => ipcRenderer.invoke('db:getGames'),
  addGame: (game: any) => ipcRenderer.invoke('db:addGame', game),
  updateGame: (game: any) => ipcRenderer.invoke('db:updateGame', game),
  deleteGame: (id: number) => ipcRenderer.invoke('db:deleteGame', id),
  
  // Books
  getBooks: () => ipcRenderer.invoke('db:getBooks'),
  addBook: (book: any) => ipcRenderer.invoke('db:addBook', book),
  updateBook: (book: any) => ipcRenderer.invoke('db:updateBook', book),
  deleteBook: (id: number) => ipcRenderer.invoke('db:deleteBook', id),
  
  // Movies
  getMovies: () => ipcRenderer.invoke('db:getMovies'),
  addMovie: (movie: any) => ipcRenderer.invoke('db:addMovie', movie),
  updateMovie: (movie: any) => ipcRenderer.invoke('db:updateMovie', movie),
  deleteMovie: (id: number) => ipcRenderer.invoke('db:deleteMovie', id)
})