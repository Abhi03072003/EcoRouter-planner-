const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "pandeyharsh73099@gmail.com";

export async function notifyAdmin({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [ADMIN_EMAIL],
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return { sent: false, reason: err };
  }

  return { sent: true };
}
