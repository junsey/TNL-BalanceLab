const maxBytes = 1024 * 1024;
export async function readBounded(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError("Falta cuerpo");
  const decoder = new TextDecoder("utf8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new RangeError("El documento supera 1 MiB");
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode()) as unknown;
  } finally {
    await reader.cancel();
  }
}
