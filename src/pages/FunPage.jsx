import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { TROPHIES } from '../lib/trophies'
import Confetti from 'react-confetti'

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY

const SWEET_MESSAGES = [
  "Tu me manques comme un épisode sans sous-titres 😭",
  "Je pense à toi plus fort qu'un OST de drama 🎵",
  "T'es dans ma tête en mode boucle infinie ✨",
  "Si t'étais un jeu, tu serais mon GOTY chaque année 🎮",
  "Tu es la scène post-générique que j'attends toujours 🌸",
  "Mon cœur fait *ding* quand je pense à toi 💌",
  "Même les meilleurs K-dramas ne me font pas autant sourire que toi 💫",
]

export default function FunPage() {
  const { currentUser, partner } = useUser()
  const [watchlistItems, setWatchlistItems] = useState([])
  const [customItems, setCustomItems] = useState([])
  const [trophies, setTrophies] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const [wheelRot, setWheelRot] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [toast, setToast] = useState(null)
  const [specialDates, setSpecialDates] = useState([])
  const [showAddDate, setShowAddDate] = useState(false)
  const [newDate, setNewDate] = useState({ title: '', date: '', emoji: '🌸' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: w }, { data: custom }, { data: tr }, { data: dates }] = await Promise.all([
      supabase.from('watchlist').select('id,title,poster_url').eq('status', 'to_watch'),
      supabase.from('wheel_items').select('*'),
      supabase.from('trophies').select('trophy_id,earned_at'),
      supabase.from('special_dates').select('*').order('date'),
    ])
    setWatchlistItems(w || [])
    setCustomItems(custom || [])
    setTrophies(tr || [])
    setSpecialDates(dates || [])
  }

  const allWheelItems = [...watchlistItems.map(w => ({ id: w.id, label: w.title, source: 'watchlist' })), ...customItems.map(c => ({ id: c.id, label: c.label, source: 'custom' }))]

  async function addWheelItem() {
    if (!newItem.trim()) return
    await supabase.from('wheel_items').insert({ label: newItem.trim() })
    setNewItem('')
    setShowAddItem(false)
    fetchAll()
  }

  async function removeWheelItem(id) {
    await supabase.from('wheel_items').delete().eq('id', id)
    setCustomItems(p => p.filter(x => x.id !== id))
  }

  function spinWheel() {
    if (spinning || allWheelItems.length === 0) return
    setSpinning(true)
    setWinner(null)
    const idx = Math.floor(Math.random() * allWheelItems.length)
    const rot = wheelRot + 1440 + Math.random() * 360
    setWheelRot(rot)
    setTimeout(() => {
      setWinner(allWheelItems[idx])
      setSpinning(false)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    }, 3000)
  }

  async function sendThinkingOfYou() {
    setGifLoading(true)
    try {
      const queries = ['kpop hug', 'kdrama cute', 'kpop heart', 'kdrama kiss', 'kpop sweet']
      const q = queries[Math.floor(Math.random() * queries.length)]
      const r = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${GIPHY_KEY}&tag=${encodeURIComponent(q)}&rating=g`)
      const d = await r.json()
      const gifUrl = d.data?.images?.original?.url
      const msg = SWEET_MESSAGES[Math.floor(Math.random() * SWEET_MESSAGES.length)]

      if (gifUrl) {
        const text = encodeURIComponent(`${msg}\n${gifUrl}`)
        window.open(`fb-messenger://share?link=${encodeURIComponent(gifUrl)}&app_id=966242223397117`, '_blank') ||
        window.open(`https://m.me/?text=${text}`, '_blank')
      }
      setToast('GIF prêt à envoyer 💌')
      setTimeout(() => setToast(null), 3000)
    } catch (e) { console.error(e) }
    setGifLoading(false)
  }

  async function addSpecialDate() {
    if (!newDate.title || !newDate.date) return
    await supabase.from('special_dates').insert({ title: newDate.title, date: newDate.date, emoji: newDate.emoji })
    setNewDate({ title: '', date: '', emoji: '🌸' })
    setShowAddDate(false)
    fetchAll()
  }

  const earnedIds = new Set(trophies.map(t => t.trophy_id))

  return (
    <div className="min-h-screen bg-void p-5 space-y-5">
      {showConfetti && <Confetti recycle={false} numberOfPieces={200} colors={[currentUser?.color, partner?.color, '#ffd166', '#06d6a0']} />}

      <div className="pt-4">
        <h1 className="font-display text-3xl italic text-text-primary">Fun & Surprises</h1>
        <p className="font-body text-text-secondary text-sm mt-1">Les moments magiques ✨</p>
      </div>

      {/* Je pense à toi */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={sendThinkingOfYou} disabled={gifLoading}
        className="w-full rounded-3xl py-8 text-center border transition-all"
        style={{ background: `linear-gradient(135deg, ${partner?.color}12, ${currentUser?.color}12)`, borderColor: `${partner?.color}30` }}
      >
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-3">💌</motion.div>
        <p className="font-display text-2xl italic" style={{ color: partner?.color }}>Je pense à toi</p>
        <p className="font-body text-text-muted text-xs mt-1">
          {gifLoading ? 'Recherche d\'un câlin K-pop...' : `Envoie un GIF câlin K-pop à ${partner?.name} via Messenger`}
        </p>
      </motion.button>

      {/* Roue du Destin */}
      <div className="bg-card border border-border rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl italic text-text-primary">🎡 Roue du Destin</h2>
            <p className="font-body text-text-muted text-xs">{allWheelItems.length} élément{allWheelItems.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowAddItem(!showAddItem)}
            className="font-body text-xs px-3 py-1.5 rounded-xl border transition-all"
            style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color }}
          >+ Ajouter</button>
        </div>

        {/* Add item input */}
        <AnimatePresence>
          {showAddItem && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
              <div className="flex gap-2">
                <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWheelItem()}
                  placeholder="Film, série, activité..." className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none" />
                <button onClick={addWheelItem} className="px-4 py-2.5 rounded-xl font-body text-sm text-void font-medium" style={{ background: currentUser?.color }}>+</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom items list */}
        {customItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {customItems.map(item => (
              <div key={item.id} className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-3 py-1.5">
                <span className="font-body text-text-secondary text-xs">{item.label}</span>
                <button onClick={() => removeWheelItem(item.id)} className="text-text-muted text-xs hover:text-rose transition-colors">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Wheel visual */}
        <div className="flex justify-center mb-5 relative">
          <motion.div animate={{ rotate: wheelRot }} transition={{ duration: 3, ease: [0.17, 0.67, 0.12, 0.99] }}
            className="w-44 h-44 rounded-full flex items-center justify-center relative overflow-hidden"
            style={{ border: `3px solid ${currentUser?.color}50`, background: '#12121a' }}
          >
            {allWheelItems.slice(0, 8).map((item, i) => {
              const angle = (360 / Math.min(8, allWheelItems.length)) * i
              return (
                <div key={i} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2">
                    <span className="font-body text-[7px] text-text-muted whitespace-nowrap" style={{ maxWidth: '50px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                  <div className="absolute top-0 bottom-1/2 left-1/2 w-px" style={{ background: '#2a2a3a', transformOrigin: 'bottom' }} />
                </div>
              )
            })}
            <div className="w-10 h-10 rounded-full z-10 flex items-center justify-center" style={{ background: '#0a0a0f', border: `2px solid ${currentUser?.color}` }}>
              <span style={{ color: currentUser?.color, fontSize: '16px' }}>✨</span>
            </div>
          </motion.div>
          <div className="absolute right-12 top-1/2 -translate-y-1/2 text-2xl" style={{ color: partner?.color }}>◄</div>
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={spinWheel} disabled={spinning || allWheelItems.length === 0}
          className="w-full text-void font-body font-semibold rounded-2xl py-4 text-sm disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, #ffd166, ${partner?.color})` }}
        >{spinning ? '🌀 La roue tourne...' : '🎲 Tourner la roue !'}</motion.button>

        <AnimatePresence>
          {winner && !spinning && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-2xl p-4 text-center"
              style={{ background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.3)' }}
            >
              <p className="font-body text-text-muted text-xs mb-1">Ce soir c'est...</p>
              <p className="font-display text-xl italic" style={{ color: '#ffd166' }}>{winner.label}</p>
              <p className="font-body text-text-muted text-xs mt-1">✨ Le destin a parlé !</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trophées */}
      <div className="bg-card border border-border rounded-3xl p-5">
        <h2 className="font-display text-2xl italic text-text-primary mb-1">🏆 Trophées Pihohel</h2>
        <p className="font-body text-text-muted text-xs mb-5">{trophies.length}/{TROPHIES.length} badges débloqués</p>
        <div className="grid grid-cols-2 gap-3">
          {TROPHIES.map(trophy => {
            const earned = earnedIds.has(trophy.id)
            return (
              <motion.div key={trophy.id} whileTap={{ scale: 0.97 }}
                className="rounded-2xl p-4 border transition-all"
                style={earned ? { background: 'linear-gradient(135deg, rgba(255,209,102,0.08), rgba(255,107,157,0.08))', borderColor: 'rgba(255,209,102,0.25)' } : { background: '#12121a', borderColor: '#2a2a3a', opacity: 0.5 }}
              >
                <div className={`text-3xl mb-2 ${!earned ? 'grayscale' : ''}`}>{trophy.emoji}</div>
                <p className="font-body text-text-primary text-xs font-medium">{trophy.name}</p>
                <p className="font-body text-text-muted text-[10px] mt-0.5 line-clamp-2">{trophy.desc}</p>
                <p className="font-mono text-[10px] mt-1" style={{ color: earned ? '#ffd166' : '#4a4a66' }}>{earned ? '✓ Débloqué' : '🔒 Verrouillé'}</p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Dates spéciales */}
      <div className="bg-card border border-border rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl italic text-text-primary">🎂 Dates spéciales</h2>
          <button onClick={() => setShowAddDate(!showAddDate)} className="font-body text-xs px-3 py-1.5 rounded-xl border transition-all" style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color }}>+ Ajouter</button>
        </div>
        <AnimatePresence>
          {showAddDate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
              <div className="space-y-2">
                <input type="text" value={newDate.title} onChange={e => setNewDate(p => ({ ...p, title: e.target.value }))} placeholder="Nom de la date..." className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none" />
                <div className="flex gap-2">
                  <input type="text" value={newDate.emoji} onChange={e => setNewDate(p => ({ ...p, emoji: e.target.value }))} placeholder="🌸" className="w-16 bg-surface border border-border rounded-xl px-3 py-2.5 font-body text-text-primary text-sm focus:outline-none text-center" />
                  <input type="date" value={newDate.date} onChange={e => setNewDate(p => ({ ...p, date: e.target.value }))} className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 font-body text-text-primary text-sm focus:outline-none" />
                </div>
                <button onClick={addSpecialDate} className="w-full text-void font-body text-sm font-medium rounded-xl py-2.5" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>Ajouter</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {specialDates.length === 0
          ? <p className="font-body text-text-muted text-sm text-center py-4 opacity-50">Aucune date pour l'instant</p>
          : specialDates.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
              <span className="text-2xl">{d.emoji}</span>
              <div>
                <p className="font-body text-text-primary text-sm">{d.title}</p>
                <p className="font-body text-text-muted text-xs">{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={async () => { await supabase.from('special_dates').delete().eq('id', d.id); fetchAll() }} className="ml-auto text-text-muted text-xs hover:text-rose transition-colors">✕</button>
            </div>
          ))
        }
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 text-void font-body font-medium text-sm px-5 py-3 rounded-2xl shadow-lg z-50 whitespace-nowrap"
            style={{ background: partner?.color }}
          >{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
