// Canonical Cloudflare Turnstile siteverify - see
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// Called from the API server only, never the browser. The widget itself
// (sitekey, data-action="turnstile-spin-v2") lives in apps/web.
export async function verifyTurnstileToken(input: {
  token: string | undefined;
  secret: string | undefined;
  remoteIp?: string;
}): Promise<boolean> {
  if (!input.secret || !input.token) return false;

  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const result = (await res.json()) as { success: boolean };
  return result.success === true;
}
