import { redirect } from "next/navigation";
import { auth } from "../auth";
import MarathonApp from "./components/MarathonApp";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <MarathonApp user={session.user} />;
}
