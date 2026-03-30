import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const APP_VERSION = 'v10.1'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }

export default function HomePage() {
  const { currentUser, partner, logout } = useUser()
  const [currentWatch, setCurrentWatch] = useState([])
  const [stats, setStats] = useState({ total: 0, completed: 0, hours: 0, trophies: 0 })
  const [specialDates, setSpecialDates] = useState([])
  const [updating, setUpdating] = useState(false)
  const [updateDone, setUpdateDone] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: watching }, { count: total }, { count: completed }, { data: trophyData }, { data: dates }, { data: allItems }] = await Promise.all([
      supabase.from('watchlist').select('*').eq('status', 'watching').order('updated_at', { ascending: false }).limit(3),
      supabase.from('watchlist').select('*', { count: 'exact', head: true }),
      supabase.from('watchlist').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('trophies').select('trophy_id'),
      supabase.from('special_dates').select('*').order('date', { ascending: true }).limit(3),
      supabase.from('watchlist').select('current_episode, episode_duration, total_episodes'),
    ])
    setCurrentWatch(watching || [])

    // Temps total = épisodes vus × durée par épisode (45 min par défaut)
    const totalMinutes = (allItems || []).reduce((acc, item) => {
      const eps = item.current_episode || 0
      const dur = item.episode_duration || 45
      return acc + (eps * dur)
    }, 0)
    const totalHours = Math.round(totalMinutes / 60)

    setStats({ total: total || 0, completed: completed || 0, hours: totalHours, trophies: trophyData?.length || 0 })
    setSpecialDates(dates || [])
  }

  async function updateApp() {
    setUpdating(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) await reg.unregister()
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      setUpdateDone(true)
      setTimeout(() => window.location.reload(true), 800)
    } catch (e) { window.location.reload(true) }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return 'Bonne nuit'
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  return (
    <div className="min-h-screen bg-void relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${currentUser?.color}15, transparent)` }} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="relative z-10 p-5 space-y-5">

        {/* Header */}
        <motion.div variants={item} className="flex items-start justify-between pt-4">
          <div>
            <p className="font-body text-text-secondary text-sm">{greeting()} ✨</p>
            <h1 className="font-display text-3xl italic" style={{ color: currentUser?.color }}>{currentUser?.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-body text-text-muted text-xs">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: `${currentUser?.color}15`, color: `${currentUser?.color}80` }}>{APP_VERSION}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end mt-1">
            <button onClick={logout} className="font-body text-text-muted text-xs hover:text-rose transition-colors bg-card border border-border rounded-xl px-3 py-1.5">Changer →</button>
            <motion.button whileTap={{ scale: 0.92 }} onClick={updateApp} disabled={updating}
              className="font-body text-xs rounded-xl px-3 py-1.5 flex items-center gap-1.5 transition-all"
              style={{ background: `${currentUser?.color}15`, border: `1px solid ${currentUser?.color}30`, color: currentUser?.color }}
            >
              {updating ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />{updateDone ? 'Rechargement...' : 'Mise à jour...'}</> : <>🔄 Mettre à jour</>}
            </motion.button>
          </div>
        </motion.div>

        {/* En ce moment */}
        {currentWatch.length > 0 && (
          <motion.div variants={item}>
            <h2 className="font-body text-text-secondary text-xs uppercase tracking-wider mb-3">En ce moment 🍿</h2>
            <div className="space-y-3">
              {currentWatch.map((show) => (
                <Link key={show.id} to={`/watchlist/${show.id}`}>
                  <motion.div whileTap={{ scale: 0.98 }} className="bg-card border border-border rounded-2xl overflow-hidden transition-colors" style={{ borderColor: `${currentUser?.color}20` }}>
                    <div className="flex gap-4 p-4">
                      <div className="flex-shrink-0 w-14 rounded-xl overflow-hidden bg-surface" style={{ height: '72px' }}>
                        {show.poster_url ? <img src={show.poster_url} alt={show.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{show.type === 'game' ? '🎮' : '🎬'}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-text-primary font-medium text-sm truncate">{show.title}</p>
                        {show.total_episodes && <p className="font-body text-text-muted text-xs mt-0.5">Épisode {show.current_episode || 0} / {show.total_episodes}</p>}
                        {show.total_episodes && (
                          <div className="mt-2 bg-surface rounded-full h-1.5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((show.current_episode || 0) / show.total_episodes) * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${currentUser?.color}, ${partner?.color})` }} />
                          </div>
                        )}
                        <p className="font-body text-xs mt-2" style={{ color: currentUser?.color }}>Voir la fiche →</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {currentWatch.length === 0 && (
          <motion.div variants={item}>
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">🌸</div>
              <p className="font-display text-text-secondary text-lg italic">Rien en cours</p>
              <Link to="/lists" className="inline-block mt-3 font-body text-sm px-5 py-2.5 rounded-xl text-void" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>Trouver quelque chose à regarder</Link>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={item}>
          <h2 className="font-body text-text-secondary text-xs uppercase tracking-wider mb-3">Notre univers</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Dans la liste', value: stats.total, emoji: '📋' },
              { label: 'Terminés', value: stats.completed, emoji: '✅' },
              { label: 'Heures ensemble', value: `${stats.hours}h`, emoji: '⏱️' },
              { label: 'Trophées', value: stats.trophies, emoji: '🏆', gold: true },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-4" style={s.gold ? { background: 'rgba(255,209,102,0.05)', borderColor: 'rgba(255,209,102,0.2)' } : {}}>
                <div className="text-xl mb-1">{s.emoji}</div>
                <div className="font-display text-3xl italic" style={{ color: s.gold ? '#ffd166' : currentUser?.color }}>{s.value}</div>
                <div className="font-body text-text-muted text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick actions — Chercher va vers /lists */}
        <motion.div variants={item}>
          <h2 className="font-body text-text-secondary text-xs uppercase tracking-wider mb-3">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/lists">
              <motion.div whileTap={{ scale: 0.95 }} className="bg-card border border-border rounded-2xl p-4 text-center transition-colors" style={{ borderColor: `${currentUser?.color}30` }}>
                <div className="text-2xl mb-1.5">📋</div>
                <div className="font-body text-text-primary text-xs font-medium">Nos listes</div>
              </motion.div>
            </Link>
            <Link to="/fun">
              <motion.div whileTap={{ scale: 0.95 }} className="bg-card border border-border rounded-2xl p-4 text-center" style={{ borderColor: 'rgba(255,209,102,0.25)' }}>
                <div className="text-2xl mb-1.5">🎡</div>
                <div className="font-body text-text-primary text-xs font-medium">Roue du Destin</div>
              </motion.div>
            </Link>
            <Link to="/stats">
              <motion.div whileTap={{ scale: 0.95 }} className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1.5">📊</div>
                <div className="font-body text-text-primary text-xs font-medium">Nos stats</div>
              </motion.div>
            </Link>
            <Link to="/legends">
              <motion.div whileTap={{ scale: 0.95 }} className="bg-card border border-border rounded-2xl p-4 text-center" style={{ borderColor: `${partner?.color}30` }}>
                <div className="text-2xl mb-1.5">👑</div>
                <div className="font-body text-text-primary text-xs font-medium">Légendes</div>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Special dates */}
        {specialDates.length > 0 && (
          <motion.div variants={item}>
            <h2 className="font-body text-text-secondary text-xs uppercase tracking-wider mb-3">Dates spéciales 🎂</h2>
            {specialDates.map((d) => (
              <div key={d.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
                <span className="text-xl">{d.emoji || '🌸'}</span>
                <div>
                  <p className="font-body text-text-primary text-sm">{d.title}</p>
                  <p className="font-body text-text-muted text-xs">{format(new Date(d.date), 'd MMMM', { locale: fr })}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Je pense à toi */}
        <motion.div variants={item}>
          <Link to="/fun">
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${partner?.color}15, ${currentUser?.color}15)`, border: `1px solid ${partner?.color}25` }}>
              <span className="text-3xl">💌</span>
              <div>
                <p className="font-body text-text-primary text-sm font-medium">Je pense à toi</p>
                <p className="font-body text-text-muted text-xs">Envoie un câlin K-pop à {partner?.name}</p>
              </div>
              <span className="ml-auto text-text-muted">→</span>
            </div>
          </Link>
        </motion.div>

      </motion.div>
    </div>
  )
}
