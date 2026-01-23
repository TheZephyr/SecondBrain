import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getGames: () => ipcRenderer.invoke('db:getGames'),
  addGame: (game: any) => ipcRenderer.invoke('db:addGame', game),
  updateGame: (game: any) => ipcRenderer.invoke('db:updateGame', game),
  deleteGame: (id: number) => ipcRenderer.invoke('db:deleteGame', id)
})