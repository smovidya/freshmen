import { env } from '$env/dynamic/public';
import { authClient } from './auth/client';
import { dev } from "$app/environment";
import { untrack } from "svelte";
import { toast } from 'svelte-sonner';

export const gameApiPrefix = `${env.PUBLIC_BETTER_AUTH_URL || "http:;//localhost:3000"}/game`;

export type LeaderboardEntry = {
  playerId: string;
  score: number;
  player_name?: string;
};

export class GameAPIClient {
  #token: string | null = $state(null);
  playerDisplayName = $state<string | null>(null);

  constructor(init = true) {
    if (init) {
      this.refreshToken();
    }
  }

  async fetchApi(endpoint: string, options: RequestInit = {}, { retryCount = 0 } = {}): Promise<Response> {
    if (!this.#token) {
      await this.refreshToken();
    }
    if (!this.#token) {
      toast.error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
      throw new Error("Not authenticated");
    }
    const res = await fetch(`${gameApiPrefix}${endpoint}`, {
      ...options,
      // cache: "reload",
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.#token}`,
      },
    });

    if (res.status === 401) {
      if (retryCount < 1) {
        await this.refreshToken();
        return this.fetchApi(endpoint, options, { retryCount: retryCount + 1 });
      }
      toast.error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
      throw new Error("Not authenticated");
    }

    if (!res.ok) {
      toast.error(`เกิดข้อผิดพลาด: ${res.statusText}`);
      throw new Error(`API error: ${res.statusText}`);
    }

    return res;
  }

  async refreshToken() {
    const { data, error } = await authClient.getSession();
    if (error || !data?.session) {
      return null;
    }

    const res = await fetch(`${env.PUBLIC_BETTER_AUTH_URL}/api/auth/token`, {
      credentials: "include"
    });

    this.#token = ((await res.json()) as { token: string }).token;
  }

  ready = $derived(!!this.#token);

  async updateName(newName: string) {
    try {
      await this.fetchApi('/username', {
        method: "POST",
        body: newName,
      });
      this.playerDisplayName = newName;
      toast.success("อัพเดตชื่อผู้ใช้เรียบร้อยแล้ว");
      this.playerDisplayName = newName;
    } catch (e) {
      toast.error("ไม่สามารถอัพเดตชื่อผู้ใช้ได้");
      console.error(e);
    }
  }

  async getName() {
    try {
      return await this.fetchApi('/username')
        .catch(() => {
          throw new Error("Failed to fetch username");
        })
        .then(it => it.text());
    } catch {
      toast.error("ไม่สามารถดึงชื่อผู้ใช้ได้");
    }
  }

  async submitPop(count = 1) {
    if (!this.ready || count === 0) {
      return;
    }

    await this.fetchApi(`/pop?pop=${count}`, {
      method: "POST"
    });
  }

  async getLeaderboard() {
    const res = await this.fetchApi('/stats');

    return (await res.json()) as {
      leaderboard: LeaderboardEntry[],
      totalScore: number;
      groupNumber: string,
    }[];
  }

  async getSelfPopCount() {
    const res = await this.fetchApi('/stats/self');
    return (await res.json()) as number;
  }
}

export class GamePopper {
  // groupPollIntervalId!: NodeJS.Timeout; // wtf, idc anymore
  flushIntervalId!: NodeJS.Timeout;
  selfPollIntervalId!: NodeJS.Timeout; // wtf, idc anymore
  batchedCount: number = $state(0);
  #serverCount = $state(0);
  displaySelfCount = $derived(this.batchedCount + this.#serverCount);
  displayName = $state<string | undefined>(undefined);

  // TODO: optimistic update, nahhhh
  // #clickSpeedPerGroups = $state(zeroGroupCounts());
  #client: GameAPIClient;
  // groupId: string;

  #ready = $state(false);

  constructor(client: GameAPIClient) {
    // this.groupId = groupId;
    this.#client = client;
    // console.log(localStorage.getItem("__pop_count"));
    this.#serverCount = parseInt(localStorage.getItem("__pop_count") ?? "0") || 0;
  }

  async init() {
    this.#serverCount = await this.#client.getSelfPopCount();
    localStorage.setItem("__pop_count", String(untrack(() => this.#serverCount)));
    this.displayName = await this.#client.getName();
    // let abortController: AbortController | null = null;
    // const pollGroupCount = () => {
    //   abortController?.abort();
    //   abortController = new AbortController();
    //   this.#client.getInGroupLeaderboard(this.groupId).then((counts) => {
    //     this.#realGroupCount = {
    //       ...this.#realGroupCount,
    //       ...counts
    //     };
    //   }).catch(() => { });
    // };

    // pollGroupCount();
    // this.groupPollIntervalId = setInterval(pollGroupCount, dev ? 500 : 1000 * 30);

    const pollSelfCount = () => {
      this.#client.getSelfPopCount().then((count) => {
        if (count > this.#serverCount) { // update from another device
          this.#serverCount = count;
        }
        this.#ready = true;
      }).catch(() => { });
    };

    pollSelfCount();
    this.selfPollIntervalId = setInterval(pollSelfCount, dev ? 1000 : 1000 * 5);

    this.flushIntervalId = setInterval(() => {
      this.#flush();
    }, dev ? 1000 : 1000 * 5);
  }

  private stop() {
    clearInterval(this.selfPollIntervalId);
    clearInterval(this.flushIntervalId);
  }

  pop() {
    this.batchedCount += 1;
    localStorage.setItem("__pop_count", String(untrack(() => this.displaySelfCount)));
  }

  async #flush() {
    const batched = untrack(() => this.batchedCount);
    // console.log(`Flushing ${batched} pop`);
    this.#serverCount = untrack(() => this.displaySelfCount);
    this.batchedCount = 0;
    try {
      await this.#client.submitPop(batched);
    } catch (e) {
      toast.error("ไม่สามารถส่งข้อมูลได้");
      console.log(e);
    }
  }

  destroy() {
    this.#flush();
    this.stop();
  }
}
