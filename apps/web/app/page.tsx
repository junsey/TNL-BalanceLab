import { redirect } from "next/navigation";
import { currentSession, developmentAccess } from "../lib/session";
import { Lab } from "./lab";
export default async function Page() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <Lab alias={session.alias} shared={!developmentAccess()} />;
}
