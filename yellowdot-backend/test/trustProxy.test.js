/**
 * trust proxy — what req.ip is allowed to believe.
 *
 * req.ip is written to the CCTV audit log (who viewed which child's camera,
 * and from where) and to the auth route. Before this setting existed the app
 * never configured a trusted proxy, so Express ignored X-Forwarded-For and
 * every entry recorded the proxy's address rather than the viewer's.
 *
 * Two things are worth pinning down, and only one of them is "does it work":
 *
 *   1. With the proxy trusted, req.ip becomes the forwarded client address.
 *   2. With a DIFFERENT proxy trusted, a forwarded header is ignored. This is
 *      the security half. The production value is a single gateway address
 *      precisely so that sibling containers on the same Docker bridge — which
 *      can reach the backend directly — cannot forge an audit-log IP.
 *
 * These exercise a real Express app over a real socket rather than a mocked
 * req, because the behaviour under test belongs to Express's trust-proxy
 * implementation, not to our code. Mocking it would only assert our beliefs
 * about Express back to us.
 */
const test   = require("node:test");
const assert = require("node:assert");
const http   = require("node:http");
const express = require("express");

const { resolveTrustProxy, DEFAULT, TRUE_WARNING } = require("../utils/trustProxy");

// ── Parsing ─────────────────────────────────────────────────────────────────

test("unset or blank resolves to the loopback default", () => {
  assert.equal(resolveTrustProxy(undefined), DEFAULT);
  assert.equal(resolveTrustProxy(""), DEFAULT);
  assert.equal(resolveTrustProxy("   "), DEFAULT);
});

test('"false" disables trust entirely', () => {
  assert.equal(resolveTrustProxy("false"), false);
  assert.equal(resolveTrustProxy("FALSE"), false);
});

test("a bare number is a hop count, not a string", () => {
  assert.strictEqual(resolveTrustProxy("2"), 2);
});

test('"true" is honoured but warns, because it lets anyone forge the audit IP', () => {
  const warnings = [];
  assert.equal(resolveTrustProxy("true", m => warnings.push(m)), true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0], TRUE_WARNING);
});

test("an address or preset list passes through for Express to parse", () => {
  assert.equal(resolveTrustProxy("172.17.0.1"), "172.17.0.1");
  assert.equal(resolveTrustProxy(" loopback, uniquelocal "), "loopback, uniquelocal");
});

// ── Real request behaviour ──────────────────────────────────────────────────

/**
 * Starts an app with the given trust-proxy setting, makes one request over
 * 127.0.0.1 carrying X-Forwarded-For, and resolves with the req.ip Express
 * reported. The peer is therefore always loopback, which is what makes the
 * "different proxy trusted" case below meaningful.
 */
function reportedIp(trustProxySetting, forwardedFor) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.set("trust proxy", trustProxySetting);
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));

    const server = http.createServer(app).listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const req = http.request(
        { host: "127.0.0.1", port, path: "/ip", headers: { "X-Forwarded-For": forwardedFor } },
        res => {
          let body = "";
          res.on("data", c => (body += c));
          res.on("end", () => {
            server.close();
            try { resolve(JSON.parse(body).ip); } catch (e) { reject(e); }
          });
        },
      );
      req.on("error", err => { server.close(); reject(err); });
      req.end();
    });
  });
}

const CLIENT = "203.0.113.45";   // TEST-NET-3, never a real client

test("untrusted: X-Forwarded-For is ignored and req.ip is the peer", async () => {
  const ip = await reportedIp(false, CLIENT);
  assert.match(ip, /127\.0\.0\.1$/, `expected the socket peer, got ${ip}`);
  assert.ok(!ip.includes(CLIENT), "a forwarded header must not be believed when untrusted");
});

test("trusted peer: req.ip becomes the forwarded client address", async () => {
  // The peer here IS loopback, so "loopback" trusts it — this is the
  // mechanism the production fix relies on, with the gateway in place of
  // loopback because docker-proxy re-originates the connection.
  const ip = await reportedIp("loopback", CLIENT);
  assert.equal(ip, CLIENT);
});

test("a different proxy trusted: the forwarded header is NOT believed", async () => {
  // The security half. Trusting 172.17.0.1 must not confer trust on a
  // loopback caller — otherwise sibling containers on the bridge could write
  // whatever IP they liked into the CCTV audit log.
  const ip = await reportedIp("172.17.0.1", CLIENT);
  assert.match(ip, /127\.0\.0\.1$/, `expected the socket peer, got ${ip}`);
  assert.ok(!ip.includes(CLIENT), "only the named proxy may be believed");
});

test("the last untrusted hop wins, not the left-most claim", async () => {
  // A client that sends its own X-Forwarded-For before reaching the proxy
  // must not be able to prepend a forged address and have it chosen.
  const ip = await reportedIp("loopback", `${"198.51.100.9"}, ${CLIENT}`);
  assert.equal(ip, CLIENT, "Express should take the right-most untrusted hop");
});
