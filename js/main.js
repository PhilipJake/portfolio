const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const pageProgress = document.querySelector('#page-progress');
const missionDialog = document.querySelector('.mission-dialog');
const dialogClose = document.querySelector('.dialog-close');
const languageGrid = document.querySelector('.language-grid');
const languageCurrent = document.querySelector('.language-current');
const shadowCursor = document.querySelector('.shadow-cursor');
const contactForm = document.querySelector('#message-form');
const contactStatus = document.querySelector('#message-status');
const sendButton = contactForm.querySelector('[type="submit"]');
let contactAddress = '';

fetch('/api/contact/config')
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then(({ contactEmail }) => {
    if (typeof contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      contactStatus.textContent = 'SET CONTACT_TO TO ENABLE EMAIL APPS';
      return;
    }
    contactAddress = contactEmail;
    document.querySelectorAll('[data-contact-method]').forEach((method) => {
      method.disabled = false;
    });
  })
  .catch(() => {
    contactStatus.textContent = 'START SERVER TO ENABLE CONTACT METHODS';
  });

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const formData = Object.fromEntries(new FormData(contactForm).entries());
  const { delivery, ...payload } = formData;

  if (delivery !== 'backend') {
    if (!contactAddress) {
      contactStatus.textContent = 'SET CONTACT_TO BEFORE CHOOSING AN EMAIL APP';
      return;
    }
    const subject = `Portfolio message from ${payload.name}`;
    const body = `Name: ${payload.name}\nReply address: ${payload.email}\n\n${payload.message}`;

    if (delivery === 'gmail') {
      const gmailUrl = new URL('https://mail.google.com/mail/');
      gmailUrl.searchParams.set('view', 'cm');
      gmailUrl.searchParams.set('fs', '1');
      gmailUrl.searchParams.set('to', contactAddress);
      gmailUrl.searchParams.set('su', subject);
      gmailUrl.searchParams.set('body', body);
      window.open(gmailUrl.toString(), '_blank', 'noopener,noreferrer');
      contactStatus.textContent = 'GMAIL COMPOSE OPENED / REVIEW AND SEND';
      return;
    }

    const mailtoUrl = `mailto:${contactAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    contactStatus.textContent = 'EMAIL APP OPENING / REVIEW AND SEND';
    return;
  }

  sendButton.disabled = true;
  sendButton.querySelector('span').textContent = 'TRANSMITTING...';
  contactStatus.textContent = 'TRANSMISSION IN PROGRESS';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429) contactStatus.textContent = 'RATE LIMIT / PLEASE TRY AGAIN LATER';
      else if (response.status === 503) contactStatus.textContent = 'MESSAGE SERVICE OFFLINE / TRY AGAIN LATER';
      else contactStatus.textContent = result.error || 'MESSAGE FAILED / CHECK YOUR DETAILS';
      return;
    }

    contactStatus.textContent = 'MESSAGE DELIVERED / THANK YOU';
    contactForm.reset();
  } catch {
    contactStatus.textContent = 'SERVER UNAVAILABLE / PLEASE TRY AGAIN';
  } finally {
    sendButton.disabled = false;
    sendButton.querySelector('span').textContent = 'SEND MESSAGE';
  }
});

function closeMenu() {
  navigation.dataset.open = 'false';
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
}

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  navigation.dataset.open = String(!isOpen);
});

navigation.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  closeMenu();
});

document.addEventListener('click', (event) => {
  if (menuToggle.getAttribute('aria-expanded') === 'true' && !event.target.closest('.header-right')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (missionDialog.open) missionDialog.close();
    if (menuToggle.getAttribute('aria-expanded') === 'true') closeMenu();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const shortcut = navigation.querySelector(`[data-hotkey="${event.key.toUpperCase()}"]`);
  if (!shortcut) return;
  event.preventDefault();
  shortcut.click();
});

document.querySelectorAll('.mission-open').forEach((button) => {
  button.addEventListener('click', () => {
    const mission = button.closest('.mission');
    const image = mission.querySelector('.mission-image img');
    missionDialog.querySelector('[data-dialog-index]').textContent = mission.querySelector('.mission-index span:first-child').textContent;
    missionDialog.querySelector('[data-dialog-image]').src = image.src;
    missionDialog.querySelector('[data-dialog-image]').alt = image.alt;
    missionDialog.querySelector('[data-dialog-type]').textContent = mission.querySelector('.mission-type').textContent;
    missionDialog.querySelector('[data-dialog-title]').textContent = mission.querySelector('.mission-info h3').innerText.replace(/\s+/g, ' ').trim();
    missionDialog.querySelector('[data-dialog-description]').textContent = mission.querySelector('.mission-detail > p').textContent;
    missionDialog.querySelector('[data-dialog-tags]').replaceChildren(...[...mission.querySelectorAll('.tech-tags span')].map((tag) => tag.cloneNode(true)));
    missionDialog.showModal();
    dialogClose.focus();
  });
});

dialogClose.addEventListener('click', () => missionDialog.close());
missionDialog.addEventListener('click', (event) => {
  if (event.target === missionDialog) missionDialog.close();
});
missionDialog.querySelector('.dialog-contact').addEventListener('click', () => missionDialog.close());

languageGrid.addEventListener('click', (event) => {
  const selected = event.target.closest('.language-card');
  if (!selected) return;
  languageGrid.querySelectorAll('.language-card').forEach((language) => {
    language.setAttribute('aria-pressed', String(language === selected));
  });
  languageCurrent.value = `${selected.dataset.language} / ${selected.dataset.category}`;
});

const sectionLinks = [...navigation.querySelectorAll('a[href^="#"]')];
const sectionObserver = new IntersectionObserver((entries) => {
  const visibleSections = entries.filter((entry) => entry.isIntersecting);
  if (!visibleSections.length) return;
  const activeId = visibleSections.sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0].target.id;
  sectionLinks.forEach((link) => {
    if (link.hash === `#${activeId}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .25, .5, .75, 1] });

sectionLinks.forEach((link) => {
  const section = document.querySelector(link.hash);
  if (section) sectionObserver.observe(section);
});

function updatePageProgress() {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  pageProgress.value = scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;
}

window.addEventListener('scroll', updatePageProgress, { passive: true });
window.addEventListener('resize', updatePageProgress);
updatePageProgress();
document.querySelector('#year').textContent = new Date().getFullYear();

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (finePointer.matches && !reducedMotion.matches) {
  const trailCanvas = document.querySelector('.shadow-trail-canvas');
  const trailContext = trailCanvas.getContext('2d');
  const trailPoints = [];
  const trailDuration = 360;
  let trailFrame = null;
  let lastTrailMove = 0;

  document.documentElement.classList.add('shadow-cursor-active');

  function resizeTrailCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    trailCanvas.width = Math.round(window.innerWidth * pixelRatio);
    trailCanvas.height = Math.round(window.innerHeight * pixelRatio);
    trailContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawTrail() {
    const now = performance.now();
    while (trailPoints.length && now - trailPoints[0].time > trailDuration) trailPoints.shift();
    const idleFade = Math.max(0, 1 - (now - lastTrailMove) / trailDuration);
    trailContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (trailPoints.length > 1 && idleFade > 0) {
      const first = trailPoints[0];
      const last = trailPoints[trailPoints.length - 1];
      const gradient = trailContext.createLinearGradient(first.x, first.y, last.x, last.y);
      gradient.addColorStop(0, 'rgba(91, 111, 255, .02)');
      gradient.addColorStop(.52, 'rgba(120, 103, 255, .24)');
      gradient.addColorStop(1, 'rgba(204, 178, 255, .58)');

      trailContext.save();
      trailContext.globalAlpha = idleFade;
      trailContext.strokeStyle = gradient;
      trailContext.lineWidth = 3;
      trailContext.lineCap = 'round';
      trailContext.lineJoin = 'round';
      trailContext.shadowColor = 'rgba(140, 111, 255, .2)';
      trailContext.shadowBlur = 5;
      trailContext.beginPath();
      trailContext.moveTo(first.x, first.y);
      for (let index = 1; index < trailPoints.length - 1; index += 1) {
        const point = trailPoints[index];
        const next = trailPoints[index + 1];
        trailContext.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      }
      trailContext.lineTo(last.x, last.y);
      trailContext.stroke();
      trailContext.restore();
    }

    trailFrame = idleFade > 0 && trailPoints.length > 1 ? requestAnimationFrame(drawTrail) : null;
  }

  resizeTrailCanvas();
  window.addEventListener('resize', resizeTrailCanvas);

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    shadowCursor.style.left = `${event.clientX}px`;
    shadowCursor.style.top = `${event.clientY}px`;
    const now = performance.now();
    while (trailPoints.length && now - trailPoints[0].time > trailDuration) trailPoints.shift();
    trailPoints.push({ x: event.clientX, y: event.clientY, time: now });
    if (trailPoints.length > 36) trailPoints.shift();
    lastTrailMove = now;
    if (trailFrame === null) trailFrame = requestAnimationFrame(drawTrail);
  });

  document.addEventListener('pointerover', (event) => {
    if (event.target.closest('a, button, [role="button"]')) shadowCursor.classList.add('is-hovering');
  });

  document.addEventListener('pointerout', (event) => {
    if (event.relatedTarget?.closest?.('a, button, [role="button"]')) return;
    shadowCursor.classList.remove('is-hovering');
  });

  document.addEventListener('pointerdown', () => shadowCursor.classList.add('is-pressed'));
  document.addEventListener('pointerup', () => shadowCursor.classList.remove('is-pressed'));
  document.addEventListener('pointercancel', () => shadowCursor.classList.remove('is-pressed'));
  document.documentElement.addEventListener('pointerleave', () => shadowCursor.style.opacity = '0');
  document.documentElement.addEventListener('pointerenter', () => shadowCursor.style.opacity = '1');
}