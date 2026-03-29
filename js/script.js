/**
 * ═══════════════════════════════════════════════════════════
 * MKB ANIMATION ENGINE + UX SYSTEM — js/script.js
 * PT Mitra Kawan Bersama
 * Pure Vanilla JavaScript — Zero External Dependencies
 * ═══════════════════════════════════════════════════════════
 *
 * Modules:
 *  1. MKBCore          — init + shared utilities
 *  2. NavbarController — scroll state, mobile toggle, active links
 *  3. RevealEngine     — IntersectionObserver-based reveal system
 *  4. CounterEngine    — animated number counters on viewport entry
 *  5. ScrollProgress   — reading progress indicator
 *  6. ServiceNavSpy    — sticky service/product nav active highlighting
 *  7. FooterYear       — dynamic copyright year
 *  8. SmoothAnchor     — smooth scroll for hash links
 *  9. PageTransition   — entry fade-in on page load
 * 10. FleetCardHover   — enhanced fleet card interactions
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. MKBCORE — Foundation & Utilities
═══════════════════════════════════════════════════════════ */
const MKBCore = (() => {

  /** DOM query shorthand */
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  /**
   * requestAnimationFrame throttle
   * Prevents animation callbacks from firing more than once per frame
   */
  const rafThrottle = (fn) => {
    let rafId = null;
    return function (...args) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        fn.apply(this, args);
        rafId = null;
      });
    };
  };

  /**
   * Linear interpolation between two values
   * @param {number} a  start
   * @param {number} b  end
   * @param {number} t  progress 0–1
   */
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * Easing function — ease out cubic
   * @param {number} t  progress 0–1
   */
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /**
   * Easing function — ease out quart (snappier)
   * @param {number} t  progress 0–1
   */
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  /**
   * Safely parse integer from element dataset
   * @param {HTMLElement} el
   * @param {string} key
   * @param {number} fallback
   */
  const dataInt = (el, key, fallback = 0) => {
    const v = parseInt(el.dataset[key], 10);
    return isNaN(v) ? fallback : v;
  };

  /**
   * Check reduced motion preference
   */
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Debounce utility
   */
  const debounce = (fn, delay = 150) => {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  return { $, $$, rafThrottle, lerp, easeOutCubic, easeOutQuart, dataInt, prefersReducedMotion, debounce };
})();


/* ═══════════════════════════════════════════════════════════
   2. NAVBAR CONTROLLER
   - Scroll state class toggle
   - Mobile menu open/close + overlay
   - Body scroll lock on mobile menu open
   - Active page detection
═══════════════════════════════════════════════════════════ */
const NavbarController = (() => {
  const { $, $$, rafThrottle } = MKBCore;

  const SCROLL_THRESHOLD = 80;

  let navbar, toggle, menu, overlay;
  let menuOpen = false;

  /** Add glassmorphism scrolled class */
  const onScroll = rafThrottle(() => {
    if (!navbar) return;
    const scrolled = window.scrollY > SCROLL_THRESHOLD;
    navbar.classList.toggle('scrolled', scrolled);
  });

  /** Open mobile nav */
  const openMenu = () => {
    if (!menu || !toggle) return;
    menuOpen = true;
    menu.classList.add('open');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    // overlay
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'nav-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 998;
        background: rgba(3,13,26,0.7);
        backdrop-filter: blur(2px);
        opacity: 0;
        transition: opacity 300ms ease;
      `;
      overlay.addEventListener('click', closeMenu);
      document.body.appendChild(overlay);
    }

    // Force reflow before animating
    overlay.offsetHeight;
    overlay.style.opacity = '1';
  };

  /** Close mobile nav */
  const closeMenu = () => {
    if (!menu || !toggle) return;
    menuOpen = false;
    menu.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
          overlay = null;
        }
      }, 300);
    }
  };

  /** Set active nav link based on current page */
  const setActiveLink = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    $$('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('/').pop();
      const isActive = linkPage === currentPage ||
        (currentPage === '' && linkPage === 'index.html');
      link.classList.toggle('active', isActive);
    });
  };

  const init = () => {
    navbar = $('#mkb-navbar');
    toggle = $('#navToggle');
    menu   = $('#navMenu');

    if (!navbar) return;

    // Scroll listener
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // immediate check

    // Toggle button
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        menuOpen ? closeMenu() : openMenu();
      });
    }

    // Close on nav link click (mobile)
    if (menu) {
      $$('.nav-link, .nav-cta', menu).forEach(link => {
        link.addEventListener('click', () => {
          if (menuOpen) closeMenu();
        });
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) closeMenu();
    });

    // Active link
    setActiveLink();
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   3. REVEAL ENGINE
   GSAP-like reveal system using IntersectionObserver
   
   Supported classes:
   - .reveal              — base fade + translateY
   - .reveal-delay-1–4    — staggered CSS delays
   - .reveal-stagger      — auto-stagger by nth-child (handled in CSS)
   
   Trigger: element crosses 15% viewport threshold
   Respects prefers-reduced-motion
═══════════════════════════════════════════════════════════ */
const RevealEngine = (() => {
  const { $$, prefersReducedMotion } = MKBCore;

  let observer;

  const THRESHOLD    = 0.12;  // 12% of element must be visible
  const ROOT_MARGIN  = '0px 0px -48px 0px'; // slight bottom offset

  const onIntersect = (entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      el.classList.add('is-visible');

      // Once revealed, stop observing
      obs.unobserve(el);
    });
  };

  const init = () => {
    // Skip animation for users who prefer reduced motion
    if (prefersReducedMotion()) {
      $$('.reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }

    observer = new IntersectionObserver(onIntersect, {
      threshold: THRESHOLD,
      rootMargin: ROOT_MARGIN,
    });

    $$('.reveal').forEach(el => observer.observe(el));
  };

  /** Re-scan DOM for newly added reveal elements (future-proof) */
  const scan = () => {
    if (!observer) return;
    $$('.reveal:not(.is-visible)').forEach(el => observer.observe(el));
  };

  return { init, scan };
})();


/* ═══════════════════════════════════════════════════════════
   4. COUNTER ENGINE
   Animated numeric counters — triggers on viewport entry
   
   Usage: <span class="counter" data-target="450" data-suffix="+">0</span>
   
   Options (data attributes):
   - data-target   {number}  Final value
   - data-suffix   {string}  Appended string ("+", "T+", "%", etc.)
   - data-prefix   {string}  Prepended string
   - data-duration {number}  Animation duration in ms (default: 1800)
   - data-decimals {number}  Decimal places (default: 0)
═══════════════════════════════════════════════════════════ */
const CounterEngine = (() => {
  const { $$, dataInt, easeOutQuart, prefersReducedMotion } = MKBCore;

  const DEFAULT_DURATION = 1800;

  /**
   * Animate a single counter element
   * @param {HTMLElement} el
   */
  const animateCounter = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';

    const target   = dataInt(el, 'target', 0);
    const suffix   = el.dataset.suffix   || '';
    const prefix   = el.dataset.prefix   || '';
    const duration = dataInt(el, 'duration', DEFAULT_DURATION);
    const decimals = dataInt(el, 'decimals', 0);

    // Instant for reduced motion
    if (prefersReducedMotion()) {
      el.textContent = prefix + target.toFixed(decimals) + suffix;
      return;
    }

    const startTime = performance.now();

    const tick = (now) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOutQuart(progress);
      const current  = eased * target;

      el.textContent = prefix + current.toFixed(decimals) + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Ensure exact final value
        el.textContent = prefix + target.toFixed(decimals) + suffix;
      }
    };

    requestAnimationFrame(tick);
  };

  const init = () => {
    const counters = $$('.counter');
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach(el => observer.observe(el));
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   5. SCROLL PROGRESS BAR
   Thin gold progress line at top of viewport
   Shows reading progress for long pages
═══════════════════════════════════════════════════════════ */
const ScrollProgress = (() => {
  const { rafThrottle } = MKBCore;

  let bar;

  const update = rafThrottle(() => {
    if (!bar) return;
    const scrollTop    = window.scrollY;
    const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
    const progress     = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width    = `${Math.min(progress, 100)}%`;
  });

  const init = () => {
    bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      height: 2px;
      width: 0%;
      background: linear-gradient(90deg, #F0B429, #F6C94E);
      z-index: 9999;
      pointer-events: none;
      transition: width 80ms linear;
      box-shadow: 0 0 8px rgba(240,180,41,0.5);
    `;
    document.body.appendChild(bar);
    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   6. SERVICE / PRODUCT NAV SPY
   Highlights the correct section in the sticky service nav
   as the user scrolls through service or product detail sections
═══════════════════════════════════════════════════════════ */
const ServiceNavSpy = (() => {
  const { $$, rafThrottle } = MKBCore;

  const OFFSET = 120; // px from top to trigger active state

  let navLinks = [];
  let sections = [];
  let active   = null;

  const getActiveSectionId = () => {
    let current = null;
    const scrollY = window.scrollY + OFFSET;

    sections.forEach(section => {
      if (section.offsetTop <= scrollY) {
        current = section.id;
      }
    });

    return current;
  };

  const update = rafThrottle(() => {
    const id = getActiveSectionId();
    if (id === active) return;
    active = id;

    navLinks.forEach(link => {
      const href      = link.getAttribute('href') || '';
      const targetId  = href.replace('#', '');
      link.classList.toggle('active-section', targetId === id);

      if (targetId === id) {
        link.style.color       = 'var(--gold-300)';
        link.style.borderColor = 'var(--gold-300)';
      } else {
        link.style.color       = '';
        link.style.borderColor = '';
      }
    });
  });

  const init = () => {
    navLinks = $$('.service-nav-link');
    if (!navLinks.length) return;

    // Collect target sections
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) {
        const section = document.getElementById(href.slice(1));
        if (section) sections.push(section);
      }
    });

    if (!sections.length) return;

    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   7. FOOTER YEAR
   Dynamically inserts current year into footer copyright
═══════════════════════════════════════════════════════════ */
const FooterYear = (() => {
  const init = () => {
    const slots = document.querySelectorAll('#footerYear');
    const year  = new Date().getFullYear();
    slots.forEach(slot => { slot.textContent = year; });
  };
  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   8. SMOOTH ANCHOR SCROLL
   Overrides default jump scroll for all hash links
   Accounts for fixed navbar height
═══════════════════════════════════════════════════════════ */
const SmoothAnchor = (() => {
  const { prefersReducedMotion } = MKBCore;

  const NAVBAR_OFFSET = 90; // px

  const scrollToTarget = (targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const top = target.getBoundingClientRect().top
              + window.scrollY
              - NAVBAR_OFFSET;

    if (prefersReducedMotion()) {
      window.scrollTo({ top, behavior: 'instant' });
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const init = () => {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href === '#') return;

      const targetId = href.slice(1);
      const target   = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      scrollToTarget(targetId);

      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, null, href);
      }
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   9. PAGE TRANSITION
   Fade-in on page load
   Fade-out before navigating away (for inter-page transitions)
═══════════════════════════════════════════════════════════ */
const PageTransition = (() => {
  const { prefersReducedMotion } = MKBCore;

  let curtain;

  const createCurtain = () => {
    curtain = document.createElement('div');
    curtain.setAttribute('aria-hidden', 'true');
    curtain.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: var(--navy-900, #030D1A);
      pointer-events: none;
      opacity: 1;
      transition: opacity 400ms cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(curtain);
  };

  const fadeIn = () => {
    if (!curtain || prefersReducedMotion()) {
      if (curtain) curtain.style.opacity = '0';
      return;
    }
    // Force layout
    curtain.offsetHeight;
    curtain.style.opacity = '0';

    setTimeout(() => {
      if (curtain && curtain.parentNode) {
        curtain.parentNode.removeChild(curtain);
        curtain = null;
      }
    }, 500);
  };

  const fadeOut = (callback) => {
    if (prefersReducedMotion()) {
      callback();
      return;
    }

    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: var(--navy-900, #030D1A);
      pointer-events: none;
      opacity: 0;
      transition: opacity 300ms cubic-bezier(0.45, 0, 0.55, 1);
    `;
    document.body.appendChild(overlay);
    overlay.offsetHeight;
    overlay.style.opacity = '1';

    setTimeout(callback, 350);
  };

  const init = () => {
    // Page load fade-in
    createCurtain();
    window.addEventListener('load', () => {
      fadeIn();
    });

    // Fallback — if load already fired
    if (document.readyState === 'complete') {
      fadeIn();
    }

    // Page exit fade-out on internal links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href') || '';

      // Skip: external, hash-only, email, tel, new tab, no-transition
      const isExternal    = link.hostname !== window.location.hostname;
      const isHash        = href.startsWith('#');
      const isEmail       = href.startsWith('mailto:');
      const isTel         = href.startsWith('tel:');
      const isNewTab      = link.target === '_blank';
      const isNoTransition = link.dataset.noTransition !== undefined;

      if (isExternal || isHash || isEmail || isTel || isNewTab || isNoTransition) return;
      if (!href || href === window.location.href) return;

      e.preventDefault();
      fadeOut(() => {
        window.location.href = href;
      });
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   10. FLEET CARD HOVER PARALLAX
   Subtle tilt + depth effect on fleet and service cards
   Respects prefers-reduced-motion
═══════════════════════════════════════════════════════════ */
const CardTilt = (() => {
  const { $$, prefersReducedMotion } = MKBCore;

  const MAX_TILT    = 4;   // degrees
  const MAX_SCALE   = 1.02;
  const PERSPECTIVE = 800; // px

  const applyTilt = (card) => {
    card.addEventListener('mousemove', (e) => {
      if (prefersReducedMotion()) return;

      const rect    = card.getBoundingClientRect();
      const cx      = rect.left + rect.width  / 2;
      const cy      = rect.top  + rect.height / 2;
      const dx      = (e.clientX - cx) / (rect.width  / 2);
      const dy      = (e.clientY - cy) / (rect.height / 2);
      const rotateX = -dy * MAX_TILT;
      const rotateY =  dx * MAX_TILT;

      card.style.transform     = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${MAX_SCALE})`;
      card.style.transition     = 'transform 80ms linear';
      card.style.willChange     = 'transform';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.transition = 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => {
        card.style.willChange = '';
        card.style.transition = '';
      }, 450);
    });
  };

  const init = () => {
    if (prefersReducedMotion()) return;

    // Apply to fleet cards and cert cards
    const selectors = [
      '.fleet-card',
      '.cert-card',
      '.mv-card',
      '.adv-card',
    ];

    selectors.forEach(selector => {
      $$(selector).forEach(card => applyTilt(card));
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   11. HERO PARALLAX
   Subtle parallax depth on hero background image
   Stops at first section
═══════════════════════════════════════════════════════════ */
const HeroParallax = (() => {
  const { $, rafThrottle, prefersReducedMotion } = MKBCore;

  const PARALLAX_FACTOR = 0.3;

  let heroImg, heroSection;

  const update = rafThrottle(() => {
    if (!heroImg || !heroSection) return;

    const scrollY  = window.scrollY;
    const heroH    = heroSection.offsetHeight;

    if (scrollY > heroH * 1.2) return;

    const offset = scrollY * PARALLAX_FACTOR;
    heroImg.style.transform = `translateY(${offset}px)`;
  });

  const init = () => {
    if (prefersReducedMotion()) return;

    heroSection = $('#hero');
    if (!heroSection) return;

    heroImg = heroSection.querySelector('.hero-bg__img');
    if (!heroImg) return;

    heroImg.style.willChange = 'transform';
    window.addEventListener('scroll', update, { passive: true });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   12. CHEMICAL TABLE HIGHLIGHT
   On product page — highlights hovered row's category group
═══════════════════════════════════════════════════════════ */
const ChemTableHighlight = (() => {
  const { $$, $ } = MKBCore;

  const init = () => {
    const table = $('.chem-table');
    if (!table) return;

    const rows = $$('tbody tr:not(.chem-table__category-row)', table);

    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(240,180,41,0.05)';
      });

      row.addEventListener('mouseleave', () => {
        row.style.background = '';
      });
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   13. STICKY SERVICE NAV ACTIVE STATE
   Adds background + border-bottom to active service nav link
   (Supplemental to ServiceNavSpy)
═══════════════════════════════════════════════════════════ */
const ServiceNavHighlight = (() => {
  const { $$, $ } = MKBCore;

  const init = () => {
    const navStrip = $('.service-nav-strip');
    if (!navStrip) return;

    const links = $$('.service-nav-link', navStrip);

    links.forEach(link => {
      link.addEventListener('click', () => {
        links.forEach(l => {
          l.style.color       = '';
          l.style.borderColor = '';
        });
        link.style.color       = 'var(--gold-300)';
        link.style.borderColor = 'var(--gold-300)';
      });
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   14. NAVBAR BACKGROUND PRELOADER
   Ensures navbar is visible when landing on a page mid-scroll
   (e.g., when using back button to return to a scrolled page)
═══════════════════════════════════════════════════════════ */
const NavbarPreload = (() => {
  const { $ } = MKBCore;

  const init = () => {
    const navbar = $('#mkb-navbar');
    if (!navbar) return;

    // If page is loaded already scrolled (back button, etc.)
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    }
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   15. METRIC CARD GLOW ON HOVER
   Gold glow pulse on metric cards when hovered
═══════════════════════════════════════════════════════════ */
const MetricGlow = (() => {
  const { $$ } = MKBCore;

  const init = () => {
    $$('.metric-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 0 48px rgba(240,180,41,0.12), 0 10px 40px rgba(0,0,0,0.5)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '';
      });
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   16. PRESENCE PIN ANIMATION STAGGER
   Delays the ping animation on each map pin
═══════════════════════════════════════════════════════════ */
const PresencePins = (() => {
  const { $$ } = MKBCore;

  const init = () => {
    $$('.presence-pin__dot').forEach((dot, i) => {
      dot.style.animationDelay = `${i * 0.6}s`;
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   17. MOBILE SCROLL INDICATOR
   Shows a left-right scroll indicator for horizontally
   scrollable elements (service nav) on mobile
═══════════════════════════════════════════════════════════ */
const ScrollIndicator = (() => {
  const { $, debounce } = MKBCore;

  const init = () => {
    const navList = $('.service-nav-list');
    if (!navList) return;

    const checkOverflow = debounce(() => {
      const hasOverflow = navList.scrollWidth > navList.clientWidth;
      const parent = navList.closest('.service-nav-strip');
      if (!parent) return;

      if (hasOverflow) {
        parent.classList.add('has-overflow');
        parent.style.position = 'relative';
      } else {
        parent.classList.remove('has-overflow');
      }
    }, 100);

    checkOverflow();
    window.addEventListener('resize', checkOverflow, { passive: true });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   18. HERO GRID ANIMATION
   Subtle animated pulse on the hero grid overlay
═══════════════════════════════════════════════════════════ */
const HeroGridPulse = (() => {
  const { $, prefersReducedMotion } = MKBCore;

  const init = () => {
    if (prefersReducedMotion()) return;

    const grid = $('.hero-bg__grid');
    if (!grid) return;

    let frame = 0;
    const tick = () => {
      frame += 0.008;
      const opacity = 0.3 + 0.2 * Math.sin(frame);
      grid.style.opacity = opacity.toString();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   19. CASE STUDY EXPAND (PRODUCT PAGE)
   Allow expanding challenge/solution text on mobile
   (they are truncated via CSS max-height)
═══════════════════════════════════════════════════════════ */
const CaseExpand = (() => {
  const { $$ } = MKBCore;

  const MOBILE_BREAKPOINT = 768;

  const init = () => {
    if (window.innerWidth > MOBILE_BREAKPOINT) return;

    $$('.case-card__challenge, .case-card__solution').forEach(block => {
      const fullText = block.textContent.trim();
      if (fullText.length < 180) return;

      // Truncate
      const preview    = fullText.slice(0, 160) + '…';
      const strong     = block.querySelector('strong');
      const strongHTML = strong ? strong.outerHTML : '';

      block.innerHTML = strongHTML + `<span class="case-preview">${preview}</span>`;

      const toggle = document.createElement('button');
      toggle.textContent = 'Read more';
      toggle.style.cssText = `
        display: block;
        margin-top: 6px;
        background: none;
        border: none;
        color: var(--gold-300);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        padding: 0;
      `;

      let expanded = false;

      toggle.addEventListener('click', () => {
        expanded = !expanded;
        const preview = block.querySelector('.case-preview');
        if (preview) {
          preview.textContent = expanded ? fullText : fullText.slice(0, 160) + '…';
        }
        toggle.textContent = expanded ? 'Read less' : 'Read more';
      });

      block.appendChild(toggle);
    });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   20. BACK TO TOP
   Appears after 400px scroll, smooth scrolls to top
═══════════════════════════════════════════════════════════ */
const BackToTop = (() => {
  const { rafThrottle } = MKBCore;

  let btn;
  const SHOW_AT = 400;

  const onScroll = rafThrottle(() => {
    if (!btn) return;
    const show = window.scrollY > SHOW_AT;
    btn.style.opacity   = show ? '1' : '0';
    btn.style.transform = show ? 'translateY(0)' : 'translateY(12px)';
    btn.style.pointerEvents = show ? 'auto' : 'none';
  });

  const init = () => {
    btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 14V4M4 9l5-5 5 5" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    btn.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 500;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--gold-300);
      color: var(--navy-900);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition: opacity 250ms ease, transform 250ms ease, background 150ms ease, box-shadow 150ms ease;
      box-shadow: 0 4px 16px rgba(240,180,41,0.3);
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background  = '#F6C94E';
      btn.style.boxShadow   = '0 6px 24px rgba(240,180,41,0.45)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background  = 'var(--gold-300)';
      btn.style.boxShadow   = '0 4px 16px rgba(240,180,41,0.3)';
    });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.body.appendChild(btn);
    window.addEventListener('scroll', onScroll, { passive: true });
  };

  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   INIT — Bootstrap all modules in correct order
═══════════════════════════════════════════════════════════ */
const MKBInit = () => {
  // Core UX — run immediately
  NavbarPreload.init();
  FooterYear.init();

  // Run on DOMContentLoaded
  const onDOMReady = () => {
    PageTransition.init();
    NavbarController.init();
    RevealEngine.init();
    CounterEngine.init();
    ScrollProgress.init();
    ServiceNavSpy.init();
    SmoothAnchor.init();
    HeroParallax.init();
    CardTilt.init();
    ChemTableHighlight.init();
    ServiceNavHighlight.init();
    MetricGlow.init();
    PresencePins.init();
    ScrollIndicator.init();
    HeroGridPulse.init();
    CaseExpand.init();
    BackToTop.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }
};

// Execute
MKBInit();