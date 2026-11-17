// Early-access form
const earlyAccessForm = document.querySelector('#early-access form');
earlyAccessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = earlyAccessForm.querySelector('.form-status');
  const submit = earlyAccessForm.querySelector('button');
  submit.disabled = true;
  delete status.dataset.state;
  status.textContent = 'Sending your request…';
  try {
    const response = await fetch(earlyAccessForm.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams(new FormData(earlyAccessForm)),
    });
    const result = await response.json();
    status.textContent = result.message;
    if (response.ok) {
      status.dataset.state = 'success';
      earlyAccessForm.reset();
    }
  } catch {
    status.textContent = 'No pudimos enviar tu solicitud. Inténtalo de nuevo.';
  } finally {
    submit.disabled = false;
  }
});

// Hero scroll animation
const hero = document.querySelector('.hero');
const heroVisual = hero.querySelector('.visual');
hero.classList.add('has-scroll-conversation');
const heroConversation = document.querySelector('.hero-conversation');
const heroMessages = [...heroConversation.children];
const world = document.querySelector('.relay-world');
const worldSection = world.parentElement;
const heroMotion = matchMedia('(prefers-reduced-motion: no-preference)');
let heroFrame = 0;

function updateHeroConversation() {
  heroFrame = 0;
  if (!heroMotion.matches) return;

  const viewportHeight = window.innerHeight;
  const image = heroVisual.getBoundingClientRect();
  // The handset occupies rows 63–1509 in the 1536px transparent image.
  const phoneTop = image.top + image.height * (63 / 1536);
  const phoneBottom = image.top + image.height * (1509 / 1536);
  const phoneCenter = (phoneTop + phoneBottom) / 2;
  const distance = Math.max(0, viewportHeight / 2 - phoneCenter);
  // Measure the remaining travel from the centered position to the top edge.
  const liftRate = 0.38;
  const centeredBottom = (viewportHeight + phoneBottom - phoneTop) / 2;
  const phoneExit = centeredBottom / (1 + liftRate);
  const travel = Math.min(distance, phoneExit) * liftRate;
  const heroTop = hero.getBoundingClientRect().top;
  const greenEdge =
    heroTop + parseFloat(getComputedStyle(hero, '::before').height);
  hero.style.setProperty('--conversation-lift', `${-travel}px`);
  const worldBounds = worldSection.getBoundingClientRect();
  const leadingBubbleTop = worldBounds.top + world.offsetTop;
  const clearance = 24;
  const backgroundPause = viewportHeight * 0.1;
  const backgroundDrift = Math.max(
    0,
    Math.min(distance, phoneExit) - backgroundPause,
  );
  const pacedHold = Math.min(distance, backgroundPause) + backgroundDrift * 0.1;
  const backgroundHold = Math.min(
    pacedHold,
    leadingBubbleTop - greenEdge - clearance,
  );
  hero.style.setProperty('--background-hold', `${backgroundHold}px`);

  const revealStart = 0.04;
  const revealInterval = 0.052;
  const revealDuration = 0.12;
  const progress =
    (viewportHeight - worldBounds.top - world.offsetTop) / viewportHeight;

  heroMessages.forEach((message, index) => {
    const reveal = Math.max(
      0,
      Math.min(
        1,
        (progress - revealStart - index * revealInterval) / revealDuration,
      ),
    );
    message.style.setProperty('--message-opacity', reveal);
    message.style.setProperty('--message-offset', `${18 * (1 - reveal)}px`);
  });
}

function scheduleHeroConversation() {
  if (!heroFrame) heroFrame = requestAnimationFrame(updateHeroConversation);
}

window.addEventListener('scroll', scheduleHeroConversation, { passive: true });
window.addEventListener('resize', scheduleHeroConversation);
heroVisual
  .querySelector('img')
  .addEventListener('load', scheduleHeroConversation);
heroMotion.addEventListener('change', scheduleHeroConversation);
updateHeroConversation();

// Globe rendering and conversation bubbles
const earth = document.querySelector('.relay-earth');
const earthContext = earth.getContext('2d');
const earthTexture = new Image();

earthTexture.addEventListener('load', () => {
  if (!earthContext) return;
  const texture = document.createElement('canvas');
  texture.width = earthTexture.naturalWidth;
  texture.height = earthTexture.naturalHeight;
  const textureContext = texture.getContext('2d');
  textureContext.drawImage(earthTexture, 0, 0);
  const pixels = textureContext.getImageData(
    0,
    0,
    texture.width,
    texture.height,
  ).data;

  const size = earth.width;
  const frame = earthContext.createImageData(size, size);
  const surface = [];
  const tilt = 0.22;
  const sinTilt = Math.sin(tilt);
  const cosTilt = Math.cos(tilt);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = ((col + 0.5) * 2) / size - 1;
      const y = 1 - ((row + 0.5) * 2) / size;
      const radiusSquared = x * x + y * y;
      if (radiusSquared >= 1) continue;
      const z = Math.sqrt(1 - radiusSquared);
      const latitude = Math.asin(y * cosTilt + z * sinTilt);
      const longitude = Math.atan2(x, z * cosTilt - y * sinTilt);
      const light = 0.32 + 0.68 * Math.max(0, -0.35 * x + 0.44 * y + 0.82 * z);
      const dotDistance = Math.hypot((col % 7) - 3, (row % 7) - 3);
      const dot = Math.max(0, Math.min(1, 2.2 - dotDistance)) * z ** 0.4;
      surface.push({
        target: (row * size + col) * 4,
        column: (0.5 + longitude / (2 * Math.PI)) * texture.width,
        rowOffset:
          Math.min(
            texture.height - 1,
            Math.floor((0.5 - latitude / Math.PI) * texture.height),
          ) * texture.width,
        light,
        dot,
        atmosphere: 0.18 * (1 - z) ** 3,
      });
    }
  }

  const ocean = [21, 46, 42];
  const land = [127, 232, 188];
  const rim = [65, 111, 99];

  function drawEarth(rotation) {
    let landCoverage = 0;
    for (const point of surface) {
      const column = Math.floor(point.column + rotation) % texture.width;
      const source = (point.rowOffset + column) * 4;
      const dot = pixels[source] ? point.dot : 0;
      landCoverage += dot;
      for (let channel = 0; channel < 3; channel++) {
        const shaded =
          (ocean[channel] + (land[channel] - ocean[channel]) * dot) *
          point.light;
        frame.data[point.target + channel] =
          shaded + (rim[channel] - shaded) * point.atmosphere;
      }
      frame.data[point.target + 3] = 255;
    }
    earthContext.putImageData(frame, 0, 0);
    return landCoverage / surface.length;
  }

  const markers = heroMessages.map((bubble) => ({
    bubble,
    latitude: (Number(bubble.dataset.lat) * Math.PI) / 180,
    longitude: (Number(bubble.dataset.lon) * Math.PI) / 180,
    color: bubble.style.getPropertyValue('--bubble-accent'),
    phrases: [bubble.textContent, ...bubble.dataset.phrases.split('|')],
    lastPhrase: bubble.textContent,
    expiresAt: 0,
    litAt: -Infinity,
  }));
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  let nextMessageAt = 0;

  function showMessage(marker, now) {
    const { bubble } = marker;
    const phrases = marker.phrases.filter(
      (phrase) => phrase !== marker.lastPhrase,
    );
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const { width, height } = heroConversation.getBoundingClientRect();
    const globe = earth.getBoundingClientRect();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = globe.width / 2 + 8;
    const occupied = markers
      .filter((other) => other.expiresAt > now)
      .map((other) => {
        const { bubble } = other;
        return {
          x: bubble.offsetLeft,
          y: bubble.offsetTop,
          w: bubble.offsetWidth,
          h: bubble.offsetHeight,
        };
      });

    bubble.textContent = phrase;
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    for (let attempt = 0; attempt < 36; attempt++) {
      const x = Math.round(randomBetween(0, Math.max(0, width - w)));
      const y = Math.round(randomBetween(0, Math.max(0, height - h)));
      const dx = Math.max(x - centerX, centerX - x - w, 0);
      const dy = Math.max(y - centerY, centerY - y - h, 0);
      if (
        Math.hypot(dx, dy) < radius ||
        Math.hypot(dx, dy) > radius + Math.min(130, width * 0.24)
      )
        continue;
      if (
        occupied.some(
          (box) =>
            x < box.x + box.w + 10 &&
            x + w + 10 > box.x &&
            y < box.y + box.h + 10 &&
            y + h + 10 > box.y,
        )
      )
        continue;

      const duration = randomBetween(6200, 7600);
      bubble.style.setProperty('--bubble-x', `${x}px`);
      bubble.style.setProperty('--bubble-y', `${y}px`);
      marker.lastPhrase = phrase;
      marker.expiresAt = now + duration;
      marker.litAt = now;
      marker.animation = bubble.animate(
        [
          { opacity: 0, transform: 'translateY(5px) scale(.98)' },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
            offset: 240 / duration,
          },
          {
            opacity: 1,
            offset: randomBetween(0.25, 0.34),
            easing: 'ease-in-out',
          },
          { opacity: 0 },
        ],
        { duration },
      );
      return true;
    }
    return false;
  }

  function drawMessageMarker(rotation, now) {
    const facing = markers
      .map((marker) => {
        const longitude =
          marker.longitude - (rotation / texture.width) * 2 * Math.PI;
        const x = Math.cos(marker.latitude) * Math.sin(longitude);
        const y = Math.sin(marker.latitude);
        const z = Math.cos(marker.latitude) * Math.cos(longitude);
        return {
          marker,
          x,
          y: y * cosTilt - z * sinTilt,
          depth: y * sinTilt + z * cosTilt,
        };
      })
      .filter((point) => point.depth > 0.3);
    if (now >= nextMessageAt) {
      const available = facing.filter(({ marker }) => marker.expiresAt <= now);
      const choice = available[Math.floor(Math.random() * available.length)];
      nextMessageAt =
        choice && showMessage(choice.marker, now)
          ? now + randomBetween(800, 1850)
          : now + 240;
    }

    const point = facing.reduce(
      (latest, candidate) =>
        candidate.marker.litAt > (latest?.marker.litAt ?? now - 2100)
          ? candidate
          : latest,
      undefined,
    );
    if (!point) return;

    const x = ((point.x + 1) * size) / 2;
    const y = ((1 - point.y) * size) / 2;
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    earthContext.save();
    earthContext.fillStyle = point.marker.color;
    earthContext.shadowColor = point.marker.color;
    earthContext.shadowBlur = 12;
    const glow = 1 - Math.min(1, (now - point.marker.litAt) / 2100);
    earthContext.globalAlpha = (0.25 + pulse * 0.25) * glow;
    earthContext.beginPath();
    earthContext.arc(x, y, 8 + pulse * 3, 0, 2 * Math.PI);
    earthContext.fill();
    earthContext.globalAlpha = glow;
    earthContext.beginPath();
    earthContext.arc(x, y, 4.5, 0, 2 * Math.PI);
    earthContext.fill();
    earthContext.restore();
  }

  let visible = false;
  let timer;
  let rotation = texture.width * 0.04;
  let rotationSpeed = 1;
  function syncEarthRotation() {
    if (visible && heroMotion.matches && timer === undefined) {
      heroConversation.classList.add('is-linked');
      drawEarth(rotation);
      drawMessageMarker(rotation, performance.now());
      timer = setInterval(() => {
        rotation =
          (rotation + (rotationSpeed * texture.width) / (24 * 34)) %
          texture.width;
        const coverage = drawEarth(rotation);
        const oceanSpeed = 1 + 1.5 * Math.max(0, 1 - coverage / 0.035);
        rotationSpeed += (oceanSpeed - rotationSpeed) * 0.08;
        drawMessageMarker(rotation, performance.now());
      }, 1000 / 24);
    } else if ((!visible || !heroMotion.matches) && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
      if (!heroMotion.matches) {
        markers.forEach((marker) => {
          marker.animation?.cancel();
          marker.bubble.textContent = marker.phrases[0];
          marker.expiresAt = 0;
          marker.litAt = -Infinity;
        });
        nextMessageAt = 0;
        heroConversation.classList.remove('is-linked');
        drawEarth(rotation);
      }
    }
  }

  drawEarth(rotation);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncEarthRotation();
  });
  observer.observe(earth);
  heroMotion.addEventListener('change', syncEarthRotation);
});
earthTexture.src = '/relay-earth-land.png';

// Privacy video controls
const privacyFilm = document.querySelector('.privacy-film');
const privacyToggle = document.querySelector('.privacy-toggle');
const privacyMotion = matchMedia('(prefers-reduced-motion: reduce)');
let privacyPaused = false;
privacyToggle.hidden = false;
privacyFilm.addEventListener('playing', () => {
  privacyToggle.textContent = 'Pausar video';
});
privacyFilm.addEventListener('pause', () => {
  privacyToggle.textContent = 'Reproducir video';
});
privacyFilm.addEventListener('ended', () => {
  privacyToggle.textContent = 'Volver a reproducir';
});

privacyToggle.addEventListener('click', () => {
  privacyPaused = !privacyFilm.paused;
  if (privacyPaused) privacyFilm.pause();
  else privacyFilm.play().catch(() => {});
});

if ('IntersectionObserver' in window) {
  const privacyObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio < 0.45) privacyFilm.pause();
      else if (!privacyPaused && !privacyFilm.ended && !privacyMotion.matches) {
        privacyFilm.play().catch(() => {});
      }
    },
    { threshold: 0.45 },
  );
  privacyObserver.observe(privacyFilm);
}
privacyMotion.addEventListener('change', () => {
  if (privacyMotion.matches) privacyFilm.pause();
});
// Private number preview
const privateNumber = document.querySelector('.relay-gallery-private-number');
if ('IntersectionObserver' in window) {
  const numberPart = privateNumber.querySelector('span');
  const characters = [...numberPart.textContent];
  numberPart.classList.add('relay-gallery-number-part');
  numberPart.replaceChildren(
    ...characters.map((character, index) => {
      if (character === ' ') return document.createTextNode(character);
      const digit = document.createElement('span');
      digit.textContent = character;
      digit.style.setProperty('--digit-delay', index);
      return digit;
    }),
  );
  privateNumber.classList.add('is-ready');
}
// Calling number preview
const callingNumber = document.querySelector('.relay-gallery-call-number');
const callingReel = callingNumber.querySelector('.relay-gallery-call-reel');
const callingMotion = matchMedia('(prefers-reduced-motion: reduce)');
const callingAreaCodes = ['202', '312', '415', '503', '617', '646', '720'];
let callingVisible = false;
let callingTimer;
let settledCallingNumber = callingReel.textContent;

let callingSpins = [];

function rollCallingNumber() {
  const current = settledCallingNumber;
  const areaCode =
    callingAreaCodes[Math.floor(Math.random() * callingAreaCodes.length)];
  const previousSuffix = Number(current.slice(-2));
  const suffix = (previousSuffix + 1 + Math.floor(Math.random() * 99)) % 100;
  const next = `+1 (${areaCode}) 555-01${String(suffix).padStart(2, '0')}`;
  let digitIndex = 0;
  const columns = [...current].map((character, index) => {
    if (!/\d/.test(character)) {
      return document.createTextNode(character);
    }

    const downward = digitIndex % 2 === 0;
    const column = document.createElement('span');
    const strip = document.createElement('span');
    column.className = 'relay-gallery-call-digit';
    strip.className = 'relay-gallery-call-strip';
    const digits = [character];
    for (let step = 0; step < 4; step += 1) {
      digits.push(
        (Number(digits.at(-1)) + 1 + Math.floor(Math.random() * 9)) % 10,
      );
    }
    digits.push(next[index]);
    if (downward) digits.reverse();
    for (const digit of digits) {
      const row = document.createElement('span');
      row.textContent = digit;
      strip.append(row);
    }
    column.append(strip);

    const end = `translateY(-${(digits.length - 1) * 1.25}em)`;
    const positions = downward
      ? [end, 'translateY(0)']
      : ['translateY(0)', end];
    callingSpins.push(
      strip.animate(
        positions.map((transform) => ({ transform })),
        {
          delay: digitIndex * 55,
          duration: 680,
          easing: 'cubic-bezier(.22,.76,.27,1)',
          fill: 'both',
        },
      ),
    );
    digitIndex += 1;
    return column;
  });

  callingReel.replaceChildren(...columns);
  callingSpins.at(-1).onfinish = () => {
    settledCallingNumber = next;
    resetCallingReel();
  };
}

function resetCallingReel() {
  callingSpins.forEach((spin) => spin.cancel());
  callingSpins = [];
  callingReel.textContent = settledCallingNumber;
}

function syncCallingPreview() {
  clearInterval(callingTimer);
  resetCallingReel();
  if (!callingVisible || callingMotion.matches) return;
  callingTimer = setInterval(rollCallingNumber, 3200);
}

if ('IntersectionObserver' in window) {
  const callingObserver = new IntersectionObserver(
    ([entry]) => {
      callingVisible = entry.isIntersecting && entry.intersectionRatio >= 0.75;
      syncCallingPreview();
    },
    { threshold: 0.75 },
  );
  callingObserver.observe(callingNumber);
  callingMotion.addEventListener('change', syncCallingPreview);
}
// Feature carousel
const gallery = document.querySelector('.relay-gallery-track');
const [previousFeature, nextFeature] = document.querySelectorAll(
  '.relay-gallery-actions button',
);
const galleryCards = [...gallery.children];

function cloneGalleryCards() {
  return galleryCards.map((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    return clone;
  });
}

const leadingCards = cloneGalleryCards();
const trailingCards = cloneGalleryCards();
gallery.prepend(...leadingCards);
gallery.append(...trailingCards);
// Username typing preview
const usernameMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sampleUsernames = ['alex', 'maya', 'jordan'];
const usernamePreviews = [
  ...gallery.querySelectorAll('.relay-gallery-username'),
];
const usernameValues = usernamePreviews.map((preview) =>
  preview.querySelector('.relay-gallery-username-value'),
);
const visibleUsernamePreviews = new Set();
let usernameTimer;
let usernameIndex = 0;
let typedLength = 0;
let deletingUsername = false;

function animateUsername() {
  const username = sampleUsernames[usernameIndex];
  typedLength += deletingUsername ? -1 : 1;
  usernameValues.forEach((value) => {
    value.textContent = username.slice(0, typedLength);
  });

  let delay = deletingUsername ? 85 : 155;
  if (typedLength === username.length) {
    deletingUsername = true;
    delay = 1400;
  } else if (typedLength === 0) {
    deletingUsername = false;
    usernameIndex = (usernameIndex + 1) % sampleUsernames.length;
    delay = 500;
  }

  usernameTimer = setTimeout(animateUsername, delay);
}

function syncUsernameAnimation() {
  const shouldAnimate =
    visibleUsernamePreviews.size > 0 && !usernameMotion.matches;
  usernamePreviews.forEach((preview) => {
    preview.classList.toggle(
      'is-visible',
      shouldAnimate && visibleUsernamePreviews.has(preview),
    );
  });

  if (!shouldAnimate) {
    clearTimeout(usernameTimer);
    usernameTimer = undefined;
    if (usernameMotion.matches) {
      usernameIndex = 0;
      typedLength = 0;
      deletingUsername = false;
      usernameValues.forEach((value) => {
        value.textContent = sampleUsernames[0];
      });
    }
  } else if (usernameTimer === undefined) {
    usernameTimer = setTimeout(animateUsername, 550);
  }
}

if ('IntersectionObserver' in window) {
  const usernameObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
          visibleUsernamePreviews.add(entry.target);
        else visibleUsernamePreviews.delete(entry.target);
      }
      syncUsernameAnimation();
    },
    { threshold: 0.5 },
  );
  usernamePreviews.forEach((preview) => usernameObserver.observe(preview));
  usernameMotion.addEventListener('change', syncUsernameAnimation);
}

if ('IntersectionObserver' in window) {
  const numberObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle(
          'is-blurring',
          entry.intersectionRatio >= 0.75,
        );
      }
    },
    { threshold: 0.75 },
  );
  gallery
    .querySelectorAll('.relay-gallery-private-number')
    .forEach((number) => numberObserver.observe(number));
}

function galleryStop(card) {
  const padding = parseFloat(getComputedStyle(gallery).paddingLeft) || 0;
  return (
    card.getBoundingClientRect().left -
    gallery.getBoundingClientRect().left +
    gallery.scrollLeft -
    padding
  );
}

function wrapGallery() {
  const start = galleryStop(galleryCards[0]);
  const end = galleryStop(trailingCards[0]);
  if (gallery.scrollLeft < start - 2) {
    gallery.scrollTo({
      left: gallery.scrollLeft + end - start,
      behavior: 'instant',
    });
  } else if (gallery.scrollLeft >= end - 2) {
    gallery.scrollTo({
      left: gallery.scrollLeft - end + start,
      behavior: 'instant',
    });
  }
}

function moveGallery(direction) {
  const stops = [...gallery.children].map(galleryStop);
  const target =
    direction > 0
      ? stops.find((stop) => stop > gallery.scrollLeft + 2)
      : stops.reverse().find((stop) => stop < gallery.scrollLeft - 2);
  if (target === undefined) return;
  gallery.scrollTo({
    left: target,
    behavior: privacyMotion.matches ? 'instant' : 'smooth',
  });
}

gallery.scrollTo({ left: galleryStop(galleryCards[0]), behavior: 'instant' });
previousFeature.addEventListener('click', () => moveGallery(-1));
nextFeature.addEventListener('click', () => moveGallery(1));
gallery.addEventListener('keydown', (event) => {
  if (
    event.target !== gallery ||
    !['ArrowLeft', 'ArrowRight'].includes(event.key)
  )
    return;
  event.preventDefault();
  moveGallery(event.key === 'ArrowLeft' ? -1 : 1);
});
if ('onscrollend' in gallery) {
  gallery.addEventListener('scrollend', wrapGallery);
} else {
  let wrapTimer;
  gallery.addEventListener(
    'scroll',
    () => {
      clearTimeout(wrapTimer);
      wrapTimer = setTimeout(wrapGallery, 160);
    },
    { passive: true },
  );
}
