import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser } from '../../hooks/useUser'

const NAV = [
  { to: '/', icon: '🏠', label: 'Accueil' },
  { to: '/lists', icon: '📋', label: 'Listes' },
  { to: '/legends', icon: '👑', label: 'Légendes' },
  { to: '/fun', icon: '✨', label: 'Fun' },
]

const NAV_HEIGHT = 65

export default function Layout({ children }) {
  const { currentUser } = useUser()

  return (
    <div className="min-h-screen bg-void flex flex-col max-w-lg mx-auto relative">
      {/* Content — padding bottom = nav height + safe area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {children}
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
      >
        <div
          className="bg-surface/95 backdrop-blur-xl border-t border-border/50 px-2 pt-2"
          style={{ paddingBottom: `calc(10px + env(safe-area-inset-bottom))` }}
        >
          <div className="flex justify-around items-center">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {({ isActive }) => (
                  <motion.div
                    whileTap={{ scale: 0.8 }}
                    className="flex flex-col items-center gap-1 px-5 py-1 rounded-2xl relative"
                  >
                    <span
                      className="text-xl transition-all duration-200"
                      style={{
                        opacity: isActive ? 1 : 0.35,
                        transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >
                      {item.icon}
                    </span>
                    <span
                      className="font-body text-[9px] transition-colors duration-200"
                      style={{ color: isActive ? currentUser?.color : '#8888aa' }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-dot"
                        className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                        style={{ background: currentUser?.color }}
                      />
                    )}
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
