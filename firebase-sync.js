// ── Firebase Sync — Mes Menus ─────────────────────────────────
// Chargé APRÈS le script principal : accède aux variables globales
// Remplace le stub fbSync par les vraies fonctions Firebase
//
// Accès restreint (30/06/2026) : connexion Google obligatoire pour la
// synchro, limitée aux 2 comptes de la famille. Sans connexion (ou avec
// un compte non autorisé), l'app continue de fonctionner normalement en
// local (localStorage) — seule la synchro entre appareils est coupée.

(function () {

  firebase.initializeApp({
    apiKey: "AIzaSyAXzH9-j33ZOEFPfsUuNtu5vjmGaNUxcDI",
    authDomain: "mes-menus-famille.firebaseapp.com",
    projectId: "mes-menus-famille",
    storageBucket: "mes-menus-famille.firebasestorage.app",
    messagingSenderId: "554571384276",
    appId: "1:554571384276:web:94f006ddff1ca96eb28241"
  });

  const ALLOWED_EMAILS = ['lauriecordedda@gmail.com', 'nelson.cordedda@gmail.com'];

  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  let _db = null;
  let _firestoreReady = false;

  // ── DEBUG TEMPORAIRE (30/06/2026) — à retirer une fois le bug résolu ──
  function dbg(msg) {
    const el = document.getElementById('fb-debug');
    if (!el) return;
    el.style.display = 'block';
    el.textContent += new Date().toLocaleTimeString() + ' — ' + msg + '\n';
  }
  dbg('Script firebase-sync.js charge');

  // ── Barre de connexion (UI) ───────────────────────────────────
  function renderAuthBar(state, label) {
    const el = document.getElementById('auth-bar');
    if (!el) return;
    if (state === 'signed-in') {
      el.className = 'auth-bar ok';
      el.innerHTML = `<span>✓ Connecté — ${label} · synchro active</span>
        <button onclick="fbSignOut()">Déconnexion</button>`;
    } else if (state === 'denied') {
      el.className = 'auth-bar err';
      el.innerHTML = `<span>⚠️ Compte non autorisé (${label}) — synchro désactivée</span>
        <button onclick="fbSignIn()">Changer de compte</button>`;
    } else if (state === 'loading') {
      el.className = 'auth-bar';
      el.innerHTML = `<span>Connexion en cours…</span>`;
    } else {
      el.className = 'auth-bar';
      el.innerHTML = `<span>🔒 Synchro entre appareils désactivée</span>
        <button onclick="fbSignIn()">Se connecter avec Google</button>`;
    }
  }

  window.fbSignIn = function () {
    dbg('Clic sur Se connecter — tentative popup');
    renderAuthBar('loading');
    auth.signInWithPopup(provider).then(result => {
      dbg('Popup OK — email=' + result.user.email);
    }).catch(err => {
      dbg('Popup ECHEC — code=' + err.code + ' msg=' + err.message);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        dbg('Repli sur signInWithRedirect');
        auth.signInWithRedirect(provider);
      } else {
        renderAuthBar('signed-out');
      }
    });
  };

  window.fbSignOut = function () {
    auth.signOut();
  };

  // ── Activation de la synchro Firestore (uniquement si compte autorisé) ─
  function enableFirestoreSync() {
    if (_firestoreReady) return;
    _firestoreReady = true;

    _db = firebase.firestore();
    _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
        console.warn('[FB] Persistence:', err.code);
    });

    const _ref = key => _db.collection('etat').doc('cordedda_' + key);

    fbSync = {
      saveActiveMeals(d) {
        try { localStorage.setItem('activeMeals', JSON.stringify(d)); } catch(e) {}
        _ref('activeMeals').set({ v: JSON.stringify(d) });
      },
      saveMealPersons(d) {
        try { localStorage.setItem('mealPersons', JSON.stringify(d)); } catch(e) {}
        _ref('mealPersons').set({ v: JSON.stringify(d) });
      },
      saveChecked(d) {
        try { localStorage.setItem('coursesChecked', JSON.stringify(d)); } catch(e) {}
        _ref('checked').set({ v: JSON.stringify(d) });
      },
      savePrixUser(d) {
        try { localStorage.setItem('prixUser', JSON.stringify(d)); } catch(e) {}
        _ref('prix').set({ v: JSON.stringify(d) });
      },
      saveAnnexe(d) {
        try { localStorage.setItem('annexeItems', JSON.stringify(d)); } catch(e) {}
        _ref('annexe').set({ v: JSON.stringify(d) });
      },
    };

    function _listen(key, onData) {
      _ref(key).onSnapshot(snap => {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        try { onData(JSON.parse(snap.data().v)); } catch(e) {}
      }, err => console.warn('[FB] Listen', key, err.code));
    }

    _listen('activeMeals', v => { activeMeals = v; renderPlanning(); renderCourses(); renderResume(); });
    _listen('mealPersons', v => { mealPersons = v; renderPlanning(); renderCourses(); renderCouts(); });
    _listen('checked',     v => { checked = v; renderCourses(); });
    _listen('prix',        v => { prixUser = { ...prixDefaut, ...v }; renderCouts(); renderCourses(); });
    _listen('annexe',      v => { annexeItems = v; annexeNextId = Math.max(...v.map(i => i.id), 20) + 1; renderAnnexe(); });

    console.log('[Firebase] Synchronisation active');
  }

  // ── État de connexion ──────────────────────────────────────────
  dbg('Verification getRedirectResult...');
  auth.getRedirectResult().then(result => {
    if (result && result.user) dbg('getRedirectResult OK — email=' + result.user.email);
    else dbg('getRedirectResult — aucun resultat en attente');
  }).catch(err => {
    dbg('getRedirectResult ECHEC — code=' + err.code + ' msg=' + err.message);
    renderAuthBar('signed-out');
  });

  let _deniedUntil = 0;

  auth.onAuthStateChanged(user => {
    dbg('onAuthStateChanged declenche — user=' + (user ? user.email : 'null'));
    if (!user) {
      if (Date.now() < _deniedUntil) return; // laisser le message "compte refusé" visible un instant
      renderAuthBar('signed-out');
      return;
    }
    if (!user.emailVerified || !ALLOWED_EMAILS.includes(user.email)) {
      dbg('Compte refuse — emailVerified=' + user.emailVerified + ' email=' + user.email);
      _deniedUntil = Date.now() + 4000;
      renderAuthBar('denied', user.email || 'compte inconnu');
      auth.signOut();
      return;
    }
    dbg('Compte autorise — activation synchro');
    renderAuthBar('signed-in', user.email === 'lauriecordedda@gmail.com' ? 'Elle' : 'Lui');
    enableFirestoreSync();
  });

})();