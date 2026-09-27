(function () {
  "use strict";

  // Browser stand-in for "nc -u ready-bell.com 3137": each websocket gets its own UDP socket.
  // Messages are JSON: send {"type":"send","data":...}, receive {"type":"recv"|"error","data":...}.
  var WS_URL = "wss://home.bin932.com:3160/udp-ws";
  var LISTEN_SECONDS = 60;
  // UDP packets sent back to back sometimes get dropped, so space them out.
  var SEND_GAP_MS = 100;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var uuidInput = document.getElementById("try-uuid");
  if (!uuidInput) return;

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

  function uuids() {
    return uuidInput.value.split(/\s+/).filter(Boolean);
  }

  function listenCmd(uuid) {
    return "Listen " + uuid + " " + LISTEN_SECONDS;
  }

  function notifyCmd(uuid) {
    return "Notify " + uuid;
  }

  // --- browser terminals ---

  function Terminal(el) {
    this.el = el;
    this.log = el.querySelector(".term-log");
    this.status = el.querySelector(".term-status");
    this.connectBtn = el.querySelector('[data-action="connect"]');
    this.ws = null;
    this.queue = [];
    this.timer = null;

    var self = this;
    this.connectBtn.addEventListener("click", function () {
      if (self.ws) {
        self.disconnect();
      } else {
        self.connect();
      }
    });
    el.querySelector('[data-action="listen"]').addEventListener("click", function () {
      self.run(listenCmd);
    });
    el.querySelector('[data-action="notify"]').addEventListener("click", function () {
      self.run(notifyCmd);
    });
  }

  Terminal.prototype.setState = function (state, text) {
    this.el.setAttribute("data-state", state);
    this.status.textContent = text;
    this.connectBtn.setAttribute("aria-pressed", String(state === "connecting" || state === "connected"));
  };

  Terminal.prototype.print = function (text, cls) {
    var line = document.createElement("span");
    line.className = cls || "";
    line.textContent = text + "\n";
    this.log.appendChild(line);
    this.log.scrollTop = this.log.scrollHeight;
  };

  Terminal.prototype.connect = function () {
    var self = this;
    var ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      this.setState("error", "error");
      this.print("cant connect: " + e.message, "term-err");
      return;
    }
    this.ws = ws;
    this.setState("connecting", "connecting…");

    ws.onopen = function () {
      if (self.ws !== ws) return;
      self.setState("connected", "connected");
      self.print("connected", "term-meta");
      self.pump();
    };

    ws.onmessage = function (event) {
      if (self.ws !== ws) return;
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        self.print(String(event.data));
        return;
      }
      var data = String(msg.data == null ? "" : msg.data).replace(/\s+$/, "");
      if (msg.type === "error") {
        self.print("error: " + data, "term-err");
      } else {
        self.print(data, "term-in");
      }
    };

    ws.onclose = function (event) {
      if (self.ws !== ws) return;
      self.ws = null;
      self.clearQueue();
      var reason = "closed (" + event.code + (event.reason ? " " + event.reason : "") + ")";
      self.setState("error", "connection closed");
      self.print(reason, "term-err");
    };
  };

  Terminal.prototype.disconnect = function () {
    var ws = this.ws;
    this.ws = null;
    this.clearQueue();
    if (ws) {
      // Tell the server to close its UDP socket; the frame is sent before the close frame below.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "close" }));
      }
      ws.close(1000);
      this.print("disconnected", "term-meta");
    }
    this.setState("idle", "disconnected");
  };

  Terminal.prototype.clearQueue = function () {
    this.queue = [];
    clearTimeout(this.timer);
    this.timer = null;
  };

  // Sends queued commands one at a time, SEND_GAP_MS apart.
  Terminal.prototype.pump = function () {
    if (this.timer || !this.queue.length || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    var cmd = this.queue.shift();
    this.print("> " + cmd, "term-out");
    this.ws.send(JSON.stringify({ type: "send", data: cmd }));
    var self = this;
    this.timer = setTimeout(function () {
      self.timer = null;
      self.pump();
    }, SEND_GAP_MS);
  };

  Terminal.prototype.run = function (makeCmd) {
    var list = uuids();
    if (!list.length) {
      this.print("enter a uuid first", "term-err");
      return;
    }
    var bad = list.filter(function (u) {
      return !UUID_RE.test(u);
    });
    if (bad.length) {
      this.print("not a uuid: " + bad.join(" "), "term-err");
      return;
    }

    this.queue = this.queue.concat(list.map(makeCmd));
    if (this.ws) {
      this.pump();
    } else {
      this.connect();
    }
  };

  var terminals = Array.prototype.map.call(document.querySelectorAll("[data-term]"), function (el) {
    return new Terminal(el);
  });

  window.addEventListener("pagehide", function () {
    terminals.forEach(function (t) {
      t.disconnect();
    });
  });

  // --- copyable commands for a real terminal ---

  var ncListen = document.getElementById("try-nc-listen");
  var ncNotify = document.getElementById("try-nc-notify");

  function codeBlock(label, text) {
    var block = document.createElement("div");
    block.className = "code-block code-block-line";
    var labelEl = document.createElement("span");
    labelEl.className = "file-label";
    labelEl.textContent = label;
    var btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    var pre = document.createElement("pre");
    var code = document.createElement("code");
    code.textContent = text;
    pre.appendChild(code);
    block.appendChild(labelEl);
    block.appendChild(btn);
    block.appendChild(pre);
    return block;
  }

  function renderNc() {
    var list = uuids();
    if (!list.length) list = ["<uuid>"];
    ncListen.replaceChildren.apply(ncListen, list.map(function (u) {
      return codeBlock("terminal 1", listenCmd(u));
    }));
    ncNotify.replaceChildren.apply(ncNotify, list.map(function (u) {
      return codeBlock("terminal 2", notifyCmd(u));
    }));
  }

  uuidInput.addEventListener("input", renderNc);
  document.getElementById("try-uuid-gen").addEventListener("click", function () {
    uuidInput.value = newUuid();
    renderNc();
  });

  uuidInput.value = newUuid();
  renderNc();
})();
