/**
 * Minimal smoke checks for Lottery audit remediations.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
const base = (process.argv[2] || "https://lotto-practice.vercel.app").replace(/\/$/, "");

async function main() {
  const failures = [];

  const latest = await fetch(`${base}/api/lotto-latest`);
  if (!latest.ok) failures.push(`lotto-latest HTTP ${latest.status}`);
  else {
    const j = await latest.json();
    if (!Array.isArray(j.numbers) || j.numbers.length !== 6) {
      failures.push("lotto-latest payload invalid");
    }
  }

  const html = await fetch(`${base}/`);
  const text = await html.text();
  if (!text.includes("G-BHJCDFF8CY")) failures.push("missing GA id");
  if (!text.includes("lottery_consent")) failures.push("missing consent key");
  if (!text.includes("/api/save-draws")) failures.push("client not using save-draws API");
  if (!text.includes("getRandomValues")) failures.push("missing CSPRNG shuffle");

  // Direct anon insert must fail after audit migration.
  const anon =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cXBzc3d2cGVidGF3cGNndmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjE5MzMsImV4cCI6MjA5NzU5NzkzM30.sXpeYxjA55mvq4z0jK-Id4HUOY-rz3rR7TP6_XO3I7c";
  const deny = await fetch("https://uuqpsswvpebtawpcgvaa.supabase.co/rest/v1/lotto_draw", {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      numbers: [1, 2, 3, 4, 5, 6],
      client_id: "11111111-1111-4111-8111-111111111111",
    }),
  });
  if (deny.ok) failures.push("anon insert unexpectedly allowed");

  if (failures.length) {
    console.error("SMOKE FAIL");
    failures.forEach((f) => console.error("-", f));
    process.exit(1);
  }
  console.log("SMOKE PASS", base);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
