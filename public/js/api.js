// ============================================================
// DEBUG DUNGEON — API Integration Layer
// api.js: auth, session management, API calls for classroom play
// ============================================================

/* global GameState, LEVELS, UI, showScreen, renderLevelSelect, loadProgress */

const DD_API = (() => {

  const BASE = '/api';

  // ── Session state (loaded from localStorage) ───────────────
  let token = localStorage.getItem('dd_token');
  let role  = localStorage.getItem('dd_role');   // 'student' | 'teacher' | null
  let userName = localStorage.getItem('dd_user_name');

  // ── Public getters ─────────────────────────────────────────
  function isLoggedIn()  { return !!token; }
  function isStudent()   { return role === 'student'; }
  function isTeacher()   { return role === 'teacher'; }
  function getUserName() { return userName || ''; }
  function getRole()     { return role; }

  // ── Generic fetch wrapper ──────────────────────────────────
  async function request(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);

    try {
      const res = await fetch(BASE + path, opts);
      if (res.status === 401) {
        logout();
        return { ok: false, error: 'Session expired. Please log in again.' };
      }
      return await res.json();
    } catch (err) {
      console.error('API request failed:', err);
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }

  // ── Session management ─────────────────────────────────────
  function setSession(newToken, newRole, name) {
    token    = newToken;
    role     = newRole;
    userName = name;
    localStorage.setItem('dd_token', newToken);
    localStorage.setItem('dd_role', newRole);
    localStorage.setItem('dd_user_name', name);
    updateAuthIndicator();
  }

  function logout() {
    token    = null;
    role     = null;
    userName = null;
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_role');
    localStorage.removeItem('dd_user_name');
    updateAuthIndicator();
  }

  // ── Student actions ────────────────────────────────────────
  async function joinClassroom(code, firstName) {
    const data = await request('POST', '/student/join', {
      classroom_code: code.toUpperCase().trim(),
      first_name: firstName.trim(),
    });
    if (data.ok) {
      setSession(data.token, 'student', data.student.first_name);
    }
    return data;
  }

  async function submitAttempt(attemptData) {
    if (!isStudent()) return;
    try {
      return await request('POST', '/attempts', attemptData);
    } catch (e) {
      // Never let a failed API call break the game
      console.error('Failed to submit attempt:', e);
      return { ok: false };
    }
  }

  async function syncProgress() {
    if (!isStudent()) return null;
    const data = await request('GET', '/progress');
    if (data && data.ok) return data;
    return null;
  }

  // ── Teacher actions ────────────────────────────────────────
  async function teacherRegister(name, password) {
    const data = await request('POST', '/teacher/register', { name, password });
    if (data.ok) {
      setSession(data.token, 'teacher', data.teacher.name);
    }
    return data;
  }

  async function teacherLogin(name, password) {
    const data = await request('POST', '/teacher/login', { name, password });
    if (data.ok) {
      setSession(data.token, 'teacher', data.teacher.name);
    }
    return data;
  }

  async function getClassrooms() {
    return request('GET', '/classrooms');
  }

  async function createClassroom(name) {
    return request('POST', '/classrooms', { name });
  }

  async function getDashboard(code) {
    return request('GET', `/classrooms/${code}/dashboard`);
  }

  // ── Auth UI indicator ──────────────────────────────────────
  function updateAuthIndicator() {
    const el = document.getElementById('auth-indicator');
    if (!el) return;

    if (isLoggedIn()) {
      const icon = isTeacher() ? '👩‍🏫' : '🎓';
      el.innerHTML = `
        <span class="auth-info">${icon} ${userName}</span>
        <button class="btn-auth-logout" id="logout-btn">LOGOUT</button>
      `;
      el.classList.remove('hidden');
      document.getElementById('logout-btn').addEventListener('click', () => {
        logout();
        showScreen('start-screen');
      });
    } else {
      el.innerHTML = '';
      el.classList.add('hidden');
    }
  }

  // ── Auth overlay UI ────────────────────────────────────────
  function init() {
    // Wire up start screen auth buttons
    const joinBtn    = document.getElementById('join-btn');
    const teacherBtn = document.getElementById('teacher-btn');

    if (joinBtn)    joinBtn.addEventListener('click', () => showAuthForm('student'));
    if (teacherBtn) teacherBtn.addEventListener('click', () => showAuthForm('teacher'));

    // Close overlay on backdrop click
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideAuthOverlay();
      });
    }

    // If already logged in, update indicator
    updateAuthIndicator();

    // If teacher is logged in and on start screen, redirect to dashboard
    if (isTeacher()) {
      showScreen('dashboard-screen');
      if (typeof Dashboard !== 'undefined') Dashboard.load();
    }
  }

  function showAuthForm(mode) {
    const overlay = document.getElementById('auth-overlay');
    const content = document.getElementById('auth-form-content');
    if (!overlay || !content) return;

    if (mode === 'student') {
      content.innerHTML = `
        <div class="overlay-title" style="color:var(--cyan)">JOIN CLASSROOM</div>
        <div class="auth-field">
          <label for="auth-code">Classroom Code</label>
          <input type="text" id="auth-code" maxlength="6" placeholder="e.g. P3CS7X"
                 style="text-transform:uppercase" autocomplete="off">
        </div>
        <div class="auth-field">
          <label for="auth-name">Your First Name</label>
          <input type="text" id="auth-name" maxlength="50" placeholder="e.g. Alice" autocomplete="off">
        </div>
        <div id="auth-error" class="auth-error"></div>
        <div class="overlay-buttons">
          <button class="btn-primary" id="auth-submit-btn">JOIN</button>
          <button class="btn-secondary" id="auth-cancel-btn">CANCEL</button>
        </div>
      `;

      document.getElementById('auth-submit-btn').addEventListener('click', handleStudentJoin);
      document.getElementById('auth-cancel-btn').addEventListener('click', hideAuthOverlay);
      // Enter key submits
      content.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleStudentJoin(); });
      });

    } else {
      content.innerHTML = `
        <div class="overlay-title" style="color:var(--orange)">TEACHER LOGIN</div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">LOGIN</button>
          <button class="auth-tab" data-tab="register">REGISTER</button>
        </div>
        <div class="auth-field">
          <label for="auth-tname">Teacher Name</label>
          <input type="text" id="auth-tname" maxlength="100" placeholder="e.g. Mr. Smith" autocomplete="off">
        </div>
        <div class="auth-field">
          <label for="auth-tpass">Password</label>
          <input type="password" id="auth-tpass" maxlength="255" placeholder="Password" autocomplete="off">
        </div>
        <div id="auth-error" class="auth-error"></div>
        <div class="overlay-buttons">
          <button class="btn-primary" id="auth-submit-btn">LOGIN</button>
          <button class="btn-secondary" id="auth-cancel-btn">CANCEL</button>
        </div>
      `;

      let authMode = 'login';
      const submitBtn = document.getElementById('auth-submit-btn');

      content.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          content.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          authMode = tab.dataset.tab;
          submitBtn.textContent = authMode === 'login' ? 'LOGIN' : 'REGISTER';
        });
      });

      submitBtn.addEventListener('click', () => handleTeacherAuth(authMode));
      document.getElementById('auth-cancel-btn').addEventListener('click', hideAuthOverlay);
      content.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleTeacherAuth(authMode); });
      });
    }

    overlay.classList.remove('hidden');
    // Auto-focus first input
    setTimeout(() => content.querySelector('input')?.focus(), 50);
  }

  async function handleStudentJoin() {
    const code = document.getElementById('auth-code')?.value || '';
    const name = document.getElementById('auth-name')?.value || '';
    const errEl = document.getElementById('auth-error');

    if (!code.trim() || !name.trim()) {
      errEl.textContent = 'Please fill in both fields.';
      return;
    }

    errEl.textContent = 'Joining...';
    const data = await joinClassroom(code, name);

    if (data.ok) {
      hideAuthOverlay();
      showScreen('level-select-screen');
      // Sync progress from server
      const progress = await syncProgress();
      if (progress && progress.completed_levels) {
        progress.completed_levels.forEach(idx => {
          if (!GameState.completedLevels.includes(idx)) {
            GameState.completedLevels.push(idx);
          }
        });
        localStorage.setItem('dd_completed', JSON.stringify(GameState.completedLevels));
      }
      renderLevelSelect();
    } else {
      // Handle Laravel validation errors
      if (data.errors) {
        const firstErr = Object.values(data.errors)[0];
        errEl.textContent = Array.isArray(firstErr) ? firstErr[0] : firstErr;
      } else {
        errEl.textContent = data.error || 'Failed to join. Check the code and try again.';
      }
    }
  }

  async function handleTeacherAuth(mode) {
    const name = document.getElementById('auth-tname')?.value || '';
    const pass = document.getElementById('auth-tpass')?.value || '';
    const errEl = document.getElementById('auth-error');

    if (!name.trim() || !pass.trim()) {
      errEl.textContent = 'Please fill in both fields.';
      return;
    }

    errEl.textContent = mode === 'login' ? 'Logging in...' : 'Registering...';

    const data = mode === 'login'
      ? await teacherLogin(name.trim(), pass)
      : await teacherRegister(name.trim(), pass);

    if (data.ok) {
      hideAuthOverlay();
      showScreen('dashboard-screen');
      if (typeof Dashboard !== 'undefined') Dashboard.load();
    } else {
      const msg = data.error || data.message || 'Authentication failed.';
      // Handle Laravel validation errors
      if (data.errors) {
        const firstErr = Object.values(data.errors)[0];
        errEl.textContent = Array.isArray(firstErr) ? firstErr[0] : firstErr;
      } else {
        errEl.textContent = msg;
      }
    }
  }

  function hideAuthOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  return {
    init, isLoggedIn, isStudent, isTeacher, getUserName, getRole, logout,
    joinClassroom, submitAttempt, syncProgress,
    teacherLogin, teacherRegister, getClassrooms, createClassroom, getDashboard,
    updateAuthIndicator,
  };
})();
