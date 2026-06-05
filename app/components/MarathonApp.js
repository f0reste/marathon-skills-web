"use client";

import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  calculateMetrics,
  createCountdownText,
  filterAndSortParticipants,
  getBmiVisual,
  safePhotoDataUrl,
  validatePhotoFile
} from "../../lib/domain";

const supportUrl = "https://t.me/Marathon432bot?start=support";
const adminEmail = "notnamenf4@gmail.com";

const emptyForm = {
  firstName: "",
  lastName: "",
  gender: "Мужской",
  birthDate: "",
  email: "",
  phone: "",
  country: ""
};

function fullName(participant) {
  return `${participant.lastName} ${participant.firstName}`.trim();
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function countLabel(count) {
  const ending = count % 10 === 1 && count % 100 !== 11 ? "бегун" : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? "бегуна" : "бегунов";
  return `${count} ${ending}`;
}

function createPhotoName(fileName) {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "participant-photo";
  return `${Date.now()}-${baseName}.jpg`;
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = 512;
      const cropSide = Math.min(image.width, image.height);
      const sourceX = Math.round((image.width - cropSide) / 2);
      const sourceY = Math.round((image.height - cropSide) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Не удалось подготовить фотографию."));
        return;
      }
      context.drawImage(image, sourceX, sourceY, cropSide, cropSide, 0, 0, size, size);
      resolve({
        name: createPhotoName(file.name),
        dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        width: size,
        height: size
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось прочитать фотографию."));
    };

    image.src = objectUrl;
  });
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Произошла ошибка при обращении к API.");
  return data;
}

function Countdown() {
  const [text, setText] = useState(() => createCountdownText());

  useEffect(() => {
    let intervalId = null;
    const update = () => setText(createCountdownText());
    const start = () => {
      if (intervalId !== null) return;
      update();
      intervalId = window.setInterval(update, 1000);
    };
    const stop = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };
    const handleVisibility = () => document.hidden ? stop() : start();

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", stop);
    };
  }, []);

  return <strong>{text}</strong>;
}

export default function MarathonApp({ user }) {
  const isAdmin = String(user.email || "").toLowerCase() === adminEmail;
  const [page, setPage] = useState("home");
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [formError, setFormError] = useState("");
  const [bmiError, setBmiError] = useState("");
  const [filters, setFilters] = useState({ search: "", gender: "all", country: "all" });
  const [sort, setSort] = useState({ key: "fullName", direction: "asc" });

  const visibleParticipants = useMemo(
    () => filterAndSortParticipants(participants, filters, sort),
    [participants, filters, sort]
  );
  const countries = useMemo(
    () => [...new Set(participants.map((participant) => participant.country))].sort((a, b) => a.localeCompare(b, "ru")),
    [participants]
  );

  async function loadParticipants() {
    setLoading(true);
    try {
      setParticipants(await readJson(await fetch("/api/participants", { cache: "no-store" })));
      setNotice("");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParticipants();
  }, []);

  function openPage(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewRegistration() {
    setEditingId(null);
    setForm(emptyForm);
    setPhoto(null);
    setHeightCm("");
    setWeightKg("");
    setMetrics(null);
    setFormError("");
    setBmiError("");
    openPage("registration");
  }

  function editParticipant(participant) {
    if (!isAdmin) {
      setNotice("Редактирование доступно только администратору.");
      return;
    }
    setEditingId(participant.id);
    setForm({
      firstName: participant.firstName,
      lastName: participant.lastName,
      gender: participant.gender,
      birthDate: participant.birthDate,
      email: participant.email,
      phone: participant.phone,
      country: participant.country
    });
    setPhoto(participant.photo);
    setHeightCm(String(participant.heightCm));
    setWeightKg(String(participant.weightKg));
    setMetrics({
      ok: true,
      bmi: participant.bmi,
      calories: participant.calories,
      visual: getBmiVisual(participant.bmi)
    });
    setFormError("");
    setBmiError("");
    openPage("registration");
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submitRegistration(event) {
    event.preventDefault();
    if (Object.values(form).some((value) => !String(value).trim())) {
      setFormError("Заполните все обязательные поля регистрации.");
      return;
    }
    if (!form.email.includes("@") || !form.email.includes(".")) {
      setFormError("Введите корректный email.");
      return;
    }
    if (form.gender === "Не указан") {
      setFormError("Для расчета калорий выберите мужской или женский пол.");
      return;
    }
    setFormError("");
    openPage("bmi");
  }

  function calculate() {
    const result = calculateMetrics({ ...form, heightCm, weightKg });
    if (!result.ok) {
      setBmiError(result.error);
      return null;
    }
    setBmiError("");
    setMetrics(result);
    return result;
  }

  async function saveParticipant(event) {
    event.preventDefault();
    const result = calculate();
    if (!result) return;
    const payload = { ...form, heightCm, weightKg, photo };

    try {
      const endpoint = editingId ? `/api/participants/${editingId}` : "/api/participants";
      const method = editingId ? "PUT" : "POST";
      const savedParticipant = await readJson(await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }));
      setParticipants((current) => {
        if (editingId) {
          return current.map((participant) => participant.id === savedParticipant.id ? savedParticipant : participant);
        }
        return [savedParticipant, ...current];
      });
      openPage("participants");
      await loadParticipants();
    } catch (error) {
      setBmiError(error.message);
    }
  }

  async function deleteParticipant(participant) {
    if (!isAdmin) {
      setNotice("Удаление доступно только администратору.");
      return;
    }
    if (!window.confirm(`Удалить участника ${fullName(participant)}?`)) return;
    try {
      const response = await fetch(`/api/participants/${participant.id}`, { method: "DELETE" });
      if (!response.ok) await readJson(response);
      await loadParticipants();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      setFormError(validation.error);
      event.target.value = "";
      return;
    }
    try {
      const resizedPhoto = await resizePhoto(file);
      if (!safePhotoDataUrl(resizedPhoto.dataUrl)) {
        setFormError("Не удалось подготовить фотографию.");
        return;
      }
      setPhoto(resizedPhoto);
      setFormError("");
    } catch (error) {
      setFormError(error.message);
      event.target.value = "";
    }
  }

  function toggleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function sortArrow(key) {
    if (sort.key !== key) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  }

  const visual = metrics?.visual || null;
  const marker = metrics?.bmi ? Math.min(100, Math.max(0, ((metrics.bmi - 12) / 28) * 100)) : 0;

  return (
    <div className={`app-shell ${isAdmin ? "is-admin" : "is-user"}`}>
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => openPage("home")} aria-label="Открыть главную страницу">
          <span className="brand-title">Marathon Skills</span>
          <span className="brand-subtitle">Панель управления ежегодным марафоном 15 июня</span>
        </button>
        <div className="topbar-right">
          <nav className="topnav" aria-label="Основная навигация">
            <button className="nav-button" type="button" onClick={() => openPage("home")}>Обзор</button>
            <button className="nav-button" type="button" onClick={startNewRegistration}>Регистрация</button>
            <button className="nav-button" type="button" onClick={() => openPage("participants")}>Участники</button>
          </nav>
          <div className="user-menu">
            {user.image ? <img className="user-avatar" src={user.image} alt="" referrerPolicy="no-referrer" /> : <span className="user-avatar user-avatar-empty">U</span>}
            <span>{user.name || user.email}</span>
            <button className="logout-button" type="button" onClick={() => signOut({ callbackUrl: "/login" })}>Выйти</button>
          </div>
        </div>
      </header>

      <main>
        {page === "home" && (
          <section>
            <section className="overview-hero public-hero">
              <img className="hero-image" src="/assets/marathon-hero.png" alt="Бегуны готовятся к марафону в зеленом парке" />
              <div className="hero-shade" />
              <div className="overview-content public-hero-content">
                <div>
                  <span className="hero-date">15 июня 2026 · Алматы</span>
                  <h1>Marathon Skills</h1>
                  <p>Городской марафон для бегунов, семей и координаторов. В кабинете можно добавить участника, рассчитать ИМТ, сохранить фото и проверить данные через Telegram-бота.</p>
                </div>
                <div className="overview-actions">
                  <button className="button button-light" type="button" onClick={() => openPage("participants")}>Участники</button>
                  <button className="button button-soft" type="button" onClick={startNewRegistration}>Добавить участника</button>
                </div>
              </div>
            </section>
            <section className="overview-grid">
              <article className="overview-card overview-card-main">
                <span className="card-label">До старта</span>
                <h2><Countdown /></h2>
                <p>Дата ближайшего марафона: 15 июня. Таймер работает в фоне и останавливается, когда вкладка неактивна.</p>
              </article>
              <article className="overview-card">
                <span className="card-label">Участники</span>
                <h2>{countLabel(participants.length)}</h2>
                <p>{loading ? "Идет загрузка списка из базы данных." : "Список доступен в отдельном разделе с поиском, фильтрами и сортировкой."}</p>
              </article>
              <article className="overview-card">
                <span className="card-label">База данных</span>
                <h2>Supabase</h2>
                <p>Данные сохраняются в PostgreSQL через API Vercel и привязаны к вашему Google-аккаунту.</p>
              </article>
              <article className="overview-card">
                <span className="card-label">BMI</span>
                <h2>ИМТ + шкала</h2>
                <p>После заполнения анкеты сайт рассчитывает BMI, категорию, калории и показывает визуальную шкалу.</p>
              </article>
            </section>
            <section className="event-strip" aria-label="Ключевая информация">
              <article className="stat-tile"><span>Дата</span><strong>15 июня</strong><p>Стартовый день марафона 2026 года</p></article>
              <article className="stat-tile"><span>Место</span><strong>Алматы</strong><p>Маршрут у подножия Заилийского Алатау</p></article>
              <article className="stat-tile"><span>Старт</span><strong>07:00</strong><p>Утренний старт для основных дистанций</p></article>
              <article className="stat-tile"><span>Роль</span><strong>{isAdmin ? "Админ" : "Участник"}</strong><p>{isAdmin ? "Доступно управление всеми участниками" : "Редактирование и удаление закрыты"}</p></article>
            </section>
            <section className="section-band">
              <div className="section-heading">
                <span className="card-label">Дистанции</span>
                <h2>Маршруты марафона</h2>
                <p>Полный марафон, полумарафон, 10 км и детский забег. Данные участника сохраняются в базе и доступны для поиска через Telegram-бота.</p>
              </div>
              <div className="distance-list">
                <article className="distance-card"><strong>42.195 км</strong><span>Полный марафон</span><p>Главная дистанция для опытных бегунов.</p></article>
                <article className="distance-card"><strong>21 км</strong><span>Полумарафон</span><p>Средняя дистанция для уверенного старта.</p></article>
                <article className="distance-card"><strong>10 км</strong><span>Городской забег</span><p>Доступный формат для большинства участников.</p></article>
                <article className="distance-card"><strong>2 км</strong><span>Детский забег</span><p>Короткий семейный маршрут.</p></article>
              </div>
            </section>
            <section className="split-section">
              <div className="section-band schedule-band">
                <div className="section-heading">
                  <span className="card-label">Программа</span>
                  <h2>Расписание дня</h2>
                </div>
                <div className="schedule-list">
                  <article className="schedule-item"><strong>06:00</strong><p>Открытие стартового городка</p></article>
                  <article className="schedule-item"><strong>07:00</strong><p>Старт марафона и полумарафона</p></article>
                  <article className="schedule-item"><strong>08:30</strong><p>Старт дистанций 10 км и 2 км</p></article>
                  <article className="schedule-item"><strong>11:30</strong><p>Награждение участников</p></article>
                </div>
              </div>
              <div className="location-panel">
                <img src="/assets/marathon-hero.png" alt="Парк и беговая зона марафона" />
                <div>
                  <span className="card-label">Telegram</span>
                  <h2>Бот уже подключен</h2>
                  <p>Через @Marathon432bot можно открыть сайт, посмотреть дистанции, найти участника по фамилии и получить контакты техподдержки.</p>
                </div>
              </div>
            </section>
          </section>
        )}

        {page === "registration" && (
          <section className="page-surface">
            <div className="registration-layout">
              <section className="panel">
                <h1>{editingId ? "Редактирование участника" : "Регистрация бегуна"}</h1>
                <p className="panel-lead">Заполните личные данные, затем перейдите к расчету BMI.</p>
                <form onSubmit={submitRegistration} noValidate>
                  <div className="form-grid">
                    <label className="field"><span>Имя</span><input name="firstName" value={form.firstName} onChange={updateForm} required /></label>
                    <label className="field"><span>Фамилия</span><input name="lastName" value={form.lastName} onChange={updateForm} required /></label>
                    <label className="field"><span>Пол</span><select name="gender" value={form.gender} onChange={updateForm}><option>Мужской</option><option>Женский</option><option>Не указан</option></select></label>
                    <label className="field"><span>Дата рождения</span><input name="birthDate" type="date" value={form.birthDate} onChange={updateForm} required /></label>
                    <label className="field"><span>Email</span><input name="email" type="email" value={form.email} onChange={updateForm} required /></label>
                    <label className="field"><span>Телефон</span><input name="phone" value={form.phone} onChange={updateForm} required /></label>
                    <label className="field"><span>Страна</span><input name="country" value={form.country} onChange={updateForm} required /></label>
                  </div>
                  <p className="form-error" role="alert">{formError}</p>
                  <div className="form-actions">
                    <button className="button button-soft" type="button" onClick={() => openPage("home")}>Назад</button>
                    <button className="button button-primary" type="submit">Перейти к BMI</button>
                  </div>
                </form>
              </section>
              <aside className="panel registration-aside">
                <h2>Фото участника</h2>
                <div className="photo-preview">
                  {photo?.dataUrl ? <img src={photo.dataUrl} alt="Фото участника" /> : <span>Фото не выбрано</span>}
                </div>
                <p className="photo-filename">{photo?.name ? `${photo.name}${photo.width ? `, ${photo.width}x${photo.height}` : ""}` : "JPG, PNG, BMP до 2 МБ"}</p>
                <label className="button button-primary file-button">Выбрать<input type="file" accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp" onChange={selectPhoto} /></label>
                <button className="button button-soft" type="button" onClick={() => setPhoto(null)}>Очистить</button>
              </aside>
            </div>
          </section>
        )}

        {page === "bmi" && (
          <section className="page-surface">
            <div className="bmi-layout">
              <section className="panel">
                <h1>Расчет BMI</h1>
                <p className="panel-lead">Участник: {form.lastName} {form.firstName}</p>
                <form onSubmit={saveParticipant} noValidate>
                  <label className="field compact-field"><span>Рост, см</span><input type="number" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} min="80" max="250" step="0.1" required /></label>
                  <label className="field compact-field"><span>Вес, кг</span><input type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} min="20" max="300" step="0.1" required /></label>
                  <p className="form-error" role="alert">{bmiError}</p>
                  <div className="form-actions left-actions">
                    <button className="button button-soft" type="button" onClick={() => openPage("registration")}>Назад</button>
                    <button className="button button-light" type="button" onClick={calculate}>Рассчитать</button>
                    <button className="button button-primary" type="submit">Сохранить в БД</button>
                  </div>
                </form>
              </section>
              <section className="panel bmi-result-panel">
                <span className="result-kicker">Индекс массы тела</span>
                <strong className="bmi-value">{metrics?.bmi ? metrics.bmi.toFixed(1) : "--"}</strong>
                <strong className="bmi-category">{visual?.label || "Введите рост и вес"}</strong>
                <div className="bmi-visual">
                  <div className={`person ${visual?.className || ""}`} style={{ "--person-color": visual?.color || "#ccf1e1" }}><span className="person-head" /><span className="person-body" /><span className="person-arm person-arm-left" /><span className="person-arm person-arm-right" /><span className="person-leg person-leg-left" /><span className="person-leg person-leg-right" /></div>
                  <div className="scale-column"><span className="scale-title">Визуальная шкала</span><div className="bmi-scale"><span className="scale-segment scale-low" /><span className="scale-segment scale-normal" /><span className="scale-segment scale-high" /><span className="scale-segment scale-obesity" /><span className="scale-marker" style={{ left: `${marker}%`, opacity: metrics ? 1 : 0.45 }} /></div><div className="scale-labels"><span>до 18,5</span><span>18,5-25</span><span>25-30</span><span>30+</span></div></div>
                </div>
                <div className="calorie-card"><span>Основной обмен с учетом пола</span><strong>{metrics?.calories ? `${metrics.calories} ккал/день` : "-- ккал/день"}</strong><p>Расчет учитывает рост, вес, возраст и пол участника.</p></div>
              </section>
            </div>
          </section>
        )}

        {page === "participants" && (
          <section className="page-surface">
            <section className="panel participants-panel">
              <div className="panel-header"><div><h1>Список участников</h1><p className="panel-lead">Данные загружаются из вашей облачной базы</p></div><button className="button button-soft" type="button" onClick={() => openPage("home")}>Назад</button></div>
              {notice && <p className="api-notice" role="alert">{notice}</p>}
              <div className="participants-toolbar">
                <label className="field toolbar-search"><span>Поиск</span><input type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Имя, email или страна" /></label>
                <label className="field"><span>Пол</span><select value={filters.gender} onChange={(event) => setFilters({ ...filters, gender: event.target.value })}><option value="all">Все</option><option>Мужской</option><option>Женский</option></select></label>
                <label className="field"><span>Страна</span><select value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })}><option value="all">Все страны</option>{countries.map((country) => <option key={country}>{country}</option>)}</select></label>
                <button className="button button-soft toolbar-clear" type="button" onClick={() => setFilters({ search: "", gender: "all", country: "all" })}>Очистить фильтры</button>
                <strong className="toolbar-count">Показано: {visibleParticipants.length} из {participants.length}</strong>
              </div>
              {loading ? <p className="loading-state">Загрузка участников...</p> : visibleParticipants.length === 0 ? <div className="empty-state"><h2>{participants.length ? "Ничего не найдено" : "Пока нет участников"}</h2><p>{participants.length ? "Измените параметры поиска или очистите фильтры." : "Откройте регистрацию и сохраните первого участника."}</p></div> : (
                <div className="table-wrap"><table><thead><tr><th>Фото</th>{[["fullName","ФИО"],["gender","Пол"],["country","Страна"],["bmi","BMI"],["calories","Калории"]].map(([key,label]) => <th key={key}><button className={`sort-button ${sort.key === key ? "is-active" : ""}`} type="button" onClick={() => toggleSort(key)}>{label} <span className="sort-indicator">{sortArrow(key)}</span></button></th>)}<th>Дата рождения</th><th>Email</th><th>Телефон</th><th>Рост</th><th>Вес</th><th>Категория</th><th>Действия</th></tr></thead><tbody>{visibleParticipants.map((participant) => <tr key={participant.id}><td>{participant.photo?.dataUrl ? <img className="participant-photo" src={participant.photo.dataUrl} alt="" /> : <span className="participant-photo photo-empty">-</span>}</td><td>{fullName(participant)}</td><td>{participant.gender}</td><td>{participant.country}</td><td>{participant.bmi.toFixed(1)}</td><td>{participant.calories} ккал</td><td>{formatDate(participant.birthDate)}</td><td>{participant.email}</td><td>{participant.phone}</td><td>{participant.heightCm} см</td><td>{participant.weightKg} кг</td><td>{getBmiVisual(participant.bmi).label}</td><td><div className="table-actions"><button className="button button-soft" type="button" onClick={() => editParticipant(participant)}>Изменить</button><button className="button button-danger" type="button" onClick={() => deleteParticipant(participant)}>Удалить</button></div></td></tr>)}</tbody></table></div>
              )}
            </section>
          </section>
        )}
      </main>
      <a className="support-fab" href={supportUrl} target="_blank" rel="noreferrer" aria-label="Открыть техподдержку в Telegram">Техподдержка</a>
      <footer className="countdown-bar"><span>До марафона:</span><Countdown /></footer>
    </div>
  );
}
