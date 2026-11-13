import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { z } from "zod";

const derive = promisify(scrypt);
const passwordHashPattern = /^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/;
export const sessionCookie = "tnl_session";
export const sessionSeconds = 8 * 60 * 60;
const sessionSchema = z.strictObject({
  alias: z.string().min(1).max(60),
  expiry: z.number().int(),
  nonce: z.string().min(16),
});

function secret() {
  const value = process.env.SESSION_SECRET;
  return value && Buffer.byteLength(value) >= 32 ? value : null;
}

export function developmentAccess() {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.SESSION_SECRET &&
    !process.env.SHARED_PASSWORD_HASH
  );
}

export async function authenticate(password: string) {
  const encoded = process.env.SHARED_PASSWORD_HASH;
  if (!encoded || Buffer.byteLength(password) > 512) return false;
  const match = passwordHashPattern.exec(encoded);
  if (!match) return false;
  const salt = Buffer.from(match[1]!, "hex");
  const expected = Buffer.from(match[2]!, "hex");
  const actual = (await derive(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function loginConfigurationIssue() {
  if (!secret()) return "SESSION_SECRET";
  if (!passwordHashPattern.test(process.env.SHARED_PASSWORD_HASH ?? ""))
    return "SHARED_PASSWORD_HASH";
  return null;
}

export function issueSession(alias: string) {
  const key = secret();
  if (!key) throw new Error("Sesión sin configurar");
  const payload = sessionSchema.parse({
    alias,
    expiry: Math.floor(Date.now() / 1000) + sessionSeconds,
    nonce: randomBytes(16).toString("base64url"),
  });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return (
    body + "." + createHmac("sha256", key).update(body).digest("base64url")
  );
}

export async function currentSession() {
  if (developmentAccess()) return { alias: "Local" };
  const value = (await cookies()).get(sessionCookie)?.value;
  const key = secret();
  if (!value || !key || value.length > 1024) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const payload = sessionSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString()),
    );
    return payload.expiry > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  return origin === expected;
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: sessionSeconds,
};
