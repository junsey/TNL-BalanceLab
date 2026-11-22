import { redirect } from "next/navigation";
import { currentSession, developmentAccess } from "../lib/session";
import { Lab } from "./lab";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const session = await currentSession();
  if (!session) redirect("/login");
  return (
    <Lab
      alias={session.alias}
      shared={!developmentAccess()}
      initialMode={mode === "creation" ? "creation" : "auto"}
    />
  );
}
