import Link from "next/link";

export default async function HomePage() {
  return (
    <div className="app-shell public-shell">
      <header className="topbar">
        <div className="brand-button" aria-label="Marathon Skills">
          <span className="brand-title">Marathon Skills</span>
          <span className="brand-subtitle">Главная страница ежегодного марафона 15 июня</span>
        </div>
        <nav className="topnav" aria-label="Основная навигация">
          <Link className="nav-button" href="/">Главная</Link>
          <Link className="nav-button" href="/login">Войти</Link>
        </nav>
      </header>

      <main>
        <section className="overview-hero">
          <img className="hero-image" src="/assets/marathon-hero.png" alt="Бегуны готовятся к марафону в зеленом парке" />
          <div className="hero-shade" />
          <div className="overview-content">
            <div>
              <span className="hero-date">Обзор марафона</span>
              <h1>Marathon Skills</h1>
              <p>Информационная главная страница проекта: регистрация участников, расчет ИМТ и сохранение данных доступны после входа через Google.</p>
            </div>
            <div className="overview-actions">
              <Link className="button button-light" href="/login">Войти через Google</Link>
              <Link className="button button-soft" href="/dashboard">Открыть кабинет</Link>
            </div>
          </div>
        </section>

        <section className="overview-grid">
          <article className="overview-card overview-card-main">
            <span className="card-label">Главная</span>
            <h2>Обзор проекта</h2>
            <p>Эта страница открывается первой и не требует авторизации.</p>
          </article>
          <article className="overview-card">
            <span className="card-label">Регистрация</span>
            <h2>Участники</h2>
            <p>После входа можно добавлять, редактировать и удалять участников марафона.</p>
          </article>
          <article className="overview-card">
            <span className="card-label">Расчет</span>
            <h2>ИМТ</h2>
            <p>Сайт рассчитывает индекс массы тела, калории и показывает визуальную шкалу.</p>
          </article>
          <article className="overview-card">
            <span className="card-label">Хранение</span>
            <h2>Supabase</h2>
            <p>Данные сохраняются в PostgreSQL через защищенные API-маршруты Vercel.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
