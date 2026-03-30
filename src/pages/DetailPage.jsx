import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { tmdb, googleImages, giphy } from '../lib/api'
import { USERS } from './LoginPage'

export default function DetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, partner } = useUser()
  const [view, setView] = useState('sheet')
  const [item, setItem] = useState(null)
  const [tmdbDetails, setTmdbDetails] = useState(null)
  const [allSeasons, setAllSeasons] = useState([])
  const [newSeasonAlert, setNewSeasonAlert] = useState(null)

  // Notes
  const [notes, setNotes] = useState({})
  const [myNote, setMyNote] = useState({ scenario: 5, music: 5, actors: 5, text: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Photos recap
  const [photoRecapEnabled, setPhotoRecapEnabled] = useState(false)
  const [myPhotos, setMyPhotos] = useState([]) // photos de cet épisode par moi
  const [partnerPhotos, setPartnerPhotos] = useState([]) // photos de cet épisode par le partenaire
  const [mySubmitted, setMySubmitted] = useState(false) // ai-je soumis mes photos pour cet épisode ?
  const [partnerSubmitted, setPartnerSubmitted] = useState(false)
  const [photoHistory, setPhotoHistory] = useState([]) // historique tous épisodes
  const [imgTab, setImgTab] = useState('images')
  const [imgQuery, setImgQuery] = useState('')
  const [imgResults, setImgResults] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [mySelections, setMySelections] = useState([])

  // Capsule
  const [capsule, setCapsule] = useState({ before_text: '', after_text: '' })

  // Citations
  const [citations, setCitations] = useState([])
  const [newCitation, setNewCitation] = useState('')
  const [showCitInput, setShowCitInput] = useState(false)

  // Media
  const [mediaItems, setMediaItems] = useState([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const audioChunksRef = useRef([])

  const searchInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: w }, { data: n }, { data: c }, { data: ph }, { data: cit }, { data: media }] = await Promise.all([
      supabase.from('watchlist').select('*').eq('id', id).single(),
      supabase.from('notes').select('*').eq('watchlist_id', id),
      supabase.from('capsules').select('*').eq('watchlist_id', id).eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('photo_recaps').select('*').eq('watchlist_id', id).order('episode_number').order('created_at'),
      supabase.from('citations').select('*').eq('watchlist_id', id).order('created_at', { ascending: false }),
      supabase.from('media_items').select('*').eq('watchlist_id', id).order('created_at', { ascending: false }),
    ])
    setItem(w)
    setPhotoRecapEnabled(w?.photo_recap_enabled || false)

    const nMap = {}
    n?.forEach(x => { nMap[x.user_id] = x })
    setNotes(nMap)
    const myN = n?.find(x => x.user_id === currentUser.id)
    if (myN) setMyNote({ scenario: myN.scenario || 5, music: myN.music || 5, actors: myN.actors || 5, text: myN.text || '' })
    if (c) setCapsule({ before_text: c.before_text || '', after_text: c.after_text || '' })

    // Photo recap — séparer par épisode courant et historique
    const currentEp = w?.current_episode || 0
    const currentEpPhotos = (ph || []).filter(p => p.episode_number === currentEp)
    const myCurrentPhotos = currentEpPhotos.filter(p => p.user_id === currentUser.id)
    const partnerCurrentPhotos = currentEpPhotos.filter(p => p.user_id === partner?.id)

    setMyPhotos(myCurrentPhotos)
    setPartnerPhotos(partnerCurrentPhotos)
    setMySubmitted(myCurrentPhotos.some(p => p.submitted))
    setPartnerSubmitted(partnerCurrentPhotos.some(p => p.submitted))
    setPhotoHistory(ph || [])

    setCitations(cit || [])
    setMediaItems(media || [])

    // TMDB details
    if (w?.external_id && w?.type === 'series') {
      try {
        const details = await tmdb.getSeriesDetails(w.external_id)
        setTmdbDetails(details)
        const { data: seasons } = await supabase.from('watchlist').select('*').eq('external_id', w.external_id).neq('id', id).order('season_number')
        setAllSeasons(seasons || [])
        const currentSeason = w.season_number || 1
        const { newSeasons } = await tmdb.checkNewSeasons(w.external_id, currentSeason)
        const existingNums = (seasons || []).map(s => s.season_number)
        const trulyNew = newSeasons.filter(s => !existingNums.includes(s.number))
        if (trulyNew.length > 0) setNewSeasonAlert(trulyNew[0])
      } catch (e) { console.error(e) }
    } else if (w?.external_id && w?.type === 'movie') {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${w.external_id}?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=fr-FR&append_to_response=credits`)
        setTmdbDetails(await res.json())
      } catch (e) { console.error(e) }
    }
  }

  async function addNewSeason(season) {
    await supabase.from('watchlist').insert({
      external_id: item.external_id, type: 'series',
      title: `${item.title.replace(/ — Saison \d+$/, '')} — Saison ${season.number}`,
      poster_url: season.poster_path ? `https://image.tmdb.org/t/p/w500${season.poster_path}` : item.poster_url,
      synopsis: item.synopsis, total_episodes: season.episode_count,
      current_episode: 0, status: 'to_watch', season_number: season.number, added_by: currentUser.id,
    })
    setNewSeasonAlert(null)
    navigate('/lists')
  }

  // ── Notes ───────────────────────────────────────────────────
  async function saveNote() {
    setSaving(true)
    await supabase.from('notes').upsert({ watchlist_id: id, user_id: currentUser.id, scenario: myNote.scenario, music: myNote.music, actors: myNote.actors, text: myNote.text, updated_at: new Date().toISOString() }, { onConflict: 'watchlist_id,user_id' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchAll()
  }

  // ── Photo Recap ─────────────────────────────────────────────
  async function togglePhotoRecap() {
    const v = !photoRecapEnabled
    setPhotoRecapEnabled(v)
    await supabase.from('watchlist').update({ photo_recap_enabled: v }).eq('id', id)
  }

  function openPhotoSearch() {
    setImgQuery(''); setImgResults([]); setMySelections([])
    setView('photo_search')
    setTimeout(() => searchInputRef.current?.focus(), 200)
  }

  function handleImgInput(e) {
    const q = e.target.value; setImgQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchMedia(q, imgTab), 400)
  }

  function changeImgTab(t) {
    setImgTab(t); setImgResults([])
    if (imgQuery.trim()) searchMedia(imgQuery, t)
  }

  async function searchMedia(q, tab) {
    if (!q.trim()) return
    setImgLoading(true)
    try {
      const results = tab === 'gif' ? await giphy.search(q) : await googleImages.search(q)
      setImgResults(results)
    } catch (e) { console.error(e) }
    setImgLoading(false)
  }

  function toggleSel(img) {
    setMySelections(p => p.find(x => x.url === img.url) ? p.filter(x => x.url !== img.url) : p.length < 4 ? [...p, img] : p)
  }

  async function submitPhotos() {
    if (!mySelections.length) return
    const ep = item?.current_episode || 0
    // Supprimer les anciennes photos non soumises de cet épisode
    const oldIds = myPhotos.filter(p => !p.submitted).map(p => p.id)
    if (oldIds.length) await supabase.from('photo_recaps').delete().in('id', oldIds)
    // Insérer les nouvelles avec submitted=true
    await supabase.from('photo_recaps').insert(mySelections.map(img => ({
      watchlist_id: id, user_id: currentUser.id, photo_url: img.url,
      episode_number: ep, submitted: true, episode_submitted_at: new Date().toISOString()
    })))
    setMySelections([]); setView('photos'); fetchAll()
  }

  async function deleteMyPhoto(photoId) {
    if (!window.confirm('Supprimer cette image ?')) return
    await supabase.from('photo_recaps').delete().eq('id', photoId)
    fetchAll()
  }

  async function resetMyPhotos() {
    if (!window.confirm('Modifier tes images ? Elles seront supprimées et tu pourras en choisir de nouvelles.')) return
    const myIds = myPhotos.map(p => p.id)
    if (myIds.length) await supabase.from('photo_recaps').delete().in('id', myIds)
    setMySubmitted(false)
    fetchAll()
  }

  // ── Capsule ─────────────────────────────────────────────────
  async function saveCapsule() {
    await supabase.from('capsules').upsert({ watchlist_id: id, user_id: currentUser.id, before_text: capsule.before_text, after_text: item?.status === 'completed' ? capsule.after_text : undefined, updated_at: new Date().toISOString() }, { onConflict: 'watchlist_id,user_id' })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  // ── Citations ───────────────────────────────────────────────
  async function addCitation() {
    if (!newCitation.trim()) return
    await supabase.from('citations').insert({ watchlist_id: id, user_id: currentUser.id, text: newCitation.trim() })
    setNewCitation(''); setShowCitInput(false); fetchAll()
  }

  async function deleteCitation(citId) {
    if (!window.confirm('Supprimer ce moment ?')) return
    await supabase.from('citations').delete().eq('id', citId)
    setCitations(p => p.filter(x => x.id !== citId))
  }

  // ── Media upload ─────────────────────────────────────────────
  async function uploadFile(file, type) {
    setUploadingMedia(true)
    try {
      const ext = file.name.split('.').pop() || (type === 'audio' ? 'webm' : type === 'video' ? 'mp4' : 'jpg')
      const path = `${currentUser.id}/${id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, {
          contentType: file.type || (type === 'audio' ? 'audio/webm' : type === 'video' ? 'video/mp4' : 'image/jpeg'),
          upsert: false
        })
      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Erreur upload : ' + uploadError.message)
        setUploadingMedia(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      await supabase.from('media_items').insert({
        watchlist_id: id,
        user_id: currentUser.id,
        type,
        url: publicUrl,
        storage_path: path
      })
      fetchAll()
    } catch (e) {
      console.error('Upload exception:', e)
      alert('Erreur : ' + e.message)
    }
    setUploadingMedia(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video') ? 'video' : 'photo'
    uploadFile(file, type)
    e.target.value = ''
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `vocal_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await uploadFile(file, 'audio')
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (e) { alert('Microphone non accessible') }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    clearInterval(recordingTimerRef.current)
    setRecording(false)
    setRecordingTime(0)
  }

  async function deleteMedia(mediaId, storagePath) {
    if (!window.confirm('Supprimer ce média ?')) return
    if (storagePath) await supabase.storage.from('media').remove([storagePath])
    await supabase.from('media_items').delete().eq('id', mediaId)
    setMediaItems(p => p.filter(m => m.id !== mediaId))
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const score = (n) => n ? ((n.scenario + n.music + n.actors) / 3).toFixed(1) : null

  // Photo history grouped by episode
  const byEp = photoHistory.reduce((a, p) => { const e = p.episode_number || 0; if (!a[e]) a[e] = []; a[e].push(p); return a }, {})

  if (!item) return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" /></div>

  const BackHeader = ({ label, onBack }) => (
    <div className="flex-shrink-0 bg-void px-4 pt-5 pb-3 border-b border-border flex items-center gap-3">
      <button onClick={onBack} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl flex-shrink-0">← Retour</button>
      <p className="font-body text-text-primary text-sm font-medium truncate flex-1">{label}</p>
    </div>
  )

  // ════════ PHOTO SEARCH ════════
  if (view === 'photo_search') return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex-shrink-0 bg-void px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setView('photos')} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl">← Retour</button>
          <p className="font-body text-text-primary text-sm font-medium flex-1">Mes 4 images — Ép. {item.current_episode || 0}</p>
          <span className="font-body text-text-muted text-xs">{mySelections.length}/4</span>
        </div>
        {mySelections.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {mySelections.map((img, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden relative">
                <img src={img.thumb || img.url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => toggleSel(img)} className="absolute top-0.5 right-0.5 bg-void/70 rounded-full w-4 h-4 flex items-center justify-center text-rose text-[10px]">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mb-3">
          {[['images', '🖼️ Photos'], ['gif', '🎞️ GIFs']].map(([t, l]) => (
            <button key={t} onClick={() => changeImgTab(t)} className="flex-1 py-2 rounded-xl font-body text-xs font-medium transition-all"
              style={imgTab === t ? { background: currentUser?.color, color: '#0a0a0f' } : { background: '#1a1a26', border: '1px solid #2a2a3a', color: '#8888aa' }}
            >{l}</button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">🔍</span>
          <input ref={searchInputRef} type="text" value={imgQuery} onChange={handleImgInput}
            placeholder="Chercher..." className="w-full bg-card border border-border rounded-2xl pl-10 pr-4 py-3.5 font-body text-text-primary placeholder-text-muted focus:outline-none" style={{ fontSize: '16px' }} />
          {imgLoading && <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-border rounded-full animate-spin block" style={{ borderTopColor: currentUser?.color }} />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!imgQuery && <div className="text-center py-12 opacity-40"><p className="font-body text-text-muted text-sm">Tape pour chercher des images</p></div>}
        {imgResults.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {imgResults.map((img, i) => {
              const sel = mySelections.find(s => s.url === img.url)
              return (
                <button key={i} onClick={() => toggleSel(img)} className="aspect-square rounded-xl overflow-hidden relative border-2 transition-all" style={{ borderColor: sel ? currentUser?.color : 'transparent' }}>
                  <img src={img.thumb || img.url} alt="" className="w-full h-full object-cover" onError={e => e.target.parentElement.style.display = 'none'} />
                  {sel && <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${currentUser?.color}50` }}><span className="text-white text-xl font-bold">✓</span></div>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {mySelections.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-border bg-void">
          <button onClick={submitPhotos} className="w-full text-void font-body font-medium rounded-xl py-3.5" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>
            ✓ Soumettre mes {mySelections.length} image{mySelections.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )

  // ════════ NOTES ════════
  if (view === 'notes') return (
    <div className="min-h-screen bg-void flex flex-col">
      <BackHeader label={`Notes — ${item.title}`} onBack={() => setView('sheet')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {[currentUser, partner].map(u => {
          const isMe = u?.id === currentUser?.id
          const nd = isMe ? myNote : notes[u?.id]
          return (
            <div key={u?.id} className="bg-card border rounded-2xl p-5" style={{ borderColor: `${u?.color}30` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: u?.colorBg, color: u?.color }}>{u?.initial}</div>
                <h3 className="font-body font-medium" style={{ color: u?.color }}>Note de {u?.name}</h3>
                {nd && <span className="ml-auto font-display text-2xl italic" style={{ color: u?.color }}>{score(isMe ? myNote : nd)}<span className="font-body text-text-muted text-xs">/10</span></span>}
              </div>
              {!nd && !isMe ? (
                <p className="font-body text-text-muted text-sm text-center py-3 opacity-60">{u?.name} n'a pas encore noté 🕐</p>
              ) : (
                <>
                  {[['scenario', 'Scénario'], ['music', 'Musique'], ['actors', 'Acteurs']].map(([k, l]) => (
                    <div key={k} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-text-secondary text-xs">{l}</span>
                        <span className="font-mono text-xs font-medium" style={{ color: u?.color }}>{(isMe ? myNote[k] : nd?.[k]) || 0}/10</span>
                      </div>
                      {isMe
                        ? <input type="range" min="0" max="10" step="0.5" value={myNote[k]} onChange={e => setMyNote(p => ({ ...p, [k]: parseFloat(e.target.value) }))} className="w-full" style={{ accentColor: u?.color }} />
                        : <div className="bg-surface rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${((nd?.[k] || 0) / 10) * 100}%`, background: u?.color }} /></div>
                      }
                    </div>
                  ))}
                  {isMe && <>
                    <textarea value={myNote.text} onChange={e => setMyNote(p => ({ ...p, text: e.target.value }))} placeholder="Mon avis..." rows={3}
                      className="w-full mt-2 bg-surface border border-border rounded-xl px-4 py-3 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none resize-none" style={{ fontSize: '16px' }} />
                    <button onClick={saveNote} disabled={saving} className="w-full mt-3 text-void font-body font-medium rounded-xl py-3 disabled:opacity-50 transition-all"
                      style={{ background: saved ? '#06d6a0' : `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}
                    >{saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé !' : '💾 Sauvegarder'}</button>
                  </>}
                  {!isMe && nd?.text && <p className="font-body text-text-secondary text-sm mt-3 italic border-l-2 pl-3" style={{ borderColor: u?.color }}>"{nd.text}"</p>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ════════ PHOTOS ════════
  if (view === 'photos') return (
    <div className="min-h-screen bg-void flex flex-col">
      <div className="flex-shrink-0 bg-void px-4 pt-5 pb-3 border-b border-border flex items-center gap-3">
        <button onClick={() => setView('sheet')} className="font-body text-text-muted text-sm px-3 py-1.5 bg-card border border-border rounded-xl">← Retour</button>
        <p className="font-body text-text-primary text-sm font-medium flex-1 truncate">Photo-Recap — {item.title}</p>
        <div className="flex items-center gap-2">
          <span className="font-body text-text-muted text-xs">📸</span>
          <button onClick={togglePhotoRecap} className="w-10 h-5 rounded-full transition-all flex items-center px-0.5" style={{ background: photoRecapEnabled ? currentUser?.color : '#2a2a3a' }}>
            <motion.div animate={{ x: photoRecapEnabled ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="w-4 h-4 bg-white rounded-full" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {!photoRecapEnabled ? (
          <div className="text-center py-16 opacity-60"><div className="text-4xl mb-2">📸</div><p className="font-body text-text-secondary text-sm">Active le Photo-Recap avec le bouton en haut</p></div>
        ) : (
          <>
            {/* Épisode courant */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="font-body text-text-primary text-sm font-medium mb-3">Épisode {item.current_episode || 0} — En cours</p>

              {/* Mes photos */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-body text-xs font-medium" style={{ color: currentUser?.color }}>{currentUser?.name}</p>
                  {mySubmitted && <button onClick={resetMyPhotos} className="font-body text-[10px] px-2 py-0.5 rounded-full border transition-all" style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color }}>✏️ Modifier</button>}
                </div>
                {mySubmitted ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {myPhotos.map((p, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden relative group">
                        <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => deleteMyPhoto(p.id)} className="absolute top-0.5 right-0.5 bg-void/70 rounded-full w-4 h-4 hidden group-hover:flex items-center justify-center text-rose text-[10px]">✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={openPhotoSearch} className="w-full border border-dashed rounded-xl py-4 text-center font-body text-sm transition-all" style={{ borderColor: `${currentUser?.color}40`, color: currentUser?.color }}>
                    + Choisir mes 4 images
                  </button>
                )}
              </div>

              {/* Photos partenaire */}
              <div>
                <p className="font-body text-xs font-medium mb-2" style={{ color: partner?.color }}>{partner?.name}</p>
                {!mySubmitted ? (
                  <div className="bg-surface rounded-xl p-4 text-center">
                    <p className="font-body text-text-muted text-xs">Soumets tes images d'abord pour voir celles de {partner?.name} 🔒</p>
                  </div>
                ) : !partnerSubmitted ? (
                  <div className="bg-surface rounded-xl p-4 text-center">
                    <p className="font-body text-text-muted text-xs">{partner?.name} n'a pas encore soumis ses images 🕐</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {partnerPhotos.map((p, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden">
                        <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Historique épisodes précédents */}
            {Object.keys(byEp).filter(ep => parseInt(ep) !== (item.current_episode || 0)).sort((a, b) => b - a).map(ep => (
              <div key={ep} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border"><p className="font-body text-text-primary text-sm font-medium">Épisode {ep}</p></div>
                <div className="p-4 space-y-3">
                  {[currentUser, partner].map(u => {
                    const photos = byEp[ep].filter(p => p.user_id === u?.id)
                    return (
                      <div key={u?.id}>
                        <p className="font-body text-xs mb-2 font-medium" style={{ color: u?.color }}>{u?.name}</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-surface">
                              {photos[i] ? <img src={photos[i].photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-text-muted/30 text-xs">?</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )

  // ════════ CAPSULE ════════
  if (view === 'capsule') return (
    <div className="min-h-screen bg-void flex flex-col">
      <BackHeader label="Capsule temporelle" onBack={() => setView('sheet')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-body font-medium text-text-primary mb-1">✍️ Avant de regarder</h3>
          <textarea value={capsule.before_text} onChange={e => setCapsule(p => ({ ...p, before_text: e.target.value }))} placeholder="Mes attentes..." rows={6}
            className="w-full mt-2 bg-surface border border-border rounded-xl px-4 py-3 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none resize-none" style={{ fontSize: '16px' }} />
        </div>
        <div className="bg-card border rounded-2xl p-5 relative overflow-hidden" style={{ borderColor: 'rgba(255,209,102,0.3)' }}>
          {item?.status !== 'completed' && (
            <div className="absolute inset-0 bg-void/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
              <div className="text-4xl mb-2">🔒</div>
              <p className="font-body text-text-secondary text-sm text-center px-6">S'ouvre quand c'est terminé</p>
            </div>
          )}
          <h3 className="font-body font-medium mb-1" style={{ color: '#ffd166' }}>💌 Après avoir regardé</h3>
          <textarea value={capsule.after_text} onChange={e => setCapsule(p => ({ ...p, after_text: e.target.value }))} disabled={item?.status !== 'completed'} placeholder="Mes vraies impressions..." rows={6}
            className="w-full mt-2 bg-surface border border-border rounded-xl px-4 py-3 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none resize-none disabled:opacity-50" style={{ fontSize: '16px' }} />
        </div>
        <button onClick={saveCapsule} className="w-full text-void font-body font-medium rounded-xl py-3.5 transition-all"
          style={{ background: saved ? '#06d6a0' : `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}
        >{saved ? '✓ Sauvegardé !' : '💾 Sauvegarder'}</button>
      </div>
    </div>
  )

  // ════════ CITATIONS ════════
  if (view === 'citations') return (
    <div className="min-h-screen bg-void flex flex-col">
      <BackHeader label="Moments forts" onBack={() => setView('sheet')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <button onClick={() => setShowCitInput(true)} className="w-full text-void font-body font-medium rounded-2xl py-3.5" style={{ background: `linear-gradient(135deg, ${currentUser?.color}, ${partner?.color})` }}>+ Ajouter un moment mémorable</button>
        <AnimatePresence>
          {showCitInput && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-4">
                <textarea value={newCitation} onChange={e => setNewCitation(e.target.value)} placeholder="Une réplique, une scène, un moment..." rows={3} autoFocus
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-body text-text-primary text-sm placeholder-text-muted focus:outline-none resize-none mb-3" style={{ fontSize: '16px' }} />
                <div className="flex gap-2">
                  <button onClick={() => setShowCitInput(false)} className="flex-1 bg-surface border border-border rounded-xl py-2.5 font-body text-text-muted text-sm">Annuler</button>
                  <button onClick={addCitation} className="flex-1 text-void font-body text-sm font-medium rounded-xl py-2.5" style={{ background: currentUser?.color }}>Ajouter</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {citations.length === 0 ? (
          <div className="text-center py-12 opacity-50"><div className="text-4xl mb-2">💬</div><p className="font-body text-text-muted text-sm">Aucun moment pour l'instant</p></div>
        ) : citations.map(c => {
          const auth = USERS[c.user_id]
          return (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: auth?.colorBg, color: auth?.color }}>{auth?.initial}</div>
                <span className="font-body text-xs" style={{ color: auth?.color }}>{auth?.name}</span>
                <button onClick={() => deleteCitation(c.id)} className="ml-auto text-text-muted hover:text-rose text-xs transition-colors">🗑️</button>
              </div>
              <p className="font-body text-text-secondary text-sm italic">"{c.text}"</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ════════ MÉDIAS ════════
  if (view === 'media') return (
    <div className="min-h-screen bg-void flex flex-col">
      <BackHeader label="Médias" onBack={() => setView('sheet')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Upload buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Photo */}
          <button onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() }}
            className="bg-card border border-border rounded-2xl py-4 flex flex-col items-center gap-2 transition-all"
            style={{ borderColor: `${currentUser?.color}30` }}
          >
            <span className="text-2xl">📸</span>
            <span className="font-body text-xs text-text-secondary">Photo</span>
          </button>

          {/* Vidéo */}
          <button onClick={() => { fileInputRef.current.accept = 'video/*'; fileInputRef.current.click() }}
            className="bg-card border border-border rounded-2xl py-4 flex flex-col items-center gap-2 transition-all"
            style={{ borderColor: `${partner?.color}30` }}
          >
            <span className="text-2xl">🎥</span>
            <span className="font-body text-xs text-text-secondary">Vidéo</span>
          </button>

          {/* Vocal */}
          <button
            onClick={recording ? stopRecording : startRecording}
            className="bg-card border border-border rounded-2xl py-4 flex flex-col items-center gap-2 transition-all"
            style={recording ? { borderColor: '#ff6b9d', background: 'rgba(255,107,157,0.1)' } : { borderColor: 'rgba(255,209,102,0.3)' }}
          >
            <motion.span className="text-2xl" animate={recording ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}>🎙️</motion.span>
            <span className="font-body text-xs" style={{ color: recording ? '#ff6b9d' : '#8888aa' }}>{recording ? formatTime(recordingTime) : 'Vocal'}</span>
          </button>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

        {uploadingMedia && (
          <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-border rounded-full animate-spin flex-shrink-0" style={{ borderTopColor: currentUser?.color }} />
            <p className="font-body text-text-muted text-sm">Upload en cours...</p>
          </div>
        )}

        {/* Media list */}
        {mediaItems.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            <div className="text-4xl mb-2">🎬</div>
            <p className="font-body text-text-muted text-sm">Aucun média pour l'instant</p>
            <p className="font-body text-text-muted text-xs mt-1">Ajoute une photo, vidéo ou vocal !</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mediaItems.map(media => {
              const auth = USERS[media.user_id]
              const isMe = media.user_id === currentUser.id
              return (
                <div key={media.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: auth?.colorBg, color: auth?.color }}>{auth?.initial}</div>
                    <span className="font-body text-xs" style={{ color: auth?.color }}>{auth?.name}</span>
                    <span className="font-body text-text-muted text-xs ml-1">{media.type === 'photo' ? '📸' : media.type === 'video' ? '🎥' : '🎙️'}</span>
                    {isMe && <button onClick={() => deleteMedia(media.id, media.storage_path)} className="ml-auto text-text-muted hover:text-rose text-xs transition-colors">🗑️</button>}
                  </div>
                  {media.type === 'photo' && <img src={media.url} alt="" className="w-full max-h-64 object-cover" />}
                  {media.type === 'video' && <video src={media.url} controls className="w-full max-h-64" />}
                  {media.type === 'audio' && (
                    <div className="px-4 py-3">
                      <audio src={media.url} controls className="w-full" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ════════ SHEET ════════
  const cast = tmdbDetails?.credits?.cast?.slice(0, 8) || []
  const myNoteScore = notes[currentUser?.id] ? score(notes[currentUser?.id]) : null
  const partnerNoteScore = notes[partner?.id] ? score(notes[partner?.id]) : null
  const seasonNumber = item.season_number || 1

  return (
    <div className="min-h-screen bg-void">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ height: '55vw', maxHeight: '280px' }}>
        {item.poster_url ? <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-7xl" style={{ background: `${currentUser?.color}10` }}>{item.type === 'game' ? '🎮' : '🎬'}</div>}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.1), rgba(10,10,15,1))' }} />
        <button onClick={() => navigate(-1)} className="absolute top-5 left-5 bg-void/60 backdrop-blur-sm rounded-xl px-3 py-1.5 font-body text-text-secondary text-xs">← Retour</button>
      </div>

      {/* New season alert */}
      <AnimatePresence>
        {newSeasonAlert && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-5 mb-4 rounded-2xl p-4 border" style={{ background: 'rgba(255,209,102,0.1)', borderColor: 'rgba(255,209,102,0.4)' }}
          >
            <p className="font-body text-sm font-medium" style={{ color: '#ffd166' }}>🎉 Saison {newSeasonAlert.number} disponible !</p>
            <p className="font-body text-text-muted text-xs mt-0.5 mb-3">{newSeasonAlert.episode_count} épisodes</p>
            <div className="flex gap-2">
              <button onClick={() => setNewSeasonAlert(null)} className="flex-1 bg-surface border border-border rounded-xl py-2 font-body text-text-muted text-xs">Ignorer</button>
              <button onClick={() => addNewSeason(newSeasonAlert)} className="flex-1 text-void font-body text-xs font-medium rounded-xl py-2" style={{ background: '#ffd166' }}>+ Ajouter</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <div className="px-5 mb-3">
        <h1 className="font-display text-2xl italic text-text-primary">{item.title}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.type === 'series' && <span className="font-body text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted">Saison {seasonNumber}</span>}
          {item.status === 'watching' && item.total_episodes && <span className="font-body text-xs px-2 py-0.5 rounded-full" style={{ background: `${currentUser?.color}20`, color: currentUser?.color }}>▶️ Ép. {item.current_episode || 0}/{item.total_episodes}</span>}
          {item.status === 'completed' && <span className="font-body text-xs px-2 py-0.5 rounded-full bg-teal/20 text-teal">✅ Terminé</span>}
          {item.status === 'to_watch' && <span className="font-body text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">📌 À voir</span>}
          {tmdbDetails?.vote_average && <span className="font-mono text-xs" style={{ color: '#ffd166' }}>★ {tmdbDetails.vote_average?.toFixed(1)}</span>}
          {(myNoteScore || partnerNoteScore) && <>
            {myNoteScore && <span className="font-body text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${currentUser?.color}15`, color: currentUser?.color }}>{currentUser?.initial} {myNoteScore}/10</span>}
            {partnerNoteScore && <span className="font-body text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${partner?.color}15`, color: partner?.color }}>{partner?.initial} {partnerNoteScore}/10</span>}
          </>}
        </div>
      </div>

      {/* Autres saisons */}
      {allSeasons.length > 0 && (
        <div className="px-5 mb-3">
          <p className="font-body text-text-muted text-xs uppercase tracking-wider mb-2">Autres saisons</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {allSeasons.map(s => (
              <button key={s.id} onClick={() => navigate(`/watchlist/${s.id}`)}
                className="flex-shrink-0 bg-card border border-border rounded-xl px-3 py-2 font-body text-xs transition-all"
                style={{ color: currentUser?.color }}
              >Saison {s.season_number || '?'} {s.status === 'completed' ? '✅' : s.status === 'watching' ? '▶️' : '📌'}</button>
            ))}
          </div>
        </div>
      )}

      {/* Synopsis */}
      {item.synopsis && <div className="px-5 mb-4"><p className="font-body text-text-secondary text-sm leading-relaxed">{item.synopsis}</p></div>}

      {/* Cast */}
      {cast.length > 0 && (
        <div className="mb-4">
          <p className="font-body text-text-muted text-xs uppercase tracking-wider px-5 mb-3">Acteurs principaux</p>
          <div className="flex gap-3 px-5 overflow-x-auto no-scrollbar pb-1">
            {cast.map(actor => (
              <div key={actor.id} className="flex-shrink-0 text-center w-16">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-surface mx-auto mb-1">
                  {actor.profile_path ? <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">⭐</div>}
                </div>
                <p className="font-body text-text-muted text-[9px] line-clamp-2 leading-tight">{actor.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="px-5 pb-6 space-y-3">
        <p className="font-body text-text-muted text-xs uppercase tracking-wider">Vos contenus</p>
        {[
          { key: 'notes', label: 'Notes', emoji: '⭐', desc: myNoteScore ? `${currentUser?.name} : ${myNoteScore}/10${partnerNoteScore ? ` · ${partner?.name} : ${partnerNoteScore}/10` : ''}` : 'Pas encore noté', color: currentUser?.color },
          { key: 'photos', label: 'Photo-Recap', emoji: '📸', desc: photoRecapEnabled ? (mySubmitted ? `Tes images soumises ✓` : `Choisis tes 4 images — Ép. ${item.current_episode || 0}`) : 'Désactivé', color: partner?.color },
          { key: 'media', label: 'Médias', emoji: '🎬', desc: `${mediaItems.length} fichier${mediaItems.length !== 1 ? 's' : ''} — photos, vidéos, vocaux`, color: '#ffd166' },
          { key: 'capsule', label: 'Capsule temporelle', emoji: '💌', desc: item.status === 'completed' ? 'Débloquée ✓' : 'Se débloque à la fin', color: '#ffd166' },
          { key: 'citations', label: 'Moments forts', emoji: '💬', desc: `${citations.length} moment${citations.length !== 1 ? 's' : ''} enregistré${citations.length !== 1 ? 's' : ''}`, color: currentUser?.color },
        ].map(section => (
          <motion.button key={section.key} whileTap={{ scale: 0.97 }}
            onClick={() => setView(section.key)}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 text-left"
            style={{ borderColor: `${section.color}25` }}
          >
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${section.color}15` }}>{section.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-text-primary font-medium text-sm">{section.label}</p>
              <p className="font-body text-text-muted text-xs mt-0.5 truncate">{section.desc}</p>
            </div>
            <span style={{ color: section.color }}>→</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
