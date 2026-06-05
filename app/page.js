import Link from "next/link";

const supportUrl = "https://t.me/Marathon432bot?start=support";

const distances = [
  { title: "42.195 км", label: "Полный марафон", text: "Главная дистанция для опытных бегунов и команд поддержки." },
  { title: "21 км", label: "Полумарафон", text: "Баланс скорости и выносливости для уверенного старта сезона." },
  { title: "10 км", label: "Городской забег", text: "Доступная дистанция для участников с разным уровнем подготовки." },
  { title: "2 км", label: "Детский забег", text: "Короткий маршрут для юных участников и семейного дня." }
];

const schedule = [
  ["06:00", "Открытие стартового городка и регистрационных стоек"],
  ["07:00", "Старт марафона и полумарафона"],
  ["08:30", "Старт дистанций 10 км и 2 км"],
  ["11:30", "Награждение участников и закрытие финишной зоны"]
];

export default async function HomePage() {
  return (
    <div className="app-shell public-shell">
      <header className="topbar">
        <div className="brand-button" aria-label="Marathon Skills">
          <span className="brand-title">Marathon Skills</span>
          <span className="brand-subtitle">Ежегодный марафон у подножия Заилийского Алатау</span>
        </div>
        <nav className="topnav" aria-label="Основная навигация">
          <Link className="nav-button" href="/">Главная</Link>
          <Link className="nav-button" href="/login">Войти</Link>
        </nav>
      </header>

      <main>
        <section className="overview-hero public-hero">
          <img className="hero-image" src="/assets/marathon-hero.png" alt="Бегуны готовятся к марафону в зеленом парке" />
          <div className="hero-shade" />
          <div className="overview-content public-hero-content">
            <div>
              <span className="hero-date">15 июня 2026 · Алматы</span>
              <h1>Marathon Skills</h1>
              <p>Городской марафон для бегунов, семей и координаторов. Зарегистрируйте участника, рассчитайте ИМТ, сохраните данные в Supabase и проверяйте результаты через Telegram-бота.</p>
            </div>
            <div className="overview-actions">
              <Link className="button button-light" href="/login">Войти через Google</Link>
              <Link className="button button-soft" href="/dashboard">Открыть кабинет</Link>
            </div>
          </div>
        </section>

        <section className="event-strip" aria-label="Ключевая информация">
          <article className="stat-tile"><span>Дата</span><strong>15 июня</strong><p>Стартовый день марафона 2026 года</p></article>
          <article className="stat-tile"><span>Место</span><strong>Алматы</strong><p>Маршрут у подножия Заилийского Алатау</p></article>
          <article className="stat-tile"><span>Старт</span><strong>07:00</strong><p>Утренний старт для основных дистанций</p></article>
          <article className="stat-tile"><span>База</span><strong>Supabase</strong><p>Регистрация и фото сохраняются в облаке</p></article>
        </section>

        <section className="section-band">
          <div className="section-heading">
            <span className="card-label">Дистанции</span>
            <h2>Выберите свой маршрут</h2>
            <p>От семейного забега до полного марафона: каждая дистанция отображается в системе регистрации и доступна координаторам.</p>
          </div>
          <div className="distance-list">
            {distances.map((distance) => (
              <article className="distance-card" key={distance.title}>
                <strong>{distance.title}</strong>
                <span>{distance.label}</span>
                <p>{distance.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-section">
          <div className="section-band schedule-band">
            <div className="section-heading">
              <span className="card-label">Программа</span>
              <h2>Расписание дня</h2>
            </div>
            <div className="schedule-list">
              {schedule.map(([time, text]) => (
                <article className="schedule-item" key={time}>
                  <strong>{time}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="location-panel">
            <img src="/assets/marathon-hero.png" alt="Парк и беговая зона марафона" />
            <div>
              <span className="card-label">Локация</span>
              <h2>Алматы, Казахстан</h2>
              <p>Стартовая зона расположена в зеленой части города. Участники получают удобный маршрут, утренний старт и поддержку координаторов.</p>
            </div>
          </div>
        </section>

        <section className="section-band tools-section">
          <div className="section-heading">
            <span className="card-label">Цифровой кабинет</span>
            <h2>Все данные участников в одном месте</h2>
            <p>Сайт повторяет логику приложения на C#: регистрация, фото 512x512, расчет ИМТ, фильтрация участников и Telegram-поиск по фамилии.</p>
          </div>
          <div className="feature-list">
            <article><strong>Google OAuth</strong><p>Вход только через аккаунт Google, API защищены проверкой сессии.</p></article>
            <article><strong>Supabase PostgreSQL</strong><p>Участники, показатели и ссылки на фото сохраняются в облачной базе.</p></article>
            <article><strong>Telegram-бот</strong><p>Бот отвечает по фамилии, показывает ИМТ, калораж, дистанции и контакты поддержки.</p></article>
          </div>
        </section>

        <section className="cta-band">
          <div>
            <span className="card-label">Готовы к старту?</span>
            <h2>Добавьте участника и проверьте работу всей системы</h2>
            <p>После входа откроется кабинет с регистрацией, расчетом ИМТ и списком участников.</p>
          </div>
          <Link className="button button-primary" href="/login">Перейти к регистрации</Link>
        </section>
      </main>

      <a className="support-fab public-support-fab" href={supportUrl} target="_blank" rel="noreferrer" aria-label="Открыть техподдержку в Telegram">Техподдержка</a>
    </div>
  );
}
