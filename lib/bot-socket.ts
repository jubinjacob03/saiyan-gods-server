type PlayPayload = {
  soundId: string;
  soundUrl: string;
  soundName: string;
  guildId: string;
  channelId: string;
  channelName?: string;
  userId: string;
  username: string;
};

type PendingResolve = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export class BotSocket {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private pendingAuth: PendingResolve | null = null;
  private pendingCalls = new Map<string, PendingResolve>();
  private msgCounter = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private destroyed = false;
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  /** Subscribe to a server-push event type (e.g. "verification_update"). */
  on(event: string, cb: (data: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  /** Unsubscribe from a server-push event. */
  off(event: string, cb: (data: unknown) => void) {
    this.listeners.get(event)?.delete(cb);
  }

  /** Establish WS connection + complete auth handshake. */
  async connect(): Promise<void> {
    const { token, wsUrl } = await this._fetchToken();

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ type: "auth", token }));
        this.pendingAuth = { resolve: resolve as (v: unknown) => void, reject };
      };

      this.ws.onmessage = (event) => this._handleMessage(event.data);

      this.ws.onerror = () => {
        if (this.pendingAuth) {
          this.pendingAuth.reject(new Error("WebSocket connection failed"));
          this.pendingAuth = null;
        }
      };

      this.ws.onclose = () => {
        this.authenticated = false;
        if (!this.destroyed) this._scheduleReconnect();
      };
    });
  }

  /** Send a play command. Resolves with the bot's play_result data. */
  async play(payload: PlayPayload): Promise<unknown> {
    if (!this.authenticated || !this.ws) {
      throw new Error("WebSocket not connected");
    }

    const id = `play_${++this.msgCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ type: "play", id, ...payload }));
      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject(new Error("Play command timed out"));
        }
      }, 10_000);
    });
  }

  /** @returns true if the socket is open and authenticated */
  get ready(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  // --- Private ---

  private _handleMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "auth") {
      if (msg.ok) {
        this.authenticated = true;
        this.reconnectDelay = 1000;
        this.pendingAuth?.resolve(undefined);
      } else {
        this.pendingAuth?.reject(
          new Error((msg.error as string) ?? "Auth failed"),
        );
      }
      this.pendingAuth = null;
      return;
    }

    if (msg.type === "play_result") {
      const pending = this.pendingCalls.get(msg.id as string);
      if (!pending) return;
      this.pendingCalls.delete(msg.id as string);
      if (msg.ok) {
        pending.resolve(msg.data);
      } else {
        pending.reject(new Error((msg.error as string) ?? "Play failed"));
      }
      return;
    }

    // Dispatch server-push events to subscribers
    const cbs = this.listeners.get(msg.type as string);
    if (cbs) {
      for (const cb of cbs) cb(msg.data);
    }
  }

  private async _fetchToken(): Promise<{ token: string; wsUrl: string }> {
    const res = await fetch("/api/bot/ws-token");
    if (!res.ok) throw new Error("Failed to fetch WS token");
    const body = await res.json();
    return body.data;
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
        this._scheduleReconnect();
      }
    }, this.reconnectDelay);
  }
}
