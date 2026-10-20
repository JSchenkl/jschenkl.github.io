import { initGithubProjects } from './github-projects.js';

const yearEl = document.getElementById('footer-year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
