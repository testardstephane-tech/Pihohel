import { motion } from 'framer-motion'

export const USERS = {
  fluidite: {
    id: 'fluidite',
    name: 'La Fluidité',
    color: '#9b5de5',
    colorBg: 'rgba(155,93,229,0.15)',
    colorBorder: 'rgba(155,93,229,0.35)',
    initial: 'F',
  },
  krystalite: {
    id: 'krystalite',
    name: 'La Krystalité',
    color: '#ff6b9d',
    colorBg: 'rgba(255,107,157,0.15)',
    colorBorder: 'rgba(255,107,157,0.35)',
    initial: 'K',
    bgImage: '/krystalite-bg.jpg',
  },
}

export default function LoginPage({ onLogin }) {
  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(155,93,229,0.08)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(255,107,157,0.08)' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xs relative z-10"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="text-center mb-12">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-5"
          >✨</motion.div>
          <h1 className="font-display text-5xl text-text-primary italic mb-2">Pihohel</h1>
          <p className="font-body text-text-muted text-xs tracking-[3px] uppercase">Premade of Love</p>
          <div className="w-16 h-px bg-border mx-auto mt-4" />
          <p className="font-body text-text-muted text-xs mt-4">Accès réservé aux Pihohel 🔒</p>
        </div>

        <div className="flex flex-col gap-4">
          {Object.values(USERS).map((user) => (
            <motion.button
              key={user.id}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => onLogin(user)}
              className="w-full rounded-2xl py-5 flex items-center gap-4 px-6 transition-all duration-200 relative overflow-hidden"
              style={{ background: 'rgba(10,10,15,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${user.colorBorder}` }}
            >
              <div className="relative z-10 flex items-center gap-4 w-full">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-body font-semibold text-lg flex-shrink-0"
                style={{ background: user.color, color: '#0a0a0f' }}
              >
                {user.initial}
              </div>
              <div className="text-left">
                <p className="font-display text-xl italic" style={{ color: user.color }}>{user.name}</p>
                <p className="font-body text-text-muted text-xs mt-0.5">C'est moi !</p>
              </div>
              <span className="ml-auto font-body text-lg" style={{ color: user.color }}>→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
