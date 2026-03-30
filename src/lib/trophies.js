import { supabase } from './supabase'

export const TROPHIES = [
  {
    id: 'first_watch',
    name: 'Premier Regard',
    emoji: '👀',
    desc: 'Premier élément ajouté à la watchlist',
    condition: (stats) => stats.totalAdded >= 1
  },
  {
    id: 'night_owl',
    name: 'Nuit Blanche',
    emoji: '🦉',
    desc: '5 épisodes vus en une session',
    condition: (stats) => stats.episodesInSession >= 5
  },
  {
    id: 'coup_de_foudre',
    name: 'Coup de Foudre',
    emoji: '⚡',
    desc: 'Deux 10/10 donnés',
    condition: (stats) => stats.perfectScores >= 2
  },
  {
    id: 'kdrama_addict',
    name: 'KDrama Addict',
    emoji: '🇰🇷',
    desc: '10 séries terminées',
    condition: (stats) => stats.completedSeries >= 10
  },
  {
    id: 'gamer_duo',
    name: 'Gamer Duo',
    emoji: '🎮',
    desc: '5 jeux dans la watchlist',
    condition: (stats) => stats.gamesAdded >= 5
  },
  {
    id: 'time_traveler',
    name: 'Voyageur du Temps',
    emoji: '⏰',
    desc: '100 heures de contenu ensemble',
    condition: (stats) => stats.totalHours >= 100
  },
  {
    id: 'capsule_keeper',
    name: 'Gardien des Secrets',
    emoji: '💌',
    desc: 'Première capsule temporelle ouverte',
    condition: (stats) => stats.capsulesOpened >= 1
  },
  {
    id: 'photo_memory',
    name: 'Chasseur de Souvenirs',
    emoji: '📸',
    desc: '10 photo-récaps créés',
    condition: (stats) => stats.photoRecaps >= 10
  },
  {
    id: 'legend_maker',
    name: 'Faiseur de Légendes',
    emoji: '🏆',
    desc: 'Liste GOAT complète (5+ entrées)',
    condition: (stats) => stats.goatEntries >= 5
  },
  {
    id: 'destiny_wheel',
    name: 'Jouer à la Roue',
    emoji: '🎡',
    desc: 'Première utilisation de la Roue du Destin',
    condition: (stats) => stats.wheelSpins >= 1
  }
]

export async function checkAndAwardTrophies(userId, stats) {
  const { data: existing } = await supabase
    .from('trophies')
    .select('trophy_id')
    .eq('user_id', userId)

  const existingIds = new Set(existing?.map(t => t.trophy_id) || [])
  const newTrophies = []

  for (const trophy of TROPHIES) {
    if (!existingIds.has(trophy.id) && trophy.condition(stats)) {
      newTrophies.push({ user_id: userId, trophy_id: trophy.id, earned_at: new Date().toISOString() })
    }
  }

  if (newTrophies.length > 0) {
    await supabase.from('trophies').insert(newTrophies)
  }

  return newTrophies
}
