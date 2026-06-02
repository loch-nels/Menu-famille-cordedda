// ── Firebase Sync — Mes Menus ─────────────────────────────────
// Chargé APRÈS le script principal : accède aux variables globales
// Remplace le stub fbSync par les vraies fonctions Firebase

(function () {

  firebase.initializeApp({
    apiKey: "AIzaSyBbt2R_8VGeVlQNczOSnnd82OOjyUUDfZ4",
    authDomain: "menus-famille-7fcdb.firebaseapp.com",
    projectId: "menus-famille-7fcdb",
    storageBucket: "menus-famille-7fcdb.firebasestorage.app",
    messagingSenderId: "724347903790",
    appId: "1:724347903790:web:454421a924092d2a3ee4bf"
  });

  const _db = firebase.firestore();

  // Persistance hors-ligne : fonctionne même sans réseau
  _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
      console.warn('[FB] Persistence:', err.code);
  });

  // Référence d'un document d'état
  const _ref = key => _db.collection('etat').doc('cordedda_' + key);

  // ── Écriture : localStorage + Firestore ────────────────────
  // On écrit dans les deux : localStorage pour la réactivité immédiate,
  // Firestore pour la synchro entre appareils
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

  // ── Listeners temps réel ────────────────────────────────────
  // hasPendingWrites = true → write local pas encore confirmé → on ignore
  // hasPendingWrites = false → donnée confirmée par le serveur → on applique
  // (évite les double-renders sur les writes locaux)
  function _listen(key, onData) {
    _ref(key).onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      try { onData(JSON.parse(snap.data().v)); } catch(e) {}
    });
  }

  _listen('activeMeals', v => {
    activeMeals = v;
    renderPlanning();
    renderCourses();
    renderResume();
  });

  _listen('mealPersons', v => {
    mealPersons = v;
    renderPlanning();
    renderCourses();
    renderCouts();
  });

  _listen('checked', v => {
    checked = v;
    renderCourses();
  });

  _listen('prix', v => {
    prixUser = { ...prixDefaut, ...v };
    renderCouts();
    renderCourses();
  });

  _listen('annexe', v => {
    annexeItems = v;
    annexeNextId = Math.max(...v.map(i => i.id), 20) + 1;
    renderAnnexe();
  });

  console.log('[Firebase] Synchronisation active — famille Cordedda');

})();
