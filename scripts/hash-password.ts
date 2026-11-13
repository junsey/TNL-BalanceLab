import { randomBytes, scryptSync } from "node:crypto";
const parts: Buffer[] = [];
for await (const chunk of process.stdin) parts.push(chunk as Buffer);
const password = Buffer.concat(parts)
  .toString("utf8")
  .replace(/\r?\n$/, "");
if (!password || Buffer.byteLength(password) > 512)
  throw new RangeError("Contraseña inválida");
const salt = randomBytes(16);
process.stdout.write(
  "scrypt$" +
    salt.toString("hex") +
    "$" +
    scryptSync(password, salt, 64).toString("hex") +
    "\n",
);
