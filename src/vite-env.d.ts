/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    // Games
    getGames: () => Promise<any[]>
    addGame: (game: any) => Promise<any>
    updateGame: (game: any) => Promise<boolean>
    deleteGame: (id: number) => Promise<boolean>
    
    // Books
    getBooks: () => Promise<any[]>
    addBook: (book: any) => Promise<any>
    updateBook: (book: any) => Promise<boolean>
    deleteBook: (id: number) => Promise<boolean>
    
    // Movies
    getMovies: () => Promise<any[]>
    addMovie: (movie: any) => Promise<any>
    updateMovie: (movie: any) => Promise<boolean>
    deleteMovie: (id: number) => Promise<boolean>
  }
}