module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const roundRaw = typeof req.query.round === "string" ? req.query.round.trim() : "";
  const round = /^\d{1,4}$/.test(roundRaw) ? roundRaw : "";
  const url = round
    ? `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${encodeURIComponent(round)}`
    : "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "User-Agent":
          "Mozilla/5.0 (compatible; LotteryPractice/1.0; +https://lotto-practice.vercel.app)",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.dhlottery.co.kr/",
      },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "upstream failed", status: upstream.status });
      return;
    }

    const payload = await upstream.json();
    const item = payload && payload.data && Array.isArray(payload.data.list)
      ? payload.data.list[0]
      : null;

    if (!item) {
      res.status(502).json({ error: "no draw data" });
      return;
    }

    const numbers = [
      Number(item.tm1WnNo),
      Number(item.tm2WnNo),
      Number(item.tm3WnNo),
      Number(item.tm4WnNo),
      Number(item.tm5WnNo),
      Number(item.tm6WnNo),
    ];
    const bonus = Number(item.bnsWnNo);

    if (
      numbers.length !== 6 ||
      numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 45) ||
      !Number.isInteger(bonus) ||
      bonus < 1 ||
      bonus > 45
    ) {
      res.status(502).json({ error: "invalid draw payload" });
      return;
    }

    res.status(200).json({
      source: "dhlottery",
      round: Number(item.ltEpsd),
      date: String(item.ltRflYmd || ""),
      numbers,
      bonus,
    });
  } catch (err) {
    res.status(502).json({
      error: "fetch failed",
      message: err && err.message ? err.message : String(err),
    });
  }
};
