(function () {
  "use strict";

  var API = "https://demo.ready-bell.com";
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SSE_LOG_MAX = 500;

  function $(id) {
    return document.getElementById(id);
  }

  // --- Helpers ---

  function newUuid() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) {
      return (x + 0x100).toString(16).slice(1);
    }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  // Fills a "paste into nc" block: the Listen line and the responses nc will print.
  function showListen(prefix, uuid) {
    uuid = uuid || "<uuid>";
    $(prefix + "-listen").textContent = "Listen " + uuid + " 120";
    $(prefix + "-response").textContent = "Registered " + uuid + " <ip> <port> 120\nReady " + uuid;
  }

  function httpKind(code) {
    if (code >= 200 && code < 300) return "ok";
    if (code >= 500) return "err";
    return "warn";
  }

  function jobKind(status) {
    if (status === "READY") return "ok";
    if (status === "FAILED") return "err";
    return "warn";
  }

  function setKind(el, kind) {
    if (kind) {
      el.setAttribute("data-kind", kind);
    } else {
      el.removeAttribute("data-kind");
    }
  }

  function setStatus(el, text, kind, title) {
    el.textContent = text;
    el.title = title || "";
    setKind(el, kind);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightJson(json) {
    return escapeHtml(json).replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (m) {
        var cls = m.charAt(0) === '"' ? (/:$/.test(m) ? "k" : "s") : /^[tfn]/.test(m) ? "l" : "n";
        return '<span class="' + cls + '">' + m + "</span>";
      }
    );
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return undefined;
    }
  }

  // Shows a response body: pretty-printed JSON when it parses, the raw text otherwise.
  function showBody(pre, text) {
    pre.hidden = false;
    var parsed = parseJson(text);
    if (parsed !== undefined) {
      pre.innerHTML = highlightJson(JSON.stringify(parsed, null, 2));
    } else {
      pre.textContent = text === "" ? "(empty body)" : text;
    }
    return parsed;
  }

  function statusOf(button) {
    return button.closest(".step").querySelector(".status");
  }

  // Runs the HTTP request of the button's step: disables the button while it is in flight,
  // puts the status code (or the error) in the step's status badge, shows the response body
  // (unless it is an empty success) and shows the step's summary on success.
  // Resolves to { res, job } on a 2xx response, null otherwise.
  function run(button, url, init) {
    var step = button.closest(".step");
    var statusEl = statusOf(button);
    var bodyEl = step.querySelector(".json");
    var summary = step.querySelector(".summary");
    bodyEl.hidden = true;
    if (summary) summary.hidden = true;
    if (!url) {
      setStatus(statusEl, "no url", "err", step.querySelector("input.url").placeholder);
      return Promise.resolve(null);
    }
    button.disabled = true;
    setStatus(statusEl, "…", null);
    return fetch(url, init)
      .then(function (res) {
        return res.text().then(function (text) {
          setStatus(statusEl, String(res.status), httpKind(res.status), res.statusText);
          var job = res.ok && text === "" ? undefined : showBody(bodyEl, text);
          if (!res.ok) return null;
          if (summary) summary.hidden = false;
          return { res: res, job: job };
        });
      })
      .catch(function (err) {
        setStatus(statusEl, "ERR", "err", String(err && err.message || err));
        return null;
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  function checkUuid(button, uuid) {
    if (UUID_RE.test(uuid)) return true;
    setStatus(statusOf(button), "bad uuid", "err", "Enter a uuid like 3fa85f64-5717-4562-b3fc-2c963f66afa6");
    return false;
  }

  // Location is only readable cross-origin when the backend exposes it via CORS;
  // fall back to the request URL, which is the same resource.
  function showLocation(prefix, res, url) {
    var location = res.headers.get("Location") || url;
    $(prefix + "-post-location").textContent = location;
    $(prefix + "-get-url").value = location;
  }

  // Trims the input, falls back when it is empty, and writes the result back.
  function urlFrom(input, fallback) {
    return (input.value = input.value.trim() || fallback);
  }

  // ======================= hello-async =======================

  var aUuid = $("a-uuid");

  function aUrl() {
    return API + "/hello-async/" + aUuid.value.trim();
  }

  function aRefresh() {
    $("a-post-url").textContent = aUrl();
    showListen("a", aUuid.value.trim());
  }

  function showJob(prefix, job) {
    var status = job && job.status;
    setStatus($(prefix + "-job-status"), status || "—", status && jobKind(status));
    $(prefix + "-greeting").textContent = (job && job.output && job.output.greeting) || "— (not ready yet)";
  }

  aUuid.addEventListener("input", aRefresh);
  $("a-uuid-gen").addEventListener("click", function () {
    aUuid.value = newUuid();
    aRefresh();
  });

  $("a-post").addEventListener("click", function () {
    if (!checkUuid(this, aUuid.value.trim())) return;
    var url = aUrl();
    var body = {
      input: {
        name: $("a-name").value,
        "dbg-delay-sec": Number($("a-delay").value)
      }
    };
    run(this, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (result) {
      if (!result) return;
      showLocation("a", result.res, url);
      showJob("a-post", result.job);
    });
  });

  $("a-get").addEventListener("click", function () {
    run(this, urlFrom($("a-get-url"), aUrl()), { cache: "no-store" }).then(function (result) {
      if (result) showJob("a-get", result.job);
    });
  });

  // ======================= hello-cloud =======================

  var cUuid = $("c-uuid");

  function cUrl() {
    return API + "/hello-cloud/" + cUuid.value.trim();
  }

  function cRefresh() {
    var url = cUrl();
    $("c-post-url").textContent = url;
    $("c-sse-url").textContent = url + "/sse";
    showListen("c", cUuid.value.trim());
    if (sse.source && sse.source.url !== url + "/sse") {
      sseDisconnect("uuid changed");
    }
  }

  function fillUrlsFromJob(job) {
    if (!job) return;
    if (job.inputPutUrl) $("c-put-url").value = job.inputPutUrl;
    if (job.outputGetUrl) $("c-out-url").value = job.outputGetUrl;
  }

  cUuid.addEventListener("input", cRefresh);
  $("c-uuid-gen").addEventListener("click", function () {
    cUuid.value = newUuid();
    cRefresh();
  });

  $("c-post").addEventListener("click", function () {
    if (!checkUuid(this, cUuid.value.trim())) return;
    var url = cUrl();
    run(this, url, { method: "POST" }).then(function (result) {
      if (!result) return;
      showLocation("c", result.res, url);
      fillUrlsFromJob(result.job);
      // Connect now, or reconnect right away if an early connect is waiting to retry.
      if (!sseIsOpen(url + "/sse")) {
        sseConnect();
      }
    });
  });

  $("c-put").addEventListener("click", function () {
    run(this, $("c-put-url").value.trim(), { method: "PUT", body: $("c-name").value });
  });

  $("c-get").addEventListener("click", function () {
    run(this, urlFrom($("c-get-url"), cUrl()), { cache: "no-store" }).then(function (result) {
      if (result) fillUrlsFromJob(result.job);
    });
  });

  $("c-out").addEventListener("click", function () {
    run(this, $("c-out-url").value.trim(), { cache: "no-store" });
  });

  // ======================= Server-Sent Events =======================

  // Event names sent by GET /hello-cloud/{uuid}/sse ("error" is handled in onerror).
  var SSE_EVENTS = ["status", "check_s3", "ready", "timeout", "ping", "end"];
  var sse = { source: null, lastError: null };
  var sseLog = $("c-sse-log");

  function sseIsOpen(url) {
    return sse.source !== null && sse.source.url === url && sse.source.readyState === EventSource.OPEN;
  }

  function sseState(kind, label, detail) {
    setKind($("c-sse-dot"), kind);
    $("c-sse-state").textContent = label;
    setStatus($("c-sse-detail"), detail || "", kind === "err" ? "err" : null);
    $("c-sse-connect").disabled = sse.source !== null;
    $("c-sse-disconnect").disabled = sse.source === null;
  }

  // Appends a line to the event log; an empty event name marks a client-side (meta) line.
  function logLine(event, data) {
    var empty = sseLog.querySelector(".sse-empty");
    if (empty) empty.remove();
    var li = document.createElement("li");
    li.className = event ? "ev-" + event.replace(/[^a-z0-9_-]/gi, "") : "meta";
    var now = new Date();
    var t = now.toTimeString().slice(0, 8) + "." + String(now.getMilliseconds()).padStart(3, "0");
    [["t", t], ["e", event || "·"], ["d", data]].forEach(function (part) {
      var span = document.createElement("span");
      span.className = part[0];
      span.textContent = part[1];
      li.appendChild(span);
    });
    var atBottom = sseLog.scrollHeight - sseLog.scrollTop - sseLog.clientHeight < 8;
    sseLog.appendChild(li);
    while (sseLog.childElementCount > SSE_LOG_MAX) sseLog.firstElementChild.remove();
    if (atBottom) sseLog.scrollTop = sseLog.scrollHeight;
  }

  function closeSource() {
    if (sse.source) sse.source.close();
    sse.source = null;
  }

  function sseConnect() {
    closeSource();
    var source = new EventSource(cUrl() + "/sse");
    sse.source = source;
    sse.lastError = null;
    sseState(null, "connecting…", "");

    source.onopen = function () {
      sse.lastError = null;
      logLine("", "connected");
      sseState("ok", "connected", "");
    };

    // Fires both for the backend's own "error" event (a MessageEvent with data, e.g.
    // "unknown uuid", after which it closes the stream) and for connection failures.
    // After a failure EventSource reconnects by itself unless it gave up (CLOSED).
    source.onerror = function (e) {
      if (source !== sse.source) return;
      if (e instanceof MessageEvent) {
        sse.lastError = e.data;
        logLine("error", e.data);
        sseState("err", "error", e.data);
      } else if (source.readyState === EventSource.CLOSED) {
        var reason = sse.lastError || "connection failed";
        sseDisconnect();
        sseState("err", "error · not reconnecting", reason);
      } else {
        logLine("", "connection closed · reconnecting");
        sseState("err", "error · reconnecting", sse.lastError || "connection lost");
      }
    };

    source.onmessage = function (e) {
      logLine("message", e.data);
    };

    SSE_EVENTS.forEach(function (name) {
      source.addEventListener(name, function (e) {
        logLine(name, e.data);
        // The backend closes the stream after "end"; close too, so EventSource won't reconnect.
        if (name === "end") sseDisconnect("end of stream");
      });
    });
  }

  function sseDisconnect(reason) {
    if (!sse.source) return;
    closeSource();
    logLine("", "disconnected" + (reason ? " (" + reason + ")" : ""));
    sseState(null, "disconnected", reason || "");
  }

  $("c-sse-connect").addEventListener("click", sseConnect);
  $("c-sse-disconnect").addEventListener("click", function () {
    sseDisconnect();
  });
  $("c-sse-clear").addEventListener("click", function () {
    sseLog.innerHTML = '<li class="sse-empty">No events yet.</li>';
  });

  // --- Init ---

  aUuid.value = newUuid();
  cUuid.value = newUuid();
  aRefresh();
  cRefresh();
})();
