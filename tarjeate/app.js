/* ======= FlashCards SR — app.js ======= */

// ---------- UTILIDADES ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

async function sha256(text, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function today() { return new Date().toISOString().slice(0, 10); }

// ---------- ESTADO GLOBAL ----------
let APP = { decks: [], games: [], config: { githubRepo: '', githubBranch: 'main', dataPath: 'data/app-data.json', syncMode: 'local' } };
let STUDY = null; // estado de partida activa

// ---------- PERSISTENCIA LOCAL ----------
const STORAGE_KEY = 'flashcards_sr_data';

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks: APP.decks, games: APP.games }));
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d.decks) APP.decks = d.decks;
      if (d.games) APP.games = d.games;
      return true;
    } catch (e) { console.error('Error loading local data', e); }
  }
  return false;
}

function loadConfig() {
  const raw = localStorage.getItem('flashcards_sr_config');
  if (raw) { try { Object.assign(APP.config, JSON.parse(raw)); } catch (e) {} }
}

function saveConfig() {
  localStorage.setItem('flashcards_sr_config', JSON.stringify(APP.config));
}

// ---------- CARGA INICIAL (sample) ----------
async function loadSample() {
  try {
    const r = await fetch('data/decks.sample.json');
    const d = await r.json();
    APP.decks = d.decks || [];
    APP.games = d.games || [];
  } catch (e) { console.error('No se pudo cargar sample', e); }
}

// ---------- GUARDAR (despacha según modo) ----------
async function saveData() {
  saveLocal();
  if (APP.config.syncMode === 'github') {
    try { await githubSave(); } catch (e) { console.error('GitHub sync error', e); alert('Error al sincronizar con GitHub: ' + e.message); }
  }
}

// ---------- MODAL ----------
function openModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}
function closeModal() { $('#modal-overlay').classList.add('hidden'); }
$('#modal-close').addEventListener('click', closeModal);
$('#modal-overlay').addEventListener('click', e => { if (e.target === $('#modal-overlay')) closeModal(); });

// ---------- ROUTER ----------
const VIEWS = ['decks', 'deck-edit', 'study', 'ranking', 'summary', 'config'];

function navigate(hash) {
  const view = hash.replace('#', '') || 'decks';
  VIEWS.forEach(v => {
    const el = $(`#view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  });
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + view));
  const renderer = viewRenderers[view];
  if (renderer) renderer();
}

window.addEventListener('hashchange', () => navigate(location.hash));

// ---------- RENDERERS ----------
const viewRenderers = {
  decks: () => typeof renderDecks === 'function' && renderDecks(),
  'deck-edit': () => typeof renderDeckEdit === 'function' && renderDeckEdit(),
  study: () => typeof renderStudy === 'function' && renderStudy(),
  ranking: () => typeof renderRanking === 'function' && renderRanking(),
  summary: () => typeof renderSummary === 'function' && renderSummary(),
  config: () => typeof renderConfig === 'function' && renderConfig(),
};

// ---------- INICIO ----------
async function init() {
  loadConfig();
  const loaded = loadLocal();
  if (!loaded) await loadSample();
  if (APP.config.syncMode === 'github') {
    try { await githubLoad(); } catch (e) { console.warn('GitHub load failed, using local', e); }
  }
  navigate(location.hash || '#decks');
}

init();

// ========== GITHUB SYNC ==========

function getToken() {
  return sessionStorage.getItem('gh_token') || '';
}

function ghHeaders() {
  return { 'Authorization': 'token ' + getToken(), 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
}

function ghApiUrl() {
  const r = APP.config.githubRepo;
  const b = APP.config.githubBranch || 'main';
  const p = APP.config.dataPath || 'data/app-data.json';
  return `https://api.github.com/repos/${r}/contents/${p}?ref=${b}`;
}

async function githubLoad() {
  if (!APP.config.githubRepo || !getToken()) return;
  const res = await fetch(ghApiUrl(), { headers: ghHeaders() });
  if (res.status === 404) return;
  if (!res.ok) throw new Error('GitHub GET ' + res.status);
  const json = await res.json();
  const content = atob(json.content.replace(/\n/g, ''));
  const data = JSON.parse(content);
  if (data.decks) APP.decks = data.decks;
  if (data.games) APP.games = data.games;
  saveLocal();
}

async function githubSave() {
  if (!APP.config.githubRepo || !getToken()) return;
  let sha = null;
  const getRes = await fetch(ghApiUrl(), { headers: ghHeaders() });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  } else if (getRes.status !== 404) {
    throw new Error('GitHub GET ' + getRes.status);
  }
  const payload = JSON.stringify({ decks: APP.decks, games: APP.games }, null, 2);
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  const body = {
    message: 'FlashCards SR sync ' + new Date().toISOString(),
    content: encoded,
    branch: APP.config.githubBranch || 'main'
  };
  if (sha) body.sha = sha;
  const putUrl = ghApiUrl().split('?')[0];
  const putRes = await fetch(putUrl, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if (!putRes.ok) { const e = await putRes.json().catch(() => ({})); throw new Error(e.message || 'GitHub PUT ' + putRes.status); }
}

// ========== VISTA CONFIG ==========

function renderConfig() {
  const v = $('#view-config');
  const token = getToken();
  v.innerHTML = `
    <div class="panel">
      <h2>Configuración de sincronización</h2>
      <div class="form-group">
        <label>Modo</label>
        <select id="cfg-mode">
          <option value="local" ${APP.config.syncMode === 'local' ? 'selected' : ''}>Solo local</option>
          <option value="github" ${APP.config.syncMode === 'github' ? 'selected' : ''}>GitHub (sincronizado)</option>
        </select>
      </div>
      <div id="cfg-gh" class="${APP.config.syncMode !== 'github' ? 'hidden' : ''}">
        <div class="form-group">
          <label>Repositorio (usuario/repo)</label>
          <input id="cfg-repo" value="${APP.config.githubRepo}">
        </div>
        <div class="form-group">
          <label>Branch</label>
          <input id="cfg-branch" value="${APP.config.githubBranch}">
        </div>
        <div class="form-group">
          <label>Ruta del archivo JSON</label>
          <input id="cfg-path" value="${APP.config.dataPath}">
        </div>
        <div class="form-group">
          <label>Personal Access Token</label>
          <input id="cfg-token" type="password" value="${token}" placeholder="ghp_...">
          <p style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Se guarda en sessionStorage (se borra al cerrar pestaña). Necesita permiso <b>repo</b> o <b>contents:write</b>.</p>
        </div>
        <button class="btn btn-sec btn-sm" onclick="testGithub()">Probar conexión</button>
      </div>
      <br>
      <button class="btn btn-pri" onclick="saveConfigUI()">Guardar configuración</button>
      <span id="cfg-msg" style="margin-left:.8rem;font-size:.85rem"></span>
    </div>`;
  $('#cfg-mode').addEventListener('change', e => {
    $('#cfg-gh').classList.toggle('hidden', e.target.value !== 'github');
  });
}

function saveConfigUI() {
  APP.config.syncMode = $('#cfg-mode').value;
  APP.config.githubRepo = ($('#cfg-repo') || {}).value || '';
  APP.config.githubBranch = ($('#cfg-branch') || {}).value || 'main';
  APP.config.dataPath = ($('#cfg-path') || {}).value || 'data/app-data.json';
  const tok = ($('#cfg-token') || {}).value || '';
  if (tok) sessionStorage.setItem('gh_token', tok);
  else sessionStorage.removeItem('gh_token');
  saveConfig();
  $('#cfg-msg').textContent = '✓ Guardado';
  setTimeout(() => $('#cfg-msg').textContent = '', 2000);
}

async function testGithub() {
  saveConfigUI();
  try {
    const res = await fetch(ghApiUrl(), { headers: ghHeaders() });
    if (res.ok) alert('Conexión OK — archivo encontrado');
    else if (res.status === 404) alert('Conexión OK — archivo no existe aún (se creará al guardar)');
    else alert('Error: ' + res.status);
  } catch (e) { alert('Error: ' + e.message); }
}

// ========== VISTA MAZOS ==========

function renderDecks() {
  const v = $('#view-decks');
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><h2>Mazos</h2><div>';
  html += '<button class="btn btn-sec btn-sm" onclick="importCSVModal()" style="margin-right:.5rem">Importar CSV</button>';
  html += '<button class="btn btn-pri btn-sm" onclick="newDeckModal()">+ Nuevo mazo</button></div></div>';
  if (!APP.decks.length) { html += '<p style="color:var(--muted)">No hay mazos. Crea uno o importa desde CSV.</p>'; }
  else {
    html += '<div class="deck-grid">';
    APP.decks.forEach(d => {
      const n = d.cards.length;
      const locked = d.passwordHash ? '🔒' : '';
      html += `<div class="panel deck-card" onclick="selectDeck('${d.id}')">
        <h3>${locked} ${esc(d.name)}</h3>
        <p>${esc(d.description || '')}</p>
        <p>${n} tarjeta${n !== 1 ? 's' : ''}</p>
        <div style="margin-top:.5rem">
          <button class="btn btn-pri btn-sm" onclick="event.stopPropagation();startStudy('${d.id}')">Estudiar</button>
          <button class="btn btn-sec btn-sm" onclick="event.stopPropagation();editDeckAuth('${d.id}')">Editar</button>
          <button class="btn btn-fail btn-sm" onclick="event.stopPropagation();deleteDeckAuth('${d.id}')">Eliminar</button>
        </div></div>`;
    });
    html += '</div>';
  }
  v.innerHTML = html;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ---------- NUEVO MAZO ----------

function newDeckModal() {
  openModal(`<h2>Nuevo mazo</h2>
    <div class="form-group"><label>Nombre</label><input id="nd-name"></div>
    <div class="form-group"><label>Descripción</label><input id="nd-desc"></div>
    <div class="form-group"><label>Contraseña (opcional)</label><input id="nd-pass" type="password"></div>
    <button class="btn btn-pri" onclick="createDeck()">Crear</button>`);
}

async function createDeck() {
  const name = $('#nd-name').value.trim();
  if (!name) return alert('Nombre requerido');
  const pass = $('#nd-pass').value;
  let hash = '', salt = '';
  if (pass) { salt = randomSalt(); hash = await sha256(pass, salt); }
  APP.decks.push({ id: uid(), name, description: $('#nd-desc').value.trim(), passwordHash: hash, passwordSalt: salt, cards: [] });
  await saveData();
  closeModal();
  renderDecks();
}

// ---------- AUTH CONTRASEÑA ----------

function authDeck(deckId, callback) {
  const deck = APP.decks.find(d => d.id === deckId);
  if (!deck) return;
  if (!deck.passwordHash) return callback(deck);
  openModal(`<h2>Contraseña requerida</h2>
    <div class="form-group"><label>Contraseña del mazo "${esc(deck.name)}"</label><input id="auth-pass" type="password"></div>
    <button class="btn btn-pri" id="auth-btn">Verificar</button>`);
  $('#auth-btn').onclick = async () => {
    const h = await sha256($('#auth-pass').value, deck.passwordSalt);
    if (h === deck.passwordHash) { closeModal(); callback(deck); }
    else alert('Contraseña incorrecta');
  };
}

// ---------- EDITAR MAZO (metadatos) ----------

function editDeckAuth(id) { authDeck(id, deck => editDeckModal(deck)); }

function editDeckModal(deck) {
  openModal(`<h2>Editar mazo</h2>
    <div class="form-group"><label>Nombre</label><input id="ed-name" value="${esc(deck.name)}"></div>
    <div class="form-group"><label>Descripción</label><input id="ed-desc" value="${esc(deck.description || '')}"></div>
    <div class="form-group"><label>Nueva contraseña (vacío = sin cambios)</label><input id="ed-pass" type="password"></div>
    <button class="btn btn-pri" onclick="saveDeckEdit('${deck.id}')">Guardar</button>`);
}

async function saveDeckEdit(id) {
  const deck = APP.decks.find(d => d.id === id);
  deck.name = $('#ed-name').value.trim() || deck.name;
  deck.description = $('#ed-desc').value.trim();
  const pass = $('#ed-pass').value;
  if (pass) { deck.passwordSalt = randomSalt(); deck.passwordHash = await sha256(pass, deck.passwordSalt); }
  await saveData();
  closeModal();
  renderDecks();
}

// ---------- ELIMINAR MAZO ----------

function deleteDeckAuth(id) {
  authDeck(id, async deck => {
    if (!confirm(`¿Eliminar "${deck.name}" y todas sus tarjetas?`)) return;
    APP.decks = APP.decks.filter(d => d.id !== id);
    await saveData();
    renderDecks();
  });
}

// ---------- SELECCIONAR MAZO → editar tarjetas ----------

function selectDeck(id) {
  authDeck(id, deck => {
    location.hash = '#deck-edit';
    setTimeout(() => renderDeckEdit(deck.id), 50);
  });
}

// ---------- IMPORTAR CSV ----------

function importCSVModal() {
  openModal(`<h2>Importar mazo desde CSV</h2>
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:.8rem">CSV con columnas: question, answer (separado por coma o punto y coma). Primera fila = cabecera.</p>
    <div class="form-group"><label>Nombre del mazo</label><input id="csv-name"></div>
    <div class="form-group"><label>Contraseña (opcional)</label><input id="csv-pass" type="password"></div>
    <div class="form-group"><label>Archivo CSV</label><input id="csv-file" type="file" accept=".csv,.txt"></div>
    <button class="btn btn-pri" onclick="processCSV()">Importar</button>`);
}

async function processCSV() {
  const name = $('#csv-name').value.trim();
  const file = $('#csv-file').files[0];
  if (!name || !file) return alert('Nombre y archivo requeridos');
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return alert('CSV vacío o sin datos');
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const qi = header.indexOf('question');
  const ai = header.indexOf('answer');
  if (qi === -1 || ai === -1) return alert('Columnas "question" y "answer" no encontradas');
  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], sep);
    if (cols[qi] && cols[ai]) {
      cards.push({ id: uid(), question: cols[qi], answer: cols[ai], level: 1, mastered: false, stats: { hits: 0, misses: 0 } });
    }
  }
  if (!cards.length) return alert('No se encontraron tarjetas válidas');
  const pass = $('#csv-pass').value;
  let hash = '', salt = '';
  if (pass) { salt = randomSalt(); hash = await sha256(pass, salt); }
  APP.decks.push({ id: uid(), name, description: 'Importado desde CSV', passwordHash: hash, passwordSalt: salt, cards });
  await saveData();
  closeModal();
  renderDecks();
  alert(cards.length + ' tarjetas importadas');
}

function parseCSVLine(line, sep) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === sep && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

// ========== VISTA EDITOR DE TARJETAS ==========

let editingDeckId = null;

function renderDeckEdit(deckId) {
  editingDeckId = deckId || editingDeckId;
  const deck = APP.decks.find(d => d.id === editingDeckId);
  if (!deck) { location.hash = '#decks'; return; }
  const v = $('#view-deck-edit');
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
    <div><a href="#decks" style="font-size:.85rem;color:var(--pri)">← Volver a mazos</a>
    <h2 style="margin-top:.3rem">${esc(deck.name)}</h2></div>
    <button class="btn btn-pri btn-sm" onclick="addCardModal()">+ Tarjeta</button></div>`;
  if (!deck.cards.length) {
    html += '<p style="color:var(--muted)">No hay tarjetas. Añade una.</p>';
  } else {
    html += '<table><thead><tr><th>#</th><th>Pregunta</th><th>Respuesta</th><th>Stats</th><th>Acciones</th></tr></thead><tbody>';
    deck.cards.forEach((c, i) => {
      const total = c.stats.hits + c.stats.misses;
      const pct = total ? Math.round(c.stats.hits / total * 100) : '-';
      html += `<tr>
        <td>${i + 1}</td>
        <td>${esc(c.question)}</td>
        <td>${esc(c.answer)}</td>
        <td><span class="badge badge-ok">${c.stats.hits}✓</span> <span class="badge badge-fail">${c.stats.misses}✗</span> <span class="badge badge-lvl">${pct}%</span></td>
        <td>
          <button class="btn btn-sec btn-sm" onclick="editCardModal('${c.id}')">✎</button>
          <button class="btn btn-fail btn-sm" onclick="deleteCard('${c.id}')">✗</button>
        </td></tr>`;
    });
    html += '</tbody></table>';
  }
  v.innerHTML = html;
}

// ---------- AÑADIR TARJETA ----------

function addCardModal() {
  openModal(`<h2>Nueva tarjeta</h2>
    <div class="form-group"><label>Pregunta</label><textarea id="ac-q" rows="3"></textarea></div>
    <div class="form-group"><label>Respuesta</label><textarea id="ac-a" rows="3"></textarea></div>
    <button class="btn btn-pri" onclick="addCard()">Añadir</button>`);
}

async function addCard() {
  const q = $('#ac-q').value.trim();
  const a = $('#ac-a').value.trim();
  if (!q || !a) return alert('Pregunta y respuesta requeridas');
  const deck = APP.decks.find(d => d.id === editingDeckId);
  deck.cards.push({ id: uid(), question: q, answer: a, level: 1, mastered: false, stats: { hits: 0, misses: 0 } });
  await saveData();
  closeModal();
  renderDeckEdit();
}

// ---------- EDITAR TARJETA ----------

function editCardModal(cardId) {
  const deck = APP.decks.find(d => d.id === editingDeckId);
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;
  openModal(`<h2>Editar tarjeta</h2>
    <div class="form-group"><label>Pregunta</label><textarea id="ec-q" rows="3">${esc(card.question)}</textarea></div>
    <div class="form-group"><label>Respuesta</label><textarea id="ec-a" rows="3">${esc(card.answer)}</textarea></div>
    <button class="btn btn-pri" onclick="saveCardEdit('${cardId}')">Guardar</button>`);
}

async function saveCardEdit(cardId) {
  const deck = APP.decks.find(d => d.id === editingDeckId);
  const card = deck.cards.find(c => c.id === cardId);
  const q = $('#ec-q').value.trim();
  const a = $('#ec-a').value.trim();
  if (!q || !a) return alert('Pregunta y respuesta requeridas');
  card.question = q;
  card.answer = a;
  await saveData();
  closeModal();
  renderDeckEdit();
}

// ---------- ELIMINAR TARJETA ----------

async function deleteCard(cardId) {
  if (!confirm('¿Eliminar esta tarjeta?')) return;
  const deck = APP.decks.find(d => d.id === editingDeckId);
  deck.cards = deck.cards.filter(c => c.id !== cardId);
  await saveData();
  renderDeckEdit();
}

// registrar renderer
viewRenderers['deck-edit'] = () => renderDeckEdit();

// ========== MOTOR DE ESTUDIO ==========

function startStudy(deckId) {
  const deck = APP.decks.find(d => d.id === deckId);
  if (!deck || !deck.cards.length) return alert('El mazo no tiene tarjetas');
  const cards = deck.cards.map(c => ({
    id: c.id, question: c.question, answer: c.answer,
    level: 1, mastered: false, hits: 0, misses: 0
  }));
  STUDY = {
    deckId,
    deckName: deck.name,
    cards,
    score: 0,
    currentIndex: -1,
    queue: [],
    flipped: false,
    finished: false
  };
  buildQueue();
  nextCard();
  location.hash = '#study';
}

function buildQueue() {
  if (!STUDY) return;
  const pending = STUDY.cards.filter(c => !c.mastered);
  if (!pending.length) { STUDY.finished = true; return; }
  const levels = {};
  pending.forEach(c => { (levels[c.level] = levels[c.level] || []).push(c); });
  const sorted = Object.keys(levels).sort((a, b) => a - b);
  STUDY.queue = [];
  sorted.forEach(lv => { STUDY.queue.push(...shuffle(levels[lv])); });
  STUDY.currentIndex = 0;
}

function currentCard() {
  if (!STUDY || STUDY.finished) return null;
  return STUDY.queue[STUDY.currentIndex] || null;
}

function nextCard() {
  if (!STUDY) return;
  STUDY.flipped = false;
  if (STUDY.currentIndex >= STUDY.queue.length - 1) {
    buildQueue();
    if (STUDY.finished) { renderStudy(); return; }
  } else {
    STUDY.currentIndex++;
  }
  renderStudy();
}

function flipCard() {
  if (!STUDY || STUDY.flipped) return;
  STUDY.flipped = true;
  renderStudy();
}

function answerHit() {
  const card = currentCard();
  if (!card) return;
  card.hits++;
  STUDY.score += 1;
  updateGlobalStats(card.id, true);
  if (card.level >= 6) {
    card.mastered = true;
  } else {
    card.level++;
  }
  nextCard();
}

function answerMiss() {
  const card = currentCard();
  if (!card) return;
  card.misses++;
  STUDY.score = Math.round((STUDY.score - 1.5) * 100) / 100;
  updateGlobalStats(card.id, false);
  card.level = 1;
  nextCard();
}

function updateGlobalStats(cardId, hit) {
  const deck = APP.decks.find(d => d.id === STUDY.deckId);
  if (!deck) return;
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;
  if (hit) card.stats.hits++;
  else card.stats.misses++;
}

function studyProgress() {
  if (!STUDY) return { total: 0, mastered: 0, pct: 0 };
  const total = STUDY.cards.length;
  const mastered = STUDY.cards.filter(c => c.mastered).length;
  return { total, mastered, pct: Math.round(mastered / total * 100) };
}

// ---------- FINALIZAR PARTIDA ----------

function finishStudyModal() {
  openModal(`<h2>¡Partida terminada!</h2>
    <p>Puntuación final: <strong>${STUDY.score}</strong></p>
    <div class="form-group"><label>Tu nombre</label><input id="fs-name" placeholder="Jugador"></div>
    <button class="btn btn-pri" onclick="saveGame()">Guardar partida</button>`);
}

async function saveGame() {
  const name = $('#fs-name').value.trim() || 'Anónimo';
  const game = {
    id: uid(),
    deckId: STUDY.deckId,
    playerName: name,
    date: today(),
    score: STUDY.score,
    cardResults: STUDY.cards.map(c => ({ cardId: c.id, hits: c.hits, misses: c.misses }))
  };
  APP.games.push(game);
  await saveData();
  closeModal();
  STUDY = null;
  location.hash = '#ranking';
}

function quitStudy() {
  if (!confirm('¿Abandonar la partida? No se guardará.')) return;
  STUDY = null;
  location.hash = '#decks';
}

// ========== VISTA DE ESTUDIO ==========

function renderStudy() {
  const v = $('#view-study');
  if (!STUDY) {
    v.innerHTML = '<div class="panel"><p>Selecciona un mazo desde <a href="#decks">Mazos</a> para estudiar.</p></div>';
    return;
  }
  if (STUDY.finished) {
    const p = studyProgress();
    v.innerHTML = `<div class="panel" style="text-align:center">
      <h2>🎉 ¡Mazo completado!</h2>
      <p style="font-size:1.2rem;margin:.8rem 0">Puntuación: <strong>${STUDY.score}</strong></p>
      <p>${p.total} tarjetas dominadas</p>
      <button class="btn btn-pri" style="margin-top:1rem" onclick="finishStudyModal()">Guardar partida</button>
      <button class="btn btn-sec" style="margin-top:1rem" onclick="quitStudy()">Salir sin guardar</button>
    </div>`;
    return;
  }
  const card = currentCard();
  if (!card) return;
  const p = studyProgress();
  const pending = STUDY.cards.filter(c => !c.mastered);
  const lvlCounts = {};
  pending.forEach(c => { lvlCounts[c.level] = (lvlCounts[c.level] || 0) + 1; });
  let lvlHtml = '';
  for (let i = 1; i <= 6; i++) {
    const n = lvlCounts[i] || 0;
    const active = card.level === i ? 'style="outline:2px solid var(--pri)"' : '';
    lvlHtml += `<span class="badge badge-lvl" ${active}>Nv${i}: ${n}</span> `;
  }

  v.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
      <h2>${esc(STUDY.deckName)}</h2>
      <button class="btn btn-sec btn-sm" onclick="quitStudy()">Abandonar</button>
    </div>
    <div class="scoreboard">
      <span>Puntos: ${STUDY.score}</span>
      <span>Dominadas: ${p.mastered}/${p.total}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${p.pct}%"></div></div>
    <div style="text-align:center;margin-bottom:.5rem;font-size:.85rem">${lvlHtml}</div>
    <div class="flashcard-container" onclick="flipCard()">
      <div class="flashcard ${STUDY.flipped ? 'flipped' : ''}">
        <div class="flashcard-face flashcard-front">
          <div><small style="opacity:.7">Nivel ${card.level}</small><br><br>${esc(card.question)}</div>
        </div>
        <div class="flashcard-face flashcard-back">
          <div>${esc(card.answer)}</div>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:1rem">
      ${STUDY.flipped ? `
        <button class="btn btn-ok" onclick="answerHit()" style="margin-right:1rem;min-width:120px">✓ Acierto</button>
        <button class="btn btn-fail" onclick="answerMiss()" style="min-width:120px">✗ Fallo</button>
      ` : `
        <button class="btn btn-pri" onclick="flipCard()">Voltear tarjeta</button>
      `}
    </div>
    <p style="text-align:center;margin-top:.8rem;font-size:.8rem;color:var(--muted)">Tarjeta ${STUDY.currentIndex + 1} de ${STUDY.queue.length} en esta ronda</p>`;
}

// ========== VISTA CLASIFICACIÓN ==========

function renderRanking() {
  const v = $('#view-ranking');
  let html = '<h2 style="margin-bottom:1rem">Clasificación de partidas</h2>';
  if (!APP.games.length) {
    html += '<p style="color:var(--muted)">No hay partidas guardadas aún.</p>';
    v.innerHTML = html; return;
  }
  html += `<div class="form-group" style="max-width:260px;margin-bottom:1rem"><label>Filtrar por mazo</label><select id="rk-filter" onchange="renderRanking()">
    <option value="">Todos</option>`;
  APP.decks.forEach(d => {
    const sel = $('#rk-filter') && $('#rk-filter').value === d.id ? 'selected' : '';
    html += `<option value="${d.id}" ${sel}>${esc(d.name)}</option>`;
  });
  html += '</select></div>';
  const filterId = $('#rk-filter') ? $('#rk-filter').value : '';
  const games = (filterId ? APP.games.filter(g => g.deckId === filterId) : APP.games)
    .slice().sort((a, b) => b.score - a.score);
  html += '<table><thead><tr><th>#</th><th>Jugador</th><th>Mazo</th><th>Fecha</th><th>Puntuación</th><th></th></tr></thead><tbody>';
  games.forEach((g, i) => {
    const deck = APP.decks.find(d => d.id === g.deckId);
    html += `<tr><td>${i + 1}</td><td>${esc(g.playerName)}</td><td>${deck ? esc(deck.name) : '—'}</td><td>${g.date}</td>
      <td><strong>${g.score}</strong></td><td><button class="btn btn-sec btn-sm" onclick="deleteGame('${g.id}')">✗</button></td></tr>`;
  });
  html += '</tbody></table>';
  v.innerHTML = html;
}

async function deleteGame(id) {
  if (!confirm('¿Eliminar esta partida?')) return;
  APP.games = APP.games.filter(g => g.id !== id);
  await saveData();
  renderRanking();
}

// ========== VISTA RESUMEN (dificultad) ==========

function renderSummary() {
  const v = $('#view-summary');
  let html = '<h2 style="margin-bottom:1rem">Resumen de dificultad</h2>';
  if (!APP.decks.length) { v.innerHTML = html + '<p style="color:var(--muted)">No hay mazos.</p>'; return; }
  html += `<div class="form-group" style="max-width:260px;margin-bottom:1rem"><label>Mazo</label><select id="sm-deck" onchange="renderSummary()">`;
  const selId = $('#sm-deck') ? $('#sm-deck').value : APP.decks[0].id;
  APP.decks.forEach(d => {
    html += `<option value="${d.id}" ${d.id === selId ? 'selected' : ''}>${esc(d.name)}</option>`;
  });
  html += '</select></div>';
  const deck = APP.decks.find(d => d.id === selId) || APP.decks[0];
  if (!deck.cards.length) { v.innerHTML = html + '<p style="color:var(--muted)">Sin tarjetas.</p>'; return; }
  const sorted = deck.cards.map(c => {
    const total = c.stats.hits + c.stats.misses;
    const ratio = total ? c.stats.misses / total : 0;
    return { ...c, total, ratio };
  }).sort((a, b) => b.ratio - a.ratio || b.stats.misses - a.stats.misses);

  html += '<table><thead><tr><th>Pregunta</th><th>Respuesta</th><th>Aciertos</th><th>Fallos</th><th>Dificultad</th></tr></thead><tbody>';
  sorted.forEach(c => {
    const pct = c.total ? Math.round(c.ratio * 100) : 0;
    let color = 'badge-ok', label = 'Fácil';
    if (pct > 60) { color = 'badge-fail'; label = 'Difícil'; }
    else if (pct > 30) { color = 'badge-lvl'; label = 'Media'; }
    else if (!c.total) { color = 'badge-lvl'; label = 'Sin datos'; }
    const bar = c.total ? `<div class="progress-bar" style="width:80px;display:inline-block;vertical-align:middle"><div class="progress-fill" style="width:${pct}%;background:${pct > 60 ? 'var(--fail)' : pct > 30 ? 'var(--pri)' : 'var(--ok)'}"></div></div>` : '';
    html += `<tr><td>${esc(c.question)}</td><td>${esc(c.answer)}</td>
      <td>${c.stats.hits}</td><td>${c.stats.misses}</td>
      <td><span class="badge ${color}">${label} ${pct}%</span> ${bar}</td></tr>`;
  });
  html += '</tbody></table>';
  v.innerHTML = html;
}
