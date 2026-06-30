const fs = require("fs");
const path = require("path");
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const store = getStore("presles-content");

  if (event.httpMethod === "GET") {
    const stored = await store.get("content", { type: "json" });
    if (stored) return json(stored);

    const fallbackPath = path.join(process.cwd(), "content.json");
    const fallback = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
    return json(fallback);
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const scope = body.scope === "kitchen" ? "kitchen" : "admin";
    const expected = scope === "kitchen"
      ? process.env.KITCHEN_PIN || "cuisine2026"
      : process.env.ADMIN_PIN || "presles2026";

    if (body.pin !== expected) {
      return json({ ok: false, message: "Code incorrect." }, 401);
    }

    if (!body.content || typeof body.content !== "object") {
      return json({ ok: false, message: "Contenu invalide." }, 400);
    }

    if (scope === "kitchen") {
      const current = await store.get("content", { type: "json" }) || body.content;
      current.kitchen = body.content.kitchen;
      await store.setJSON("content", current);
      return json({ ok: true });
    }

    await store.setJSON("content", body.content);
    return json({ ok: true });
  }

  return json({ ok: false }, 405);
};

function json(value, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(value)
  };
}
