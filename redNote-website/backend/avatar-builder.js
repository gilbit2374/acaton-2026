/* ═══════════════════════════════════════════════════════
   avatar-builder.js  —  Profile avatar customiser
   Drop-in module — does NOT modify scripts.js or styles.css
   Load AFTER scripts.js in redNote.html
   ═══════════════════════════════════════════════════════ */

/* ── Data ───────────────────────────────────────────────── */
const AVATAR_ANIMALS = [
  { emoji: '🦊', name: 'Fox'      },
  { emoji: '🐺', name: 'Wolf'     },
  { emoji: '🐻', name: 'Bear'     },
  { emoji: '🦁', name: 'Lion'     },
  { emoji: '🐯', name: 'Tiger'    },
  { emoji: '🐨', name: 'Koala'    },
  { emoji: '🦝', name: 'Raccoon'  },
  { emoji: '🐸', name: 'Frog'     },
  { emoji: '🐧', name: 'Penguin'  },
  { emoji: '🦔', name: 'Hedgehog' },
];

const AVATAR_BACKGROUNDS = [
  { value: 'linear-gradient(135deg,#D91C1C,#ff6b6b)',  name: 'Crimson'  },
  { value: 'linear-gradient(135deg,#0D1B2A,#2563EB)',  name: 'Midnight' },
  { value: 'linear-gradient(135deg,#7C3AED,#DB2777)',  name: 'Galaxy'   },
  { value: 'linear-gradient(135deg,#059669,#34d399)',  name: 'Forest'   },
  { value: 'linear-gradient(135deg,#D97706,#fbbf24)',  name: 'Sunset'   },
  { value: 'linear-gradient(135deg,#2563EB,#06b6d4)',  name: 'Ocean'    },
  { value: 'linear-gradient(135deg,#be185d,#f43f5e)',  name: 'Rose'     },
  { value: 'linear-gradient(135deg,#0f172a,#334155)',  name: 'Slate'    },
  { value: 'linear-gradient(135deg,#92400e,#d97706)',  name: 'Amber'    },
  { value: 'linear-gradient(135deg,#064e3b,#059669)',  name: 'Emerald'  },
];

const AVATAR_OBJECTS = [
  { emoji: '🏙️', name: 'City'     },
  { emoji: '🌃', name: 'Night'    },
  { emoji: '🌄', name: 'Sunrise'  },
  { emoji: '🌊', name: 'Ocean'    },
  { emoji: '🏔️', name: 'Summit'   },
  { emoji: '🌸', name: 'Blossom'  },
  { emoji: '⭐',  name: 'Stars'    },
  { emoji: '🌈', name: 'Rainbow'  },
  { emoji: '🔥', name: 'Fire'     },
  { emoji: '❄️',  name: 'Snow'     },
];

/* ── Builder draft state ────────────────────────────────── */
const AB = { animal: 0, bg: 0, object: null };

/* ══════════════════════════════════════════════════════════
   RENDERING — writes emoji layers into any avatar element
   ══════════════════════════════════════════════════════════ */
function renderAvatarEl(el, avatarData, fallbackInitial) {
  if (!el) return;

  // No custom avatar saved yet → show original letter initial
  if (!avatarData || avatarData.animal == null) {
    el.innerHTML   = fallbackInitial || '?';
    el.style.background = '';
    return;
  }

  const animal = AVATAR_ANIMALS[avatarData.animal]  || AVATAR_ANIMALS[0];
  const bg     = AVATAR_BACKGROUNDS[avatarData.bg]  || AVATAR_BACKGROUNDS[0];
  const obj    = (avatarData.object != null) ? AVATAR_OBJECTS[avatarData.object] : null;

  el.style.background = bg.value;
  el.innerHTML = `
    ${obj ? `<span class="av-obj-layer">${obj.emoji}</span>` : ''}
    <span class="av-animal-layer">${animal.emoji}</span>
  `;
}

/* Apply the saved avatar to every avatar element currently on screen */
function applyAvatarEverywhere(profile) {
  const av       = profile?.avatar;
  const fallback = (profile?.displayName || profile?.username || '?').charAt(0).toUpperCase();

  renderAvatarEl(document.getElementById('profile-big-avatar'), av, fallback);
  renderAvatarEl(document.getElementById('header-avatar'),      av, fallback);
}

/* ══════════════════════════════════════════════════════════
   MONKEY-PATCH  showMainApp  so avatar is applied on login
   (runs after DOMContentLoaded so window.showMainApp exists)
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  const _orig = window.showMainApp;
  if (typeof _orig === 'function') {
    window.showMainApp = function (...args) {
      _orig.apply(this, args);
      // slight defer to let the original finish setting innerHTML first
      setTimeout(() => applyAvatarEverywhere(S.profile), 0);
    };
  }
});

/* ══════════════════════════════════════════════════════════
   MODAL — open / close
   ══════════════════════════════════════════════════════════ */
function openAvatarBuilder() {
  // Seed draft from the user's saved avatar (or defaults)
  const saved  = S.profile?.avatar;
  AB.animal = saved?.animal ?? 0;
  AB.bg     = saved?.bg     ?? 0;
  AB.object = saved?.object ?? null;

  _renderBuilderGrids();
  _updatePreview();
  switchBuilderTab('animal');           // always start on the Animals tab
  document.getElementById('avatar-builder-modal').classList.add('open');
}

function closeAvatarBuilder() {
  document.getElementById('avatar-builder-modal').classList.remove('open');
}

/* ── Tab switching ──────────────────────────────────────── */
function switchBuilderTab(tab) {
  document.querySelectorAll('.ab-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.ab-tab-panel').forEach(p =>
    p.classList.toggle('active', p.dataset.tab === tab)
  );
}

/* ══════════════════════════════════════════════════════════
   GRID RENDERERS
   ══════════════════════════════════════════════════════════ */
function _renderBuilderGrids() {
  /* Animals */
  document.getElementById('ab-animals-grid').innerHTML =
    AVATAR_ANIMALS.map((a, i) => `
      <button class="ab-item${AB.animal === i ? ' selected' : ''}"
              onclick="selectAnimal(${i})" title="${a.name}">
        <span class="ab-item-emoji">${a.emoji}</span>
        <span class="ab-item-label">${a.name}</span>
      </button>`
    ).join('');

  /* Backgrounds */
  document.getElementById('ab-bg-grid').innerHTML =
    AVATAR_BACKGROUNDS.map((b, i) => `
      <button class="ab-bg-item${AB.bg === i ? ' selected' : ''}"
              onclick="selectBg(${i})" style="background:${b.value}" title="${b.name}">
        ${AB.bg === i ? '<span class="ab-check">✓</span>' : ''}
      </button>`
    ).join('');

  /* Objects (first option is "None") */
  document.getElementById('ab-objects-grid').innerHTML =
    `<button class="ab-item${AB.object === null ? ' selected' : ''}"
             onclick="selectObject(null)" title="None">
       <span class="ab-item-emoji">🚫</span>
       <span class="ab-item-label">None</span>
     </button>` +
    AVATAR_OBJECTS.map((o, i) => `
      <button class="ab-item${AB.object === i ? ' selected' : ''}"
              onclick="selectObject(${i})" title="${o.name}">
        <span class="ab-item-emoji">${o.emoji}</span>
        <span class="ab-item-label">${o.name}</span>
      </button>`
    ).join('');
}

/* ── Selection handlers ─────────────────────────────────── */
function selectAnimal(i)  { AB.animal = i;    _renderBuilderGrids(); _updatePreview(); }
function selectBg(i)      { AB.bg     = i;    _renderBuilderGrids(); _updatePreview(); }
function selectObject(i)  { AB.object = i;    _renderBuilderGrids(); _updatePreview(); }

/* ── Live preview ───────────────────────────────────────── */
function _updatePreview() {
  renderAvatarEl(document.getElementById('ab-preview'), AB, '?');
}

/* ══════════════════════════════════════════════════════════
   SAVE  — writes to Firestore, updates in-memory profile,
           re-renders all avatar elements, closes modal
   ══════════════════════════════════════════════════════════ */
async function saveAvatar() {
  asdasd
  console.log("hiiiiiii");
  if (!window.S?.user || !window.db) return;

  const btn = document.getElementById('ab-save-btn');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  const avatarData = { animal: AB.animal, bg: AB.bg, object: AB.object };

  try {
    await db.collection('users').doc(S.user.uid).update({ avatar: avatarData });
    S.profile.avatar = avatarData;
    applyAvatarEverywhere(S.profile);
    closeAvatarBuilder();
  } catch (err) {
    console.error('Avatar save error:', err);
  } finally {
    btn.textContent = 'Save Avatar';
    btn.disabled    = false;
  }
}
