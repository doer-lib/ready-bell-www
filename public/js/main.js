(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var tocToggle = document.querySelector(".toc-toggle");
  var tocMenu = document.getElementById("toc-menu");

  function setNavOpen(open) {
    if (navToggle && header) {
      header.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    }
  }

  function setTocOpen(open) {
    if (tocToggle && tocMenu) {
      tocMenu.hidden = !open;
      tocToggle.setAttribute("aria-expanded", String(open));
    }
  }

  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      setTocOpen(false);
      setNavOpen(!header.classList.contains("nav-open"));
    });

    document.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });
  }

  // The page title first, then one entry per section heading (the contact block is left out).
  var tocList = document.createElement("ul");

  document.querySelectorAll("main section[id]:not(#contact)").forEach(function (section) {
    var heading = section.querySelector("h1, h2");

    if (!heading) {
      return;
    }

    var item = document.createElement("li");
    var link = document.createElement("a");
    // The page title leads to the very top of the page, not to its own heading.
    link.href = heading.tagName === "H1" ? "#top" : "#" + section.id;
    link.className = "toc-" + heading.tagName.toLowerCase();
    link.textContent = heading.textContent.replace(/\s+/g, " ").trim();
    item.appendChild(link);
    tocList.appendChild(item);
  });

  if (tocToggle && tocMenu && tocList.children.length) {
    tocMenu.appendChild(tocList);
    tocToggle.hidden = false;

    tocToggle.addEventListener("click", function () {
      setNavOpen(false);
      setTocOpen(tocMenu.hidden);
    });

    tocMenu.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setTocOpen(false);
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".toc")) {
        setTocOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !tocMenu.hidden) {
        setTocOpen(false);
        tocToggle.focus();
      }
    });
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".tab-panel"));

  function selectTab(tab) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
    });

    panels.forEach(function (panel) {
      panel.hidden = panel.id !== tab.getAttribute("aria-controls");
    });
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      selectTab(tab);
    });

    tab.addEventListener("keydown", function (event) {
      var newIndex = null;

      if (event.key === "ArrowRight") {
        newIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        newIndex = (index - 1 + tabs.length) % tabs.length;
      }

      if (newIndex !== null) {
        event.preventDefault();
        tabs[newIndex].focus();
        selectTab(tabs[newIndex]);
      }
    });
  });

  // Delegated, so copy buttons added later (e.g. by try.js) work too.
  document.addEventListener("click", function (event) {
    var button = event.target.closest(".copy-btn");
    var block = button ? button.closest(".code-block") : null;
    var code = block ? block.querySelector("pre code") : null;

    if (!code) {
      return;
    }

    // data-copy overrides the shown text, e.g. to add \r\n line endings.
    var text = block.getAttribute("data-copy");
    navigator.clipboard.writeText(text == null ? code.textContent : text).then(function () {
      clearTimeout(button.copiedTimer);
      button.classList.add("copied");
      button.setAttribute("aria-label", "Copied");
      button.copiedTimer = setTimeout(function () {
        button.classList.remove("copied");
        button.setAttribute("aria-label", "Copy to clipboard");
      }, 1500);
    });
  });

  if (window.hljs) {
    window.hljs.highlightAll();
  }
})();
