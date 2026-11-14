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
];

const hotPlaylist = [
  'assets/audio/hot-streak1.mp3',
  'assets/audio/hot-streak2.mp3',
  'assets/audio/hot-streak3.mp3',
];

const gamblerTrack = 'assets/audio/The Gambler.mp3';
const loserTrack = 'assets/audio/Im A Loser (Remastered 2009).mp3';
const championTrack = 'assets/audio/We Are The Champions (Remastered 2011).mp3';

const EGG_COOLDOWN_MS = 30 * 60 * 1000;      // 30-min cooldown for single-song Easter eggs
const HOT_COOLDOWN_MS = 15 * 60 * 1000;      // 15-min cooldown for the 7-hand hot-streak playlist

let trackIdx = Math.floor(Math.random() * playlist.length);
let playingSpecialTrack = false;
let hotStreakQueue = [];

const music = new Audio(playlist[trackIdx]);
music.volume = 0.35;
music.preload = 'auto';

function canTriggerEgg(key, cooldownMs = EGG_COOLDOWN_MS) {
  const last = Number(localStorage.getItem('egg_cd_' + key) || 0);
  return Date.now() - last >= cooldownMs;
}

function playSpecialTrack(src, cooldownKey, cooldownMs = EGG_COOLDOWN_MS) {
  if (!settings.music) return;
  if (cooldownKey) localStorage.setItem('egg_cd_' + cooldownKey, String(Date.now()));
  hotStreakQueue = [];
  playingSpecialTrack = true;
  music.src = src;
  music.play().catch(() => {});
}

function startHotPlaylist() {
  if (!settings.music || hotPlaylist.length === 0) return;
  localStorage.setItem('egg_cd_hotstreak', String(Date.now()));
  playingSpecialTrack = true;
  hotStreakQueue = hotPlaylist.slice(1); // queue tracks 2, 3, and 4
  music.src = hotPlaylist[0];            // start track 1 immediately
  music.play().catch(() => {});
}

music.addEventListener('ended', () => {
  // 1. If we're mid-way through the 4-track hot streak playlist, play the next queued track
  if (hotStreakQueue.length > 0) {
    const nextHot = hotStreakQueue.shift();
    playingSpecialTrack = true;
    music.src = nextHot;
    if (settings.music) music.play().catch(() => {});
    return;
  }

  // 2. Otherwise roll 1% chance for The Gambler, or return to the normal lounge playlist
  if (!playingSpecialTrack && Math.random() < 0.01 && canTriggerEgg('gambler')) {
    playSpecialTrack(gamblerTrack, 'gambler');
  } else {
    playingSpecialTrack = false;
    trackIdx = (trackIdx + 1) % playlist.length;
    music.src = playlist[trackIdx];
    if (settings.music) music.play().catch(() => {});
  }
});

function checkEasterEggTriggers(finalScore, isMoon, recentScores) {
  // 1. Big Single-Game Win ("We Are the Champions"): Shoot the Moon (<= 10) OR 56+ pts in Standard
  const bigWin = isMoon ? finalScore <= 10 : finalScore >= 56;
  if (bigWin && canTriggerEgg('champion')) {
    playSpecialTrack(championTrack, 'champion');
    return;
  }

  // 2. 7-Hand Hot Streak Playlist: Average > 34 over past 7 hands (15-min cooldown)
  if (!isMoon && recentScores.length >= 7 && hotStreakQueue.length === 0 && canTriggerEgg('hotstreak', HOT_COOLDOWN_MS)) {
    const lastSeven = recentScores.slice(-7);
    const avg7 = lastSeven.reduce((sum, v) => sum + v, 0) / 7;
    if (avg7 > 34) {
      startHotPlaylist();
      return;
    }
  }

  // 3. 8-Game Cold Slump ("The Gambler" or "I'm a Loser"): Average < 30 over last 8 games
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
  const [gamesRes, profilesRes, potRow, championsRes] = await Promise.all([
    supabase.from('games').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('tag'),
    fetchPersistentPotRow(),
    supabase.from('daily_champions').select('*').order('date_key', { ascending: false }),
  ]);
  logSupabaseError('load games', gamesRes.error);
  logSupabaseError('load profiles', profilesRes.error);
  logSupabaseError('load daily champions', championsRes.error);
  if (gamesRes.data) allGames = gamesRes.data.map(mapGame);
  if (profilesRes.data) profiles = profilesRes.data.map(mapProfile);
  if (potRow) livePot = Number(potRow.pot_amount ?? 10);
  if (championsRes.data) champions = championsRes.data;
  renderHud();
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

function makeDeck(seedStr) {
  let h = 7;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
  const rand = seedStr ? rng(h) : Math.random;
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s });
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
  root.querySelector('#home').onclick = () => { if (!game || game.done) { game = null; save('cotd_game', null); render(); } };
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
  };
}

function renderHome() {
  const alreadyPlayed = hasPlayedDailyToday();
  const main = root.querySelector('#main');
  main.innerHTML = `<div class="felt">
    <button class="btn" id="daily" style="width:100%" ${alreadyPlayed ? 'disabled' : ''}>Crib of the Day ${alreadyPlayed ? '(done today)' : '· 1 Coin'}</button>
    <div class="row"><button class="btn" id="free" style="flex:1">Free Play</button><button class="btn" id="lb" style="flex:1">Boards & Stats</button></div>
    <label class="row">Auto-Fill Row 1 <input type="checkbox" id="af" ${settings.autofill ? 'checked' : ''}></label>
    <label class="row">Shoot the Moon (≤10 pts) <input type="checkbox" id="moon"></label></div>`;
  main.querySelector('#af').onchange = e => { settings.autofill = e.target.checked; save('cotd_settings', settings); };
  const moonBox = main.querySelector('#moon');
  main.querySelector('#free').onclick = () => startGame('free', moonBox.checked, null);
  main.querySelector('#lb').onclick = showBoards;
  main.querySelector('#daily').onclick = () => {
    if (hasPlayedDailyToday()) { renderHome(); return; }
    showPredictionModal(moonBox.checked);
  };
}

function showPredictionModal(moon) {
  if (hasPlayedDailyToday()) return;
  document.querySelectorAll('.prediction-overlay').forEach(node => node.remove());

  const layer = el(`<div class="overlay prediction-overlay">
    <div class="modal prediction-card">
      <button class="modal-x" id="close-pred" type="button" aria-label="Close">✕</button>
      <form id="prediction-form">
        <span class="eyebrow">CRIB OF THE DAY</span>
        <h2>Call your score</h2>
        <p>Lock in a whole-number prediction before the deal. Exact match earns +5 bonus Coins.</p>
        <label for="prediction-input">Your predicted score (0–120)</label>
        <input id="prediction-input" type="number" min="0" max="120" step="1" value="35" required>
        <p class="error-text" id="prediction-error" aria-live="polite"></p>
        <button class="btn gold-btn" type="submit">Lock Prediction &amp; Deal</button>
      </form>
    </div>
  </div>`);

  const closePred = () => { if (!dailyStarting) layer.remove(); };
  layer.querySelector('#close-pred').onclick = closePred;
  layer.addEventListener('click', e => { if (e.target === layer) closePred(); });

  const form = layer.querySelector('#prediction-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (hasPlayedDailyToday() || dailyStarting) return;

    const input = layer.querySelector('#prediction-input');
    const raw = input.value.trim();
    const predictedScore = Number(raw);
    const error = layer.querySelector('#prediction-error');
    if (!/^\d+$/.test(raw) || !Number.isInteger(predictedScore) || predictedScore < 0 || predictedScore > 120) {
      error.textContent = 'Enter a whole-number score from 0 to 120.';
      return;
    }

    dailyStarting = true;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Preparing your deal…';

    const cloudOk = await getOrCreateAndIncrementPot();
    if (!cloudOk) {
      error.textContent = 'Could not update the Pot. Please try again.';
      dailyStarting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Lock Prediction & Deal';
      return;
    }

    await changeCoins(-1);
    localStorage.setItem(`cotd_daily_${profile.tag}`, todayKey());
    localStorage.setItem('cotd_daily', todayKey());
    layer.remove();
    dailyStarting = false;
    startGame('daily', moon, predictedScore);
  });

  document.body.appendChild(layer);
  layer.querySelector('#prediction-input').focus();
}

function startGame(mode, moon, predictedScore) {
  const deck = makeDeck(mode === 'daily' ? `cotd-${todayKey()}` : '');
  game = {
    playerTag: profile.tag,
    mode,
    moon: Boolean(moon),
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

function renderBoard() {
  const main = root.querySelector('#main');
  if (!main) return;
  const n = placed();
  const moonLocked = game.moon || n >= 7;
  main.innerHTML = `<div class="felt"><div class="trays">
      <div class="tray"><div class="lbl">NEXT CARD</div><div class="slot" id="next"></div></div>
      <div class="tray cut"><div class="lbl">CUT CARD</div><div class="slot" id="cut"></div></div></div>
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
  };
  const inserted = await supabase.from('games').insert(row).select('*').single();
  logSupabaseError('insert completed game', inserted.error);
  game.recordSaved = !inserted.error;
  game.finishing = false;
  save('cotd_game', game);
  await refreshCloudData();
  renderBoard();
  renderHud();
}

function showResult() {
  const box = root.querySelector('#result');
  if (!box) return;
  const goal = game.moon ? (game.total <= 10 ? '🌙 Moon shot!' : 'Moon missed') : '';
  const predictionResult = game.mode === 'daily' ? game.predictionMatched
    ? '<div class="prediction-win">Exact Prediction Match! +5 Bonus Coins</div>'
    : `<p class="prediction-summary">Predicted: ${Number(game.predictedScore)} | Actual: ${Number(game.finalTotalScore ?? game.total)}</p>` : '';
  box.innerHTML = `<div class="felt result-card" style="text-align:center"><h3>Total: ${game.finalTotalScore ?? game.total} points ${goal}</h3>
    ${predictionResult}
    ${game.mode === 'daily' ? `<p>Coins: ${game.delta >= 0 ? '+' : ''}${game.delta}${game.total >= 51 && !game.moon ? ' · Pot share settles at midnight' : ''}</p>` : ''}
    <div class="row"><button class="btn" id="replay" style="flex:1">Replay</button><button class="btn" id="back" style="flex:1">Back to Home</button></div></div>`;
  box.querySelector('#replay').onclick = () => startGame(game.mode === 'daily' ? 'free' : game.mode, false, null);
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
    <h3>Shooting the Moon</h3><p>Toggle before the 7th slot is filled. Goal: ≤10 points. Daily: ≤10 = +10 Coins, otherwise −5. A 0 enters the Hall of Fame.</p>`);
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

  const loadComparison = async (targetTag, shouldRender = true) => {
    const { data, error } = await supabase.from('games').select('*').eq('player_tag', targetTag).eq('is_moon_shot', moonCompare).order('created_at', { ascending: false });
    logSupabaseError(`load ${moonCompare ? 'Moon' : 'standard'} games for ${targetTag}`, error);
    selectedOpponent = targetTag;
    opponentGames = (data ?? []).map(mapGame);
    if (shouldRender) renderComparison();
  };

  const renderComparison = () => {
    if (!selectedOpponent) { comparison.innerHTML = ''; return; }
    const myGames = allGames.filter(g => g.playerTag === profile.tag && g.isMoonShot === moonCompare);
    const mine = stats(myGames.map(g => g.score), moonCompare);
    const theirs = stats(opponentGames.map(g => g.score), moonCompare);
    const cell = (value, leads) => `<td>${leads ? '<span class="leader-tag">LEADS</span><br>' : ''}${leads ? '<b>' : ''}${value}${leads ? '</b>' : ''}</td>`;
    const row = (label, youValue, opponentValue, youLeads, opponentLeads) => `<tr><th>${label}</th>${cell(youValue, youLeads)}${cell(opponentValue, opponentLeads)}</tr>`;
    const hasBoth = mine.n > 0 && theirs.n > 0;
    const compareHigh = (you, opponent) => !hasBoth ? [false, false] : you > opponent ? [true, false] : you < opponent ? [false, true] : [false, false];
    const compareLow = (you, opponent) => !hasBoth ? [false, false] : you < opponent ? [true, false] : you > opponent ? [false, true] : [false, false];
    const gamesLeads = compareHigh(mine.n, theirs.n);
    const meanLeads = moonCompare ? compareLow(mine.mean, theirs.mean) : compareHigh(mine.mean, theirs.mean);
    const sdLeads = compareLow(mine.sd, theirs.sd);
    const bestLeads = mine.best === null || theirs.best === null ? [false, false] : moonCompare ? compareLow(mine.best, theirs.best) : compareHigh(mine.best, theirs.best);
    const intervalLeads = compareLow(mine.width, theirs.width);
    const myBest = mine.best === null ? '—' : mine.best;
    const otherBest = theirs.best === null ? '—' : theirs.best;
    const myInterval = mine.n ? `${mine.low.toFixed(2)}–${mine.high.toFixed(2)}` : '—';
    const otherInterval = theirs.n ? `${theirs.low.toFixed(2)}–${theirs.high.toFixed(2)}` : '—';
    const rows = [
      row('Games Played', mine.n, theirs.n, gamesLeads[0], gamesLeads[1]),
      row('Average Score (x̄)', mine.n ? mine.mean.toFixed(2) : '—', theirs.n ? theirs.mean.toFixed(2) : '—', meanLeads[0], meanLeads[1]),
      row('Sample Std Dev (s)', mine.n ? mine.sd.toFixed(2) : '—', theirs.n ? theirs.sd.toFixed(2) : '—', sdLeads[0], sdLeads[1]),
      row('Personal Best', myBest, otherBest, bestLeads[0], bestLeads[1]),
      row('90% Confidence Level', myInterval, otherInterval, intervalLeads[0], intervalLeads[1]),
    ].join('');
    comparison.innerHTML = `<div class="head-to-head"><div class="head-to-head-title"><h3>${moonCompare ? 'Shoot the Moon' : 'Standard Play'} · Head-to-Head</h3><button class="btn small" id="clear-comparison">Clear Comparison</button></div><table class="comparison-table"><thead><tr><th>Metric</th><th>You<br>${escapeHTML(profile.tag)}</th><th>Opponent<br>${escapeHTML(selectedOpponent)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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