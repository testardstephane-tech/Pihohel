import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'

export default function StatsPage() {
  const { currentUser, partner } = useUser()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const [{ data: all }, { data: notes }] = await Promise.all([
      supabase.from('watchlist').select('*'),
      supabase.from('notes').select('*'),
    ])

    const series = (all || []).filter(x => x.type === 'series')
    const games = (all || []).filter(x => x.type === 'game')
    const completed = (all || []).filter(x => x.status === 'completed')
    const watching = (all || []).filter(x => x.status === 'watching')

    const myNotes = (notes || []).filter(n => n.user_id === currentUser.id)
    const partnerNotes = (notes || []).filter(n => n.user_id === partner?.id)

    const avg = (arr, key) => arr.length ? (arr.reduce((s, n) => s + (n[key] || 0), 0) / arr.length).toFixed(1) : '—'
    const globalAvg = (arr) => arr.length ? (arr.reduce((s, n) => s + ((n.scenario + n.music + n.actors) / 3), 0) / arr.length).toFixed(1) : '—'

    const myAvg = globalAvg(myNotes)
    const partnerAvg = globalAvg(partnerNotes)

    const topMine = myNotes.length ? myNotes.sort((a, b) => ((b.scenario + b.music + b.actors) / 3) - ((a.scenario + a.music + a.actors) / 3)).slice(0, 3) : []

    setStats({ series: series.length, games: games.length, completed: completed.length, watching: watching.length, total: (all || []).length, myAvg, partnerAvg, myNotes: myNotes.length, partnerNotes: partnerNotes.length, myScenario: avg(myNotes, 'scenario'), myMusic: avg(myNotes, 'music'), myActors: avg(myNotes, 'actors'), pScenario: avg(partnerNotes, 'scenario'), pMusic: avg(partnerNotes, 'music'), pActors: avg(partnerNotes, 'actors') })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-void p-5 space-y-5">
      <div className="pt-4">
        <h1 className="font-display text-3xl italic text-text-primary">Nos Stats 📊</h1>
        <p className="font-body text-text-secondary text-sm mt-1">L'histoire de notre duo en chiffres</p>
      </div>

      {/* Global */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total', value: stats.total, emoji: '📋' },
          { label: 'Terminés', value: stats.completed, emoji: '✅' },
          { label: 'Séries', value: stats.series, emoji: '🎬' },
          { label: 'Jeux', value: stats.games, emoji: '🎮' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="font-display text-3xl italic text-text-primary">{s.value}</div>
            <div className="font-body text-text-muted text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Notes comparison */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-display text-xl italic text-text-primary mb-4">Notes moyennes</h2>
        {[currentUser, partner].map(u => {
          const avg = u?.id === currentUser.id ? stats.myAvg : stats.partnerAvg
          const sc = u?.id === currentUser.id ? stats.myScenario : stats.pScenario
          const mu = u?.id === currentUser.id ? stats.myMusic : stats.pMusic
          const ac = u?.id === currentUser.id ? stats.myActors : stats.pActors
          return (
            <div key={u?.id} className="mb-5 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: u?.colorBg, color: u?.color }}>{u?.initial}</div>
                <span className="font-body text-sm font-medium" style={{ color: u?.color }}>{u?.name}</span>
                <span className="ml-auto font-display text-2xl italic" style={{ color: u?.color }}>{avg}<span className="font-body text-text-muted text-xs">/10</span></span>
              </div>
              {[['Scénario', sc], ['Musique', mu], ['Acteurs', ac]].map(([l, v]) => (
                <div key={l} className="mb-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-body text-text-muted text-xs">{l}</span>
                    <span className="font-mono text-xs" style={{ color: u?.color }}>{v}/10</span>
                  </div>
                  <div className="bg-surface rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(parseFloat(v) / 10) * 100}%`, background: u?.color }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Notations count */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-display text-xl italic text-text-primary mb-4">Activité</h2>
        <div className="flex gap-4">
          {[currentUser, partner].map(u => {
            const count = u?.id === currentUser.id ? stats.myNotes : stats.partnerNotes
            return (
              <div key={u?.id} className="flex-1 rounded-xl p-3 text-center" style={{ background: u?.colorBg, border: `1px solid ${u?.color}30` }}>
                <div className="font-display text-3xl italic" style={{ color: u?.color }}>{count}</div>
                <div className="font-body text-xs mt-1" style={{ color: u?.color }}>{u?.name}</div>
                <div className="font-body text-text-muted text-xs">notes</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
