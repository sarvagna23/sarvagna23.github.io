/* =========================================================
   Portfolio interactions
   1. Custom cursor (dot + trailing ring)
   2. Hover state on clickable elements
   3. Card spotlight that follows the mouse
   4. Hero video scrubbed by cursor position
   5. Orange trail reveal in the projects zone
   ========================================================= */

/* ---------- Settings you can tweak ---------- */
const RING_EASING   = 0.15;         // cursor ring: lower = laggier, higher = snappier
const AXIS          = 'angle';      // video scrub: 'angle' (eyes circle clip), 'horizontal' or 'vertical'
const REVERSE       = false;        // flips the scrub direction
const SMOOTHING     = 0.22;         // video scrub: 0.02 = heavy inertia, 1 = instant
const MIN_STEP      = 0.008;        // ignore seeks smaller than this (prevents jitter)
const TRACK_WINDOW  = false;        // true = whole page drives the video, false = hero only
const ANGLE_CENTER_X = 0.5;
const ANGLE_CENTER_Y = 0.52;       
const IS_CIRCULAR   = AXIS === 'angle'; // angle mode treats the clip as one full 360 degree loop

/* ---------- User preferences ---------- */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer       = window.matchMedia('(pointer: fine)').matches;

/* =========================================================
   1 + 2. Custom cursor and hover state
   ========================================================= */
const dot  = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');

let mouseX = 0, mouseY = 0;   // real cursor position
let ringX  = 0, ringY  = 0;   // lagging ring position

if (hasFinePointer) {
  // Dot follows the mouse with no delay
  window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    dot.style.left = `${mouseX}px`;
    dot.style.top  = `${mouseY}px`;
  });
  
  // Ring moves a fraction of the remaining distance every frame
  const animateRing = () => {
    const easing = prefersReducedMotion ? 1 : RING_EASING;
    ringX += (mouseX - ringX) * easing;
    ringY += (mouseY - ringY) * easing;
    ring.style.left = `${ringX}px`;
    ring.style.top  = `${ringY}px`;
    requestAnimationFrame(animateRing);
  };
  animateRing();

  // Ring grows when the pointer is over something clickable
  document.querySelectorAll('a, button, .card').forEach((element) => {
    element.addEventListener('mouseenter', () => ring.classList.add('is-hovering'));
    element.addEventListener('mouseleave', () => ring.classList.remove('is-hovering'));
  });
}

/* =========================================================
   3. Card spotlight
   Writes the mouse position (relative to the card) into CSS
   variables that the radial gradient in style.css reads.
   ========================================================= */
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    const box    = card.getBoundingClientRect();
    const localX = event.clientX - box.left;
    const localY = event.clientY - box.top;
    card.style.setProperty('--mx', `${localX}px`);
    card.style.setProperty('--my', `${localY}px`);
  });
});

/* =========================================================
   4. Hero video scrub
   Pipeline per frame:
   cursor position (0..1) -> target time -> eased time -> video.currentTime
   ========================================================= */
const video = document.getElementById('scrub');
const hero  = document.getElementById('hero');

let normalizedPosition = 0;   // cursor position along the chosen axis, 0 to 1
let smoothPosition     = 0;   // eased 0..1 position we actually apply to the video
let isSeeking          = false; // true while the browser is mid-seek
let isReady            = false; // true once enough frames are buffered

// Skip the scrub for reduced motion users; they just see the first frame
if (video && !prefersReducedMotion) {
  // Warm up: muted playback is allowed, so play then pause forces frame decoding
  video.load();
  video.play().then(() => video.pause()).catch(() => {});
  video.currentTime = 0;

  video.addEventListener('canplaythrough', () => { isReady = true; });
  video.addEventListener('seeking', () => { isSeeking = true; });
  video.addEventListener('seeked',  () => { isSeeking = false; });

  // Turn a pointer or touch event into a clamped 0..1 position
  const updatePosition = (clientX, clientY) => {
    // Angle mode: the angle of the cursor around the face becomes the position.
    // 0 = cursor to the right, then clockwise: down, left, up, back to right.
    if (IS_CIRCULAR) {
      const heroBox  = hero.getBoundingClientRect();
      const centerX  = heroBox.left + heroBox.width  * ANGLE_CENTER_X;
      const centerY  = heroBox.top  + heroBox.height * ANGLE_CENTER_Y;
      const angle    = Math.atan2(clientY - centerY, clientX - centerX); // -PI to PI
      const fullTurn = Math.PI * 2;
      const turned   = (((angle % fullTurn) + fullTurn) % fullTurn) / fullTurn; // 0 to 1
      normalizedPosition = REVERSE ? (1 - turned) % 1 : turned;
      return;
    }

    let position;

    if (TRACK_WINDOW) {
      position = AXIS === 'horizontal'
        ? clientX / window.innerWidth
        : clientY / window.innerHeight;
    } else {
      const box = hero.getBoundingClientRect();
      position = AXIS === 'horizontal'
        ? (clientX - box.left) / box.width
        : (clientY - box.top) / box.height;
    }

    const clamped = Math.min(1, Math.max(0, position));
    normalizedPosition = REVERSE ? 1 - clamped : clamped;
  };

  // Angle mode listens on the whole window so the eyes keep following over the header too
  const listenTarget = (TRACK_WINDOW || IS_CIRCULAR) ? window : hero;
  listenTarget.addEventListener('pointermove', (event) => {
    updatePosition(event.clientX, event.clientY);
  });

  // Touch screens have no hover, so let a finger drag drive the scrub
  hero.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    updatePosition(touch.clientX, touch.clientY);
  }, { passive: true });

  // Animation loop: ease toward the target and seek only when it is safe
  const tick = () => {
    const duration = video.duration;

    if (isReady && Number.isFinite(duration)) {
      let distance = normalizedPosition - smoothPosition;

      // Circular mode: take the short way around so the seam (end to start) never rewinds the clip
      if (IS_CIRCULAR) {
        if (distance >  0.5) distance -= 1;
        if (distance < -0.5) distance += 1;
      }

      smoothPosition += distance * SMOOTHING;
      if (IS_CIRCULAR) smoothPosition = (smoothPosition + 1) % 1;

      const smoothTime = smoothPosition * duration;

      const changedEnough = Math.abs(video.currentTime - smoothTime) > MIN_STEP;

      // Seek guard: skip while the previous seek has not finished
      if (!isSeeking && changedEnough) {
        video.currentTime = smoothTime;
      }
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* =========================================================
   5. Orange trail reveal (projects + LinkedIn/GitHub zone)
   As the cursor moves, soft blobs are painted along its path.
   The blobs act as a mask: the orange gingham image shows only
   where a blob exists, then each blob fades away over time.
   ========================================================= */
const zone        = document.getElementById('zone');
const trailCanvas = document.getElementById('trail');

if (zone && trailCanvas && hasFinePointer && !prefersReducedMotion) {
  const trailContext = trailCanvas.getContext('2d');

  const orangeImage = new Image();
  orangeImage.src = 'assets/gingham-orange.jpg';

  // ---- Trail settings ----
  const HEART_SIZE      = 150;   // average heart size in px
  const TRAIL_LIFETIME  = 1600;  // ms until a heart has faded away completely
  const TRAIL_SPACING   = 48;    // px between hearts along the cursor path
  const TRAIL_MAX_BLOBS = 80;    // safety cap so a long swipe never slows the page
  // One soft white heart drawn once, then stamped for every trail point.
  // Its alpha becomes the mask that reveals the orange gingham.
  const heartSprite = document.createElement('canvas');
  heartSprite.width = heartSprite.height = 128;
  const spriteContext = heartSprite.getContext('2d');
  const heartPath = new Path2D(
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
  );
  spriteContext.scale(128 / 24, 128 / 24);
  spriteContext.shadowColor = 'white';
  spriteContext.shadowBlur  = 4;           // feathered edge
  spriteContext.fillStyle   = 'white';
  spriteContext.fill(heartPath);

  let trailPoints    = [];      // each blob: { x, y, bornAt }
  let lastTrailPoint = null;    // last cursor position inside the zone
  let isTrailRunning = false;   // true while the draw loop is active
  let zoneWidth      = 0;
  let zoneHeight     = 0;

  // Keep the canvas pixel size in sync with the zone (sharp on retina screens)
  const resizeTrailCanvas = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const zoneBox    = zone.getBoundingClientRect();
    zoneWidth  = zoneBox.width;
    zoneHeight = zoneBox.height;
    trailCanvas.width  = Math.round(zoneWidth  * pixelRatio);
    trailCanvas.height = Math.round(zoneHeight * pixelRatio);
    trailContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };
  resizeTrailCanvas();
  new ResizeObserver(resizeTrailCanvas).observe(zone);

  // Draw the image so it fills the canvas, matching CSS "background-size: cover"
  const drawCover = (image) => {
    const scale      = Math.max(zoneWidth / image.naturalWidth, zoneHeight / image.naturalHeight);
    const drawWidth  = image.naturalWidth  * scale;
    const drawHeight = image.naturalHeight * scale;
    const offsetX    = (zoneWidth  - drawWidth)  / 2;
    const offsetY    = (zoneHeight - drawHeight) / 2;
    trailContext.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  };

  const drawTrail = (now) => {
    // Drop blobs that have fully faded
    trailPoints = trailPoints.filter((point) => now - point.bornAt < TRAIL_LIFETIME);
    trailContext.clearRect(0, 0, zoneWidth, zoneHeight);

    if (trailPoints.length === 0) {
      isTrailRunning = false;
      return;
    }

    // Wait for the orange image before painting anything
    if (!orangeImage.complete || !orangeImage.naturalWidth) {
      requestAnimationFrame(drawTrail);
      return;
    }

    // Step 1: stamp the white heart at every point. Its alpha becomes the mask.
    trailContext.globalCompositeOperation = 'source-over';
    for (const point of trailPoints) {
      const age      = (now - point.bornAt) / TRAIL_LIFETIME; // 0 = new, 1 = gone
      const strength = 0.95 * Math.pow(1 - age, 1.5);         // fades out as it ages
      const popIn    = 0.6 + 0.4 * Math.min(1, age / 0.2);    // grows to full size at first
      const size     = point.size * popIn;

      trailContext.save();
      trailContext.globalAlpha = strength;
      trailContext.translate(point.x, point.y);
      trailContext.rotate(point.tilt);
      trailContext.drawImage(heartSprite, -size / 2, -size / 2, size, size);
      trailContext.restore();
    }

    // Step 2: keep the orange gingham only where the blobs are
    trailContext.globalCompositeOperation = 'source-in';
    drawCover(orangeImage);
    trailContext.globalCompositeOperation = 'source-over';

    requestAnimationFrame(drawTrail);
  };

  const startTrail = () => {
    if (isTrailRunning) return;
    isTrailRunning = true;
    requestAnimationFrame(drawTrail);
  };

  // Add blobs along the line from the last position to the new one,
  // so fast swipes leave a continuous trail instead of dots
  zone.addEventListener('pointermove', (event) => {
    const zoneBox = zone.getBoundingClientRect();
    const x   = event.clientX - zoneBox.left;
    const y   = event.clientY - zoneBox.top;
    const now = performance.now();

    if (lastTrailPoint) {
      const deltaX   = x - lastTrailPoint.x;
      const deltaY   = y - lastTrailPoint.y;
      const distance = Math.hypot(deltaX, deltaY);
      const steps    = Math.max(1, Math.floor(distance / TRAIL_SPACING));

      for (let step = 1; step <= steps; step++) {
        const progress = step / steps;
        trailPoints.push({
          x: lastTrailPoint.x + deltaX * progress,
          y: lastTrailPoint.y + deltaY * progress,
          bornAt: now,
          size: HEART_SIZE * (0.8 + Math.random() * 0.4),   // slight size variety
          tilt: (Math.random() - 0.5) * 0.7,                // slight random tilt
        });
      }
    } else {
      trailPoints.push({ x, y, bornAt: now, size: HEART_SIZE, tilt: 0 });
    }

    lastTrailPoint = { x, y };

    if (trailPoints.length > TRAIL_MAX_BLOBS) {
      trailPoints.splice(0, trailPoints.length - TRAIL_MAX_BLOBS);
    }
    startTrail();
  });

  // Start a fresh path when the cursor re-enters, so no line jumps across the gap
  zone.addEventListener('pointerleave', () => { lastTrailPoint = null; });
}