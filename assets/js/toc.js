/*
 * On-page table of contents (TOC) + ScrollSpy (accordion)
 * - Kept in an external file so compress_html collapsing the HTML to one line does not break it
 * - ES5 style, scroll-event based (avoids the top-band limitation of IntersectionObserver)
 * - Accordion: h3 sub-items are grouped under their h2 and collapsed by default.
 *   Only the section the reader is currently in stays expanded; moving to the next
 *   h2 collapses the previous section's h3s and expands the new one's.
 * - Forces the last heading active when the bottom of the document is reached
 */
(function () {
  'use strict';

  function trim(s) {
    return (s || '').replace(/^\s+|\s+$/g, '');
  }

  function init() {
    var content = document.querySelector('.main-content');
    var aside = document.getElementById('toc-sidebar');
    var list = document.getElementById('toc-list');
    if (!content || !aside || !list) {
      return;
    }

    /* collect only h2/h3 (exclude h1) */
    var nodes = content.querySelectorAll('h2, h3');
    var headings = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (trim(nodes[i].textContent).length > 0) {
        headings.push(nodes[i]);
      }
    }

    /* do not show the TOC on pages without headings */
    if (headings.length === 0) {
      return;
    }

    function makeLink(h) {
      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + h.id;
      a.textContent = trim(h.textContent);
      a.setAttribute('data-toc-target', h.id);
      return a;
    }

    var linkById = {};
    /* maps every heading id to the top-level section (h2) it belongs to */
    var sectionByHeadingId = {};
    var currentSection = null;

    for (i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (!h.id) {
        h.id = 'toc-heading-' + i;
      }
      var isH2 = h.tagName.toLowerCase() === 'h2';
      var a = makeLink(h);
      linkById[h.id] = a;

      if (isH2) {
        /* top-level item: link + an (initially collapsed) sub-list for its h3s */
        var li = document.createElement('li');
        li.className = 'toc-item toc-h2';
        li.appendChild(a);
        var subUl = document.createElement('ul');
        subUl.className = 'toc-sub';
        li.appendChild(subUl);
        list.appendChild(li);

        currentSection = { li: li, subUl: subUl };
        sectionByHeadingId[h.id] = currentSection;
      } else {
        /* h3: nest under the current h2 section (or top-level if none yet) */
        var li3 = document.createElement('li');
        li3.className = 'toc-item toc-h3';
        li3.appendChild(a);
        if (currentSection) {
          currentSection.subUl.appendChild(li3);
          sectionByHeadingId[h.id] = currentSection;
        } else {
          list.appendChild(li3);
          sectionByHeadingId[h.id] = null;
        }
      }
    }

    aside.classList.add('is-ready');

    var activeId = null;
    function setActive(id) {
      if (id === activeId) {
        return;
      }
      if (activeId && linkById[activeId]) {
        linkById[activeId].classList.remove('active');
      }
      if (linkById[id]) {
        linkById[id].classList.add('active');
        activeId = id;
      }
    }

    /* expand exactly one section's sub-list, collapse the rest */
    var expandedSection = null;
    function setExpanded(section) {
      if (section === expandedSection) {
        return;
      }
      if (expandedSection) {
        expandedSection.li.classList.remove('is-expanded');
        expandedSection.subUl.style.maxHeight = '0px';
      }
      if (section) {
        section.li.classList.add('is-expanded');
        /* animate to the exact content height so there is no max-height dead time */
        section.subUl.style.maxHeight = section.subUl.scrollHeight + 'px';
      }
      expandedSection = section;
    }

    /* a heading is considered "passed" once it is within this many px of the top */
    var OFFSET = 120;

    function updateActive() {
      var docEl = document.documentElement;
      var scrollY = window.pageYOffset || docEl.scrollTop || 0;
      var current;

      /* when the bottom of the document is reached, force the last heading active */
      if (window.innerHeight + scrollY >= docEl.scrollHeight - 5) {
        current = headings[headings.length - 1].id;
      } else {
        /* otherwise activate the last heading that scrolled above the OFFSET line */
        current = headings[0].id;
        for (var k = 0; k < headings.length; k++) {
          if (headings[k].getBoundingClientRect().top <= OFFSET) {
            current = headings[k].id;
          } else {
            break;
          }
        }
      }

      setActive(current);
      setExpanded(sectionByHeadingId[current] || null);
    }

    /* throttle scroll/resize with requestAnimationFrame */
    var ticking = false;
    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;
      var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      raf(function () {
        updateActive();
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll);
    window.addEventListener('resize', function () {
      /* keep the open section sized to its (possibly rewrapped) content */
      if (expandedSection) {
        expandedSection.subUl.style.maxHeight = expandedSection.subUl.scrollHeight + 'px';
      }
      onScroll();
    });
    updateActive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
