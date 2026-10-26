import dgram from "dgram";

const BACKLOG_TTL_MS = 60000;

export class ReadyBell {
  waiters = new Map();
  backlog = new Map();
  socket = dgram.createSocket("udp4");

  constructor() {
    this.socket.on("message", msg => this.onMessage(msg.toString().trim()));
    this.socket.unref();
  }

  sendListen(uuid, seconds) {
    this.evictStale();
    this.socket.send(`Listen ${uuid} ${seconds}`, 3137, "ready-bell.com");
  }

  sendNotify(uuid) {
    this.socket.send(`Notify ${uuid}`, 3137, "ready-bell.com");
  }

  wait(uuid, ms) {
    if (this.backlog.delete(uuid)) return Promise.resolve();
    this.sendListen(uuid, 2 * ms / 1000);
    return new Promise(resolve => {
      const wakeUp = () => {
        clearTimeout(timer);
        this.waiters.delete(uuid);
        resolve();
      };
      const timer = setTimeout(wakeUp, ms);
      this.waiters.set(uuid, wakeUp);
    });
  }

  onMessage(text) {
    console.log(text);
    const [command, uuid] = text.split(" ");
    if (command !== "Ready") return;
    this.evictStale();
    const wakeUp = this.waiters.get(uuid);
    if (wakeUp) wakeUp();
    else this.backlog.set(uuid, Date.now() + BACKLOG_TTL_MS);
  }

  evictStale() {
    for (const [uuid, expires] of this.backlog) {
      if (expires < Date.now()) this.backlog.delete(uuid);
    }
  }
}
