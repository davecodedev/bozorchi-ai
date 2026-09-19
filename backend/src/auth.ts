/**
 * Who is calling? Three sources, in order:
 *   1. `Authorization: tma <initData>` from the Mini App (validated with BOT_TOKEN when set)
 *   2. `x-telegram-user-id` from our own bot
 *   3. `x-buyer-id` from a browser dev session ("guest-…")
 * Falls back to an anonymous buyer so curl still works.
 */
import { createHmac } from "node:crypto";
import type { Request } from "express";
import { prisma } from "./db.js";

export interface Identity {
  telegramUserId: string;
  name?: string;
  username?: string;
}

const BOT_TOKEN = process.env.BOT_TOKEN && !process.env.BOT_TOKEN.includes("FAKE") ? process.env.BOT_TOKEN : undefined;

export function verifyInitData(initData: string): URLSearchParams | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  if (!BOT_TOKEN) return params; // dev mode: no token on the backend → trust
  const pairs = [...params.entries()].filter(([k]) => k !== "hash").sort(([a], [b]) => a.localeCompare(b));
  const checkString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");
  return expected === hash ? params : null;
}

export function identify(req: Request): Identity {
  const auth = req.header("authorization");
  if (auth && auth.toLowerCase().startsWith("tma ")) {
    const params = verifyInitData(auth.slice(4));
    const userJson = params?.get("user");
    if (userJson) {
      try {
        const u = JSON.parse(userJson) as { id: number; first_name?: string; last_name?: string; username?: string };
        return { telegramUserId: String(u.id), name: [u.first_name, u.last_name].filter(Boolean).join(" ") || undefined, username: u.username };
      } catch { /* fall through */ }
    }
  }
  const botUser = req.header("x-telegram-user-id");
  if (botUser) return { telegramUserId: botUser, name: req.header("x-telegram-user-name") || undefined };
  const guest = req.header("x-buyer-id");
  if (guest) return { telegramUserId: guest.slice(0, 64) };
  return { telegramUserId: "anon" };
}

export class BannedError extends Error { status = 403; }

export async function getOrCreateBuyer(id: Identity) {
  const b = await prisma.buyer.upsert({
    where: { telegramUserId: id.telegramUserId },
    create: { telegramUserId: id.telegramUserId, name: id.name, username: id.username },
    update: { ...(id.name ? { name: id.name } : {}), ...(id.username ? { username: id.username } : {}), lastSeenAt: new Date() },
  });
  if (b.banned) throw new BannedError("account suspended");
  return b;
}
