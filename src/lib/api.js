// ─── TMDB ─────────────────────────────────────────────────────
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY

export const tmdb = {
  imgUrl: (path, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : null,

  async searchSeries(query) {
    const res = await fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`)
    const data = await res.json()
    return (data.results || []).map(r => ({ ...r, media_type: 'series' }))
  },

  async searchMovies(query) {
    const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`)
    const data = await res.json()
    return (data.results || []).map(r => ({ ...r, media_type: 'movie' }))
  },

  async searchActors(query) {
    const res = await fetch(`${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`)
    const data = await res.json()
    return (data.results || []).map(r => ({ ...r, media_type: 'actor' }))
  },

  async getSeriesDetails(id) {
    const res = await fetch(`${TMDB_BASE}/tv/${id}?api_key=${TMDB_KEY}&language=fr-FR&append_to_response=credits,seasons`)
    return res.json()
  },

  async getSeasonDetails(seriesId, seasonNumber) {
    const res = await fetch(`${TMDB_BASE}/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_KEY}&language=fr-FR`)
    return res.json()
  },

  // Récupère épisodes saison 1 + durée épisode
  async getSeriesInfo(seriesId) {
    try {
      const res = await fetch(`${TMDB_BASE}/tv/${seriesId}?api_key=${TMDB_KEY}&language=fr-FR&append_to_response=seasons`)
      const details = await res.json()

      // Trouver la saison 1 (ignorer saison 0 = spéciaux)
      const seasons = (details.seasons || []).filter(s => s.season_number > 0)
      const season1 = seasons.find(s => s.season_number === 1)
      const totalEpisodes = season1?.episode_count || null

      // Durée d'un épisode
      const episodeDuration = details.episode_run_time?.[0] || 45

      return { totalEpisodes, episodeDuration }
    } catch (e) {
      console.error('TMDB getSeriesInfo error:', e)
      return { totalEpisodes: null, episodeDuration: 45 }
    }
  },

  // Vérifie si de nouvelles saisons sont disponibles
  async checkNewSeasons(seriesId, currentSeason) {
    try {
      const res = await fetch(`${TMDB_BASE}/tv/${seriesId}?api_key=${TMDB_KEY}&language=fr-FR&append_to_response=seasons`)
      const details = await res.json()
      const today = new Date()
      const newSeasons = []

      for (const season of (details.seasons || [])) {
        if (season.season_number <= 0) continue
        if (season.season_number <= currentSeason) continue
        if (!season.air_date) continue
        const airDate = new Date(season.air_date)
        if (airDate <= today) {
          newSeasons.push({
            number: season.season_number,
            episode_count: season.episode_count,
            air_date: season.air_date,
            poster_path: season.poster_path || details.poster_path,
          })
        }
      }
      return { series: details, newSeasons }
    } catch (e) {
      return { series: null, newSeasons: [] }
    }
  },
}

// ─── RAWG ──────────────────────────────────────────────────────
const RAWG_BASE = 'https://api.rawg.io/api'
const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY

export const rawg = {
  async search(query) {
    try {
      const res = await fetch(`${RAWG_BASE}/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&page_size=6&search_precise=true`)
      const data = await res.json()
      return (data.results || []).map(r => ({ ...r, media_type: 'game' }))
    } catch (e) { return [] }
  },
}

// ─── GIPHY ─────────────────────────────────────────────────────
const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY

const KDRAMA_HUG_TAGS = [
  'kdrama hug cute',
  'korean drama hug sweet',
  'kpop idol hug sweet',
  'kdrama friends hug',
  'kpop cute hug',
  'korean drama sweet moment',
]

export const giphy = {
  async randomKdramaHug() {
    const tag = KDRAMA_HUG_TAGS[Math.floor(Math.random() * KDRAMA_HUG_TAGS.length)]
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(tag)}&limit=20&rating=g`)
      const data = await res.json()
      const blocked = ['kiss', 'bisou', 'romantic', 'sexy', 'hot', 'passionate']
      const gifs = (data.data || []).filter(g => {
        const title = (g.title || '').toLowerCase()
        return !blocked.some(w => title.includes(w))
      })
      if (!gifs.length) return null
      const pick = gifs[Math.floor(Math.random() * gifs.length)]
      return { url: pick.images?.original?.url, preview: pick.images?.fixed_height?.url }
    } catch (e) { return null }
  },

  async search(query) {
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g`)
      const data = await res.json()
      return (data.data || []).map(g => ({ url: g.images?.original?.url, thumb: g.images?.fixed_height?.url }))
    } catch (e) { return [] }
  },
}

// ─── GOOGLE CUSTOM SEARCH ──────────────────────────────────────
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_SEARCH_KEY
const GOOGLE_CX = import.meta.env.VITE_GOOGLE_SEARCH_CX

export const googleImages = {
  async search(query) {
    if (GOOGLE_KEY && GOOGLE_CX) {
      try {
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&searchType=image&num=9&imgSize=medium&safe=active`)
        const data = await res.json()
        if (data.items?.length) {
          return data.items.map(item => ({ url: item.link, thumb: item.image?.thumbnailLink || item.link }))
        }
      } catch (e) { console.error('Google search error:', e) }
    }
    // Fallback Unsplash
    try {
      const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_API_KEY
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&client_id=${UNSPLASH_KEY}`)
      const data = await res.json()
      return (data.results || []).map(x => ({ url: x.urls.regular, thumb: x.urls.small }))
    } catch (e) { return [] }
  },
}

// ─── Messages doux ─────────────────────────────────────────────
export const SWEET_MESSAGES = [
  "Tu me manques comme un épisode sans sous-titres 😭",
  "Je pense à toi plus fort qu'un OST de drama 🎵",
  "T'es dans ma tête en mode boucle infinie ✨",
  "Si t'étais un jeu, tu serais mon GOTY chaque année 🎮",
  "Tu es la scène post-générique que j'attends toujours 🌸",
  "Mon cœur fait *ding* quand je pense à toi 💌",
  "Même les meilleurs K-dramas ne me font pas autant sourire que toi 💫",
]
