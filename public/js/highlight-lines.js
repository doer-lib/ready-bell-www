(function () {
  "use strict";

  // Highlights code[data-highlight-lines="3,9,18"] one line at a time, so each line can be
  // wrapped in its own span and marked. Runs before main.js, whose highlightAll() then skips
  // these elements because they are already highlighted.
  if (!window.hljs) {
    return;
  }

  document.querySelectorAll("code[data-highlight-lines]").forEach(function (code) {
    var marked = code.getAttribute("data-highlight-lines").split(",").map(Number);
    var language = (code.className.match(/language-(\S+)/) || [])[1] || "plaintext";

    code.innerHTML = code.textContent.split("\n").map(function (line, index) {
      var html = window.hljs.highlight(line, { language: language, ignoreIllegals: true }).value;
      var cls = marked.indexOf(index + 1) === -1 ? "code-line" : "code-line code-line-marked";
      return '<span class="' + cls + '">' + html + "</span>";
    }).join("\n");
    code.classList.add("hljs");
    code.dataset.highlighted = "yes";
  });
})();
