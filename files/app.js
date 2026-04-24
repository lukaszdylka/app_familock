// ════════════════════════════════════════════════════════════════
//  FAMILOCK - APPLICATION LOGIC
//  Complete escape room management system
// ════════════════════════════════════════════════════════════════

console.log('🎮 Familock app.js loading...');

// ── Auth Wall Functions ──
window.handleAuthLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('auth-login-error');
  
  if (!email || !password) {
    errorEl.textContent = 'Podaj email i hasło';
    return;
  }
  
  try {
    if (!window.supabaseClient) {
      errorEl.textContent = 'Supabase nie załadowany - odśwież stronę';
      return;
    }
    
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Login successful - will be handled by auth listener
    console.log('✅ Logged in:', data.user.email);
    
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = error.message || 'Błąd logowania';
  }
};

window.showApp = function() {
  console.log('✅ Showing app (user logged in)');
  document.getElementById('auth-wall').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
};

window.hideApp = function() {
  console.log('🔒 Hiding app (user logged out)');
  document.getElementById('auth-wall').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
};

// ── Constants ──
const LOCKED = {
  rate: 849.67,
  months: 6,
  label: 'lip–gru 2023'
};
const LOCKED_TOTAL = LOCKED.rate * LOCKED.months;

// ── Default data structure ──
const DEF = {
  rentPeriods: [
    { id: 1, rate: 1489.24, months: 27, label: 'sty 2024 – mar 2026' }
  ],
  utilities: [
    {
      id: 10,
      emoji: '⚡',
      name: 'Prąd',
      entries: [
        { id: 101, type: 'period', label: 'lip–gru 2023', rate: 280, months: 6 },
        { id: 102, type: 'period', label: 'sty 2024 – mar 2026', rate: 243.95, months: 27 }
      ]
    },
    {
      id: 11,
      emoji: '🌐',
      name: 'Internet',
      entries: []
    }
  ],
  remont: [
    { id: 201, name: 'Ekspertyza i rzeczoznawca', amount: 19500 },
    { id: 202, name: 'Zabudowa sufitu i robocizna', amount: 4000 },
    { id: 203, name: 'Elektryk – projekt', amount: 1230 },
    { id: 204, name: 'Materiały plus wykonanie', amount: 29483.10 }
  ],
  zakupy: [],
  otc: [], // Legacy - kept for backward compatibility
  sessions: [],
  tasks: [],
  settings: {
    avgGame: 220,
    targetSessions: 20,
    name: 'Familock',
    loc: ''
  }
};

// ── Global state ──
let S;

// ── Load data from localStorage ──
try {
  const saved = localStorage.getItem('fl4');
  if (saved) {
    S = JSON.parse(saved);
    
    // Migration: old otc → new remont/zakupy
    if (S.otc && S.otc.length > 0 && (!S.remont || S.remont.length === 0)) {
      console.log('📦 Migrating otc to remont...');
      S.remont = S.otc;
      S.zakupy = [];
      // Keep otc for backward compatibility but empty it
      S.otc = [];
    }
    
    // Ensure new arrays exist
    if (!S.remont) S.remont = [];
    if (!S.zakupy) S.zakupy = [];
    if (!S.otc) S.otc = [];
    
    // Ensure tasks array exists
    if (!S.tasks) S.tasks = [];
    console.log('✓ Data loaded:', S.sessions?.length || 0, 'sessions');
  } else {
    S = JSON.parse(JSON.stringify(DEF));
    console.log('✓ Using default data');
  }
} catch (err) {
  console.error('❌ Error loading data:', err);
  S = JSON.parse(JSON.stringify(DEF));
}

// ── Helper functions ──
const $ = (id) => document.getElementById(id);
const fmtPLN = (v, d = 0) => 
  (Number(v) || 0).toLocaleString('pl-PL', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  }) + ' zł';
const ceil = (v) => Math.ceil(Number(v) || 0).toLocaleString('pl-PL');
const esc = (s) => 
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
const uid = () => Date.now() + Math.floor(Math.random() * 999);

// Month names
const MO = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const fmtYM = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MO[+m - 1]} ${y}`;
};
const thisYM = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

const set = (id, v) => {
  const e = $(id);
  if (e) e.textContent = v;
};

// ── Toast notifications ──
function toast(msg, type = 'ok') {
  const el = $('toast');
  if (!el) return;
  
  el.textContent = (type === 'ok' ? '✓ ' : '⚠ ') + msg;
  el.className = 'toast show ' + type;
  
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Save data ──
async function save() {
  try {
    localStorage.setItem('fl4', JSON.stringify(S));
    console.log('💾 Saved to localStorage');
    
    // Sync to cloud if enabled (check for window.pushToCloud function)
    if (typeof window.pushToCloud === 'function') {
      const success = await window.pushToCloud();
      if (success) {
        console.log('☁️ Synced to cloud');
      } else {
        console.log('⚠️ Cloud sync failed, but local save OK');
      }
    }
  } catch (err) {
    console.error('❌ Save error:', err);
    toast('Błąd zapisu', 'err');
  }
}

// Export to global scope
window.save = save;
window.S = S;

// ── Calculations ──
const rentTotal = () => LOCKED_TOTAL + S.rentPeriods.reduce((s, p) => s + p.rate * p.months, 0);

const utilTotal = () => S.utilities.reduce((s, u) => s + u.entries.reduce((e, ent) => {
  if (ent.type === 'period') return e + ent.rate * ent.months;
  if (ent.type === 'monthly') return e + ent.amount;
  return e;
}, 0), 0);

const remontTotal = () => S.remont.reduce((s, o) => s + (Number(o.amount) || 0), 0);
const zakupyTotal = () => S.zakupy.reduce((s, o) => s + (Number(o.amount) || 0), 0);
const otcTotal = () => remontTotal() + zakupyTotal(); // Combined for backward compatibility

const totalCosts = () => rentTotal() + utilTotal() + otcTotal();

const totalRevenue = () => S.sessions.reduce((s, x) => s + (Number(x.revenue) || 0), 0);

const totalBalance = () => totalRevenue() - totalCosts();

// ── Navigation ──
function go(tab) {
  try {
    // Hide all pages
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
    
    // Update nav items
    document.querySelectorAll('.ni, .mni').forEach(n => {
      n.classList.toggle('on', n.dataset.tab === tab);
    });
    
    // Show target page
    const pg = $('pg-' + tab);
    if (pg) pg.classList.add('on');
    
    // Render the target page
    renderTab(tab);
  } catch (err) {
    console.error('❌ Navigation error:', err);
  }
}

// Export to global scope
window.go = go;

// ── Render dispatcher ──
function renderTab(tab) {
  const renderFuncs = {
    dash: renderDash,
    costs: renderCosts,
    sessions: renderSessions,
    analytics: renderAnalytics,
    tasks: renderTasks,
    settings: renderSettings
  };
  
  const renderFunc = renderFuncs[tab];
  if (renderFunc) {
    try {
      renderFunc();
    } catch (err) {
      console.error(`❌ Error rendering ${tab}:`, err);
    }
  }
}

// Export to global scope
window.renderTab = renderTab;

// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════

function renderDash() {
  const costs = totalCosts();
  const rev = totalRevenue();
  const bal = totalBalance();
  const cnt = S.sessions.length;
  
  // Update name and date
  set('d-name', S.settings.name || 'Familock');
  const now = new Date();
  const dateStr = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  set('d-date', dateStr);
  
  // KPIs
  set('k-costs', fmtPLN(costs));
  set('k-rev', fmtPLN(rev));
  set('k-bal', (bal >= 0 ? '+' : '') + fmtPLN(bal));
  set('k-sess', cnt);
  
  // Balance card color
  const balCard = $('k-bal-card');
  if (balCard) {
    balCard.className = 'kpi ' + (bal >= 0 ? 'g' : 'r');
  }
  
  // Average per session
  const avgRev = cnt > 0 ? rev / cnt : 0;
  set('k-avg', fmtPLN(avgRev, 2));
  
  const avgDisc = cnt > 0 
    ? S.sessions.reduce((s, x) => s + (Number(x.discount) || 0), 0) / cnt
    : 0;
  set('k-avg-disc', avgDisc > 0 ? `(rabat śr. ${fmtPLN(avgDisc, 2)})` : '');
  
  // This month
  const ym = thisYM();
  const thisMonth = S.sessions.filter(s => s.date?.startsWith(ym));
  const thisMonthRev = thisMonth.reduce((s, x) => s + (Number(x.revenue) || 0), 0);
  set('k-thismonth', thisMonth.length);
  set('k-thismonth-s', fmtPLN(thisMonthRev));
  
  // Progress bar
  const pct = costs > 0 ? Math.min((rev / costs) * 100, 100) : 0;
  set('d-pct', pct.toFixed(1) + '%');
  
  const progbar = $('d-progbar');
  if (progbar) {
    progbar.style.width = pct + '%';
    progbar.className = 'prog-bar' + (pct >= 100 ? ' g' : '');
  }
  
  set('d-rev-lbl', fmtPLN(rev));
  set('d-cost-lbl', fmtPLN(costs));
  
  // Games needed at different prices
  const gamesAt = (price) => Math.ceil(Math.max(0, costs - rev) / price);
  set('d-g200', gamesAt(200) + ' gier');
  set('d-g220', gamesAt(220) + ' gier');
  set('d-g250', gamesAt(250) + ' gier');
  
  // Month goal
  const target = S.settings.targetSessions || 20;
  const achieved = thisMonth.length;
  const goalPct = (achieved / target) * 100;
  let goalClass = 'ok';
  if (goalPct < 50) goalClass = 'low';
  else if (goalPct < 80) goalClass = 'warn';
  
  $('d-month-goal').innerHTML = `
    <div class="mg-row">
      <div class="mg-title">Cel: ${target} sesji</div>
      <div class="mg-count ${goalClass}">${achieved} / ${target}</div>
    </div>
    <div class="prog-track">
      <div class="prog-bar ${goalClass === 'ok' ? 'g' : goalClass === 'warn' ? 'b' : 'r'}"
           style="width:${Math.min(goalPct, 100)}%"></div>
    </div>
  `;
  
  // Forecast
  renderForecast();
  
  // Recent sessions
  const recent = S.sessions.slice(-5).reverse();
  if (recent.length === 0) {
    $('d-recent').innerHTML = '<div class="empty"><div class="empty-ic">◎</div><div class="empty-tx">Brak sesji</div></div>';
  } else {
    $('d-recent').innerHTML = recent.map(s => `
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--b1)">
        <div>
          <div style="font-size:12px;color:var(--tx)">${s.date || '—'}</div>
          <div style="font-size:10px;color:var(--txm);margin-top:1px">${s.players || 0} graczy${s.note ? ' · ' + esc(s.note) : ''}</div>
        </div>
        <div style="font-family:var(--fm);font-size:13px;font-weight:700;color:var(--ac2)">${fmtPLN(s.revenue || 0)}</div>
      </div>
    `).join('') + (recent.length === 5 ? '' : '<div style="height:1px"></div>');
  }
  
  // Tasks
  const openTasks = S.tasks.filter(t => !t.done).slice(0, 5);
  if (openTasks.length === 0) {
    $('d-tasks').innerHTML = '<div class="empty"><div class="empty-ic">☑</div><div class="empty-tx">Brak otwartych zadań</div></div>';
  } else {
    $('d-tasks').innerHTML = openTasks.map(t => `
      <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--b1)">
        <input type="checkbox" class="task-cb" ${t.done ? 'checked' : ''} 
               onchange="toggleTask(${t.id})" />
        <div style="flex:1;font-size:12px">${esc(t.text)}</div>
        ${t.priority ? `<span class="task-pri pri-${t.priority}">${t.priority === 'high' ? '🔴' : t.priority === 'med' ? '⚡' : '🟢'}</span>` : ''}
      </div>
    `).join('');
  }
  
  // Revenue chart
  renderMonthlyChart('d-chart');
}

// Export to global scope
window.renderDash = renderDash;

function renderForecast() {
  const costs = totalCosts();
  const rev = totalRevenue();
  const remaining = Math.max(0, costs - rev);
  
  if (remaining === 0) {
    $('d-forecast').innerHTML = `
      <div class="forecast-card" style="background:linear-gradient(135deg,var(--greeng),var(--s1))">
        <div class="forecast-date" style="color:var(--green)">✓ Zwrot kosztów osiągnięty!</div>
        <div class="forecast-sub">Gratulacje! Wszystkie koszty zostały pokryte.</div>
      </div>
    `;
    return;
  }
  
  const avgGame = S.settings.avgGame || 220;
  const gamesNeeded = Math.ceil(remaining / avgGame);
  const avgPerMonth = S.sessions.length > 0 
    ? calcMonthlyAvg()
    : (S.settings.targetSessions || 20);
  
  const monthsNeeded = avgPerMonth > 0 ? gamesNeeded / avgPerMonth : 0;
  
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setMonth(targetDate.getMonth() + Math.ceil(monthsNeeded));
  
  const targetStr = targetDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  
  $('d-forecast').innerHTML = `
    <div class="forecast-card">
      <div class="forecast-date">${targetStr}</div>
      <div class="forecast-sub">przewidywany zwrot przy obecnym tempie</div>
      <div class="forecast-grid">
        <div class="fcast-item">
          <div class="fcast-l">Do zwrotu</div>
          <div class="fcast-v">${fmtPLN(remaining)}</div>
        </div>
        <div class="fcast-item">
          <div class="fcast-l">Potrzeba gier</div>
          <div class="fcast-v">${gamesNeeded}</div>
        </div>
        <div class="fcast-item">
          <div class="fcast-l">Śr. / miesiąc</div>
          <div class="fcast-v">${avgPerMonth.toFixed(1)} sesji</div>
        </div>
        <div class="fcast-item">
          <div class="fcast-l">Czas zwrotu</div>
          <div class="fcast-v">${monthsNeeded.toFixed(1)} mies.</div>
        </div>
      </div>
    </div>
  `;
}

function calcMonthlyAvg() {
  if (S.sessions.length === 0) return 0;
  
  const byMonth = {};
  S.sessions.forEach(s => {
    if (!s.date) return;
    const ym = s.date.substring(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + 1;
  });
  
  const counts = Object.values(byMonth);
  return counts.length > 0 
    ? counts.reduce((a, b) => a + b, 0) / counts.length
    : 0;
}

function renderMonthlyChart(containerId) {
  const container = $(containerId);
  if (!container) return;
  
  // Group by month
  const byMonth = {};
  S.sessions.forEach(s => {
    if (!s.date) return;
    const ym = s.date.substring(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + (Number(s.revenue) || 0);
  });
  
  // Get last 12 months
  const months = Object.keys(byMonth).sort().slice(-12);
  
  if (months.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-ic">◑</div><div class="empty-tx">Brak danych</div></div>';
    return;
  }
  
  const maxRev = Math.max(...months.map(m => byMonth[m]));
  
  container.innerHTML = `
    <div class="bar-chart">
      ${months.map(ym => {
        const rev = byMonth[ym] || 0;
        const height = maxRev > 0 ? (rev / maxRev) * 100 : 0;
        return `
          <div class="bar-item">
            <div class="bar-fill" style="height:${height}%"></div>
            <div class="bar-lbl">${fmtYM(ym)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
//  COSTS
// ═══════════════════════════════════════════════════════════════

function renderCosts() {
  // Render rent periods
  renderRentList();
  
  // Render utilities
  renderUtilList();
  
  // Render remont and zakupy
  renderRemontList();
  renderZakupyList();
  
  // Summary
  const rentT = rentTotal();
  const utilT = utilTotal();
  const remontT = remontTotal();
  const zakupyT = zakupyTotal();
  const total = rentT + utilT + remontT + zakupyT;
  
  set('c-total', fmtPLN(total));
  set('c-rent', fmtPLN(rentT));
  set('c-util', fmtPLN(utilT));
  set('c-remont', fmtPLN(remontT));
  set('c-zakupy', fmtPLN(zakupyT));
  set('c-months', S.rentPeriods.reduce((s, p) => s + p.months, LOCKED.months));
  
  // Games needed table
  const prices = [200, 220, 250, 280, 300];
  $('c-games-table').innerHTML = `
    <table class="dt">
      <tbody>
        ${prices.map(p => `
          <tr>
            <td style="font-size:11px">Po ${p} zł</td>
            <td class="num">${ceil(total / p)} gier</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.renderCosts = renderCosts;

function renderRentList() {
  const list = $('rent-list');
  if (!list) return;
  
  // Locked period
  let html = `
    <div class="rp">
      <div class="rp-head">
        <div class="rp-dot lk"></div>
        <div>
          <div class="rp-name"><span class="badge bg-lock">LOCKED</span> ${esc(LOCKED.label)}</div>
          <div class="rp-detail">${fmtPLN(LOCKED.rate)}/mies. × ${LOCKED.months} mies.</div>
        </div>
        <div></div>
        <div class="rp-total lk">${fmtPLN(LOCKED_TOTAL)}</div>
      </div>
    </div>
  `;
  
  // Regular periods
  S.rentPeriods.forEach((p, idx) => {
    html += `
      <div class="rp">
        <div class="rp-head">
          <div class="rp-dot"></div>
          <div>
            <div class="rp-name">${esc(p.label)}</div>
            <div class="rp-detail">${fmtPLN(p.rate)}/mies. × ${p.months} mies.</div>
          </div>
          <button class="btn be" onclick="editRP(${idx})">✎</button>
          <div class="rp-total">${fmtPLN(p.rate * p.months)}</div>
        </div>
        <div class="rp-edit" id="rp-edit-${idx}" style="display:none">
          <div class="field" style="margin:0"><label>Opis</label><input id="rpe-lbl-${idx}" value="${esc(p.label)}"/></div>
          <div class="field" style="margin:0"><label>zł/mies.</label><input type="number" id="rpe-rate-${idx}" step="0.01" value="${p.rate}"/></div>
          <div class="field" style="margin:0"><label>Miesięcy</label><input type="number" id="rpe-months-${idx}" value="${p.months}"/></div>
          <div style="display:flex;gap:5px;padding-bottom:1px">
            <button class="btn bp bsm" onclick="updateRP(${idx})">Zapisz</button>
            <button class="btn bg bsm" onclick="cancelEditRP(${idx})">Anuluj</button>
            <button class="btn bd" onclick="deleteRP(${idx})">Usuń</button>
          </div>
        </div>
      </div>
    `;
  });
  
  list.innerHTML = html;
}

window.editRP = function(idx) {
  document.querySelectorAll('[id^="rp-edit-"]').forEach(e => e.style.display = 'none');
  const edit = $(`rp-edit-${idx}`);
  if (edit) edit.style.display = 'grid';
};

window.cancelEditRP = function(idx) {
  const edit = $(`rp-edit-${idx}`);
  if (edit) edit.style.display = 'none';
};

window.updateRP = function(idx) {
  S.rentPeriods[idx].label = $(`rpe-lbl-${idx}`).value;
  S.rentPeriods[idx].rate = parseFloat($(`rpe-rate-${idx}`).value) || 0;
  S.rentPeriods[idx].months = parseInt($(`rpe-months-${idx}`).value) || 0;
  save();
  renderCosts();
  toast('Zaktualizowano');
};

window.deleteRP = function(idx) {
  if (!confirm('Usunąć ten okres?')) return;
  S.rentPeriods.splice(idx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

window.saveRP = function() {
  const lbl = $('rp-lbl').value.trim();
  const rate = parseFloat($('rp-rate').value) || 0;
  const months = parseInt($('rp-months').value) || 0;
  
  if (!lbl || rate <= 0 || months <= 0) {
    toast('Wypełnij wszystkie pola', 'err');
    return;
  }
  
  S.rentPeriods.push({ id: uid(), label: lbl, rate, months });
  $('rp-lbl').value = '';
  $('rp-rate').value = '';
  $('rp-months').value = '';
  $('rp-add').classList.remove('open');
  save();
  renderCosts();
  toast('Dodano okres');
};

// Utilities
function renderUtilList() {
  const list = $('util-list');
  if (!list) return;
  
  list.innerHTML = S.utilities.map((u, uidx) => {
    const total = u.entries.reduce((s, e) => {
      if (e.type === 'period') return s + e.rate * e.months;
      if (e.type === 'monthly') return s + e.amount;
      return s;
    }, 0);
    
    const isOpen = u._open || false;
    
    return `
      <div class="util ${isOpen ? 'open' : ''}" id="util-${uidx}">
        <div class="util-head" onclick="toggleUtil(${uidx})">
          <div class="util-emoji">${u.emoji || '💡'}</div>
          <div>
            <input type="text" class="util-name-input" value="${esc(u.name)}" 
                   onclick="event.stopPropagation()" 
                   onchange="updateUtilName(${uidx}, this.value)"/>
            <div class="util-sub">${u.entries.length} ${u.entries.length === 1 ? 'wpis' : 'wpisów'}</div>
          </div>
          <div class="util-sum">${fmtPLN(total)}</div>
          <button class="btn bd" onclick="event.stopPropagation();deleteUtil(${uidx})">✕</button>
          <div class="util-arrow">▼</div>
        </div>
        <div class="util-body">
          ${renderUtilEntries(uidx, u)}
        </div>
      </div>
    `;
  }).join('');
}

function renderUtilEntries(uidx, util) {
  let html = '<div class="ue-list">';
  
  util.entries.forEach((e, eidx) => {
    const amt = e.type === 'period' ? e.rate * e.months : e.amount;
    html += `
      <div class="ue">
        <div class="ue-lbl">
          ${e.type === 'period' ? `${esc(e.label)} (${fmtPLN(e.rate)}/mies. × ${e.months})` : esc(e.label)}
        </div>
        <div class="ue-amt">${fmtPLN(amt)}</div>
        <div>
          <button class="btn be" onclick="editUE(${uidx},${eidx})">✎</button>
          <button class="btn bd" onclick="deleteUE(${uidx},${eidx})">✕</button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  // Add form
  const addId = `ue-add-${uidx}`;
  html += `
    <div class="ue-add" id="${addId}">
      <div class="ue-tabs">
        <button class="ue-tab on" onclick="switchUEType(${uidx},'monthly')">Kwota</button>
        <button class="ue-tab" onclick="switchUEType(${uidx},'period')">Okres</button>
      </div>
      <div id="ue-form-monthly-${uidx}">
        <div class="ue-grid-m">
          <div class="field" style="margin:0"><label>Opis</label><input id="ue-lbl-m-${uidx}" placeholder="np. Faktura 03/2024"/></div>
          <div class="field" style="margin:0"><label>Kwota (zł)</label><input type="number" id="ue-amt-m-${uidx}" step="0.01"/></div>
          <div style="display:flex;gap:5px;padding-bottom:1px">
            <button class="btn bp bsm" onclick="saveUE(${uidx},'monthly')">OK</button>
            <button class="btn bg bsm" onclick="$('${addId}').classList.remove('open')">✕</button>
          </div>
        </div>
      </div>
      <div id="ue-form-period-${uidx}" style="display:none">
        <div class="ue-grid-p">
          <div class="field" style="margin:0"><label>Okres</label><input id="ue-lbl-p-${uidx}" placeholder="np. sty-mar 2024"/></div>
          <div class="field" style="margin:0"><label>zł/mies.</label><input type="number" id="ue-rate-p-${uidx}" step="0.01"/></div>
          <div class="field" style="margin:0"><label>Miesięcy</label><input type="number" id="ue-months-p-${uidx}"/></div>
          <div style="display:flex;gap:5px;padding-bottom:1px">
            <button class="btn bp bsm" onclick="saveUE(${uidx},'period')">OK</button>
            <button class="btn bg bsm" onclick="$('${addId}').classList.remove('open')">✕</button>
          </div>
        </div>
      </div>
    </div>
    <button class="btn bg bsm" style="margin-top:7px" onclick="$('${addId}').classList.add('open')">+ Wpis</button>
  `;
  
  return html;
}

window.toggleUtil = function(idx) {
  const util = $(`util-${idx}`);
  if (util) {
    const isOpen = util.classList.toggle('open');
    S.utilities[idx]._open = isOpen;
  }
};

window.updateUtilName = function(idx, name) {
  S.utilities[idx].name = name;
  save();
};

window.deleteUtil = function(idx) {
  if (!confirm('Usunąć to medium?')) return;
  S.utilities.splice(idx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

window.addUtil = function() {
  S.utilities.push({
    id: uid(),
    emoji: '💡',
    name: 'Nowe medium',
    entries: [],
    _open: true
  });
  save();
  renderCosts();
};

window.switchUEType = function(uidx, type) {
  document.querySelectorAll(`#ue-add-${uidx} .ue-tab`).forEach(t => {
    t.classList.toggle('on', t.textContent.toLowerCase().includes(type === 'monthly' ? 'kwota' : 'okres'));
  });
  $(`ue-form-monthly-${uidx}`).style.display = type === 'monthly' ? 'block' : 'none';
  $(`ue-form-period-${uidx}`).style.display = type === 'period' ? 'block' : 'none';
};

window.saveUE = function(uidx, type) {
  let entry;
  
  if (type === 'monthly') {
    const lbl = $(`ue-lbl-m-${uidx}`).value.trim();
    const amt = parseFloat($(`ue-amt-m-${uidx}`).value) || 0;
    if (!lbl || amt <= 0) { toast('Wypełnij pola', 'err'); return; }
    entry = { id: uid(), type: 'monthly', label: lbl, amount: amt };
    $(`ue-lbl-m-${uidx}`).value = '';
    $(`ue-amt-m-${uidx}`).value = '';
  } else {
    const lbl = $(`ue-lbl-p-${uidx}`).value.trim();
    const rate = parseFloat($(`ue-rate-p-${uidx}`).value) || 0;
    const months = parseInt($(`ue-months-p-${uidx}`).value) || 0;
    if (!lbl || rate <= 0 || months <= 0) { toast('Wypełnij pola', 'err'); return; }
    entry = { id: uid(), type: 'period', label: lbl, rate, months };
    $(`ue-lbl-p-${uidx}`).value = '';
    $(`ue-rate-p-${uidx}`).value = '';
    $(`ue-months-p-${uidx}`).value = '';
  }
  
  S.utilities[uidx].entries.push(entry);
  S.utilities[uidx]._open = true;
  $(`ue-add-${uidx}`).classList.remove('open');
  save();
  renderCosts();
  toast('Dodano wpis');
};

window.deleteUE = function(uidx, eidx) {
  S.utilities[uidx].entries.splice(eidx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

// REMONT
function renderRemontList() {
  const list = $('remont-list');
  if (!list) return;
  
  if (S.remont.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-ic">🏗️</div><div class="empty-tx">Brak kosztów remontu</div></div>';
    return;
  }
  
  list.innerHTML = S.remont.map((o, idx) => `
    <div class="otc-row">
      <div style="font-size:12px">${esc(o.name)}</div>
      <div style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--ac2)">${fmtPLN(o.amount)}</div>
      <div>
        <button class="btn be" onclick="editRemont(${idx})">✎</button>
        <button class="btn bd" onclick="deleteRemont(${idx})">✕</button>
      </div>
    </div>
  `).join('');
}

window.addRemont = function() {
  const name = prompt('Nazwa kosztu remontu:');
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):'));
  if (isNaN(amount) || amount <= 0) { toast('Nieprawidłowa kwota', 'err'); return; }
  
  S.remont.push({ id: uid(), name, amount });
  save();
  renderCosts();
  toast('Dodano');
};

window.editRemont = function(idx) {
  const o = S.remont[idx];
  const name = prompt('Nazwa:', o.name);
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):', o.amount));
  if (isNaN(amount)) return;
  
  S.remont[idx].name = name;
  S.remont[idx].amount = amount;
  save();
  renderCosts();
  toast('Zaktualizowano');
};

window.deleteRemont = function(idx) {
  if (!confirm('Usunąć ten koszt?')) return;
  S.remont.splice(idx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

// ZAKUPY
function renderZakupyList() {
  const list = $('zakupy-list');
  if (!list) return;
  
  if (S.zakupy.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-ic">🛒</div><div class="empty-tx">Brak zakupów</div></div>';
    return;
  }
  
  list.innerHTML = S.zakupy.map((o, idx) => `
    <div class="otc-row">
      <div style="font-size:12px">${esc(o.name)}</div>
      <div style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--ac2)">${fmtPLN(o.amount)}</div>
      <div>
        <button class="btn be" onclick="editZakupy(${idx})">✎</button>
        <button class="btn bd" onclick="deleteZakupy(${idx})">✕</button>
      </div>
    </div>
  `).join('');
}

window.addZakupy = function() {
  const name = prompt('Nazwa zakupu:');
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):'));
  if (isNaN(amount) || amount <= 0) { toast('Nieprawidłowa kwota', 'err'); return; }
  
  S.zakupy.push({ id: uid(), name, amount });
  save();
  renderCosts();
  toast('Dodano');
};

window.editZakupy = function(idx) {
  const o = S.zakupy[idx];
  const name = prompt('Nazwa:', o.name);
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):', o.amount));
  if (isNaN(amount)) return;
  
  S.zakupy[idx].name = name;
  S.zakupy[idx].amount = amount;
  save();
  renderCosts();
  toast('Zaktualizowano');
};

window.deleteZakupy = function(idx) {
  if (!confirm('Usunąć ten zakup?')) return;
  S.zakupy.splice(idx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

// OTC (legacy - kept for backward compatibility)
function renderOTCList() {
  const list = $('otc-list');
  if (!list) return;
  
  if (S.otc.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-ic">◰</div><div class="empty-tx">Brak kosztów</div></div>';
    return;
  }
  
  list.innerHTML = S.otc.map((o, idx) => `
    <div class="otc-row">
      <div style="font-size:12px">${esc(o.name)}</div>
      <div style="font-family:var(--fm);font-size:12px;font-weight:700;color:var(--ac2)">${fmtPLN(o.amount)}</div>
      <div>
        <button class="btn be" onclick="editOTC(${idx})">✎</button>
        <button class="btn bd" onclick="deleteOTC(${idx})">✕</button>
      </div>
    </div>
  `).join('');
}

window.addOTC = function() {
  const name = prompt('Nazwa kosztu:');
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):'));
  if (isNaN(amount) || amount <= 0) { toast('Nieprawidłowa kwota', 'err'); return; }
  
  S.otc.push({ id: uid(), name, amount });
  save();
  renderCosts();
  toast('Dodano');
};

window.editOTC = function(idx) {
  const o = S.otc[idx];
  const name = prompt('Nazwa:', o.name);
  if (!name) return;
  const amount = parseFloat(prompt('Kwota (zł):', o.amount));
  if (isNaN(amount)) return;
  
  S.otc[idx].name = name;
  S.otc[idx].amount = amount;
  save();
  renderCosts();
  toast('Zaktualizowano');
};

window.deleteOTC = function(idx) {
  if (!confirm('Usunąć ten koszt?')) return;
  S.otc.splice(idx, 1);
  save();
  renderCosts();
  toast('Usunięto');
};

window.copyCosts = function() {
  const text = `FAMILOCK - Podsumowanie kosztów\n\nCzynsz: ${fmtPLN(rentTotal())}\nMedia: ${fmtPLN(utilTotal())}\nJednorazowe: ${fmtPLN(otcTotal())}\n\nRazem: ${fmtPLN(totalCosts())}`;
  navigator.clipboard.writeText(text);
  toast('Skopiowano');
};

// ═══════════════════════════════════════════════════════════════
//  INVOICE IMPORT & EXPORT
// ═══════════════════════════════════════════════════════════════

// Setup drag & drop zone
function setupInvoiceImport() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('invoice-file-input');
  
  if (!dropZone || !fileInput) return;
  
  // Click to select file
  dropZone.addEventListener('click', () => fileInput.click());
  
  // Drag & drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = 'var(--acg)';
    dropZone.style.borderColor = 'var(--ac)';
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '';
    dropZone.style.borderColor = '';
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.background = '';
    dropZone.style.borderColor = '';
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      await processInvoiceFile(files[0]);
    } else {
      toast('Przeciągnij plik PDF z fakturą', 'err');
    }
  });
}

window.handleInvoiceFile = async function(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    await processInvoiceFile(file);
  }
  e.target.value = ''; // Reset input
};

async function processInvoiceFile(file) {
  const statusEl = document.getElementById('invoice-status');
  if (!statusEl) return;
  
  try {
    statusEl.innerHTML = '<span style="color:var(--yellow)">⏳ Przetwarzam fakturę...</span>';
    
    // Parse PDF
    const result = await window.parsePDFInvoice(file);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    statusEl.innerHTML = '<span style="color:var(--blue)">📄 Rozpoznano: ' + result.type + '</span>';
    
    // Add to Familock
    const addResult = await window.addInvoiceToFamilock(result.data);
    
    if (addResult.success) {
      statusEl.innerHTML = `<span style="color:var(--green)">✅ Dodano: ${addResult.utility} - ${fmtPLN(addResult.amount)}</span>`;
      toast(`Dodano fakturę: ${addResult.utility}`);
    }
  } catch (err) {
    console.error('Invoice import error:', err);
    statusEl.innerHTML = '<span style="color:var(--red)">❌ Błąd: ' + err.message + '</span>';
    toast('Błąd importu faktury', 'err');
  }
}

// Export sessions to ING Księgowość (CSV)
window.exportToING = function() {
  try {
    // CSV header
    let csv = 'Data,Numer dokumentu,Opis,Kwota netto,VAT,Kwota brutto\n';
    
    // Add sessions
    S.sessions.forEach((s, idx) => {
      const docNumber = `SES/${new Date(s.date).getFullYear()}/${String(idx + 1).padStart(4, '0')}`;
      const desc = `Sesja escape room - ${s.players || 0} os.${s.note ? ' - ' + s.note : ''}`;
      const netAmount = (s.revenue / 1.23).toFixed(2); // Assuming 23% VAT
      const vat = (s.revenue - netAmount).toFixed(2);
      
      csv += `${s.date},"${docNumber}","${desc}",${netAmount},${vat},${s.revenue}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `familock-przychody-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast('Wyeksportowano do CSV');
  } catch (err) {
    console.error('Export error:', err);
    toast('Błąd eksportu', 'err');
  }
};

// ═══════════════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════════════

function renderSessions() {
  const filter = $('s-filter')?.value || '';
  const filtered = filter
    ? S.sessions.filter(s => s.date?.startsWith(filter))
    : S.sessions;
  
  const totalRev = filtered.reduce((s, x) => s + (Number(x.revenue) || 0), 0);
  const totalDisc = filtered.reduce((s, x) => s + (Number(x.discount) || 0), 0);
  
  set('s-sum', `${filtered.length} sesji · ${fmtPLN(totalRev)} ${totalDisc > 0 ? `(rabaty: ${fmtPLN(totalDisc)})` : ''}`);
  
  if (filtered.length === 0) {
    $('s-table').innerHTML = '<div class="empty"><div class="empty-ic">◎</div><div class="empty-tx">Brak sesji<br><button class="btn" style="margin-top:12px" onclick="importCSV()">📄 Import CSV</button></div></div>';
    return;
  }
  
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  $('s-table').innerHTML = `
    <table class="dt">
      <thead>
        <tr>
          <th>Data</th>
          <th style="text-align:center">Graczy</th>
          <th style="text-align:right">Przychód</th>
          <th style="text-align:right">Rabat</th>
          <th>Notatka</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((s, idx) => {
          const origIdx = S.sessions.indexOf(s);
          return `
            <tr onclick="editSession(${origIdx})" style="cursor:pointer">
              <td>${s.date || '—'}</td>
              <td style="text-align:center">${s.players || 0}</td>
              <td class="num">${fmtPLN(s.revenue || 0)}</td>
              <td class="num">${s.discount > 0 ? `−${fmtPLN(s.discount)}` : '—'}</td>
              <td style="font-size:11px;color:var(--txm)">${esc(s.note || '')}</td>
              <td class="acell">
                <button class="btn bd" onclick="event.stopPropagation();deleteSession(${origIdx})">✕</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Razem</td>
          <td class="num">${fmtPLN(totalRev)}</td>
          <td class="num">${totalDisc > 0 ? `−${fmtPLN(totalDisc)}` : ''}</td>
          <td colspan="2" style="text-align:right">
            <button class="btn" onclick="importCSV()" style="font-size:11px;padding:4px 8px">📄 Import CSV</button>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

window.renderSessions = renderSessions;

window.toggleSessAdd = function() {
  $('sess-add').classList.toggle('open');
  if ($('s-date').value === '') {
    $('s-date').value = new Date().toISOString().split('T')[0];
  }
};

window.saveSess = function() {
  const date = $('s-date').value;
  const players = parseInt($('s-players').value) || 0;
  const rev = parseFloat($('s-rev').value) || 0;
  const disc = parseFloat($('s-disc').value) || 0;
  const note = $('s-note').value.trim();
  
  if (!date || rev <= 0) {
    toast('Podaj datę i przychód', 'err');
    return;
  }
  
  S.sessions.push({
    id: uid(),
    date,
    players,
    revenue: rev,
    discount: disc,
    note
  });
  
  $('s-date').value = '';
  $('s-players').value = '';
  $('s-rev').value = '';
  $('s-disc').value = '0';
  $('s-note').value = '';
  
  toggleSessAdd();
  save();
  renderSessions();
  toast('Dodano sesję');
};

window.editSession = function(idx) {
  // Implement inline editing if needed
  toast('Kliknij ✕ aby usunąć');
};

window.deleteSession = function(idx) {
  if (!confirm('Usunąć tę sesję?')) return;
  S.sessions.splice(idx, 1);
  save();
  renderSessions();
  toast('Usunięto');
};

// ── CSV Import ──
window.importCSV = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const sessions = parseCSV(text);
      
      if (sessions.length === 0) {
        toast('Nie znaleziono sesji w CSV', 'err');
        return;
      }
      
      // Duplicate detection - check by date
      let added = 0;
      let skipped = 0;
      
      sessions.forEach(session => {
        const exists = S.sessions.some(s => 
          s.date === session.date && 
          Math.abs(s.revenue - session.revenue) < 0.01
        );
        
        if (!exists) {
          S.sessions.push({
            id: uid(),
            ...session
          });
          added++;
        } else {
          skipped++;
        }
      });
      
      if (added > 0) {
        save();
        renderSessions();
      }
      
      toast(`✓ Zaimportowano ${added} sesji${skipped > 0 ? ` (pominięto ${skipped} duplikatów)` : ''}`);
    } catch (err) {
      console.error('CSV import error:', err);
      toast('Błąd parsowania CSV', 'err');
    }
  };
  input.click();
};

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Parse header
  const header = lines[0].split(/[,;|\t]/).map(h => h.trim().toLowerCase());
  
  // Find column indices
  const dateIdx = header.findIndex(h => h.includes('data') || h.includes('date'));
  const playersIdx = header.findIndex(h => h.includes('gracz') || h.includes('player') || h.includes('osób'));
  const revenueIdx = header.findIndex(h => 
    h.includes('cena') || h.includes('price') || h.includes('przychód') || 
    h.includes('kwota') || h.includes('amount') || h.includes('revenue')
  );
  const noteIdx = header.findIndex(h => h.includes('pokój') || h.includes('room') || h.includes('nazwa'));
  
  if (dateIdx === -1 || revenueIdx === -1) {
    throw new Error('Nie znaleziono kolumn Data i Cena/Przychód');
  }
  
  const sessions = [];
  
  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;|\t]/).map(c => c.trim().replace(/"/g, ''));
    
    if (cols.length <= Math.max(dateIdx, revenueIdx)) continue;
    
    // Parse date (try YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY)
    let dateStr = cols[dateIdx];
    let date;
    
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      date = dateStr.substring(0, 10);
    } else if (/^\d{2}[-./]\d{2}[-./]\d{4}/.test(dateStr)) {
      const parts = dateStr.split(/[-./]/);
      date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      continue;
    }
    
    // Parse revenue
    const revenueStr = cols[revenueIdx].replace(/[^\d.,]/g, '').replace(',', '.');
    const revenue = parseFloat(revenueStr) || 0;
    
    if (revenue <= 0) continue;
    
    // Parse players
    const players = playersIdx >= 0 ? parseInt(cols[playersIdx]) || 0 : 0;
    
    // Parse note
    const note = noteIdx >= 0 ? cols[noteIdx] : '';
    
    sessions.push({
      date,
      players,
      revenue,
      discount: 0,
      note
    });
  }
  
  return sessions;
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════

function renderAnalytics() {
  const rev = totalRevenue();
  const cnt = S.sessions.length;
  const avg = cnt > 0 ? rev / cnt : 0;
  const avgPlayers = cnt > 0
    ? S.sessions.reduce((s, x) => s + (Number(x.players) || 0), 0) / cnt
    : 0;
  
  set('a-rev', fmtPLN(rev));
  set('a-cnt', cnt);
  set('a-avg', fmtPLN(avg, 2));
  set('a-pl', avgPlayers.toFixed(1));
  
  // Best month
  const byMonth = {};
  S.sessions.forEach(s => {
    if (!s.date) return;
    const ym = s.date.substring(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + (Number(s.revenue) || 0);
  });
  
  let bestMonth = '—';
  let bestRev = 0;
  Object.entries(byMonth).forEach(([ym, r]) => {
    if (r > bestRev) {
      bestRev = r;
      bestMonth = fmtYM(ym);
    }
  });
  set('a-best', bestMonth + (bestRev > 0 ? ` (${fmtPLN(bestRev)})` : ''));
  
  // This month
  const ym = thisYM();
  const thisMonth = S.sessions.filter(s => s.date?.startsWith(ym));
  const thisRev = thisMonth.reduce((s, x) => s + (Number(x.revenue) || 0), 0);
  set('a-now', thisMonth.length + ` (${fmtPLN(thisRev)})`);
  
  // Trends
  renderTrends();
  
  // Charts
  renderMonthlyChart('a-revchart');
  renderSessionsChart();
  
  // Profitability
  const costs = totalCosts();
  const bal = rev - costs;
  const pct = costs > 0 ? Math.min((rev / costs) * 100, 100) : 0;
  
  set('a-costs', fmtPLN(costs));
  set('a-rev2', fmtPLN(rev));
  set('a-bal', (bal >= 0 ? '+' : '') + fmtPLN(bal));
  $('a-bal').className = bal >= 0 ? 'c-green' : 'c-red';
  
  set('a-pct', pct.toFixed(1) + '%');
  const abar = $('a-bar');
  if (abar) {
    abar.style.width = pct + '%';
    abar.className = 'prog-bar ' + (pct >= 100 ? 'g' : pct >= 70 ? 'b' : 'r');
  }
  
  const remaining = Math.max(0, costs - rev);
  if (remaining > 0) {
    const avgGame = S.settings.avgGame || 220;
    const needed = Math.ceil(remaining / avgGame);
    set('a-needed', `Potrzeba jeszcze ~${needed} gier po ${avgGame} zł aby osiągnąć break-even`);
  } else {
    set('a-needed', '✓ Break-even osiągnięty!');
  }
  
  // Forecast
  const forecastEl = $('a-forecast');
  if (forecastEl) {
    forecastEl.innerHTML = '';
    renderForecast();
    forecastEl.innerHTML = $('d-forecast').innerHTML;
  }
}

window.renderAnalytics = renderAnalytics;

function renderTrends() {
  const months = {};
  S.sessions.forEach(s => {
    if (!s.date) return;
    const ym = s.date.substring(0, 7);
    if (!months[ym]) months[ym] = { cnt: 0, rev: 0 };
    months[ym].cnt++;
    months[ym].rev += Number(s.revenue) || 0;
  });
  
  const sorted = Object.keys(months).sort();
  if (sorted.length < 2) {
    $('a-trends').innerHTML = '<div style="font-size:12px;color:var(--txm)">Za mało danych do analizy trendów</div>';
    return;
  }
  
  const last = months[sorted[sorted.length - 1]];
  const prev = months[sorted[sorted.length - 2]];
  
  const revChange = prev.rev > 0 ? ((last.rev - prev.rev) / prev.rev) * 100 : 0;
  const cntChange = prev.cnt > 0 ? ((last.cnt - prev.cnt) / prev.cnt) * 100 : 0;
  
  $('a-trends').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:11px;color:var(--txm);margin-bottom:4px">Przychody</div>
        <div style="font-family:var(--fm);font-size:18px;font-weight:700">${fmtPLN(last.rev)}</div>
        <div class="trend ${revChange > 0 ? 'up' : revChange < 0 ? 'down' : 'flat'}" style="margin-top:4px">
          ${revChange > 0 ? '↗' : revChange < 0 ? '↘' : '→'} ${Math.abs(revChange).toFixed(1)}%
        </div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--txm);margin-bottom:4px">Liczba sesji</div>
        <div style="font-family:var(--fm);font-size:18px;font-weight:700">${last.cnt}</div>
        <div class="trend ${cntChange > 0 ? 'up' : cntChange < 0 ? 'down' : 'flat'}" style="margin-top:4px">
          ${cntChange > 0 ? '↗' : cntChange < 0 ? '↘' : '→'} ${Math.abs(cntChange).toFixed(1)}%
        </div>
      </div>
    </div>
  `;
}

function renderSessionsChart() {
  const container = $('a-sesschart');
  if (!container) return;
  
  const byMonth = {};
  S.sessions.forEach(s => {
    if (!s.date) return;
    const ym = s.date.substring(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + 1;
  });
  
  const months = Object.keys(byMonth).sort().slice(-12);
  if (months.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-ic">◑</div><div class="empty-tx">Brak danych</div></div>';
    return;
  }
  
  const maxCnt = Math.max(...months.map(m => byMonth[m]));
  
  container.innerHTML = `
    <div class="bar-chart">
      ${months.map(ym => {
        const cnt = byMonth[ym] || 0;
        const height = maxCnt > 0 ? (cnt / maxCnt) * 100 : 0;
        return `
          <div class="bar-item">
            <div class="bar-fill alt" style="height:${height}%"></div>
            <div class="bar-lbl">${fmtYM(ym)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════

let taskFilter = 'all';

function renderTasks() {
  const open = S.tasks.filter(t => !t.done);
  const done = S.tasks.filter(t => t.done);
  
  set('tasks-counter', `${open.length} otwartych · ${done.length} ukończonych`);
  
  let filtered = S.tasks;
  if (taskFilter === 'open') filtered = open;
  if (taskFilter === 'done') filtered = done;
  
  if (filtered.length === 0) {
    $('task-list').innerHTML = '<div class="empty"><div class="empty-ic">☐</div><div class="empty-tx">Brak zadań</div></div>';
    return;
  }
  
  $('task-list').innerHTML = filtered.map(t => {
    const priLabel = {
      high: '🔴',
      med: '⚡',
      low: '🟢'
    }[t.priority] || '';
    
    return `
      <div class="task-item ${t.done ? 'done' : ''}">
        <input type="checkbox" class="task-cb" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})"/>
        <div class="task-txt">${esc(t.text)}</div>
        ${t.priority ? `<span class="task-pri pri-${t.priority}">${priLabel}</span>` : ''}
        <button class="btn bd" onclick="deleteTask(${t.id})">✕</button>
      </div>
    `;
  }).join('');
}

window.renderTasks = renderTasks;

window.addTask = function() {
  const input = $('task-input');
  const text = input.value.trim();
  if (!text) return;
  
  const priority = $('task-pri').value;
  
  S.tasks.push({
    id: uid(),
    text,
    priority,
    done: false,
    createdAt: new Date().toISOString()
  });
  
  input.value = '';
  save();
  renderTasks();
  toast('Dodano zadanie');
};

window.toggleTask = function(id) {
  const task = S.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    save();
    renderTasks();
  }
};

window.deleteTask = function(id) {
  const idx = S.tasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    S.tasks.splice(idx, 1);
    save();
    renderTasks();
    toast('Usunięto zadanie');
  }
};

window.setTaskFilter = function(filter) {
  taskFilter = filter;
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tf === filter);
  });
  renderTasks();
};

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

function renderSettings() {
  const s = S.settings;
  
  const sv = (id, v) => {
    const e = $(id);
    if (e) e.value = v ?? '';
  };
  
  sv('cfg-avg', s.avgGame || 220);
  sv('cfg-target', s.targetSessions || 20);
  sv('cfg-name', s.name || 'Familock');
  sv('cfg-loc', s.loc || '');
}

window.renderSettings = renderSettings;

window.saveSettings = function() {
  S.settings.avgGame = parseFloat($('cfg-avg')?.value) || 220;
  S.settings.targetSessions = parseInt($('cfg-target')?.value) || 20;
  S.settings.name = $('cfg-name')?.value || 'Familock';
  S.settings.loc = $('cfg-loc')?.value || '';
  
  save();
  toast('Zapisano ustawienia');
};

window.exportData = function() {
  try {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `familock-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast('Wyeksportowano');
  } catch (err) {
    console.error('Export error:', err);
    toast('Błąd eksportu', 'err');
  }
};

window.importData = function(e) {
  try {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        
        // Validate structure
        if (!parsed.sessions && !parsed.otc) {
          throw new Error('Nieprawidłowy format pliku');
        }
        
        S = parsed;
        if (!S.tasks) S.tasks = [];
        
        save();
        
        // Re-render current tab
        const currentTab = document.querySelector('.ni.on,.mni.on')?.dataset?.tab || 'dash';
        renderTab(currentTab);
        
        toast('Zaimportowano dane');
      } catch (err) {
        console.error('Parse error:', err);
        toast('Błędny plik JSON', 'err');
      }
    };
    
    reader.readAsText(file);
    e.target.value = '';
  } catch (err) {
    console.error('Import error:', err);
    toast('Błąd importu', 'err');
  }
};

window.resetData = function() {
  if (!confirm('Wyczyścić WSZYSTKIE dane?')) return;
  if (!confirm('Na pewno? Tej operacji nie można cofnąć!')) return;
  
  S = JSON.parse(JSON.stringify(DEF));
  save();
  
  const currentTab = document.querySelector('.ni.on,.mni.on')?.dataset?.tab || 'dash';
  renderTab(currentTab);
  
  toast('Dane zostały wyczyszczone');
};

// ═══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
//  ADDITIONAL MODULES
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  FIXES & PDF IMPORT - DODAJ DO app.js
//  Wklej na końcu pliku przed document.addEventListener('DOMContentLoaded'...
// ════════════════════════════════════════════════════════════════

// ── FIX: Dodaj funkcję editUE (BRAKUJĄCA!) ──
window.editUE = function(uidx, eidx) {
  const entry = S.utilities[uidx].entries[eidx];
  if (!entry) return;
  
  const type = entry.type;
  const prefix = type === 'monthly' ? 'm' : 'p';
  
  // Show add form
  const addForm = $(`ue-add-${uidx}`);
  if (addForm) addForm.classList.add('open');
  
  // Switch to correct tab
  switchUEType(uidx, type);
  
  // Fill form with current values
  if (type === 'monthly') {
    $(`ue-lbl-m-${uidx}`).value = entry.label || '';
    $(`ue-amt-m-${uidx}`).value = entry.amount || '';
  } else {
    $(`ue-lbl-p-${uidx}`).value = entry.label || '';
    $(`ue-rate-p-${uidx}`).value = entry.rate || '';
    $(`ue-months-p-${uidx}`).value = entry.months || '';
  }
  
  // Delete old entry
  S.utilities[uidx].entries.splice(eidx, 1);
  save();
  renderCosts();
  
  toast('Edytuj i zapisz ponownie');
};

// ══════════════════════════════════════════════════════════════
//  PDF IMPORT MODULE
// ══════════════════════════════════════════════════════════════

window.PDF_PARSERS = {
  // Tauron parser
  tauron: {
    test: (text) => text.includes('TAURON') || text.includes('Dystrybucja'),
    parse: (text) => {
      const result = {
        type: 'utility',
        utilityName: 'Prąd',
        emoji: '⚡'
      };
      
      // Extract amount - szukaj różnych formatów
      const amountPatterns = [
        /Razem do zapłaty[:\s]+([\d\s,]+)\s*zł/i,
        /Do zapłaty[:\s]+([\d\s,]+)\s*zł/i,
        /Kwota do zapłaty[:\s]+([\d\s,]+)\s*zł/i,
        /Suma[:\s]+([\d\s,]+)\s*zł/i
      ];
      
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          result.amount = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
          break;
        }
      }
      
      // Extract period
      const periodMatch = text.match(/Okres rozliczeniowy[:\s]+(\d{2}[\.\-/]\d{2}[\.\-/]\d{4})\s*[\-–]\s*(\d{2}[\.\-/]\d{2}[\.\-/]\d{4})/i);
      if (periodMatch) {
        result.label = `Faktura ${periodMatch[1]} - ${periodMatch[2]}`;
      }
      
      // Extract invoice number
      const invoiceMatch = text.match(/Numer faktury[:\s]+([^\s\n]+)/i);
      if (invoiceMatch && !result.label) {
        result.label = `Faktura ${invoiceMatch[1]}`;
      }
      
      if (!result.label) {
        result.label = 'Faktura Tauron ' + new Date().toLocaleDateString('pl-PL');
      }
      
      return result;
    }
  },
  
  // Orange / T-Mobile / Plus parser (Internet)
  telecom: {
    test: (text) => 
      text.includes('Orange') || 
      text.includes('T-Mobile') || 
      text.includes('Plus') ||
      text.includes('Play') ||
      text.includes('Internet'),
    parse: (text) => {
      const result = {
        type: 'utility',
        utilityName: 'Internet',
        emoji: '🌐'
      };
      
      // Amount
      const amountMatch = text.match(/Do zapłaty[:\s]+([\d\s,]+)\s*zł/i) ||
                         text.match(/Razem[:\s]+([\d\s,]+)\s*zł/i);
      if (amountMatch) {
        result.amount = parseFloat(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
      }
      
      // Label
      const dateMatch = text.match(/(\d{2}[\.\-/]\d{2}[\.\-/]\d{4})/);
      result.label = dateMatch 
        ? `Faktura ${dateMatch[1]}`
        : 'Faktura ' + new Date().toLocaleDateString('pl-PL');
      
      return result;
    }
  },
  
  // Generic invoice parser (improved for purchase invoices)
  generic: {
    test: () => true, // Always matches
    parse: (text) => {
      const result = {
        type: 'otc',
        name: 'Zaimportowana faktura'
      };
      
      // Extract invoice number (various formats)
      const invoicePatterns = [
        /(?:Faktura|Invoice|FV|PF)[\s\/]*(?:nr\.?|#)?\s*([A-Z0-9\/\-]+)/i,
        /nr\s+([A-Z0-9\/\-]+)/i
      ];
      
      for (const pattern of invoicePatterns) {
        const match = text.match(pattern);
        if (match) {
          result.invoice_number = match[1].trim();
          result.name = `Faktura ${match[1].trim()}`;
          break;
        }
      }
      
      // Try to extract amount - improved patterns
      const amountPatterns = [
        // "Razem do zapłaty 1 050,00 PLN"
        /Razem\s+do\s+zapłaty[:\s]+([\d\s,.]+)\s*(?:PLN|zł)/i,
        // "Do zapłaty: 1 050,00"
        /Do\s+zapłaty[:\s]+([\d\s,.]+)\s*(?:PLN|zł)?/i,
        // "Razem: 1 050,00 PLN"
        /Razem[:\s]+([\d\s,.]+)\s*(?:PLN|zł)/i,
        // "Suma: 1 050,00"
        /Suma[:\s]+([\d\s,.]+)\s*(?:PLN|zł)?/i,
        // "Total: 1 050,00 PLN"
        /Total[:\s]+([\d\s,.]+)\s*(?:PLN|zł)/i,
        // "Brutto: 1 050,00"
        /(?:Wartość|Kwota)\s+brutto[:\s]+([\d\s,.]+)\s*(?:PLN|zł)?/i,
        // Fallback: any "PLN" with number before it
        /([\d\s,.]+)\s*PLN/i
      ];
      
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          // Clean up the amount string
          let amountStr = match[1]
            .replace(/\s/g, '')  // Remove spaces
            .replace(/\./g, '')  // Remove thousand separators (dots)
            .replace(',', '.');  // Convert decimal comma to dot
          
          const amount = parseFloat(amountStr);
          
          if (!isNaN(amount) && amount > 0) {
            result.amount = amount;
            break;
          }
        }
      }
      
      if (!result.amount) {
        result.amount = 0;
      }
      
      return result;
    }
  }
};

// Parse PDF text
async function parsePDFText(text) {
  console.log('📄 Parsing PDF text...');
  
  // Try each parser
  for (const [name, parser] of Object.entries(window.PDF_PARSERS)) {
    if (name === 'generic') continue; // Skip generic for now
    
    if (parser.test(text)) {
      console.log(`✓ Matched parser: ${name}`);
      const result = parser.parse(text);
      
      if (result.amount && result.amount > 0) {
        return result;
      }
    }
  }
  
  // Fallback to generic
  console.log('Using generic parser');
  return window.PDF_PARSERS.generic.parse(text);
}

// Extract text from PDF
async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        
        // Use pdf.js library (we'll load it dynamically)
        if (!window.pdfjsLib) {
          // Load pdf.js from CDN
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        
        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Load external script
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Handle PDF import
window.importPDF = async function(file) {
  if (!file || file.type !== 'application/pdf') {
    toast('To nie jest plik PDF', 'err');
    return;
  }
  
  toast('Przetwarzam PDF...');
  
  try {
    // Extract text
    const text = await extractPDFText(file);
    console.log('Extracted text length:', text.length);
    
    // Parse
    const parsed = await parsePDFText(text);
    console.log('Parsed result:', parsed);
    
    if (!parsed.amount || parsed.amount <= 0) {
      toast('Nie znaleziono kwoty w PDF. Dodaj ręcznie.', 'err');
      return;
    }
    
    // Add to system
    if (parsed.type === 'utility') {
      // Find or create utility
      let util = S.utilities.find(u => u.name === parsed.utilityName);
      
      if (!util) {
        util = {
          id: uid(),
          emoji: parsed.emoji || '💡',
          name: parsed.utilityName,
          entries: [],
          _open: true
        };
        S.utilities.push(util);
      }
      
      // Add entry
      util.entries.push({
        id: uid(),
        type: 'monthly',
        label: parsed.label,
        amount: parsed.amount
      });
      
      util._open = true;
      
    } else {
      // Add as zakupy (purchases)
      S.zakupy.push({
        id: uid(),
        name: parsed.name || parsed.label,
        amount: parsed.amount,
        invoice_number: parsed.invoice_number
      });
    }
    
    save();
    renderCosts();
    
    toast(`✓ Zaimportowano: ${fmtPLN(parsed.amount)}`);
    
  } catch (error) {
    console.error('PDF import error:', error);
    toast('Błąd parsowania PDF: ' + error.message, 'err');
  }
};

// Handle drag & drop
window.setupPDFDropZone = function() {
  const dropZone = document.getElementById('pdf-drop-zone');
  if (!dropZone) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('highlight');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('highlight');
    }, false);
  });
  
  dropZone.addEventListener('drop', async (e) => {
    const files = e.dataTransfer.files;
    
    for (const file of files) {
      if (file.type === 'application/pdf') {
        await importPDF(file);
      }
    }
  }, false);
  
  // Also handle file input
  const fileInput = document.getElementById('pdf-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      for (const file of files) {
        await importPDF(file);
      }
      e.target.value = ''; // Reset
    });
  }
};

console.log('✓ PDF import module loaded');

// ════════════════════════════════════════════════════════════════
//  LOCKME.PL INTEGRATION
//  Automatyczny import zagranych sesji z LockMe
// ════════════════════════════════════════════════════════════════

window.LOCKME = {
  // Konfiguracja
  accessToken: '', // OAuth access token (wygasa po 1h)
  refreshToken: '', // OAuth refresh token (do odnawiania)
  tokenExpiry: 0, // Timestamp wygaśnięcia access token
  companyId: '', // ID Twojej firmy w LockMe
  clientId: '', // Client ID z LockMe (opcjonalnie)
  clientSecret: '', // Client Secret z LockMe (opcjonalnie)
  apiUrl: 'https://api.lock.me/v1',
  proxyUrl: '', // Cloudflare Worker proxy URL (opcjonalnie - jeśli ustawione, używa proxy zamiast direct API)
  
  // Czy token jest ustawiony
  isConfigured() {
    return this.accessToken && this.companyId;
  },
  
  // Sprawdź czy token wygasł lub wygasa za < 5 min
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    const now = Math.floor(Date.now() / 1000);
    const buffer = 300; // 5 minut bufora
    return (this.tokenExpiry - now) < buffer;
  },
  
  // Odśwież access token używając refresh token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      console.log('⚠️ Brak refresh token - potrzebny nowy login');
      return false;
    }
    
    try {
      console.log('🔄 Odświeżam access token...');
      
      // LockMe OAuth endpoint (może być inny - sprawdzić dokumentację)
      const response = await fetch('https://api.lockme.pl/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId || '',
          client_secret: this.clientSecret || ''
        })
      });
      
      if (!response.ok) {
        console.error('❌ Refresh token error:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      // Zapisz nowe tokeny
      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.tokenExpiry = data.expires || (Math.floor(Date.now() / 1000) + 3600);
      
      // Zapisz w localStorage
      this.saveTokens();
      
      console.log('✅ Token odświeżony!');
      return true;
    } catch (error) {
      console.error('❌ Błąd refresh token:', error);
      return false;
    }
  },
  
  // Zapisz tokeny do localStorage
  saveTokens() {
    localStorage.setItem('lockme_access_token', this.accessToken);
    localStorage.setItem('lockme_refresh_token', this.refreshToken);
    localStorage.setItem('lockme_token_expiry', this.tokenExpiry.toString());
  },
  
  // Pokaż modal konfiguracji
  showConfig() {
    const modal = document.createElement('div');
    modal.className = 'auth-modal open';
    modal.id = 'lockme-config-modal';
    modal.innerHTML = `
      <div class="auth-box">
        <div class="auth-title">🔐 Konfiguracja LockMe.pl</div>
        <div class="auth-subtitle">Podaj dane OAuth z LockMe</div>
        
        <div class="field">
          <label>Token JSON (z LockMe)</label>
          <textarea id="lockme-token-json" rows="8" 
                    placeholder='{"token_type":"Bearer","access_token":"eyJ...","refresh_token":"def...","expires":...}'
                    style="font-family:monospace;font-size:11px"></textarea>
          <div style="font-size:10px;color:var(--txm);margin-top:4px">
            Wklej CAŁY JSON z "Generowanie tokena" w LockMe
          </div>
        </div>
        
        <div class="field">
          <label>Company ID</label>
          <input type="text" id="lockme-company-id" value="${this.companyId}" 
                 placeholder="ID Twojej firmy (liczba)"/>
        </div>
        
        <div style="font-size:11px;color:var(--txm);margin-bottom:14px;line-height:1.7">
          <strong>Jak uzyskać token:</strong><br>
          1. Zaloguj się do LockMe.pl<br>
          2. Ustawienia → Integracje → API<br>
          3. Kliknij "Generowanie tokena"<br>
          4. Skopiuj CAŁY JSON (z nawiasami {})<br>
          5. Wklej powyżej
        </div>
        
        <button class="btn bp w100" onclick="LOCKME.saveConfig()">Zapisz</button>
        <button class="btn bg w100 mt3" onclick="LOCKME.closeConfig()">Anuluj</button>
      </div>
    `;
    document.body.appendChild(modal);
  },
  
  closeConfig() {
    const modal = document.getElementById('lockme-config-modal');
    if (modal) modal.remove();
  },
  
  saveConfig() {
    const tokenJson = document.getElementById('lockme-token-json').value.trim();
    this.companyId = document.getElementById('lockme-company-id').value.trim();
    
    if (!tokenJson || !this.companyId) {
      toast('Podaj token JSON i Company ID', 'err');
      return;
    }
    
    try {
      // Parsuj JSON
      const token = JSON.parse(tokenJson);
      
      // Wyciągnij tokeny
      this.accessToken = token.access_token;
      this.refreshToken = token.refresh_token || '';
      this.tokenExpiry = token.expires || (Math.floor(Date.now() / 1000) + 3600);
      
      // Zapisz company ID
      localStorage.setItem('lockme_company_id', this.companyId);
      
      // Zapisz tokeny
      this.saveTokens();
      
      this.closeConfig();
      toast('✅ Konfiguracja zapisana! Token ważny ~1h, auto-refresh włączony.');
    } catch (error) {
      toast('❌ Błąd parsowania JSON. Wklej cały token!', 'err');
      console.error('Token parse error:', error);
    }
  },
  
  // Załaduj config z localStorage
  loadConfig() {
    this.accessToken = localStorage.getItem('lockme_access_token') || '';
    this.refreshToken = localStorage.getItem('lockme_refresh_token') || '';
    this.tokenExpiry = parseInt(localStorage.getItem('lockme_token_expiry') || '0');
    this.companyId = localStorage.getItem('lockme_company_id') || '';
    this.proxyUrl = localStorage.getItem('lockme_proxy_url') || '';
  },
  
  // Pobierz sesje z LockMe (z auto-refresh i proxy support)
  async fetchSessions(dateFrom, dateTo) {
    if (!this.isConfigured()) {
      toast('Skonfiguruj LockMe API', 'err');
      this.showConfig();
      return null;
    }
    
    // Sprawdź czy token wygasł
    if (this.isTokenExpired()) {
      console.log('⏰ Token wygasł, odświeżam...');
      const refreshed = await this.refreshAccessToken();
      
      if (!refreshed) {
        toast('❌ Token wygasł. Wygeneruj nowy w LockMe!', 'err');
        this.showConfig();
        return null;
      }
    }
    
    try {
      // CORRECTED: Use /rooms/{roomId}/reservations endpoint
      const lockmeUrl = `${this.apiUrl}/rooms/${this.companyId}/reservations?` + 
                        `date=${dateFrom}`;
      
      let url, headers;
      
      // Użyj proxy jeśli skonfigurowany (omija CORS)
      if (this.proxyUrl) {
        console.log('🔄 Using proxy:', this.proxyUrl);
        url = `${this.proxyUrl}?url=${encodeURIComponent(lockmeUrl)}`;
        headers = {
          'X-LockMe-Token': this.accessToken,
          'Content-Type': 'application/json'
        };
      } else {
        // Direct API call (może mieć CORS issues)
        url = lockmeUrl;
        headers = {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        };
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        // Jeśli 401 - token invalid, spróbuj refresh
        if (response.status === 401) {
          console.log('🔄 401 error - próbuję refresh...');
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry z nowym tokenem
            return this.fetchSessions(dateFrom, dateTo);
          }
        }
        throw new Error(`LockMe API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data || [];
      
    } catch (error) {
      console.error('LockMe fetch error:', error);
      toast('Błąd pobierania z LockMe: ' + error.message, 'err');
      return null;
    }
  },
  
  // Konwertuj booking z LockMe na sesję Familock
  convertBookingToSession(booking) {
    return {
      id: uid(),
      date: booking.date, // Format: YYYY-MM-DD
      players: booking.participants || 0,
      revenue: booking.total_paid || 0,
      discount: booking.discount_amount || 0,
      note: `LockMe #${booking.id}${booking.room_name ? ' - ' + booking.room_name : ''}`,
      lockme_id: booking.id // Zachowaj ID żeby nie importować dwa razy
    };
  },
  
  // Import sesji z LockMe
  async importSessions(dateFrom, dateTo) {
    toast('Pobieram dane z LockMe...');
    
    const bookings = await this.fetchSessions(dateFrom, dateTo);
    if (!bookings) return;
    
    if (bookings.length === 0) {
      toast('Brak sesji w wybranym okresie');
      return;
    }
    
    // Sprawdź które już są zaimportowane
    const existingLockmeIds = S.sessions
      .filter(s => s.lockme_id)
      .map(s => s.lockme_id);
    
    const newBookings = bookings.filter(b => !existingLockmeIds.includes(b.id));
    
    if (newBookings.length === 0) {
      toast('Wszystkie sesje już zaimportowane');
      return;
    }
    
    // Dodaj nowe sesje
    newBookings.forEach(booking => {
      const session = this.convertBookingToSession(booking);
      S.sessions.push(session);
    });
    
    save();
    renderSessions();
    
    toast(`✓ Zaimportowano ${newBookings.length} sesji z LockMe!`);
  },
  
  // Pokaż dialog importu
  showImportDialog() {
    if (!this.isConfigured()) {
      this.showConfig();
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'auth-modal open';
    modal.id = 'lockme-import-modal';
    
    // Domyślnie ostatni miesiąc
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const dateToStr = today.toISOString().split('T')[0];
    const dateFromStr = lastMonth.toISOString().split('T')[0];
    
    modal.innerHTML = `
      <div class="auth-box">
        <div class="auth-title">📥 Import z LockMe</div>
        <div class="auth-subtitle">Wybierz zakres dat</div>
        
        <div class="field">
          <label>Od daty</label>
          <input type="date" id="lockme-date-from" value="${dateFromStr}"/>
        </div>
        
        <div class="field">
          <label>Do daty</label>
          <input type="date" id="lockme-date-to" value="${dateToStr}"/>
        </div>
        
        <div style="font-size:11px;color:var(--txm);margin-bottom:14px">
          Import pobierze TYLKO zagrane sesje (status: completed).<br>
          Sesje już zaimportowane zostaną pominięte.
        </div>
        
        <button class="btn bp w100" onclick="LOCKME.executeImport()">Importuj sesje</button>
        <button class="btn bg w100 mt3" onclick="LOCKME.closeImportDialog()">Anuluj</button>
      </div>
    `;
    document.body.appendChild(modal);
  },
  
  closeImportDialog() {
    const modal = document.getElementById('lockme-import-modal');
    if (modal) modal.remove();
  },
  
  async executeImport() {
    const dateFrom = document.getElementById('lockme-date-from').value;
    const dateTo = document.getElementById('lockme-date-to').value;
    
    if (!dateFrom || !dateTo) {
      toast('Podaj zakres dat', 'err');
      return;
    }
    
    this.closeImportDialog();
    await this.importSessions(dateFrom, dateTo);
  }
};

// Załaduj config przy starcie
window.LOCKME.loadConfig();

console.log('✓ LockMe integration loaded');

// ════════════════════════════════════════════════════════════════
//  UI COMPONENTS - DODAJ DO SEKCJI SESSIONS
// ════════════════════════════════════════════════════════════════

// Funkcja do renderowania przycisku LockMe w sekcji Sessions
window.renderLockMeButton = function() {
  const sessionsHeader = document.querySelector('#pg-sessions .ph.frow');
  if (!sessionsHeader) return;
  
  // Sprawdź czy przycisk już istnieje
  if (document.getElementById('lockme-sync-btn')) return;
  
  // Dodaj przycisk obok "Dodaj sesję"
  const buttonContainer = sessionsHeader.querySelector('div:last-child') || 
                          sessionsHeader;
  
  const lockmeBtn = document.createElement('button');
  lockmeBtn.id = 'lockme-sync-btn';
  lockmeBtn.className = 'btn bg';
  lockmeBtn.style.marginLeft = '8px';
  lockmeBtn.innerHTML = '🔄 LockMe';
  lockmeBtn.onclick = () => window.LOCKME.showImportDialog();
  
  buttonContainer.appendChild(lockmeBtn);
  
  // Dodaj przycisk konfiguracji w Settings
  const settingsPage = document.getElementById('pg-settings');
  if (settingsPage && !document.getElementById('lockme-settings-card')) {
    const firstCol = settingsPage.querySelector('.two-col > div:first-child');
    if (firstCol) {
      const card = document.createElement('div');
      card.id = 'lockme-settings-card';
      card.className = 'card mb4';
      card.innerHTML = `
        <div class="ct"><span class="ct-ic">🔗</span>Integracja LockMe</div>
        <p style="font-size:12px;color:var(--txm);margin-bottom:13px;line-height:1.7">
          ${window.LOCKME.isConfigured() 
            ? '✓ Skonfigurowane - możesz importować sesje' 
            : 'Skonfiguruj API aby importować sesje automatycznie'}
        </p>
        <button class="btn bg w100" onclick="LOCKME.showConfig()">
          ${window.LOCKME.isConfigured() ? '⚙️ Zmień konfigurację' : '🔧 Skonfiguruj LockMe'}
        </button>
      `;
      firstCol.appendChild(card);
    }
  }
};

// Renderuj przycisk gdy renderujesz Sessions
const originalRenderSessions = window.renderSessions;
window.renderSessions = function() {
  if (originalRenderSessions) originalRenderSessions();
  setTimeout(() => window.renderLockMeButton(), 100);
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🎯 DOM loaded, initializing...');
    
    // Setup navigation
    document.querySelectorAll('.ni, .mni').forEach(el => {
      el.addEventListener('click', () => go(el.dataset.tab));
    });
    
    // Initialize Supabase sync if available
    if (window.initSupabase) {
      await window.initSupabase();
    }
    
    // Initial render
    renderDash();
    
    console.log('✅ Familock ready!');
    toast('Aplikacja gotowa');
  } catch (err) {
    console.error('❌ Initialization error:', err);
    toast('Błąd inicjalizacji', 'err');
  }
});

// ════════════════════════════════════════════════════════════════
//  KSEF INTEGRATION - Import faktur kosztowych
//  Krajowy System e-Faktur - automatyczny import
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  PDF DROP ZONE & LOCKME SETUP
// ════════════════════════════════════════════════════════════════

// Setup PDF drop zone when costs tab is opened
const originalGo = window.go;
window.go = function(tab) {
  originalGo(tab);
  
  // If going to costs tab, setup PDF drop zone
  if (tab === 'costs') {
    setTimeout(() => {
      if (window.setupPDFDropZone) {
        window.setupPDFDropZone();
      }
    }, 100);
  }
  
  // If going to sessions tab, setup LockMe button
  if (tab === 'sessions') {
    setTimeout(() => {
      if (window.renderLockMeButton) {
        window.renderLockMeButton();
      }
    }, 100);
  }
};

// Setup on page load
setTimeout(() => {
  // Setup PDF drop zone if costs tab is active
  const costsTab = document.getElementById('pg-costs');
  if (costsTab && costsTab.classList.contains('on')) {
    if (window.setupPDFDropZone) {
      window.setupPDFDropZone();
    }
  }
  
  // Setup LockMe button if sessions tab is active
  const sessionsTab = document.getElementById('pg-sessions');
  if (sessionsTab && sessionsTab.classList.contains('on')) {
    if (window.renderLockMeButton) {
      window.renderLockMeButton();
    }
  }
}, 500);

console.log('✓ app.js loaded');
