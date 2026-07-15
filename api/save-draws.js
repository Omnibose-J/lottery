const { createHash } = require("crypto");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidSet(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 6) return false;
  const vals = numbers.map(Number);
  if (vals.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) return false;
  return new Set(vals).size === 6;
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0].trim();
  return req.socket && req.socket.remoteAddress
    ? String(req.socket.remoteAddress)
    : "unknown";
}

function hashIp(ip) {
  return createHash("sha256").update(`lottery:${ip}`).digest("hex").slice(0, 32);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: "server misconfigured" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "invalid json" });
      return;
    }
  }

  const clientId = body && body.client_id;
  const sets = body && body.sets;
  if (!UUID_RE.test(String(clientId || ""))) {
    res.status(400).json({ error: "invalid client_id" });
    return;
  }
  if (!Array.isArray(sets) || sets.length < 1 || sets.length > 5) {
    res.status(400).json({ error: "sets must be 1-5" });
    return;
  }
  if (!sets.every(isValidSet)) {
    res.status(400).json({ error: "invalid numbers" });
    return;
  }

  const ipHash = hashIp(clientIp(req));
  const rows = sets.map((numbers) => ({
    numbers: numbers.map(Number).sort((a, b) => a - b),
    client_id: String(clientId).toLowerCase(),
    ip_hash: ipHash,
  }));

  try {
    const upstream = await fetch(`${url.replace(/\/$/, "")}/rest/v1/lotto_draw`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });

    const text = await upstream.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!upstream.ok) {
      const msg =
        (payload && (payload.message || payload.error_description || payload.error)) ||
        text ||
        "insert failed";
      const status = /rate limit/i.test(String(msg)) ? 429 : 400;
      res.status(status).json({ error: String(msg) });
      return;
    }

    res.status(200).json({ ok: true, saved: rows.length });
  } catch (err) {
    res.status(502).json({
      error: "upstream failed",
      message: err && err.message ? err.message : String(err),
    });
  }
};
