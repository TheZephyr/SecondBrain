/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getGames: () => Promise<any[]>
    addGame: (game: any) => Promise<any>
    updateGame: (game: any) => Promise<boolean>
    deleteGame: (id: number) => Promise<boolean>
  }
}