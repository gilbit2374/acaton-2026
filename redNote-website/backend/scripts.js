//state
let currentSuggestion = "";
let classifier;
//i got no idea where aitan got it from but sure

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

//init + config check
const CONFIG_IS_PLACEHOLDER = FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY';

let app, auth, db, storage;
// --- AUDIO RECORDING STATE (Moved to top) ---
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let shouldSendRecording = true;

if (CONFIG_IS_PLACEHOLDER) {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('config-warning').classList.add('show');
} else {
  app  = firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db   = firebase.firestore();
  storage = firebase.storage(); // Add this line
  // Enable offline persistence
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  initApp();
}

//app state
const S = {
  user:          null,
  profile:       null,
  activeTab:     'chats',
  openGroupId:   null,
  openGroupData: null,
  searchFilter:  'all',
  allPublicGroups: [],
  myGroupsData:  [],
  newGroup: { isPublic:true, color:'#D91C1C', emoji:'💬' },
};

// Unsubscribe functions for live listeners
let unsubMyGroups   = null;
let unsubPublicGroups = null;
let unsubMessages   = null;
let pendingPersonalitySetup = false;

//constants
const EMOJIS = ['💬','🚀','🎨','💡','🔥','📈','🤖','🌍','🎯','🛠️','📚','🎮'];
const COLORS = ['#D91C1C','#0D1B2A','#2563EB','#7C3AED','#059669','#D97706','#DB2777'];

const PERSONALITY_TAGS = [
  { id: 'math',     label: 'Math & Logic',       emoji: '📐' },
  { id: 'english',  label: 'Language & Writing',  emoji: '📖' },
  { id: 'science',  label: 'Science',             emoji: '🔬' },
  { id: 'art',      label: 'Art & Creativity',    emoji: '🎨' },
  { id: 'gaming',   label: 'Gaming',              emoji: '🎮' },
  { id: 'sports',   label: 'Sports & Fitness',    emoji: '🏃' },
  { id: 'tech',     label: 'Technology',          emoji: '💻' },
  { id: 'music',    label: 'Music',               emoji: '🎵' },
  { id: 'travel',   label: 'Travel & Culture',    emoji: '🌍' },
  { id: 'business', label: 'Business',            emoji: '💼' },
];

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
function showToast(msg, duration = 3000) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:#059669; color:#fff; padding:10px 20px; border-radius:20px;
      font-size:14px; font-weight:600; z-index:9999; opacity:0;
      transition:opacity 0.3s; pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
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

function initApp() {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const snap = await db.collection('users').doc(firebaseUser.uid).get();
        S.user    = firebaseUser;
        S.profile = snap.exists ? snap.data() : {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.email.split('@')[0],
          displayName: firebaseUser.email.split('@')[0],
        };
        if (pendingPersonalitySetup) {
          pendingPersonalitySetup = false;
          hideLoading();
          showPersonalityQuiz();
        } else {
          showMainApp();
        }
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
  if (!ol) return;
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

// ── PERSONALITY QUIZ ─────────────────────────────────────────────────────────
function showPersonalityQuiz() {
  document.getElementById('auth-view').style.display = 'none';
  const pv = document.getElementById('personality-view');
  pv.style.display = 'flex';

  document.getElementById('quiz-tags-grid').innerHTML = PERSONALITY_TAGS.map(t =>
    `<button class="personality-tag" data-id="${t.id}" onclick="toggleQuizTag(this)">
       <span class="ptag-emoji">${t.emoji}</span>${t.label}
     </button>`
  ).join('');
}

function toggleQuizTag(btn) {
  btn.classList.toggle('selected');
}

async function savePersonality() {
  // For custom tags, store as "custom:TraitName" so they're distinguishable
  const selected = [...document.querySelectorAll('#quiz-tags-grid .personality-tag.selected')]
    .map(b => b.dataset.custom ? 'custom:' + b.dataset.custom : b.dataset.id);
  try {
    if (S.user) {
      await db.collection('users').doc(S.user.uid).update({ personalityTags: selected });
      if (S.profile) S.profile.personalityTags = selected;
    }
  } catch (e) { console.error('Save personality error', e); }
  document.getElementById('personality-view').style.display = 'none';
  showMainApp();
}

function skipPersonality() {
  document.getElementById('personality-view').style.display = 'none';
  showMainApp();
}
// ─────────────────────────────────────────────────────────────────────────────

function teardownListeners() {
  if (unsubMyGroups)     { unsubMyGroups();     unsubMyGroups = null; }
  if (unsubPublicGroups) { unsubPublicGroups(); unsubPublicGroups = null; }
  if (unsubMessages)     { unsubMessages();     unsubMessages = null; }
}

//login
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

      // Flag that we should show the personality quiz after auth state changes
      pendingPersonalitySetup = true;

      //Create Firebase Auth account FIRST
      const cred = await auth.createUserWithEmailAndPassword(email, password);

      try {
        //check username uniqueness
        const existing = await db.collection('users').where('username','==',username).limit(1).get();
        if (!existing.empty) {
          // Username taken
          await cred.user.delete();
          throw new Error('Username is already taken — please choose another');
        }

        //save the profile
        await db.collection('users').doc(cred.user.uid).set({
          uid: cred.user.uid, email, username, displayName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          groupIds: [],
        });

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
    pendingPersonalitySetup = false;
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

//Navigation
function switchTab(tab) {
  S.activeTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+tab).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.getElementById('create-group-btn').style.display = tab==='chats' ? 'flex' : 'none';
  if (tab==='profile') renderProfile();
  if (tab==='search')  renderSearch();
}

function startMyGroupsListener() {
  if (unsubMyGroups) unsubMyGroups();

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
  const userTags = S.profile?.personalityTags || [];

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

  // Score each group by how many tags match the user's personality
  const scored = filtered.map(g => {
    const groupTags = g.tags || [];
    const matchCount = userTags.length > 0
      ? groupTags.filter(t => userTags.includes(t)).length
      : 0;
    return { ...g, _matchScore: matchCount };
  });

  // Split into recommended (score > 0) and the rest
  const recommended = scored.filter(g => g._matchScore > 0)
    .sort((a, b) => b._matchScore - a._matchScore);
  const others = scored.filter(g => g._matchScore === 0);

  function groupCardHTML(g) {
    const joined = uid && (g.memberIds||[]).includes(uid);
    const btn    = joined
      ? `<button class="btn-open" onclick="openChat('${g.id}');event.stopPropagation()">Open</button>`
      : `<button class="btn-join" id="join-btn-${g.id}" onclick="joinGroup('${g.id}');event.stopPropagation()">Join</button>`;

    const groupTags = g.tags || [];
    const tagPills = groupTags.length > 0
      ? `<div class="group-tag-pills">${groupTags.slice(0,3).map(tid => {
          const t = PERSONALITY_TAGS.find(x => x.id === tid);
          return t ? `<span class="group-tag-pill">${t.emoji} ${t.label}</span>` : '';
        }).join('')}</div>`
      : '';

    const matchBadge = g._matchScore > 0
      ? `<span class="match-badge">⭐ Matches you</span>`
      : '';

    return `
      <div class="group-card">
        <div class="group-card-top">
          <div class="group-card-avatar" style="background:${g.color||'#D91C1C'};color:white">${g.emoji||initial(g.name)}</div>
          <div style="flex:1;min-width:0">
            <div class="group-card-name">${esc(g.name)} ${matchBadge}</div>
            <div class="group-card-desc">${esc(g.description||'')}</div>
            ${tagPills}
          </div>
        </div>
        <div class="group-card-bottom">
          <div class="group-stats">${usersSVG} ${(g.memberIds||[]).length} members &nbsp;·&nbsp; ${globeSVG} Public</div>
          ${btn}
        </div>
      </div>`;
  }

  let html = '<div style="padding:6px 0">';

  if (recommended.length > 0 && !q) {
    html += `<div class="recommend-section-label">✨ Recommended for you</div>`;
    html += recommended.map(groupCardHTML).join('');
    if (others.length > 0) {
      html += `<div class="recommend-section-label" style="margin-top:12px">All Groups</div>`;
      html += others.map(groupCardHTML).join('');
    }
  } else {
    html += scored.map(groupCardHTML).join('');
  }

  html += '</div>';
  el.innerHTML = html;
}

async function joinGroup(groupId) {
  if (!S.user) return;

  const groupRef = db.collection('groups').doc(groupId);

  try {
    // FIX: Update 'memberIds' instead of 'members'
    await groupRef.update({
      memberIds: firebase.firestore.FieldValue.arrayUnion(S.user.uid)
    });

    // FIX: Switch to the chats tab instead of trying to close a non-existent modal
    switchTab('chats');
    openChat(groupId);
  } catch (e) {
    console.error("Error joining group:", e);
    alert("Could not join group.");
  }
}

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

function startMessagesListener(groupId) {
  if (unsubMessages) unsubMessages();

  unsubMessages = db.collection('groups').doc(groupId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(100)          //change to cursor for history loading
    .onSnapshot(
      (snap) => {
        const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        renderMessages(msgs, groupId);
      },
      (err) => { console.error('Messages error', err); }
    );
}


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

    // Determine the content: Audio player OR escaped text
const content = msg.audioData
  ? `<audio controls src="${msg.audioData}" class="chat-audio-player"></audio>`
  : esc(msg.text);

    const delBtn = canDel
      ? `<button class="del-btn" onclick="deleteMessage('${groupId}','${msg.id}')" title="Delete">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
         </button>`
      : '';

    if (isOut) {
      html += `
        <div class="msg-row out">
          <div class="msg-wrap out">
            <div class="msg-bubble out">${content}</div>
            <div class="msg-foot">${delBtn}<span class="msg-time">${fmtTime(msg.createdAt)}</span></div>
          </div>
        </div>`;
    } else {
      html += `
        <div class="msg-row">
          <div class="msg-mini-avatar" style="background:${g?.color||'#0D1B2A'}">${mini}</div>
          <div class="msg-wrap">
            <div class="msg-sender-name">@${esc(msg.username)}</div>
            <div class="msg-bubble in">${content}</div>
            <div class="msg-foot"><span class="msg-time">${fmtTime(msg.createdAt)}</span>${delBtn}</div>
          </div>
        </div>`;
    }
  });

  list.innerHTML = html;
  if (wasAtBottom || true) list.scrollTop = list.scrollHeight;
}


async function sendMessage() {
  const inp  = document.getElementById('msg-input');
  const text = inp.value.trim();
  if (!text || !S.openGroupId || !S.user) return;

  let draft = {
    text: text,
    userId: S.user.uid,
    username: S.profile.username,
  };


  const processed = await runMiddleware(draft);


  inp.value = '';
  inp.style.height = '';
  document.getElementById('send-btn').disabled = true;

  const ts = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const msgRef = db.collection('groups').doc(S.openGroupId).collection('messages').doc();

  batch.set(msgRef, {
    userId:    processed.userId,
    username:  processed.username,
    text:      processed.text,
    createdAt: ts,
    isSystemBlocked: processed.isSystemCheck || false
  });

  const groupRef = db.collection('groups').doc(S.openGroupId);
  batch.update(groupRef, {
    lastMessageAt:      ts,
    lastMessagePreview: processed.text.slice(0, 80),
    lastMessageSender:  processed.username,
  });

  await batch.commit().catch(e => console.error('Send error', e));
}


//Middleware pipeline — AI keyboard and filters
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

  } catch (err) {
    console.error("שגיאה בניתוח המודל או הדקדוק:", err);
  }

  return draft;
}


async function deleteMessage(groupId, msgId) {
  try {
    await db.collection('groups').doc(groupId)
            .collection('messages').doc(msgId).delete();
    // onSnapshot auto-refreshes the UI
  } catch (e) {
    console.error('Delete error', e);
  }
}

function handleMsgKey(e) {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
let lastCheckedText = "";
let grammarTimer; //to hold the timer
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  document.getElementById('send-btn').disabled = !el.value.trim();

  // Hide suggestion box if the user starts changing the text
  hideSuggestion();
}

let isCheckingGrammar = false; // Prevent double-clicks

async function manualGrammarCheck() {
    if (isCheckingGrammar) return;

    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    if (!text) return;

    const box = document.getElementById('suggestion-container');
    const textEl = document.getElementById('suggestion-text');
    const applyBtn = box.querySelector('.btn-apply');

    isCheckingGrammar = true;
    textEl.innerText = "Checking... / בודק...";
    applyBtn.style.display = 'none';
    box.classList.remove('hidden', 'error-state');

    const corrected = await checkGrammar(text);

    if (corrected === "API_ERROR") {
        box.classList.add('error-state');
        textEl.innerText = "API Error. Please check your browser console.";
        applyBtn.style.display = 'none';
        setTimeout(() => { hideSuggestion(); }, 3000);

    // Notice we removed the .toLowerCase() so it catches punctuation and capitalization!
    } else if (corrected === "NO_CORRECTION" || corrected === text) {
        box.classList.add('error-state');
        textEl.innerText = "Unrecognized or no corrections needed";
        applyBtn.style.display = 'none';
        setTimeout(() => { hideSuggestion(); }, 1500);

    } else {
        currentSuggestion = corrected;
        const isHebrew = /[\u0590-\u05FF]/.test(corrected);
        textEl.style.direction = isHebrew ? 'rtl' : 'ltr';
        textEl.style.textAlign = isHebrew ? 'right' : 'left';

        const label = isHebrew ? 'הצעה לתיקון:' : 'Suggestion:';
        textEl.innerHTML = `<b>${label}</b> <span style="color:#000">"${corrected}"</span>`;
        applyBtn.style.display = 'inline-block';
    }

    isCheckingGrammar = false;
}



async function checkForSuggestions(text) {
  if (!window.classifier) return;

  const results = await window.classifier(text);
  const isToxic = results && results[0].label === 'LABEL_1' && results[0].score > 0.5;

  if (isToxic) {
    const box = document.getElementById('ai-suggestion-box');
    const textEl = document.getElementById('suggestion-text');

    //suggest a nicer version
    textEl.textContent = "This message seems a bit harsh. Want to soften it?";
    box.classList.remove('hidden');
  } else {
    hideSuggestion();
  }
}

function applySuggestion() {
  const inp = document.getElementById('msg-input');

  if (currentSuggestion) {
      inp.value = currentSuggestion;
  }

  hideSuggestion();
  autoResize(inp);
  currentSuggestion = ""; //Clear the memory
}

function hideSuggestion() {
  document.getElementById('ai-suggestion-box').classList.add('hidden');
}


// ── CUSTOM PERSONALITY TAGS ───────────────────────────────────────────────────

/**
 * Runs the local toxicity classifier on a given string.
 * Returns true if the text is flagged as toxic, false otherwise.
 * If the model isn't loaded yet, it allows the text through (returns false).
 */
async function isToxicText(text) {
  if (!window.classifier) {
    console.warn("⚠️ Toxicity model not loaded — allowing text through.");
    return false;
  }
  try {
    const results = await window.classifier(text);
    if (!results || results.length === 0) return false;
    const top = results[0];
    if ((top.label === 'LABEL_1' || top.label === 'toxic') && top.score > 0.5) return true;
    if (top.label === 'LABEL_0' && top.score < 0.5) return true;
    return false;
  } catch (e) {
    console.error('Toxicity check error:', e);
    return false;
  }
}

/**
 * Adds a custom personality trait to the signup quiz tag grid,
 * after checking it for toxicity with the AI model.
 */
async function addCustomPersonalityTag() {
  const input   = document.getElementById('custom-quiz-tag-input');
  const errorEl = document.getElementById('custom-quiz-tag-error');
  const text    = input.value.trim();

  errorEl.classList.remove('show');

  if (!text) return;
  if (text.length < 2) {
    errorEl.textContent = '⚠️ Trait must be at least 2 characters.';
    errorEl.classList.add('show');
    return;
  }

  // Check for duplicates in the grid
  const existing = [...document.querySelectorAll('#quiz-tags-grid .personality-tag')];
  if (existing.some(b => (b.dataset.custom || b.textContent.trim()).toLowerCase().includes(text.toLowerCase()))) {
    errorEl.textContent = '⚠️ This trait already exists.';
    errorEl.classList.add('show');
    return;
  }

  // Show loading state
  const addBtn = document.getElementById('custom-quiz-tag-input').nextElementSibling;
  addBtn.textContent = 'Checking…';
  addBtn.disabled = true;
  input.disabled = true;

  const toxic = await isToxicText(text);

  addBtn.textContent = 'Add';
  addBtn.disabled = false;
  input.disabled = false;

  if (toxic) {
    errorEl.textContent = '🚫 This trait was flagged as inappropriate by the AI. Please choose a different one.';
    errorEl.classList.add('show');
    // Shake the input for visual feedback
    input.classList.add('input-shake');
    setTimeout(() => input.classList.remove('input-shake'), 500);
    return;
  }

  // All clear — append the tag as already selected
  const grid   = document.getElementById('quiz-tags-grid');
  const tagId  = 'custom_' + uid();
  const tagBtn = document.createElement('button');
  tagBtn.className       = 'personality-tag selected custom-tag';
  tagBtn.dataset.id      = tagId;
  tagBtn.dataset.custom  = text;
  tagBtn.onclick         = function() { this.classList.toggle('selected'); };
  tagBtn.innerHTML       = `<span class="ptag-emoji">✨</span>${esc(text)}`;
  grid.appendChild(tagBtn);

  input.value = '';
}

/**
 * Adds a custom topic tag to the Create Group modal tag grid,
 * after checking it for toxicity with the AI model.
 */
async function addCustomGroupTag() {
  const input   = document.getElementById('custom-group-tag-input');
  const errorEl = document.getElementById('custom-group-tag-error');
  const text    = input.value.trim();

  errorEl.classList.remove('show');

  if (!text) return;
  if (text.length < 2) {
    errorEl.textContent = '⚠️ Tag must be at least 2 characters.';
    errorEl.classList.add('show');
    return;
  }

  // Check for duplicates
  const existing = [...document.querySelectorAll('#group-tags-grid .personality-tag')];
  if (existing.some(b => (b.dataset.custom || b.textContent.trim()).toLowerCase().includes(text.toLowerCase()))) {
    errorEl.textContent = '⚠️ This tag already exists.';
    errorEl.classList.add('show');
    return;
  }

  // Show loading state
  const addBtn = document.getElementById('custom-group-tag-input').nextElementSibling;
  addBtn.textContent = 'Checking…';
  addBtn.disabled = true;
  input.disabled = true;

  const toxic = await isToxicText(text);

  addBtn.textContent = 'Add';
  addBtn.disabled = false;
  input.disabled = false;

  if (toxic) {
    errorEl.textContent = '🚫 This tag was flagged as inappropriate by the AI. Please choose a different one.';
    errorEl.classList.add('show');
    input.classList.add('input-shake');
    setTimeout(() => input.classList.remove('input-shake'), 500);
    return;
  }

  // All clear — append the tag as already selected
  const grid  = document.getElementById('group-tags-grid');
  const tagId = 'custom_' + uid();
  const el    = document.createElement('button');
  el.className      = 'personality-tag selected custom-tag';
  el.dataset.id     = tagId;
  el.dataset.custom = text;
  el.onclick        = function() { this.classList.toggle('selected'); };
  el.innerHTML      = `<span class="ptag-emoji">✨</span>${esc(text)}`;
  grid.appendChild(el);

  input.value = '';
}

// ─────────────────────────────────────────────────────────────────────────────

//create group modal
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
  S.newGroup.tags = [];
  // Render personality tag picker for group
  document.getElementById('group-tags-grid').innerHTML = PERSONALITY_TAGS.map(t =>
    `<button class="personality-tag" data-id="${t.id}" onclick="toggleGroupTag(this)">
       <span class="ptag-emoji">${t.emoji}</span>${t.label}
     </button>`
  ).join('');
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
function toggleGroupTag(btn) {
  btn.classList.toggle('selected');
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
    if (!S.user) return;

    const nameInput = document.getElementById('new-group-name');
    const descInput = document.getElementById('new-group-desc');

    if (!nameInput.value.trim()) {
        document.getElementById('modal-error').innerText = "Group name is required.";
        return;
    }

    try {
        // For custom tags, store as "custom:Label" so they're distinguishable
        const selectedTags = [...document.querySelectorAll('#group-tags-grid .personality-tag.selected')]
            .map(b => b.dataset.custom ? 'custom:' + b.dataset.custom : b.dataset.id);

        const groupRef = db.collection('groups').doc();
        await groupRef.set({
            name: nameInput.value.trim(),
            description: descInput.value.trim() || "",
            emoji: S.newGroup.emoji || "💬",
            color: S.newGroup.color || "#D91C1C",
            isPublic: S.newGroup.isPublic,
            tags: selectedTags,
            creatorId: S.user.uid,
            memberIds: [S.user.uid],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageText: "Group created"
        });

        // 1. CLEAR INPUTS
        nameInput.value = "";
        descInput.value = "";

        // 2. CLOSE MODAL MANUALLY (Force it)
        closeModal();

        // 3. SWITCH TO CHATS TAB & OPEN
        switchTab('chats');
        openChat(groupRef.id);

    } catch (e) {
        console.error("Create Group Error:", e);
        alert("Failed to create group. Check console.");
    }
}

document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.activeElement?.classList?.contains('form-input')) {
    handleAuth();
  }
});
let isProcessingGrammar = false;
let grammarTimeout;

//waits for the user to stop typing before calling the API


//API groq
const groq_apiKey = SECRETS.GROQ_KEY;

async function checkGrammar(text) {
  const GROQ_API_KEY = typeof SECRETS !== 'undefined' ? SECRETS.GROQ_KEY : null;

  if (!GROQ_API_KEY) {
    console.error("❌ Groq API Key is missing! Check your config.js file.");
    return "API_ERROR";
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a helpful grammar and spelling corrector. You support both English and Hebrew. Your ONLY job is to return the corrected text. Fix typos, capitalization, and grammar. Do NOT answer questions. Do NOT wrap the text in quotes. If the text is already perfect, return exactly the string: NO_CORRECTION"
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.2 // Slightly higher so it doesn't freeze on slang
      })
    });

    if (!response.ok) return "API_ERROR";

    const data = await response.json();
    let result = data.choices[0].message.content.trim();

    // Strip accidental quotes the AI might add
    return result.replace(/^["']|["']$/g, '');

  } catch (error) {
    console.error("❌ Fetch Error in checkGrammar:", error);
    return "API_ERROR";
  }
}

//UI FUNCTIONS
function applySuggestion() {
  const input = document.getElementById('msg-input');
  if (input && currentSuggestion) {
    input.value = currentSuggestion;
    hideSuggestion();
    input.focus();
  }
}

function hideSuggestion() {
  const container = document.getElementById('suggestion-container');
  if (container) {
    container.classList.add('hidden');
  }
}



async function toggleRecording() {
  if (!isRecording) {
    await startRecording();
  } else {
    // If user clicks the mic again while recording, we assume they want to STOP & SEND
    stopRecording(true);
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    shouldSendRecording = true;

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      // 1. Check if we should actually send this
      if (!shouldSendRecording) {
        console.log("Recording discarded by user.");
        return;
      }

      // 2. Package and check size
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Max Blob size ~700KB to account for the overhead of Base64 strings
      const MAX_BLOB_SIZE = 700 * 1024;

      if (audioBlob.size > MAX_BLOB_SIZE) {
        alert("Audio message is too long for Firestore! Please keep recordings short.");
        return;
      }

      if (audioBlob.size > 0) {
        await uploadAndSendAudio(audioBlob);
      }
    };

    mediaRecorder.start();
    isRecording = true;

    // UI Feedback
    const micBtn = document.getElementById('mic-btn');
    const cancelBtn = document.getElementById('cancel-record-btn');

    micBtn.classList.add('recording');
    if(cancelBtn) cancelBtn.style.display = 'flex';

    document.getElementById('msg-input').placeholder = "Recording... Tap mic to send";
    document.getElementById('msg-input').disabled = true;

  } catch (err) {
    console.error("Microphone access denied or error:", err);
    alert("Please allow microphone access to record audio.");
  }
}

// Pass 'true' to send, 'false' to discard
function stopRecording(send = true) {
  if (mediaRecorder && isRecording) {
    shouldSendRecording = send;
    mediaRecorder.stop();

    // Stop all microphone tracks
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    isRecording = false;

    // Reset UI
    const micBtn = document.getElementById('mic-btn');
    const cancelBtn = document.getElementById('cancel-record-btn');

    micBtn.classList.remove('recording');
    if(cancelBtn) cancelBtn.style.display = 'none'; // Hide cancel button

    document.getElementById('msg-input').placeholder = "Message...";
    document.getElementById('msg-input').disabled = false;
  }
}

// New function to be called by a 'Cancel' button
function cancelRecording() {
  stopRecording(false);
}

async function uploadAndSendAudio(blob) {
  if (!S.openGroupId || !S.user) return;

  // Convert the blob to a Base64 string
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = async () => {
    const base64Audio = reader.result;

    try {
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      const msgRef = db.collection('groups').doc(S.openGroupId).collection('messages').doc();

      batch.set(msgRef, {
        userId: S.user.uid,
        username: S.profile.username,
        text: '🎵 Audio Message',
        audioData: base64Audio, // Storing the string directly in Firestore
        createdAt: ts,
        isSystemBlocked: false
      });

      const groupRef = db.collection('groups').doc(S.openGroupId);
      batch.update(groupRef, {
        lastMessageAt: ts,
        lastMessageText: '🎵 Audio Message'
      });

      await batch.commit();
      console.log("Audio message sent successfully via Firestore!");
    } catch (e) {
      console.error("Error sending audio:", e);
      alert("Failed to send audio message.");
    }
  };
}

async function deleteCurrentGroup() {
  if (!S.openGroupId || !S.user) return;
  if (!confirm("Delete this group permanently? This cannot be undone.")) return;

  const gid = S.openGroupId;

  try {
    // Pre-flight: re-fetch the group and verify ownership before attempting delete
    const groupDoc = await db.collection('groups').doc(gid).get();
    if (!groupDoc.exists) {
      alert("Group no longer exists.");
      closeGroupInfo();
      closeChat();
      return;
    }

    const data = groupDoc.data();
    const isOwner = data.creatorId === S.user.uid || data.ownerId === S.user.uid;

    if (!isOwner) {
      alert("You are not the creator of this group and cannot delete it.");
      return;
    }

    // 1. Delete from Firebase
    await db.collection('groups').doc(gid).delete();

    // 2. Close ALL UI layers immediately
    closeGroupInfo();     // Close the right-side info panel
    closeChat();          // Hide the chat screen (mobile view)

    // 3. Reset Global State
    S.openGroupId = null;

    // 4. Clear the UI
    const msgList = document.getElementById('messages-list');
    if (msgList) msgList.innerHTML = "";

    const hdrName = document.getElementById('chat-hdr-name');
    if (hdrName) hdrName.innerText = "—";

    // 5. Show success toast
    showToast("Group deleted successfully.");
    console.log("Group deleted successfully");
  } catch (e) {
    console.error("Delete Error:", e);
    // Show the real Firebase error code so you can debug it
    const reason = e.code || e.message || 'unknown error';
    alert(`Could not delete group (${reason}). Make sure your Firebase rules are deployed and match the creatorId field.`);
  }
}

function closeGroupInfo() {
  document.getElementById('info-panel-overlay').classList.remove('active');
  document.getElementById('group-info-panel').classList.remove('active');
}

async function showGroupInfo() {
  if (!S.openGroupId) return;

  try {
    const doc = await db.collection('groups').doc(S.openGroupId).get();
    if (!doc.exists) return;
    const data = doc.data();

    // 1. Fill Text
    document.getElementById('info-panel-name').innerText = data.name;
    document.getElementById('info-panel-desc').innerText = data.description || "No description provided.";
    document.getElementById('info-panel-avatar').innerText = data.emoji || '📁';

    // 2. Member Count Logic
    let memberCount = 1;
    // FIX: check memberIds instead of members
    if (data.memberIds && Array.isArray(data.memberIds)) {
      memberCount = data.memberIds.length;
    }

    const memberText = document.getElementById('info-panel-members');
    if (memberText) {
      memberText.innerHTML = `<i class="fas fa-users" style="margin-right: 8px; color: var(--navy);"></i> ${memberCount} Participant${memberCount > 1 ? 's' : ''}`;
    }

    // 3. Delete Button Visibility
    // ... inside showGroupInfo find the delete button logic:

const deleteBtn = document.getElementById('btn-delete-group');

// Check both the old field (ownerId) and the new field (creatorId)
const isOwner = (data.creatorId === S.user.uid || data.ownerId === S.user.uid);

if (isOwner) {
    deleteBtn.classList.remove('hidden');
} else {
    deleteBtn.classList.add('hidden');
}

    // 4. Show the panel
    document.getElementById('info-panel-overlay').classList.add('active');
    document.getElementById('group-info-panel').classList.add('active');
  } catch (e) {
    console.error("Group Info Failed to Open:", e);
  }
}