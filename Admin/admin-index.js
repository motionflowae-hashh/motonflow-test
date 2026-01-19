import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { ref, get, set, remove, onValue, getDatabase, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsOwXNtfaWwEh3qaM0suXafOg6CYLzDC8",
  authDomain: "uamtv-c031c.firebaseapp.com",
  databaseURL: "https://uamtv-c031c-default-rtdb.firebaseio.com",
  projectId: "uamtv-c031c",
  storageBucket: "uamtv-c031c.firebasestorage.app",
  messagingSenderId: "9790917697",
  appId: "1:9790917697:web:275c8347b7688e0ac38ac0",
  measurementId: "G-RSXW1XBVQZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase();

console.log('🔥 Firebase initialized:', app.name);
console.log('💾 Database ready:', db.app.name);
console.log('📍 Database URL:', app.options.databaseURL);

let currentUser = {
  uid: 'admin-user',
  nickname: 'Admin User',
  role: 'admin'
};
let currentPage = 'dashboard';
let usersData = {};
let postsData = {};
let tools = {};

// Accessibility helpers
function setAriaExpanded(el, expanded) {
  try { el.setAttribute('aria-expanded', expanded ? 'true' : 'false'); } catch (e) {}
}

// Simple debounce
function debounce(fn, wait = 100) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Focus trap for sidebar (mobile)
function trapFocus(container) {
  const focusable = container.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return () => {};
  let first = focusable[0];
  let last = focusable[focusable.length - 1];

  function handleKey(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'Escape') {
      // Close sidebar on escape
      container.classList.remove('mobile-visible');
      setAriaExpanded(document.getElementById('menuToggle'), false);
    }
  }

  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}

function initializeDashboard() {
  loadUsers();
  loadPosts();
  loadTools();
  renderPage('dashboard');
  setupEventListeners();
  // Ensure correct sidebar state on load
  handleResize();
}

let cleanupFocusTrap = null;
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentPage = item.dataset.page;
      renderPage(currentPage);
      
      // Close mobile sidebar
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('mobile-visible');
        setAriaExpanded(document.getElementById('menuToggle'), false);
        if (cleanupFocusTrap) { cleanupFocusTrap(); cleanupFocusTrap = null; }
      }
    });
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  menuToggle.addEventListener('click', () => {
    const visible = sidebar.classList.toggle('mobile-visible');
    setAriaExpanded(menuToggle, visible);

    // When visible on mobile, trap focus
    if (visible && window.innerWidth <= 768) {
      cleanupFocusTrap = trapFocus(sidebar);
      // focus first focusable
      const firstFocusable = sidebar.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) firstFocusable.focus();
    } else if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('mobile-visible') && 
        !sidebar.contains(e.target) && 
        !menuToggle.contains(e.target)) {
      sidebar.classList.remove('mobile-visible');
      setAriaExpanded(menuToggle, false);
      if (cleanupFocusTrap) { cleanupFocusTrap(); cleanupFocusTrap = null; }
    }
  });

  // Close sidebar with Escape (global)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('sidebar');
      if (sidebar.classList.contains('mobile-visible')) {
        sidebar.classList.remove('mobile-visible');
        setAriaExpanded(document.getElementById('menuToggle'), false);
        if (cleanupFocusTrap) { cleanupFocusTrap(); cleanupFocusTrap = null; }
      }
    }
  });

  // Responsive resize handling
  window.addEventListener('resize', debounce(handleResize, 120));
}

function handleResize() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const menuToggle = document.getElementById('menuToggle');

  if (window.innerWidth <= 768) {
    // On small screens, hide sidebar by default
    sidebar.classList.remove('mobile-visible');
    setAriaExpanded(menuToggle, false);
    mainContent.classList.add('expanded');
  } else {
    // On larger screens ensure sidebar visible
    sidebar.classList.remove('mobile-hidden');
    mainContent.classList.remove('expanded');
    setAriaExpanded(menuToggle, false);
    if (cleanupFocusTrap) { cleanupFocusTrap(); cleanupFocusTrap = null; }
  }
}

function loadUsers() {
  onValue(ref(db, 'users'), (snapshot) => {
    if (snapshot.exists()) {
      usersData = snapshot.val();
      if (currentPage === 'users') renderUsersPage();
      if (currentPage === 'dashboard') renderDashboard();
    }
  });
}

function loadPosts() {
  onValue(ref(db, 'posts'), (snapshot) => {
    postsData = {};
    if (snapshot.exists()) {
      postsData = snapshot.val();
    }
    updatePendingPostsBadge();
    if (currentPage === 'posts') renderPostsPage();
    if (currentPage === 'dashboard') renderDashboard();
  });
}

function loadTools() {
  onValue(ref(db, "tools"), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(data);
      
      const allTools = [];
      Object.keys(data).forEach(userId => {
        if (typeof data[userId] === 'object') {
          Object.keys(data[userId]).forEach(toolKey => {
            allTools.push({
              ...data[userId][toolKey],
              key: `${userId}/${toolKey}`,
              sellerId: userId
            });
          });
        }
      });
      
      tools = allTools.length;
      console.log("tool count: " + tools);
    }
  });
}

function updatePendingPostsBadge() {
  const pendingCount = Object.values(postsData).filter(post => post.status === 'pending').length;
  const badge = document.getElementById('pendingPostsBadge');
  if (!badge) return;
  badge.textContent = pendingCount;
  badge.style.display = pendingCount > 0 ? 'block' : 'none';
}

function renderPage(page) {
  switch(page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'users':
      renderUsersPage();
      break;
    case 'posts':
      renderPostsPage();
      break;
    case 'tools':
      renderToolsPage();
      break;
    case 'reports':
      renderReportsPage();
      break;
    case 'analytics':
      renderAnalyticsPage();
      break;
    case 'settings':
      renderSettingsPage();
      break;
  }
}

function renderDashboard() {
  const totalUsers = Object.keys(usersData).length;
  const activeUsers = Object.values(usersData).filter(u => u.status === 'online').length;
  const totalPosts = Object.keys(postsData).length;
  const pendingPosts = Object.values(postsData).filter(p => p.status === 'pending').length;

  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Dashboard Overview</h2>
      <p class="page-subtitle">Monitor your platform's activity and metrics</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(0, 255, 127, 0.2), rgba(0, 255, 127, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="stat-trend up">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            12%
          </div>
        </div>
        <div class="stat-value">${totalUsers}</div>
        <div class="stat-label">Total Users</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(0, 191, 255, 0.2), rgba(0, 191, 255, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="stat-trend up">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            8%
          </div>
        </div>
        <div class="stat-value">${activeUsers}</div>
        <div class="stat-label">Active Users</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="stat-trend up">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            24%
          </div>
        </div>
        <div class="stat-value">${tools}</div>
        <div class="stat-label">Total Tools</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-trend ${pendingPosts > 0 ? 'up' : 'down'}">
            ${pendingPosts}
          </div>
        </div>
        <div class="stat-value">${pendingPosts}</div>
        <div class="stat-label">Pending Posts</div>
      </div>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">Recent Users</h3>
        <button class="filter-tab active" onclick="window.location.href='#users'">View All</button>
      </div>
      <div class="table-container">
        ${renderRecentUsersTable()}
      </div>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">Pending Posts</h3>
        <button class="filter-tab active" onclick="window.location.href='#posts'">View All</button>
      </div>
      <div class="table-container">
        ${renderPendingPostsTable()}
      </div>
    </div>
  `;
}

function renderRecentUsersTable() {
  const recentUsers = Object.entries(usersData)
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    .slice(0, 5);

  if (recentUsers.length === 0) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <h3>No users yet</h3>
        <p>Users will appear here once they register</p>
      </div>
    `;
  }

  // On small screens render card list for better readability
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return `
      <div class="mobile-list">
        ${recentUsers.map(([userId, user]) => `
          <div class="mobile-card">
            <div class="user-avatar" style="width:56px;height:56px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:2px solid #3a3a3a;">
              ${user.avatar ? `<img src="${user.avatar}" alt="${user.nickname}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              `}
            </div>
            <div class="meta">
              <div class="title">${user.nickname || 'Anonymous'}</div>
              <div class="subtitle">${user.email || 'N/A'} • ${user.role || 'user'}</div>
              <div class="subtitle">Status: <span class="status-badge ${user.status === 'online' ? 'active' : 'inactive'}">${user.status || 'offline'}</span></div>
              <div class="subtitle">Joined: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Desktop/tablet fallback
  return `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        ${recentUsers.map(([userId, user]) => `
          <tr>
            <td>
              <div class="user-cell">
                <div class="user-avatar">
                  ${user.avatar ? `<img src="${user.avatar}" alt="${user.nickname}">` : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  `}
                </div>
                <div class="user-info">
                  <div class="user-name">${user.nickname || 'Anonymous'}</div>
                </div>
              </div>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.role || 'user'}</td>
            <td><span class="status-badge ${user.status === 'online' ? 'active' : 'inactive'}">${user.status || 'offline'}</span></td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPendingPostsTable() {
  const pendingPosts = Object.entries(postsData)
    .filter(([_, post]) => post.status === 'pending')
    .slice(0, 5);

  if (pendingPosts.length === 0) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>No pending posts</h3>
        <p>All posts have been reviewed</p>
      </div>
    `;
  }

  // Mobile: render stacked post cards for better readability
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return `
      <div class="mobile-list">
        ${pendingPosts.map(([postId, post]) => {
          const author = usersData[post.authorId] || {};
          return `
            <div class="mobile-card">
              <div style="flex-shrink:0;">
                <div class="user-avatar" style="width:56px;height:56px;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px solid #3a3a3a;">
                  ${author.avatar ? `<img src="${author.avatar}" alt="${author.nickname}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  `}
                </div>
              </div>
              <div class="meta">
                <div class="title">${post.title || 'Untitled'}</div>
                <div class="subtitle">${post.content ? post.content.substring(0, 120) + '...' : 'No content'}</div>
                <div class="subtitle">Author: ${author.nickname || 'Anonymous'} • ${post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A'}</div>
                <div class="actions">
                  <button class="action-btn success" onclick="approvePost('${postId}')">Approve</button>
                  <button class="action-btn danger" onclick="rejectPost('${postId}')">Reject</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Desktop/tablet fallback (table)
  return `
    <table>
      <thead>
        <tr>
          <th>Author</th>
          <th>Post</th>
          <th>Created</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pendingPosts.map(([postId, post]) => {
          const author = usersData[post.authorId] || {};
          return `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-avatar">
                    ${author.avatar ? `<img src="${author.avatar}" alt="${author.nickname}">` : `
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    `}
                  </div>
                  <div class="user-info">
                    <div class="user-name">${author.nickname || 'Anonymous'}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="post-preview">
                  <div class="post-title">${post.title || 'Untitled'}</div>
                  <div class="post-excerpt">${post.content ? post.content.substring(0, 100) + '...' : 'No content'}</div>
                </div>
              </td>
              <td>${post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A'}</td>
              <td><span class="status-badge ${post.status || 'pending'}">${post.status || 'pending'}</span></td>
              <td>
                ${post.status === 'pending' ? `
                  <button class="action-btn success" onclick="approvePost('${postId}')">Approve</button>
                  <button class="action-btn danger" onclick="rejectPost('${postId}')">Reject</button>
                ` : post.status === 'approved' ? `
                  <button class="action-btn danger" onclick="rejectPost('${postId}')">Reject</button>
                  <button class="action-btn danger" onclick="deletePost('${postId}')">Delete</button>
                ` : `
                  <button class="action-btn success" onclick="approvePost('${postId}')">Approve</button>
                  <button class="action-btn danger" onclick="deletePost('${postId}')">Delete</button>
                `}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderUsersPage() {
  const usersList = Object.entries(usersData);

  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">User Management</h2>
      <p class="page-subtitle">Manage all registered users on your platform</p>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">All Users (${usersList.length})</h3>
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all">All</button>
          <button class="filter-tab" data-filter="online">Online</button>
          <button class="filter-tab" data-filter="admin">Admins</button>
        </div>
      </div>
      <div class="table-container">
        ${renderUsersTable(usersList)}
      </div>
    </div>
  `;

  // Add filter functionality
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const filter = tab.dataset.filter;
      let filteredUsers = usersList;
      
      if (filter === 'online') {
        filteredUsers = usersList.filter(([_, user]) => user.status === 'online');
      } else if (filter === 'admin') {
        filteredUsers = usersList.filter(([_, user]) => user.role === 'admin');
      }
      
      document.querySelector('.table-container').innerHTML = renderUsersTable(filteredUsers);
    });
  });
}

function renderUsersTable(usersList) {
  if (usersList.length === 0) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <h3>No users found</h3>
        <p>No users match the selected filter</p>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${usersList.map(([userId, user]) => `
          <tr>
            <td>
              <div class="user-cell">
                <div class="user-avatar">
                  ${user.avatar ? `<img src="${user.avatar}" alt="${user.nickname}">` : `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  `}
                </div>
                <div class="user-info">
                  <div class="user-name">${user.nickname || 'Anonymous'}</div>
                  <div class="user-email">${userId.substring(0, 8)}...</div>
                </div>
              </div>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.role || 'user'}</td>
            <td><span class="status-badge ${user.status === 'online' ? 'active' : 'inactive'}">${user.status || 'offline'}</span></td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>
              ${userId !== currentUser.uid ? `
                <button class="action-btn primary" onclick="toggleUserRole('${userId}', '${user.role}')">${user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</button>
                <button class="action-btn danger" onclick="deleteUser('${userId}')">Delete</button>
              ` : '<span style="color: #888;">Current User</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPostsPage() {
  const postsList = Object.entries(postsData);

  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Post Management</h2>
      <p class="page-subtitle">Review and manage user posts</p>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">All Posts (${postsList.length})</h3>
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all">All</button>
          <button class="filter-tab" data-filter="pending">Pending</button>
          <button class="filter-tab" data-filter="approved">Approved</button>
          <button class="filter-tab" data-filter="rejected">Rejected</button>
        </div>
      </div>
      <div class="table-container">
        ${renderPostsTable(postsList)}
      </div>
    </div>
  `;

  // Add filter functionality
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const filter = tab.dataset.filter;
      let filteredPosts = postsList;
      
      if (filter !== 'all') {
        filteredPosts = postsList.filter(([_, post]) => post.status === filter);
      }
      
      document.querySelector('.table-container').innerHTML = renderPostsTable(filteredPosts);
    });
  });
}

function renderPostsTable(postsList) {
  if (postsList.length === 0) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>No posts found</h3>
        <p>No posts match the selected filter</p>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Author</th>
          <th>Post</th>
          <th>Created</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${postsList.map(([postId, post]) => {
          const author = usersData[post.authorId] || {};
          return `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-avatar">
                    ${author.avatar ? `<img src="${author.avatar}" alt="${author.nickname}">` : `
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    `}
                  </div>
                  <div class="user-info">
                    <div class="user-name">${author.nickname || 'Anonymous'}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="post-preview">
                  <div class="post-title">${post.title || 'Untitled'}</div>
                  <div class="post-excerpt">${post.content ? post.content.substring(0, 100) + '...' : 'No content'}</div>
                </div>
              </td>
              <td>${post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A'}</td>
              <td><span class="status-badge ${post.status || 'pending'}">${post.status || 'pending'}</span></td>
              <td>
                ${post.status === 'pending' ? `
                  <button class="action-btn success" onclick="approvePost('${postId}')">Approve</button>
                  <button class="action-btn danger" onclick="rejectPost('${postId}')">Reject</button>
                ` : post.status === 'approved' ? `
                  <button class="action-btn danger" onclick="rejectPost('${postId}')">Reject</button>
                  <button class="action-btn danger" onclick="deletePost('${postId}')">Delete</button>
                ` : `
                  <button class="action-btn success" onclick="approvePost('${postId}')">Approve</button>
                  <button class="action-btn danger" onclick="deletePost('${postId}')">Delete</button>
                `}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderToolsPage() {
  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Tools Management</h2>
      <p class="page-subtitle">Manage all tools uploaded by users</p>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">All Tools (${tools})</h3>
        <div class="filter-tabs">
          <button class="filter-tab active">All</button>
          <button class="filter-tab">Pending</button>
          <button class="filter-tab">Approved</button>
        </div>
      </div>
      <div class="table-container">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <h3>Tools Management Coming Soon</h3>
          <p>Tools management features will be available in the next update</p>
        </div>
      </div>
    </div>
  `;
}

function renderReportsPage() {
  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Reports</h2>
      <p class="page-subtitle">Review user reports and take action</p>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">Recent Reports (3)</h3>
        <div class="filter-tabs">
          <button class="filter-tab active">All</button>
          <button class="filter-tab">Pending</button>
          <button class="filter-tab">Resolved</button>
        </div>
      </div>
      <div class="table-container">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h3>Reports feature coming soon</h3>
          <p>User reporting system will be available in the next update</p>
        </div>
      </div>
    </div>
  `;
}

function renderAnalyticsPage() {
  const totalUsers = Object.keys(usersData).length;
  const activeUsers = Object.values(usersData).filter(u => u.status === 'online').length;
  const totalPosts = Object.keys(postsData).length;

  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Analytics</h2>
      <p class="page-subtitle">Track your platform's growth and engagement</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(0, 255, 127, 0.2), rgba(0, 255, 127, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
        </div>
        <div class="stat-value">${((activeUsers / totalUsers) * 100 || 0).toFixed(1)}%</div>
        <div class="stat-label">Active User Rate</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
        </div>
        <div class="stat-value">${totalPosts}</div>
        <div class="stat-label">Total Content</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(0, 191, 255, 0.2), rgba(0, 191, 255, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          </div>
        </div>
        <div class="stat-value">${(totalPosts / Math.max(totalUsers, 1)).toFixed(1)}</div>
        <div class="stat-label">Posts per User</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.1));">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="stat-value">$0</div>
        <div class="stat-label">Revenue</div>
      </div>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">Platform Statistics</h3>
      </div>
      <div style="padding: 40px; text-align: center; color: #888;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px; opacity: 0.3;"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        <h3 style="color: #888; margin-bottom: 8px;">Advanced Analytics Coming Soon</h3>
        <p>Detailed charts and graphs will be available in future updates</p>
      </div>
    </div>
  `;
}

function renderSettingsPage() {
  document.getElementById('contentArea').innerHTML = `
    <div class="page-header">
      <h2 class="page-title">Settings</h2>
      <p class="page-subtitle">Configure your admin dashboard preferences</p>
    </div>

    <div class="data-section">
      <div class="section-header">
        <h3 class="section-title">General Settings</h3>
      </div>
      <div style="padding: 32px;">
        <div style="margin-bottom: 24px;">
          <label style="display: block; color: #fff; font-weight: 600; margin-bottom: 8px;">Site Name</label>
          <input type="text" value="BlackBox" style="width: 100%; max-width: 400px; padding: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid #2a2a2a; border-radius: 10px; color: #fff; font-size: 0.9em;">
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; color: #fff; font-weight: 600; margin-bottom: 8px;">Admin Email</label>
          <input type="email" value="admin@blackbox.com" style="width: 100%; max-width: 400px; padding: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid #2a2a2a; border-radius: 10px; color: #fff; font-size: 0.9em;">
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; color: #fff; font-weight: 600; margin-bottom: 12px;">Post Moderation</label>
          <label style="display: flex; align-items: center; gap: 12px; color: #e0e0e0; cursor: pointer;">
            <input type="checkbox" checked style="width: 20px; height: 20px; cursor: pointer;">
            Require admin approval for new posts
          </label>
        </div>
        <button class="action-btn primary" style="margin-top: 24px;" onclick="showToast('Settings saved successfully', 'success')">Save Changes</button>
      </div>
    </div>

    <div class="data-section" style="margin-top: 24px;">
      <div class="section-header">
        <h3 class="section-title">Danger Zone</h3>
      </div>
      <div style="padding: 32px;">
        <p style="color: #888; margin-bottom: 16px;">These actions are irreversible. Please be careful.</p>
        <button class="action-btn danger" onclick="if(confirm('Are you sure you want to clear all posts?')) showToast('Feature coming soon', 'error')">Clear All Posts</button>
        <button class="action-btn danger" style="margin-left: 12px;" onclick="if(confirm('Are you sure you want to reset the database?')) showToast('Feature coming soon', 'error')">Reset Database</button>
      </div>
    </div>
  `;
}

// Action functions
window.approvePost = async function(postId) {
  try {
    await update(ref(db, `posts/${postId}`), {
      status: 'approved',
      approvedAt: Date.now(),
      approvedBy: currentUser.uid
    });
    showToast('Post approved successfully', 'success');
  } catch (error) {
    console.error('Error approving post:', error);
    showToast('Failed to approve post', 'error');
  }
};

window.rejectPost = async function(postId) {
  try {
    await update(ref(db, `posts/${postId}`), {
      status: 'rejected',
      rejectedAt: Date.now(),
      rejectedBy: currentUser.uid
    });
    showToast('Post rejected', 'success');
  } catch (error) {
    console.error('Error rejecting post:', error);
    showToast('Failed to reject post', 'error');
  }
};

window.deletePost = async function(postId) {
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
    return;
  }

  try {
    await remove(ref(db, `posts/${postId}`));
    showToast('Post deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting post:', error);
    showToast('Failed to delete post', 'error');
  }
};

window.toggleUserRole = async function(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  
  if (!confirm(`Are you sure you want to ${newRole === 'admin' ? 'make this user an admin' : 'remove admin privileges from this user'}?`)) {
    return;
  }

  try {
    await update(ref(db, `users/${userId}`), {
      role: newRole
    });
    showToast(`User role updated to ${newRole}`, 'success');
  } catch (error) {
    console.error('Error updating user role:', error);
    showToast('Failed to update user role', 'error');
  }
};

window.deleteUser = async function(userId) {
  if (!confirm('Are you sure you want to delete this user? This will also delete all their posts and data. This action cannot be undone.')) {
    return;
  }

  try {
    // Delete user
    await remove(ref(db, `users/${userId}`));
    
    // Delete user's posts
    const userPosts = Object.entries(postsData).filter(([_, post]) => post.authorId === userId);
    for (const [postId] of userPosts) {
      await remove(ref(db, `posts/${postId}`));
    }
    
    // Delete user's friend connections
    await remove(ref(db, `friends/${userId}`));
    
    // Delete friend requests
    await remove(ref(db, `friendRequests/${userId}`));
    
    showToast('User deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting user:', error);
    showToast('Failed to delete user', 'error');
  }
};

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${type === 'success' 
        ? '<polyline points="20 6 9 17 4 12"/>' 
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
      }
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.4s ease reverse';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeDashboard();
});