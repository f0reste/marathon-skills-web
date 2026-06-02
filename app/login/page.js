import { redirect } from "next/navigation";
import { auth } from "../../auth";
import LoginButton from "./LoginButton";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="login-page">
      <section className="login-panel">
        <span className="login-kicker">Marathon Skills</span>
        <h1>Вход в систему</h1>
        <p>Авторизуйтесь через Google, чтобы работать со своим списком участников марафона.</p>
        <LoginButton />
        <small>После входа данные сохраняются в облачной базе PostgreSQL.</small>
      </section>
    </main>
  );
}
