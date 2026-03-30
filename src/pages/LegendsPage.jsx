import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { googleImages, giphy } from '../lib/api'
import { useUser } from '../hooks/useUser'

const LISTS = [
  { id: 'GOAT', label: 'GOAT', emoji: '🐐', desc: 'Le top du top absolu' },
  { id: 'VIP', label: 'VIP', emoji: '👑', desc: 'Les incontournables' },
]

// vue : 'list' | 'add' | 'detail'
export default function LegendsPage() {
  const { currentUser, partner } = useUser()
  const [view, setView] = useState('list')
  const [activeList, setActiveList] = useState('GOAT')
  const [legends, setLegends] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  // Add form
  const [form, setForm] = useState({ name: '', title_keyword: '', photo_url: '' })
  const [imgTab, setImgTab] = useState('photos')
  const [imgQuery, setImgQuery] = useState('')
  const [imgResults, setImgResults] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef(null)
  const nameRef = useRef(null)

  useEffect(() => { fetchLegends() }, [activeList])

  async function fetchLegends() {
    setLoading(true)
    const { data } = await supabase.from('legends').select('*').eq('list_type', activeList).order('created_at', { ascending: false })
    setLegends(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', title_keyword: '', photo_url: '' })
    setImgQuery(''); setImgResults([])
    setSaving(false)
    setView('add')
    setTimeout(() => nameRef.current?.focus(), 200)
  }

  function handleImgInput(e) {
    const q = e.target.value
    setImgQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchImages(q), 500)
  }

  function switchImgTab(t) {
    setImgTab(t); setImgResults([])
    if (imgQuery.trim()) searchImages(imgQuery, t)
  }

  async function searchImages(q, tab = imgTab) {
    if (!q.trim() || q.length < 2) { setImgResults([]); return }
    setImgLoading(true)
    try {
      let results = []
      if (tab === 'gif') {
        results = await giphy.search(q)
      } else {
        results = await googleImages.search(q)
      }
      setImgResults(results)
    } catch (e) { console.error(e) }
    setImgLoading(false)
  }

  async function addLegend() {
    if (!form.name.trim()) return
    setSaving(true)
    const funTitle = form.title_keyword.trim() ? `${form.title_keyword.trim()} of all time` : null
    await supabase.from('legends').insert({
      list_type: activeList,
      name: form.name.trim(),
      type: 'person',
      photo_url: form.photo_url || null,
      role: funTitle,
      added_by: currentUser.id,
    })
    setSaving(false)
    setView('list')
    fetchLegends()
  }

  async function deleteLegend(id) {
    if (!window.confirm('Supprimer cette légende ?')) return
    await supabase.from('legends').delete().eq('id', id)
    setLegends(p => p.filter(l => l.id !== id))
    setView('list')
  }

  const currentL = LISTS.find(l => l.id === activeList)

  // ════════ ADD ════════
  if (view === 'add') return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex-shrink-0 bg-void px-4 pt-5 pb-3 border-b border-border flex items-center gap-3">
        <button onClick={() => setView('list')} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl">← Retour</button>
        <p className="font-body text-text-primary text-sm font-medium">Ajouter à {activeList} {currentL?.emoji}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <label className="font-body text-text-muted text-xs mb-2 block uppercase tracking-wider">Nom *</label>
          <input ref={nameRef} type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Prénom Nom" className="w-full bg-card border border-border rounded-xl px-4 py-3.5 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
        </div>

        <div>
          <label className="font-body text-text-muted text-xs mb-2 block uppercase tracking-wider">Titre <span className="opacity-50 normal-case">(optionnel)</span></label>
          <input type="text" value={form.title_keyword} onChange={e => setForm(p => ({ ...p, title_keyword: e.target.value }))}
            placeholder="Un seul mot" className="w-full bg-card border border-border rounded-xl px-4 py-3.5 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
          {form.title_keyword.trim() && <p className="font-body text-xs mt-1.5 px-1 italic" style={{ color: currentUser?.color }}>→ "{form.title_keyword.trim()} of all time"</p>}
        </div>

        {/* Photo selected preview */}
        {form.photo_url && (
          <div className="relative">
            <img src={form.photo_url} alt="" className="w-full h-44 object-cover rounded-2xl" onError={e => e.target.style.display='none'} />
            <button onClick={() => setForm(p => ({ ...p, photo_url: '' }))} className="absolute top-2 right-2 bg-void/80 rounded-full w-7 h-7 flex items-center justify-center text-rose text-sm">✕</button>
            <div className="absolute bottom-2 left-2 bg-void/70 backdrop-blur-sm rounded-xl px-2 py-1"><p className="font-body text-xs text-teal">✓ Photo choisie</p></div>
          </div>
        )}

        {/* Image search */}
        <div>
          <label className="font-body text-text-muted text-xs mb-2 block uppercase tracking-wider">Photo <span className="opacity-50 normal-case">(optionnel)</span></label>
          <div className="flex gap-2 mb-3">
            {[['photos', '🖼️ Photos'], ['gif', '🎞️ GIFs']].map(([t, l]) => (
              <button key={t} onClick={() => switchImgTab(t)}
                className="flex-1 py-2 rounded-xl font-body text-xs font-medium transition-all"
                style={imgTab === t ? { background: currentUser?.color, color: '#0a0a0f' } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
              >{l}</button>
            ))}
          </div>
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">🔍</span>
            <input type="text" value={imgQuery} onChange={handleImgInput}
              placeholder={imgTab === 'gif' ? 'Chercher un GIF...' : 'Nom de la personne...'}
              className="w-full bg-card border border-border rounded-2xl pl-10 pr-4 py-3 font-body text-text-primary placeholder-text-muted focus:outline-none"
              style={{ fontSize: '16px' }}
            />
            {imgLoading && <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-border rounded-full animate-spin block" style={{ borderTopColor: currentUser?.color }} />}
          </div>
          {!imgQuery && <p className="font-body text-text-muted text-xs text-center py-3 opacity-50">Tape un nom pour chercher une photo</p>}
          {imgResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {imgResults.map((img, i) => (
                <button key={i} onClick={() => setForm(p => ({ ...p, photo_url: img.url }))}
                  className="aspect-square rounded-xl overflow-hidden relative border-2 transition-all"
                  style={{ borderColor: form.photo_url === img.url ? currentUser?.color : 'transparent' }}
                >
                  <img src={img.thumb || img.url} alt="" className="w-full h-full object-cover" onError={e => e.target.parentElement.style.display='none'} />
                  {form.photo_url === img.url && <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${currentUser?.color}50` }}><span className="text-white text-xl font-bold">✓</span></div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {form.name && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-16 rounded-xl overflow-hidden bg-surface flex-shrink-0">
              {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} /> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
            </div>
            <div>
              <p className="font-body text-text-primary text-sm font-medium">{form.name}</p>
              {form.title_keyword.trim() && <p className="font-body text-xs italic mt-0.5" style={{ color: currentUser?.color }}>{form.title_keyword.trim()} of all time</p>}
            </div>
          </div>
        )}

        <button onClick={addLegend} disabled={!form.name.trim() || saving}
          className="w-full text-void font-body font-medium rounded-xl py-4 disabled:opacity-50 mb-6"
          style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}
        >{saving ? 'Ajout...' : `Ajouter à ${activeList} ${currentL?.emoji}`}</button>
      </div>
    </div>
  )

  // ════════ DETAIL ════════
  if (view === 'detail' && selected) {
    const leg = selected
    const addedBy = leg.added_by === currentUser.id ? currentUser : partner
    return (
      <div className="min-h-screen bg-void">
        <div className="relative h-80 overflow-hidden">
          {leg.photo_url ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-9xl" style={{ background: `${currentUser?.color}10` }}>👤</div>}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.1), rgba(10,10,15,0.95))' }} />
          <button onClick={() => setView('list')} className="absolute top-5 left-5 bg-void/60 backdrop-blur-sm rounded-xl px-3 py-1.5 font-body text-text-secondary text-xs">← Retour</button>
          <button onClick={() => deleteLegend(leg.id)} className="absolute top-5 right-5 bg-void/60 backdrop-blur-sm rounded-xl px-3 py-1.5 font-body text-rose text-xs">🗑️ Supprimer</button>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <span className="inline-block font-body text-xs px-2 py-0.5 rounded-full mb-2" style={{ background: `${addedBy?.color}20`, color: addedBy?.color }}>Ajouté par {addedBy?.name}</span>
            <h1 className="font-display text-3xl italic text-text-primary">{leg.name}</h1>
            {leg.role && <p className="font-body text-sm italic mt-1" style={{ color: currentUser?.color }}>{leg.role}</p>}
          </div>
        </div>
        <div className="p-5">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="font-body text-text-muted text-xs uppercase tracking-wider mb-1">Liste</p>
            <p className="font-body text-text-primary text-sm">{currentL?.emoji} {currentL?.label} — {currentL?.desc}</p>
          </div>
        </div>
      </div>
    )
  }

  // ════════ LIST ════════
  return (
    <div className="min-h-screen bg-void">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-3xl italic text-text-primary">Listes de Légendes</h1>
        <p className="font-body text-text-secondary text-sm mt-1">Les icônes de notre univers 👑</p>
      </div>
      <div className="flex gap-3 px-5 mb-4">
        {LISTS.map(list => (
          <button key={list.id} onClick={() => setActiveList(list.id)}
            className="flex-1 py-4 rounded-2xl font-body font-medium transition-all"
            style={activeList === list.id ? { background: `${currentUser?.color}20`, border: `2px solid ${currentUser?.color}60`, color: currentUser?.color } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
          >
            <div className="text-2xl mb-1">{list.emoji}</div>
            <div className="text-sm">{list.label}</div>
            <div className="text-[10px] opacity-60">{list.desc}</div>
          </button>
        ))}
      </div>
      <div className="px-5 pb-6">
        <button onClick={openAdd} className="w-full text-void font-body font-medium rounded-2xl py-3.5 mb-5" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>
          + Ajouter à {currentL?.label} {currentL?.emoji}
        </button>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl aspect-[3/4] animate-pulse" />)}</div>
        ) : legends.length === 0 ? (
          <div className="text-center py-16 opacity-50"><div className="text-5xl mb-3">{currentL?.emoji}</div><p className="font-display text-text-secondary text-xl italic">Liste vide</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {legends.map((leg, i) => {
              const addedBy = leg.added_by === currentUser.id ? currentUser : partner
              return (
                <motion.button key={leg.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(leg); setView('detail') }}
                  className="bg-card border border-border rounded-2xl overflow-hidden text-left"
                >
                  <div className="aspect-[3/4] bg-surface overflow-hidden relative">
                    {leg.photo_url ? <img src={leg.photo_url} alt={leg.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3"><div className="text-5xl">👤</div><p className="font-body text-text-muted text-[10px] text-center line-clamp-3">{leg.name}</p></div>
                    }
                    {leg.photo_url && <div className="absolute bottom-0 left-0 right-0 h-14" style={{ background: 'linear-gradient(to top, rgba(10,10,15,0.9), transparent)' }} />}
                    <div className="absolute bottom-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: addedBy?.colorBg, color: addedBy?.color }}>{addedBy?.initial}</div>
                  </div>
                  <div className="p-3">
                    <p className="font-body text-text-primary text-xs font-medium line-clamp-1">{leg.name}</p>
                    {leg.role && <p className="font-body text-[10px] mt-0.5 line-clamp-1 italic" style={{ color: currentUser?.color }}>{leg.role}</p>}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
