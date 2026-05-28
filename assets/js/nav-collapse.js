/*
 * Smooth expand/collapse + persistent open state for the LEFT sidebar nav.
 *
 * Just the Docs toggles `.active` on a `.nav-list-item` to reveal its child
 * `.nav-list` via `display:none/block` (instant, no animation), and resets that
 * state on every page load (this is a static site, so each click is a full reload).
 *
 * This script:
 *  - animates the expand/collapse (max-height transition, same easing as the TOC),
 *  - lets clicking a parent's text toggle it in place instead of navigating,
 *  - remembers which sections are open in sessionStorage and restores them after a
 *    navigation, so opening one menu no longer closes the others you left open.
 *
 * With JS disabled the CSS fallback still shows active sections open instantly.
 */
(function () {
  'use strict';

  var DURATION = 450; // keep in sync with the CSS transition in custom.scss
  var STORE_KEY = 'jtd-nav-open';

  /* in-memory truth for which sections are open, mirrored to sessionStorage */
  var openMap = {};

  function readOpen() {
    var map = {};
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      for (var i = 0; i < arr.length; i++) {
        map[arr[i]] = true;
      }
    } catch (e) { /* storage unavailable */ }
    return map;
  }

  function writeOpen() {
    try {
      var arr = [];
      for (var k in openMap) {
        if (openMap[k]) { arr.push(k); }
      }
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) { /* storage unavailable */ }
  }

  /* the direct child <ul class="nav-list"> of a nav item, if any */
  function childNavList(li) {
    for (var c = li.firstElementChild; c; c = c.nextElementSibling) {
      if (c.classList && c.classList.contains('nav-list')) {
        return c;
      }
    }
    return null;
  }

  /* a stable key for a section across page loads: its link text (present even when
     the theme strips the href from the current page's link) */
  function navKey(li) {
    for (var c = li.firstElementChild; c; c = c.nextElementSibling) {
      if (c.classList && c.classList.contains('nav-list-link')) {
        return (c.textContent || '').replace(/^\s+|\s+$/g, '');
      }
    }
    return null;
  }

  function expand(el) {
    if (el.style.maxHeight === 'none') {
      return; // already open
    }
    window.clearTimeout(el._navTimer);
    el.style.maxHeight = el.scrollHeight + 'px';
    /* after the transition, drop the cap so nested expansions grow freely */
    el._navTimer = window.setTimeout(function () {
      el.style.maxHeight = 'none';
    }, DURATION + 60);
  }

  function collapse(el) {
    window.clearTimeout(el._navTimer);
    /* give the transition a concrete starting height if it is currently uncapped */
    if (el.style.maxHeight === 'none' || el.style.maxHeight === '') {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.offsetHeight; // force reflow so the next change animates
    }
    el.style.maxHeight = '0px';
  }

  function init() {
    var root = document.getElementById('site-nav');
    if (!root) {
      return;
    }

    openMap = readOpen();

    /* Initial state (no animation): a section starts open if it is the current
       page's branch (theme marked it active) OR it was left open before navigating.
       Restored sections also get `.active` so the arrow rotates correctly. */
    var items = root.querySelectorAll('.nav-list-item');
    var i, it, sub, key;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      sub = childNavList(it);
      if (!sub) {
        continue;
      }
      key = navKey(it);
      if (it.classList.contains('active') || (key && openMap[key])) {
        if (!it.classList.contains('active')) {
          it.classList.add('active');
          var exp = it.querySelector('.nav-list-expander');
          if (exp) { exp.setAttribute('aria-pressed', 'true'); }
        }
        sub.style.maxHeight = 'none';
        if (key) { openMap[key] = true; } // keep the current branch sticky too
      } else {
        sub.style.maxHeight = '0px';
        if (key) { delete openMap[key]; }
      }
    }
    writeOpen();

    /* clicking a parent item's text toggles it open/closed in place (like the
       expander arrow) instead of navigating to that section's page. Leaf items
       (no children) keep their normal link behaviour. */
    root.addEventListener('click', function (e) {
      var node = e.target;
      while (node && node !== root) {
        if (node.classList && node.classList.contains('nav-list-expander')) {
          return; // the theme already handles the arrow
        }
        if (node.classList && node.classList.contains('nav-list-link')) {
          break;
        }
        node = node.parentNode;
      }
      if (!node || !node.classList || !node.classList.contains('nav-list-link')) {
        return;
      }
      var li = node.parentNode;
      while (li && !(li.classList && li.classList.contains('nav-list-item'))) {
        li = li.parentNode;
      }
      if (!li || !childNavList(li)) {
        return; // leaf page: let the link navigate normally
      }
      e.preventDefault();
      var open = li.classList.toggle('active');
      var expander = li.querySelector('.nav-list-expander');
      if (expander) {
        expander.setAttribute('aria-pressed', open ? 'true' : 'false');
      }
    });

    /* animate + persist whenever `.active` is toggled on a nav item */
    if (!window.MutationObserver) {
      return;
    }
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var li = mutations[m].target;
        if (!li.classList || !li.classList.contains('nav-list-item')) {
          continue;
        }
        var sub2 = childNavList(li);
        if (!sub2) {
          continue;
        }
        var k = navKey(li);
        if (li.classList.contains('active')) {
          if (k) { openMap[k] = true; }
          writeOpen();
          expand(sub2);
        } else {
          if (k) { delete openMap[k]; }
          writeOpen();
          collapse(sub2);
        }
      }
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
