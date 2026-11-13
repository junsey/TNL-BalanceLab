import { redirect } from "next/navigation";
import { currentSession } from "../../lib/session";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="shell">
      <section className="pane login">
        <p className="series">THE NIGHT LAND RPG</p>
        <h1>Balance Lab</h1>
        <form method="post" action="/api/session">
          <label>
            Alias{" "}
            <input
              name="alias"
              autoComplete="nickname"
              required
              maxLength={60}
            />
          </label>
          <label>
            Contraseña compartida{" "}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && <p role="alert">Alias o contraseña inválidos.</p>}
          <button className="accent" type="submit">
            Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}
