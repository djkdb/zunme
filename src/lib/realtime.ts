/**
 * Which realtime backend to use, in priority order:
 *  1. Supabase Realtime   — when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set
 *  2. Cloudflare Worker   — WebSocket to NEXT_PUBLIC_REALTIME_URL
 *                           (defaults to same-origin "/ws" in production builds,
 *                           i.e. the Durable Object shipped with this repo)
 *  3. Local               — BroadcastChannel between tabs on this device
 */
import { isSupabaseConfigured } from "@/lib/supabase";

export type RealtimeBackend = "supabase" | "worker" | "local";

export function getRealtimeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const configured = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  if (configured === "off") return null;
  const raw = configured || (process.env.NODE_ENV === "production" ? "/ws" : "");
  if (!raw) return null;
  if (raw.startsWith("/")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${raw}`;
  }
  return raw.replace(/^http/, "ws");
}

export function getRealtimeBackend(): RealtimeBackend {
  if (isSupabaseConfigured()) return "supabase";
  if (getRealtimeUrl()) return "worker";
  return "local";
}
