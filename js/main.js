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

initGithubProjects();

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
