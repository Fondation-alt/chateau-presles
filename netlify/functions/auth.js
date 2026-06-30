export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json({ ok: false }, 405);
  }

  const body = JSON.parse(event.body || "{}");
  const scope = body.scope === "kitchen" ? "kitchen" : "admin";
  const expected = scope === "kitchen"
    ? process.env.KITCHEN_PIN || "cuisine2026"
    : process.env.ADMIN_PIN || "presles2026";

  return json({ ok: body.pin === expected });
};

function json(value, statusCode = 200) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(value)
  };
}
