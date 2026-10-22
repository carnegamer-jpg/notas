'use strict';
/* =====================================================================
   Notas — app de anotações, tarefas e calendário (inspirado no Craft)
   Tudo roda localmente; dados ficam no IndexedDB deste computador.
   ===================================================================== */

/* ---------------- utilidades ---------------- */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const now = () => Date.now();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayYmd = () => ymd(new Date());
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = s => cap(parseYmd(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
const shortDate = s => parseYmd(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
const fmtDateTime = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
function timeAgo(t) {
  const s = (t - now()) / 1000, a = Math.abs(s);
  if (a < 45) return 'agora mesmo';
  let unit = 'minute', div = 60;
  for (const [u, v] of [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]]) if (a >= v) { unit = u; div = v; }
  return rtf.format(Math.round(s / div), unit);
}
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const readFile = (file, as = 'dataURL') => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej;
  as === 'text' ? r.readAsText(file) : r.readAsDataURL(file);
});
function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type + ';charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safeName = s => (s || 'documento').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);

/* ---------------- ícones (traço estilo Lucide) ---------------- */
const ICONS = {
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>', chevronLeft: '<path d="m15 18-6-6 6-6"/>', chevronRight: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M5 12h14M12 5v14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  files: '<path d="M15 2H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5"/><path d="M3 8v12a2 2 0 0 0 2 2h9"/>',
  checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  template: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M9 21V9"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  listOrdered: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  brush: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-4M12 8h.01"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M12 3v18"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16"/>',
  alignLeft: '<path d="M21 6H3M15 12H3M17 18H3"/>', alignCenter: '<path d="M21 6H3M17 12H7M19 18H5"/>',
  alignRight: '<path d="M21 6H3M21 12H9M21 18H7"/>', alignJustify: '<path d="M21 6H3M21 12H3M21 18H3"/>',
  indent: '<path d="m3 8 4 4-4 4M21 12h-10M21 6H11M21 18H11"/>', outdent: '<path d="m7 8-4 4 4 4M21 12h-10M21 6H11M21 18H11"/>',
  square: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  move: '<path d="M2 9V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v1M2 13v6a2 2 0 0 0 2 2h7"/><path d="m16 15 5 3-5 3z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
  toggle: '<path d="m9 6 6 6-6 6"/>',
  calendarDay: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/><rect x="7" y="13" width="4" height="4" rx="1"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

/* ---------------- armazenamento (IndexedDB com fallback) ---------------- */
const Store = {
  db: null,
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('notas-app', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { console.warn('IndexedDB indisponível, usando localStorage', e); }
  },
  get(k) {
    if (!this.db) { const v = localStorage.getItem('notas:' + k); return Promise.resolve(v ? JSON.parse(v) : undefined); }
    return new Promise((res, rej) => { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  },
  set(k, v) {
    if (!this.db) { localStorage.setItem('notas:' + k, JSON.stringify(v)); return Promise.resolve(); }
    return new Promise((res, rej) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  },
};

/* ---------------- estado ---------------- */
let S;                         // estado persistido
const ui = { panel: null, docPanel: 'doc', dpTab: 'outline', calMonth: null, calSel: todayYmd(), search: '' };
let ED = null;                 // editor aberto: { docId, title, editor }
let savedRange = null;

const WELCOME_HTML = `
<p>O <strong>Notas</strong> é o seu caderno digital: documentos, tarefas e calendário em um só lugar — tudo salvo automaticamente neste computador.</p>
<h2>Primeiros passos</h2>
<ul class="checklist">
<li data-checked="true">Abrir o Notas pela primeira vez</li>
<li>Criar um documento em <b>Novo Documento</b> (ou <kbd>Alt</kbd>+<kbd>N</kbd>)</li>
<li>Digitar <code>/</code> em uma linha vazia para inserir blocos</li>
<li>Marcar uma tarefa com data, assim: revisar relatório @25/10</li>
<li>Alternar entre modo escuro e claro no ícone de sol/lua lá em cima</li>
</ul>
<h2>Atalhos de digitação</h2>
<p class="deco-block">Comece uma linha com <code>#</code>, <code>##</code> ou <code>###</code> + espaço para títulos, <code>-</code> para lista, <code>1.</code> para lista numerada, <code>[]</code> para tarefa, <code>&gt;</code> para citação e <code>\`\`\`</code> para bloco de código.</p>
<h3>Painéis do documento</h3>
<p>À esquerda fica o <b>sumário</b> (títulos, páginas e cartões), as <b>tarefas</b>, os <b>anexos</b> e a <b>busca</b> dentro do documento. À direita ficam as ferramentas: <b>Inserir</b> (+), <b>Formato</b> (Aa), <b>Estilo</b> (pincel) e <b>Informações</b> (i).</p>
<blockquote>Dica: use <kbd>Ctrl</kbd>+<kbd>K</kbd> para abrir qualquer documento ou comando rapidamente.</blockquote>
<h3>Organização</h3>
<table><tbody><tr><td>Recurso</td><td>Como usar</td></tr><tr><td>Pastas</td><td>Arraste um documento até uma pasta na barra lateral</td></tr><tr><td>Tags</td><td>Escreva #ideias em qualquer lugar do texto</td></tr><tr><td>Favoritos</td><td>Painel de informações → Favoritar</td></tr></tbody></table>
<p>Ideias soltas ficam melhores com uma tag, como #ideias 💡</p>`;

const BUILTIN_TEMPLATES = [
  { id: 'tpl-meeting', title: 'Ata de Reunião', icon: '🤝', html: '<p class="caption">Data: <br>Participantes: </p><h2>Pauta</h2><ol><li><br></li></ol><h2>Decisões</h2><ul><li><br></li></ul><h2>Próximos passos</h2><ul class="checklist"><li><br></li></ul>' },
  { id: 'tpl-journal', title: 'Diário', icon: '📔', html: '<h3>Como estou me sentindo</h3><p><br></p><h3>3 coisas pelas quais sou grato</h3><ol><li><br></li><li><br></li><li><br></li></ol><h3>Prioridades de hoje</h3><ul class="checklist"><li><br></li></ul><h3>Reflexão</h3><p><br></p>' },
  { id: 'tpl-project', title: 'Plano de Projeto', icon: '🚀', html: '<p class="deco-block"><b>Objetivo:</b> </p><h2>Contexto</h2><p><br></p><h2>Escopo</h2><ul><li><br></li></ul><h2>Cronograma</h2><table><tbody><tr><td>Etapa</td><td>Responsável</td><td>Prazo</td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Tarefas</h2><ul class="checklist"><li><br></li></ul>' },
  { id: 'tpl-study', title: 'Resumo de Estudo', icon: '📚', html: '<p class="caption">Matéria / Fonte:</p><h2>Conceitos-chave</h2><ul><li><br></li></ul><h2>Anotações</h2><p><br></p><h2>Dúvidas</h2><ul class="checklist"><li><br></li></ul><blockquote>Resumo em uma frase: </blockquote>' },
];

function newDocObj(o = {}) {
  const t = now();
  return { id: uid(), title: '', html: '<p><br></p>', created: t, updated: t, folderId: null, parentId: null, favorite: false, deleted: null, daily: null, style: {}, ...o };
}
function newTabObj(route = { view: 'all' }) { return { id: uid(), route, history: [] }; }
function defaultState() {
  const folder = { id: uid(), name: 'Como usar o Notas', icon: '👋' };
  const welcome = newDocObj({ title: 'Bem-vindo ao Notas 👋', html: WELCOME_HTML, folderId: folder.id, style: { cover: 'linear-gradient(135deg,#ffcf4a,#ff7a59 55%,#c157ff)' } });
  const tab = newTabObj();
  return {
    version: 1, docs: { [welcome.id]: welcome }, folders: [folder],
    tasks: [{ id: uid(), text: 'Explorar o calendário e criar a nota do dia', done: false, date: todayYmd(), created: now() }],
    templates: [], backups: {},
    settings: { theme: 'dark', space: 'Meu Espaço', author: '', view: 'grid', sort: 'updated', sidebar: true },
    tabs: [tab], activeTab: tab.id,
  };
}

let saveTimer;
function persist() {
  setSaveStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
async function saveNow() {
  clearTimeout(saveTimer);
  try { await Store.set('state', S); setSaveStatus('saved'); }
  catch (e) { console.error(e); setSaveStatus('error'); toast('Não foi possível salvar: ' + e.message); }
}
function setSaveStatus(s) {
  ui.saveStatus = s;
  const n = $('#save-status'); if (!n) return;
  n.className = 'save-status ' + s;
  n.innerHTML = `<span class="dot"></span>${s === 'saving' ? 'Salvando…' : s === 'error' ? 'Erro ao salvar' : 'Salvo'}`;
}

/* ---------------- consultas sobre os dados ---------------- */
const liveDocs = () => Object.values(S.docs).filter(d => !d.deleted);
const docTitle = d => (d && d.title.trim()) || 'Documento Sem Título';
const textCache = new Map();
function docText(d) {
  const c = textCache.get(d.id);
  if (c && c.u === d.updated && c.h === d.html.length) return c.t;
  const t = document.createElement('template'); t.innerHTML = d.html;
  $$('p,h1,h2,h3,h4,li,blockquote,pre,td,div', t.content).forEach(n => n.append(' '));
  const text = t.content.textContent.replace(/\s+/g, ' ').trim();
  textCache.set(d.id, { u: d.updated, h: d.html.length, t: text });
  return text;
}
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_-]{2,40})/gu;
function docTags(d) { const out = new Set(); for (const m of docText(d).matchAll(TAG_RE)) out.add(m[2].toLowerCase()); return [...out]; }
function allTags() { const m = new Map(); liveDocs().forEach(d => docTags(d).forEach(t => m.set(t, (m.get(t) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function sortDocs(list) {
  const k = S.settings.sort;
  return list.sort((a, b) => k === 'title' ? docTitle(a).localeCompare(docTitle(b), 'pt-BR') : k === 'created' ? b.created - a.created : b.updated - a.updated);
}
function parseTaskDate(text) {
  const m = text.match(/@(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) { let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1]); if (!isNaN(d)) return ymd(d); }
  if (/@hoje\b/i.test(text)) return todayYmd();
  return null;
}
function allTasks() {
  const out = S.tasks.map(t => ({ kind: 'own', id: t.id, text: t.text, done: t.done, date: t.date, ref: t }));
  for (const d of liveDocs()) {
    if (!d.html.includes('checklist')) continue;
    const tpl = document.createElement('template'); tpl.innerHTML = d.html;
    $$('ul.checklist > li', tpl.content).forEach((li, i) => {
      const text = li.textContent.trim(); if (!text) return;
      out.push({ kind: 'doc', docId: d.id, index: i, text, done: li.dataset.checked === 'true', date: parseTaskDate(text) || d.daily });
    });
  }
  return out;
}
function toggleTask(t) {
  if (t.kind === 'own') { t.ref.done = !t.ref.done; t.ref.doneAt = t.ref.done ? now() : null; persist(); return; }
  const d = S.docs[t.docId];
  if (ED && ED.docId === t.docId) {
    const li = $$('ul.checklist > li', ED.editor)[t.index];
    if (li) { setChecked(li, li.dataset.checked !== 'true'); flushEditor(); }
    return;
  }
  const tpl = document.createElement('template'); tpl.innerHTML = d.html;
  const li = $$('ul.checklist > li', tpl.content)[t.index];
  if (li) { setChecked(li, li.dataset.checked !== 'true'); d.html = tpl.innerHTML; d.updated = now(); persist(); }
}
function setChecked(li, v) { if (v) li.dataset.checked = 'true'; else delete li.dataset.checked; }
function backlinks(id) { return liveDocs().filter(d => d.id !== id && d.html.includes(`data-doc="${id}"`)); }

/* ---------------- abas e navegação ---------------- */
const tab = () => S.tabs.find(t => t.id === S.activeTab) || S.tabs[0];
const sameRoute = (a, b) => a.view === b.view && (a.id || null) === (b.id || null);
function routeTitle(r) {
  switch (r.view) {
    case 'doc': return docTitle(S.docs[r.id]);
    case 'tasks': return 'Tarefas';
    case 'calendar': return 'Calendário';
    case 'favorites': return 'Favoritos';
    case 'folder': return r.id === 'none' ? 'Não organizados' : (S.folders.find(f => f.id === r.id)?.name || 'Pasta');
    case 'tag': return '#' + r.id;
    case 'templates': return 'Meus Modelos';
    case 'trash': return 'Lixeira';
    default: return 'Todos os Documentos';
  }
}
function routeIcon(r) {
  return ic({ doc: 'fileText', tasks: 'checkCircle', calendar: 'calendar', favorites: 'star', folder: 'folder', tag: 'hash', templates: 'template', trash: 'trash' }[r.view] || 'files');
}
function openTab(route = { view: 'all' }) {
  flushEditor();
  const t = newTabObj(route);
  S.tabs.splice(S.tabs.indexOf(tab()) + 1, 0, t);
  S.activeTab = t.id; persist(); render(); return t;
}
function closeTab(id) {
  flushEditor();
  const i = S.tabs.findIndex(t => t.id === id); if (i < 0) return;
  S.tabs.splice(i, 1);
  if (!S.tabs.length) S.tabs.push(newTabObj());
  if (S.activeTab === id) S.activeTab = (S.tabs[i] || S.tabs[i - 1]).id;
  persist(); render();
}
function activateTab(id) { if (id === S.activeTab) return; flushEditor(); S.activeTab = id; ui.panel = null; persist(); render(); }
function go(route, { newTab = false } = {}) {
  if (newTab) return openTab(route);
  flushEditor();
  const t = tab();
  if (!sameRoute(t.route, route)) { t.history.push(t.route); if (t.history.length > 60) t.history.shift(); }
  t.route = route; ui.panel = null;
  persist(); render();
}
function back() { const t = tab(); if (!t.history.length) return; flushEditor(); t.route = t.history.pop(); ui.panel = null; persist(); render(); }

/* ---------------- tema ---------------- */
const mql = matchMedia('(prefers-color-scheme: dark)');
function resolvedTheme() { const t = S?.settings.theme || 'dark'; return t === 'system' ? (mql.matches ? 'dark' : 'light') : t; }
function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#1f1f1f' : '#f5f5f3');
}
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const closeDrawer = () => document.body.classList.remove('drawer-open');
function cycleTheme() {
  const order = ['dark', 'light', 'system'];
  S.settings.theme = order[(order.indexOf(S.settings.theme) + 1) % 3];
  applyTheme(); persist(); renderToolbar();
  toast({ dark: 'Modo escuro', light: 'Modo claro', system: 'Tema do sistema' }[S.settings.theme]);
}
mql.addEventListener('change', () => { if (S?.settings.theme === 'system') applyTheme(); });

/* =====================================================================
   RENDERIZAÇÃO
   ===================================================================== */
function render() {
  const r = tab().route;
  if (r.view === 'doc' && (!S.docs[r.id] || S.docs[r.id].deleted)) tab().route = { view: 'all' };
  if (tab().route.view !== 'doc') ED = null;
  closeDrawer();
  applyTheme();
  document.body.classList.toggle('no-sidebar', !S.settings.sidebar);
  renderTabs(); renderToolbar(); renderSidebar(); renderMain();
  document.title = routeTitle(tab().route) + ' — Notas';
}

function renderTabs() {
  $('#tabs').innerHTML = S.tabs.map(t => `
    <div class="tab ${t.id === S.activeTab ? 'active' : ''}" data-tab="${t.id}" draggable="true" title="${esc(routeTitle(t.route))}">
      <span class="tab-icon">${routeIcon(t.route)}</span>
      <span class="tab-title">${esc(routeTitle(t.route))}</span>
      <button class="tab-close" data-close="${t.id}" title="Fechar aba (Alt+W)">${ic('x')}</button>
    </div>`).join('') + `<button class="tab-new" data-action="new-tab" title="Nova aba (Alt+T)">${ic('plus')}</button>`;
}

function renderToolbar() {
  const r = tab().route;
  let center;
  if (r.view === 'doc') {
    const d = S.docs[r.id], parent = d.parentId && S.docs[d.parentId] && !S.docs[d.parentId].deleted ? S.docs[d.parentId] : null;
    center = `<div class="tb-title" id="tb-title">${parent ? `<span class="crumb" data-open="${parent.id}">${esc(docTitle(parent))}</span> / ` : ''}${esc(d.title.trim() || 'Página sem título')}</div>`;
  } else {
    center = `<button class="search-pill" data-action="quick-open">${ic('search', 'sm')}<span>Abrir</span><kbd>Ctrl K</kbd></button>`;
  }
  const th = S.settings.theme;
  $('#toolbar').innerHTML = `
    <div class="tb-left">
      <button class="icon-btn" data-action="toggle-sidebar" title="Barra lateral (Ctrl+\\)">${ic('sidebar')}</button>
      <button class="icon-btn" data-action="back" title="Voltar" ${tab().history.length ? '' : 'disabled'}>${ic('chevronLeft')}</button>
      ${r.view === 'doc' ? `<button class="icon-btn" data-action="quick-open" title="Abrir (Ctrl+K)">${ic('search')}</button>` : ''}
    </div>
    ${center}
    <div class="tb-right">
      <span id="save-status" class="save-status"></span>
      <button class="icon-btn" data-action="theme" title="Tema: ${{ dark: 'escuro', light: 'claro', system: 'sistema' }[th]} (Ctrl+Shift+L)">${ic(th === 'dark' ? 'moon' : th === 'light' ? 'sun' : 'monitor')}</button>
      <button class="icon-btn" data-action="help" title="Atalhos e ajuda">${ic('help')}</button>
    </div>`;
  setSaveStatus(ui.saveStatus || 'saved');
}

/* ---------------- barra lateral ---------------- */
function navItem(route, icon, label, extra = '') {
  const active = sameRoute(route, tab().route);
  return `<button class="nav-item ${active ? 'active' : ''}" data-route="${esc(JSON.stringify(route))}"${route.view === 'folder' ? ` data-folder="${route.id}"` : ''}>${icon}<span class="nav-label">${esc(label)}</span>${extra}</button>`;
}
function renderSidebar() {
  const sb = $('#sidebar');
  const inDoc = tab().route.view === 'doc';
  const switcher = inDoc ? `<div class="seg-switch">
      <button class="${ui.docPanel === 'library' ? 'on' : ''}" data-dpmode="library" title="Biblioteca">${ic('folder')}</button>
      <button class="${ui.docPanel === 'doc' ? 'on' : ''}" data-dpmode="doc" title="Documento">${ic('fileText')}</button></div>` : '';
  if (inDoc && ui.docPanel === 'doc') {
    const d = S.docs[tab().route.id];
    sb.innerHTML = `
      <div class="dp-head"><div class="dp-thumb">${ic('fileText', 'sm')}</div>
        <div><div class="dp-title" id="dp-title">${esc(docTitle(d))}</div><div class="dp-sub" id="dp-sub">Atualizado ${timeAgo(d.updated)}</div></div></div>
      <div class="seg">
        ${[['outline', 'list', 'Sumário'], ['tasks', 'checkCircle', 'Tarefas'], ['files', 'paperclip', 'Anexos'], ['search', 'search', 'Buscar (Ctrl+F)']]
          .map(([k, i, t]) => `<button class="${ui.dpTab === k ? 'on' : ''}" data-dptab="${k}" title="${t}">${ic(i, 'sm')}</button>`).join('')}
      </div>
      <div class="dp-body" id="dp-body"></div>
      <div class="sb-footer" style="justify-content:center;border:0">${switcher}</div>`;
    renderDocPanelBody();
    return;
  }
  const today = todayYmd();
  const pending = allTasks().filter(t => !t.done && t.date && t.date <= today).length;
  const favs = sortDocs(liveDocs().filter(d => d.favorite));
  const tags = allTags().slice(0, 15);
  sb.innerHTML = `
    <div class="sb-scroll">
      <button class="space-btn" data-action="space-menu"><span class="space-avatar">${esc((S.settings.space[0] || 'N').toUpperCase())}</span><span>${esc(S.settings.space)}</span>${ic('chevronDown', 'sm')}</button>
      <button class="nav-item" data-action="new-doc">${ic('filePlus')}<span class="nav-label">Novo Documento</span></button>
      <div class="sb-gap"></div>
      ${navItem({ view: 'all' }, ic('files'), 'Todos os Documentos')}
      ${navItem({ view: 'tasks' }, ic('checkCircle'), 'Tarefas', pending ? `<span class="badge hot">${pending}</span>` : '')}
      ${navItem({ view: 'calendar' }, ic('calendar'), 'Calendário')}
      <div class="sb-gap"></div>
      ${navItem({ view: 'templates' }, ic('template'), 'Meus Modelos')}
      ${navItem({ view: 'trash' }, ic('trash'), 'Lixeira', liveCount('trash'))}
      <div class="sb-section"><div class="sb-head">Favoritos</div>
        ${favs.length ? favs.map(d => `<button class="nav-item ${tab().route.id === d.id ? 'active' : ''}" data-open="${d.id}">${ic('star', 'fill fav-star')}<span class="nav-label">${esc(docTitle(d))}</span></button>`).join('')
        : '<div class="sb-hint">Favorite documentos para mantê-los por perto</div>'}
      </div>
      <div class="sb-section"><div class="sb-head">Pastas <button data-action="new-folder" title="Nova pasta">${ic('plus', 'sm')}</button></div>
        ${S.folders.map(f => navItem({ view: 'folder', id: f.id }, `<span class="nav-emoji">${esc(f.icon || '📁')}</span>`, f.name, `<span class="badge">${liveDocs().filter(d => d.folderId === f.id).length}</span>`)).join('')}
        ${navItem({ view: 'folder', id: 'none' }, ic('inbox'), 'Não organizados')}
      </div>
      <div class="sb-section"><div class="sb-head">Tags</div>
        ${tags.length ? tags.map(([t, n]) => navItem({ view: 'tag', id: t }, ic('hash'), t, `<span class="badge">${n}</span>`)).join('')
        : '<div class="sb-hint">Escreva #palavra no texto para criar tags</div>'}
      </div>
    </div>
    <div class="sb-footer">
      <button class="icon-btn" data-action="import" title="Importar (.md, .txt, .html ou backup .json)">${ic('upload')}</button>
      <button class="icon-btn" data-action="export-all" title="Exportar backup completo">${ic('download')}</button>
      <span class="grow"></span>${switcher}
    </div>`;
}
function liveCount(kind) {
  if (kind === 'trash') { const n = Object.values(S.docs).filter(d => d.deleted).length; return n ? `<span class="badge">${n}</span>` : ''; }
  return '';
}

/* ---------------- painel esquerdo do documento ---------------- */
function renderDocPanelBody() {
  const body = $('#dp-body'); if (!body || !ED) return;
  if (ui.dpTab === 'search') {
    if (!$('#dp-search', body)) {
      body.innerHTML = `<input class="dp-search" id="dp-search" placeholder="Buscar no documento…" value="${esc(ui.search)}"><div id="dp-hits"></div>`;
    }
    runDocSearch();
    return;
  }
  if (ui.dpTab === 'outline') {
    const items = $$(':scope > h1, :scope > h2, :scope > h3, :scope > .page-link', ED.editor);
    body.innerHTML = `<div class="dp-label">Sumário</div>` + (items.length
      ? items.map((n, i) => `<button class="outline-item ${n.classList.contains('page-link') ? 'l1 pg' : 'l' + n.tagName[1]}" data-oi="${i}">${esc(n.textContent.trim() || 'Sem título')}</button>`).join('')
      : `<div class="dp-empty">Use títulos, páginas ou cartões para criar um sumário.</div>`);
    body.onclick = e => { const b = e.target.closest('[data-oi]'); if (b) scrollToNode(items[+b.dataset.oi]); };
  } else if (ui.dpTab === 'tasks') {
    const lis = $$('ul.checklist > li', ED.editor).filter(li => li.textContent.trim());
    const done = lis.filter(li => li.dataset.checked === 'true').length;
    body.innerHTML = `<div class="dp-label"><span>Tarefas</span><span>${done}/${lis.length}</span></div>` + (lis.length
      ? `<div class="progress"><i style="width:${lis.length ? done / lis.length * 100 : 0}%"></i></div>` + lis.map((li, i) => `
        <div class="task-row ${li.dataset.checked === 'true' ? 'done' : ''}">
          <button class="chk ${li.dataset.checked === 'true' ? 'on' : ''}" data-ti="${i}">${ic('check')}</button>
          <span class="tr-text" data-tgo="${i}">${esc(li.textContent.trim())}</span></div>`).join('')
      : `<div class="dp-empty">Nenhuma tarefa neste documento. Digite <code>[]</code> + espaço para criar uma.</div>`);
    body.onclick = e => {
      const c = e.target.closest('[data-ti]'); if (c) { const li = lis[+c.dataset.ti]; setChecked(li, li.dataset.checked !== 'true'); onEdit(true); renderDocPanelBody(); return; }
      const g = e.target.closest('[data-tgo]'); if (g) scrollToNode(lis[+g.dataset.tgo]);
    };
  } else if (ui.dpTab === 'files') {
    const files = $$('figure.img img, .attachment', ED.editor);
    body.innerHTML = `<div class="dp-label">Anexos</div>` + (files.length
      ? files.map((n, i) => n.tagName === 'IMG'
        ? `<div class="file-row" data-fi="${i}"><img src="${n.src}"><span class="fr-name">Imagem ${i + 1}</span></div>`
        : `<div class="file-row" data-fi="${i}"><span class="fr-ic">📎</span><span class="fr-name">${esc(n.dataset.name || 'Arquivo')}</span></div>`).join('')
      : `<div class="dp-empty">Imagens e arquivos anexados aparecem aqui.</div>`);
    body.onclick = e => { const f = e.target.closest('[data-fi]'); if (f) scrollToNode(files[+f.dataset.fi]); };
  }
}
function scrollToNode(n) {
  if (!n) return;
  if (isMobile()) closeDrawer();
  n.scrollIntoView({ behavior: 'smooth', block: 'center' });
  n.animate([{ background: 'var(--accent-soft)' }, { background: 'transparent' }], { duration: 1400 });
}
function runDocSearch() {
  const hitsEl = $('#dp-hits'); if (!hitsEl || !ED) return;
  const q = ui.search.trim().toLowerCase();
  const hl = window.CSS && CSS.highlights;
  hl?.delete('search'); hl?.delete('search-cur');
  if (!q) { hitsEl.innerHTML = '<div class="dp-empty">Digite para buscar neste documento.</div>'; return; }
  const ranges = [];
  const walker = document.createTreeWalker(ED.editor, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.data.toLowerCase(); let i = txt.indexOf(q);
    while (i >= 0) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + q.length); ranges.push(r); i = txt.indexOf(q, i + q.length); }
  }
  if (hl && ranges.length) hl.set('search', new Highlight(...ranges));
  hitsEl.innerHTML = `<div class="dp-label">${ranges.length} resultado${ranges.length === 1 ? '' : 's'}</div>` + ranges.slice(0, 200).map((r, i) => {
    const t = r.startContainer.data, s = r.startOffset;
    const pre = t.slice(Math.max(0, s - 30), s), hit = t.slice(s, r.endOffset), post = t.slice(r.endOffset, r.endOffset + 50);
    return `<button class="hit" data-hit="${i}">${s > 30 ? '…' : ''}${esc(pre)}<mark>${esc(hit)}</mark>${esc(post)}</button>`;
  }).join('');
  hitsEl.onclick = e => {
    const b = e.target.closest('[data-hit]'); if (!b) return;
    const r = ranges[+b.dataset.hit];
    $$('.hit', hitsEl).forEach(h => h.classList.toggle('cur', h === b));
    hl?.set('search-cur', new Highlight(r));
    r.startContainer.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

/* ---------------- área principal ---------------- */
function renderMain() {
  const r = tab().route;
  const m = $('#main');
  if (r.view === 'doc') return renderDoc(S.docs[r.id]);
  ED = null;
  switch (r.view) {
    case 'tasks': return renderTasks(m);
    case 'calendar': return renderCalendar(m);
    case 'templates': return renderTemplates(m);
    case 'trash': return renderTrash(m);
    case 'favorites': return renderDocList(m, 'Favoritos', liveDocs().filter(d => d.favorite));
    case 'folder': return renderDocList(m, routeTitle(r), liveDocs().filter(d => (d.folderId || 'none') === r.id || (r.id === 'none' && !S.folders.some(f => f.id === d.folderId))), { folderId: r.id === 'none' ? null : r.id });
    case 'tag': return renderDocList(m, '#' + r.id, liveDocs().filter(d => docTags(d).includes(r.id)));
    default: return renderDocList(m, 'Todos os Documentos', liveDocs());
  }
}

function docPreviewHTML(d) {
  const cover = d.style?.cover ? `<div class="doc-cover-mini" style="background:${esc(d.style.cover)};background-size:cover;background-position:center"></div>` : '';
  return `<div class="dc-mini ed">${cover}<h1 class="dt">${esc(docTitle(d))}</h1>${d.html.replace(/contenteditable="[^"]*"/g, '')}</div>`;
}
function renderDocList(m, title, docs, ctx = {}) {
  docs = sortDocs(docs);
  const view = S.settings.view;
  const items = !docs.length
    ? `<div class="empty">Você ainda não tem documentos aqui<button class="btn" data-action="new-doc-here">${ic('filePlus')}Criar documento</button></div>`
    : view === 'grid'
      ? `<div class="doc-grid">${docs.map(d => `
          <div class="doc-card" data-open="${d.id}" data-docctx="${d.id}" draggable="true">
            <div class="dc-preview" style="${d.style?.paper ? `background:${esc(d.style.paper)};color:${esc(d.style.text || '')}` : ''}">${docPreviewHTML(d)}</div>
            <div class="dc-meta"><div class="dc-title">${d.favorite ? ic('star', 'sm fill fav-star') : ''}${esc(docTitle(d))}</div><div class="dc-date">${timeAgo(d.updated)}</div></div>
          </div>`).join('')}</div>`
      : `<div class="doc-list">
          <div class="doc-row list-head"><span></span><span>Nome</span><span>Pasta</span><span>Atualizado</span></div>
          ${docs.map(d => `<div class="doc-row" data-open="${d.id}" data-docctx="${d.id}" draggable="true">
            ${ic('fileText')}<span class="dr-title">${d.favorite ? ic('star', 'sm fill fav-star') : ''}${esc(docTitle(d))} <span class="dr-snip">${esc(docText(d).slice(0, 80))}</span></span>
            <span class="dr-sub">${esc(S.folders.find(f => f.id === d.folderId)?.name || 'Não organizados')}</span><span class="dr-sub">${timeAgo(d.updated)}</span></div>`).join('')}</div>`;
  m.innerHTML = `<div class="view">
    <div class="view-head">
      <button class="circle-btn" data-action="new-doc-here" title="Novo documento aqui">${ic('plus')}</button>
      <h1>${esc(title)}</h1>
      <div class="btn-group">
        <button class="${view === 'grid' ? 'on' : ''}" data-setview="grid" title="Grade">${ic('grid')}</button>
        <button class="${view === 'list' ? 'on' : ''}" data-setview="list" title="Lista">${ic('list')}</button>
      </div>
      <button class="circle-btn" data-action="sort-menu" title="Ordenar">${ic('more')}</button>
    </div>${items}</div>`;
  m.dataset.folder = ctx.folderId || '';
}

/* ---------------- tarefas ---------------- */
function taskItemHTML(t) {
  const today = todayYmd();
  const dateChip = t.date ? `<span class="chip ${!t.done && t.date < today ? 'red' : t.date === today ? 'blue' : ''}" data-tdate="${t.kind === 'own' ? t.id : ''}">${ic('calendar', 'sm')}${t.date === today ? 'Hoje' : shortDate(t.date)}</span>`
    : t.kind === 'own' ? `<span class="chip" data-tdate="${t.id}" style="opacity:.6">${ic('calendar', 'sm')}Data</span>` : '';
  const src = t.kind === 'doc' ? `<span class="chip" data-open="${t.docId}">${ic('fileText', 'sm')}${esc(docTitle(S.docs[t.docId]).slice(0, 28))}</span>` : '';
  return `<div class="task-item ${t.done ? 'done' : ''}" data-tkey="${t.kind}:${t.kind === 'own' ? t.id : t.docId + ':' + t.index}">
    <button class="chk ${t.done ? 'on' : ''}" data-ttoggle>${ic('check')}</button>
    <span class="ti-text" ${t.kind === 'own' ? 'contenteditable="true" spellcheck="false" data-tedit' : ''}>${esc(t.text)}</span>
    <span class="ti-meta">${src}${dateChip}${t.kind === 'own' ? `<button class="ti-del" data-tdel title="Excluir tarefa">${ic('trash', 'sm')}</button>` : ''}</span></div>`;
}
function renderTasks(m) {
  const today = todayYmd();
  const tasks = allTasks();
  ui.taskIndex = tasks;
  const open = tasks.filter(t => !t.done);
  const groups = [
    ['Atrasadas', open.filter(t => t.date && t.date < today), 'overdue'],
    ['Hoje', open.filter(t => t.date === today)],
    ['Próximas', open.filter(t => t.date && t.date > today).sort((a, b) => a.date.localeCompare(b.date))],
    ['Sem data', open.filter(t => !t.date)],
    ['Concluídas', tasks.filter(t => t.done).slice(0, 50)],
  ];
  m.innerHTML = `<div class="view"><div class="view-head"><h1>Tarefas</h1></div>
    <div class="tasks-wrap">
      <form class="task-add" id="task-add">${ic('plus')}<input type="text" id="task-text" placeholder="Nova tarefa… (Enter para adicionar)" autocomplete="off"><input type="date" id="task-date"><button class="btn primary" type="submit">Adicionar</button></form>
      ${groups.map(([name, list, cls]) => list.length ? `<div class="task-group"><div class="tg-head ${cls || ''}">${name}<span class="badge">${list.length}</span></div>${list.map(taskItemHTML).join('')}</div>` : '').join('')}
      ${tasks.length ? '' : '<div class="empty">Nenhuma tarefa ainda. Adicione acima ou crie listas de tarefas dentro dos documentos.</div>'}
      <p class="sb-hint" style="margin-top:24px">Tarefas de documentos (listas com ☐) aparecem aqui automaticamente. Escreva <b>@25/10</b> no texto da tarefa para definir uma data.</p>
    </div></div>`;
  bindTaskForm($('#task-add'), $('#task-text'), $('#task-date'), () => renderTasks(m));
}
function bindTaskForm(form, textIn, dateIn, rerender) {
  form.onsubmit = e => {
    e.preventDefault();
    const text = textIn.value.trim(); if (!text) return;
    S.tasks.unshift({ id: uid(), text, done: false, date: dateIn.value || parseTaskDate(text), created: now() });
    persist(); rerender(); renderSidebar();
    setTimeout(() => $('#' + textIn.id)?.focus());
  };
}
function findTaskFromEl(node) {
  const row = node.closest('[data-tkey]'); if (!row) return null;
  const [kind, a, b] = row.dataset.tkey.split(':');
  if (kind === 'own') { const ref = S.tasks.find(t => t.id === a); return ref && { kind, id: a, ref, text: ref.text, done: ref.done, date: ref.date }; }
  return { kind, docId: a, index: +b };
}

/* ---------------- calendário ---------------- */
function renderCalendar(m) {
  const today = todayYmd();
  if (!ui.calMonth) { const d = new Date(); ui.calMonth = { y: d.getFullYear(), m: d.getMonth() }; }
  const { y, m: mo } = ui.calMonth;
  const first = new Date(y, mo, 1), start = new Date(y, mo, 1 - first.getDay());
  const byDate = {};
  const tasks = allTasks(); ui.taskIndex = tasks;
  tasks.forEach(t => { if (t.date) (byDate[t.date] ||= []).push(t); });
  const notes = {}; liveDocs().forEach(d => { if (d.daily) notes[d.daily] = d; });
  const cells = [];
  const total = Math.ceil((first.getDay() + new Date(y, mo + 1, 0).getDate()) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = ymd(d), list = byDate[k] || [];
    cells.push(`<div class="cal-cell ${d.getMonth() !== mo ? 'other' : ''} ${k === today ? 'today' : ''} ${k === ui.calSel ? 'sel' : ''}" data-day="${k}">
      <div class="cal-num"><span>${d.getDate()}</span>${notes[k] ? '<i class="note-dot" title="Nota do dia"></i>' : ''}</div>
      ${list.slice(0, 3).map(t => `<div class="cal-ev ${t.done ? 'done' : ''}">${esc(t.text)}</div>`).join('')}
      ${list.length > 3 ? `<div class="cal-more">+${list.length - 3} mais</div>` : ''}</div>`);
  }
  const sel = ui.calSel, selTasks = byDate[sel] || [], selNote = notes[sel];
  const created = liveDocs().filter(d => ymd(new Date(d.created)) === sel && !d.daily);
  m.innerHTML = `<div class="view">
    <div class="view-head"><h1>Calendário</h1>
      <div class="cal-nav"><button class="circle-btn" data-cal="-1">${ic('chevronLeft')}</button>
      <div class="cal-month">${cap(first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</div>
      <button class="circle-btn" data-cal="1">${ic('chevronRight')}</button><button class="btn" data-cal="0">Hoje</button></div></div>
    <div class="cal-layout">
      <div class="cal-grid">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells.join('')}</div>
      <div class="cal-side">
        <h3>${esc(cap(parseYmd(sel).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })))}</h3>
        <div class="sub">${sel === today ? 'Hoje' : timeAgo(parseYmd(sel).getTime() + 12 * 3600e3)}</div>
        <button class="btn ${selNote ? '' : 'primary'}" style="width:100%;justify-content:center" data-action="daily-note">${ic('calendarDay')}${selNote ? 'Abrir nota do dia' : 'Criar nota do dia'}</button>
        <form class="task-add" id="cal-task-add">${ic('plus', 'sm')}<input type="text" id="cal-task-text" placeholder="Tarefa para este dia…" autocomplete="off"><input type="hidden" id="cal-task-date" value="${sel}"></form>
        ${selTasks.length ? selTasks.map(taskItemHTML).join('') : '<div class="sb-hint">Nenhuma tarefa neste dia.</div>'}
        ${created.length ? `<div class="fp-sec">Criados neste dia</div>${created.map(d => `<button class="nav-item" data-open="${d.id}">${ic('fileText')}<span class="nav-label">${esc(docTitle(d))}</span></button>`).join('')}` : ''}
      </div>
    </div></div>`;
  bindTaskForm($('#cal-task-add'), $('#cal-task-text'), $('#cal-task-date'), () => renderCalendar(m));
}
function openDailyNote(date) {
  const ex = liveDocs().find(d => d.daily === date);
  if (ex) return go({ view: 'doc', id: ex.id });
  createDoc({ title: longDate(date), daily: date, html: '<h2>Tarefas</h2><ul class="checklist"><li><br></li></ul><h2>Notas</h2><p><br></p>' });
}

/* ---------------- modelos e lixeira ---------------- */
function renderTemplates(m) {
  const mine = S.templates;
  const card = (t, own) => `<div class="doc-card tpl-card" data-tpl="${t.id}" ${own ? `data-tplctx="${t.id}"` : ''}>
      <div class="dc-preview"><div class="dc-mini ed"><h1 class="dt">${esc(t.icon || '')} ${esc(t.title)}</h1>${t.html}</div></div>
      <div class="dc-meta"><div class="dc-title">${esc(t.title)}</div><div class="dc-date">${own ? 'Seu modelo' : 'Modelo do Notas'}</div></div></div>`;
  m.innerHTML = `<div class="view"><div class="view-head"><h1>Meus Modelos</h1></div>
    <div class="section-title">Seus modelos</div>
    ${mine.length ? `<div class="doc-grid">${mine.map(t => card(t, true)).join('')}</div>` : '<div class="sb-hint" style="margin-bottom:10px">Abra um documento → Informações (i) → <b>Salvar como modelo</b>.</div>'}
    <div class="section-title" style="margin-top:28px">Modelos prontos</div>
    <div class="doc-grid">${BUILTIN_TEMPLATES.map(t => card(t, false)).join('')}</div></div>`;
}
function useTemplate(id) {
  const t = S.templates.find(x => x.id === id) || BUILTIN_TEMPLATES.find(x => x.id === id); if (!t) return;
  createDoc({ title: t.own ? t.title : '', html: t.html, style: { ...(t.style || {}) } });
}
function renderTrash(m) {
  const docs = Object.values(S.docs).filter(d => d.deleted).sort((a, b) => b.deleted - a.deleted);
  m.innerHTML = `<div class="view"><div class="view-head"><h1>Lixeira</h1>${docs.length ? `<button class="btn danger" data-action="empty-trash">${ic('trash', 'sm')}Esvaziar lixeira</button>` : ''}</div>
    ${docs.length ? `<div class="doc-list">${docs.map(d => `<div class="doc-row trash-row">${ic('fileText')}<span class="dr-title">${esc(docTitle(d))}</span><span class="dr-sub">Excluído ${timeAgo(d.deleted)}</span>
      <span style="display:flex;gap:6px"><button class="btn" data-restore="${d.id}">${ic('restore', 'sm')}Restaurar</button><button class="btn danger" data-purge="${d.id}">Excluir</button></span></div>`).join('')}</div>`
      : '<div class="empty">A lixeira está vazia</div>'}</div>`;
}

/* =====================================================================
   EDITOR
   ===================================================================== */
const DOC_THEMES = [
  { id: 'original', name: 'Original' },
  { id: 'papel', name: 'Papel', bg: '#ebe6da', paper: '#fbf8f1', text: '#2b2a27' },
  { id: 'sepia', name: 'Sépia', bg: '#f4ecd8', text: '#5b4636' },
  { id: 'oceano', name: 'Oceano', bg: '#0c1a28', paper: '#112436', text: '#d7e7f5' },
  { id: 'floresta', name: 'Floresta', bg: '#0f1c15', text: '#d5e8d9' },
  { id: 'lavanda', name: 'Lavanda', bg: '#e6def8', paper: '#f6f2ff', text: '#2e2645' },
  { id: 'grafite', name: 'Grafite', bg: '#121214', paper: '#1c1c20', text: '#e8e8ee' },
  { id: 'menta', name: 'Menta', bg: '#e3f4ec', text: '#1d3b2f' },
  { id: 'noite', name: 'Meia-noite', bg: '#000000', text: '#f2f2f2' },
];
const COVERS = [
  'linear-gradient(135deg,#ffcf4a,#ff7a59 55%,#c157ff)', 'linear-gradient(135deg,#4c8dff,#6fd3ff)',
  'linear-gradient(135deg,#0f2027,#2c5364)', 'linear-gradient(135deg,#6ff2c0,#2f80ed)',
  'linear-gradient(135deg,#f05a72,#f5a03c)', 'linear-gradient(135deg,#b3a8ff,#f6d5f7)',
  'linear-gradient(160deg,#1d2b1f,#4d7c4f)', 'linear-gradient(135deg,#232526,#414345)',
];
const TEXT_COLORS = ['#d9d9d9', '#6e6e73', '#b0bec5', '#b3a8ff', '#4c8dff', '#6fd3ff', '#3ccf91', '#c46bff', '#f05a72', '#f5a03c', '#9a6a3a'];
const HL_COLORS = ['rgba(255,214,10,.4)', 'rgba(76,141,255,.3)', 'rgba(60,207,145,.3)', 'rgba(240,90,114,.3)', 'rgba(196,107,255,.3)'];

function renderDoc(d) {
  const m = $('#main');
  m.innerHTML = `<div class="doc-view" id="doc-view">
    <div class="doc-scroll" id="doc-scroll">
      <div class="doc-paper">
        <div class="doc-cover" id="doc-cover" hidden></div>
        <div class="doc-titlebar"><h1 id="doc-title" contenteditable="true" spellcheck="true" data-placeholder="Título da Página"></h1></div>
        <div id="editor" contenteditable="true" spellcheck="true"></div>
      </div>
    </div>
    <div class="float-tools" id="float-tools">
      <button data-panel="insert" title="Inserir (digite / no texto)">${ic('plus', 'lg')}</button>
      <button data-panel="format" title="Formato">Aa</button>
      <button data-panel="style" title="Estilo do documento">${ic('brush')}</button>
      <button data-panel="info" title="Informações da página">${ic('info')}</button>
    </div>
    <div class="float-panel" id="float-panel" hidden></div>
  </div>`;
  const title = $('#doc-title'), editor = $('#editor');
  title.textContent = d.title;
  editor.innerHTML = d.html || '<p><br></p>';
  ED = { docId: d.id, title, editor };
  savedRange = null;
  syncPageLinks();
  applyDocStyle(d);
  bindEditor();
  renderPanel();
  if (!d.title) title.focus();
}
function syncPageLinks() {
  $$('.page-link, .doc-ref', ED.editor).forEach(n => {
    const t = S.docs[n.dataset.doc];
    const label = t ? docTitle(t) : 'Documento removido';
    if (n.classList.contains('doc-ref')) n.textContent = '↗ ' + label;
    else { const pt = $('.pl-title', n); if (pt) pt.textContent = label; }
    n.classList.toggle('missing', !t || !!t.deleted);
  });
}
function applyDocStyle(d) {
  const v = $('#doc-view'); if (!v) return;
  const s = d.style || {};
  v.style.setProperty('--doc-bg', s.bg || '');
  v.style.setProperty('--doc-paper', s.paper || '');
  v.style.setProperty('--doc-text', s.text || '');
  if (!s.bg) v.style.removeProperty('--doc-bg');
  if (!s.text) v.style.removeProperty('--doc-text');
  v.className = `doc-view ${s.paper ? 'has-paper' : ''} f-${s.font || 'default'} w-${s.width || 'normal'} sep-${s.sep || 'line'}`;
  const c = $('#doc-cover');
  c.hidden = !s.cover; c.style.background = s.cover || ''; if (s.cover) { c.style.backgroundSize = 'cover'; c.style.backgroundPosition = 'center'; }
}
function setDocStyle(patch) { const d = S.docs[ED.docId]; d.style = { ...d.style, ...patch }; d.updated = now(); applyDocStyle(d); persist(); renderPanel(); }

function flushEditor() {
  if (!ED) return;
  const d = S.docs[ED.docId]; if (!d) return;
  const title = ED.title.innerText.replace(/\n/g, ' ').trim();
  const html = ED.editor.innerHTML;
  if (d.title !== title || d.html !== html) {
    d.title = title; d.html = html; d.updated = now();
    snapshot(d); persist();
  }
}
function snapshot(d) {
  const list = S.backups[d.id] || (S.backups[d.id] = []);
  const last = list[list.length - 1];
  if (!last || now() - last.t > 4 * 60e3) { list.push({ t: now(), title: d.title, html: d.html }); if (list.length > 30) list.shift(); }
  else { last.title = d.title; last.html = d.html; last.t = now(); }
}
const commitSoon = debounce(() => {
  if (!ED) return;
  flushEditor();
  const d = S.docs[ED.docId];
  const tt = $('#tb-title'); if (tt) renderToolbar();
  const dpt = $('#dp-title'); if (dpt) { dpt.textContent = docTitle(d); $('#dp-sub').textContent = 'Atualizado ' + timeAgo(d.updated); }
  renderTabs(); document.title = docTitle(d) + ' — Notas';
  if (ui.dpTab !== 'search') renderDocPanelBody(); else runDocSearch();
  if (ui.panel === 'info') renderPanel();
}, 350);
function onEdit(immediate) {
  if (!ED) return;
  if (!ED.editor.firstElementChild) ED.editor.innerHTML = '<p><br></p>';
  normalizeEditor();
  setSaveStatus('saving');
  commitSoon();
  if (immediate) { flushEditor(); }
}

// o execCommand do Chrome às vezes gera <p><ul>…</ul></p>; desembrulha esses parágrafos
function normalizeEditor() {
  const bad = $$(':scope p:has(> ul, > ol, > p, > table, > pre, > h1, > h2, > h3, > blockquote)', ED.editor);
  if (!bad.length) return;
  const s = getSelection(), node = s.rangeCount ? s.anchorNode : null, off = s.anchorOffset;
  bad.forEach(p => p.replaceWith(...p.childNodes));
  if (node && ED.editor.contains(node)) { try { s.collapse(node, off); } catch { } }
}

/* ---- seleção ---- */
function selInEditor() { const s = getSelection(); return ED && s.rangeCount && ED.editor.contains(s.anchorNode); }
function restoreSel() {
  if (!ED || selInEditor()) return;
  ED.editor.focus({ preventScroll: true });
  const s = getSelection();
  if (savedRange && ED.editor.contains(savedRange.startContainer)) { s.removeAllRanges(); s.addRange(savedRange); }
  else placeCaret(ED.editor.lastElementChild || ED.editor, true);
}
function placeCaret(node, atEnd = false) {
  const r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function exec(cmd, val = null) { restoreSel(); document.execCommand(cmd, false, val); onEdit(); }
function currentBlock() {
  if (!selInEditor()) return null;
  const s = getSelection();
  let n = s.anchorNode;
  if (n === ED.editor) n = ED.editor.childNodes[Math.min(s.anchorOffset, ED.editor.childNodes.length - 1)];
  while (n && n.parentNode !== ED.editor) n = n.parentNode;
  if (n && n.nodeType === 3) { const p = document.createElement('p'); n.replaceWith(p); p.append(n); placeCaret(p, true); return p; }
  return n;
}
const closestInEditor = sel => { const s = getSelection(); if (!selInEditor()) return null; const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; const c = n.closest(sel); return c && ED.editor.contains(c) ? c : null; };
const isEmptyBlock = b => b && b.tagName === 'P' && !b.textContent.trim() && !b.querySelector('img');

/* ---- comandos de bloco ---- */
function setBlockTag(tag, cls) {
  restoreSel();
  const li = closestInEditor('li');
  if (li && tag !== 'p') { const list = li.parentElement; document.execCommand(list.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList'); }
  document.execCommand('formatBlock', false, tag);
  const b = currentBlock();
  if (b) { b.classList.remove('caption'); if (cls) b.classList.add(cls); if (!b.className) b.removeAttribute('class'); }
  onEdit();
}
function toggleChecklist() {
  restoreSel();
  const ul = closestInEditor('ul');
  if (ul && ul.classList.contains('checklist')) { document.execCommand('insertUnorderedList'); onEdit(); return; }
  if (ul) { ul.classList.add('checklist'); onEdit(); return; }
  if (closestInEditor('ol')) document.execCommand('insertOrderedList');
  document.execCommand('insertUnorderedList');
  const nu = closestInEditor('ul'); if (nu) nu.classList.add('checklist');
  onEdit();
}
function toggleList(kind) {
  restoreSel();
  const ul = closestInEditor('ul.checklist');
  if (ul && kind === 'ul') { ul.classList.remove('checklist'); ul.removeAttribute('class'); onEdit(); return; }
  if (ul) ul.classList.remove('checklist');
  document.execCommand(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList'); onEdit();
}
function toggleDeco(cls) {
  restoreSel();
  const b = currentBlock(); if (!b) return;
  const on = b.classList.contains(cls);
  b.classList.remove('deco-focus', 'deco-block');
  if (!on) b.classList.add(cls);
  if (!b.className) b.removeAttribute('class');
  onEdit(); renderPanel();
}
function insertBlockNode(node, focusSel) {
  restoreSel();
  const b = currentBlock();
  if (b && isEmptyBlock(b)) b.replaceWith(node);
  else if (b) b.after(node);
  else ED.editor.append(node);
  if (!node.nextElementSibling) node.after(el('<p><br></p>'));
  const target = focusSel ? $(focusSel, node) : node.nextElementSibling;
  if (target) placeCaret(target, false);
  onEdit(true);
  return node;
}
function insertCodeBlock() { insertBlockNode(el('<pre spellcheck="false"><code><br></code></pre>'), 'code'); }
function insertToggle() { insertBlockNode(el('<div class="toggle open"><div class="toggle-head">Alternância</div><div class="toggle-body"><p><br></p></div></div>'), '.toggle-head'); }
function insertTable(rows = 3, cols = 3) {
  const tr = () => `<tr>${'<td><br></td>'.repeat(cols)}</tr>`;
  insertBlockNode(el(`<table><tbody>${tr().repeat(rows)}</tbody></table>`), 'td');
}
function insertSubpage(card) {
  flushEditor();
  const parent = S.docs[ED.docId];
  const child = newDocObj({ parentId: parent.id, folderId: parent.folderId });
  S.docs[child.id] = child;
  insertBlockNode(el(`<div class="page-link ${card ? 'is-card' : ''}" contenteditable="false" data-doc="${child.id}"><span class="pl-ic">${ic(card ? 'card' : 'fileText')}</span><span class="pl-title">Documento Sem Título</span><span class="pl-arrow">›</span></div>`));
  flushEditor();
  go({ view: 'doc', id: child.id });
}
function turnIntoPage(card) {
  restoreSel();
  const b = currentBlock(); if (!b) return;
  const title = b.textContent.trim();
  flushEditor();
  const parent = S.docs[ED.docId];
  const child = newDocObj({ parentId: parent.id, folderId: parent.folderId, title, html: '<p><br></p>' });
  S.docs[child.id] = child;
  const link = el(`<div class="page-link ${card ? 'is-card' : ''}" contenteditable="false" data-doc="${child.id}"><span class="pl-ic">${ic(card ? 'card' : 'fileText')}</span><span class="pl-title"></span><span class="pl-arrow">›</span></div>`);
  $('.pl-title', link).textContent = title || 'Documento Sem Título';
  b.replaceWith(link);
  if (!link.nextElementSibling) link.after(el('<p><br></p>'));
  onEdit(true); toast(card ? 'Cartão criado' : 'Página criada');
}
function insertImageData(src) {
  insertBlockNode(el(`<figure class="img" contenteditable="false"><img src="${src}" alt=""></figure>`));
}
function insertAttachment(file, data) {
  const n = el(`<div class="attachment" contenteditable="false"><span class="att-ic">📎</span><span class="att-name"></span><span class="att-size">${fmtSize(file.size)}</span><a class="att-dl">Baixar</a></div>`);
  n.dataset.name = file.name; n.dataset.src = data;
  $('.att-name', n).textContent = file.name;
  insertBlockNode(n);
}
function pickFiles(accept, cb) {
  const inp = $('#file-input'); inp.value = ''; inp.accept = accept; inp.multiple = true;
  inp.onchange = () => { [...inp.files].forEach(cb); };
  inp.click();
}
async function handleFile(file) {
  if (file.size > 25 * 1048576) return toast('Arquivo muito grande (máx. 25 MB)');
  const data = await readFile(file);
  if (file.type.startsWith('image/')) insertImageData(data); else insertAttachment(file, data);
}
function insertDocLink() {
  const range = savedRange;
  quickOpen({
    placeholder: 'Vincular a qual documento?', docsOnly: true, onPick: d => {
      savedRange = range; restoreSel();
      document.execCommand('insertHTML', false, `<span class="doc-ref" contenteditable="false" data-doc="${d.id}">↗ ${esc(docTitle(d))}</span>&nbsp;`);
      onEdit(true);
    }
  });
}
function insertLink() {
  const range = savedRange;
  askText({ title: 'Inserir link', placeholder: 'https://…', value: '' }).then(url => {
    if (!url) return;
    if (!/^[a-z]+:/i.test(url)) url = 'https://' + url;
    savedRange = range; restoreSel();
    if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
    else document.execCommand('createLink', false, url);
    onEdit();
  });
}
function inlineCode() {
  restoreSel();
  const s = getSelection(); const txt = s.toString();
  const code = closestInEditor('code');
  if (code && !code.closest('pre')) { code.replaceWith(document.createTextNode(code.textContent)); onEdit(); return; }
  document.execCommand('insertHTML', false, `<code>${esc(txt || 'código')}</code>&#8203;`);
  onEdit();
}
function applyColor(cmd, color) {
  restoreSel();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(cmd, false, color);
  document.execCommand('styleWithCSS', false, false);
  onEdit();
}

const INSERT_GROUPS = [
  ['Básico', [
    { id: 'text', label: 'Texto', icon: 'T', kw: 'texto paragrafo corpo', run: () => setBlockTag('p') },
    { id: 'h1', label: 'Título', icon: 'H1', hint: '#', kw: 'titulo heading h1', run: () => setBlockTag('h1') },
    { id: 'h2', label: 'Subtítulo', icon: 'H2', hint: '##', kw: 'subtitulo h2', run: () => setBlockTag('h2') },
    { id: 'h3', label: 'Cabeçalho', icon: 'H3', hint: '###', kw: 'cabecalho h3', run: () => setBlockTag('h3') },
    { id: 'page', label: 'Página', icon: ic('fileText'), kw: 'pagina subpagina documento', run: () => insertSubpage(false) },
    { id: 'card', label: 'Cartão', icon: ic('card'), kw: 'cartao card', run: () => insertSubpage(true) },
  ]],
  ['Listas', [
    { id: 'todo', label: 'Lista de Tarefas', icon: ic('square'), hint: '[]', kw: 'tarefa todo checklist checkbox', run: toggleChecklist },
    { id: 'ul', label: 'Lista com Marcadores', icon: ic('list'), hint: '-', kw: 'lista marcadores bullet', run: () => toggleList('ul') },
    { id: 'ol', label: 'Lista Numerada', icon: ic('listOrdered'), hint: '1.', kw: 'lista numerada ordenada', run: () => toggleList('ol') },
    { id: 'toggle', label: 'Alternância', icon: ic('toggle'), kw: 'alternancia toggle recolher', run: insertToggle },
  ]],
  ['Blocos', [
    { id: 'quote', label: 'Citação', icon: ic('quote'), hint: '>', kw: 'citacao quote', run: () => setBlockTag('blockquote') },
    { id: 'callout', label: 'Destaque', icon: '💡', kw: 'destaque callout bloco', run: () => toggleDeco('deco-block') },
    { id: 'code', label: 'Bloco de Código', icon: ic('code'), hint: '```', kw: 'codigo code', run: insertCodeBlock },
    { id: 'divider', label: 'Divisor', icon: ic('minus'), hint: '---', kw: 'divisor linha separador hr', run: () => insertBlockNode(el('<hr>')) },
    { id: 'table', label: 'Tabela', icon: ic('table'), kw: 'tabela table', run: () => insertTable() },
  ]],
  ['Mídia', [
    { id: 'image', label: 'Imagem', icon: ic('image'), kw: 'imagem foto image', run: () => pickFiles('image/*', handleFile) },
    { id: 'file', label: 'Anexo de Arquivo', icon: ic('paperclip'), kw: 'anexo arquivo pdf', run: () => pickFiles('', handleFile) },
  ]],
  ['Conexões', [
    { id: 'doclink', label: 'Link para Documento', icon: ic('fileText'), hint: '[[', kw: 'link documento conexao referencia', run: insertDocLink },
    { id: 'link', label: 'Link Web', icon: ic('link'), kw: 'link url web', run: insertLink },
    { id: 'date', label: 'Data de Hoje', icon: ic('calendar'), kw: 'data hoje', run: () => exec('insertText', new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })) },
  ]],
];
const INSERT_ITEMS = INSERT_GROUPS.flatMap(g => g[1]);
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---- atalhos markdown ---- */
function handleMarkdown() {
  const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
  const b = currentBlock(); if (!b || b.tagName !== 'P') return false;
  const pre = document.createRange(); pre.setStart(b, 0); pre.setEnd(s.anchorNode, s.anchorOffset);
  const txt = pre.toString().replace(/ /g, ' ');
  const rules = [
    [/^# $/, () => setBlockTag('h1')], [/^## $/, () => setBlockTag('h2')], [/^### $/, () => setBlockTag('h3')],
    [/^[-*] $/, () => toggleList('ul')], [/^1[.)] $/, () => toggleList('ol')], [/^\[ ?\] $/, toggleChecklist],
    [/^\[x\] $/i, () => { toggleChecklist(); const li = closestInEditor('li'); if (li) setChecked(li, true); }],
    [/^> $/, () => setBlockTag('blockquote')], [/^``` $/, insertCodeBlock], [/^--- $/, () => insertBlockNode(el('<hr>'))],
  ];
  for (const [re, fn] of rules) {
    if (re.test(txt)) { s.removeAllRanges(); s.addRange(pre); document.execCommand('delete'); fn(); return true; }
  }
  return false;
}

/* ---- menu "/" ---- */
let slash = null;
function openSlash() {
  const s = getSelection(); if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (r.startContainer.nodeType !== 3) return;
  slash = { node: r.startContainer, offset: r.startOffset - 1, cur: 0, items: INSERT_ITEMS };
  const rect = r.getBoundingClientRect();
  const m = el('<div class="menu slash-menu" id="slash-menu"></div>');
  document.body.append(m);
  m.style.left = Math.min(rect.left, innerWidth - 290) + 'px';
  m.style.top = (rect.bottom + 6 + 330 > innerHeight ? rect.top - 336 : rect.bottom + 6) + 'px';
  m.addEventListener('mousedown', e => e.preventDefault());
  m.addEventListener('click', e => { const b = e.target.closest('[data-si]'); if (b) pickSlash(+b.dataset.si); });
  updateSlash();
}
function closeSlash() { slash = null; $('#slash-menu')?.remove(); }
function updateSlash() {
  if (!slash) return;
  const s = getSelection();
  if (!s.rangeCount || s.anchorNode !== slash.node || slash.node.data[slash.offset] !== '/' || s.anchorOffset <= slash.offset) return closeSlash();
  const q = norm(slash.node.data.slice(slash.offset + 1, s.anchorOffset));
  if (q.length > 24 || /\s{2}/.test(q)) return closeSlash();
  const rank = i => !q ? 0 : norm(i.label).startsWith(q) ? 0 : norm(i.label).includes(q) ? 1 : i.kw.split(' ').some(w => w.startsWith(q)) ? 2 : 3;
  slash.items = INSERT_ITEMS.filter(i => !q || norm(i.label).includes(q) || i.kw.includes(q)).sort((a, b) => rank(a) - rank(b));
  if (!slash.items.length) return closeSlash();
  slash.cur = Math.min(slash.cur, slash.items.length - 1);
  const m = $('#slash-menu');
  m.innerHTML = `<div class="mlabel">Inserir bloco</div>` + slash.items.map((i, k) => `<button class="ins-item ${k === slash.cur ? 'cur' : ''}" data-si="${k}"><span class="ins-ic">${i.icon}</span>${esc(i.label)}${i.hint ? `<span class="ins-hint">${esc(i.hint)}</span>` : ''}</button>`).join('');
  $('.cur', m)?.scrollIntoView({ block: 'nearest' });
}
function pickSlash(k) {
  const item = slash.items[k]; const s = getSelection();
  const r = document.createRange(); r.setStart(slash.node, slash.offset); r.setEnd(s.anchorNode, s.anchorOffset);
  closeSlash();
  s.removeAllRanges(); s.addRange(r); document.execCommand('delete');
  savedRange = s.getRangeAt(0).cloneRange();
  item.run();
}

/* ---- colar / soltar ---- */
const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'S', 'U', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'BR', 'HR', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'SPAN', 'DIV', 'FIGURE']);
function sanitize(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  $$('script,style,meta,link,title,iframe,object,svg', t.content).forEach(n => n.remove());
  $$('*', t.content).forEach(n => {
    if (!ALLOWED.has(n.tagName)) { n.replaceWith(...n.childNodes); return; }
    if (n.tagName === 'TH') { const td = document.createElement('td'); td.append(...n.childNodes); n.replaceWith(td); }
    for (const a of [...n.attributes]) {
      const keep = (a.name === 'href' && n.tagName === 'A' && /^https?:|^mailto:/i.test(a.value)) || (a.name === 'src' && n.tagName === 'IMG' && /^(https?:|data:image\/)/i.test(a.value))
        || a.name === 'data-checked' || a.name === 'data-doc' || (a.name === 'class' && /^(checklist|caption|deco-\w+|page-link.*|doc-ref|img.*|toggle.*|attachment)$/.test(a.value)) || a.name === 'contenteditable';
      if (!keep) n.removeAttribute(a.name);
    }
  });
  return t.innerHTML;
}

/* ---- eventos do editor ---- */
function bindEditor() {
  const { title, editor } = ED;
  title.addEventListener('input', () => onEdit());
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) { e.preventDefault(); editor.focus(); placeCaret(editor.firstElementChild || editor, false); }
  });
  title.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' ')); });

  editor.addEventListener('input', e => {
    if (e.inputType === 'insertText' && e.data === ' ' && handleMarkdown()) return;
    if (e.inputType === 'insertText' && e.data === '/' && !slash) openSlash();
    else if (slash) updateSlash();
    if (e.inputType === 'insertText' && e.data === '[') {
      const s = getSelection(), n = s.anchorNode;
      if (n.nodeType === 3 && n.data.slice(s.anchorOffset - 2, s.anchorOffset) === '[[') {
        const r = document.createRange(); r.setStart(n, s.anchorOffset - 2); r.setEnd(n, s.anchorOffset);
        s.removeAllRanges(); s.addRange(r); document.execCommand('delete'); savedRange = s.getRangeAt(0).cloneRange(); insertDocLink();
      }
    }
    onEdit();
  });

  editor.addEventListener('keydown', e => {
    if (slash) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); slash.cur = (slash.cur + (e.key === 'ArrowDown' ? 1 : -1) + slash.items.length) % slash.items.length; updateSlash(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickSlash(slash.cur); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { const li = closestInEditor('ul.checklist > li'); if (li) { e.preventDefault(); setChecked(li, li.dataset.checked !== 'true'); onEdit(); } return; }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); inlineCode(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); exec('strikeThrough'); return; }
    if (mod && e.key.toLowerCase() === 'u' && !e.shiftKey) { e.preventDefault(); exec('underline'); return; }
    if (mod && e.altKey && /^[0-3]$/.test(e.key)) { e.preventDefault(); setBlockTag(['p', 'h1', 'h2', 'h3'][+e.key]); return; }
    if (mod && e.shiftKey && e.key === '7') { e.preventDefault(); toggleList('ol'); return; }
    if (mod && e.shiftKey && e.key === '8') { e.preventDefault(); toggleList('ul'); return; }
    if (mod && e.shiftKey && e.key === '9') { e.preventDefault(); toggleChecklist(); return; }
    if (mod && e.key.toLowerCase() === 'k' && !getSelection().isCollapsed) { e.preventDefault(); e.stopPropagation(); insertLink(); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      const pre = closestInEditor('pre');
      if (pre) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
      const head = closestInEditor('.toggle-head');
      if (head) { e.preventDefault(); const body = head.nextElementSibling; head.parentElement.classList.add('open'); placeCaret(body.firstElementChild || body, false); return; }
      const li = closestInEditor('ul.checklist > li');
      if (li) setTimeout(() => { const n = closestInEditor('ul.checklist > li'); if (n && n !== li) delete n.dataset.checked; });
    }
    if (e.key === 'Tab') {
      const td = closestInEditor('td');
      if (td) {
        e.preventDefault();
        const cells = $$('td', td.closest('table')); let i = cells.indexOf(td) + (e.shiftKey ? -1 : 1);
        if (i >= cells.length) { const tr = td.parentElement.cloneNode(true); $$('td', tr).forEach(c => c.innerHTML = '<br>'); td.closest('tbody').append(tr); onEdit(); i = cells.length; }
        const next = $$('td', td.closest('table'))[Math.max(0, i)]; if (next) placeCaret(next, true);
        return;
      }
      if (closestInEditor('li')) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); return; }
      if (closestInEditor('pre')) { e.preventDefault(); document.execCommand('insertText', false, '  '); return; }
      e.preventDefault(); document.execCommand('insertText', false, '\t');
    }
    if (e.key === 'Backspace') {
      const b = currentBlock();
      if (b && /^H[1-4]$|^BLOCKQUOTE$/.test(b.tagName) && getSelection().isCollapsed && getSelection().anchorOffset === 0 && !b.textContent) { e.preventDefault(); setBlockTag('p'); }
    }
  });

  editor.addEventListener('click', e => {
    const pl = e.target.closest('.page-link, .doc-ref');
    if (pl) { e.preventDefault(); const d = S.docs[pl.dataset.doc]; if (!d) return toast('Este documento não existe mais'); if (d.deleted) return toast('Este documento está na lixeira'); return go({ view: 'doc', id: d.id }, { newTab: e.ctrlKey || e.metaKey || e.button === 1 }); }
    const dl = e.target.closest('.att-dl');
    if (dl) { const a = dl.closest('.attachment'); const x = document.createElement('a'); x.href = a.dataset.src; x.download = a.dataset.name; x.click(); return; }
    const li = e.target.closest('ul.checklist > li');
    if (li && e.clientX - li.getBoundingClientRect().left < 26 && e.target === li) { e.preventDefault(); setChecked(li, li.dataset.checked !== 'true'); onEdit(true); if (ui.dpTab === 'tasks') renderDocPanelBody(); return; }
    const th = e.target.closest('.toggle-head');
    if (th && e.clientX - th.getBoundingClientRect().left < 22) { th.parentElement.classList.toggle('open'); onEdit(); return; }
    const a = e.target.closest('a[href]');
    if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href, '_blank'); }
  });
  editor.addEventListener('auxclick', e => { const pl = e.target.closest('.page-link, .doc-ref'); if (pl && e.button === 1 && S.docs[pl.dataset.doc]) openTab({ view: 'doc', id: pl.dataset.doc }); });

  editor.addEventListener('contextmenu', e => {
    const fig = e.target.closest('figure.img');
    const td = e.target.closest('td');
    if (fig) {
      e.preventDefault();
      const set = c => { fig.classList.remove('s', 'm', 'left'); if (c) fig.classList.add(...c.split(' ')); onEdit(true); };
      showMenu(e.clientX, e.clientY, [
        { label: 'Pequena', icon: 'image', action: () => set('s') }, { label: 'Média', icon: 'image', action: () => set('m') },
        { label: 'Largura total', icon: 'image', action: () => set('') }, { label: 'Alinhar à esquerda', icon: 'alignLeft', action: () => fig.classList.toggle('left') || onEdit(true) },
        { sep: true }, { label: 'Baixar imagem', icon: 'download', action: () => { const a = document.createElement('a'); a.href = $('img', fig).src; a.download = 'imagem'; a.click(); } },
        { label: 'Remover imagem', icon: 'trash', danger: true, action: () => { fig.remove(); onEdit(true); } },
      ]);
    } else if (td) {
      e.preventDefault();
      const tr = td.parentElement, table = td.closest('table'), col = [...tr.children].indexOf(td);
      showMenu(e.clientX, e.clientY, [
        { label: 'Inserir linha abaixo', icon: 'plus', action: () => { const n = tr.cloneNode(true); $$('td', n).forEach(c => c.innerHTML = '<br>'); tr.after(n); onEdit(true); } },
        { label: 'Inserir coluna à direita', icon: 'plus', action: () => { $$('tr', table).forEach(r => r.children[col].after(el('<td><br></td>'))); onEdit(true); } },
        { sep: true },
        { label: 'Excluir linha', icon: 'minus', action: () => { tr.remove(); if (!$('tr', table)) table.remove(); onEdit(true); } },
        { label: 'Excluir coluna', icon: 'minus', action: () => { $$('tr', table).forEach(r => r.children[col]?.remove()); if (!$('td', table)) table.remove(); onEdit(true); } },
        { label: 'Excluir tabela', icon: 'trash', danger: true, action: () => { table.remove(); onEdit(true); } },
      ]);
    }
  });

  editor.addEventListener('paste', async e => {
    const files = [...e.clipboardData.files];
    if (files.length) { e.preventDefault(); for (const f of files) await handleFile(f); return; }
    if (closestInEditor('pre')) { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); return; }
    const html = e.clipboardData.getData('text/html');
    if (html) { e.preventDefault(); document.execCommand('insertHTML', false, sanitize(html)); onEdit(); }
  });
  editor.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  editor.addEventListener('drop', async e => {
    const files = [...e.dataTransfer.files]; if (!files.length) return;
    e.preventDefault();
    const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (pos) { const s = getSelection(); s.removeAllRanges(); s.addRange(pos); savedRange = pos.cloneRange(); }
    for (const f of files) await handleFile(f);
  });
  editor.addEventListener('blur', () => { setTimeout(() => { if (slash && !selInEditor()) closeSlash(); }, 150); });
}
document.execCommand('defaultParagraphSeparator', false, 'p');
document.addEventListener('selectionchange', () => {
  if (selInEditor()) { savedRange = getSelection().getRangeAt(0).cloneRange(); if (ui.panel === 'format') refreshFormatSoon(); }
});
const refreshFormatSoon = debounce(() => { if (ui.panel === 'format') renderPanel(); }, 120);

/* ---------------- painéis flutuantes (direita) ---------------- */
function renderPanel() {
  const p = $('#float-panel'); if (!p) return;
  $$('#float-tools [data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === ui.panel));
  if (!ui.panel || !ED) { p.hidden = true; return; }
  p.hidden = false;
  const d = S.docs[ED.docId];
  if (ui.panel === 'insert') {
    p.innerHTML = `<div class="fp-title">Inserir</div><div class="fp-sub">Clique para inserir onde está o cursor — ou digite <b>/</b> no texto</div>` +
      INSERT_GROUPS.map(([g, items]) => `<div class="fp-sec">${g}</div>` + items.map(i => `<button class="ins-item" data-ins="${i.id}"><span class="ins-ic">${i.icon}</span>${esc(i.label)}${i.hint ? `<span class="ins-hint">${esc(i.hint)}</span>` : ''}</button>`).join('')).join('');
  } else if (ui.panel === 'format') {
    const b = selInEditor() || savedRange ? (() => { try { return currentBlockFromRange(); } catch { return null; } })() : null;
    const tag = b?.tagName, isCap = b?.classList?.contains('caption');
    const q = c => { try { return document.queryCommandState(c); } catch { return false; } };
    const inList = savedRange && (savedRange.startContainer.nodeType === 1 ? savedRange.startContainer : savedRange.startContainer.parentElement)?.closest('ul,ol');
    const styles = [['h1', 'Título'], ['h2', 'Subtítulo'], ['h3', 'Cabeçalho'], ['h4', 'Forte'], ['p', 'Corpo'], ['caption', 'Legenda']];
    p.innerHTML = `<div class="fp-title">Formato</div>
      <div class="fp-sec">Texto</div>
      <div class="fmt-grid">${styles.map(([k, l]) => `<button data-fmt="${k}" class="${(k === 'caption' ? isCap : (tag === k.toUpperCase() && !isCap) || (k === 'p' && !isCap && tag === 'P')) ? 'on' : ''}" style="${k === 'h1' ? 'font-weight:800' : k === 'h2' ? 'font-weight:700' : k === 'h4' ? 'font-weight:750' : k === 'caption' ? 'font-size:11.5px;color:var(--muted)' : ''}">${l}</button>`).join('')}</div>
      <div class="fp-sec">Grupos</div>
      <div class="fmt-wide"><button data-fmt="topage">${ic('fileText')}Página</button><button data-fmt="tocard">${ic('card')}Cartão</button></div>
      <div class="fmt-row" style="margin-top:12px">
        <button data-fmt="bold" class="${q('bold') ? 'on' : ''}" title="Negrito (Ctrl+B)">${ic('bold')}</button>
        <button data-fmt="italic" class="${q('italic') ? 'on' : ''}" title="Itálico (Ctrl+I)">${ic('italic')}</button>
        <button data-fmt="underline" class="${q('underline') ? 'on' : ''}" title="Sublinhado (Ctrl+U)">${ic('underline')}</button>
        <button data-fmt="strike" class="${q('strikeThrough') ? 'on' : ''}" title="Tachado (Ctrl+Shift+X)">${ic('strike')}</button>
        <button data-fmt="code" title="Código (Ctrl+E)">${ic('code')}</button>
        <button data-fmt="link" title="Link (Ctrl+K com texto selecionado)">${ic('link')}</button></div>
      <div class="fmt-row">
        <button data-fmt="todo" class="${inList?.classList.contains('checklist') ? 'on' : ''}" title="Tarefa">${ic('square')}</button>
        <button data-fmt="toggle" title="Alternância">${ic('play')}</button>
        <button data-fmt="ul" class="${inList?.tagName === 'UL' && !inList.classList.contains('checklist') ? 'on' : ''}" title="Lista">${ic('list')}</button>
        <button data-fmt="ol" class="${inList?.tagName === 'OL' ? 'on' : ''}" title="Lista numerada">${ic('listOrdered')}</button></div>
      <div class="fmt-row">
        <button data-fmt="outdent" title="Diminuir recuo">${ic('outdent')}</button><button data-fmt="indent" title="Aumentar recuo">${ic('indent')}</button>
        <button data-fmt="justifyLeft" title="Alinhar à esquerda">${ic('alignLeft')}</button><button data-fmt="justifyCenter" title="Centralizar">${ic('alignCenter')}</button>
        <button data-fmt="justifyRight" title="Alinhar à direita">${ic('alignRight')}</button><button data-fmt="justifyFull" title="Justificar">${ic('alignJustify')}</button></div>
      <div class="fp-sec">Decorações</div>
      <div class="fmt-wide"><button data-fmt="deco-focus" class="${b?.classList?.contains('deco-focus') ? 'on' : ''}"><span style="width:3px;height:16px;background:currentColor;border-radius:2px"></span>Foco</button>
        <button data-fmt="deco-block" class="${b?.classList?.contains('deco-block') ? 'on' : ''}"><span style="padding:1px 8px;background:var(--active);border-radius:5px">Bloco</span></button></div>
      <div class="fp-sec">Cor do texto</div>
      <div class="swatches">${TEXT_COLORS.map(c => `<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('')}
        <label class="swatch rainbow" title="Cor personalizada"><input type="color" id="custom-color"></label></div>
      <div class="fp-sec">Realce</div>
      <div class="swatches">${HL_COLORS.map(c => `<button class="swatch" style="background:${c}" data-hl="${c}"></button>`).join('')}<button class="swatch none" data-hl="transparent" title="Sem realce"></button></div>
      <div style="margin-top:14px"><button class="btn" style="width:100%;justify-content:center" data-fmt="clear">${ic('eraser', 'sm')}Limpar formatação</button></div>`;
    const cc = $('#custom-color', p); cc.oninput = () => applyColor('foreColor', cc.value);
  } else if (ui.panel === 'style') {
    const s = d.style || {};
    p.innerHTML = `<div class="fp-title">Estilo</div>
      <div class="fp-sec">Temas</div>
      <div class="theme-grid">${DOC_THEMES.map(t => `<button class="theme-card ${(s.theme || 'original') === t.id ? 'on' : ''}" data-theme-id="${t.id}">
        <div class="tc-prev" style="background:${t.bg || 'var(--paper)'};color:${t.text || 'var(--text)'}">${t.paper ? `<span style="background:${t.paper};padding:4px 10px;border-radius:4px">Aa</span>` : 'Aa'}</div>${t.name}</button>`).join('')}</div>
      <div class="fp-sec">Cor</div>
      <div class="style-row">Plano de Fundo <label class="swatch" style="background:${s.bg || 'var(--paper)'}"><input type="color" data-stylecolor="bg" value="${toHex(s.bg) || '#232323'}"></label></div>
      <div class="style-row">Cor do Documento <span style="display:flex;gap:6px">${s.paper ? `<button class="btn" data-styleclear="paper" title="Remover">${ic('x', 'sm')}</button>` : ''}<label class="swatch" style="background:${s.paper || 'linear-gradient(135deg,#fff 50%,#222 50%)'}"><input type="color" data-stylecolor="paper" value="${toHex(s.paper) || '#ffffff'}"></label></span></div>
      <div class="style-row">Cor do Texto <label class="swatch" style="background:${s.text || 'linear-gradient(135deg,#222 50%,#fff 50%)'}"><input type="color" data-stylecolor="text" value="${toHex(s.text) || '#ececec'}"></label></div>
      <div class="fp-sec">Capa</div>
      <div class="cover-grid">${COVERS.map((c, i) => `<button class="cover-opt" style="background:${c}" data-cover="${i}"></button>`).join('')}</div>
      <div class="pill-row" style="margin-top:8px"><button data-action="cover-upload">${ic('image', 'sm')} Enviar imagem</button>${s.cover ? '<button data-cover="none">Remover capa</button>' : ''}</div>
      <div class="fp-sec">Estilo do separador</div>
      <div class="pill-row">${[['line', 'Linha'], ['dots', 'Pontos'], ['wave', 'Onda'], ['none', 'Nenhum']].map(([k, l]) => `<button class="${(s.sep || 'line') === k ? 'on' : ''}" data-sep="${k}">${l}</button>`).join('')}</div>
      <div class="fp-sec">Fonte</div>
      <div class="pill-row">${[['default', 'Padrão'], ['serif', 'Serifa'], ['mono', 'Mono'], ['rounded', 'Arredondada']].map(([k, l]) => `<button class="${(s.font || 'default') === k ? 'on' : ''}" data-font="${k}" style="font-family:var(--${k === 'default' ? 'font' : k})">${l}</button>`).join('')}</div>
      <div class="fp-sec">Largura da página</div>
      <div class="pill-row">${[['normal', 'Normal'], ['wide', 'Larga'], ['full', 'Total']].map(([k, l]) => `<button class="${(s.width || 'normal') === k ? 'on' : ''}" data-width="${k}">${l}</button>`).join('')}</div>
      <div style="margin-top:16px"><button class="btn" style="width:100%;justify-content:center" data-action="style-reset">Restaurar estilo original</button></div>`;
  } else if (ui.panel === 'info') {
    const text = ED.editor.innerText;
    const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    const bl = backlinks(d.id);
    const folder = S.folders.find(f => f.id === d.folderId);
    p.innerHTML = `<div class="fp-title">Informações da Página</div>
      <div class="fp-sec">Propriedades</div>
      <div class="info-row">${ic('calendar', 'sm')}Criado: <b>${timeAgo(d.created)}</b></div>
      <div class="info-row">${ic('clock', 'sm')}Atualizado: <b>${timeAgo(d.updated)}</b></div>
      <div class="info-row">${ic('user', 'sm')}Autor: <b>${esc(S.settings.author || S.settings.space)}</b></div>
      <div class="info-row">${ic('folder', 'sm')}Pasta: <b>${esc(folder ? folder.name : 'Não organizados')}</b></div>
      ${docTags(d).length ? `<div class="info-row">${ic('hash', 'sm')}Tags: <b>${docTags(d).map(t => '#' + esc(t)).join(' ')}</b></div>` : ''}
      <div class="fp-sec">Estatísticas</div>
      <div class="stats"><div class="stat"><b>${words}</b><span>palavras</span></div><div class="stat"><b>${text.replace(/\s/g, '').length}</b><span>caracteres</span></div><div class="stat"><b>${Math.max(1, Math.round(words / 200))} min</b><span>leitura</span></div></div>
      ${bl.length ? `<div class="fp-sec">Mencionado em</div>${bl.map(x => `<button class="act-item" data-open="${x.id}">${ic('link', 'sm')}${esc(docTitle(x))}</button>`).join('')}` : ''}
      <div class="fp-sec">Ações</div>
      <button class="act-item" data-doc-act="present">${ic('play', 'sm')}Apresentar</button>
      <button class="act-item" data-doc-act="move">${ic('move', 'sm')}Mover para…</button>
      <button class="act-item" data-doc-act="duplicate">${ic('copy', 'sm')}Duplicar</button>
      <button class="act-item" data-doc-act="favorite">${ic('star', 'sm' + (d.favorite ? ' fill fav-star' : ''))}${d.favorite ? 'Remover dos Favoritos' : 'Favoritar Documento'}</button>
      <button class="act-item" data-doc-act="template">${ic('template', 'sm')}Salvar como modelo</button>
      <button class="act-item" data-doc-act="backups">${ic('history', 'sm')}Visualizar Backups</button>
      <button class="act-item" data-doc-act="export-md">${ic('download', 'sm')}Exportar Markdown</button>
      <button class="act-item" data-doc-act="export-html">${ic('download', 'sm')}Exportar HTML</button>
      <button class="act-item" data-doc-act="print">${ic('fileText', 'sm')}Imprimir / PDF</button>
      <button class="act-item danger" data-doc-act="delete">${ic('trash', 'sm')}Excluir</button>`;
  }
  p.insertAdjacentHTML('afterbegin', `<button class="fp-close" data-panel-close title="Fechar">${ic('x', 'sm')}</button>`);
}
function currentBlockFromRange() {
  if (!savedRange || !ED) return null;
  let n = savedRange.startContainer;
  if (n === ED.editor) n = ED.editor.childNodes[Math.min(savedRange.startOffset, ED.editor.childNodes.length - 1)];
  while (n && n.parentNode !== ED.editor) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}
function toHex(c) { return c && /^#[0-9a-f]{6}$/i.test(c) ? c : ''; }

function handlePanelClick(e) {
  const t = e.target;
  if (t.closest('[data-panel-close]')) { ui.panel = null; return renderPanel(); }
  const ins = t.closest('[data-ins]'); if (ins) { INSERT_ITEMS.find(i => i.id === ins.dataset.ins).run(); return; }
  const f = t.closest('[data-fmt]');
  if (f) {
    const k = f.dataset.fmt;
    const map = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', indent: 'indent', outdent: 'outdent', justifyLeft: 'justifyLeft', justifyCenter: 'justifyCenter', justifyRight: 'justifyRight', justifyFull: 'justifyFull' };
    if (map[k]) exec(map[k]);
    else if (['h1', 'h2', 'h3', 'h4', 'p'].includes(k)) setBlockTag(k);
    else if (k === 'caption') setBlockTag('p', 'caption');
    else if (k === 'code') inlineCode();
    else if (k === 'link') insertLink();
    else if (k === 'todo') toggleChecklist();
    else if (k === 'toggle') insertToggle();
    else if (k === 'ul' || k === 'ol') toggleList(k);
    else if (k === 'topage' || k === 'tocard') turnIntoPage(k === 'tocard');
    else if (k.startsWith('deco-')) toggleDeco(k);
    else if (k === 'clear') { exec('removeFormat'); }
    renderPanel(); return;
  }
  const c = t.closest('[data-color]'); if (c) return applyColor('foreColor', c.dataset.color);
  const hl = t.closest('[data-hl]'); if (hl) return applyColor('hiliteColor', hl.dataset.hl);
  const th = t.closest('[data-theme-id]');
  if (th) { const x = DOC_THEMES.find(z => z.id === th.dataset.themeId); return setDocStyle({ theme: x.id, bg: x.bg || '', paper: x.paper || '', text: x.text || '' }); }
  const sc = t.closest('[data-styleclear]'); if (sc) return setDocStyle({ [sc.dataset.styleclear]: '' });
  const cv = t.closest('[data-cover]'); if (cv) return setDocStyle({ cover: cv.dataset.cover === 'none' ? '' : COVERS[+cv.dataset.cover] });
  const sp = t.closest('[data-sep]'); if (sp) return setDocStyle({ sep: sp.dataset.sep });
  const fo = t.closest('[data-font]'); if (fo) return setDocStyle({ font: fo.dataset.font });
  const wi = t.closest('[data-width]'); if (wi) return setDocStyle({ width: wi.dataset.width });
  const act = t.closest('[data-doc-act]'); if (act) return docAction(act.dataset.docAct, S.docs[ED.docId], act);
  const ga = t.closest('[data-action]'); if (ga) return globalAction(ga.dataset.action, ga, e);
  const op = t.closest('[data-open]'); if (op && S.docs[op.dataset.open]) return go({ view: 'doc', id: op.dataset.open });
}

/* ---------------- ações de documento ---------------- */
function createDoc(o = {}, opts = {}) {
  flushEditor();
  const d = newDocObj(o); S.docs[d.id] = d; persist();
  go({ view: 'doc', id: d.id }, opts);
  return d;
}
function docAction(a, d, anchor) {
  flushEditor();
  switch (a) {
    case 'open-tab': return openTab({ view: 'doc', id: d.id });
    case 'present': return present(d);
    case 'move': {
      const r = anchor.getBoundingClientRect();
      return showMenu(r.left, r.bottom + 4, [{ label: 'Mover para', header: true },
        ...S.folders.map(f => ({ label: `${f.icon || '📁'}  ${f.name}`, check: d.folderId === f.id, action: () => moveDoc(d, f.id) })),
        { label: '📥  Não organizados', check: !d.folderId, action: () => moveDoc(d, null) },
        { sep: true }, { label: 'Nova pasta…', icon: 'plus', action: async () => { const f = await newFolder(); if (f) moveDoc(d, f.id); } }]);
    }
    case 'duplicate': {
      const c = newDocObj({ ...structuredClone(d), id: uid(), title: docTitle(d) + ' (cópia)', created: now(), updated: now(), favorite: false, daily: null });
      S.docs[c.id] = c; persist(); toast('Documento duplicado'); return go({ view: 'doc', id: c.id });
    }
    case 'favorite': d.favorite = !d.favorite; persist(); renderSidebar(); renderPanel(); return toast(d.favorite ? 'Adicionado aos Favoritos' : 'Removido dos Favoritos');
    case 'template':
      S.templates.push({ id: uid(), own: true, title: docTitle(d), html: d.html, style: { ...d.style } });
      persist(); return toast('Salvo em Meus Modelos');
    case 'backups': return showBackups(d);
    case 'export-md': return download(safeName(docTitle(d)) + '.md', `# ${docTitle(d)}\n\n` + htmlToMd(d.html), 'text/markdown');
    case 'export-html': return download(safeName(docTitle(d)) + '.html', exportHtml(d), 'text/html');
    case 'print': ui.panel = null; renderPanel(); return setTimeout(() => print(), 50);
    case 'delete': return deleteDoc(d);
  }
}
function moveDoc(d, folderId) { d.folderId = folderId; persist(); render(); toast('Movido para ' + (S.folders.find(f => f.id === folderId)?.name || 'Não organizados')); }
function deleteDoc(d) {
  d.deleted = now(); d.favorite = false; persist();
  toast('Movido para a Lixeira', { label: 'Desfazer', action: () => { d.deleted = null; persist(); render(); } });
  if (tab().route.view === 'doc' && tab().route.id === d.id) { ED = null; back(); if (tab().route.view === 'doc' && tab().route.id === d.id) go({ view: 'all' }); }
  render();
}
function docContextMenu(d, x, y) {
  showMenu(x, y, [
    { label: 'Abrir', icon: 'fileText', action: () => go({ view: 'doc', id: d.id }) },
    { label: 'Abrir em nova aba', icon: 'external', action: () => openTab({ view: 'doc', id: d.id }) },
    { sep: true },
    { label: d.favorite ? 'Remover dos Favoritos' : 'Favoritar', icon: 'star', action: () => { d.favorite = !d.favorite; persist(); render(); } },
    { label: 'Mover para…', icon: 'move', action: () => setTimeout(() => showMenu(x + 10, y + 10, [...S.folders.map(f => ({ label: `${f.icon || '📁'}  ${f.name}`, check: d.folderId === f.id, action: () => moveDoc(d, f.id) })), { label: '📥  Não organizados', check: !d.folderId, action: () => moveDoc(d, null) }])) },
    { label: 'Duplicar', icon: 'copy', action: () => { const c = newDocObj({ ...structuredClone(d), id: uid(), title: docTitle(d) + ' (cópia)', created: now(), updated: now(), favorite: false, daily: null }); S.docs[c.id] = c; persist(); render(); } },
    { label: 'Exportar Markdown', icon: 'download', action: () => download(safeName(docTitle(d)) + '.md', `# ${docTitle(d)}\n\n` + htmlToMd(d.html)) },
    { sep: true },
    { label: 'Excluir', icon: 'trash', danger: true, action: () => deleteDoc(d) },
  ]);
}
async function newFolder() {
  const name = await askText({ title: 'Nova pasta', placeholder: 'Nome da pasta' });
  if (!name) return null;
  const f = { id: uid(), name, icon: '📁' }; S.folders.push(f); persist(); render(); return f;
}
function folderMenu(f, x, y) {
  showMenu(x, y, [
    { label: 'Abrir em nova aba', icon: 'external', action: () => openTab({ view: 'folder', id: f.id }) },
    { label: 'Renomear', icon: 'fileText', action: async () => { const n = await askText({ title: 'Renomear pasta', value: f.name }); if (n) { f.name = n; persist(); render(); } } },
    { label: 'Trocar ícone (emoji)', icon: 'palette', action: async () => { const n = await askText({ title: 'Ícone da pasta', value: f.icon, placeholder: 'Cole um emoji, ex.: 📚' }); if (n) { f.icon = [...n][0]; persist(); render(); } } },
    { sep: true },
    { label: 'Excluir pasta', icon: 'trash', danger: true, action: async () => {
      if (!await confirmBox(`Excluir a pasta "${f.name}"? Os documentos irão para "Não organizados".`, 'Excluir pasta')) return;
      liveDocs().forEach(d => { if (d.folderId === f.id) d.folderId = null; });
      S.folders = S.folders.filter(x => x !== f);
      if (tab().route.view === 'folder' && tab().route.id === f.id) tab().route = { view: 'all' };
      persist(); render();
    } },
  ]);
}

/* ---------------- apresentação, backups, exportação ---------------- */
function present(d) {
  ui.panel = null; renderPanel();
  const s = d.style || {};
  const o = el(`<div class="present" style="${s.bg ? `--doc-bg:${s.bg};` : ''}${s.text ? `--doc-text:${s.text}` : ''}">
    <button class="btn present-close">${ic('x', 'sm')} Sair (Esc)</button><div class="ed"></div></div>`);
  $('.ed', o).innerHTML = `<h1 class="dt"></h1>` + d.html.replace(/contenteditable="true"/g, '');
  $('.dt', o).textContent = docTitle(d);
  document.body.append(o);
  document.documentElement.requestFullscreen?.().catch(() => {});
  const close = () => { o.remove(); document.removeEventListener('keydown', key, true); if (document.fullscreenElement) document.exitFullscreen(); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', key, true);
  $('.present-close', o).onclick = close;
  document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement) { o.remove(); document.removeEventListener('fullscreenchange', f); } });
}
function showBackups(d) {
  const list = [...(S.backups[d.id] || [])].reverse();
  if (!list.length) return toast('Ainda não há backups deste documento');
  let cur = 0;
  const m = modal(`<div class="modal-head">Backups de "${esc(docTitle(d))}"</div>
    <div class="modal-body"><div class="backup-layout"><div class="backup-list"></div><div class="backup-prev ed"></div></div></div>
    <div class="modal-foot"><span class="sb-hint" style="margin-right:auto">Uma versão é guardada a cada ~4 minutos de edição (até 30).</span><button class="btn" data-x>Fechar</button><button class="btn primary" data-restore>Restaurar esta versão</button></div>`, { wide: true });
  const draw = () => {
    $('.backup-list', m.root).innerHTML = list.map((b, i) => `<button class="${i === cur ? 'cur' : ''}" data-i="${i}">${fmtDateTime(b.t)}<small>${timeAgo(b.t)} · ${esc(b.title || 'Sem título')}</small></button>`).join('');
    $('.backup-prev', m.root).innerHTML = `<h1>${esc(list[cur].title || 'Sem título')}</h1>` + list[cur].html.replace(/contenteditable="true"/g, '');
  };
  draw();
  $('.backup-list', m.root).onclick = e => { const b = e.target.closest('[data-i]'); if (b) { cur = +b.dataset.i; draw(); } };
  $('[data-x]', m.root).onclick = m.close;
  $('[data-restore]', m.root).onclick = () => {
    flushEditor();
    (S.backups[d.id] ||= []).push({ t: now(), title: d.title, html: d.html });
    d.title = list[cur].title; d.html = list[cur].html; d.updated = now();
    persist(); m.close(); render(); toast('Versão restaurada');
  };
}
function htmlToMd(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const inline = n => [...n.childNodes].map(c => {
    if (c.nodeType === 3) return c.data.replace(/​/g, '');
    if (c.nodeType !== 1) return '';
    const x = inline(c);
    switch (c.tagName) {
      case 'B': case 'STRONG': return x.trim() ? `**${x}**` : x;
      case 'I': case 'EM': return x.trim() ? `*${x}*` : x;
      case 'S': case 'STRIKE': case 'DEL': return `~~${x}~~`;
      case 'CODE': return '`' + c.textContent + '`';
      case 'A': return `[${x}](${c.getAttribute('href')})`;
      case 'BR': return '  \n';
      case 'IMG': return `![](${c.getAttribute('src')})`;
      default: return c.classList?.contains('doc-ref') ? `[[${c.textContent.replace(/^↗ /, '')}]]` : x;
    }
  }).join('');
  const block = (n, depth = 0) => [...n.children].map(c => {
    const ind = '  '.repeat(depth);
    switch (c.tagName) {
      case 'H1': return `## ${inline(c)}`; case 'H2': return `### ${inline(c)}`; case 'H3': return `#### ${inline(c)}`; case 'H4': return `**${inline(c)}**`;
      case 'BLOCKQUOTE': return inline(c).split('\n').map(l => '> ' + l).join('\n');
      case 'PRE': return '```\n' + c.textContent.replace(/\n$/, '') + '\n```';
      case 'HR': return '---';
      case 'UL': case 'OL': return [...c.children].map((li, i) => {
        const sub = [...li.children].filter(x => /^(UL|OL)$/.test(x.tagName));
        const clone = li.cloneNode(true); $$(':scope > ul, :scope > ol', clone).forEach(x => x.remove());
        const mark = c.classList.contains('checklist') ? `- [${li.dataset.checked === 'true' ? 'x' : ' '}] ` : c.tagName === 'OL' ? `${i + 1}. ` : '- ';
        return ind + mark + inline(clone).trim() + (sub.length ? '\n' + sub.map(s => block({ children: [s] }, depth + 1)).join('\n') : '');
      }).join('\n');
      case 'TABLE': { const rows = $$('tr', c).map(r => '| ' + $$('td', r).map(td => inline(td).replace(/\|/g, '\\|').trim()).join(' | ') + ' |'); if (rows.length) rows.splice(1, 0, '|' + ' --- |'.repeat($$('td', $('tr', c)).length)); return rows.join('\n'); }
      case 'FIGURE': return `![](${$('img', c)?.getAttribute('src') || ''})`;
      default:
        if (c.classList.contains('page-link')) return `📄 [[${c.textContent.replace('›', '').trim()}]]`;
        if (c.classList.contains('attachment')) return `📎 ${c.dataset.name}`;
        if (c.classList.contains('toggle')) return `**${inline(c.firstElementChild)}**\n\n` + block(c.lastElementChild, depth);
        return inline(c);
    }
  }).join('\n\n');
  return block(t.content).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function mdToHtml(md) {
  const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/!\[[^\]]*\]\(([^)]+)\)/g, '<img src="$1">').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  const lines = md.replace(/\r/g, '').split('\n'); const out = []; let list = null, code = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const l of lines) {
    if (code !== null) { if (/^```/.test(l)) { out.push(`<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`); code = null; } else code += l + '\n'; continue; }
    if (/^```/.test(l)) { closeList(); code = ''; continue; }
    let m;
    if ((m = l.match(/^\s*[-*] \[( |x)\] (.*)/i))) { if (list !== 'ul class="checklist"') { closeList(); out.push('<ul class="checklist">'); list = 'ul class="checklist"'; } out.push(`<li${m[1] !== ' ' ? ' data-checked="true"' : ''}>${inl(m[2])}</li>`); continue; }
    if ((m = l.match(/^\s*[-*+] (.*)/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    if ((m = l.match(/^\s*\d+[.)] (.*)/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    closeList();
    if ((m = l.match(/^(#{1,4}) (.*)/))) { out.push(`<h${Math.min(m[1].length, 4)}>${inl(m[2])}</h${Math.min(m[1].length, 4)}>`); continue; }
    if ((m = l.match(/^> ?(.*)/))) { out.push(`<blockquote>${inl(m[1])}</blockquote>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(l.trim())) { out.push('<hr>'); continue; }
    if (l.trim()) out.push(`<p>${inl(l)}</p>`);
  }
  closeList(); if (code !== null) out.push(`<pre><code>${esc(code)}</code></pre>`);
  return out.join('') || '<p><br></p>';
}
function exportHtml(d) {
  const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n');
  return `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>${esc(docTitle(d))}</title><style>${css}
body{overflow:auto;user-select:text;background:#fff}.ed{max-width:760px;margin:40px auto;padding:0 24px;font-size:16px;line-height:1.7}</style></head>
<body><div class="ed"><h1 style="font-size:34px">${esc(docTitle(d))}</h1>${d.html.replace(/contenteditable="true"/g, '')}</div></body></html>`;
}

/* ---------------- importação / backup ---------------- */
function importFiles() {
  const inp = $('#file-input'); inp.value = ''; inp.accept = '.md,.markdown,.txt,.html,.htm,.json'; inp.multiple = true;
  inp.onchange = async () => {
    let n = 0, last;
    for (const f of inp.files) {
      const text = await readFile(f, 'text');
      if (/\.json$/i.test(f.name)) { await importBackup(text); continue; }
      const base = f.name.replace(/\.[^.]+$/, '');
      let html, title = base;
      if (/\.html?$/i.test(f.name)) { const dd = new DOMParser().parseFromString(text, 'text/html'); title = dd.title || base; html = sanitize(dd.body.innerHTML); }
      else if (/\.(md|markdown)$/i.test(f.name)) { const m = text.match(/^#\s+(.+)\n/); if (m) title = m[1]; html = mdToHtml(m ? text.slice(m[0].length) : text); }
      else html = text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') || '<p><br></p>';
      const folderId = tab().route.view === 'folder' && tab().route.id !== 'none' ? tab().route.id : null;
      last = newDocObj({ title, html, folderId }); S.docs[last.id] = last; n++;
    }
    if (n) { persist(); render(); toast(`${n} documento${n > 1 ? 's' : ''} importado${n > 1 ? 's' : ''}`); }
  };
  inp.click();
}
async function importBackup(text) {
  let data; try { data = JSON.parse(text); } catch { return toast('Arquivo de backup inválido'); }
  if (!data || !data.docs) return toast('Arquivo de backup inválido');
  if (!await confirmBox('Mesclar este backup com seus dados atuais? Documentos com o mesmo ID serão substituídos pela versão do backup.', 'Importar backup')) return;
  Object.assign(S.docs, data.docs);
  for (const f of data.folders || []) if (!S.folders.some(x => x.id === f.id)) S.folders.push(f);
  for (const t of data.tasks || []) if (!S.tasks.some(x => x.id === t.id)) S.tasks.push(t);
  for (const t of data.templates || []) if (!S.templates.some(x => x.id === t.id)) S.templates.push(t);
  Object.assign(S.backups, data.backups || {});
  persist(); render(); toast('Backup importado');
}
function exportAll() {
  flushEditor();
  const { tabs, activeTab, ...data } = S;
  download(`notas-backup-${todayYmd()}.json`, JSON.stringify(data), 'application/json');
}

/* ---------------- abrir rápido (Ctrl+K) ---------------- */
function quickOpen(opts = {}) {
  closeOverlays();
  const cmds = opts.docsOnly ? [] : [
    { t: 'Novo documento', s: 'Alt+N', icon: 'filePlus', run: () => createDoc() },
    { t: 'Nova aba', s: 'Alt+T', icon: 'plus', run: () => openTab() },
    { t: 'Tarefas', s: 'Ver todas as tarefas', icon: 'checkCircle', run: () => go({ view: 'tasks' }) },
    { t: 'Calendário', s: 'Ver calendário', icon: 'calendar', run: () => go({ view: 'calendar' }) },
    { t: 'Nota de hoje', s: longDate(todayYmd()), icon: 'calendarDay', run: () => openDailyNote(todayYmd()) },
    { t: 'Alternar tema', s: 'Escuro / Claro / Sistema', icon: 'moon', run: cycleTheme },
    { t: 'Meus Modelos', s: 'Criar a partir de um modelo', icon: 'template', run: () => go({ view: 'templates' }) },
    { t: 'Exportar backup completo', s: 'Arquivo .json', icon: 'download', run: exportAll },
  ];
  const m = modal(`<div class="qo-wrap">${ic('search', 'lg')}<input class="qo-input" placeholder="${esc(opts.placeholder || 'Buscar documentos e comandos…')}"></div><div class="qo-list"></div>
    <div class="qo-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span>${opts.onPick ? '' : '<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> nova aba</span>'}<span><kbd>Esc</kbd> fechar</span></div>`);
  const input = $('.qo-input', m.root), listEl = $('.qo-list', m.root);
  let results = [], cur = 0;
  const draw = () => {
    const q = norm(input.value.trim());
    const docs = sortDocs(liveDocs().filter(d => d.id !== (opts.exclude || ED?.docId) || !opts.onPick))
      .map(d => { const tt = norm(docTitle(d)); const body = norm(docText(d)); const score = !q ? 1 : tt.startsWith(q) ? 3 : tt.includes(q) ? 2 : body.includes(q) ? 1 : 0; return { d, score, body }; })
      .filter(x => x.score).sort((a, b) => b.score - a.score).slice(0, q ? 30 : 8);
    const cm = cmds.filter(c => !q || norm(c.t).includes(q));
    results = [...docs.map(x => ({ type: 'doc', d: x.d, snip: q && x.score === 1 ? (() => { const i = x.body.indexOf(q); return '…' + docText(x.d).slice(Math.max(0, i - 30), i + 60) + '…'; })() : (S.folders.find(f => f.id === x.d.folderId)?.name || 'Não organizados') + ' · ' + timeAgo(x.d.updated) })), ...cm.map(c => ({ type: 'cmd', c }))];
    cur = Math.min(cur, Math.max(0, results.length - 1));
    let html = '', sec = '';
    results.forEach((r, i) => {
      const s = r.type === 'doc' ? (q ? 'Documentos' : 'Recentes') : 'Comandos';
      if (s !== sec) { html += `<div class="qo-sec">${s}</div>`; sec = s; }
      html += r.type === 'doc'
        ? `<button class="qo-item ${i === cur ? 'cur' : ''}" data-i="${i}">${ic('fileText', 'lg')}<span class="qo-main"><div class="qo-t">${esc(docTitle(r.d))}</div><div class="qo-s">${esc(r.snip)}</div></span></button>`
        : `<button class="qo-item ${i === cur ? 'cur' : ''}" data-i="${i}">${ic(r.c.icon, 'lg')}<span class="qo-main"><div class="qo-t">${esc(r.c.t)}</div><div class="qo-s">${esc(r.c.s)}</div></span></button>`;
    });
    listEl.innerHTML = html || '<div class="sb-hint" style="padding:16px">Nada encontrado.</div>';
    $('.cur', listEl)?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i, newTab) => {
    const r = results[i]; if (!r) return;
    m.close();
    if (r.type === 'cmd') return r.c.run();
    if (opts.onPick) return opts.onPick(r.d);
    go({ view: 'doc', id: r.d.id }, { newTab });
  };
  input.addEventListener('input', () => { cur = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); pick(cur, e.ctrlKey || e.metaKey); }
  });
  listEl.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i, e.ctrlKey || e.metaKey); });
  draw(); input.focus();
}

/* ---------------- menus, diálogos, toasts ---------------- */
function closeOverlays() { $$('.menu:not(#slash-menu)').forEach(m => m.remove()); }
function showMenu(x, y, items) {
  closeOverlays();
  const m = el('<div class="menu"></div>');
  m.innerHTML = items.map((it, i) => it.sep ? '<div class="sep"></div>' : it.header ? `<div class="mlabel">${esc(it.label)}</div>`
    : `<button class="${it.danger ? 'danger' : ''}" data-mi="${i}">${it.icon ? ic(it.icon, 'sm') : ''}<span>${esc(it.label)}</span>${it.check ? `<span class="mi-check">${ic('check', 'sm')}</span>` : ''}</button>`).join('');
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.addEventListener('mousedown', e => e.preventDefault());
  m.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (!b) return; m.remove(); items[+b.dataset.mi].action?.(); });
  setTimeout(() => {
    const off = e => { if (!m.contains(e.target)) { m.remove(); cleanup(); } };
    const esc_ = e => { if (e.key === 'Escape') { m.remove(); cleanup(); } };
    const cleanup = () => { document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', esc_, true); };
    document.addEventListener('mousedown', off, true); document.addEventListener('keydown', esc_, true);
  });
}
function modal(html, { wide = false, onClose } = {}) {
  const root = el(`<div class="backdrop"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`);
  $('#overlay-root').append(root);
  const close = () => { root.remove(); document.removeEventListener('keydown', key, true); onClose?.(); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  return { root, close };
}
function askText({ title, value = '', placeholder = '' }) {
  return new Promise(res => {
    let done = false;
    const m = modal(`<div class="modal-head">${esc(title)}</div><div class="modal-body"><input class="field" placeholder="${esc(placeholder)}"></div>
      <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn primary" data-ok>OK</button></div>`, { onClose: () => { if (!done) res(null); } });
    const inp = $('input', m.root); inp.value = value; inp.focus(); inp.select();
    const ok = () => { done = true; m.close(); res(inp.value.trim() || null); };
    $('[data-ok]', m.root).onclick = ok; $('[data-c]', m.root).onclick = () => m.close();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
function confirmBox(msg, okLabel = 'Confirmar') {
  return new Promise(res => {
    let done = false;
    const m = modal(`<div class="modal-head">Confirmar</div><div class="modal-body" style="color:var(--text-2)">${esc(msg)}</div>
      <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn primary" data-ok>${esc(okLabel)}</button></div>`, { onClose: () => { if (!done) res(false); } });
    $('[data-ok]', m.root).onclick = () => { done = true; m.close(); res(true); };
    $('[data-c]', m.root).onclick = () => m.close();
    $('[data-ok]', m.root).focus();
  });
}
let toastTimer;
function toast(msg, action) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const t = el(`<div class="toast"><span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}</div>`);
  if (action) $('button', t).onclick = () => { t.remove(); action.action(); };
  document.body.append(t);
  toastTimer = setTimeout(() => t.remove(), action ? 6000 : 2200);
}
function showHelp() {
  const k = s => s.split('+').map(x => `<kbd>${x}</kbd>`).join('+');
  const rows = [
    ['Geral'], ['Abrir documento / comando', 'Ctrl+K'], ['Novo documento', 'Alt+N'], ['Nova aba', 'Alt+T'], ['Fechar aba', 'Alt+W'], ['Ir para a aba 1–9', 'Alt+1…9'],
    ['Voltar', 'Alt+←'], ['Mostrar/ocultar barra lateral', 'Ctrl+\\'], ['Alternar tema', 'Ctrl+Shift+L'], ['Buscar no documento', 'Ctrl+F'],
    ['Editor'], ['Inserir bloco', '/'], ['Vincular documento', '[['], ['Título / Subtítulo / Cabeçalho', 'Ctrl+Alt+1/2/3'], ['Texto normal', 'Ctrl+Alt+0'],
    ['Negrito / Itálico / Sublinhado', 'Ctrl+B / I / U'], ['Tachado', 'Ctrl+Shift+X'], ['Código em linha', 'Ctrl+E'], ['Link (texto selecionado)', 'Ctrl+K'],
    ['Lista numerada / marcadores / tarefas', 'Ctrl+Shift+7/8/9'], ['Marcar tarefa', 'Ctrl+Enter'], ['Recuar item de lista', 'Tab / Shift+Tab'],
    ['Markdown'], ['# ## ###', 'títulos'], ['- ou *', 'lista'], ['1.', 'lista numerada'], ['[] ou [x]', 'tarefa'], ['>', 'citação'], ['```', 'código'], ['---', 'divisor'], ['@25/10 numa tarefa', 'define data'],
  ];
  const m = modal(`<div class="modal-head">Atalhos do Notas</div><div class="modal-body"><div class="help-grid">${rows.map(r => r.length === 1 ? `<div class="h">${r[0]}</div>` : `<span>${esc(r[0])}</span><span>${/[+\/…]/.test(r[1]) && !r[1].includes(' ') || /^(Ctrl|Alt)/.test(r[1]) ? k(r[1]) : `<kbd>${esc(r[1])}</kbd>`}</span>`).join('')}</div></div>
    <div class="modal-foot"><span class="sb-hint" style="margin-right:auto">Seus dados ficam salvos apenas neste computador. Faça backups em ⤓ na barra lateral.</span><button class="btn primary" data-x>Fechar</button></div>`);
  $('[data-x]', m.root).onclick = m.close;
}
function spaceMenu(x, y) {
  showMenu(x, y, [
    { label: 'Renomear espaço', icon: 'fileText', action: async () => { const n = await askText({ title: 'Nome do espaço', value: S.settings.space }); if (n) { S.settings.space = n; persist(); render(); } } },
    { label: 'Nome do autor', icon: 'user', action: async () => { const n = await askText({ title: 'Seu nome (autor dos documentos)', value: S.settings.author }); if (n !== null) { S.settings.author = n; persist(); } } },
    { sep: true }, { label: 'Tema', header: true },
    ...[['dark', 'Escuro', 'moon'], ['light', 'Claro', 'sun'], ['system', 'Sistema', 'monitor']].map(([k, l, i]) => ({ label: l, icon: i, check: S.settings.theme === k, action: () => { S.settings.theme = k; applyTheme(); persist(); renderToolbar(); } })),
    { sep: true },
    { label: 'Importar arquivos…', icon: 'upload', action: importFiles },
    { label: 'Exportar backup completo', icon: 'download', action: exportAll },
    { label: 'Atalhos de teclado', icon: 'help', action: showHelp },
  ]);
}

/* =====================================================================
   EVENTOS GLOBAIS
   ===================================================================== */
function bindGlobal() {
  // abas
  const tabs = $('#tabs');
  tabs.addEventListener('click', e => {
    const c = e.target.closest('[data-close]'); if (c) { e.stopPropagation(); return closeTab(c.dataset.close); }
    const t = e.target.closest('[data-tab]'); if (t) return activateTab(t.dataset.tab);
    if (e.target.closest('[data-action="new-tab"]')) openTab();
  });
  tabs.addEventListener('auxclick', e => { const t = e.target.closest('[data-tab]'); if (t && e.button === 1) closeTab(t.dataset.tab); });
  tabs.addEventListener('dblclick', e => { if (e.target === tabs) openTab(); });
  let dragTab = null;
  tabs.addEventListener('dragstart', e => { const t = e.target.closest('[data-tab]'); if (t) { dragTab = t.dataset.tab; e.dataTransfer.effectAllowed = 'move'; } });
  tabs.addEventListener('dragover', e => { const t = e.target.closest('[data-tab]'); if (dragTab && t) { e.preventDefault(); $$('.tab', tabs).forEach(x => x.classList.toggle('drop-target', x === t)); } });
  tabs.addEventListener('drop', e => {
    const t = e.target.closest('[data-tab]'); if (!dragTab || !t) return; e.preventDefault();
    const from = S.tabs.findIndex(x => x.id === dragTab), to = S.tabs.findIndex(x => x.id === t.dataset.tab);
    const [mv] = S.tabs.splice(from, 1); S.tabs.splice(to, 0, mv); dragTab = null; persist(); renderTabs();
  });
  tabs.addEventListener('dragend', () => { dragTab = null; $$('.tab', tabs).forEach(x => x.classList.remove('drop-target')); });

  // clique genérico (barra, lateral, principal)
  document.addEventListener('click', e => {
    if (e.target.closest('#float-panel')) return handlePanelClick(e);
    if (e.target.closest('#editor, .menu, .modal, #tabs')) return;
    const t = e.target;
    const fp = t.closest('[data-panel]');
    if (fp) { ui.panel = ui.panel === fp.dataset.panel ? null : fp.dataset.panel; return renderPanel(); }
    const a = t.closest('[data-action]');
    if (a) return globalAction(a.dataset.action, a, e);
    const op = t.closest('[data-open]');
    if (op && S.docs[op.dataset.open]) return go({ view: 'doc', id: op.dataset.open }, { newTab: e.ctrlKey || e.metaKey });
    const rt = t.closest('[data-route]');
    if (rt) return go(JSON.parse(rt.dataset.route), { newTab: e.ctrlKey || e.metaKey });
    const dpm = t.closest('[data-dpmode]'); if (dpm) { ui.docPanel = dpm.dataset.dpmode; return renderSidebar(); }
    const dpt = t.closest('[data-dptab]');
    if (dpt) { ui.dpTab = dpt.dataset.dptab; renderSidebar(); if (ui.dpTab === 'search') $('#dp-search')?.focus(); else { CSS.highlights?.delete('search'); CSS.highlights?.delete('search-cur'); } return; }
    const sv = t.closest('[data-setview]'); if (sv) { S.settings.view = sv.dataset.setview; persist(); return renderMain(); }
    const cal = t.closest('[data-cal]');
    if (cal) { const d = +cal.dataset.cal; if (!d) { const n = new Date(); ui.calMonth = { y: n.getFullYear(), m: n.getMonth() }; ui.calSel = todayYmd(); } else { const n = new Date(ui.calMonth.y, ui.calMonth.m + d, 1); ui.calMonth = { y: n.getFullYear(), m: n.getMonth() }; } return renderMain(); }
    const day = t.closest('[data-day]'); if (day) { ui.calSel = day.dataset.day; return renderMain(); }
    const tpl = t.closest('[data-tpl]'); if (tpl) return useTemplate(tpl.dataset.tpl);
    const rs = t.closest('[data-restore]'); if (rs) { S.docs[rs.dataset.restore].deleted = null; persist(); render(); return toast('Documento restaurado'); }
    const pg = t.closest('[data-purge]');
    if (pg) return confirmBox('Excluir este documento permanentemente? Não é possível desfazer.', 'Excluir').then(ok => { if (ok) { delete S.docs[pg.dataset.purge]; delete S.backups[pg.dataset.purge]; persist(); render(); } });
    // tarefas
    const tt = t.closest('[data-ttoggle]');
    if (tt) { const task = findTaskFromEl(tt); if (task) { toggleTask(task); setTimeout(() => { renderMain(); renderSidebar(); }, 120); tt.classList.toggle('on'); } return; }
    const td = t.closest('[data-tdel]'); if (td) { const task = findTaskFromEl(td); S.tasks = S.tasks.filter(x => x.id !== task.id); persist(); renderMain(); renderSidebar(); return; }
    const tdt = t.closest('[data-tdate]');
    if (tdt && tdt.dataset.tdate) {
      const task = S.tasks.find(x => x.id === tdt.dataset.tdate); if (!task) return;
      const inp = el(`<input type="date" class="ti-date-in" value="${task.date || ''}">`); tdt.append(inp);
      inp.onchange = () => { task.date = inp.value || null; persist(); renderMain(); renderSidebar(); };
      inp.showPicker?.(); return;
    }
    const tb = t.closest('.crumb'); if (tb) return;
  });
  document.addEventListener('mousedown', e => {
    if (e.target.closest('#float-panel, #float-tools') && !e.target.closest('input')) e.preventDefault();
  });
  document.addEventListener('focusout', e => {
    if (e.target.matches?.('[data-tedit]')) {
      const task = findTaskFromEl(e.target); const v = e.target.textContent.trim();
      if (task && v && v !== task.ref.text) { task.ref.text = v; persist(); }
      if (task && !v) { S.tasks = S.tasks.filter(x => x.id !== task.id); persist(); renderMain(); }
    }
  });
  document.addEventListener('keydown', e => { if (e.target.matches?.('[data-tedit]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  document.addEventListener('input', e => { if (e.target.id === 'dp-search') { ui.search = e.target.value; runDocSearch(); } });

  // menus de contexto
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('#editor, input, [contenteditable]')) return;
    const dc = e.target.closest('[data-docctx]'); if (dc) { e.preventDefault(); return docContextMenu(S.docs[dc.dataset.docctx], e.clientX, e.clientY); }
    const fav = e.target.closest('#sidebar [data-open]'); if (fav) { e.preventDefault(); return docContextMenu(S.docs[fav.dataset.open], e.clientX, e.clientY); }
    const fo = e.target.closest('[data-folder]'); if (fo && fo.dataset.folder !== 'none') { e.preventDefault(); return folderMenu(S.folders.find(f => f.id === fo.dataset.folder), e.clientX, e.clientY); }
    const tp = e.target.closest('[data-tplctx]');
    if (tp) { e.preventDefault(); return showMenu(e.clientX, e.clientY, [{ label: 'Excluir modelo', icon: 'trash', danger: true, action: () => { S.templates = S.templates.filter(x => x.id !== tp.dataset.tplctx); persist(); render(); } }]); }
    const tb = e.target.closest('[data-tab]');
    if (tb) { e.preventDefault(); return showMenu(e.clientX, e.clientY, [
      { label: 'Nova aba', icon: 'plus', action: () => openTab() },
      { label: 'Duplicar aba', icon: 'copy', action: () => openTab({ ...S.tabs.find(x => x.id === tb.dataset.tab).route }) },
      { label: 'Fechar outras abas', icon: 'x', action: () => { flushEditor(); S.tabs = S.tabs.filter(x => x.id === tb.dataset.tab); S.activeTab = tb.dataset.tab; persist(); render(); } },
      { label: 'Fechar aba', icon: 'x', action: () => closeTab(tb.dataset.tab) }]); }
  });

  // arrastar documentos para pastas
  document.addEventListener('dragstart', e => { const d = e.target.closest?.('[data-docctx]'); if (d) { e.dataTransfer.setData('text/x-doc', d.dataset.docctx); e.dataTransfer.effectAllowed = 'move'; } });
  document.addEventListener('dragover', e => {
    const f = e.target.closest?.('#sidebar [data-folder], #sidebar [data-route*="trash"]');
    $$('#sidebar .drop-target').forEach(x => x !== f && x.classList.remove('drop-target'));
    if (f && e.dataTransfer.types.includes('text/x-doc')) { e.preventDefault(); f.classList.add('drop-target'); }
  });
  document.addEventListener('drop', e => {
    const f = e.target.closest?.('#sidebar [data-folder], #sidebar [data-route*="trash"]');
    $$('#sidebar .drop-target').forEach(x => x.classList.remove('drop-target'));
    const id = e.dataTransfer.getData('text/x-doc'); if (!f || !id) return;
    e.preventDefault();
    if (f.dataset.folder) moveDoc(S.docs[id], f.dataset.folder === 'none' ? null : f.dataset.folder);
    else deleteDoc(S.docs[id]);
  });

  // teclado global
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && (k === 'k' || k === 'p') && !e.shiftKey) { e.preventDefault(); return quickOpen(); }
    if (e.altKey && !mod && k === 'n') { e.preventDefault(); return createDoc(newDocDefaults()); }
    if (e.altKey && !mod && k === 't') { e.preventDefault(); return openTab(); }
    if (e.altKey && !mod && k === 'w') { e.preventDefault(); return closeTab(S.activeTab); }
    if (e.altKey && !mod && /^[1-9]$/.test(e.key)) { e.preventDefault(); const t = S.tabs[Math.min(+e.key, S.tabs.length) - 1]; return t && activateTab(t.id); }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return back(); }
    if (mod && e.key === '\\') { e.preventDefault(); S.settings.sidebar = !S.settings.sidebar; persist(); return render(); }
    if (mod && e.shiftKey && k === 'l') { e.preventDefault(); return cycleTheme(); }
    if (mod && k === 'f' && ED) { e.preventDefault(); ui.docPanel = 'doc'; ui.dpTab = 'search'; S.settings.sidebar = true; render(); const s = $('#dp-search'); s?.focus(); s?.select(); return; }
    if (mod && k === 's') { e.preventDefault(); flushEditor(); saveNow(); return toast('Salvo automaticamente ✓'); }
    if (e.key === 'Escape' && ui.panel) { ui.panel = null; renderPanel(); }
  });

  // salvar ao sair / atualizar tempos relativos
  window.addEventListener('beforeunload', () => { flushEditor(); Store.set('state', S); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flushEditor(); saveNow(); } });
  setInterval(() => { if (!ED && !document.hidden && !$('.backdrop') && !$('.menu') && !document.activeElement?.matches('input,[contenteditable]')) renderMain(); }, 60000);
}
function newDocDefaults() {
  const r = tab().route;
  return r.view === 'folder' && r.id !== 'none' ? { folderId: r.id } : {};
}
function globalAction(a, node, e) {
  switch (a) {
    case 'new-tab': return openTab();
    case 'new-doc': return createDoc({}, { newTab: e.ctrlKey });
    case 'new-doc-here': { const r = tab().route; return createDoc(r.view === 'folder' && r.id !== 'none' ? { folderId: r.id } : r.view === 'favorites' ? { favorite: true } : {}); }
    case 'quick-open': return quickOpen();
    case 'back': return back();
    case 'toggle-sidebar':
      if (isMobile()) return document.body.classList.toggle('drawer-open');
      S.settings.sidebar = !S.settings.sidebar; persist(); return render();
    case 'close-drawer': return closeDrawer();
    case 'theme': return cycleTheme();
    case 'help': return showHelp();
    case 'new-folder': return newFolder();
    case 'import': return importFiles();
    case 'export-all': return exportAll();
    case 'space-menu': { const r = node.getBoundingClientRect(); return spaceMenu(r.left, r.bottom + 4); }
    case 'sort-menu': {
      const r = node.getBoundingClientRect();
      return showMenu(r.right - 220, r.bottom + 4, [{ label: 'Ordenar por', header: true },
        ...[['updated', 'Última atualização'], ['created', 'Data de criação'], ['title', 'Título (A–Z)']].map(([k, l]) => ({ label: l, check: S.settings.sort === k, action: () => { S.settings.sort = k; persist(); renderMain(); } }))]);
    }
    case 'daily-note': return openDailyNote(ui.calSel);
    case 'empty-trash':
      return confirmBox('Excluir permanentemente todos os documentos da lixeira?', 'Esvaziar').then(ok => {
        if (!ok) return; for (const d of Object.values(S.docs)) if (d.deleted) { delete S.docs[d.id]; delete S.backups[d.id]; } persist(); render();
      });
    case 'cover-upload':
      return pickFiles('image/*', async f => { const data = await readFile(f); setDocStyle({ cover: `url("${data}")` }); });
    case 'style-reset': return setDocStyle({ theme: 'original', bg: '', paper: '', text: '', cover: '', font: 'default', width: 'normal', sep: 'line' });
  }
}
document.addEventListener('change', e => {
  const sc = e.target.closest?.('[data-stylecolor]');
  if (sc && ED) setDocStyle({ [sc.dataset.stylecolor]: sc.value, theme: 'custom' });
});

/* ---------------- toque (iPhone) ---------------- */
function bindTouch() {
  // tocar e segurar = clique direito (o Safari do iOS não dispara "contextmenu")
  let timer = null, start = null, fired = false;
  document.addEventListener('touchstart', e => {
    fired = false;
    const t = e.touches.length === 1 && e.target.closest('[data-docctx], #sidebar [data-open], [data-folder], [data-tplctx], #editor figure.img, #editor td');
    if (!t) return;
    const p = e.touches[0]; start = { x: p.clientX, y: p.clientY };
    timer = setTimeout(() => {
      timer = null; fired = true; navigator.vibrate?.(10);
      e.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: start.x, clientY: start.y }));
    }, 480);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!timer) return;
    const p = e.touches[0];
    if (Math.hypot(p.clientX - start.x, p.clientY - start.y) > 10) { clearTimeout(timer); timer = null; }
  }, { passive: true });
  document.addEventListener('touchend', e => { clearTimeout(timer); timer = null; if (fired) { e.preventDefault(); fired = false; } });
  document.addEventListener('touchcancel', () => { clearTimeout(timer); timer = null; });

  // mantém a barra de ferramentas e os painéis acima do teclado
  const vv = window.visualViewport;
  if (vv) {
    const upd = () => document.documentElement.style.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px');
    vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd);
  }
}

/* ---------------- inicialização ---------------- */
(async function boot() {
  await Store.init();
  try { S = await Store.get('state'); } catch (e) { console.error(e); }
  if (!S || !S.docs) S = defaultState();
  S.settings = { ...defaultState().settings, ...S.settings };
  S.backups ||= {}; S.templates ||= []; S.tasks ||= []; S.folders ||= [];
  if (!S.tabs?.length) { const t = newTabObj(); S.tabs = [t]; S.activeTab = t.id; }
  S.tabs.forEach(t => t.history ||= []);
  bindGlobal();
  bindTouch();
  render();
  setSaveStatus('saved');
  // modo offline e armazenamento persistente (só quando servido por http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  navigator.storage?.persist?.().catch(() => {});
})();
