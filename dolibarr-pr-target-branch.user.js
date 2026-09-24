// ==UserScript==
// @name         Dolibarr PR - Tag branche cible
// @namespace    https://github.com/Dolibarr/dolibarr
// @version      2.0.0
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
    // Aligné sur les labels natifs de la nouvelle liste (tokens de 20px,
    // espacés de 4px à droite).
    style.textContent =
      '.ghbt-tag { margin-right: 4px; vertical-align: middle; text-decoration: none; }';
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
    a.className = 'IssueLabel hx_IssueLabel ghbt-tag';
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

  // Depuis 2026, la page /pulls est une application React (« repoPullsDashboard ») :
  // plus de .js-issue-row, de #issue_<n>_link ni de details.commit-build-statuses.
  // On s'appuie sur les attributs data-* stables de la nouvelle liste :
  //   - a[data-testid="listitem-title-link"] : lien du titre, href .../pull/<n>
  //   - [data-listview-item-title-container] : conteneur du titre, dont le
  //     dernier <span> accueille les labels natifs (« trailing badges »).
  const TITLE_LINK_SELECTOR = 'a[data-testid="listitem-title-link"]';

  // Le script s'injecte sur tout le dépôt (voir @match) pour être présent dès
  // qu'un utilisateur arrive sur /pulls via une navigation côté client (qui ne
  // recharge pas vraiment la page, donc Tampermonkey ne réinjecterait rien).
  // On ne travaille donc que sur les pages de liste des PR : /pulls, /pulls/
  // et les raccourcis de filtre comme /pulls/<utilisateur>. Les pages de PR
  // individuelles utilisent /pull/<numéro> (singulier), donc pas de risque de
  // faux positif ici.
  function isPullsListPage() {
    return /^\/Dolibarr\/dolibarr\/pulls(\/|$)/.test(location.pathname);
  }

  function extractPrNumber(titleLink) {
    const m = /\/pull\/(\d+)(?:[/?#]|$)/.exec(titleLink.getAttribute('href') || '');
    return m ? m[1] : null;
  }

  function getRows() {
    const rows = [];
    document.querySelectorAll(TITLE_LINK_SELECTOR).forEach((titleLink) => {
      const row = titleLink.closest('li') || titleLink.closest('[data-listview-item-title-container]');
      if (row) rows.push({ row, titleLink });
    });
    return rows;
  }

  function findTagContainer(titleLink) {
    const titleContainer = titleLink.closest('[data-listview-item-title-container]');
    if (!titleContainer) return null;
    // Le conteneur des labels natifs est le dernier <span> enfant direct du
    // conteneur de titre ; on y ajoute notre tag en fin, ce qui ne perturbe
    // pas la réconciliation React (elle ne manipule que ses propres nœuds).
    const spans = titleContainer.querySelectorAll(':scope > span');
    return spans.length ? spans[spans.length - 1] : titleContainer;
  }

  function placeTag(titleLink, tag) {
    if (tag.isConnected) return;
    const container = findTagContainer(titleLink);
    if (container) {
      container.appendChild(tag);
    } else {
      titleLink.after(tag);
    }
  }

  // PR dont la récupération de la branche cible est en cours, pour ne pas
  // déclencher plusieurs fetches en parallèle pour le même numéro.
  const fetchesInFlight = new Set();

  async function processRow({ row, titleLink }) {
    if (row.querySelector('.ghbt-tag')) return; // déjà taggée, rien à faire

    const number = extractPrNumber(titleLink);
    if (!number) {
      log('processRow: pas de numéro de PR trouvé pour', titleLink.href);
      return;
    }

    const cached = getCachedBaseRef(number);
    if (cached) {
      placeTag(titleLink, createLabelElement(cached));
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
      // La ligne a pu être remplacée/re-taguée pendant l'attente du fetch
      // (React recrée volontiers les <li> lors d'un re-render).
      if (!row.isConnected || row.querySelector('.ghbt-tag')) return;
      placeTag(titleLink, createLabelElement(baseRef));
      log('processRow: tag posé depuis l\'API pour', number, baseRef);
    } catch (e) {
      // Erreur réseau ou limite de l'API GitHub atteinte : on laisse la ligne sans tag,
      // elle sera retentée au prochain scan.
      log('processRow: erreur fetch pour', number, e);
    } finally {
      fetchesInFlight.delete(number);
    }
  }

  function processRows(reason) {
    if (!isPullsListPage()) return;

    const rows = getRows();
    const untagged = rows.filter(({ row }) => !row.querySelector('.ghbt-tag'));
    log('processRows', { reason, rows: rows.length, untagged: untagged.length });
    rows.forEach(processRow);
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

    // GitHub navigue sans rechargement complet (Turbo sur les pages classiques,
    // routeur React sur la liste des PR) : ces événements couvrent les cas que
    // le MutationObserver seul peut manquer (restauration depuis le cache de
    // page, retour arrière du navigateur).
    ['turbo:load', 'turbo:render', 'turbo:frame-load'].forEach((type) => {
      document.addEventListener(type, () => scheduleScan(type));
    });
    window.addEventListener('popstate', () => scheduleScan('popstate'));
    window.addEventListener('pageshow', () => scheduleScan('pageshow'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
