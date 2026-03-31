import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { tmdb, rawg } from '../lib/api'

const TYPE_TABS = [
  { id: 'all', label: 'Tout', emoji: '🌐' },
  { id: 'series', label: 'Séries', emoji: '🎬' },
  { id: 'movie', label: 'Films', emoji: '🎥' },
  { id: 'game', label: 'Jeux', emoji: '🎮' },
  { id: 'actor', label: 'Acteurs', emoji: '⭐' },
]

const STATUS_CONFIG = {
  to_watch: { label: 'À voir', emoji: '📌', next: 'watching', color: '#8888aa', bg: '#2a2a3a' },
  watching: { label: 'En cours', emoji: '▶️', next: 'completed' },
  completed: { label: 'Terminé', emoji: '✅', next: 'to_watch', color: '#06d6a0', bg: 'rgba(6,214,160,0.2)' },
}

const SEARCH_TYPES = [
  { id: 'series', label: 'Séries', emoji: '🎬' },
  { id: 'movie', label: 'Films', emoji: '🎥' },
  { id: 'game', label: 'Jeux', emoji: '🎮' },
  { id: 'actor', label: 'Acteurs', emoji: '⭐' },
]

// vue : 'watchlist' | 'search' | 'custom_home' | 'custom_list'
export default function ListsPage() {
  const { currentUser, partner } = useUser()
  const [view, setView] = useState('watchlist')

  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('watching')
  const [showFreeInput, setShowFreeInput] = useState(false)
  const [freeText, setFreeText] = useState('')

  const [customLists, setCustomLists] = useState([])
  const [activeCustomList, setActiveCustomList] = useState(null)
  const [customItems, setCustomItems] = useState([])
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [customFreeText, setCustomFreeText] = useState('')
  const [showCustomFree, setShowCustomFree] = useState(false)

  const [searchType, setSearchType] = useState('series')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())
  const [searchFrom, setSearchFrom] = useState('watchlist')

  const debounceRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => { fetchWatchlist(); fetchCustomLists() }, [])

  async function fetchWatchlist() {
    setLoadingItems(true)
    const { data } = await supabase.from('watchlist').select('*').order('updated_at', { ascending: false })
    setItems(data || [])
    setLoadingItems(false)
  }

  async function fetchCustomLists() {
    const { data } = await supabase.from('custom_lists').select('*').order('created_at')
    setCustomLists(data || [])
  }

  async function fetchCustomItems(listId) {
    setLoadingCustom(true)
    const { data } = await supabase.from('list_items').select('*').eq('list_id', listId).order('created_at', { ascending: false })
    setCustomItems(data || [])
    setLoadingCustom(false)
  }

  // ── Search ──────────────────────────────────────────────────
  function openSearch(from) {
    setSearchFrom(from); setSearchQuery(''); setSearchResults([]); setAddedIds(new Set())
    setView('search')
    setTimeout(() => searchInputRef.current?.focus(), 200)
  }

  function handleSearchInput(e) {
    const q = e.target.value; setSearchQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q, searchType), 400)
  }

  function changeSearchType(t) {
    setSearchType(t); setSearchResults([])
    if (searchQuery.trim()) doSearch(searchQuery, t)
  }

  async function doSearch(q, type) {
    if (!q.trim() || q.length < 2) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      let data = []
      if (type === 'series') data = await tmdb.searchSeries(q)
      else if (type === 'movie') data = await tmdb.searchMovies(q)
      else if (type === 'game') data = await rawg.search(q)
      else data = await tmdb.searchActors(q)
      setSearchResults(data.slice(0, 12))
    } catch (e) { console.error(e) }
    setSearchLoading(false)
  }

  function getImg(r) {
    if (searchType === 'series' || searchType === 'movie') return r.poster_path ? `https://image.tmdb.org/t/p/w300${r.poster_path}` : null
    if (searchType === 'game') return r.background_image
    return r.profile_path ? `https://image.tmdb.org/t/p/w300${r.profile_path}` : null
  }

  async function addFromSearch(result) {
    if (addedIds.has(result.id)) return
    const title = result.name || result.title
    const poster = getImg(result)

    // Pour les séries : récupérer épisodes saison 1 + durée depuis TMDB
    let totalEpisodes = null
    let episodeDuration = 45
    if (searchType === 'series' && result.id) {
      const info = await tmdb.getSeriesInfo(result.id)
      totalEpisodes = info.totalEpisodes
      episodeDuration = info.episodeDuration
    }

    const payload = {
      external_id: String(result.id), type: searchType, title, poster_url: poster,
      synopsis: result.overview || result.known_for_department || '',
      total_episodes: totalEpisodes,
      episode_duration: episodeDuration,
      status: 'to_watch', current_episode: 0, added_by: currentUser.id,
      season_number: searchType === 'series' ? 1 : null,
    }
    if (searchFrom === 'watchlist') {
      await supabase.from('watchlist').insert(payload)
    } else {
      await supabase.from('list_items').insert({ list_id: activeCustomList?.id, ...payload })
    }
    setAddedIds(p => new Set([...p, result.id]))
  }

  function goBackFromSearch() {
    if (searchFrom === 'watchlist') { setView('watchlist'); fetchWatchlist() }
    else { setView('custom_list'); if (activeCustomList) fetchCustomItems(activeCustomList.id) }
  }

  // ── Watchlist actions ───────────────────────────────────────
  async function cycleStatus(item) {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.to_watch
    const next = sc.next
    // Si on passe à "completed" et qu'on a un nombre d'épisodes, on met le compteur au max
    const updates = { status: next, updated_at: new Date().toISOString() }
    if (next === 'completed' && item.total_episodes) {
      updates.current_episode = item.total_episodes
    }
    await supabase.from('watchlist').update(updates).eq('id', item.id)
    setItems(p => p.map(i => i.id === item.id ? { ...i, ...updates } : i))
  }

  async function updateEp(id, delta, item) {
    const newEp = Math.max(0, Math.min(item.total_episodes || 999, (item.current_episode || 0) + delta))
    const newStatus = item.total_episodes && newEp >= item.total_episodes ? 'completed' : newEp > 0 ? 'watching' : 'to_watch'
    await supabase.from('watchlist').update({ current_episode: newEp, status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, current_episode: newEp, status: newStatus } : i))
  }

  async function deleteWatchItem(id) {
    if (!window.confirm('Supprimer cet élément de la liste ?')) return
    await supabase.from('watchlist').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
  }

  async function addFreeWatchItem() {
    if (!freeText.trim()) return
    await supabase.from('watchlist').insert({ type: 'series', title: freeText.trim(), status: 'to_watch', added_by: currentUser.id })
    setFreeText(''); setShowFreeInput(false); fetchWatchlist()
  }

  // ── Custom list actions ─────────────────────────────────────
  async function createCustomList() {
    if (!newListName.trim()) return
    const { data } = await supabase.from('custom_lists').insert({ name: newListName.trim(), created_by: currentUser.id }).select().single()
    setNewListName(''); setShowNewList(false)
    await fetchCustomLists()
    if (data) { setActiveCustomList(data); fetchCustomItems(data.id); setView('custom_list') }
  }

  async function deleteCustomList(id, e) {
    e.stopPropagation()
    if (!window.confirm('Supprimer cette liste et tout son contenu ?')) return
    await supabase.from('custom_lists').delete().eq('id', id)
    fetchCustomLists()
  }

  async function addCustomFreeItem() {
    if (!customFreeText.trim() || !activeCustomList) return
    await supabase.from('list_items').insert({ list_id: activeCustomList.id, type: 'free', title: customFreeText.trim(), status: 'to_watch', added_by: currentUser.id })
    setCustomFreeText(''); setShowCustomFree(false); fetchCustomItems(activeCustomList.id)
  }

  async function toggleCustomDone(item) {
    const next = item.status === 'completed' ? 'to_watch' : 'completed'
    await supabase.from('list_items').update({ status: next }).eq('id', item.id)
    setCustomItems(p => p.map(i => i.id === item.id ? { ...i, status: next } : i))
  }

  async function deleteCustomItem(id) {
    if (!window.confirm('Supprimer cet élément ?')) return
    await supabase.from('list_items').delete().eq('id', id)
    setCustomItems(p => p.filter(i => i.id !== id))
  }

  const filteredItems = items.filter(i => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    return true
  })
  const typeEmoji = { series: '🎬', movie: '🎥', game: '🎮', actor: '⭐', free: '📝' }

  // ════════ SEARCH ════════
  if (view === 'search') return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex-shrink-0 bg-void px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBackFromSearch} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl flex-shrink-0">← Retour</button>
          <p className="font-body text-text-primary text-sm font-medium truncate">Ajouter à "{searchFrom === 'watchlist' ? 'Watchlist' : activeCustomList?.name}"</p>
        </div>
        <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {SEARCH_TYPES.map(t => (
            <button key={t.id} onClick={() => changeSearchType(t.id)} className="flex-shrink-0 px-3 py-2 rounded-xl font-body text-xs font-medium transition-all"
              style={searchType === t.id ? { background: currentUser?.color, color: '#0a0a0f' } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
            >{t.emoji} {t.label}</button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">🔍</span>
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={handleSearchInput}
            placeholder={`Chercher ${SEARCH_TYPES.find(t => t.id === searchType)?.label.toLowerCase()}...`}
            className="w-full bg-card border border-border rounded-2xl pl-10 pr-4 py-3.5 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
          {searchLoading && <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-border rounded-full animate-spin block" style={{ borderTopColor: currentUser?.color }} />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!searchQuery && <div className="text-center py-16 opacity-40"><div className="text-5xl mb-3">{SEARCH_TYPES.find(t => t.id === searchType)?.emoji}</div><p className="font-body text-text-muted text-sm">Tape pour chercher</p></div>}
        {searchResults.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {searchResults.map((result, i) => (
              <motion.div key={result.id || i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="aspect-[2/3] relative overflow-hidden bg-surface">
                  {getImg(result) ? <img src={getImg(result)} alt={result.name || result.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">{SEARCH_TYPES.find(t => t.id === searchType)?.emoji}</div>}
                  {(result.vote_average || result.rating) && <div className="absolute top-2 left-2 bg-void/80 rounded-lg px-1.5 py-0.5"><span className="font-mono text-[10px]" style={{ color: '#ffd166' }}>★ {(result.vote_average || result.rating || 0).toFixed(1)}</span></div>}
                </div>
                <div className="p-2.5">
                  <p className="font-body text-text-primary text-xs font-medium line-clamp-2 mb-1.5">{result.name || result.title}</p>
                  <button onClick={() => addFromSearch(result)} className="w-full py-1.5 rounded-xl font-body text-xs font-medium transition-all"
                    style={addedIds.has(result.id) ? { background: 'rgba(6,214,160,0.2)', color: '#06d6a0' } : { background: `${currentUser?.color}20`, color: currentUser?.color }}
                  >{addedIds.has(result.id) ? '✓ Ajouté' : '+ Ajouter'}</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ════════ CUSTOM HOME ════════
  if (view === 'custom_home') return (
    <div className="min-h-screen bg-void">
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => setView('watchlist')} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl">← Retour</button>
        <h1 className="font-display text-2xl italic text-text-primary flex-1">Mes listes</h1>
      </div>
      <div className="px-5 pb-6 space-y-3">
        <AnimatePresence>
          {showNewList ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex gap-2 pb-1">
                <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCustomList()}
                  placeholder="Nom de la liste..." autoFocus className="flex-1 bg-card border border-border rounded-xl px-4 py-3 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
                <button onClick={createCustomList} disabled={!newListName.trim()} className="px-4 rounded-xl font-body text-sm text-void font-medium disabled:opacity-40" style={{ background: currentUser?.color }}>Créer</button>
              </div>
            </motion.div>
          ) : (
            <button onClick={() => setShowNewList(true)} className="w-full text-void font-body font-medium rounded-2xl py-3.5" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>+ Nouvelle liste</button>
          )}
        </AnimatePresence>
        {customLists.length === 0 ? (
          <div className="text-center py-14 opacity-40"><div className="text-4xl mb-2">✏️</div><p className="font-body text-text-muted text-sm">Aucune liste perso</p><p className="font-body text-text-muted text-xs mt-1">Restos, films cultes, idées de sorties...</p></div>
        ) : customLists.map((list, i) => (
          <motion.div key={list.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <button onClick={() => { setActiveCustomList(list); fetchCustomItems(list.id); setView('custom_list') }} className="flex-1 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${partner?.color}15` }}>📝</div>
              <div><p className="font-body text-text-primary text-sm font-medium">{list.name}</p><p className="font-body text-xs mt-0.5" style={{ color: partner?.color }}>Voir →</p></div>
            </button>
            <button onClick={(e) => deleteCustomList(list.id, e)} className="text-text-muted hover:text-rose text-sm p-1 transition-colors">🗑️</button>
          </motion.div>
        ))}
      </div>
    </div>
  )

  // ════════ CUSTOM LIST ════════
  if (view === 'custom_list') return (
    <div className="min-h-screen bg-void">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => setView('custom_home')} className="font-body text-text-muted text-sm flex-shrink-0">←</button>
        <h1 className="font-display text-2xl italic text-text-primary flex-1 truncate">{activeCustomList?.name}</h1>
        <span className="font-body text-text-muted text-xs bg-card border border-border px-2 py-1 rounded-xl">{customItems.length}</span>
      </div>
      <div className="px-5 flex gap-2 mb-3">
        <button onClick={() => openSearch('custom')} className="flex-1 text-void font-body font-medium rounded-2xl py-3 text-sm" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>🔍 Rechercher & ajouter</button>
        <button onClick={() => setShowCustomFree(!showCustomFree)} className="px-4 rounded-2xl font-body text-sm border transition-all" style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color, background: `${currentUser?.color}10` }}>✏️</button>
      </div>
      <AnimatePresence>
        {showCustomFree && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-5 mb-3 overflow-hidden">
            <div className="flex gap-2">
              <input type="text" value={customFreeText} onChange={e => setCustomFreeText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomFreeItem()}
                placeholder="Ajouter n'importe quoi..." autoFocus className="flex-1 bg-card border border-border rounded-xl px-4 py-3 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
              <button onClick={addCustomFreeItem} disabled={!customFreeText.trim()} className="px-4 rounded-xl font-body text-sm text-void font-medium disabled:opacity-40" style={{ background: currentUser?.color }}>+</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-5 pb-6 space-y-3">
        {loadingCustom ? [...Array(3)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl h-16 animate-pulse" />) :
          customItems.length === 0 ? <div className="text-center py-14 opacity-50"><div className="text-4xl mb-2">🌸</div><p className="font-body text-text-muted text-sm">Liste vide</p></div>
          : customItems.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="flex-shrink-0 w-10 rounded-xl overflow-hidden bg-surface" style={{ height: '52px' }}>
                  {item.poster_url ? <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">{typeEmoji[item.type] || '📝'}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <p className="font-body text-text-primary text-sm font-medium flex-1 line-clamp-1">{item.title}</p>
                    <button onClick={() => deleteCustomItem(item.id)} className="text-text-muted hover:text-rose text-xs flex-shrink-0 transition-colors">🗑️</button>
                  </div>
                  <button onClick={() => toggleCustomDone(item)} className="mt-1 font-body text-[10px] px-2 py-0.5 rounded-full transition-all"
                    style={item.status === 'completed' ? { background: 'rgba(6,214,160,0.2)', color: '#06d6a0' } : { background: '#2a2a3a', color: '#8888aa' }}
                  >{item.status === 'completed' ? '✅ Fait' : '○ À faire'}</button>
                </div>
              </div>
            </motion.div>
          ))
        }
      </div>
    </div>
  )

  // ════════ WATCHLIST (principale) ════════
  return (
    <div className="min-h-screen bg-void">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-3xl italic text-text-primary">Watchlist</h1>
          <button onClick={() => { setShowNewList(false); setView('custom_home') }} className="font-body text-xs px-3 py-1.5 rounded-xl border transition-all" style={{ borderColor: `${partner?.color}40`, color: partner?.color, background: `${partner?.color}10` }}>✏️ Mes listes</button>
        </div>
        <p className="font-body text-text-muted text-xs">{items.length} éléments</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 px-5 mb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'watching', label: 'En cours', emoji: '▶️' },
          { id: 'to_watch', label: 'À voir', emoji: '📌' },
          { id: 'completed', label: 'Terminés', emoji: '✅' },
          { id: 'all', label: 'Tout', emoji: '🌐' },
        ].map(s => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className="flex-shrink-0 px-3 py-2 rounded-xl font-body text-xs font-medium transition-all"
            style={statusFilter === s.id ? { background: currentUser?.color, color: '#0a0a0f' } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
          >{s.emoji} {s.label}</button>
        ))}
      </div>

      {/* Type tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-5 mb-2 pb-1">
        {TYPE_TABS.map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)} className="flex-shrink-0 px-3 py-2 rounded-xl font-body text-xs font-medium transition-all"
            style={typeFilter === t.id ? { background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})`, color: '#fff' } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
          >{t.emoji} {t.label}</button>
        ))}
      </div>

      <div className="px-5 flex gap-2 mb-3">
        <button onClick={() => openSearch('watchlist')} className="flex-1 text-void font-body font-medium rounded-2xl py-3 text-sm" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>🔍 Rechercher & ajouter</button>
        <button onClick={() => setShowFreeInput(!showFreeInput)} className="px-4 rounded-2xl font-body text-sm border transition-all" style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color, background: `${currentUser?.color}10` }}>✏️</button>
      </div>

      <AnimatePresence>
        {showFreeInput && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-5 mb-3 overflow-hidden">
            <div className="flex gap-2">
              <input type="text" value={freeText} onChange={e => setFreeText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFreeWatchItem()}
                placeholder="Ajouter n'importe quoi..." autoFocus className="flex-1 bg-card border border-border rounded-xl px-4 py-3 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
              <button onClick={addFreeWatchItem} disabled={!freeText.trim()} className="px-4 rounded-xl font-body text-sm text-void font-medium disabled:opacity-40" style={{ background: currentUser?.color }}>+</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pb-6 space-y-3">
        {loadingItems ? [...Array(3)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl h-20 animate-pulse" />) :
          filteredItems.length === 0 ? (
            <div className="text-center py-14 opacity-50">
              <div className="text-4xl mb-2">🌸</div>
              <p className="font-body text-text-muted text-sm">{items.length === 0 ? 'Liste vide — recherche quelque chose !' : 'Aucun élément dans ce filtre'}</p>
            </div>
          ) : filteredItems.map((item, i) => {
            const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.to_watch
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="flex-shrink-0 w-12 rounded-xl overflow-hidden bg-surface" style={{ height: '64px' }}>
                    {item.poster_url ? <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">{typeEmoji[item.type] || '🎬'}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="font-body text-text-primary text-sm font-medium flex-1 line-clamp-2">{item.title}</p>
                      <button onClick={() => deleteWatchItem(item.id)} className="text-text-muted hover:text-rose text-xs flex-shrink-0 mt-0.5 transition-colors">🗑️</button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Statut — tap pour changer */}
                      <button onClick={() => cycleStatus(item)} className="font-body text-[10px] px-2 py-0.5 rounded-full transition-all"
                        style={item.status === 'completed' ? { background: 'rgba(6,214,160,0.2)', color: '#06d6a0' } : item.status === 'watching' ? { background: `${currentUser?.color}15`, color: currentUser?.color } : { background: '#2a2a3a', color: '#8888aa' }}
                      >{sc.emoji} {sc.label} →</button>
                      {item.type === 'series' && item.season_number && <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">S{item.season_number}</span>}
                      {item.type === 'series' && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button onClick={() => updateEp(item.id, -1, item)} className="w-5 h-5 bg-surface rounded-full text-text-secondary text-xs flex items-center justify-center">−</button>
                          <span className="font-mono text-[10px] text-text-muted">Ép. {item.current_episode || 0}{item.total_episodes ? `/${item.total_episodes}` : ''}</span>
                          <button onClick={() => updateEp(item.id, 1, item)} className="w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: `${currentUser?.color}20`, color: currentUser?.color }}>+</button>
                        </div>
                      )}
                    </div>
                    {item.type === 'series' && item.total_episodes && (
                      <div className="mt-1.5 bg-surface rounded-full h-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((item.current_episode || 0) / item.total_episodes) * 100)}%`, background: `linear-gradient(90deg, ${currentUser?.color}, ${partner?.color})` }} />
                      </div>
                    )}
                  </div>
                </div>
                <Link to={`/watchlist/${item.id}`}>
                  <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between hover:bg-surface/50 transition-colors">
                    <span className="font-body text-text-muted text-xs">Fiche · Notes · Photos · Capsule</span>
                    <span className="text-text-muted text-xs">→</span>
                  </div>
                </Link>
              </motion.div>
            )
          })
        }
      </div>
    </div>
  )
}
