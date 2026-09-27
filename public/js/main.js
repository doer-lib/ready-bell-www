(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");

  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      var isOpen = header.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
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

    navigator.clipboard.writeText(code.textContent).then(function () {
      button.textContent = "Copied!";
      setTimeout(function () {
        button.textContent = "Copy";
      }, 1500);
    });
  });

  if (window.hljs) {
    window.hljs.highlightAll();
  }
})();
