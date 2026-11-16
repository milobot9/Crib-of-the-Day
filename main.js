import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase_config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById('game-container');
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const playlist = [
  'assets/audio/lounge-music.mp3',
  'assets/audio/lounge-music2.mp3',
  'assets/audio/lounge-music3.mp3',
  'assets/audio/lounge-music4.mp3',
  'assets/audio/lounge-music5.mp3',
  'assets/audio/lounge-music6.mp3',
  'assets/audio/lounge-music7.mp3',
  'assets/audio/lounge-music8.mp3',
  'assets/audio/lounge-music9.mp3',
  'assets/audio/lounge-music10.mp3',
  'assets/audio/lounge-music11.mp3',
  'assets/audio/lounge-music12.mp3',
  'assets/audio/lounge-music13.mp3',
  'assets/audio/lounge-music14.mp3',
  'assets/audio/lounge-music15.mp3',
];

const hotPlaylist = [
  'assets/audio/hot-streak1.mp3',
  'assets/audio/hot-streak2.mp3',
  'assets/audio/hot-streak3.mp3',
];

const gamblerTrack = 'assets/audio/The Gambler.mp3';
const loserTrack = 'assets/audio/Im A Loser (Remastered 2009).mp3';
const championTrack = 'assets/audio/We Are The Champions (Remastered 2011).mp3';
const diesIraeTrack = 'assets/audio/dies-irae.mp3';
const lacrimosaTrack = 'assets/audio/lacrimosa.mp3';

const EGG_COOLDOWN_MS = 30 * 60 * 1000;
const HOT_COOLDOWN_MS = 15 * 60 * 1000;
const TARGET_VOL = 0.35;

let shuffledQueue = [];
let currentLoungeTrack = null;
let playingSpecialTrack = false;
let hotStreakQueue = [];

function nextShuffledLoungeTrack() {
  if (shuffledQueue.length === 0) {
    shuffledQueue = [...playlist];
    for (let i = shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
    }
    if (shuffledQueue.length > 1 && shuffledQueue[0] === currentLoungeTrack) {
      shuffledQueue.push(shuffledQueue.shift());
    }
  }
  currentLoungeTrack = shuffledQueue.shift();
  return currentLoungeTrack;
}

const deckA = new Audio(nextShuffledLoungeTrack());
const deckB = new Audio();
deckA.volume = TARGET_VOL;
deckB.volume = 0;
deckA.preload = 'auto';
deckB.preload = 'auto';
let activeDeck = deckA;
let fadeTimer = null;

const music = {
  get paused() { return activeDeck.paused; },
  play() { return activeDeck.play(); },
  pause() {
    clearInterval(fadeTimer);
    deckA.pause();
    deckB.pause();
  },
};

function crossfadeTo(src, isSpecial = false) {
  if (!settings.music) return;
  const outgoing = activeDeck;
  const incoming = activeDeck === deckA ? deckB : deckA;
  activeDeck = incoming;
  playingSpecialTrack = isSpecial;

  clearInterval(fadeTimer);
  incoming.src = src;
  incoming.volume = 0;
  incoming.load();

  incoming.play().then(() => {
    const steps = 20;
    const stepMs = 75;
    let step = 0;
    const startOutVol = outgoing.volume;

    fadeTimer = setInterval(() => {
      step++;
      const ratio = Math.min(1, step / steps);
      incoming.volume = Number((TARGET_VOL * ratio).toFixed(3));
      outgoing.volume = Number((startOutVol * (1 - ratio)).toFixed(3));
      if (step >= steps) {
        clearInterval(fadeTimer);
        outgoing.pause();
        outgoing.volume = 0;
      }
    }, stepMs);
  }).catch(() => {
    activeDeck = outgoing;
    window.addEventListener('pointerdown', ensureMusicPlaying, { once: true });
    window.addEventListener('keydown', ensureMusicPlaying, { once: true });
  });
}

function canTriggerEgg(key, cooldownMs = EGG_COOLDOWN_MS) {
  const last = Number(localStorage.getItem('egg_cd_' + key) || 0);
  return Date.now() - last >= cooldownMs;
}

function playSpecialTrack(src, cooldownKey, cooldownMs = EGG_COOLDOWN_MS) {
  if (!settings.music) return;
  if (cooldownKey) localStorage.setItem('egg_cd_' + cooldownKey, String(Date.now()));
  hotStreakQueue = [];
  crossfadeTo(src, true);
}

function startHotPlaylist() {
  if (!settings.music || hotPlaylist.length === 0) return;
  localStorage.setItem('egg_cd_hotstreak', String(Date.now()));
  hotStreakQueue = hotPlaylist.slice(1);
  crossfadeTo(hotPlaylist[0], true);
}

function handleTrackEnded() {
  if (hotStreakQueue.length > 0) {
    const nextHot = hotStreakQueue.shift();
    crossfadeTo(nextHot, true);
    return;
  }
  if (!playingSpecialTrack && Math.random() < 0.01 && canTriggerEgg('gambler')) {
    playSpecialTrack(gamblerTrack, 'gambler');
  } else {
    crossfadeTo(nextShuffledLoungeTrack(), false);
  }
}

function check1v1LossStreakEasterEgg() {
  if (!profile) return;
  const completed1v1 = allChallenges
    .filter(c => c.status === 'completed' && (c.challenger_tag === profile.tag || c.opponent_tag === profile.tag))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (completed1v1.length < 3) return;
  const lastThree = completed1v1.slice(0, 3);
  const lostThreeStraight = lastThree.every(c =>
    c.winner_tag && c.winner_tag !== 'TIE' && c.winner_tag !== profile.tag
  );

  if (lostThreeStraight && Math.random() < 0.60) {
    const pool = [];
    if (canTriggerEgg('gambler')) pool.push({ src: gamblerTrack, key: 'gambler' });
    if (canTriggerEgg('loser')) pool.push({ src: loserTrack, key: 'loser' });
    if (pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      playSpecialTrack(pick.src, pick.key);
    }
  }
}

[deckA, deckB].forEach(deck => {
  deck.addEventListener('ended', () => { if (deck === activeDeck) handleTrackEnded(); });
  deck.addEventListener('error', () => { if (deck === activeDeck && settings.music) setTimeout(handleTrackEnded, 500); });
});

function checkEasterEggTriggers(finalScore, isMoon, recentScores) {
  // 1. 3 Straight Under-22 Standard Games -> Dies Irae or Lacrimosa
  if (!isMoon && recentScores.length >= 3) {
    const lastThree = recentScores.slice(-3);
    if (lastThree.every(s => s < 22)) {
      const tragicTracks = [];
      if (canTriggerEgg('dies_irae')) tragicTracks.push({ src: diesIraeTrack, key: 'dies_irae' });
      if (canTriggerEgg('lacrimosa')) tragicTracks.push({ src: lacrimosaTrack, key: 'lacrimosa' });
      if (tragicTracks.length > 0) {
        const pick = tragicTracks[Math.floor(Math.random() * tragicTracks.length)];
        playSpecialTrack(pick.src, pick.key);
        return;
      }
    }
  }

  // 2. Big Single-Game Win ("We Are the Champions"): Shoot the Moon (<= 10) OR 56+ pts in Standard
  const bigWin = isMoon ? finalScore <= 10 : finalScore >= 56;
  if (bigWin && canTriggerEgg('champion')) {
    playSpecialTrack(championTrack, 'champion');
    return;
  }

  // 3. 7-Hand Hot Streak Playlist: Average > 34 over past 7 hands
  if (!isMoon && recentScores.length >= 7 && hotStreakQueue.length === 0 && canTriggerEgg('hotstreak', HOT_COOLDOWN_MS)) {
    const lastSeven = recentScores.slice(-7);
    const avg7 = lastSeven.reduce((sum, v) => sum + v, 0) / 7;
    if (avg7 > 34) {
      startHotPlaylist();
      return;
    }
  }

  // 4. 8-Game Cold Slump ("The Gambler" or "I'm a Loser"): Average < 30 over last 8 games
  if (recentScores.length >= 8) {
    const lastEight = recentScores.slice(-8);
    const avg8 = lastEight.reduce((sum, v) => sum + v, 0) / 8;
    const inSlump = isMoon ? avg8 > 18 : avg8 < 30;

    if (inSlump) {
      const availableSlumpTracks = [];
      if (canTriggerEgg('gambler')) availableSlumpTracks.push({ src: gamblerTrack, key: 'gambler' });
      if (canTriggerEgg('loser')) availableSlumpTracks.push({ src: loserTrack, key: 'loser' });

      if (availableSlumpTracks.length > 0) {
        const pick = availableSlumpTracks[Math.floor(Math.random() * availableSlumpTracks.length)];
        playSpecialTrack(pick.src, pick.key);
      }
    }
  }
}

const snap = new Audio('assets/audio/card-snap.mp3');
const load = (k, d) => JSON.parse(localStorage.getItem(k) ?? 'null') ?? d;
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let settings = load('cotd_settings', { music: true, sfx: true, quick: false, speed: 0.55, why: false, autofill: true });
let profile = null;
let game = load('cotd_game', null);
let allGames = [];
let profiles = [];
let champions = [];
let livePot = 10;
let deviceId = localStorage.getItem('cotd_device_id');
let dailyStarting = false;
let allChallenges = [];
let active1v1Id = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function logSupabaseError(action, error) {
  if (error) console.error(`[Supabase] ${action} failed:`, error);
}

function mapProfile(row) {
  return {
    tag: row.tag,
    initials: row.initials,
    tagNumber: Number(row.tag_number ?? 0),
    pin: row.pin,
    deviceId: row.device_id,
    coins: Number(row.coins ?? 100),
    createdAt: row.created_at,
  };
}

function mapGame(row) {
  return {
    id: row.id,
    playerTag: row.player_tag,
    mode: row.mode,
    isMoonShot: Boolean(row.is_moon_shot),
    score: Number(row.score ?? 0),
    coinsDelta: Number(row.coins_delta ?? 0),
    potPayout: Number(row.pot_payout ?? 0),
    dateKey: row.date_key ?? String(row.created_at ?? '').slice(0, 10),
    boardSnapshot: row.board_snapshot,
    createdAt: row.created_at,
  };
}

const GLOBAL_POT_KEY = 'global';

async function fetchPersistentPotRow() {
  // Prefer the persistent 'global' row; if not created yet, seed it from the most recent pot row or 10
  let { data: row, error } = await supabase.from('daily_pots').select('*').eq('date_key', GLOBAL_POT_KEY).maybeSingle();
  logSupabaseError('load persistent pot', error);

  if (!row && !error) {
    const latest = await supabase.from('daily_pots').select('pot_amount').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const startingAmount = Number(latest.data?.pot_amount ?? 10);
    const created = await supabase.from('daily_pots').insert({ date_key: GLOBAL_POT_KEY, pot_amount: startingAmount, settled: false }).select('*').single();
    logSupabaseError('create persistent pot', created.error);
    row = created.data;
    if (!row && created.error?.code === '23505') {
      const retry = await supabase.from('daily_pots').select('*').eq('date_key', GLOBAL_POT_KEY).single();
      row = retry.data;
    }
  }
  return row;
}

async function refreshCloudData() {
  const [gamesRes, profilesRes, potRow, championsRes, challengesRes] = await Promise.all([
    supabase.from('games').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('tag'),
    fetchPersistentPotRow(),
    supabase.from('daily_champions').select('*').order('date_key', { ascending: false }),
    supabase.from('challenges_1v1').select('*').order('created_at', { ascending: false }),
  ]);
  logSupabaseError('load games', gamesRes.error);
  logSupabaseError('load profiles', profilesRes.error);
  logSupabaseError('load daily champions', championsRes.error);
  logSupabaseError('load 1v1 challenges', challengesRes.error);
  if (gamesRes.data) allGames = gamesRes.data.map(mapGame);
  if (profilesRes.data) profiles = profilesRes.data.map(mapProfile);
  if (potRow) livePot = Number(potRow.pot_amount ?? 10);
if (championsRes.data) champions = championsRes.data;
  if (challengesRes.data) {
    allChallenges = challengesRes.data;
    await expireStale1v1Challenges();
  }
  renderHud();
}

async function expireStale1v1Challenges() {
  if (!profile) return;
  const today = todayKey();
  let changed = false;

  for (const c of allChallenges) {
    if (c.status === 'completed' || c.status === 'expired') continue;
    if (!c.date_key || c.date_key >= today) continue;

    const stake = Number(c.stake || 2);
    const oScores = Array.isArray(c.opponent_scores) ? c.opponent_scores : [];

    const { error } = await supabase
      .from('challenges_1v1')
      .update({ status: 'expired', winner_tag: 'EXPIRED', coins_won: 0 })
      .eq('id', c.id)
      .neq('status', 'expired');

    if (!error) {
      changed = true;
      if (c.challenger_tag === profile.tag) {
        await changeCoins(stake);
      } else {
        const cProf = profiles.find(p => p.tag === c.challenger_tag);
        if (cProf) await supabase.from('profiles').update({ coins: Number(cProf.coins) + stake }).eq('tag', c.challenger_tag);
      }
      if (c.status === 'active' || oScores.length > 0) {
        if (c.opponent_tag === profile.tag) {
          await changeCoins(stake);
        } else {
          const oProf = profiles.find(p => p.tag === c.opponent_tag);
          if (oProf) await supabase.from('profiles').update({ coins: Number(oProf.coins) + stake }).eq('tag', c.opponent_tag);
        }
      }
    }
  }

  if (changed) {
    const { data } = await supabase.from('challenges_1v1').select('*').order('created_at', { ascending: false });
    if (data) allChallenges = data;
  }
}
const SABOTAGE_ROUNDS = {
  1: { pool: 4, burn: 2, reveal: 1, chooseReveal: 1, randomReveal: 0 },
  2: { pool: 6, burn: 4, reveal: 2, chooseReveal: 1, randomReveal: 1 },
  3: { pool: 8, burn: 6, reveal: 3, chooseReveal: 2, randomReveal: 1 },
};

function isSabotageMatch(c) {
  return c?.scoring_rule === 'sabotage_4';
}

function defaultSabotageState() {
  return {
    cBurned: [],
    oBurned: [],
    cKnown: [],
    oKnown: [],
    cSavedLast: [],
    oSavedLast: [],
    cPending: null,
    oPending: null,
  };
}

function sumAllHands1v1(entries) {
  return (Array.isArray(entries) ? entries : [])
    .slice(0, 4)
    .map(item => (typeof item === 'object' && item !== null ? Number(item.score) : Number(item)))
    .filter(Number.isFinite)
    .reduce((sum, x) => sum + x, 0);
}

function resolveSabotageRound(state, roundNum) {
  const cfg = SABOTAGE_ROUNDS[roundNum];
  if (!cfg || !state.cPending || !state.oPending) return state;

  const applyAttack = (attack, victimShield, existingBurned, existingKnown) => {
    const shieldSet = new Set((victimShield || []).map(cardKey));
    const burnedSet = new Set((existingBurned || []).map(cardKey));
    const knownSet = new Set((existingKnown || []).map(cardKey));

    const saved = [];
    const actualBurned = [];
    for (const c of (attack.burn || [])) {
      const k = cardKey(c);
      if (shieldSet.has(k)) {
        saved.push(c);
      } else if (!burnedSet.has(k)) {
        burnedSet.add(k);
        actualBurned.push(c);
      }
    }

    const chosenSet = new Set((attack.chosenReveal || []).map(cardKey));
    const revealedThisTurn = [];
    const unchosenActual = [];

    for (const c of actualBurned) {
      if (chosenSet.has(cardKey(c))) revealedThisTurn.push(c);
      else unchosenActual.push(c);
    }

    // Forced random reveal(s) from unchosen actual burns (or fallback if chosen burns were shielded)
    const neededRandom = Math.max(0, Math.min(actualBurned.length - revealedThisTurn.length, cfg.randomReveal));
    const pool = [...unchosenActual];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < neededRandom && pool.length > 0; i++) {
      revealedThisTurn.push(pool.shift());
    }

    const nextBurned = [...(existingBurned || []), ...actualBurned];
    const nextKnown = [...(existingKnown || [])];
    for (const c of revealedThisTurn) {
      if (!knownSet.has(cardKey(c))) {
        knownSet.add(cardKey(c));
        nextKnown.push(c);
      }
    }

    return { nextBurned, nextKnown, saved };
  };

  // Challenger attacks Opponent; Opponent attacks Challenger
  const oppRes = applyAttack(state.cPending, state.oPending.shield, state.oBurned, state.oKnown);
  const chalRes = applyAttack(state.oPending, state.cPending.shield, state.cBurned, state.cKnown);

  return {
    cBurned: chalRes.nextBurned,
    oBurned: oppRes.nextBurned,
    cKnown: chalRes.nextKnown,
    oKnown: oppRes.nextKnown,
    cSavedLast: chalRes.saved,
    oSavedLast: oppRes.saved,
   cPending: null,
    oPending: null,
  };
}

// Grand total of top 3 hands (lowest 3 for Moon Battle, highest 3 for Standard)
function top3Total1v1(entries, isMoonBattle = false) {
  const vals = (Array.isArray(entries) ? entries : [])
    .slice(0, 4)
    .map(item => (typeof item === 'object' && item !== null ? Number(item.score) : Number(item)))
    .filter(Number.isFinite);
  if (!vals.length) return 0;
  const sorted = isMoonBattle ? [...vals].sort((a, b) => a - b) : [...vals].sort((a, b) => b - a);
  return sorted.slice(0, 3).reduce((sum, x) => sum + x, 0);
}

// Supports both numbers and { score, moonGambleMissed } entries
function score1v1Series(entries, isMoonBattle = false) {
  const normalized = entries.slice(0, 4).map(item =>
    typeof item === 'object' && item !== null
      ? { val: Number(item.score), missedMoon: Boolean(item.moonGambleMissed) }
      : { val: Number(item), missedMoon: false }
  );
  if (!normalized.length) return 0;

  if (isMoonBattle) {
    const best3 = [...normalized].sort((a, b) => a.val - b.val).slice(0, 3);
    return best3.reduce((sum, x) => sum + x.val, 0) / best3.length;
  }

  const sortedDesc = [...normalized].sort((a, b) => b.val - a.val);
  const kept3 = sortedDesc.slice(0, 3);
  const dropped = sortedDesc[3];
  const baseAvg = kept3.reduce((sum, x) => sum + x.val, 0) / kept3.length;
  const penalty = dropped && dropped.missedMoon ? 2 : 0;
  return baseAvg - penalty;
}

async function refreshLivePot() {
  const row = await fetchPersistentPotRow();
  if (row) {
    livePot = Number(row.pot_amount ?? 10);
    renderHud();
  }
}

async function getOrCreateAndIncrementPot() {
  const row = await fetchPersistentPotRow();
  if (!row) return false;
  const nextAmount = Number(row.pot_amount ?? 10) + 1;
  const updated = await supabase.from('daily_pots').update({ pot_amount: nextAmount, updated_at: new Date().toISOString() }).eq('date_key', GLOBAL_POT_KEY).select('*').single();
  logSupabaseError('increment persistent pot', updated.error);
  if (updated.data) livePot = Number(updated.data.pot_amount);
  renderHud();
  return !updated.error;
}

async function changeCoins(delta) {
  if (!profile || !delta) return;
  const nextCoins = Number(profile.coins) + delta;
  const { data, error } = await supabase.from('profiles').update({ coins: nextCoins }).eq('tag', profile.tag).select('coins').maybeSingle();
  logSupabaseError('update profile Coins', error);
  profile.coins = data ? Number(data.coins) : nextCoins;
  save('cotd_profile', profile);
  renderHud();
}

async function adjustDailyPot(delta) {
  if (!delta) return;
  const row = await fetchPersistentPotRow();
  if (!row) return;
  const amount = Math.max(0, Number(row.pot_amount ?? 0) + delta);
  const { data, error } = await supabase.from('daily_pots').update({ pot_amount: amount, updated_at: new Date().toISOString() }).eq('date_key', GLOBAL_POT_KEY).select('pot_amount').single();
  logSupabaseError('adjust persistent pot', error);
  if (data) {
    livePot = Number(data.pot_amount);
    renderHud();
  }
}

async function findProfileForDevice() {
  const { data, error } = await supabase.from('profiles').select('*').eq('device_id', deviceId).maybeSingle();
  logSupabaseError('find profile by device_id', error);
  if (data) {
    profile = mapProfile(data);
    save('cotd_profile', profile);
    if (game?.playerTag && game.playerTag !== profile.tag) {
      game = null;
      save('cotd_game', null);
    }
  }
}

function makeDeviceId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const cardKey = c => `${c.r}-${c.s}`;
const formatCardText = c => `${RANKS[c.r - 1]}${SUITS[c.s]}`;

function makeDeck(seedStr, excludedCards = []) {
  let h = 7;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
  const rand = seedStr ? rng(h) : Math.random;
  const blocked = new Set((excludedCards || []).map(cardKey));
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) {
      if (!blocked.has(`${r}-${s}`)) deck.push({ r, s });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function scoreHand(hand, cut, isCrib) {
  const cards = cut ? [...hand, cut] : [...hand];
  const n = cards.length;
  const combos = [];
  const val = c => Math.min(c.r, 10);
  for (let m = 1; m < 1 << n; m++) {
    const idx = [...Array(n).keys()].filter(i => m & (1 << i));
    if (idx.length > 1 && idx.reduce((a, i) => a + val(cards[i]), 0) === 15) combos.push({ pts: 2, label: '15 for 2', idx });
  }
  const groups = {};
  cards.forEach((c, i) => (groups[c.r] ??= []).push(i));
  for (const g of Object.values(groups)) {
    if (g.length === 2) combos.push({ pts: 2, label: 'Pair for 2', idx: g });
    if (g.length === 3) combos.push({ pts: 6, label: 'Trips for 6', idx: g });
    if (g.length === 4) combos.push({ pts: 12, label: 'Quads for 12', idx: g });
  }
  for (let len = n; len >= 3; len--) {
    let found = false;
    for (let m = 1; m < 1 << n; m++) {
      const idx = [...Array(n).keys()].filter(i => m & (1 << i));
      if (idx.length !== len) continue;
      const rs = idx.map(i => cards[i].r).sort((a, b) => a - b);
      if (rs.every((r, k) => k === 0 || r === rs[k - 1] + 1)) {
        combos.push({ pts: len, label: `Run of ${len}`, idx });
        found = true;
      }
    }
    if (found) break;
  }
  if (hand.length === 4 && hand.every(c => c.s === hand[0].s)) {
    const five = cut && cut.s === hand[0].s;
    if (five) combos.push({ pts: 5, label: 'Flush for 5', idx: [0, 1, 2, 3, 4] });
    else if (!isCrib) combos.push({ pts: 4, label: 'Flush for 4', idx: [0, 1, 2, 3] });
  }
  if (cut) hand.forEach((c, i) => {
    if (c.r === 11 && c.s === cut.s) combos.push({ pts: 1, label: 'His Nobs for 1', idx: [i] });
  });
  return combos;
}
const total = combos => combos.reduce((a, c) => a + c.pts, 0);

function payout(score, moon) {
  if (moon) return score <= 10 ? 10 : -5;
  if (score <= 10) return 10;
  if (score <= 20) return -5;
  if (score <= 25) return -2;
  if (score <= 30) return -1;
  if (score <= 40) return 0;
  if (score <= 45) return 1;
  if (score <= 50) return 5;
  return 0;
}

function cardHTML(c, back) {
  if (back) return '<div class="card back"></div>';
  const red = c.s === 1 || c.s === 2;
  return `<div class="card ${red ? 'red' : 'blk'}"><span class="r">${RANKS[c.r - 1]}</span><span class="s">${SUITS[c.s]}</span></div>`;
}

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild;
}

function render() {
  if (!profile) return renderSignup();
  root.innerHTML = `
    <header><button class="btn small" id="home">⌂</button><h1>Crib of the Day</h1>
    <span><button class="btn small" id="help">?</button> <button class="btn small" id="set">⚙</button></span></header>
    <div class="hud" id="hud"></div><div id="main"></div>`;
  root.querySelector('#home').onclick = () => {
    if (!game || game.done || game.mode === '1v1') {
      game = null;
      save('cotd_game', null);
      render();
    }
  };
  root.querySelector('#help').onclick = showRules;
  root.querySelector('#set').onclick = showSettings;
  renderHud();
  if (game) renderBoard(); else renderHome();
}
function hasPlayedDailyToday() {
  if (!profile) return false;
  const localKey = `cotd_daily_${profile.tag}`;
  return localStorage.getItem(localKey) === todayKey()
    || localStorage.getItem('cotd_daily') === todayKey()
    || allGames.some(g => g.playerTag === profile.tag && g.dateKey === todayKey() && (g.mode === 'daily' || (g.isMoonShot && g.coinsDelta !== 0)));
}

function renderHud() {
  const hud = root.querySelector('#hud');
  if (!hud || !profile) return;
  const showPot = !game || game.mode === 'daily';
  hud.innerHTML = `<span class="pill">${escapeHTML(profile.tag)}</span><span class="pill">🪙 ${Number(profile.coins)} Coins</span>` +
    (showPot ? `<span class="pill">Daily Pot: ${livePot} Coins</span>` : '') +
    (game?.mode === 'daily' && !game.done && Number.isInteger(game.predictedScore) ? `<span class="pill prediction-pill">Prediction: ${game.predictedScore} pts</span>` : '');
}

function renderSignup() {
  root.innerHTML = `<header><h1>Crib of the Day</h1></header><div class="felt"><h3>Create your Player Tag</h3>
    <p>Enter 3 letters (A–Z). Your device will be linked to one Player Tag.</p><input type="text" id="ini" maxlength="3" autocomplete="off" aria-label="Three-letter initials"> <button class="btn" id="go">Create Tag</button><p id="signup-error" class="error-text"></p></div>`;
  root.querySelector('#ini').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); });
  root.querySelector('#go').onclick = async () => {
    const btn = root.querySelector('#go');
    const errorBox = root.querySelector('#signup-error');
    const initials = root.querySelector('#ini').value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(initials)) { errorBox.textContent = 'Please enter exactly three letters.'; return; }
    btn.disabled = true;
    btn.textContent = 'Creating…';
    const existing = await supabase.from('profiles').select('*').eq('device_id', deviceId).maybeSingle();
    logSupabaseError('check device profile before creation', existing.error);
    if (existing.data) {
      profile = mapProfile(existing.data);
      save('cotd_profile', profile);
      await refreshCloudData();
      render();
      return;
    }
    const highest = await supabase.from('profiles').select('tag_number').eq('initials', initials).order('tag_number', { ascending: false }).limit(1).maybeSingle();
    logSupabaseError('find highest profile tag number', highest.error);
    const tagNumber = Number(highest.data?.tag_number ?? 0) + 1;
    const pin = Math.floor(1000 + Math.random() * 9000);
    const created = await supabase.from('profiles').insert({ tag: `${initials}#${tagNumber}`, initials, tag_number: tagNumber, pin, device_id: deviceId, coins: 100 }).select('*').single();
    logSupabaseError('create player profile', created.error);
    if (!created.data) {
      errorBox.textContent = 'Could not create your tag. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Create Tag';
      return;
    }
   profile = mapProfile(created.data);
    save('cotd_profile', profile);
    await refreshCloudData();
    render();
    showOnboardingTutorial();
  };
}

function showOnboardingTutorial() {
  let step = 0;

  const pages = [
    {
      badge: 'STEP 1 OF 3 · THE MOST IMPORTANT RULE',
      title: 'You Score Vertically!',
      body: `
        <p style="font-size:14px; line-height:1.5; margin:8px 0;">
          You place cards into the grid <b>row-by-row</b> (left to right), but <b>every hand is scored VERTICALLY down each column!</b>
        </p>
        <ul style="margin:8px 0; padding-left:18px; line-height:1.5;">
          <li><b>4 Vertical Hands:</b> Columns 1, 2, 3, and 4 each become a 4-card Cribbage hand stacked top-to-bottom.</li>
          <li><b>The Crib (Column 5):</b> Every 4 cards you place, the next card goes face-down into the 5th column on the right.</li>
          <li><b>The Cut Card:</b> Once all 16 grid slots are filled, the Cut Card flips and counts as the <b>5th card for every vertical column</b> (including the Crib).</li>
        </ul>
      `,
    },
    {
      badge: 'STEP 2 OF 3 · POINT VALUES',
      title: 'Cribbage Scoring',
      body: `
        <ul style="margin:8px 0; padding-left:18px; line-height:1.55;">
          <li><b>15s:</b> Any combination of cards adding up to 15 = <b>2 pts</b> (Face cards = 10, Ace = 1)</li>
          <li><b>Pairs:</b> Pair = <b>2 pts</b> · Three of a kind = <b>6 pts</b> · Four of a kind = <b>12 pts</b></li>
          <li><b>Runs:</b> 3 or more consecutive ranks = <b>1 pt per card</b> (double runs count all combinations)</li>
          <li><b>Flush:</b> All 4 cards in a vertical hand matching suit = <b>4 pts</b> (<b>5 pts</b> if the Cut matches too). The Crib needs all 5 cards = <b>5 pts</b></li>
          <li><b>Nobs &amp; Heels:</b> Jack matching the Cut suit = <b>+1 pt</b> · Cut Card is a Jack = <b>+2 pts to the Crib</b></li>
        </ul>
      `,
    },
    {
      badge: 'STEP 3 OF 3 · MODES, COINS & SETTINGS',
      title: 'Ways to Play & Settings',
      body: `
        <ul style="margin:8px 0; padding-left:18px; line-height:1.55;">
          <li><b>Crib of the Day (1 Coin):</b> Everyone plays the exact same deck each day. Call your exact score beforehand for <b>+5 bonus Coins</b>, and score 41+ (or ≤10 in <i>Shoot the Moon</i>) to win Coins!</li>
          <li><b>⚔️ 1v1 Arena (2 Coins):</b> Challenge another player to a <b>Best 3 of 4 hands</b> match and win Coins equal to your average score lead.</li>
          <li><b>Free Play:</b> Unlimited practice hands anytime for 0 Coins.</li>
          <li><b>Settings &amp; Rules (⚙ / ?):</b> Tap the gear icon in the top-right corner anytime to toggle music, sound effects, Quick Play, scoring explanations, or animation speed—and tap <b>?</b> to revisit the rules.</li>
        </ul>
      `,
    },
];

  const m = el(`<div class="overlay">
    <div class="modal" style="text-align:left;">
      <button class="modal-x" id="close-tut-top" type="button" aria-label="Close">✕</button>
      <div class="eyebrow" id="tut-badge"></div>
      <h2 id="tut-title" style="margin:6px 0 8px; color:#f3d27a; font-size:22px;"></h2>
      <div id="tut-body" style="min-height:195px;"></div>
      <div class="row" style="margin-top:14px; gap:8px;">
        <button class="btn" id="tut-prev" type="button" style="flex:1;">← Back</button>
        <button class="btn gold-btn" id="tut-next" type="button" style="flex:1.6;">Next →</button>
      </div>
    </div>
  </div>`);

  const badgeEl = m.querySelector('#tut-badge');
  const titleEl = m.querySelector('#tut-title');
  const bodyEl = m.querySelector('#tut-body');
  const prevBtn = m.querySelector('#tut-prev');
  const nextBtn = m.querySelector('#tut-next');

  const closeTutorial = () => m.remove();

  const renderStep = () => {
    const p = pages[step];
    badgeEl.textContent = p.badge;
    titleEl.textContent = p.title;
    bodyEl.innerHTML = p.body;
    prevBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = step === pages.length - 1 ? "Got It, Let's Play!" : 'Next →';
  };

  prevBtn.onclick = () => {
    if (step > 0) {
      step--;
      renderStep();
    }
  };

  nextBtn.onclick = () => {
    if (step < pages.length - 1) {
      step++;
      renderStep();
    } else {
      closeTutorial();
    }
  };

  m.querySelector('#close-tut-top').onclick = closeTutorial;
  m.addEventListener('click', e => { if (e.target === m) closeTutorial(); });

  renderStep();
  document.body.appendChild(m);
}

function renderHome() {
  const alreadyPlayed = hasPlayedDailyToday();
  const main = root.querySelector('#main');

  const myTodayMatches = allChallenges.filter(c =>
    c.date_key === todayKey() &&
    c.status !== 'expired' &&
    (String(c.opponent_tag).toUpperCase() === profile.tag || String(c.challenger_tag).toUpperCase() === profile.tag)
  );
  const activeToday = myTodayMatches.filter(c => c.status !== 'completed');
  const completedToday = myTodayMatches.filter(c => c.status === 'completed');

  const pendingCount = activeToday.filter(c => {
    const isChallenger = String(c.challenger_tag).toUpperCase() === profile.tag;
    const myScores = Array.isArray(isChallenger ? c.challenger_scores : c.opponent_scores)
      ? (isChallenger ? c.challenger_scores : c.opponent_scores)
      : [];
    return myScores.length < 4;
  }).length;

const inboxHTML = activeToday.map(c => {
    const isChallenger = String(c.challenger_tag).toUpperCase() === profile.tag;
    const rival = isChallenger ? c.opponent_tag : c.challenger_tag;
    const myScores = Array.isArray(isChallenger ? c.challenger_scores : c.opponent_scores)
      ? (isChallenger ? c.challenger_scores : c.opponent_scores)
      : [];
    const theirScores = Array.isArray(isChallenger ? c.opponent_scores : c.challenger_scores)
      ? (isChallenger ? c.opponent_scores : c.challenger_scores)
      : [];
    const stake = Number(c.stake || 2);
    const isSab = isSabotageMatch(c);
    const isMoon1v1 = Boolean(c.is_moon_battle);
    const sab = c.sabotage_state || defaultSabotageState();
    const myPending = isChallenger ? sab.cPending : sab.oPending;
    const theirPending = isChallenger ? sab.oPending : sab.cPending;

    const needsMyDraft = isSab && myScores.length >= 1 && myScores.length <= 3 && !myPending
      && (myScores.length > theirScores.length || Boolean(theirPending));
    const waitingOnRivalDraft = isSab && !needsMyDraft && myScores.length < 4 && (
      Boolean(myPending) || (myScores.length > theirScores.length)
    );

    const myDone = myScores.length >= 4 || waitingOnRivalDraft;
    const myDisplayScore = isSab ? sumAllHands1v1(myScores) : top3Total1v1(myScores, isMoon1v1);
    const theirDisplayScore = isSab ? sumAllHands1v1(theirScores) : top3Total1v1(theirScores, isMoon1v1);
    const needsAccept = !isChallenger && c.status === 'pending' && myScores.length === 0;

    let actionLabel;
    if (myScores.length >= 4) actionLabel = `Waiting (${theirScores.length}/4)`;
    else if (needsMyDraft) actionLabel = `🔥 Sabotage Round ${myScores.length}`;
    else if (waitingOnRivalDraft) actionLabel = `Waiting on Rival…`;
    else if (needsAccept) actionLabel = `Accept & Play (${stake}🪙)`;
    else actionLabel = `Play Hand ${myScores.length + 1}/4`;

    const modeBadge = isSab ? '🔥 Sabotage' : (isMoon1v1 ? '🌙 Moon' : '⚔️ Regular');
    const scoreHeader = isSab ? '4-HAND TOTAL' : 'TOP-3 SCORE';

    return `<div class="row" style="padding:8px; border:1px solid rgba(243,210,122,.4); border-radius:8px; background:rgba(0,0,0,.25); margin:6px 0; gap:8px;">
      <div style="font-size:12px; flex:1;">
        <b>vs ${escapeHTML(rival)}</b> · ${modeBadge} · ${stake}🪙<br>
        <span style="opacity:.85;">Hands: You ${myScores.length}/4 · Them ${theirScores.length}/4</span>
      </div>
      <div style="text-align:right; font-size:12px; padding:4px 8px; border-radius:6px; background:rgba(243,210,122,.12); border:1px solid rgba(243,210,122,.35);">
        <div style="font-size:10px; opacity:.8;">${scoreHeader}</div>
        <b>You ${myDisplayScore}</b> vs <b>${theirDisplayScore}</b>
      </div>
      <button class="btn small gold-btn" data-play-1v1="${escapeHTML(c.id)}" ${myDone ? 'disabled' : ''}>${actionLabel}</button>
    </div>`;
  }).join('') || '<p style="font-size:12px; opacity:.8; margin:4px 0;">No active 1v1 matches right now.</p>';

  const completedTodayHTML = completedToday.map(c => {
    const isChallenger = String(c.challenger_tag).toUpperCase() === profile.tag;
    const rival = isChallenger ? c.opponent_tag : c.challenger_tag;
    const myScores = Array.isArray(isChallenger ? c.challenger_scores : c.opponent_scores)
      ? (isChallenger ? c.challenger_scores : c.opponent_scores)
      : [];
    const theirScores = Array.isArray(isChallenger ? c.opponent_scores : c.challenger_scores)
      ? (isChallenger ? c.opponent_scores : c.challenger_scores)
      : [];
    const isSab = isSabotageMatch(c);
    const isMoon1v1 = Boolean(c.is_moon_battle);
    const myTop3 = isSab ? sumAllHands1v1(myScores) : top3Total1v1(myScores, isMoon1v1);
    const theirTop3 = isSab ? sumAllHands1v1(theirScores) : top3Total1v1(theirScores, isMoon1v1);
    const margin = Number(c.coins_won || 0);
    const won = c.winner_tag === profile.tag;
    const tie = c.winner_tag === 'TIE';
    const outcomeText = tie
      ? 'TIE (2🪙 returned)'
      : (won ? `WON by ${margin} (+${margin}🪙)` : `LOST by ${margin} (−${margin}🪙)`);
    const badgeColor = tie ? '#f3d27a' : (won ? '#7ee787' : '#ff8b8b');

    return `<div class="row" style="padding:8px; border:1px solid rgba(255,255,255,.22); border-radius:8px; background:rgba(0,0,0,.3); margin:6px 0; gap:8px;">
      <div style="font-size:12px; flex:1;">
        <b>vs ${escapeHTML(rival)}</b> · ${isSab ? '🔥 Sabotage' : (isMoon1v1 ? '🌙 Moon' : '⚔️ Regular')}<br>
        <span style="color:${badgeColor}; font-weight:700;">${outcomeText}</span>
      </div>
      <div style="text-align:right; font-size:12px; padding:4px 8px; border-radius:6px; background:rgba(255,255,255,.08);">
        <div style="font-size:10px; opacity:.8;">${isSab ? 'FINAL 4-HAND' : 'FINAL TOP-3'}</div>
        <b>You ${myTop3}</b> vs <b>${theirTop3}</b>
      </div>
    </div>`;
  }).join('') || '<p style="font-size:12px; opacity:.75; margin:4px 0;">No completed 1v1 matches yet today.</p>';

  main.innerHTML = `<div class="felt">
    <button class="btn" id="daily" style="width:100%" ${alreadyPlayed ? 'disabled' : ''}>Crib of the Day ${alreadyPlayed ? '(done today)' : '· 1 Coin'}</button>
    <div id="daily-setup" style="display:none; margin-top:10px; padding:12px; border:1px solid #f3d27a; border-radius:10px; background:rgba(0,0,0,.35);">
      <div class="eyebrow">CRIB OF THE DAY · 1 COIN ENTRY</div>
      <p style="margin:4px 0 8px;">Predict your final score (0–120). Exact match wins +5 bonus Coins!</p>
      <div class="row" style="margin:6px 0;">
        <input id="prediction-input" type="number" min="0" max="120" step="1" value="35" style="flex:1; font-size:18px; text-align:center;">
        <button class="btn gold-btn" id="lock-daily" type="button" style="flex:1.4;">Lock In &amp; Deal</button>
      </div>
      <p class="error-text" id="prediction-error" style="margin:4px 0 0;"></p>
    </div>

    <div class="row">
      <button class="btn" id="free" style="flex:1">Free Play</button>
      <button class="btn" id="toggle-1v1" style="flex:1">⚔️ 1v1 ${pendingCount ? `(${pendingCount})` : ''}</button>
      <button class="btn" id="lb" style="flex:1">Boards &amp; Stats</button>
    </div>

    <div id="hub-1v1" style="display:${pendingCount ? 'block' : 'none'}; margin-top:8px; padding:12px; border:1px solid #f3d27a; border-radius:10px; background:rgba(0,0,0,.35);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div class="eyebrow">1V1 ARENA · 2 COIN PAY-IN</div>
        <button class="btn small" id="toggle-sabotage-help" type="button" style="font-size:11px; padding:3px 8px;">🔥 How Sabotage Works</button>
      </div>
      <div id="sabotage-help-bar" style="display:none; margin:8px 0; padding:10px; border-radius:8px; border:1px solid rgba(255,107,107,.45); background:rgba(20,8,8,.55); font-size:12px; line-height:1.45;">
        <div style="font-weight:700; color:#f3d27a; margin-bottom:4px;">🔥 Sabotage 1v1 Rules (4-Hand Cumulative · No Moon)</div>
        <ul style="margin:0; padding-left:16px;">
          <li><b>1. Play 4 Hands:</b> Highest <b>4-hand total</b> wins (payout = <code>⌊lead ÷ 4⌋</code> Coins). Shoot the Moon is disabled.</li>
          <li><b>2. Secret Shield (After Hands 1–3):</b> Pick <b>1 Row (5 cards, incl. Crib)</b> or <b>1 Column (4 cards)</b> on your finished board. If your rival tries to burn those cards, the burn fizzles!</li>
          <li><b>3. Escalating Burn &amp; Fog of War:</b>
            <br>• After Hand 1: Burn <b>2 of 4</b> rival cards → pick <b>1</b> to show (1 hidden).
            <br>• After Hand 2: Burn <b>4 of 6</b> rival cards → pick <b>1</b> to show + <b>1 random</b> leaks (2 hidden).
            <br>• After Hand 3: Burn <b>6 of 8</b> rival cards → pick <b>2</b> to show + <b>1 random</b> leaks (3 hidden).
          </li>
          <li><b>4. Permanent Deck Rot:</b> Unshielded burned cards stay gone for the rest of the match (down to 40/52 cards in Hand 4).</li>
        </ul>
      </div>
      <p style="margin:4px 0 8px; font-size:12px;">Challenge each rival up to once in <b>Regular</b>, <b>Moon</b>, and <b>Sabotage</b> per day (2🪙 each). Matches reset at midnight—unfinished games forfeit with a full 2-Coin refund.</p>
      <div class="compare-search-row">
        <input type="search" id="home-1v1-search" placeholder="Tag (ACE#1) or Initials (ACE)" autocomplete="off">
        <button class="btn small" id="home-1v1-find" type="button">Find</button>
      </div>
      <div id="home-1v1-matches" style="margin-top:6px;"></div>
      <p class="error-text" id="home-1v1-msg" style="margin:4px 0;"></p>
      <h4 style="margin:10px 0 4px; color:#f3d27a; font-size:13px;">Active Matches &amp; Inbox</h4>
      ${inboxHTML}
      <h4 style="margin:12px 0 4px; color:#f3d27a; font-size:13px;">Completed Today (Resets at Midnight)</h4>
      ${completedTodayHTML}
    </div>

    <label class="row">Auto-Fill Row 1 <input type="checkbox" id="af" ${settings.autofill ? 'checked' : ''}></label>
    <label class="row">Shoot the Moon (≤10 pts) <input type="checkbox" id="moon"></label></div>`;

  main.querySelector('#af').onchange = e => { settings.autofill = e.target.checked; save('cotd_settings', settings); };
  const moonBox = main.querySelector('#moon');
  const dailySetup = main.querySelector('#daily-setup');
  const predInput = main.querySelector('#prediction-input');
  const lockBtn = main.querySelector('#lock-daily');
  const errorBox = main.querySelector('#prediction-error');

  main.querySelector('#free').onclick = () => startGame('free', moonBox.checked, null);
  main.querySelector('#lb').onclick = showBoards;

 const hub1v1 = main.querySelector('#hub-1v1');
  main.querySelector('#toggle-1v1').onclick = async () => {
    const opening = hub1v1.style.display !== 'block';
    hub1v1.style.display = opening ? 'block' : 'none';
    if (opening) {
      await refreshCloudData();
      renderHome();
      const reopened = root.querySelector('#hub-1v1');
      if (reopened) reopened.style.display = 'block';
    }
  };

  const sabHelpBar = main.querySelector('#sabotage-help-bar');
  main.querySelector('#toggle-sabotage-help').onclick = () => {
    sabHelpBar.style.display = sabHelpBar.style.display === 'block' ? 'none' : 'block';
  };

  const search1v1 = main.querySelector('#home-1v1-search');
  const matches1v1 = main.querySelector('#home-1v1-matches');
  const msg1v1 = main.querySelector('#home-1v1-msg');

  main.querySelector('#home-1v1-find').onclick = async () => {
    const term = search1v1.value.trim().toUpperCase();
    msg1v1.textContent = '';
    if (!term) { msg1v1.textContent = 'Enter a Player Tag or 3 initials.'; return; }
    let q;
    if (/^[A-Z]{3}#[0-9]+$/.test(term)) q = supabase.from('profiles').select('tag').ilike('tag', term).limit(8);
    else if (/^[A-Z]{3}$/.test(term)) q = supabase.from('profiles').select('tag').ilike('initials', term).order('tag_number').limit(12);
    else { msg1v1.textContent = 'Format: ACE#1 or ACE'; return; }
    const { data } = await q;
    const list = (data ?? []).filter(p => p.tag !== profile.tag);
    if (!list.length) { matches1v1.innerHTML = '<p style="font-size:12px;">No matching players found.</p>'; return; }
    matches1v1.innerHTML = list.map(p => `
      <div class="row" style="padding:6px 8px; margin:4px 0; border-radius:8px; background:rgba(255,255,255,.06); gap:6px; flex-wrap:wrap;">
        <b style="font-size:13px;">${escapeHTML(p.tag)}</b>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
          <button class="btn small gold-btn" data-send-rival="${escapeHTML(p.tag)}" data-send-type="regular">⚔️ Regular (2🪙)</button>
          <button class="btn small" data-send-rival="${escapeHTML(p.tag)}" data-send-type="moon">🌙 Moon (2🪙)</button>
          <button class="btn small" data-send-rival="${escapeHTML(p.tag)}" data-send-type="sabotage">🔥 Sabotage (2🪙)</button>
        </div>
      </div>`).join('');

    matches1v1.querySelectorAll('[data-send-rival]').forEach(btn => btn.onclick = async () => {
      const rival = btn.getAttribute('data-send-rival');
      const sendType = btn.getAttribute('data-send-type');
      const isMoonBattle = sendType === 'moon';
      const isSabotage = sendType === 'sabotage';
      const ruleKey = isSabotage ? 'sabotage_4' : (isMoonBattle ? 'moon_best_3_of_4' : 'best_3_of_4');
      const modeLabel = isSabotage ? 'Sabotage' : (isMoonBattle ? 'Shoot the Moon' : 'Regular');

      const alreadyToday = allChallenges.some(c => {
        if (c.date_key !== todayKey() || c.status === 'expired') return false;
        const samePair = (c.challenger_tag === profile.tag && c.opponent_tag === rival)
          || (c.challenger_tag === rival && c.opponent_tag === profile.tag);
        if (!samePair) return false;
        const cRule = c.scoring_rule || (c.is_moon_battle ? 'moon_best_3_of_4' : 'best_3_of_4');
        return cRule === ruleKey;
      });
      if (alreadyToday) { msg1v1.textContent = `You already have a ${modeLabel} 1v1 with ${rival} today.`; return; }
      if (Number(profile.coins) < 2) { msg1v1.textContent = 'You need at least 2 Coins to send a 1v1.'; return; }
      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = 'Sending…';
      const { data: created, error } = await supabase.from('challenges_1v1').insert({
        challenger_tag: profile.tag,
        opponent_tag: rival,
        date_key: todayKey(),
        stake: 2,
        is_moon_battle: isMoonBattle,
        scoring_rule: ruleKey,
        status: 'pending',
        challenger_scores: [],
        opponent_scores: [],
        sabotage_state: isSabotage ? defaultSabotageState() : null,
      }).select('*').single();
      if (error || !created) {
        logSupabaseError('create 1v1 challenge', error);
        msg1v1.textContent = `Could not send challenge: ${error?.message || 'Run the sabotage_state SQL update first.'}`;
        btn.disabled = false;
        btn.textContent = prevText;
        return;
      }
      await changeCoins(-2);
      allChallenges = [created, ...allChallenges];
      active1v1Id = created.id;
      startGame('1v1', isMoonBattle, null, isMoonBattle, isSabotage);
    });
  };

  main.querySelectorAll('[data-play-1v1]').forEach(btn => btn.onclick = async () => {
  const cid = btn.getAttribute('data-play-1v1');
    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = 'Loading…';

    const { data: ch, error: fetchErr } = await supabase
      .from('challenges_1v1')
      .select('*')
      .eq('id', cid)
      .maybeSingle();

    if (fetchErr || !ch) {
      logSupabaseError('fetch 1v1 match by id', fetchErr);
      msg1v1.textContent = fetchErr ? `Error: ${fetchErr.message}` : 'Match no longer exists—refreshing…';
      await refreshCloudData();
      renderHome();
      return;
    }

    const stake = Number(ch.stake || 2);
    const isChallenger = String(ch.challenger_tag).toUpperCase() === profile.tag;
    const myScores = Array.isArray(isChallenger ? ch.challenger_scores : ch.opponent_scores)
      ? (isChallenger ? ch.challenger_scores : ch.opponent_scores)
      : [];
    const theirScores = Array.isArray(isChallenger ? ch.opponent_scores : ch.challenger_scores)
      ? (isChallenger ? ch.opponent_scores : ch.challenger_scores)
      : [];
    if (myScores.length >= 4) {
      await refreshCloudData();
      renderHome();
      return;
    }

    if (!isChallenger && ch.status === 'pending' && myScores.length === 0) {
      if (Number(profile.coins) < stake) {
        msg1v1.textContent = `Need ${stake} Coins to accept.`;
        btn.disabled = false;
        btn.textContent = prevLabel;
        return;
      }
      btn.textContent = 'Joining…';
      const { error } = await supabase.from('challenges_1v1').update({ status: 'active' }).eq('id', ch.id);
      if (error) {
        logSupabaseError('accept 1v1 challenge', error);
        msg1v1.textContent = `Could not join match: ${error.message}`;
        btn.disabled = false;
        btn.textContent = prevLabel;
        return;
      }
      await changeCoins(-stake);
    }

    active1v1Id = ch.id;
    const isSab = isSabotageMatch(ch);
    if (isSab) {
      const sab = ch.sabotage_state || defaultSabotageState();
      const myPending = isChallenger ? sab.cPending : sab.oPending;
      const theirPending = isChallenger ? sab.oPending : sab.cPending;
      const needsDraft = myScores.length >= 1 && myScores.length <= 3 && !myPending
        && (myScores.length > theirScores.length || Boolean(theirPending));
      if (needsDraft) {
        openSabotageResumedDraft(ch);
        return;
      }
    }
    startGame('1v1', Boolean(ch.is_moon_battle), null, Boolean(ch.is_moon_battle), isSab);
  });

  main.querySelector('#daily').onclick = () => {
    if (hasPlayedDailyToday()) { renderHome(); return; }
    const isOpen = dailySetup.style.display === 'block';
    dailySetup.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) predInput.focus();
  };

  lockBtn.onclick = async () => {
    if (hasPlayedDailyToday() || dailyStarting) return;
    const raw = predInput.value.trim();
    const predictedScore = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(predictedScore) || predictedScore < 0 || predictedScore > 120) {
      errorBox.textContent = 'Enter a whole number from 0 to 120.';
      return;
    }

    dailyStarting = true;
    lockBtn.disabled = true;
    lockBtn.textContent = 'Dealing…';

    const cloudOk = await getOrCreateAndIncrementPot();
    if (!cloudOk) {
      errorBox.textContent = 'Could not update the Pot. Try again.';
      dailyStarting = false;
      lockBtn.disabled = false;
      lockBtn.textContent = 'Lock In & Deal';
      return;
    }

    await changeCoins(-1);
    localStorage.setItem(`cotd_daily_${profile.tag}`, todayKey());
    localStorage.setItem('cotd_daily', todayKey());
    dailyStarting = false;
    startGame('daily', moonBox.checked, predictedScore);
  };
}

function startGame(mode, moon, predictedScore, isMoonBattle = false, isSabotage = false) {
  let excluded = [];
  if (mode === '1v1' && isSabotage && active1v1Id) {
    const ch = allChallenges.find(x => String(x.id) === String(active1v1Id));
    if (ch?.sabotage_state) {
      const isChallenger = String(ch.challenger_tag).toUpperCase() === profile.tag;
      excluded = isChallenger ? (ch.sabotage_state.cBurned || []) : (ch.sabotage_state.oBurned || []);
    }
  }
  const deck = makeDeck(mode === 'daily' ? `cotd-${todayKey()}` : '', excluded);
  const forceMoon = mode === '1v1' && Boolean(isMoonBattle);
  const disableMoon = mode === '1v1' && Boolean(isSabotage);
  game = {
    playerTag: profile.tag,
    mode,
    challengeId: mode === '1v1' ? active1v1Id : null,
    isMoonBattle: forceMoon,
    isSabotage1v1: disableMoon,
    moon: disableMoon ? false : (forceMoon ? true : Boolean(moon)),
    predictedScore: mode === 'daily' ? Number(predictedScore) : null,
    deck,
    grid: Array(16).fill(null),
    crib: [],
    cut: null,
    done: false,
    finishing: false,
    recordSaved: false,
    scores: [0, 0, 0, 0, 0],
  };
  if (settings.autofill) {
    for (let i = 0; i < 4; i++) game.grid[i] = game.deck.shift();
    game.crib.push(game.deck.shift());
  }
  save('cotd_game', game);
  render();
}

function placed() { return game.grid.filter(Boolean).length; }

function getLive1v1BoxHTML() {
  if (!game || game.mode !== '1v1') return '';
  const chId = game.challengeId || active1v1Id;
  const ch = allChallenges.find(x => String(x.id) === String(chId));
  const isSab = Boolean(isSabotageMatch(ch) || game.isSabotage1v1);
  const isMoon1v1 = Boolean(ch?.is_moon_battle ?? game.isMoonBattle);
  const isChallenger = ch ? String(ch.challenger_tag).toUpperCase() === profile.tag : true;
  const rival = ch ? (isChallenger ? ch.opponent_tag : ch.challenger_tag) : 'Rival';
  const prevMy = ch && Array.isArray(isChallenger ? ch.challenger_scores : ch.opponent_scores)
    ? (isChallenger ? ch.challenger_scores : ch.opponent_scores)
    : [];
  const theirScores = ch && Array.isArray(isChallenger ? ch.opponent_scores : ch.challenger_scores)
    ? (isChallenger ? ch.opponent_scores : ch.challenger_scores)
    : [];

  const currentHandTotal = game.scores.reduce((a, b) => a + b, 0);
  let currentEntry = currentHandTotal;
  if (!isSab && !isMoon1v1 && game.moon && game.done && currentHandTotal <= 10) currentEntry = 55;

  const mySeries = game.done && game.recordSaved ? prevMy : [...prevMy, currentEntry];
  const myScore = isSab ? sumAllHands1v1(mySeries) : top3Total1v1(mySeries, isMoon1v1);
  const theirScore = isSab ? sumAllHands1v1(theirScores) : top3Total1v1(theirScores, isMoon1v1);
  const handNum = Math.min(4, (game.done && game.recordSaved ? prevMy.length : prevMy.length + 1));

  let graveyardHTML = '';
  if (isSab) {
    const sab = ch?.sabotage_state || defaultSabotageState();
    const myBurned = isChallenger ? (sab.cBurned || []) : (sab.oBurned || []);
    const myKnown = isChallenger ? (sab.cKnown || []) : (sab.oKnown || []);
    const mySaved = isChallenger ? (sab.cSavedLast || []) : (sab.oSavedLast || []);
    const hiddenCount = Math.max(0, myBurned.length - myKnown.length);
    const knownList = myKnown.length ? myKnown.map(formatCardText).join(', ') : 'None';
    const savedNote = mySaved.length
      ? `<div style="color:#7ee787; margin-top:2px;">🛡️ Shield blocked last turn: <b>${mySaved.map(formatCardText).join(', ')}</b></div>`
      : '';

    graveyardHTML = `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,.15); font-size:11px; opacity:.95;">
      🔥 <b>Deck: ${52 - myBurned.length}/52 left</b> · Known Burned: <b>${escapeHTML(knownList)}</b>${hiddenCount ? ` <i>(+${hiddenCount} hidden)</i>` : ''}
      ${savedNote}
    </div>`;
  }

  const modeLabel = isSab
    ? `🔥 Sabotage 1v1 <button type="button" class="btn small" onclick="document.getElementById('help').click()" style="padding:1px 6px; font-size:10px; margin-left:4px;">?</button>`
    : (isMoon1v1 ? '🌙 Moon 1v1' : '⚔️ 1v1');
  const scoreLabel = isSab ? '4-HAND CUMULATIVE' : 'CUMULATIVE TOP-3';

  return `<div id="live-1v1-box" style="margin:6px 0 8px; padding:8px 10px; border:1px solid #f3d27a; border-radius:8px; background:rgba(0,0,0,.35); font-size:12px;">
    <div class="row" style="margin:0;">
      <div>
        <b>${modeLabel} vs ${escapeHTML(rival)}</b> · Hand ${handNum}/4<br>
        <span style="opacity:.85;">This hand: ${currentHandTotal} pts</span>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px; opacity:.8;">${scoreLabel}</div>
        <b style="font-size:14px; color:#f3d27a;">You: ${myScore}</b> · <span>Them: ${theirScore}</span>
      </div>
    </div>
    ${graveyardHTML}
  </div>`;
}

function renderBoard() {
  const main = root.querySelector('#main');
  if (!main) return;
  const n = placed();
  const moonLocked = game.isSabotage1v1 || game.moon || n >= 8;
  main.innerHTML = `<div class="felt"><div class="trays">
      <div class="tray"><div class="lbl">NEXT CARD</div><div class="slot" id="next"></div></div>
      <div class="tray cut"><div class="lbl">CUT CARD</div><div class="slot" id="cut"></div></div></div>
    ${getLive1v1BoxHTML()}
    <label class="row">🌙 Shoot the Moon ${game.moon ? '(ON)' : ''} <input type="checkbox" id="moon" ${game.moon ? 'checked' : ''} ${moonLocked ? 'disabled' : ''}></label>
    <div class="grid" id="grid"></div>
    <div class="scores">${['Hand 1', 'Hand 2', 'Hand 3', 'Hand 4', 'Crib'].map((l, i) => `<div class="sc">${l}<b id="sc${i}">${game.scores[i]}</b></div>`).join('')}</div>
    </div><div id="result"></div>`;
  main.querySelector('#moon').onchange = e => { if (e.target.checked) { game.moon = true; save('cotd_game', game); renderBoard(); renderHud(); } };
  const grid = main.querySelector('#grid');
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = el(`<div class="cell ${c === 4 ? 'crib' : ''}" data-r="${r}" data-c="${c}"></div>`);
      if (c < 4) {
        const card = game.grid[r * 4 + c];
        if (card) cell.innerHTML = cardHTML(card);
        else if (!game.cut && r === Math.floor(n / 4)) {
          cell.classList.add('open');
          cell.onclick = () => placeCard(r * 4 + c);
        }
      } else if (game.crib[r]) {
        cell.innerHTML = cardHTML(game.crib[r], !game.cut);
      }
      grid.appendChild(cell);
    }
  }
  if (!game.cut) main.querySelector('#next').innerHTML = game.deck[0] ? cardHTML(game.deck[0]) : '';
  else main.querySelector('#cut').innerHTML = cardHTML(game.cut);
  if (game.done) showResult();
}

function liveScores() {
  for (let c = 0; c < 4; c++) {
    const hand = [0, 1, 2, 3].map(r => game.grid[r * 4 + c]).filter(Boolean);
    game.scores[c] = total(scoreHand(hand, game.cut, false));
  }
}

function placeCard(i) {
  game.grid[i] = game.deck.shift();
  if (settings.sfx) { snap.currentTime = 0; snap.play().catch(() => {}); }
  const n = placed();
  if (n % 4 === 0) game.crib.push(game.deck.shift());
  liveScores();
  save('cotd_game', game);
  renderBoard();
  renderHud();
  root.querySelector('#next')?.classList.add('pulse');
  if (n === 16) setTimeout(revealCut, 400);
}

const sleep = s => new Promise(resolve => setTimeout(resolve, s * 1000));

async function revealCut() {
  if (!game || game.done || !game.cut && placed() !== 16) return;
  if (!game.cut) {
    game.cut = game.deck.shift();
    game.scores = [0, 0, 0, 0, game.cut.r === 11 ? 2 : 0];
    save('cotd_game', game);
    renderBoard();
  }
  const hands = [0, 1, 2, 3].map(c => [0, 1, 2, 3].map(r => game.grid[r * 4 + c]));
  hands.push(game.crib);
  for (let c = 0; c < 5; c++) {
    const combos = scoreHand(hands[c], game.cut, c === 4);
    if (settings.quick) { game.scores[c] += total(combos); continue; }
    if (c === 4 && game.cut.r === 11) await flash([], c, { pts: 2, label: 'His Heels for 2' });
    for (const combo of combos) {
      game.scores[c] += combo.pts;
      await flash(combo.idx, c, combo);
    }
  }
  game.done = true;
  game.finalTotalScore = game.scores.reduce((a, b) => a + b, 0);
  save('cotd_game', game);
  await finishGame();
}

async function flash(idx, col, combo) {
  const nodes = idx.map(i => i === 4 ? root.querySelector('#cut .card') : root.querySelector(`.cell[data-r="${i}"][data-c="${col}"] .card`)).filter(Boolean);
  if (!nodes.length) nodes.push(root.querySelector('#cut .card'));
  nodes.forEach(n => n?.classList.add('hl'));
  const first = nodes.find(Boolean);
  if (!first) return;
  const runningTotal = game.scores.reduce((a, b) => a + b, 0);
  const box = first.getBoundingClientRect();
  const badge = el(`<div class="badge" style="left:${box.left + box.width / 2}px;top:${box.top}px">+${combo.pts} · Total ${runningTotal}${settings.why ? `<small>${escapeHTML(combo.label)}</small>` : ''}</div>`);
  document.body.appendChild(badge);
  const scoreBox = root.querySelector('#sc' + col);
  if (scoreBox) {
    scoreBox.textContent = game.scores[col];
    scoreBox.classList.remove('pulse'); void scoreBox.offsetWidth; scoreBox.classList.add('pulse');
  }
  const live1v1El = root.querySelector('#live-1v1-box');
  if (live1v1El) live1v1El.outerHTML = getLive1v1BoxHTML();
  await sleep(settings.speed);
  badge.remove();
  nodes.forEach(n => n?.classList.remove('hl'));
}

async function finishGame() {
  if (!game || game.recordSaved || game.finishing) return;
  game.finishing = true;
  const score = Number(game.finalTotalScore ?? game.scores.reduce((a, b) => a + b, 0));
  const predictionMatched = game.mode === 'daily' && Number(game.predictedScore) === Number(game.finalTotalScore);
  let delta = game.mode === 'daily' ? payout(score, game.moon) : 0;
  if (predictionMatched) delta += 5;
  game.total = score;
  game.predictionMatched = predictionMatched;
  game.delta = delta;
  game.potPayout = game.mode === 'daily' && delta > 0 ? delta : 0;
  save('cotd_game', game);

  if (game.mode === 'daily' && delta !== 0) await adjustDailyPot(-delta);
  if (delta) await changeCoins(delta);

  const row = {
    player_tag: profile.tag,
    mode: game.moon ? 'moon' : game.mode,
    is_moon_shot: Boolean(game.moon),
    score,
    coins_delta: delta,
    pot_payout: game.potPayout,
    date_key: todayKey(),
    board_snapshot: { grid: game.grid, crib: game.crib, cut: game.cut, scores: game.scores },
  };const inserted = await supabase.from('games').insert(row).select('*').single();
  logSupabaseError('insert completed game', inserted.error);
  game.recordSaved = !inserted.error;
  game.finishing = false;
  save('cotd_game', game);

  const chId = game.challengeId || active1v1Id;
  if (game.mode === '1v1' && chId) {
    const { data: freshCh } = await supabase.from('challenges_1v1').select('*').eq('id', chId).single();
    if (freshCh && freshCh.status !== 'expired') {
      const isSab = isSabotageMatch(freshCh);
      const isMoonBattle = Boolean(freshCh.is_moon_battle);
      const isChallenger = String(freshCh.challenger_tag).toUpperCase() === profile.tag;
      const field = isChallenger ? 'challenger_scores' : 'opponent_scores';
      const prevArr = Array.isArray(freshCh[field]) ? freshCh[field] : [];

      let entry;
      if (isSab) {
        entry = score;
        game.effective1v1Label = `${score} pts (Sabotage Cumulative)`;
      } else if (isMoonBattle) {
        entry = score;
        game.effective1v1Label = `${score} pts (Moon Battle)`;
      } else if (game.moon) {
        if (score <= 10) {
          entry = 55;
          game.effective1v1Label = `🌙 Moon Shot! Counts as 55 pts`;
        } else {
          entry = { score, moonGambleMissed: true };
          game.effective1v1Label = `Moon Missed (${score} pts · −2 avg penalty if dropped)`;
        }
      } else {
        entry = score;
        game.effective1v1Label = `${score} pts`;
      }

      const updatedArr = prevArr.length < 4 ? [...prevArr, entry] : prevArr;
      const patch = { [field]: updatedArr };

      const cScores = isChallenger ? updatedArr : (Array.isArray(freshCh.challenger_scores) ? freshCh.challenger_scores : []);
      const oScores = isChallenger ? (Array.isArray(freshCh.opponent_scores) ? freshCh.opponent_scores : []) : updatedArr;

      if (cScores.length >= 4 && oScores.length >= 4 && freshCh.status !== 'completed') {
        const cMetric = isSab ? sumAllHands1v1(cScores) : score1v1Series(cScores, isMoonBattle);
        const oMetric = isSab ? sumAllHands1v1(oScores) : score1v1Series(oScores, isMoonBattle);
        const stake = Number(freshCh.stake || 2);
        const diff = Math.abs(cMetric - oMetric);
        const marginWon = isSab ? Math.floor(diff / 4) : Math.floor(diff);

        let winnerTag = 'TIE';
        if (marginWon > 0) {
          const challengerWins = isMoonBattle ? (cMetric < oMetric) : (cMetric > oMetric);
          winnerTag = challengerWins ? freshCh.challenger_tag : freshCh.opponent_tag;
        }

        patch.status = 'completed';
        patch.challenger_avg = Number(cMetric.toFixed(2));
        patch.opponent_avg = Number(oMetric.toFixed(2));
        patch.winner_tag = winnerTag;
        patch.coins_won = marginWon;

        if (winnerTag === 'TIE') {
          await changeCoins(stake);
          const rivalTag = isChallenger ? freshCh.opponent_tag : freshCh.challenger_tag;
          const rivalProf = profiles.find(p => p.tag === rivalTag);
          if (rivalProf) await supabase.from('profiles').update({ coins: Number(rivalProf.coins) + stake }).eq('tag', rivalTag);
        } else if (winnerTag === profile.tag) {
          await changeCoins(stake + marginWon);
          const loserTag = isChallenger ? freshCh.opponent_tag : freshCh.challenger_tag;
          const loserProf = profiles.find(p => p.tag === loserTag);
          const extraLoss = Math.max(0, marginWon - stake);
          if (loserProf && extraLoss > 0) {
            await supabase.from('profiles').update({ coins: Math.max(0, Number(loserProf.coins) - extraLoss) }).eq('tag', loserTag);
          }
        } else {
          const extraLoss = Math.max(0, marginWon - stake);
          if (extraLoss > 0) await changeCoins(-Math.min(Number(profile.coins), extraLoss));
          const winProf = profiles.find(p => p.tag === winnerTag);
          if (winProf) await supabase.from('profiles').update({ coins: Number(winProf.coins) + stake + marginWon }).eq('tag', winnerTag);
        }
      }
      await supabase.from('challenges_1v1').update(patch).eq('id', chId);
      game.handsCompleted1v1 = updatedArr.length;
      game.isMoonBattle1v1 = isMoonBattle;
      game.isSabotage1v1 = isSab;
      game.needsSabotageDraft = isSab && updatedArr.length >= 1 && updatedArr.length <= 3;
      game.sabotageDraftSubmitted = false;
      save('cotd_game', game);
      if (updatedArr.length >= 4) active1v1Id = null;
    }
  }

 await refreshCloudData();
  if (game.mode === '1v1') check1v1LossStreakEasterEgg();
  const myRecent = allGames
    .filter(g => g.playerTag === profile.tag && g.isMoonShot === Boolean(game.moon))
    .slice(0, 10)
    .reverse()
    .map(g => g.score);
  checkEasterEggTriggers(score, Boolean(game.moon), myRecent);
  renderBoard();
  renderHud();
}

function openSabotageResumedDraft(ch) {
  const isChallenger = String(ch.challenger_tag).toUpperCase() === profile.tag;
  const myScores = Array.isArray(isChallenger ? ch.challenger_scores : ch.opponent_scores)
    ? (isChallenger ? ch.challenger_scores : ch.opponent_scores)
    : [];
  const lastHand = allGames.find(g => g.playerTag === profile.tag && g.boardSnapshot);
  game = {
    playerTag: profile.tag,
    mode: '1v1',
    challengeId: ch.id,
    isMoonBattle: false,
    isSabotage1v1: true,
    moon: false,
    grid: lastHand?.boardSnapshot?.grid || Array(16).fill(null),
    crib: lastHand?.boardSnapshot?.crib || [],
    cut: lastHand?.boardSnapshot?.cut || null,
    done: true,
    recordSaved: true,
    scores: lastHand?.boardSnapshot?.scores || [0, 0, 0, 0, 0],
    total: Number(myScores[myScores.length - 1] ?? 0),
    finalTotalScore: Number(myScores[myScores.length - 1] ?? 0),
    handsCompleted1v1: myScores.length,
    needsSabotageDraft: true,
    sabotageDraftSubmitted: false,
  };
  save('cotd_game', game);
  render();
}

function showResult() {
  const box = root.querySelector('#result');
  if (!box) return;
  const goal = game.moon ? (game.total <= 10 ? '🌙 Moon shot!' : 'Moon missed') : '';
  const predictionResult = game.mode === 'daily' ? game.predictionMatched
    ? '<div class="prediction-win">Exact Prediction Match! +5 Bonus Coins</div>'
    : `<p class="prediction-summary">Predicted: ${Number(game.predictedScore)} | Actual: ${Number(game.finalTotalScore ?? game.total)}</p>` : '';
  const is1v1 = game.mode === '1v1';
  const isSab = Boolean(game.isSabotage1v1);
  const handsDone = Number(game.handsCompleted1v1 || 0);

  // Sabotage Draft Phase (after Hands 1, 2, or 3)
  if (is1v1 && isSab && game.needsSabotageDraft && !game.sabotageDraftSubmitted) {
    const roundNum = handsDone;
    const cfg = SABOTAGE_ROUNDS[roundNum];
    const chId = game.challengeId || active1v1Id;
    const ch = allChallenges.find(x => String(x.id) === String(chId));
    const isChallenger = ch ? String(ch.challenger_tag).toUpperCase() === profile.tag : true;
    const sab = ch?.sabotage_state || defaultSabotageState();
    const rivalBurned = isChallenger ? (sab.oBurned || []) : (sab.cBurned || []);

    if (!game.sabotagePool || game.sabotagePoolRound !== roundNum) {
      game.sabotagePool = makeDeck('', rivalBurned).slice(0, cfg.pool);
      game.sabotagePoolRound = roundNum;
      save('cotd_game', game);
    }

    let shieldChoice = null; // { type: 'row'|'col', idx: 0..3 }
    let burnSelection = [];  // indices in game.sabotagePool
    let revealSelection = []; // indices in game.sabotagePool (subset of burnSelection)

    const getShieldCards = () => {
      if (!shieldChoice) return [];
      if (shieldChoice.type === 'row') {
        const r = shieldChoice.idx;
        const rowCards = [0, 1, 2, 3].map(c => game.grid[r * 4 + c]).filter(Boolean);
        if (game.crib[r]) rowCards.push(game.crib[r]);
        return rowCards;
      }
      const c = shieldChoice.idx;
      return [0, 1, 2, 3].map(r => game.grid[r * 4 + c]).filter(Boolean);
    };

    const highlightShieldOnBoard = () => {
      root.querySelectorAll('#grid .cell').forEach(cell => cell.classList.remove('shield-hl'));
      if (!shieldChoice) return;
      if (shieldChoice.type === 'row') {
        root.querySelectorAll(`#grid .cell[data-r="${shieldChoice.idx}"]`).forEach(cell => cell.classList.add('shield-hl'));
      } else {
        root.querySelectorAll(`#grid .cell[data-c="${shieldChoice.idx}"]`).forEach(cell => cell.classList.add('shield-hl'));
      }
    };

    const renderSabotageDraft = () => {
      highlightShieldOnBoard();
      const shieldCards = getShieldCards();
      const ready = Boolean(shieldChoice) && burnSelection.length === cfg.burn && revealSelection.length === cfg.chooseReveal;

      box.innerHTML = `<div class="felt result-card" style="text-align:left;">
        <div class="eyebrow">🔥 SABOTAGE PHASE · AFTER HAND ${roundNum}/4 (HAND SCORE: ${game.finalTotalScore ?? game.total} PTS)</div>
        <h3 style="margin:4px 0 8px; color:#f3d27a;">1. Secret Shield (Protect 1 Row or 1 Column)</h3>
        <p style="font-size:12px; margin:0 0 6px; opacity:.9;">
          If your opponent tries to burn any of your shielded cards, the burn fizzles! Rows shield <b>5 cards</b> (incl. Crib); Columns shield <b>4 cards</b>.
        </p>
        <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:4px;">
          ${[0, 1, 2, 3].map(r => `<button type="button" class="btn small ${shieldChoice?.type === 'row' && shieldChoice.idx === r ? 'gold-btn' : ''}" data-sh-type="row" data-sh-idx="${r}">Row ${r + 1} (5)</button>`).join('')}
        </div>
        <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;">
          ${[0, 1, 2, 3].map(c => `<button type="button" class="btn small ${shieldChoice?.type === 'col' && shieldChoice.idx === c ? 'gold-btn' : ''}" data-sh-type="col" data-sh-idx="${c}">Hand ${c + 1} (4)</button>`).join('')}
        </div>
        ${shieldChoice ? `<div style="font-size:12px; color:#7cc4ff; margin-bottom:10px;">🛡️ Shielded (${shieldCards.length}): <b>${shieldCards.map(formatCardText).join(', ')}</b></div>` : ''}

        <h3 style="margin:6px 0 4px; color:#f3d27a;">2. Burn ${cfg.burn} of ${cfg.pool} Rival Cards &amp; Expose ${cfg.chooseReveal}</h3>
        <p style="font-size:12px; margin:0 0 8px; opacity:.9;">
          Tap <b>${cfg.burn}</b> cards to burn (${burnSelection.length}/${cfg.burn}), then tap <b>👁️ Expose</b> on <b>${cfg.chooseReveal}</b> of them (${revealSelection.length}/${cfg.chooseReveal})${cfg.randomReveal ? ` — plus <b>${cfg.randomReveal} random</b> burned card will leak` : ''}.
        </p>
        <div class="sab-pool">
          ${game.sabotagePool.map((c, idx) => {
            const isBurned = burnSelection.includes(idx);
            const isExposed = revealSelection.includes(idx);
            const red = c.s === 1 || c.s === 2;
            return `<div class="sab-slot">
              <div class="card ${red ? 'red' : 'blk'} ${isBurned ? 'sab-burn' : ''}" data-sab-card="${idx}" style="cursor:pointer; margin:auto;">
                <span class="r">${RANKS[c.r - 1]}</span><span class="s">${SUITS[c.s]}</span>
              </div>
              ${isBurned ? `<button type="button" class="btn small ${isExposed ? 'gold-btn' : ''}" data-sab-eye="${idx}" style="margin-top:4px; padding:3px 6px; font-size:11px;">${isExposed ? '👁️ Shown' : '🙈 Hide'}</button>` : '<div style="height:26px;"></div>'}
            </div>`;
          }).join('')}
        </div>

        <p class="error-text" id="sab-err" style="margin:6px 0;"></p>
        <button class="btn gold-btn" id="lock-sabotage" type="button" style="width:100%; margin-top:6px;" ${ready ? '' : 'disabled'}>
          🔥 Lock In Shield &amp; Sabotage
        </button>
      </div>`;

      box.querySelectorAll('[data-sh-type]').forEach(btn => btn.onclick = () => {
        shieldChoice = { type: btn.getAttribute('data-sh-type'), idx: Number(btn.getAttribute('data-sh-idx')) };
        renderSabotageDraft();
      });

      box.querySelectorAll('[data-sab-card]').forEach(cardEl => cardEl.onclick = () => {
        const idx = Number(cardEl.getAttribute('data-sab-card'));
        if (burnSelection.includes(idx)) {
          burnSelection = burnSelection.filter(i => i !== idx);
          revealSelection = revealSelection.filter(i => i !== idx);
        } else if (burnSelection.length < cfg.burn) {
          burnSelection = [...burnSelection, idx];
          if (revealSelection.length < cfg.chooseReveal) revealSelection = [...revealSelection, idx];
        }
        renderSabotageDraft();
      });

      box.querySelectorAll('[data-sab-eye]').forEach(eyeBtn => eyeBtn.onclick = () => {
        const idx = Number(eyeBtn.getAttribute('data-sab-eye'));
        if (!burnSelection.includes(idx)) return;
        if (revealSelection.includes(idx)) {
          revealSelection = revealSelection.filter(i => i !== idx);
        } else if (revealSelection.length < cfg.chooseReveal) {
          revealSelection = [...revealSelection, idx];
        } else if (cfg.chooseReveal === 1) {
          revealSelection = [idx];
        }
        renderSabotageDraft();
      });

      box.querySelector('#lock-sabotage').onclick = async () => {
        if (!ready) return;
        const submitBtn = box.querySelector('#lock-sabotage');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Locking In…';

        const { data: latestCh, error: loadErr } = await supabase.from('challenges_1v1').select('*').eq('id', chId).single();
        if (loadErr || !latestCh) {
          box.querySelector('#sab-err').textContent = 'Could not sync match. Try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = '🔥 Lock In Shield & Sabotage';
          return;
        }

        const iAmC = String(latestCh.challenger_tag).toUpperCase() === profile.tag;
        let nextState = latestCh.sabotage_state ? { ...defaultSabotageState(), ...latestCh.sabotage_state } : defaultSabotageState();
        const pendingKey = iAmC ? 'cPending' : 'oPending';
        nextState[pendingKey] = {
          round: roundNum,
          shield: getShieldCards(),
          burn: burnSelection.map(i => game.sabotagePool[i]),
          chosenReveal: revealSelection.map(i => game.sabotagePool[i]),
        };

        if (nextState.cPending && nextState.oPending && nextState.cPending.round === roundNum && nextState.oPending.round === roundNum) {
          nextState = resolveSabotageRound(nextState, roundNum);
        }

        const { error: upErr } = await supabase.from('challenges_1v1').update({ sabotage_state: nextState }).eq('id', chId);
        if (upErr) {
          box.querySelector('#sab-err').textContent = `Save failed: ${upErr.message}`;
          submitBtn.disabled = false;
          submitBtn.textContent = '🔥 Lock In Shield & Sabotage';
          return;
        }

        game.needsSabotageDraft = false;
        game.sabotageDraftSubmitted = true;
        game.sabotagePool = null;
        save('cotd_game', game);
        await refreshCloudData();
        showResult();
      };
    };

    renderSabotageDraft();
    return;
  }

  // Standard Post-Hand Result Panel
  const chId = game.challengeId || active1v1Id;
  const ch = is1v1 ? allChallenges.find(x => String(x.id) === String(chId)) : null;
  const isChallenger = ch ? String(ch.challenger_tag).toUpperCase() === profile.tag : true;
  const sab = ch?.sabotage_state || defaultSabotageState();
  const waitingSabotage = is1v1 && isSab && handsDone < 4 && Boolean(isChallenger ? sab.cPending : sab.oPending);

  const more1v1 = is1v1 && handsDone > 0 && handsDone < 4 && !waitingSabotage;
  const replayLabel = is1v1
    ? (waitingSabotage
        ? `Waiting for Rival's Round ${handsDone} Sabotage…`
        : (more1v1 ? `Play Hand ${handsDone + 1}/4` : '1v1 Hands Complete (4/4)'))
    : 'Replay';

  box.innerHTML = `<div class="felt result-card" style="text-align:center"><h3>Total: ${game.finalTotalScore ?? game.total} points ${goal}</h3>
    ${predictionResult}
    ${is1v1 ? `<p>⚔️ 1v1 Progress: <b>${handsDone}/4 Hands Played</b>${game.effective1v1Label ? `<br><small>${escapeHTML(game.effective1v1Label)}</small>` : ''}</p>` : ''}
    ${game.mode === 'daily' ? `<p>Coins: ${game.delta >= 0 ? '+' : ''}${game.delta}${game.total >= 51 && !game.moon ? ' · Pot share settles at midnight' : ''}</p>` : ''}
    <div class="row"><button class="btn" id="replay" style="flex:1" ${is1v1 && !more1v1 ? 'disabled' : ''}>${replayLabel}</button><button class="btn" id="back" style="flex:1">Back to Home</button></div></div>`;
  box.querySelector('#replay').onclick = () => {
    if (is1v1) {
      if (!more1v1) return;
      active1v1Id = game.challengeId || active1v1Id;
      startGame('1v1', Boolean(game.isMoonBattle1v1), null, Boolean(game.isMoonBattle1v1), isSab);
    } else {
      startGame(game.mode === 'daily' ? 'free' : game.mode, false, null);
    }
  };
  box.querySelector('#back').onclick = () => { game = null; save('cotd_game', null); render(); };
}

function modal(html) {
  const m = el(`<div class="overlay"><div class="modal"><button class="modal-x" id="close-m-top" type="button" aria-label="Close">✕</button>${html}<button class="btn" id="close-m" style="width:100%;margin-top:12px">Close</button></div></div>`);
  const closeModal = () => m.remove();
  m.querySelector('#close-m-top').onclick = closeModal;
  m.querySelector('#close-m').onclick = closeModal;
  m.addEventListener('click', e => {
    if (e.target === m) closeModal();
  });
  document.body.appendChild(m);
  return m;
}
function showSettings() {
  const m = modal(`<h3>Settings</h3>
    <label class="row">Background Music <input type="checkbox" data-k="music" ${settings.music ? 'checked' : ''}></label>
    <label class="row">Card Sound Effects <input type="checkbox" data-k="sfx" ${settings.sfx ? 'checked' : ''}></label>
    <label class="row">Quick Play <input type="checkbox" data-k="quick" ${settings.quick ? 'checked' : ''}></label>
    <label class="row">Show Why Points Scored <input type="checkbox" data-k="why" ${settings.why ? 'checked' : ''}></label>
    <label class="row">Scoring Animation Speed <span id="spv">${settings.speed}s</span>
    <input type="range" min="0.25" max="1.2" step="0.05" value="${settings.speed}" id="sp" style="width:100%"></label>`);
  m.querySelectorAll('[data-k]').forEach(input => input.onchange = () => {
    settings[input.dataset.k] = input.checked;
    save('cotd_settings', settings);
    if (settings.music) ensureMusicPlaying(); else music.pause();
  });
  m.querySelector('#sp').oninput = e => {
    settings.speed = +e.target.value;
    m.querySelector('#spv').textContent = settings.speed + 's';
    save('cotd_settings', settings);
  };
}

function showRules() {
  modal(`<h3>Cribbage Scoring</h3><ul><li>15s: 2 per combination</li><li>Pair 2 · Trips 6 · Quads 12</li><li>Runs: 1 per card (3+), doubles count</li>
    <li>Hand flush: 4 (5 with matching Cut)</li><li>Crib flush: only all 5 cards, 5 points</li><li>His Nobs: Jack matching Cut suit, +1</li><li>His Heels: Cut Card is a Jack, +2 to Crib</li></ul>
    <h3>Crib of the Day Payouts</h3><p>Entry 1 Coin (+1 to the Daily Pot, starts at 10).<br>0–10: +10 · 11–20: −5 · 21–25: −2 · 26–30: −1 · 31–40: 0 · 41–45: +1 · 46–50: +5<br>
    51–55: split Pot 1 (40%) · 56+: split Pot 2 (60%), min 6 Coins each. Exact guess: +5 Coins.</p>
    <h3>Shooting the Moon</h3><p>Toggle anytime before placing the first card in Row 3 (9th slot). Goal: ≤10 points. Daily: ≤10 = +10 Coins, otherwise −5. A 0 enters the Hall of Fame.</p>
<h3>1v1 Arena (Best 3 of 4)</h3><p>2-Coin pay-in per player (max 1 match per opponent per day). Each player plays 4 hands; your top 3 scores are averaged. Winner gets their 2 Coins back plus the rounded-down average lead.<br>
<b>🌙 Moon 1v1 Toggle:</b> Challenge someone to a dedicated Shoot the Moon battle where the <b>lowest</b> 3-of-4 average wins.<br>
<b>Standard 1v1 Moon Gamble:</b> Toggle Shoot the Moon during a standard 1v1 hand—if you hit ≤10, it counts as <b>55 pts</b>! If you miss, it counts as your regular score, and if it is your dropped lowest hand, you take a <b>−2 pt</b> penalty on your 3-hand average.<br>
Matches not completed within 24 hours forfeit automatically with a full 2-Coin refund and no stat impact.<br>
<b>🔥 Sabotage 1v1:</b> 4-hand cumulative total (Moon disabled; payout = <code>⌊lead ÷ 4⌋</code> Coins). After Hands 1, 2, and 3, secretly shield <b>1 Row (5 cards incl. Crib)</b> or <b>1 Column (4 cards)</b> to block incoming burns, then burn <b>2 of 4 → 4 of 6 → 6 of 8</b> cards from your rival's deck permanently (exposing <b>1 → 2 → 3</b> while the rest stay hidden).</p>`);
}

function stats(scores, isMoon = false) {
  const clean = scores.map(Number).filter(Number.isFinite);
  const n = clean.length;
  if (!n) return { n: 0, mean: 0, sd: 0, best: null, low: 0, high: 0, width: 0 };
  const mean = clean.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(clean.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const margin = n > 1 ? 1.645 * sd / Math.sqrt(n) : 0;
  return { n, mean, sd, best: isMoon ? Math.min(...clean) : Math.max(...clean), low: mean - margin, high: mean + margin, width: margin * 2 };
}

function statsSummary(scores, isMoon = false) {
  const s = stats(scores, isMoon);
  if (!s.n) return 'No games yet.';
  const bestLabel = s.best !== null ? ` · Best: ${s.best}` : '';
  return `x̄ = ${s.mean.toFixed(2)} · s = ${s.sd.toFixed(2)} · n = ${s.n}${bestLabel}<br>90% Confidence Level: ${s.low.toFixed(2)} – ${s.high.toFixed(2)}<br><i>Range where your true population average score lies.</i>`;
}

function renderHistogramHTML(scores, isMoon = false) {
  const clean = scores.map(Number).filter(Number.isFinite);
  if (!clean.length) return '<p class="empty-note">Play a game in this mode to unlock your score histogram.</p>';

  const maxBucket = isMoon ? 24 : 60;
  const bins = [];
  for (let start = 0; start < maxBucket; start += 2) {
    bins.push({
      label: start % 10 === 0 ? String(start) : '',
      range: `${start}–${start + 1}`,
      min: start,
      max: start + 1,
    });
  }
  bins.push({
    label: `${maxBucket}+`,
    range: `${maxBucket}+`,
    min: maxBucket,
    max: 999,
  });

  const counts = bins.map(b => clean.filter(v => v >= b.min && v <= b.max).length);
  const maxCount = Math.max(1, ...counts);
  const midTick = Math.ceil(maxCount / 2);

  return `
    <div class="hist-box">
      <div class="hist-title">Score Distribution (2-Pt Bins)</div>
      <div class="hist-wrap">
        <div class="hist-yaxis">
          <span>${maxCount}</span>
          <span>${midTick !== maxCount && midTick > 0 ? midTick : ''}</span>
          <span>0</span>
        </div>
        <div class="hist-bars hist-2pt">
          ${bins.map((b, i) => {
            const pct = Math.round((counts[i] / maxCount) * 100);
            const tip = `${b.range} pts: ${counts[i]} ${counts[i] === 1 ? 'game' : 'games'}`;
            return `<div class="hist-col" title="${tip}">
              <div class="hist-count">${counts[i] || ''}</div>
              <div class="hist-track"><div class="hist-fill" style="height:${pct}%"></div></div>
              <div class="hist-xlabel">${b.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function gameRows(list, extra) {
  return `<table><tbody>${list.map((g, i) => `<tr><td>${i + 1}</td><td>${escapeHTML(g.playerTag)}</td><td>${Number(g.score)}</td><td>${extra ? extra(g) : ''}</td></tr>`).join('') || '<tr><td colspan="4">No saved games yet</td></tr>'}</tbody></table>`;
}

async function showBoards() {
  await refreshCloudData();
  const today = allGames.filter(g => g.dateKey === todayKey());
  const standard = allGames.filter(g => !g.isMoonShot);
  const daily = today.filter(g => g.mode === 'daily' && !g.isMoonShot).sort((a, b) => b.score - a.score);
  const todayTop = today.filter(g => !g.isMoonShot).sort((a, b) => b.score - a.score).slice(0, 10);
  const moonWinners = today.filter(g => g.isMoonShot && g.score <= 10).sort((a, b) => a.score - b.score);
  const topAll = [...standard].sort((a, b) => b.score - a.score).slice(0, 14);
  const lowest = [...standard].sort((a, b) => a.score - b.score).slice(0, 1);
  const zeroMoons = allGames.filter(g => g.isMoonShot && g.score === 0);
  const potWinners = [...standard].filter(g => g.mode === 'daily' && Number(g.potPayout) > 0).sort((a, b) => b.potPayout - a.potPayout).slice(0, 5);
  const championsMarkup = champions.map(c => `<tr><td>${escapeHTML(c.date_key)}</td><td>${escapeHTML(c.player_tag)}</td><td>${Number(c.winning_score)}</td><td><button class="btn small" data-champ="${escapeHTML(c.id)}">View Hand</button></td></tr>`).join('') || '<tr><td colspan="4">No champions recorded yet</td></tr>';

  let activeDataset = 'standard';
  let activeLimit = 'all';
  let winsOnly = false;

  const m = modal(`<h2>Boards &amp; Stats</h2>
    <div class="profile-card">
      <div>
        <div class="eyebrow">YOUR PROFILE</div>
        <strong class="profile-tag">${escapeHTML(profile.tag)}</strong> · 🪙 ${Number(profile.coins)} Coins
      </div>
      <div class="pin-box">
        <span>PIN: <b>${escapeHTML(profile.pin ?? '----')}</b></span>
        <button class="btn small" id="copy-pin">Copy</button>
      </div>
    </div>
    <div class="pot-banner">Current Pot Value <strong>${livePot} Coins</strong></div>
${(() => {
      const my1v1 = allChallenges.filter(c => c.status === 'completed' && (c.challenger_tag === profile.tag || c.opponent_tag === profile.tag));
      const wins = my1v1.filter(c => c.winner_tag === profile.tag);
      const losses = my1v1.filter(c => c.winner_tag && c.winner_tag !== 'TIE' && c.winner_tag !== profile.tag);
      const netCoins = wins.reduce((s, c) => s + Number(c.coins_won || 0), 0) - losses.reduce((s, c) => s + Number(c.coins_won || 0), 0);
      return `<div class="pot-banner" style="font-size:13px;">
        <span>⚔️ Your 1v1 Record: <b>${wins.length}W – ${losses.length}L</b></span>
        <strong>${netCoins >= 0 ? '+' : ''}${netCoins} Coins</strong>
      </div>
      <section class="stats-summary-card" style="margin-top:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <h4 style="margin:0; color:#f3d27a;">Your 1v1 Match History</h4>
          <div class="pill-tabs sub" id="sort-1v1-tabs" style="margin:0;">
            <button class="tab-pill active" data-s1v1="newest">Newest</button>
            <button class="tab-pill" data-s1v1="oldest">Oldest</button>
            <button class="tab-pill" data-s1v1="highest">Highest</button>
            <button class="tab-pill" data-s1v1="lowest">Lowest</button>
          </div>
        </div>
        <div id="history-1v1-boxes" style="max-height:240px; overflow-y:auto; margin-top:8px;"></div>
      </section>`;
    })()}
    <section class="stats-summary-card">
      <div class="pill-tabs" id="dataset-tabs">
        <button class="tab-pill active" data-ds="standard">Standard Play</button>
        <button class="tab-pill" data-ds="moon">Shooting the Moon</button>
      </div>
      <div class="pill-tabs sub" id="limit-tabs">
        <button class="tab-pill active" data-lim="all">All-Time</button>
        <button class="tab-pill" data-lim="10">Last 10</button>
        <button class="tab-pill" data-lim="30">Last 30</button>
        <button class="tab-pill" data-lim="100">Last 100</button>
      </div>
      <div id="personal-stats-body"></div>
      <label class="probability-inline">Probability Finder X <input type="number" id="px" style="width:82px"><span id="pout"></span></label>
      <div class="history-header">
        <h4>Your Score History</h4>
        <button class="btn small" id="toggle-wins">All Games</button>
      </div>
      <div class="history-scroll" id="personal-history-table"></div>
    </section>
    <section class="compare-search"><h3>Compare Against Another Player</h3><div class="compare-search-row"><input type="search" id="tag-search" placeholder="Player tag (ACE#1) or initials (ACE)" autocomplete="off"><button class="btn" id="tag-search-btn">Search</button></div>
      <label class="moon-compare-toggle"><input type="checkbox" id="compare-moon"> Compare Shooting the Moon stats</label>
      <div id="compare-matches" aria-live="polite"></div><div id="comparison-card"></div>
    </section>
    <h3>Crib of the Day · Today</h3>${gameRows(daily)}
    <h3>Top 10 Today · Standard</h3>${gameRows(todayTop, g => g.mode === 'daily' ? 'DAILY' : 'FREE')}
    <h3>Shooting the Moon Winners · Today</h3>${gameRows(moonWinners)}
    <h3>Hall of Fame · Top 14 Standard Scores</h3>${gameRows(topAll, g => escapeHTML(g.dateKey))}
    <h3>Lowest Standard Score</h3>${gameRows(lowest, g => escapeHTML(g.dateKey))}
    <h3>Zero-Score Moon Legends</h3>${gameRows(zeroMoons, g => `<button class="btn small" data-view-game="${escapeHTML(g.id)}">View Hand</button>`)}
    <h3>Top 5 Daily Pot Payouts</h3>${gameRows(potWinners, g => `${Number(g.potPayout)} Coins · ${escapeHTML(g.dateKey)}`)}
    <h3>Crib of the Day Champions</h3><table><tbody>${championsMarkup}</tbody></table>`);

  m.querySelector('#copy-pin').onclick = () => {
    navigator.clipboard?.writeText(`${profile.tag} (PIN: ${profile.pin})`);
    const btn = m.querySelector('#copy-pin');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  };

  const getFilteredPersonalGames = () => {
    const isMoon = activeDataset === 'moon';
    let list = allGames.filter(g => g.playerTag === profile.tag && g.isMoonShot === isMoon);
    if (activeLimit !== 'all') list = list.slice(0, Number(activeLimit));
    return list;
  };

  const renderPersonalStats = () => {
    const isMoon = activeDataset === 'moon';
    const myGames = getFilteredPersonalGames();
    const myScores = myGames.map(g => g.score);
    const allModeScores = allGames.filter(g => g.isMoonShot === isMoon).map(g => g.score);

    m.querySelector('#personal-stats-body').innerHTML = `
      <h3>Your ${isMoon ? 'Shooting the Moon' : 'Standard Play'} Summary · ${escapeHTML(profile.tag)}</h3>
      <p>${statsSummary(myScores, isMoon)}</p>
      <p>All players · ${statsSummary(allModeScores, isMoon)}</p>
      ${renderHistogramHTML(myScores, isMoon)}`;

    const pxInput = m.querySelector('#px');
    const pout = m.querySelector('#pout');
    if (myScores.length >= 2 && pxInput.value !== '') {
      const own = stats(myScores, isMoon);
      const z = (Number(pxInput.value) - own.mean) / (own.sd || 1);
      pout.textContent = `Z=${z.toFixed(2)} · P(≥X)=${(100 * (1 - phi(z))).toFixed(1)}% · P(≤X)=${(100 * phi(z)).toFixed(1)}%`;
    } else {
      pout.textContent = '';
    }

    const visibleHistory = winsOnly
      ? myGames.filter(g => (isMoon ? g.score <= 10 : g.coinsDelta > 0 || g.potPayout > 0))
      : myGames;

    m.querySelector('#personal-history-table').innerHTML = `<table>
      <thead><tr><th>#</th><th>Score</th><th>Mode</th><th>Coins</th><th>Date</th></tr></thead>
      <tbody>${visibleHistory.map((g, idx) => {
        const modeLabel = g.isMoonShot ? 'MOON' : (g.mode === 'daily' ? 'DAILY' : 'FREE');
        const deltaStr = g.coinsDelta ? `${g.coinsDelta > 0 ? '+' : ''}${g.coinsDelta}` : '0';
        return `<tr><td>${idx + 1}</td><td><b>${g.score}</b></td><td>${modeLabel}</td><td>${deltaStr}</td><td>${escapeHTML(g.dateKey)}</td></tr>`;
      }).join('') || `<tr><td colspan="5">${winsOnly ? 'No winning rounds in this filter yet' : 'No completed games yet'}</td></tr>`}</tbody>
    </table>`;
  };

  m.querySelectorAll('#dataset-tabs .tab-pill').forEach(btn => btn.onclick = () => {
    activeDataset = btn.dataset.ds;
    m.querySelectorAll('#dataset-tabs .tab-pill').forEach(b => b.classList.toggle('active', b === btn));
    renderPersonalStats();
  });

  m.querySelectorAll('#limit-tabs .tab-pill').forEach(btn => btn.onclick = () => {
    activeLimit = btn.dataset.lim;
    m.querySelectorAll('#limit-tabs .tab-pill').forEach(b => b.classList.toggle('active', b === btn));
    renderPersonalStats();
  });

  m.querySelector('#toggle-wins').onclick = () => {
    winsOnly = !winsOnly;
    m.querySelector('#toggle-wins').textContent = winsOnly ? 'Wins Only ★' : 'All Games';
    renderPersonalStats();
  };

  m.querySelector('#px').oninput = e => {
    const isMoon = activeDataset === 'moon';
    const myScores = getFilteredPersonalGames().map(g => g.score);
    if (myScores.length < 2 || e.target.value === '') {
      m.querySelector('#pout').textContent = '';
      return;
    }
    const own = stats(myScores, isMoon);
    const z = (Number(e.target.value) - own.mean) / (own.sd || 1);
    m.querySelector('#pout').textContent = `Z=${z.toFixed(2)} · P(≥X)=${(100 * (1 - phi(z))).toFixed(1)}% · P(≤X)=${(100 * phi(z)).toFixed(1)}%`;
  };

 renderPersonalStats();

  let sort1v1Mode = 'newest';
  const render1v1HistoryBoxes = () => {
    const boxWrap = m.querySelector('#history-1v1-boxes');
    if (!boxWrap) return;
    const items = allChallenges
      .filter(c => c.status === 'completed' && (c.challenger_tag === profile.tag || c.opponent_tag === profile.tag))
      .map(c => {
        const isChallenger = String(c.challenger_tag).toUpperCase() === profile.tag;
        const rival = isChallenger ? c.opponent_tag : c.challenger_tag;
        const myScores = Array.isArray(isChallenger ? c.challenger_scores : c.opponent_scores)
          ? (isChallenger ? c.challenger_scores : c.opponent_scores)
          : [];
        const theirScores = Array.isArray(isChallenger ? c.opponent_scores : c.challenger_scores)
          ? (isChallenger ? c.opponent_scores : c.challenger_scores)
          : [];
       const isSab = isSabotageMatch(c);
        const isMoon1v1 = Boolean(c.is_moon_battle);
        const myTop3 = isSab ? sumAllHands1v1(myScores) : top3Total1v1(myScores, isMoon1v1);
        const theirTop3 = isSab ? sumAllHands1v1(theirScores) : top3Total1v1(theirScores, isMoon1v1);
        return { c, rival, isSab, isMoon1v1, myTop3, theirTop3, ts: new Date(c.created_at).getTime() || 0 };
      });

    if (sort1v1Mode === 'newest') items.sort((a, b) => b.ts - a.ts);
    else if (sort1v1Mode === 'oldest') items.sort((a, b) => a.ts - b.ts);
    else if (sort1v1Mode === 'highest') items.sort((a, b) => b.myTop3 - a.myTop3);
    else if (sort1v1Mode === 'lowest') items.sort((a, b) => a.myTop3 - b.myTop3);

    boxWrap.innerHTML = items.map(({ c, rival, isSab, isMoon1v1, myTop3, theirTop3 }) => {
      const margin = Number(c.coins_won || 0);
      const won = c.winner_tag === profile.tag;
      const tie = c.winner_tag === 'TIE';
      const outcome = tie ? 'TIE (2🪙 returned)' : (won ? `WON by ${margin} (+${margin}🪙)` : `LOST by ${margin} (−${margin}🪙)`);
      const color = tie ? '#f3d27a' : (won ? '#7ee787' : '#ff8b8b');
      return `<div class="row" style="padding:8px; border:1px solid rgba(255,255,255,.2); border-radius:8px; background:rgba(0,0,0,.28); margin:5px 0; gap:8px;">
        <div style="font-size:12px; flex:1;">
          <b>vs ${escapeHTML(rival)}</b> · ${isSab ? '🔥 Sabotage' : (isMoon1v1 ? '🌙 Moon' : '⚔️ Regular')} · <span style="opacity:.75;">${escapeHTML(c.date_key)}</span><br>
          <span style="color:${color}; font-weight:700;">${outcome}</span>
        </div>
        <div style="text-align:right; font-size:12px; padding:4px 8px; border-radius:6px; background:rgba(243,210,122,.1);">
          <div style="font-size:10px; opacity:.8;">${isSab ? '4-HAND TOTAL' : 'TOP-3 SCORE'}</div>
          <b>You ${myTop3}</b> vs <b>${theirTop3}</b>
        </div>
      </div>`;
}).join('') || '<p class="empty-note">No completed 1v1 matches yet.</p>';
  };

  m.querySelectorAll('#sort-1v1-tabs .tab-pill').forEach(btn => btn.onclick = () => {
    sort1v1Mode = btn.getAttribute('data-s1v1');
    m.querySelectorAll('#sort-1v1-tabs .tab-pill').forEach(b => b.classList.toggle('active', b === btn));
    render1v1HistoryBoxes();
  });
  render1v1HistoryBoxes();

  m.querySelectorAll('[data-view-game]').forEach(button => button.onclick = () => viewHand(allGames.find(g => String(g.id) === button.dataset.viewGame)));
  m.querySelectorAll('[data-champ]').forEach(button => button.onclick = () => {
    const champion = champions.find(c => String(c.id) === button.dataset.champ);
    if (champion?.board_snapshot) viewHand({ playerTag: champion.player_tag, score: champion.winning_score, boardSnapshot: champion.board_snapshot });
  });

  const search = m.querySelector('#tag-search');
  const searchBtn = m.querySelector('#tag-search-btn');
  const matches = m.querySelector('#compare-matches');
  const comparison = m.querySelector('#comparison-card');
  let selectedOpponent = null;
  let opponentGames = [];
  let moonCompare = false;

 let compareLimit = 'all';

  const loadComparison = async (targetTag, shouldRender = true) => {
    const { data, error } = await supabase.from('games').select('*').eq('player_tag', targetTag).eq('is_moon_shot', moonCompare).order('created_at', { ascending: false });
    logSupabaseError(`load ${moonCompare ? 'Moon' : 'standard'} games for ${targetTag}`, error);
    selectedOpponent = targetTag;
    opponentGames = (data ?? []).map(mapGame);
    if (shouldRender) renderComparison();
  };

  const sliceByLimit = list => compareLimit === 'all' ? list : list.slice(0, Number(compareLimit));

  const summarizeSimple = scores => {
    const clean = scores.map(Number).filter(Number.isFinite);
    if (!clean.length) return { n: 0, mean: null, high: null, low: null };
    const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
    return {
      n: clean.length,
      mean,
      high: Math.max(...clean),
      low: Math.min(...clean),
    };
  };

  const get1v1Summary = (tag, lim) => {
    let list = allChallenges.filter(c => c.status === 'completed' && (c.challenger_tag === tag || c.opponent_tag === tag));
    if (lim === '10') list = list.slice(0, 10);
    const w = list.filter(c => c.winner_tag === tag);
    const l = list.filter(c => c.winner_tag && c.winner_tag !== 'TIE' && c.winner_tag !== tag);
    const net = w.reduce((s, c) => s + Number(c.coins_won || 0), 0) - l.reduce((s, c) => s + Number(c.coins_won || 0), 0);
    return `${w.length}W–${l.length}L (${net >= 0 ? '+' : ''}${net}🪙)`;
  };

  const getDirectRivalry1v1 = (myTag, oppTag, lim) => {
    let matchesBetween = allChallenges.filter(c =>
      c.status === 'completed' &&
      ((c.challenger_tag === myTag && c.opponent_tag === oppTag) ||
       (c.challenger_tag === oppTag && c.opponent_tag === myTag))
    );
    if (lim === '10') matchesBetween = matchesBetween.slice(0, 10);

    let wins = 0;
    let losses = 0;
    let ties = 0;
    let netCoins = 0;
    let myRawPts = 0;
    let oppRawPts = 0;

    const sumRawHandScores = arr => (Array.isArray(arr) ? arr : []).reduce((sum, item) => {
      const val = typeof item === 'object' && item !== null ? Number(item.score) : Number(item);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);

    for (const c of matchesBetween) {
      const iAmChallenger = c.challenger_tag === myTag;
      myRawPts += sumRawHandScores(iAmChallenger ? c.challenger_scores : c.opponent_scores);
      oppRawPts += sumRawHandScores(iAmChallenger ? c.opponent_scores : c.challenger_scores);

      const margin = Number(c.coins_won || 0);
      if (c.winner_tag === 'TIE') {
        ties++;
      } else if (c.winner_tag === myTag) {
        wins++;
        netCoins += margin;
      } else if (c.winner_tag === oppTag) {
        losses++;
        netCoins -= margin;
      }
    }

    return {
      played: matchesBetween.length,
      wins,
      losses,
      ties,
      netCoins,
      myRawPts,
      oppRawPts,
    };
  };

  const renderComparison = () => {
    if (!selectedOpponent) { comparison.innerHTML = ''; return; }
    const myFiltered = sliceByLimit(allGames.filter(g => g.playerTag === profile.tag && g.isMoonShot === moonCompare));
    const theirFiltered = sliceByLimit(opponentGames);
    const mine = summarizeSimple(myFiltered.map(g => g.score));
    const theirs = summarizeSimple(theirFiltered.map(g => g.score));

    const hasBoth = mine.n > 0 && theirs.n > 0;
    const compareHigh = (you, opp) => !hasBoth ? [false, false] : you > opp ? [true, false] : you < opp ? [false, true] : [false, false];
    const compareLow = (you, opp) => !hasBoth ? [false, false] : you < opp ? [true, false] : you > opp ? [false, true] : [false, false];

    const meanLeads = moonCompare ? compareLow(mine.mean, theirs.mean) : compareHigh(mine.mean, theirs.mean);
    const highLeads = moonCompare ? compareLow(mine.high, theirs.high) : compareHigh(mine.high, theirs.high);
    const lowLeads = moonCompare ? compareLow(mine.low, theirs.low) : compareHigh(mine.low, theirs.low);

    const fmtHigh = val => val === null ? '—' : (!moonCompare && val >= 50 ? `${val} <span class="leader-tag">50+</span>` : val);
    const cell = (value, leads) => `<td>${leads ? '<span class="leader-tag">LEADS</span><br>' : ''}${leads ? '<b>' : ''}${value}${leads ? '</b>' : ''}</td>`;
    const row = (label, yVal, oVal, yLeads, oLeads) => `<tr><th>${label}</th>${cell(yVal, yLeads)}${cell(oVal, oLeads)}</tr>`;

    const rows = [
      row('Games Counted', mine.n, theirs.n, false, false),
      row('Average Score', mine.mean !== null ? mine.mean.toFixed(1) : '—', theirs.mean !== null ? theirs.mean.toFixed(1) : '—', meanLeads[0], meanLeads[1]),
      row('Highest Score', fmtHigh(mine.high), fmtHigh(theirs.high), highLeads[0], highLeads[1]),
      row('Lowest Score', mine.low ?? '—', theirs.low ?? '—', lowLeads[0], lowLeads[1]),
    ].join('');

    const scope1v1 = compareLimit === '10' ? 'Last 10' : 'All-Time';
    const rivalry = getDirectRivalry1v1(profile.tag, selectedOpponent, compareLimit);
    const coinColor = rivalry.netCoins > 0 ? '#7ee787' : rivalry.netCoins < 0 ? '#ff8b8b' : '#f3d27a';
    const rivalryHTML = rivalry.played === 0
      ? `<div style="font-size:12px; padding:8px; margin-top:6px; border-radius:8px; border:1px solid rgba(243,210,122,.3); background:rgba(0,0,0,.28); text-align:center; opacity:.85;">
          No completed 1v1 matches directly against <b>${escapeHTML(selectedOpponent)}</b> yet.
        </div>`
      : `<div style="margin-top:8px; padding:8px 10px; border-radius:8px; border:1px solid rgba(243,210,122,.45); background:rgba(0,0,0,.35); font-size:12px;">
          <div class="eyebrow" style="margin-bottom:4px;">DIRECT 1V1 RIVALRY · YOU VS ${escapeHTML(selectedOpponent)} (${scope1v1})</div>
          <div style="display:flex; justify-content:space-between; margin:3px 0;">
            <span>Record (${rivalry.played} ${rivalry.played === 1 ? 'match' : 'matches'}):</span>
            <b>${rivalry.wins}W – ${rivalry.losses}L${rivalry.ties ? ` – ${rivalry.ties}T` : ''}</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin:3px 0;">
            <span>Total Raw Points Scored:</span>
            <b>You ${rivalry.myRawPts} vs ${rivalry.oppRawPts}</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin:3px 0;">
            <span>Net Coins vs ${escapeHTML(selectedOpponent)}:</span>
            <b style="color:${coinColor};">${rivalry.netCoins >= 0 ? '+' : ''}${rivalry.netCoins}🪙</b>
          </div>
        </div>`;

    comparison.innerHTML = `<div class="head-to-head">
      <div class="head-to-head-title">
        <h3>${moonCompare ? 'Shoot the Moon' : 'Standard Play'} · Head-to-Head</h3>
        <button class="btn small" id="clear-comparison">Clear</button>
      </div>
      <div class="pill-tabs sub" id="compare-limit-tabs" style="margin:6px 0 8px;">
        <button class="tab-pill ${compareLimit === 'all' ? 'active' : ''}" data-clim="all">All-Time</button>
        <button class="tab-pill ${compareLimit === '30' ? 'active' : ''}" data-clim="30">Last 30</button>
        <button class="tab-pill ${compareLimit === '10' ? 'active' : ''}" data-clim="10">Last 10</button>
      </div>
      <table class="comparison-table">
        <thead><tr><th>Stat</th><th>You<br>${escapeHTML(profile.tag)}</th><th>Opponent<br>${escapeHTML(selectedOpponent)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${rivalryHTML}
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:6px 8px; margin-top:6px; border-radius:8px; background:rgba(0,0,0,.3);">
        <span>Overall 1v1 (${scope1v1}): <b>${get1v1Summary(profile.tag, compareLimit)}</b></span>
        <span>Them: <b>${get1v1Summary(selectedOpponent, compareLimit)}</b></span>
      </div>
    </div>`;

    comparison.querySelectorAll('#compare-limit-tabs .tab-pill').forEach(btn => btn.onclick = () => {
      compareLimit = btn.dataset.clim;
      renderComparison();
    });

    comparison.querySelector('#clear-comparison').onclick = () => { selectedOpponent = null; opponentGames = []; comparison.innerHTML = ''; matches.innerHTML = ''; search.value = ''; };
  };

  const lookupTags = async () => {
    const term = search.value.trim().toUpperCase();
    if (!term) { matches.innerHTML = '<p class="error-text">Enter a Player Tag or three-letter initials.</p>'; return; }
    let query;
    if (/^[A-Z]{3}#[0-9]+$/.test(term)) query = supabase.from('profiles').select('tag, initials, tag_number').ilike('tag', term).limit(10);
    else if (/^[A-Z]{3}$/.test(term)) query = supabase.from('profiles').select('tag, initials, tag_number').ilike('initials', term).order('tag_number', { ascending: true }).limit(20);
    else { matches.innerHTML = '<p class="error-text">Use a tag such as ACE#1 or three initials such as ACE.</p>'; return; }
    const { data, error } = await query;
    logSupabaseError('search profiles for comparison', error);
    const choices = data ?? [];
    if (!choices.length) { matches.innerHTML = '<p>No matching Player Tags found.</p>'; return; }
    matches.innerHTML = `<div class="tag-options">${choices.map(p => `<button class="btn small tag-option" data-tag="${escapeHTML(p.tag)}">${escapeHTML(p.tag)}</button>`).join('')}</div>`;
    matches.querySelectorAll('[data-tag]').forEach(button => button.onclick = () => {
      const tag = button.dataset.tag;
      if (tag === profile.tag) { matches.innerHTML = '<p>That is your current Player Tag.</p>'; return; }
      search.value = tag;
      matches.innerHTML = '<p>Loading comparison…</p>';
      loadComparison(tag).then(() => { matches.innerHTML = ''; });
    });
  };
  searchBtn.onclick = lookupTags;
  search.addEventListener('keydown', e => { if (e.key === 'Enter') lookupTags(); });
  m.querySelector('#compare-moon').onchange = async e => {
    moonCompare = e.target.checked;
    if (selectedOpponent) await loadComparison(selectedOpponent);
  };
}

function viewHand(g) {
  if (!g?.boardSnapshot) return;
  const b = g.boardSnapshot;
  let cells = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) cells += `<div class="cell">${cardHTML(b.grid[r * 4 + c])}</div>`;
    cells += `<div class="cell">${cardHTML(b.crib[r])}</div>`;
  }
  modal(`<h3>${escapeHTML(g.playerTag)} · ${Number(g.score)} pts</h3><div class="tray cut" style="margin:auto"><div class="lbl">CUT CARD</div><div class="slot">${cardHTML(b.cut)}</div></div>
    <div class="grid" style="margin-top:8px">${cells}</div><div class="scores">${b.scores.map((s, i) => `<div class="sc">${['Hand 1', 'Hand 2', 'Hand 3', 'Hand 4', 'Crib'][i]}<b>${Number(s)}</b></div>`).join('')}</div>`);
}

function ensureMusicPlaying() {
  if (!settings.music || !music.paused) return;
  music.play().then(() => {
    window.removeEventListener('pointerdown', ensureMusicPlaying);
    window.removeEventListener('keydown', ensureMusicPlaying);
  }).catch(() => {});
}

window.addEventListener('pointerdown', ensureMusicPlaying);
window.addEventListener('keydown', ensureMusicPlaying);

async function boot() {
  if (!deviceId) {
    deviceId = makeDeviceId();
    localStorage.setItem('cotd_device_id', deviceId);
  }
  await findProfileForDevice();
  await refreshCloudData();
  if (!profile) {
    game = null;
    save('cotd_game', null);
  } else if (game?.playerTag && game.playerTag !== profile.tag) {
    game = null;
    save('cotd_game', null);
  }
  render();
  if (game?.cut && !game.done) revealCut();
  if (game?.done && !game.recordSaved) { game.finishing = false; finishGame(); }
  setInterval(refreshLivePot, 30000);
}

boot();