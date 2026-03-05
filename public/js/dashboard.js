// ============================================================
// DEBUG DUNGEON — Teacher Dashboard
// dashboard.js: classroom management, leaderboard, student detail
// ============================================================

/* global DD_API, showScreen, LEVELS */

const Dashboard = (() => {

  let currentClassroom = null;  // { id, name, code }
  let pollTimer = null;

  // ── Load dashboard ─────────────────────────────────────────
  async function load() {
    const el = document.getElementById('dashboard-content');
    if (!el) return;

    el.innerHTML = '<div class="dash-loading">Loading classrooms...</div>';

    const data = await DD_API.getClassrooms();
    if (!data || !data.ok) {
      el.innerHTML = '<div class="dash-loading">Failed to load classrooms.</div>';
      return;
    }

    if (data.classrooms.length === 0) {
      renderNoClassrooms(el);
    } else if (data.classrooms.length === 1) {
      // Auto-select the only classroom
      currentClassroom = data.classrooms[0];
      await renderDashboard(el, currentClassroom.code);
    } else {
      renderClassroomPicker(el, data.classrooms);
    }
  }

  // ── No classrooms yet ──────────────────────────────────────
  function renderNoClassrooms(el) {
    el.innerHTML = `
      <div class="dash-header">
        <span class="dash-title">TEACHER DASHBOARD</span>
        <div class="dash-header-actions">
          <button class="btn-auth-logout" id="dash-logout">LOGOUT</button>
        </div>
      </div>
      <div class="dash-empty">
        <p>You don't have any classrooms yet.</p>
        <p>Create one so students can join!</p>
        <div class="dash-create-form">
          <input type="text" id="new-class-name" placeholder="Classroom name" maxlength="100" class="dash-input">
          <button class="btn-primary" id="create-class-btn">CREATE CLASSROOM</button>
        </div>
        <div id="create-class-error" class="auth-error"></div>
      </div>
    `;
    wireLogout();
    wireCreateClassroom();
  }

  // ── Classroom picker (multiple classrooms) ─────────────────
  function renderClassroomPicker(el, classrooms) {
    el.innerHTML = `
      <div class="dash-header">
        <span class="dash-title">TEACHER DASHBOARD</span>
        <div class="dash-header-actions">
          <button class="btn-secondary dash-btn-sm" id="dash-new-class">+ NEW</button>
          <button class="btn-auth-logout" id="dash-logout">LOGOUT</button>
        </div>
      </div>
      <div class="dash-section-title">SELECT CLASSROOM</div>
      <div class="dash-class-grid">
        ${classrooms.map(c => `
          <div class="dash-class-card" data-code="${c.code}">
            <div class="dash-class-name">${esc(c.name)}</div>
            <div class="dash-class-code">${c.code}</div>
            <div class="dash-class-count">${c.student_count} student${c.student_count !== 1 ? 's' : ''}</div>
          </div>
        `).join('')}
      </div>
      <div id="create-class-inline" class="hidden">
        <div class="dash-create-form">
          <input type="text" id="new-class-name" placeholder="Classroom name" maxlength="100" class="dash-input">
          <button class="btn-primary dash-btn-sm" id="create-class-btn">CREATE</button>
          <button class="btn-secondary dash-btn-sm" id="cancel-create-btn">CANCEL</button>
        </div>
        <div id="create-class-error" class="auth-error"></div>
      </div>
    `;

    wireLogout();

    // Classroom card clicks
    el.querySelectorAll('.dash-class-card').forEach(card => {
      card.addEventListener('click', async () => {
        const code = card.dataset.code;
        currentClassroom = classrooms.find(c => c.code === code);
        await renderDashboard(el, code);
      });
    });

    // New classroom toggle
    const newBtn = document.getElementById('dash-new-class');
    const inlineForm = document.getElementById('create-class-inline');
    if (newBtn && inlineForm) {
      newBtn.addEventListener('click', () => inlineForm.classList.remove('hidden'));
      document.getElementById('cancel-create-btn')?.addEventListener('click', () => {
        inlineForm.classList.add('hidden');
      });
      wireCreateClassroom();
    }
  }

  // ── Main dashboard view for a classroom ────────────────────
  async function renderDashboard(el, code) {
    el.innerHTML = '<div class="dash-loading">Loading dashboard...</div>';

    const data = await DD_API.getDashboard(code);
    if (!data || !data.ok) {
      el.innerHTML = '<div class="dash-loading">Failed to load dashboard.</div>';
      return;
    }

    const { classroom, students } = data;
    currentClassroom = classroom;

    el.innerHTML = `
      <div class="dash-header">
        <span class="dash-title">${esc(classroom.name)}</span>
        <div class="dash-header-actions">
          <span class="dash-code-display">CODE: <strong>${classroom.code}</strong></span>
          <button class="btn-secondary dash-btn-sm" id="dash-back-classes">CLASSROOMS</button>
          <button class="btn-auth-logout" id="dash-logout">LOGOUT</button>
        </div>
      </div>
      <div class="dash-code-banner">
        Share this code with your students: <strong>${classroom.code}</strong>
      </div>
      ${students.length === 0
        ? '<div class="dash-empty"><p>No students have joined yet.</p><p>Share the code above so students can join!</p></div>'
        : renderLeaderboard(students)
      }
    `;

    wireLogout();

    // Back to classrooms
    document.getElementById('dash-back-classes')?.addEventListener('click', () => {
      stopPolling();
      load();
    });

    // Student detail expand
    el.querySelectorAll('.dash-student-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.dataset.studentId);
        const student = students.find(s => s.id === id);
        if (student) toggleStudentDetail(row, student);
      });
    });

    // Start polling
    startPolling(code);
  }

  // ── Leaderboard table ──────────────────────────────────────
  function renderLeaderboard(students) {
    const rows = students.map((s, i) => `
      <tr class="dash-student-row" data-student-id="${s.id}">
        <td class="dash-rank">${i + 1}</td>
        <td class="dash-name">${esc(s.first_name)}</td>
        <td class="dash-progress">
          <span class="dash-progress-bar">
            <span class="dash-progress-fill" style="width:${Math.round(s.levels_completed / s.total_levels * 100)}%"></span>
          </span>
          <span>${s.levels_completed}/${s.total_levels}</span>
        </td>
        <td class="dash-stars">${'*'.repeat(s.stars)}${s.stars > 0 ? '' : '-'}</td>
        <td class="dash-attempts">${s.total_attempts}</td>
        <td class="dash-eff">${s.efficiency}%</td>
        <td class="dash-last">${formatTimeAgo(s.last_active)}</td>
      </tr>
    `).join('');

    return `
      <div class="dash-section-title">LEADERBOARD</div>
      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>#</th>
              <th>STUDENT</th>
              <th>PROGRESS</th>
              <th>STARS</th>
              <th>RUNS</th>
              <th>EFF</th>
              <th>LAST</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ── Student detail accordion ───────────────────────────────
  function toggleStudentDetail(row, student) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains('dash-detail-row')) {
      existing.remove();
      row.classList.remove('expanded');
      return;
    }

    // Close any other open detail
    document.querySelectorAll('.dash-detail-row').forEach(r => r.remove());
    document.querySelectorAll('.dash-student-row.expanded').forEach(r => r.classList.remove('expanded'));

    row.classList.add('expanded');

    const detailRow = document.createElement('tr');
    detailRow.className = 'dash-detail-row';

    let levelHtml = '';
    for (let i = 0; i < (student.total_levels || 7); i++) {
      const lv = student.levels[String(i)];
      const levelDef = (typeof LEVELS !== 'undefined' && LEVELS[i]) ? LEVELS[i] : null;
      const levelName = levelDef ? levelDef.name : `Level ${i + 1}`;

      if (!lv) {
        levelHtml += `
          <div class="dash-level-item dash-level-locked">
            <span class="dash-level-num">${i + 1}</span>
            <span class="dash-level-name">${esc(levelName)}</span>
            <span class="dash-level-status">not attempted</span>
          </div>
        `;
      } else {
        const statusClass = lv.completed ? 'dash-level-pass' : 'dash-level-fail';
        const statusIcon = lv.completed ? 'PASS' : 'IN PROGRESS';
        const okPct = lv.ok_ratio !== null ? Math.round(lv.ok_ratio * 100) : '-';

        levelHtml += `
          <div class="dash-level-item ${statusClass}">
            <span class="dash-level-num">${i + 1}</span>
            <span class="dash-level-name">${esc(levelName)}</span>
            <span class="dash-level-status">${statusIcon}</span>
            <span class="dash-level-stat">Attempts: ${lv.attempts}</span>
            <span class="dash-level-stat">Blocks: ${lv.best_blocks}/${lv.block_limit}</span>
            <span class="dash-level-stat">OK: ${okPct}%</span>
          </div>
        `;
      }
    }

    detailRow.innerHTML = `<td colspan="7"><div class="dash-detail-content">
      <div class="dash-detail-title">${esc(student.first_name)} — Level Detail</div>
      <div class="dash-level-list">${levelHtml}</div>
    </div></td>`;

    row.after(detailRow);
  }

  // ── Polling ────────────────────────────────────────────────
  function startPolling(code) {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (!currentClassroom || currentClassroom.code !== code) return;
      const el = document.getElementById('dashboard-content');
      if (!el) return;
      // Only refresh if dashboard screen is active
      const screen = document.getElementById('dashboard-screen');
      if (!screen || !screen.classList.contains('active')) return;

      const data = await DD_API.getDashboard(code);
      if (data && data.ok) {
        // Re-render leaderboard body only (preserve header)
        const tbody = el.querySelector('.dash-table tbody');
        if (tbody && data.students) {
          // Full re-render to keep it simple
          await renderDashboard(el, code);
        }
      }
    }, 30000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── Create classroom ───────────────────────────────────────
  function wireCreateClassroom() {
    const btn = document.getElementById('create-class-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const input = document.getElementById('new-class-name');
      const errEl = document.getElementById('create-class-error');
      const name = input?.value?.trim();
      if (!name) {
        if (errEl) errEl.textContent = 'Please enter a classroom name.';
        return;
      }
      if (errEl) errEl.textContent = 'Creating...';
      const data = await DD_API.createClassroom(name);
      if (data && data.ok) {
        // Show the new code prominently before loading dashboard
        const el = document.getElementById('dashboard-content');
        if (el) {
          el.innerHTML = `
            <div class="dash-header">
              <span class="dash-title">CLASSROOM CREATED!</span>
              <div class="dash-header-actions">
                <button class="btn-auth-logout" id="dash-logout">LOGOUT</button>
              </div>
            </div>
            <div class="dash-code-created">
              <div class="dash-code-created-label">Your classroom code is:</div>
              <div class="dash-code-created-value">${data.classroom.code}</div>
              <div class="dash-code-created-hint">Share this code with your students so they can join.</div>
              <button class="btn-primary" id="dash-go-btn">GO TO DASHBOARD</button>
            </div>
          `;
          wireLogout();
          document.getElementById('dash-go-btn')?.addEventListener('click', () => load());
        }
      } else {
        if (errEl) errEl.textContent = data?.error || 'Failed to create classroom.';
      }
    });
  }

  // ── Logout ─────────────────────────────────────────────────
  function wireLogout() {
    document.getElementById('dash-logout')?.addEventListener('click', () => {
      stopPolling();
      DD_API.logout();
      showScreen('start-screen');
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return '-';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return { load, stopPolling };
})();
