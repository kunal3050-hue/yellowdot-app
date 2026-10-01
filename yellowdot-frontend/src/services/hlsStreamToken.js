/**
 * hlsStreamToken.js — carry the CCTV stream token on EVERY HLS request
 * ─────────────────────────────────────────────────────────────────────────────
 * MediaMTX is deployed with `authHTTPAddress` pointing at our own
 * `POST /internal/cctv/auth` hook, which means the media server authorizes
 * EVERY request it serves — the master playlist, the variant playlist, the
 * init segment and each media segment — by looking for `token=` in the query
 * string.
 *
 * hls.js resolves the URLs it finds inside a playlist RELATIVE to that
 * playlist's URL, and relative resolution drops the query string. So putting
 * the token on the `index.m3u8` URL alone authorizes exactly one request: the
 * first. Everything after it goes out bare and comes back 401, which hls.js
 * reports as a fatal network error — the player never reaches media, and the
 * page sits on its reconnect spinner forever.
 *
 * The loader below re-applies the current token to every URL hls.js asks for.
 * `getToken` is read at request time, not at construction time, so the 90-second
 * token rotation is picked up without tearing the player down.
 */

import Hls from "hls.js";

/** Append (or replace) `token=` on a stream URL. */
export function withStreamToken(url, token) {
  if (!url || !token) return url;
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    // Relative URL in a non-browser context (tests) — fall back to string work.
    const stripped = url.replace(/([?&])token=[^&]*(&|$)/, "$1").replace(/[?&]$/, "");
    return `${stripped}${stripped.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }
}

/**
 * An hls.js loader class that signs every request with the current token.
 * Pass as `new Hls({ loader: createTokenLoader(() => tokenRef.current) })` —
 * hls.js uses `loader` for playlists, fragments and keys alike.
 */
export function createTokenLoader(getToken) {
  const Base = Hls.DefaultConfig.loader;
  return class StreamTokenLoader extends Base {
    load(context, config, callbacks) {
      context.url = withStreamToken(context.url, getToken());
      super.load(context, config, callbacks);
    }
  };
}

export default { withStreamToken, createTokenLoader };
