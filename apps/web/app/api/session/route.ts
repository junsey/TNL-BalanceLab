import { NextResponse } from "next/server";
import {
  authenticate,
  cookieOptions,
  issueSession,
  loginConfigurationIssue,
  sameOrigin,
  sessionCookie,
} from "../../../lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return new Response("Origen no permitido", { status: 403 });
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  ) {
    return new Response("Formato inválido", { status: 415 });
  }
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 1 || length > 4096)
    return new Response("Solicitud inválida", { status: 400 });
  const form = await request.formData();
  const alias = String(form.get("alias") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const configurationIssue = loginConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.redirect(
      new URL(`/login?error=${configurationIssue}`, request.url),
      303,
    );
  }
  if (!alias || alias.length > 60 || !(await authenticate(password))) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(sessionCookie, issueSession(alias), cookieOptions);
  return response;
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return new Response("Origen no permitido", { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
