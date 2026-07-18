const MB = (function () {
  const KEYS = {
    LANG: 'mb_lang', THEME: 'mb_theme',
    DRAFT: 'mb_draft', SEATS: 'mb_selected_seats', ADMIN: 'mb_admin_logged_in',
    ADMIN_TOKEN: 'mb_admin_token', MY_RESERVATIONS: 'mb_my_reservations'
  };

  // Traductions (gardées pour l'accueil)
  const I18N = {
    fr: {
      hero_eyebrow: 'Voyagez à travers Madagascar',
      hero_title: 'La brousse malgache, à portée de billet',
      hero_lead: 'Réservez votre taxi-brousse en quelques clics.',
      hero_cta: 'Voir les départs', hero_cta2: 'Mes réservations',
      next_departures: 'Prochains départs', next_departures_sub: 'Les trajets les plus demandés',
      book_btn: 'Réserver', search_title: 'Rechercher un trajet',
      from_label: 'Départ', to_label: 'Arrivée', date_label: 'Date', maxprice_label: 'Prix max (Ar)',
      sort_label: 'Trier', sort_price: 'Prix croissant', sort_time: 'Heure de départ', search_btn: 'Rechercher',
      footer_rights: 'Tous droits réservés.',
      // 5 PHRASES POUR LE DIAPORAMA
      slide_1: 'Voyagez à travers Madagascar',
      slide_2: 'La brousse malgache, à portée de billet',
      slide_3: 'Découvrez l\'île Rouge en toute sécurité',
      slide_4: 'Confort, sécurité et ponctualité',
      slide_5: 'Réservez votre taxi-brousse en quelques clics'
    },
    mg: {
      hero_eyebrow: 'Mandehana manerana an\'i Madagasikara',
      hero_title: 'Ny taxi-brousse malagasy, eo an-tananao',
      hero_lead: 'Mamandrika ny taxi-brousse anao amin\'ny fikitihana vitsivitsy.',
      hero_cta: 'Jereo ny fandehanana', hero_cta2: 'Ny famandrihako',
      next_departures: 'Fandehanana ho avy', next_departures_sub: 'Ireo diabe be mpitady',
      book_btn: 'Mamandrika', search_title: 'Mitady dia',
      from_label: 'Niaingana', to_label: 'Halehana', date_label: 'Daty', maxprice_label: 'Vidiny ambony (Ar)',
      sort_label: 'Alahatra', sort_price: 'Vidiny mihamitombo', sort_time: 'Ora fiaingana', search_btn: 'Tadiavo',
      footer_rights: 'Zo rehetra voatokana.',
      // 5 PHRASES POUR LE DIAPORAMA
      slide_1: 'Mandehana manerana an\'i Madagasikara',
      slide_2: 'Ny taxi-brousse malagasy, eo an-tananao',
      slide_3: 'Fantaro ny Nosy Mena am-pilaminana',
      slide_4: 'Fahafaham-po, fiarovana ary fahamarinan-toerana',
      slide_5: 'Mamandrika ny taxi-brousse anao amin\'ny fikitihana vitsivitsy'
    },
    en: {
      hero_eyebrow: 'Travel across Madagascar',
      hero_title: 'Madagascar\'s bush taxis, one ticket away',
      hero_lead: 'Book your taxi-brousse in a few clicks.',
      hero_cta: 'See departures', hero_cta2: 'My bookings',
      next_departures: 'Upcoming departures', next_departures_sub: 'Most requested routes',
      book_btn: 'Book', search_title: 'Search a route',
      from_label: 'From', to_label: 'To', date_label: 'Date', maxprice_label: 'Max price (Ar)',
      sort_label: 'Sort', sort_price: 'Lowest price', sort_time: 'Departure time', search_btn: 'Search',
      footer_rights: 'All rights reserved.',
      // 5 PHRASES POUR LE DIAPORAMA
      slide_1: 'Travel across Madagascar',
      slide_2: 'Madagascar\'s bush taxis, one ticket away',
      slide_3: 'Discover the Red Island in complete safety',
      slide_4: 'Comfort, safety and punctuality',
      slide_5: 'Book your taxi-brousse in a few clicks'
    }
  };

  function getLang() { return localStorage.getItem(KEYS.LANG) || 'fr'; }
  function setLang(l) { localStorage.setItem(KEYS.LANG, l); }
  function t(key) { const lang = getLang(); return (I18N[lang] && I18N[lang][key]) || I18N.fr[key] || key; }
  function formatAr(n) { return Number(n).toLocaleString('fr-FR').replace(/,/g, ' ') + ' Ar'; }

  // Étiquette de siège partagée par toutes les pages : 1=E1, 2=E2, puis
  // A1..D5 (rangées de 4 sièges, A/B | allée | C/D). Le numéro brut reste
  // utilisé côté serveur/DB, seul l'affichage change.
  function seatLabel(num) {
    num = Number(num);
    if (num === 1) return 'E1';
    if (num === 2) return 'E2';
    const idx = num - 3;
    const row = Math.floor(idx / 4) + 1;
    const col = ['A', 'B', 'C', 'D'][idx % 4] || '?';
    return col + row;
  }
  function seatLabels(csv) {
    if (!csv) return '';
    return String(csv).split(',').map(s => s.trim()).filter(Boolean).map(seatLabel).join(', ');
  }

  // API
  function adminToken() { return localStorage.getItem(KEYS.ADMIN_TOKEN) || ''; }
  function authHeaders(extra) {
    return Object.assign({ 'Authorization': 'Bearer ' + adminToken() }, extra || {});
  }

  async function fetchTrips() {
    const res = await fetch('/api/trips');
    if (!res.ok) throw new Error('Erreur réseau');
    return res.json();
  }
  async function fetchOccupiedSeats(tripId) {
    const res = await fetch(`/api/occupied-seats/${tripId}`);
    return res.json();
  }
  // Crée la réservation, puis mémorise son ID dans le navigateur du client
  // (seul moyen pour lui de retrouver SES réservations sans exposer celles
  // des autres visiteurs).
  async function createReservation(data) {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur réservation');
    const result = await res.json();
    const mine = get(KEYS.MY_RESERVATIONS, []);
    if (!mine.includes(result.id)) { mine.push(result.id); set(KEYS.MY_RESERVATIONS, mine); }
    return result;
  }
  // Recherche des réservations du visiteur : il doit fournir SON numéro de
  // réservation ou SON email exact — jamais une liste automatique de tout
  // ce qui a été réservé depuis ce navigateur (non fiable sur un ordinateur
  // partagé).
  async function lookupReservations(query) {
    const res = await fetch(`/api/reservations/lookup?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Recherche impossible');
    return res.json();
  }
  async function rescheduleReservation(id, newTripId) {
    const res = await fetch(`/api/reservations/${id}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_trip_id: newTripId })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur de modification');
    return res.json();
  }
  // Réservations complètes avec coordonnées client : réservé à l'admin connecté
  async function fetchAdminReservations() {
    const res = await fetch('/api/admin/reservations', { headers: authHeaders() });
    if (res.status === 401) throw new Error('SESSION_EXPIREE');
    return res.json();
  }
  async function validateReservation(id) {
    const res = await fetch(`/api/admin/reservations/${id}/validate`, { method: 'PUT', headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur de validation');
    return res.json();
  }
  async function rejectReservation(id) {
    const res = await fetch(`/api/admin/reservations/${id}/reject`, { method: 'PUT', headers: authHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur de rejet');
    return res.json();
  }
  async function cancelReservation(id) {
    const res = await fetch(`/api/reservations/${id}/cancel`, { method: 'PUT' });
    return res.json();
  }
  async function adminLogin(username, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  }
  async function adminLogout() {
    try { await fetch('/api/admin/logout', { method: 'POST', headers: authHeaders() }); } catch (e) {}
    localStorage.removeItem(KEYS.ADMIN);
    localStorage.removeItem(KEYS.ADMIN_TOKEN);
  }
  async function fetchPromos() {
    const res = await fetch('/api/promos');
    return res.json();
  }
  async function fetchDrivers() {
    const res = await fetch('/api/drivers');
    return res.json();
  }
  async function fetchDestinationImages() {
    const res = await fetch('/api/destination-images');
    return res.json();
  }
  // formData : champs texte du trajet + éventuellement un fichier "photo"
  // (photo prise/uploadée par l'admin pour CE trajet précis).
  async function createTrip(formData) {
    const res = await fetch('/api/admin/trips', { method: 'POST', headers: authHeaders(), body: formData });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur création trajet');
    return res.json();
  }
  async function deactivateTrip(id) {
    const res = await fetch(`/api/admin/trips/${id}/deactivate`, { method: 'PUT', headers: authHeaders() });
    return res.json();
  }
  async function createDriver(formData) {
    const res = await fetch('/api/admin/drivers', { method: 'POST', headers: authHeaders(), body: formData });
    if (!res.ok) throw new Error('Erreur création chauffeur');
    return res.json();
  }
  async function createCustomer(data) {
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur inscription client');
    return res.json();
  }
  async function fetchCustomers() {
    const res = await fetch('/api/admin/customers', { headers: authHeaders() });
    return res.json();
  }

  function get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  function applyTheme() {
    const theme = localStorage.getItem(KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
  function toggleTheme() {
    const current = localStorage.getItem(KEYS.THEME) || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem(KEYS.THEME, next);
    applyTheme();
  }

  // ============================================================
  // DIAPORAMA DU TITRE HERO - 5 PHRASES
  // ============================================================
  function initHeroSlideshow() {
    const slideElement = document.getElementById('slide-text');
    if (!slideElement) return;
    
    // 5 PHRASES traduites
    const slides = [
      t('slide_1'),
      t('slide_2'),
      t('slide_3'),
      t('slide_4'),
      t('slide_5')
    ];
    
    let currentIndex = 0;
    
    // Appliquer les styles de transition
    slideElement.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    slideElement.style.display = 'inline-block';
    
    function changeSlide() {
      // Fondu sortant
      slideElement.style.opacity = '0';
      slideElement.style.transform = 'translateY(-8px)';
      
      setTimeout(() => {
        // Changer le texte
        currentIndex = (currentIndex + 1) % slides.length;
        slideElement.textContent = slides[currentIndex];
        
        // Fondu entrant
        slideElement.style.opacity = '1';
        slideElement.style.transform = 'translateY(0)';
      }, 400);
    }
    
    // Démarrer le diaporama toutes les 3 secondes
    setInterval(changeSlide, 3000);
  }

  // Initialisation commune : thème, footer, sélecteur de langue (s'il existe)
  function initCommon() {
    applyTheme();
    const langSelect = document.getElementById('mb-lang-select');
    if (langSelect) {
      langSelect.value = getLang();
      langSelect.addEventListener('change', e => { setLang(e.target.value); location.reload(); });
    }
    const themeBtn = document.getElementById('mb-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const footer = document.getElementById('mb-footer');
    if (footer) footer.innerHTML = `<footer><div class="container">&copy; ${new Date().getFullYear()} Mada-Brousse 2.0 — ${t('footer_rights')}</div></footer>`;
    
    // ⭐ DIAPORAMA HERO - 5 PHRASES
    initHeroSlideshow();
    
    if (!document.body.hasAttribute('data-no-chat')) initChat();
  }

  // ---------- Assistant chat (FAQ) ----------
  const CHAT_FAQ = [
    { q: 'Comment réserver ?', a: 'Cliquez sur "Voir les départs" ou "Réserver" dans le menu, choisissez un trajet, remplissez vos informations puis sélectionnez vos sièges.' },
    { q: 'Codes promo ?', a: 'Essayez MADA10 (-10%) ou BROUSSE2025 (-5000 Ar) au moment de la réservation.' },
    { q: 'Annuler une réservation ?', a: 'Allez dans "Mes réservations", retrouvez votre billet et cliquez sur "Annuler".' },
    { q: 'Moyens de paiement ?', a: 'Nous acceptons Orange Money, MVola et la carte bancaire.' },
    { q: 'Parler à un humain ?', a: 'Notre équipe est joignable au +261 34 00 000 00 ou par email à contact@mada-brousse.mg.' }
  ];

  function chatAnswerFor(text) {
    const q = text.toLowerCase();
    if (/promo|reduc|code/.test(q)) return CHAT_FAQ[1].a;
    if (/annul|rembours/.test(q)) return CHAT_FAQ[2].a;
    if (/paiement|payer|mvola|orange|carte/.test(q)) return CHAT_FAQ[3].a;
    if (/humain|contact|telephone|téléphone|appel/.test(q)) return CHAT_FAQ[4].a;
    if (/reserv|réserv|billet|ticket/.test(q)) return CHAT_FAQ[0].a;
    return "Je n'ai pas bien compris. Essayez une des suggestions ci-dessous, ou contactez-nous au +261 34 00 000 00.";
  }

  function initChat() {
    if (document.getElementById('mb-chat-bubble')) return;
    const bubble = document.createElement('button');
    bubble.id = 'mb-chat-bubble';
    bubble.className = 'chat-bubble';
    bubble.title = 'Besoin d\'aide ?';
    bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

    const win = document.createElement('div');
    win.id = 'mb-chat-window';
    win.className = 'chat-window';
    win.innerHTML = `
      <div class="chat-head"><span>Assistant Mada-Brousse</span><button id="mb-chat-close" aria-label="Fermer">&times;</button></div>
      <div class="chat-body" id="mb-chat-body"></div>
      <div class="chat-suggestions" id="mb-chat-suggestions"></div>
      <div style="display:flex; gap:6px; padding:10px 12px; border-top:1px solid #eee;">
        <input type="text" id="mb-chat-input" placeholder="Écrivez votre question…" style="flex:1; padding:8px 10px;">
        <button class="btn btn-primary btn-sm" id="mb-chat-send">Envoyer</button>
      </div>`;

    document.body.appendChild(bubble);
    document.body.appendChild(win);

    const body = win.querySelector('#mb-chat-body');
    function addMsg(text, who) {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + who;
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }
    function renderSuggestions() {
      win.querySelector('#mb-chat-suggestions').innerHTML = CHAT_FAQ
        .map((f, i) => `<button type="button" data-i="${i}">${f.q}</button>`).join('');
    }
    renderSuggestions();
    addMsg('Bonjour 👋 Comment puis-je vous aider aujourd\'hui ?', 'bot');

    win.querySelector('#mb-chat-suggestions').addEventListener('click', e => {
      const btn = e.target.closest('button[data-i]');
      if (!btn) return;
      const faq = CHAT_FAQ[Number(btn.dataset.i)];
      addMsg(faq.q, 'user');
      setTimeout(() => addMsg(faq.a, 'bot'), 300);
    });

    function sendFromInput() {
      const input = win.querySelector('#mb-chat-input');
      const text = input.value.trim();
      if (!text) return;
      addMsg(text, 'user');
      input.value = '';
      setTimeout(() => addMsg(chatAnswerFor(text), 'bot'), 300);
    }
    win.querySelector('#mb-chat-send').addEventListener('click', sendFromInput);
    win.querySelector('#mb-chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendFromInput(); });

    bubble.addEventListener('click', () => win.classList.toggle('open'));
    win.querySelector('#mb-chat-close').addEventListener('click', () => win.classList.remove('open'));
  }

  return {
    KEYS, get, set, getLang, setLang, t, formatAr, seatLabel, seatLabels,
    fetchTrips, fetchOccupiedSeats, createReservation, lookupReservations, rescheduleReservation, fetchAdminReservations,
    validateReservation, rejectReservation, cancelReservation,
    adminLogin, adminLogout, fetchPromos, fetchDrivers, fetchDestinationImages, createTrip, deactivateTrip,
    createDriver, createCustomer, fetchCustomers,
    applyTheme, toggleTheme, initCommon, initChat, initHeroSlideshow
  };
})();