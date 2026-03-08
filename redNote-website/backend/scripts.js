/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let currentSuggestion = "";
let classifier;
// (State is managed by the `S` object below)
/* ═══════════════════════════════════════════════════════════════════
   ███████╗██╗██████╗ ███████╗██████╗  █████╗ ███████╗███████╗
   ██╔════╝██║██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝
   █████╗  ██║██████╔╝█████╗  ██████╔╝███████║███████╗█████╗
   ██╔══╝  ██║██╔══██╗██╔══╝  ██╔══██╗██╔══██║╚════██║██╔══╝
   ██║     ██║██║  ██║███████╗██████╔╝██║  ██║███████║███████╗
   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝

   ▸ STEP 1: Replace FIREBASE_CONFIG below with your project's values
     Firebase Console → Project Settings → Your Apps → SDK setup

   ▸ STEP 2: Enable Email/Password auth
     Firebase Console → Authentication → Sign-in method → Email/Password

   ▸ STEP 3: Create Firestore database
     Firebase Console → Firestore Database → Create database → Start in test mode
     Then add the rules from FIREBASE_SETUP.md

   ▸ STEP 4: Create Firestore composite indexes (auto-prompted on first use,
     or copy from FIREBASE_SETUP.md)
═══════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBbC67cQhTG6e6kxnxg37USavBYqAjr1YM",
  authDomain:        "rednote-hackton.firebaseapp.com",
  projectId:         "rednote-hackton",
  storageBucket:     "rednote-hackton.firebasestorage.app",
  messagingSenderId: "157982968865",
  appId:             "1:157982968865:web:9f35c9e3ce5013402a6760",
  measurementId:     "G-PDYNYTF1XC"
};

/* ═══════════════════════════════════════════════
   INIT + CONFIG CHECK
═══════════════════════════════════════════════ */
const CONFIG_IS_PLACEHOLDER = FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY';

let app, auth, db;

if (CONFIG_IS_PLACEHOLDER) {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('config-warning').classList.add('show');
} else {
  app  = firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db   = firebase.firestore();
  // Enable offline persistence
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  initApp();
}

/* ═══════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════ */
const S = {
  user:          null,   // Firebase Auth user
  profile:       null,   // Firestore user doc
  activeTab:     'chats',
  openGroupId:   null,
  openGroupData: null,
  searchFilter:  'all',
  allPublicGroups: [],   // cached for search filtering
  myGroupsData:  [],     // live from onSnapshot
  newGroup: { isPublic:true, color:'#D91C1C', emoji:'💬' },
};

// Unsubscribe functions for live listeners
let unsubMyGroups   = null;
let unsubPublicGroups = null;
let unsubMessages   = null;

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const EMOJIS = ['💬','🚀','🎨','💡','🔥','📈','🤖','🌍','🎯','🛠️','📚','🎮'];
const COLORS = ['#D91C1C','#0D1B2A','#2563EB','#7C3AED','#059669','#D97706','#DB2777'];

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const esc     = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const initial = s => (s||'?').charAt(0).toUpperCase();
const uid     = () => Math.random().toString(36).slice(2,10);

function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t); y.setDate(y.getDate()-1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}
function setBtn(id, text, disabled) {
  const b = document.getElementById(id);
  if (!b) return;
  b.textContent = text;
  b.disabled = disabled;
}
function skeletonHTML(n=3) {
  return Array(n).fill(`
    <div class="skeleton-item">
      <div class="skeleton skel-avatar"></div>
      <div class="skel-lines">
        <div class="skeleton skel-line1"></div>
        <div class="skeleton skel-line2"></div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════
   APP INIT — AUTH STATE OBSERVER
═══════════════════════════════════════════════ */
function initApp() {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      // Fetch user profile from Firestore
      try {
        const snap = await db.collection('users').doc(firebaseUser.uid).get();
        S.user    = firebaseUser;
        S.profile = snap.exists ? snap.data() : {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.email.split('@')[0],
          displayName: firebaseUser.email.split('@')[0],
        };
        showMainApp();
      } catch (e) {
        console.error('Profile fetch error', e);
        showAuthScreen();
      }
    } else {
      S.user = null; S.profile = null;
      teardownListeners();
      showAuthScreen();
    }
    hideLoading();
  });
}

function hideLoading() {
  const ol = document.getElementById('loading-overlay');
  if (!ol) return; // Already removed — safe to ignore
  ol.classList.add('hidden');
  setTimeout(() => {
    const el = document.getElementById('loading-overlay');
    if (el) el.remove();
  }, 500);
}

function showAuthScreen() {
  document.getElementById('auth-view').style.display = 'flex';
  document.getElementById('main-app').style.display  = 'none';
}

function showMainApp() {
  document.getElementById('auth-view').style.display = 'none';
  const ma = document.getElementById('main-app');
  ma.style.display = 'flex';
  ma.style.flexDirection = 'column';
  ma.style.overflow = 'hidden';

  // Update header + profile
  const p = S.profile;
  document.getElementById('header-avatar').textContent = initial(p.displayName || p.username);
  document.getElementById('profile-big-avatar').textContent = initial(p.displayName || p.username);
  document.getElementById('profile-name').textContent  = p.displayName || p.username;
  document.getElementById('profile-uname').textContent = '@' + p.username;
  document.getElementById('profile-email').textContent = p.email;

  // Start live listeners
  startMyGroupsListener();
  startPublicGroupsListener();
  switchTab('chats');
}

function teardownListeners() {
  if (unsubMyGroups)     { unsubMyGroups();     unsubMyGroups = null; }
  if (unsubPublicGroups) { unsubPublicGroups(); unsubPublicGroups = null; }
  if (unsubMessages)     { unsubMessages();     unsubMessages = null; }
}

/* ═══════════════════════════════════════════════
   AUTH — LOGIN / REGISTER
═══════════════════════════════════════════════ */
let authMode = 'login';

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode==='login');
  document.getElementById('tab-register').classList.toggle('active', mode==='register');
  document.getElementById('register-fields').style.display = mode==='register' ? 'block' : 'none';
  document.getElementById('auth-submit-btn').textContent = mode==='login' ? 'Sign In' : 'Create Account';
  showError('auth-error', '');
}

async function handleAuth() {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  if (!email || !password) return showError('auth-error','Please fill all fields');
  if (password.length < 6)  return showError('auth-error','Password must be at least 6 characters');

  setBtn('auth-submit-btn', 'Please wait…', true);
  showError('auth-error', '');

  try {
    if (authMode === 'register') {
      const username    = document.getElementById('input-username').value.trim().toLowerCase().replace(/[^a-z0-9._]/g,'');
      const displayName = document.getElementById('input-displayname').value.trim();
      if (!username || !displayName) throw new Error('All fields are required');
      if (username.length < 3)       throw new Error('Username must be 3+ characters');
      if (!/^[a-z0-9._]+$/.test(username)) throw new Error('Username: letters, numbers, . and _ only');

      // Step 1: Create Firebase Auth account FIRST (this logs the user in,
      // which satisfies Firestore security rules for the next queries)
      const cred = await auth.createUserWithEmailAndPassword(email, password);

      try {
        // Step 2: Now authenticated — check username uniqueness
        const existing = await db.collection('users').where('username','==',username).limit(1).get();
        if (!existing.empty) {
          // Username taken — delete the auth account we just made and bail
          await cred.user.delete();
          throw new Error('Username is already taken — please choose another');
        }

        // Step 3: Username is free — save the profile
        await db.collection('users').doc(cred.user.uid).set({
          uid: cred.user.uid, email, username, displayName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          groupIds: [],
        });
        // Auth state observer fires and calls showMainApp()

      } catch (profileErr) {
        // If profile save failed for any reason, clean up the auth account
        // so the user isn't stuck with a broken half-created account
        if (cred.user && profileErr.message !== 'Username is already taken — please choose another') {
          await cred.user.delete().catch(() => {});
        }
        throw profileErr;
      }

    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (err) {
    let msg = err.message || 'Something went wrong';
    if (err.code === 'auth/user-not-found')    msg = 'No account found with this email';
    if (err.code === 'auth/wrong-password')     msg = 'Incorrect password';
    if (err.code === 'auth/email-already-in-use') msg = 'Email already registered — try signing in';
    if (err.code === 'auth/invalid-email')      msg = 'Invalid email address';
    if (err.code === 'auth/too-many-requests')  msg = 'Too many attempts. Try again later';
    showError('auth-error', msg);
    setBtn('auth-submit-btn', authMode==='login'?'Sign In':'Create Account', false);
  }
}

async function logout() {
  await auth.signOut();
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
function switchTab(tab) {
  S.activeTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+tab).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.getElementById('create-group-btn').style.display = tab==='chats' ? 'flex' : 'none';
  if (tab==='profile') renderProfile();
  if (tab==='search')  renderSearch();
}

/* ═══════════════════════════════════════════════
   MY GROUPS — LIVE LISTENER
═══════════════════════════════════════════════ */
function startMyGroupsListener() {
  if (unsubMyGroups) unsubMyGroups();

  // Show skeletons while loading
  document.getElementById('chats-list').innerHTML = skeletonHTML();

  unsubMyGroups = db.collection('groups')
    .where('memberIds', 'array-contains', S.user.uid)
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(
      (snap) => {
        S.myGroupsData = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        renderChats();
      },
      (err) => {
        console.warn('Groups listener error — index may be missing:', err.message);
        // Fallback: query without ordering
        db.collection('groups')
          .where('memberIds','array-contains', S.user.uid)
          .get()
          .then(s => {
            S.myGroupsData = s.docs.map(d=>({id:d.id,...d.data()}));
            renderChats();
          });
      }
    );
}

/* ═══════════════════════════════════════════════
   PUBLIC GROUPS — LIVE LISTENER
═══════════════════════════════════════════════ */
function startPublicGroupsListener() {
  if (unsubPublicGroups) unsubPublicGroups();

  unsubPublicGroups = db.collection('groups')
    .where('isPublic','==',true)
    .orderBy('createdAt','desc')
    .onSnapshot(
      (snap) => {
        S.allPublicGroups = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        if (S.activeTab === 'search') renderSearch();
      },
      (err) => {
        console.warn('Public groups listener error:', err.message);
        db.collection('groups').where('isPublic','==',true).get()
          .then(s => {
            S.allPublicGroups = s.docs.map(d=>({id:d.id,...d.data()}));
            if (S.activeTab==='search') renderSearch();
          });
      }
    );
}

/* ═══════════════════════════════════════════════
   RENDER — CHATS SCREEN
═══════════════════════════════════════════════ */
const lockSVG  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const globeSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const usersSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

function renderChats() {
  const list   = document.getElementById('chats-list');
  const groups = S.myGroupsData;
  document.getElementById('chats-count').textContent = groups.length + ' joined';

  if (groups.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="empty-title">No chats yet</div>
        <div class="empty-sub">Join public groups from Discover,<br/>or tap + to create your own.</div>
      </div>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const preview = g.lastMessagePreview
      ? `${esc(g.lastMessageSender||'')}: ${esc(g.lastMessagePreview)}`
      : 'No messages yet';
    const timeStr = g.lastMessageAt ? fmtTime(g.lastMessageAt) : '';
    return `
      <div class="chat-item" onclick="openChat('${g.id}')">
        <div class="chat-avatar" style="background:${g.color||'#D91C1C'}">
          ${g.emoji||initial(g.name)}
          <div class="privacy-dot">${g.isPublic ? globeSVG : lockSVG}</div>
        </div>
        <div class="chat-info">
          <div class="chat-name">${esc(g.name)}</div>
          <div class="chat-preview">${preview}</div>
        </div>
        <div class="chat-meta">
          <span class="chat-time">${timeStr}</span>
          <span class="member-pill">${(g.memberIds||[]).length} members</span>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   RENDER — DISCOVER / SEARCH SCREEN
═══════════════════════════════════════════════ */
let searchFilterState = 'all';

function setFilter(f) {
  searchFilterState = f;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter===f));
  renderSearch();
}

function filterSearch() { renderSearch(); }

function renderSearch() {
  const q      = (document.getElementById('search-input')?.value || '').toLowerCase();
  const uid    = S.user?.uid;
  const groups = S.allPublicGroups;

  if (groups.length === 0) {
    document.getElementById('search-results').innerHTML = skeletonHTML(4);
    return;
  }

  const filtered = groups.filter(g => {
    const matchQ  = !q || g.name.toLowerCase().includes(q) || (g.description||'').toLowerCase().includes(q);
    const joined  = uid && (g.memberIds||[]).includes(uid);
    const matchF  = searchFilterState==='all'
      || (searchFilterState==='joined' && joined)
      || (searchFilterState==='discover' && !joined);
    return matchQ && matchF;
  });

  const el = document.getElementById('search-results');
  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
        <div class="empty-title">No groups found</div>
        <div class="empty-sub">Try a different search or create your own</div>
      </div>`;
    return;
  }

  el.innerHTML = '<div style="padding:6px 0">' + filtered.map(g => {
    const joined = uid && (g.memberIds||[]).includes(uid);
    const btn    = joined
      ? `<button class="btn-open" onclick="openChat('${g.id}');event.stopPropagation()">Open</button>`
      : `<button class="btn-join" id="join-btn-${g.id}" onclick="joinGroup('${g.id}');event.stopPropagation()">Join</button>`;
    return `
      <div class="group-card">
        <div class="group-card-top">
          <div class="group-card-avatar" style="background:${g.color||'#D91C1C'};color:white">${g.emoji||initial(g.name)}</div>
          <div>
            <div class="group-card-name">${esc(g.name)}</div>
            <div class="group-card-desc">${esc(g.description||'')}</div>
          </div>
        </div>
        <div class="group-card-bottom">
          <div class="group-stats">${usersSVG} ${(g.memberIds||[]).length} members &nbsp;·&nbsp; ${globeSVG} Public</div>
          ${btn}
        </div>
      </div>`;
  }).join('') + '</div>';
}

async function joinGroup(groupId) {
  if (!S.user) return;
  const btn = document.getElementById('join-btn-'+groupId);
  if (btn) { btn.textContent = 'Joining…'; btn.disabled = true; }
  try {
    await db.collection('groups').doc(groupId).update({
      memberIds: firebase.firestore.FieldValue.arrayUnion(S.user.uid),
    });
    // Also update user's groupIds
    await db.collection('users').doc(S.user.uid).update({
      groupIds: firebase.firestore.FieldValue.arrayUnion(groupId),
    });
    // Snapshot listeners will auto-update both screens
  } catch (e) {
    console.error('Join error', e);
    if (btn) { btn.textContent = 'Join'; btn.disabled = false; }
  }
}

/* ═══════════════════════════════════════════════
   RENDER — PROFILE SCREEN
═══════════════════════════════════════════════ */
function renderProfile() {
  const n   = S.myGroupsData.length;
  const mod = S.myGroupsData.filter(g => g.creatorId === S.user?.uid).length;

  const descEl = document.getElementById('profile-group-desc');
  const countEl = document.getElementById('profile-group-count');
  const modEl = document.getElementById('profile-mod-desc');

  if (descEl) descEl.textContent = n + ' groups joined';
  if (countEl) countEl.textContent = n;
  if (modEl) modEl.textContent = mod + ' group' + (mod!==1?'s':'') + ' created';
}

/* ═══════════════════════════════════════════════
   CHAT SCREEN — OPEN / CLOSE
═══════════════════════════════════════════════ */
function openChat(groupId) {
  const g = S.myGroupsData.find(x=>x.id===groupId)
         || S.allPublicGroups.find(x=>x.id===groupId);
  if (!g) return;

  S.openGroupId   = groupId;
  S.openGroupData = g;
  const isMod = g.creatorId === S.user?.uid;

  const avatar = document.getElementById('chat-hdr-avatar');
  avatar.style.background = g.color||'#D91C1C';
  avatar.textContent = g.emoji||initial(g.name);

  document.getElementById('chat-hdr-name').textContent = g.name;
  document.getElementById('chat-hdr-sub').textContent  = (g.memberIds||[]).length + ' members · ' + (g.isPublic?'Public':'Private');
  document.getElementById('chat-mod-badge').style.display = isMod ? 'inline' : 'none';

  document.getElementById('messages-list').innerHTML = skeletonHTML(3);
  document.getElementById('chat-screen').classList.add('open');

  const inp = document.getElementById('msg-input');
  inp.value = ''; inp.style.height = '';
  document.getElementById('send-btn').disabled = true;

  startMessagesListener(groupId);
  setTimeout(() => inp.focus(), 360);
}

function closeChat() {
  document.getElementById('chat-screen').classList.remove('open');
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  S.openGroupId = null; S.openGroupData = null;
}

/* ═══════════════════════════════════════════════
   MESSAGES — REAL-TIME LISTENER (onSnapshot)
═══════════════════════════════════════════════ */
function startMessagesListener(groupId) {
  if (unsubMessages) unsubMessages();

  unsubMessages = db.collection('groups').doc(groupId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(100)          // ← pagination hook: change to startAfter(cursor) for history loading
    .onSnapshot(
      (snap) => {
        const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        renderMessages(msgs, groupId);
      },
      (err) => { console.error('Messages error', err); }
    );
}

/* ═══════════════════════════════════════════════
   RENDER — MESSAGES
═══════════════════════════════════════════════ */
function renderMessages(msgs, groupId) {
  const list  = document.getElementById('messages-list');
  const g     = S.openGroupData;
  const isMod = g?.creatorId === S.user?.uid;
  const myUid = S.user?.uid;

  if (msgs.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="empty-title">No messages yet</div>
        <div class="empty-sub">Be the first to say something!</div>
      </div>`;
    return;
  }

  const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;

  let html = '';
  let lastDate = null;

  msgs.forEach(msg => {
    const date = fmtDate(msg.createdAt);
    if (date && date !== lastDate) {
      html += `<div class="date-divider"><span>${date}</span></div>`;
      lastDate = date;
    }

    const isOut  = msg.userId === myUid;
    const canDel = isMod || isOut;
    const mini   = initial(msg.username);

    const delBtn = canDel
      ? `<button class="del-btn" onclick="deleteMessage('${groupId}','${msg.id}')" title="Delete">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
         </button>`
      : '';

    if (isOut) {
      html += `
        <div class="msg-row out">
          <div class="msg-wrap out">
            <div class="msg-bubble out">${esc(msg.text)}</div>
            <div class="msg-foot">${delBtn}<span class="msg-time">${fmtTime(msg.createdAt)}</span></div>
          </div>
        </div>`;
    } else {
      html += `
        <div class="msg-row">
          <div class="msg-mini-avatar" style="background:${g?.color||'#0D1B2A'}">${mini}</div>
          <div class="msg-wrap">
            <div class="msg-sender-name">@${esc(msg.username)}</div>
            <div class="msg-bubble in">${esc(msg.text)}</div>
            <div class="msg-foot"><span class="msg-time">${fmtTime(msg.createdAt)}</span>${delBtn}</div>
          </div>
        </div>`;
    }
  });

  list.innerHTML = html;
  if (wasAtBottom || true) list.scrollTop = list.scrollHeight;
}

/* ═══════════════════════════════════════════════
   SEND MESSAGE
═══════════════════════════════════════════════ */
async function sendMessage() {
  const inp  = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || !S.openGroupId || !S.user) return;

  let draft = {
    text: text,
    userId: S.user.uid,
    username: S.profile.username,
  };

  // ה-Middleware מחליף את הטקסט אם הוא פוגעני
  const processed = await runMiddleware(draft);

  // מנקים את שדה הקלט מיד אחרי הלחיצה
  inp.value = '';
  inp.style.height = '';
  document.getElementById('send-btn').disabled = true;

  const ts = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const msgRef = db.collection('groups').doc(S.openGroupId).collection('messages').doc();

  // שולחים את הטקסט (הוא יהיה או המקורי, או הודעת החסימה)
  batch.set(msgRef, {
    userId:    processed.userId,
    username:  processed.username,
    text:      processed.text,
    createdAt: ts,
    isSystemBlocked: processed.isSystemCheck || false // אופציונלי: לסימון ב-DB
  });

  const groupRef = db.collection('groups').doc(S.openGroupId);
  batch.update(groupRef, {
    lastMessageAt:      ts,
    lastMessagePreview: processed.text.slice(0, 80),
    lastMessageSender:  processed.username,
  });

  await batch.commit().catch(e => console.error('Send error', e));
}

// ── Middleware pipeline — plug AI keyboard or filters in here ──
// ── Middleware pipeline — plug AI keyboard or filters in here ──
async function runMiddleware(draft) {
  if (!window.classifier) {
    console.warn("AI המודל עדיין לא נטען");
    return draft;
  }

  try {
    // 1. הרצת המודל על הטקסט (Toxicity Check)
    const results = await window.classifier(draft.text);
    console.log("📊 תוצאות מהמודל שלך:", results);

    let isToxic = false;

    if (results && results.length > 0) {
      const topResult = results[0];
      if (topResult.label === 'LABEL_1' || topResult.label === 'toxic') {
        if (topResult.score > 0.5) isToxic = true;
      }
      else if (topResult.label === 'LABEL_0' && topResult.score < 0.5) {
        isToxic = true;
      }
    }

    if (isToxic) {
      // 2A. אם זה פוגעני - חסום
      console.warn("🚫 המודל זיהה תוכן פוגעני!");
      draft.text = "🚫 הודעה זו נחסמה על ידי ה-AI המקומי.";
      draft.isSystemBlocked = true;
    }

    // ✨ REMOVED the automatic grammar check override here.
    // Now, the text will only be changed if the user manually clicks "Apply" in the UI.

  } catch (err) {
    console.error("שגיאה בניתוח המודל או הדקדוק:", err);
  }

  return draft;
}

/* ═══════════════════════════════════════════════
   DELETE MESSAGE
═══════════════════════════════════════════════ */
async function deleteMessage(groupId, msgId) {
  try {
    await db.collection('groups').doc(groupId)
            .collection('messages').doc(msgId).delete();
    // onSnapshot auto-refreshes the UI
  } catch (e) {
    console.error('Delete error', e);
  }
}

/* ═══════════════════════════════════════════════
   INPUT HELPERS
═══════════════════════════════════════════════ */
function handleMsgKey(e) {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
let lastCheckedText = "";
let grammarTimer; // Variable to hold the timer //
// 1. Cleaned up autoResize (No more automatic timer!)
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  document.getElementById('send-btn').disabled = !el.value.trim();

  // Hide suggestion box if the user starts changing the text
  hideSuggestion();
}

// 2. The NEW Manual Check Function
let isCheckingGrammar = false; // Prevent double-clicks

async function manualGrammarCheck() {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text) return;

    const box = document.getElementById('suggestion-container');
    const textEl = document.getElementById('suggestion-text');

    textEl.innerText = "Checking... / בודק...";
    box.classList.remove('hidden');

    const corrected = await checkGrammar(text);

    // Only update if there's actually a correction to show
    if (corrected && corrected !== text) {
        currentSuggestion = corrected;
        const isHebrew = /[\u0590-\u05FF]/.test(corrected);
        textEl.style.direction = isHebrew ? 'rtl' : 'ltr';
        textEl.style.textAlign = isHebrew ? 'right' : 'left';

        const label = isHebrew ? 'הצעה לתיקון:' : 'Suggestion:';
        textEl.innerHTML = `<b>${label}</b> <span style="color:#000">"${corrected}"</span>`;
    } else {
        // If it's already perfect, hide the box
        hideSuggestion();
    }
}

async function checkForSuggestions(text) {
  if (!window.classifier) return;

  const results = await window.classifier(text);
  const isToxic = results && results[0].label === 'LABEL_1' && results[0].score > 0.5;

  if (isToxic) {
    const box = document.getElementById('ai-suggestion-box');
    const textEl = document.getElementById('suggestion-text');

    // Instead of blocking, we suggest a nicer version
    textEl.textContent = "This message seems a bit harsh. Want to soften it?";
    box.classList.remove('hidden');
  } else {
    hideSuggestion();
  }
}

// Ensure this variable is defined at the top of your script

function applySuggestion() {
  const inp = document.getElementById('msg-input');

  if (currentSuggestion) {
      inp.value = currentSuggestion;
  }

  hideSuggestion();
  autoResize(inp);
  currentSuggestion = ""; // Clear the memory so it doesn't leak into the next message
}

function hideSuggestion() {
  document.getElementById('ai-suggestion-box').classList.add('hidden');
}

/* ═══════════════════════════════════════════════
   CREATE GROUP MODAL
═══════════════════════════════════════════════ */
function openModal() {
  // Build pickers
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(e =>
    `<button class="emoji-btn${S.newGroup.emoji===e?' selected':''}" onclick="selectEmoji('${e}')">${e}</button>`
  ).join('');
  document.getElementById('color-grid').innerHTML = COLORS.map(c =>
    `<div class="color-swatch${S.newGroup.color===c?' selected':''}" style="background:${c}" onclick="selectColor('${c}')"></div>`
  ).join('');
  document.getElementById('new-group-name').value = '';
  document.getElementById('new-group-desc').value = '';
  S.newGroup.isPublic = true;
  const t = document.getElementById('privacy-toggle');
  t.classList.add('on'); t.classList.remove('off');
  updateToggleLabel();
  showError('modal-error', '');
  setBtn('create-btn','Create Group',false);
  document.getElementById('create-modal').classList.add('open');
}

function handleOverlayClick(e) {
  if (e.target===document.getElementById('create-modal')) closeModal();
}
function closeModal() { document.getElementById('create-modal').classList.remove('open'); }

function selectEmoji(e) {
  S.newGroup.emoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('selected', b.textContent===e));
}
function selectColor(c) {
  S.newGroup.color = c;
  document.querySelectorAll('.color-swatch').forEach(s => {
    const bg = s.style.backgroundColor || s.style.background;
    s.classList.toggle('selected', s.style.background===c);
  });
}
function togglePrivacy() {
  S.newGroup.isPublic = !S.newGroup.isPublic;
  document.getElementById('privacy-toggle').classList.toggle('on',  S.newGroup.isPublic);
  document.getElementById('privacy-toggle').classList.toggle('off', !S.newGroup.isPublic);
  updateToggleLabel();
}
function updateToggleLabel() {
  document.getElementById('toggle-label').textContent = S.newGroup.isPublic ? 'Public Group' : 'Private Group';
  document.getElementById('toggle-desc').textContent  = S.newGroup.isPublic ? 'Anyone can search & join' : 'Invite-only access';
}

async function createGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  const desc = document.getElementById('new-group-desc').value.trim();
  if (!name)         return showError('modal-error','Group name is required');
  if (name.length<3) return showError('modal-error','Name must be 3+ characters');

  setBtn('create-btn','Creating…',true);
  showError('modal-error','');

  try {
    const groupData = {
      name, description: desc,
      isPublic:   S.newGroup.isPublic,
      color:      S.newGroup.color,
      emoji:      S.newGroup.emoji,
      creatorId:  S.user.uid,
      creatorUsername: S.profile.username,
      memberIds:  [S.user.uid],
      memberCount: 1,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageAt:      firebase.firestore.FieldValue.serverTimestamp(),
      lastMessagePreview: '',
      lastMessageSender:  '',
    };

    const ref = await db.collection('groups').add(groupData);

    // Update user's groupIds
    await db.collection('users').doc(S.user.uid).update({
      groupIds: firebase.firestore.FieldValue.arrayUnion(ref.id),
    });

    closeModal();
    switchTab('chats');
    // Live listener will pick up the new group automatically
  } catch (e) {
    console.error('Create group error', e);
    showError('modal-error', 'Failed to create group. Try again.');
    setBtn('create-btn','Create Group',false);
  }
}

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUT (Enter to auth)
═══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.activeElement?.classList?.contains('form-input')) {
    handleAuth();
  }
});
let isProcessingGrammar = false;
let grammarTimeout;

// This listener waits for the user to stop typing before calling the API
document.getElementById('message-input')?.addEventListener('input', (e) => {
  const text = e.target.value.trim();

  // 1. Clear the previous timer every time the user presses a key
  clearTimeout(grammarTimeout);

  // 2. If the text is too short, just hide the suggestion box and stop
  if (text.length < 5) {
    hideSuggestion();
    return;
  }

  // 3. Set a new timer for 1 second (1000ms)
  grammarTimeout = setTimeout(async () => {
    if (isProcessingGrammar) return;

    // Show "Checking..." UI feedback
    const content = document.getElementById('suggestion-text');
    if (content) content.innerText = "Checking...";
    document.getElementById('suggestion-container')?.classList.remove('hidden');

    isProcessingGrammar = true;
    try {
      const corrected = await checkGrammar(text);
      if (corrected && corrected.toLowerCase() !== text.toLowerCase()) {
        currentSuggestion = corrected;
        if (content) content.innerText = corrected;
      } else {
        hideSuggestion();
      }
    } catch (error) {
      console.error("Grammar API error:", error);
      hideSuggestion();
    } finally {
      isProcessingGrammar = false;
    }
  }, 1000);
});

// 2. THE API CALL: Bulletproof version
async function checkGrammar(text) {
  // Replace this with your actual key from console.groq.com
  const GROQ_API_KEY = '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';
  const url = "https://api.groq.com/openai/v1/chat/completions";

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Or "llama3-8b-8192" for even faster speed
        messages: [
          {
            role: "system",
            content: "You are a grammar correction tool. Return ONLY the corrected text in Hebrew or English. No explanations, no quotes."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.2 // Keeps the correction predictable
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Groq Error:", errorData);
        return text;
    }

    const data = await response.json();
    return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error("Fetch Error:", error);
    return text;
  }
}

// 3. UI FUNCTIONS: These handle the buttons
function applySuggestion() {
  const input = document.getElementById('msg-input'); // Must match your chat input ID
  if (input && currentSuggestion) {
    input.value = currentSuggestion;
    hideSuggestion();
    input.focus();
  }
}

function hideSuggestion() {
  const container = document.getElementById('suggestion-container'); // MUST match the ID
  if (container) {
    container.classList.add('hidden');
  }
}