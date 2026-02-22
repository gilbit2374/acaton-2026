/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
const State = {
  currentUser: null,
  authMode: 'login',       // 'login' | 'register'
  activeTab: 'chats',
  openGroupId: null,
  searchFilter: 'all',
  newGroup: { isPublic: true, color: '#D91C1C', emoji: '💬' },

  groups: [
    { id:'g1', name:'Designers Hub',    description:'UI/UX, branding & creative discussion',   isPublic:true,  color:'#2563EB', emoji:'🎨', creatorId:'bot1', memberIds:['bot1','bot2','bot3'], createdAt: Date.now()-864e5*5 },
    { id:'g2', name:'Startup Founders', description:'Building companies, sharing lessons',      isPublic:true,  color:'#D97706', emoji:'🚀', creatorId:'bot2', memberIds:['bot1','bot2'],        createdAt: Date.now()-864e5*2 },
    { id:'g3', name:'AI & LLMs',        description:'Everything artificial intelligence',       isPublic:true,  color:'#7C3AED', emoji:'🤖', creatorId:'bot3', memberIds:['bot1','bot2','bot3'], createdAt: Date.now()-864e5*10 },
    { id:'g4', name:'Product Growth',   description:'Growth hacking, metrics & retention',      isPublic:true,  color:'#059669', emoji:'📈', creatorId:'bot1', memberIds:['bot1'],               createdAt: Date.now()-864e5 },
    { id:'g5', name:'Dev Collective',   description:'Code, architecture, and best practices',   isPublic:true,  color:'#0D1B2A', emoji:'💻', creatorId:'bot2', memberIds:['bot2'],               createdAt: Date.now()-864e5*3 },
  ],

  messages: {
    g1:[
      { id:'m1', groupId:'g1', userId:'bot1', username:'alex.design', text:'Anyone using Figma\'s new variables feature? Game changer for design systems 🔥', ts: Date.now()-36e5*4 },
      { id:'m2', groupId:'g1', userId:'bot2', username:'sarah.ux',    text:'Yes! Been using it for a month now. Token management is so much cleaner', ts: Date.now()-36e5*3 },
      { id:'m3', groupId:'g1', userId:'bot3', username:'mike.brand',  text:'How\'s the performance on larger files though? Mine gets laggy with 300+ components', ts: Date.now()-36e5*2 },
    ],
    g2:[
      { id:'m4', groupId:'g2', userId:'bot1', username:'alex.design', text:'Fundraising advice needed — when should you bring in a co-founder?', ts: Date.now()-72e5 },
      { id:'m5', groupId:'g2', userId:'bot2', username:'sarah.ux',    text:'As early as possible if they bring complementary skills you lack', ts: Date.now()-36e5 },
    ],
    g3:[
      { id:'m6', groupId:'g3', userId:'bot3', username:'mike.brand',  text:'Claude Sonnet 4 is genuinely wild. Extended thinking is useful for architecture decisions', ts: Date.now()-18e5 },
      { id:'m7', groupId:'g3', userId:'bot1', username:'alex.design', text:'Agreed — been using it for code review. Catches things I\'d miss after 4 hours of coding 😅', ts: Date.now()-9e5 },
    ],
    g4: [],
    g5: [],
  },
};

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 10);
const initial = s => (s || '?').charAt(0).toUpperCase();
const esc    = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(ts) {
  const d = new Date(ts), t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t); y.setDate(y.getDate()-1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}

const EMOJIS  = ['💬','🚀','🎨','💡','🔥','📈','🤖','🌍','🎯','🛠️','📚','🎮'];
const COLORS  = ['#D91C1C','#0D1B2A','#2563EB','#7C3AED','#059669','#D97706','#DB2777'];

/* ═══════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════ */
function switchAuthTab(mode) {
  State.authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode==='login');
  document.getElementById('tab-register').classList.toggle('active', mode==='register');
  document.getElementById('register-fields').style.display = mode==='register' ? 'block' : 'none';
  document.getElementById('auth-submit-btn').textContent = mode==='login' ? 'Sign In' : 'Create Account';
  document.getElementById('auth-hint').style.display = mode==='login' ? 'block' : 'none';
  showAuthError('');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

function handleAuth() {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const btn      = document.getElementById('auth-submit-btn');

  if (!email || !password) return showAuthError('Please fill all fields');
  if (password.length < 6)  return showAuthError('Password must be at least 6 characters');

  btn.disabled = true; btn.textContent = 'Please wait…';

  setTimeout(() => {
    if (State.authMode === 'register') {
      const username    = document.getElementById('input-username').value.trim().toLowerCase().replace(/\s/g,'');
      const displayName = document.getElementById('input-displayname').value.trim();
      if (!username || !displayName) { btn.disabled=false; btn.textContent='Create Account'; return showAuthError('All fields are required'); }
      if (username.length < 3) { btn.disabled=false; btn.textContent='Create Account'; return showAuthError('Username must be 3+ characters'); }
      loginUser({ id: uid(), email, username, displayName });
    } else {
      loginUser({ id: 'demo_'+uid(), email, username: email.split('@')[0].toLowerCase(), displayName: email.split('@')[0] });
    }
    btn.disabled = false;
  }, 700);
}

function loginUser(user) {
  State.currentUser = user;
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('main-app').style.display  = 'flex';
  document.getElementById('header-avatar').textContent = initial(user.username);
  document.getElementById('profile-big-avatar').textContent = initial(user.username);
  document.getElementById('profile-name').textContent  = user.displayName;
  document.getElementById('profile-uname').textContent = '@' + user.username;
  document.getElementById('profile-email').textContent = user.email;
  switchTab('chats');
  renderChats();
}

function logout() {
  State.currentUser = null;
  State.openGroupId = null;
  document.getElementById('main-app').style.display  = 'none';
  document.getElementById('auth-view').style.display  = 'flex';
  document.getElementById('input-email').value = '';
  document.getElementById('input-password').value = '';
  switchAuthTab('login');
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
function switchTab(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+tab).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const showPlus = tab === 'chats';
  document.getElementById('create-group-btn').style.display = showPlus ? 'flex' : 'none';

  if (tab === 'chats')   renderChats();
  if (tab === 'search')  renderSearch();
  if (tab === 'profile') renderProfile();
}

/* ═══════════════════════════════════════════════
   CHAT LIST (Chats Screen)
═══════════════════════════════════════════════ */
function myGroups() {
  if (!State.currentUser) return [];
  return State.groups.filter(g => g.memberIds.includes(State.currentUser.id));
}

function renderChats() {
  const list    = document.getElementById('chats-list');
  const groups  = myGroups();
  document.getElementById('chats-count').textContent = groups.length + ' joined';

  if (groups.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="empty-title">No chats yet</div>
        <div class="empty-sub">Join public groups or create your own<br/>to start chatting with others.</div>
      </div>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const msgs = State.messages[g.id] || [];
    const last = msgs[msgs.length - 1];
    const lockSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const globeSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    return `
      <div class="chat-item" onclick="openChat('${g.id}')">
        <div class="chat-avatar" style="background:${g.color}">
          ${g.emoji || initial(g.name)}
          <div class="privacy-dot">${g.isPublic ? globeSVG : lockSVG}</div>
        </div>
        <div class="chat-info">
          <div class="chat-name">${esc(g.name)}</div>
          <div class="chat-preview">${last ? esc(last.username)+': '+esc(last.text) : 'No messages yet'}</div>
        </div>
        <div class="chat-meta">
          <span class="chat-time">${last ? fmtTime(last.ts) : ''}</span>
          <span class="member-pill">${g.memberIds.length} members</span>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   DISCOVER / SEARCH SCREEN
═══════════════════════════════════════════════ */
let searchFilterState = 'all';
function setFilter(f) {
  searchFilterState = f;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  renderSearch();
}

function renderSearch() {
  const q    = (document.getElementById('search-input').value || '').toLowerCase();
  const uid  = State.currentUser?.id;
  const all  = State.groups.filter(g => g.isPublic);

  const filtered = all.filter(g => {
    const matchQ = !q || g.name.toLowerCase().includes(q) || (g.description||'').toLowerCase().includes(q);
    const joined = uid && g.memberIds.includes(uid);
    const matchF = searchFilterState==='all' || (searchFilterState==='joined' && joined) || (searchFilterState==='discover' && !joined);
    return matchQ && matchF;
  });

  const el = document.getElementById('search-results');

  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div class="empty-title">No groups found</div>
        <div class="empty-sub">Try a different search term</div>
      </div>`;
    return;
  }

  const usersSVG  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const globeSVG2 = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

  el.innerHTML = '<div style="padding:6px 0">' + filtered.map(g => {
    const joined = uid && g.memberIds.includes(uid);
    const actionBtn = joined
      ? `<button class="btn-open" onclick="openChat('${g.id}');event.stopPropagation()">Open</button>`
      : `<button class="btn-join" onclick="joinGroup('${g.id}');event.stopPropagation()">Join</button>`;
    return `
      <div class="group-card">
        <div class="group-card-top">
          <div class="group-card-avatar" style="background:${g.color};color:white;font-size:20px">${g.emoji || initial(g.name)}</div>
          <div>
            <div class="group-card-name">${esc(g.name)}</div>
            <div class="group-card-desc">${esc(g.description||'')}</div>
          </div>
        </div>
        <div class="group-card-bottom">
          <div class="group-stats">${usersSVG} ${g.memberIds.length} members &nbsp;·&nbsp; ${globeSVG2} Public</div>
          ${actionBtn}
        </div>
      </div>`;
  }).join('') + '</div>';
}

function joinGroup(groupId) {
  const g = State.groups.find(x => x.id === groupId);
  if (!g || !State.currentUser) return;
  if (!g.memberIds.includes(State.currentUser.id)) {
    g.memberIds.push(State.currentUser.id);
    if (!State.messages[groupId]) State.messages[groupId] = [];
  }
  renderSearch();
  renderChats();
}

/* ═══════════════════════════════════════════════
   PROFILE SCREEN
═══════════════════════════════════════════════ */
function renderProfile() {
  const n = myGroups().length;
  document.getElementById('profile-group-desc').textContent  = n + ' groups joined';
  document.getElementById('profile-group-count').textContent = n;
}

/* ═══════════════════════════════════════════════
   CHAT SCREEN
═══════════════════════════════════════════════ */
function openChat(groupId) {
  const g = State.groups.find(x => x.id === groupId);
  if (!g) return;
  State.openGroupId = groupId;

  const isMod = g.creatorId === State.currentUser?.id;
  const avatar = document.getElementById('chat-hdr-avatar');
  avatar.style.background = g.color;
  avatar.textContent = g.emoji || initial(g.name);
  avatar.style.color = 'white';
  document.getElementById('chat-hdr-name').textContent = g.name;
  document.getElementById('chat-hdr-sub').textContent  = g.memberIds.length + ' members · ' + (g.isPublic ? 'Public' : 'Private');
  document.getElementById('chat-mod-badge').style.display = isMod ? 'block' : 'none';

  renderMessages();
  document.getElementById('chat-screen').classList.add('open');

  // Reset input
  const inp = document.getElementById('msg-input');
  inp.value = ''; inp.style.height = '';
  document.getElementById('send-btn').disabled = true;
  setTimeout(() => inp.focus(), 350);
}

function closeChat() {
  document.getElementById('chat-screen').classList.remove('open');
  State.openGroupId = null;
  renderChats();
}

function renderMessages() {
  const list   = document.getElementById('messages-list');
  const msgs   = State.messages[State.openGroupId] || [];
  const g      = State.groups.find(x => x.id === State.openGroupId);
  const isMod  = g?.creatorId === State.currentUser?.id;
  const uid    = State.currentUser?.id;

  if (msgs.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="empty-title">No messages yet</div>
        <div class="empty-sub">Be the first to say something!</div>
      </div>`;
    return;
  }

  let html = '';
  let lastDate = null;

  msgs.forEach(msg => {
    const date = fmtDate(msg.ts);
    if (date !== lastDate) {
      html += `<div class="date-divider"><span>${date}</span></div>`;
      lastDate = date;
    }

    const isOut  = msg.userId === uid;
    const canDel = isMod || isOut;
    const mini   = initial(msg.username);

    const delBtn = canDel
      ? `<button class="del-btn" onclick="deleteMessage('${msg.id}')" title="Delete">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
         </button>`
      : '';

    if (isOut) {
      html += `
        <div class="msg-row out">
          <div class="msg-wrap out">
            <div class="msg-bubble out">${esc(msg.text)}</div>
            <div class="msg-foot">${delBtn}<span class="msg-time">${fmtTime(msg.ts)}</span></div>
          </div>
        </div>`;
    } else {
      html += `
        <div class="msg-row">
          <div class="msg-mini-avatar" style="background:${g?.color||'#0D1B2A'}">${mini}</div>
          <div class="msg-wrap">
            <div class="msg-sender-name">@${esc(msg.username)}</div>
            <div class="msg-bubble in">${esc(msg.text)}</div>
            <div class="msg-foot"><span class="msg-time">${fmtTime(msg.ts)}</span>${delBtn}</div>
          </div>
        </div>`;
    }
  });

  list.innerHTML = html;
  list.scrollTop = list.scrollHeight;
}

function deleteMessage(msgId) {
  const gid = State.openGroupId;
  if (!gid) return;
  State.messages[gid] = (State.messages[gid]||[]).filter(m => m.id !== msgId);
  renderMessages();
}
/* ═══════════════════════════════════════════════
   MESSAGE LOGIC (מתוקן)
═══════════════════════════════════════════════ */

async function sendMessage() {
  const inp = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');
  const text = inp.value.trim();

  if (!text || !State.openGroupId || !State.currentUser) return;

  inp.disabled = true;
  sendBtn.disabled = true;

  const draft = { text, userId: State.currentUser.id, username: State.currentUser.username };

  try {
    const processed = await runMiddleware(draft);
    inp.disabled = false;
    inp.focus();

    if (!processed) {
      sendBtn.disabled = false;
      return;
    }

    const msg = { id: uid(), groupId: State.openGroupId, ...processed, ts: Date.now() };
    if (!State.messages[State.openGroupId]) State.messages[State.openGroupId] = [];
    State.messages[State.openGroupId].push(msg);

    inp.value = '';
    inp.style.height = '';
    renderMessages();
  } catch (err) {
    console.error("Error sending message:", err);
    inp.disabled = false;
    sendBtn.disabled = false;
  }
}

async function runMiddleware(draft) {
  if (!classifier) {
    console.warn("AI not ready yet.");
    return draft;
  }

  const analysis = await analyzeMessage(draft.text);
  const label = String(analysis.label).toUpperCase();
  const score = analysis.score;

  // בדיקה אם ההודעה רעילה (LABEL_0 מוגדר כעת כרעיל ב-loadModel)
  if (label === 'LABEL_0' && score > 0.7) {
    console.log("🚫 Toxicity detected, censoring message...");
    draft.text = "🚫 הודעה זו נחסמה על ידי מערכת הניטור (תוכן לא הולם)";
    draft.isBlocked = true;
  }

  return draft;
}

// פתרון לשגיאת ה-ReferenceError: מחברים את הפונקציות ל-window
window.handleMsgKey = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

window.autoResize = function(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  document.getElementById('send-btn').disabled = !el.value.trim();
};

/* ═══════════════════════════════════════════════
   INIT & AI LOADING (מתוקן עם תיקון היפוך)
═══════════════════════════════════════════════ */

async function loadModel() {
  try {
    console.log("Loading AI using quantized model file...");

    window.env.localModelPath = './';
    window.env.allowRemoteModels = false;

    classifier = await window.pipeline('text-classification', 'model_web', {
      local_files_only: true,
      model_file_name: 'model_quantized',
      quantized: false,
      config: {
        model_type: 'bert',
        id2label: {
          0: 'LABEL_1', // Neutral/Safe
          1: 'LABEL_0'  // Toxic/Negative (זה מה שה-Middleware מחפש)
        }
      }
    });

    console.log("✅ AI is live, offline, and the labels are correctly mapped!");
  } catch (e) {
    console.error("❌ Model load failed.", e);
  }
}

async function analyzeMessage(text) {
  if (!classifier) return { label: 'LABEL_1', score: 0 };
  try {
    const cleanText = String(text).trim();
    if (!cleanText) return { label: 'LABEL_1', score: 0 };

    const result = await classifier(cleanText);
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.error("Analysis failed:", err);
    return { label: 'LABEL_1', score: 0 };
  }
}

// חשיפת loadModel לשימוש חיצוני
window.loadModel = loadModel;
window.sendMessage = sendMessage;