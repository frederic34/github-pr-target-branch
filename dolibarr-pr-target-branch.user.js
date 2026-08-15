// ==UserScript==
// @name         Dolibarr PR - Tag branche cible
// @namespace    https://github.com/Dolibarr/dolibarr
// @version      1.5.1
// @description  Affiche un tag (style label GitHub) indiquant la branche cible (base) de chaque Pull Request dans la liste https://github.com/Dolibarr/dolibarr/pulls
// @author       you
// @match        https://github.com/Dolibarr/dolibarr*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const REPO = 'Dolibarr/dolibarr';
  const CACHE_PREFIX = `ghbt:${REPO}:`;
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  // Passer à true pour du diagnostic (logs préfixés [ghbt] dans la console).
  const DEBUG = false;
  function log(...args) {
    if (DEBUG) console.log('[ghbt]', ...args);
  }

  const GIT_BRANCH_ICON_PATH =
    'M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z';

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = '.ghbt-tag { margin-left: 4px; }';
    document.head.appendChild(style);
  }

  function getToken() {
    return GM_getValue('githubToken', '');
  }

  function promptForToken() {
    const current = getToken();
    const input = window.prompt(
      "Token GitHub (Personal Access Token, scope 'public_repo' suffit) pour passer de 60 à 5000 requêtes/heure.\nLaissez vide pour le supprimer.",
      current
    );
    if (input === null) return; // annulé
    const token = input.trim();
    GM_setValue('githubToken', token);
    window.alert(token ? 'Token GitHub enregistré.' : 'Token GitHub supprimé.');
  }

  GM_registerMenuCommand('Définir le token GitHub (API)', promptForToken);

  function getCachedBaseRef(number) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + number);
      if (!raw) return null;
      const { ref, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return ref;
    } catch (e) {
      return null;
    }
  }

  function setCachedBaseRef(number, ref) {
    try {
      localStorage.setItem(CACHE_PREFIX + number, JSON.stringify({ ref, ts: Date.now() }));
    } catch (e) {
      // localStorage indisponible ou plein : tant pis, pas de cache
    }
  }

  async function getBaseRef(number) {
    const cached = getCachedBaseRef(number);
    if (cached) return cached;

    const headers = { Accept: 'application/vnd.github+json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/repos/${REPO}/pulls/${number}`, { headers });
    if (!res.ok) {
      log(
        'getBaseRef: réponse API non-ok pour',
        number,
        res.status,
        'reste:',
        res.headers.get('x-ratelimit-remaining')
      );
      return null;
    }

    const data = await res.json();
    const ref = data && data.base && data.base.ref;
    if (ref) setCachedBaseRef(number, ref);
    return ref || null;
  }

  function colorForBranch(ref) {
    if (ref === 'develop' || ref === 'main' || ref === 'master') {
      return { r: 46, g: 164, b: 79 }; // vert
    }
    if (/^\d+\.\d+$/.test(ref)) {
      return { r: 9, g: 105, b: 218 }; // bleu
    }
    return { r: 110, g: 119, b: 129 }; // gris
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h;
    let s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function createLabelElement(baseRef) {
    const { r, g, b } = colorForBranch(baseRef);
    const { h, s, l } = rgbToHsl(r, g, b);

    const query = `is:pr is:open base:${baseRef}`;
    const a = document.createElement('a');
    a.href = `/${REPO}/pulls?q=${encodeURIComponent(query)}`;
    a.className = 'IssueLabel hx_IssueLabel v-align-middle ghbt-tag';
    a.title = `Voir les PR ouvertes vers la branche ${baseRef}`;
    a.style.setProperty('--label-r', r);
    a.style.setProperty('--label-g', g);
    a.style.setProperty('--label-b', b);
    a.style.setProperty('--label-h', h);
    a.style.setProperty('--label-s', s);
    a.style.setProperty('--label-l', l);

    a.innerHTML = `<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="vertical-align:text-bottom;margin-right:2px;"><path d="${GIT_BRANCH_ICON_PATH}"></path></svg>`;
    a.append(document.createTextNode(baseRef));
    return a;
  }

  function getOrCreateLabelContainer(titleLink) {
    const next = titleLink.nextElementSibling;
    if (next && next.classList.contains('lh-default')) {
      return next;
    }
    const span = document.createElement('span');
    span.className = 'lh-default d-block d-md-inline';
    titleLink.after(span);
    return span;
  }

  function findChecksStatusAnchor(row) {
    const details = row.querySelector('details.commit-build-statuses');
    if (!details) return null;
    return details.closest('span.v-align-middle') || details;
  }

  // Le script s'injecte sur tout le dépôt (voir @match) pour être présent dès
  // qu'un utilisateur arrive sur /pulls via une navigation Turbo (qui ne
  // recharge pas vraiment la page, donc Tampermonkey ne réinjecterait rien).
  // On ne travaille donc que si l'URL courante est bien la liste des PR.
  function isPullsListPage() {
    return /^\/Dolibarr\/dolibarr\/pulls\/?$/.test(location.pathname);
  }

  function extractPrNumber(row) {
    const m = /^issue_(\d+)$/.exec(row.id);
    return m ? m[1] : null;
  }

  function placeTag(row, titleLink, tag) {
    const checksAnchor = findChecksStatusAnchor(row);
    if (checksAnchor) {
      // Placé juste après l'icône de statut des checks CI (coche verte / croix rouge)
      // sur la ligne du titre. Ne déplace que si nécessaire, pour ne pas déclencher
      // de mutations DOM en boucle avec le MutationObserver.
      if (checksAnchor.nextElementSibling !== tag) {
        checksAnchor.after(tag);
      }
    } else if (!tag.isConnected) {
      const container = getOrCreateLabelContainer(titleLink);
      container.appendChild(tag);
    }
  }

  // PR dont la récupération de la branche cible est en cours, pour ne pas
  // déclencher plusieurs fetches en parallèle pour le même numéro.
  const fetchesInFlight = new Set();

  async function processRow(row) {
    if (row.querySelector('.ghbt-tag')) return; // déjà taggée, rien à faire

    const number = extractPrNumber(row);
    if (!number) {
      log('processRow: pas de numéro de PR trouvé pour la ligne', row.id);
      return;
    }

    const titleLink = row.querySelector(`#issue_${number}_link`);
    if (!titleLink) {
      log('processRow: titleLink introuvable pour', number);
      return;
    }

    const cached = getCachedBaseRef(number);
    if (cached) {
      placeTag(row, titleLink, createLabelElement(cached));
      log('processRow: tag posé depuis le cache pour', number, cached);
      return;
    }

    if (fetchesInFlight.has(number)) return;
    fetchesInFlight.add(number);

    try {
      const baseRef = await getBaseRef(number);
      if (!baseRef) {
        log('processRow: pas de base ref reçue pour', number, '(rate limit ou erreur ?)');
        return;
      }
      // La ligne a pu être remplacée/re-taguée pendant l'attente du fetch.
      if (row.querySelector('.ghbt-tag')) return;
      placeTag(row, titleLink, createLabelElement(baseRef));
      log('processRow: tag posé depuis l\'API pour', number, baseRef);
    } catch (e) {
      // Erreur réseau ou limite de l'API GitHub atteinte : on laisse la ligne sans tag,
      // elle sera retentée au prochain scan.
      log('processRow: erreur fetch pour', number, e);
    } finally {
      fetchesInFlight.delete(number);
    }
  }

  function repositionExistingTags() {
    document.querySelectorAll('.js-issue-row').forEach((row) => {
      const tag = row.querySelector('.ghbt-tag');
      const titleLink = row.querySelector('a.js-navigation-open.markdown-title');
      if (!tag || !titleLink) return;
      placeTag(row, titleLink, tag);
    });
  }

  function processRows(reason) {
    if (!isPullsListPage()) return;

    const rows = document.querySelectorAll('.js-issue-row');
    const untagged = Array.from(rows).filter((r) => !r.querySelector('.ghbt-tag'));
    log('processRows', { reason, rows: rows.length, untagged: untagged.length });
    rows.forEach(processRow);
    repositionExistingTags();
  }

  let scanTimer = null;
  function scheduleScan(reason) {
    log('scheduleScan', reason);
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => processRows(reason), 150);
  }

  function init() {
    injectStyle();
    processRows('init');

    // Observe <html> plutôt que <body> : si Turbo remplace <body> en entier
    // lors d'une navigation, ce remplacement reste visible comme mutation de
    // son parent, alors qu'un observer accroché à l'ancien <body> serait resté
    // sur un nœud détaché sans plus rien voir passer.
    const observer = new MutationObserver((mutations) =>
      scheduleScan(`mutation(${mutations.length})`)
    );
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // GitHub navigue via Turbo (pas de rechargement complet) : ces événements
    // couvrent les cas que le MutationObserver seul peut manquer (pagination
    // via <turbo-frame>, restauration depuis le cache de page Turbo, retour
    // arrière du navigateur).
    ['turbo:load', 'turbo:render', 'turbo:frame-load'].forEach((type) => {
      document.addEventListener(type, () => scheduleScan(type));
    });
    window.addEventListener('pageshow', () => scheduleScan('pageshow'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
