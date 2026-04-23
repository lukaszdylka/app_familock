// ════════════════════════════════════════════════════════════════
//  FAMILOCK - SUPABASE SYNC MODULE
//  Synchronizacja danych między urządzeniami
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://xyivrakegwybwhmmcawq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5aXZyYWtlZ3d5YndobW1jYXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTkxMjYsImV4cCI6MjA5MjE3NTEyNn0.68zlOkL7AOtX6qEukCpEV6R0rpo0bQ1dG9U7pPhVGvo';

let supabaseClient = null;
let currentUser = null;
let syncEnabled = false;
let realtimeChannel = null;

// ── Initialize Supabase ──
async function initSupabase() {
  // Render UI immediately to show login button
  renderSyncUI();
  
  if (!window.supabase) {
    console.warn('Supabase SDK not loaded - sync disabled');
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Export for auth wall
    window.supabaseClient = supabaseClient;
    
    // Check for existing session
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    
    if (session) {
      currentUser = session.user;
      await onUserLogin();
    } else {
      // No session - show auth wall
      if (window.hideApp) window.hideApp();
    }

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        await onUserLogin();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        onUserLogout();
      }
    });

    // Update UI after checking session
    renderSyncUI();
    console.log('✓ Supabase initialized');
  } catch (error) {
    console.error('Supabase init error:', error);
    renderSyncUI(); // Show UI even on error
  }
}

// ── Push local data to cloud ──
async function pushToCloud() {
  if (!currentUser || !supabaseClient || !window.S) return false;

  try {
    const { error } = await supabaseClient
      .from('familock_data')
      .upsert({
        user_id: currentUser.id,
        data: window.S,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    localStorage.setItem('fl4_last_sync', new Date().toISOString());
    console.log('✓ Pushed to cloud');
    return true;
  } catch (error) {
    console.error('Push error:', error);
    return false;
  }
}

// ── Pull data from cloud ──
async function pullFromCloud() {
  if (!currentUser || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('familock_data')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data?.data) {
      const cloudTime = new Date(data.updated_at);
      const localSyncTime = localStorage.getItem('fl4_last_sync');
      const localTime = localSyncTime ? new Date(localSyncTime) : new Date(0);

      // Use newer version
      if (cloudTime > localTime) {
        console.log('☁️ Cloud data is newer, pulling...');
        window.S = data.data;
        
        // Ensure tasks array exists
        if (!window.S.tasks) window.S.tasks = [];
        
        // Save to localStorage
        localStorage.setItem('fl4', JSON.stringify(window.S));
        localStorage.setItem('fl4_last_sync', data.updated_at);

        // Re-render current view
        const currentTab = document.querySelector('.ni.on,.mni.on')?.dataset?.tab || 'dash';
        if (window.renderTab) {
          window.renderTab(currentTab);
        } else if (window.renderDash) {
          window.renderDash();
        }

        if (window.toast) window.toast('Pobrano dane z chmury');
      } else {
        console.log('📱 Local data is current');
      }
    }
  } catch (error) {
    console.error('Pull error:', error);
  }
}

// ── User logged in ──
async function onUserLogin() {
  syncEnabled = true;
  renderSyncUI();
  
  // Show main app (hide auth wall)
  if (window.showApp) window.showApp();
  
  // Pull latest data
  await pullFromCloud();

  // Subscribe to realtime updates
  if (supabaseClient && currentUser) {
    // Unsubscribe from previous channel if exists
    if (realtimeChannel) {
      supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
      .channel('familock_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'familock_data',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          console.log('🔄 Remote change detected');
          await pullFromCloud();
        }
      )
      .subscribe();

    console.log('✓ Realtime subscribed');
  }

  if (window.toast) window.toast('Zalogowano - synchronizacja włączona');
}

// ── User logged out ──
function onUserLogout() {
  syncEnabled = false;
  
  // Hide main app (show auth wall)
  if (window.hideApp) window.hideApp();
  
  // Unsubscribe from realtime
  if (realtimeChannel && supabaseClient) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  renderSyncUI();
  if (window.toast) window.toast('Wylogowano');
}

// ── Render sync widget UI ──
function renderSyncUI() {
  let widget = document.getElementById('sync-widget');
  
  // Remove existing widget
  if (widget) widget.remove();

  // Create new widget
  widget = document.createElement('div');
  widget.id = 'sync-widget';
  widget.className = 'sync-widget';

  if (currentUser) {
    const email = currentUser.email.split('@')[0];
    widget.innerHTML = `
      <div class="sync-status">
        <div class="sync-dot ok"></div>
        <span>${email}</span>
      </div>
      <button class="btn bg bsm" onclick="signOut()">Wyloguj</button>
    `;
  } else {
    widget.innerHTML = `
      <div class="sync-status">
        <div class="sync-dot"></div>
        <span>Offline</span>
      </div>
      <button class="btn bp bsm" onclick="showAuthModal()">Zaloguj się</button>
    `;
  }

  document.body.appendChild(widget);
}

// ── Show auth modal ──
function showAuthModal() {
  let modal = document.getElementById('auth-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-box">
        <div class="auth-title">🔐 Synchronizacja</div>
        <div class="auth-subtitle">Zaloguj się aby synchronizować dane między urządzeniami</div>
        
        <div class="auth-tabs">
          <button class="auth-tab on" onclick="switchAuthTab('login')">Logowanie</button>
          <button class="auth-tab" onclick="switchAuthTab('register')">Rejestracja</button>
        </div>

        <div id="auth-login">
          <div class="field">
            <label>Email</label>
            <input type="email" id="login-email" placeholder="twoj@email.pl"/>
          </div>
          <div class="field">
            <label>Hasło</label>
            <input type="password" id="login-pass" placeholder="••••••••"/>
          </div>
          <button class="btn bp w100" onclick="handleLogin()">Zaloguj</button>
        </div>

        <div id="auth-register" style="display:none">
          <div class="field">
            <label>Email</label>
            <input type="email" id="reg-email" placeholder="twoj@email.pl"/>
          </div>
          <div class="field">
            <label>Hasło</label>
            <input type="password" id="reg-pass" placeholder="min. 6 znaków"/>
          </div>
          <button class="btn bp w100" onclick="handleRegister()">Zarejestruj</button>
        </div>

        <button class="btn bg w100 mt3" onclick="closeAuthModal()">Anuluj</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('open');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    const isActive = (tab === 'login' && t.textContent.includes('Logowanie')) ||
                     (tab === 'register' && t.textContent.includes('Rejestracja'));
    t.classList.toggle('on', isActive);
  });

  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
}

// ── Handle login ──
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;

  if (!email || !password) {
    if (window.toast) window.toast('Podaj email i hasło', 'err');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    closeAuthModal();
    // Auth state change will trigger onUserLogin
  } catch (error) {
    console.error('Login error:', error);
    if (window.toast) window.toast('Błąd logowania: ' + error.message, 'err');
  }
}

// ── Handle registration ──
async function handleRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pass').value;

  if (!email || !password) {
    if (window.toast) window.toast('Podaj email i hasło', 'err');
    return;
  }

  if (password.length < 6) {
    if (window.toast) window.toast('Hasło musi mieć min. 6 znaków', 'err');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (window.toast) window.toast('Sprawdź email i potwierdź konto');
    closeAuthModal();
  } catch (error) {
    console.error('Registration error:', error);
    if (window.toast) window.toast('Błąd rejestracji: ' + error.message, 'err');
  }
}

// ── Sign out ──
async function signOut() {
  if (!supabaseClient) return;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    
    // Auth state change will trigger onUserLogout
  } catch (error) {
    console.error('Signout error:', error);
    if (window.toast) window.toast('Błąd wylogowania', 'err');
  }
}

// ══ Export functions for global scope ══
window.initSupabase = initSupabase;
window.pushToCloud = pushToCloud;
window.pullFromCloud = pullFromCloud;
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.signOut = signOut;
window.syncEnabled = () => syncEnabled;

console.log('📡 Sync module loaded');

// Render sync widget immediately when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderSyncUI();
  });
} else {
  // DOM already loaded
  renderSyncUI();
}
