import { initGithubProjects } from './github-projects.js';

const yearEl = document.getElementById('footer-year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Referenz: 6. Klasse im Schuljahr 2026/2027. Schuljahr beginnt im September —
// die Klassenstufe zählt sich davon ausgehend automatisch jedes Jahr hoch.
function updateSchoolGrade() {
  const el = document.getElementById('school-grade');
  if (!el) return;

  const REFERENCE_SCHOOL_YEAR_START = 2026;
  const REFERENCE_GRADE = 6;

  const now = new Date();
  const month = now.getMonth() + 1;
  const schoolYearStart = month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const grade = REFERENCE_GRADE + (schoolYearStart - REFERENCE_SCHOOL_YEAR_START);

  if (grade < 1 || grade > 13) return;
  el.textContent = `${grade}. Klasse (Schuljahr ${schoolYearStart}/${schoolYearStart + 1})`;
}
updateSchoolGrade();

function updateAge() {
  const el = document.getElementById('age');
  if (!el) return;

  const BIRTH_YEAR = 2014;
  const BIRTH_MONTH = 12; // 1-12
  const BIRTH_DAY = 13;

  const now = new Date();
  let age = now.getFullYear() - BIRTH_YEAR;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > BIRTH_MONTH ||
    (now.getMonth() + 1 === BIRTH_MONTH && now.getDate() >= BIRTH_DAY);
  if (!hadBirthdayThisYear) age -= 1;

  el.textContent = age;
}
updateAge();

function animateSkillBars() {
  const tiles = document.querySelectorAll('.skill-tile[data-level]');
  tiles.forEach((tile) => {
    const fill = tile.querySelector('.rpm-bar-fill');
    const level = tile.getAttribute('data-level');
    if (!fill || !level) return;
    requestAnimationFrame(() => {
      fill.style.width = `${level}%`;
    });
  });
}
animateSkillBars();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

function observeReveals(root = document) {
  root.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}
observeReveals();

initGithubProjects().then(() => {
  document.querySelectorAll('#projects-grid > *').forEach((el) => el.classList.add('reveal'));
  observeReveals();
});

const canvas = document.getElementById('hero-canvas');
const fallback = document.getElementById('hero-fallback');

import('./hero-scene.js')
  .then(({ initHeroScene }) => {
    initHeroScene({ canvas, fallback, reduceMotion });
  })
  .catch(() => {
    if (canvas) canvas.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
  });

const tickerBar = document.getElementById('car-ticker');
const tickerCanvas = document.getElementById('ticker-canvas');

function hideTicker() {
  if (tickerBar) tickerBar.style.display = 'none';
  document.body.style.paddingBottom = '0';
}

if (reduceMotion) {
  hideTicker();
} else {
  import('./ticker-scene.js')
    .then(({ initTickerScene }) => {
      initTickerScene({ canvas: tickerCanvas, bar: tickerBar, onFail: hideTicker });
    })
    .catch(hideTicker);
}

const aboutSection = document.getElementById('about');
const aboutCanvas = document.getElementById('about-canvas');
const aboutPanel = document.querySelector('.about-visual');

function hideAboutVisual() {
  if (aboutSection) aboutSection.classList.add('no-visual');
}

if (reduceMotion) {
  hideAboutVisual();
} else {
  import('./about-scene.js')
    .then(({ initAboutScene }) => {
      initAboutScene({ canvas: aboutCanvas, panel: aboutPanel, onFail: hideAboutVisual });
    })
    .catch(hideAboutVisual);
}
