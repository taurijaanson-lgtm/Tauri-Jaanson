import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Campaign, Pledge, User } from './types.js';

export interface Snapshot {
  users: User[];
  campaigns: Campaign[];
  pledges: Pledge[];
  sessions: [token: string, userId: string][];
}

/**
 * In-memory store with optional JSON-file persistence. The service only touches these maps,
 * so swapping in Postgres later means replacing this class, not the business logic.
 */
export class Store {
  readonly users = new Map<string, User>();
  readonly campaigns = new Map<string, Campaign>();
  readonly pledges = new Map<string, Pledge>();
  readonly sessions = new Map<string, string>();

  constructor(private readonly file?: string) {
    if (file) this.load(file);
  }

  private load(file: string): void {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      return;
    }
    const snap = JSON.parse(raw) as Snapshot;
    snap.users.forEach((u) => this.users.set(u.id, u));
    snap.campaigns.forEach((c) => this.campaigns.set(c.id, c));
    snap.pledges.forEach((p) => this.pledges.set(p.id, p));
    snap.sessions.forEach(([t, u]) => this.sessions.set(t, u));
  }

  /** Writes atomically so a crash mid-write cannot corrupt the data file. */
  save(): void {
    if (!this.file) return;
    const snap: Snapshot = {
      users: [...this.users.values()],
      campaigns: [...this.campaigns.values()],
      pledges: [...this.pledges.values()],
      sessions: [...this.sessions.entries()],
    };
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(snap, null, 2));
    renameSync(tmp, this.file);
  }

  userByEmail(email: string): User | undefined {
    const needle = email.trim().toLowerCase();
    for (const u of this.users.values()) if (u.email === needle) return u;
    return undefined;
  }

  campaignBySlug(slug: string): Campaign | undefined {
    for (const c of this.campaigns.values()) if (c.slug === slug) return c;
    return undefined;
  }

  pledgesFor(campaignId: string): Pledge[] {
    return [...this.pledges.values()].filter((p) => p.campaignId === campaignId);
  }
}
