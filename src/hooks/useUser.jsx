import { createContext, useContext, useState, useEffect } from 'react'
import { USERS } from '../pages/LoginPage'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Persist user choice in localStorage
    const saved = localStorage.getItem('pihohel_user')
    if (saved && USERS[saved]) {
      setCurrentUser(USERS[saved])
    }
    setLoading(false)
  }, [])

  const login = (user) => {
    setCurrentUser(user)
    localStorage.setItem('pihohel_user', user.id)
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('pihohel_user')
  }

  const partner = currentUser
    ? Object.values(USERS).find(u => u.id !== currentUser.id)
    : null

  return (
    <UserContext.Provider value={{ currentUser, partner, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
