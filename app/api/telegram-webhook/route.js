import { getDb } from "../../../lib/db";
import { validateParticipantInput } from "../../../lib/domain";

export const runtime = "nodejs";

const siteUrl = "https://marathon-skills-web-three.vercel.app";

const mainKeyboard = {
  keyboard: [
    [{ text: "🏃 О марафоне" }, { text: "📅 Дата и место" }],
    [{ text: "🏅 Дистанции" }, { text: "👥 Участники" }],
    [{ text: "🔍 Найти участника" }, { text: "🌐 Открыть сайт" }],
    [{ text: "➕ Добавить участника" }],
    [{ text: "💬 Техподдержка" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const marathonReply = [
  "🏃 Marathon Skills",
  "",
  "Marathon Skills — ежегодный марафон для участников разных дистанций.",
  "На сайте можно зарегистрировать участника, рассчитать ИМТ и сохранить данные в базе.",
  "",
  `Сайт: ${siteUrl}`
].join("\n");

const datePlaceReply = [
  "📅 Дата: 15 июня 2026 года",
  "",
  "📍 Место: Алматы, Казахстан",
  "⛰ У подножия Заилийского Алатау",
  "⏰ Старт в 07:00 утра"
].join("\n");

const distancesReply = [
  "🏅 Дистанции марафона:",
  "",
  "🥇 Полный марафон — 42.195 км",
  "🥈 Полумарафон — 21 км",
  "🥉 Забег — 10 км",
  "🧒 Детский забег — 2 км"
].join("\n");

const supportReply = [
  "💬 Техподдержка Marathon Skills",
  "",
  "Задайте вопрос прямо в этом чате.",
  "Instagram: https://instagram.com/nikitagrech_",
  "Telegram: @Marathon432bot"
].join("\n");

const addParticipantTemplate = [
  "➕ Добавление участника в базу",
  "",
  "Скопируйте шаблон, заполните значения и отправьте одним сообщением:",
  "",
  "Добавить участника",
  "Фамилия: Иванов",
  "Имя: Иван",
  "Пол: Мужской",
  "Дата рождения: 2000-01-31",
  "Email: ivanov@example.com",
  "Телефон: +77001234567",
  "Страна: Казахстан",
  "Рост: 180",
  "Вес: 75"
].join("\n");

function getMessage(update) {
  return update?.message || update?.edited_message || null;
}

function normalizeSurname(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normalizedText(text) {
  return String(text || "").toLocaleLowerCase("ru");
}

function isButton(text, words) {
  const normalized = normalizedText(text);
  return words.some((word) => normalized.includes(word));
}

function isSupportRequest(text) {
  const normalized = normalizedText(text);
  return normalized === "/support"
    || normalized === "/start support"
    || normalized.includes("support")
    || normalized.includes("поддерж")
    || normalized.includes("соц")
    || normalized.includes("instagram")
    || normalized.includes("инст");
}

function isAddParticipantRequest(text) {
  return isButton(text, ["добавить участника"]) || normalizedText(text).startsWith("добавить участника");
}

function normalizeGender(value) {
  const normalized = normalizedText(value);
  if (normalized.startsWith("м")) return "Мужской";
  if (normalized.startsWith("ж")) return "Женский";
  return value;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (!match) return text;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseParticipantForm(text) {
  const fieldMap = new Map([
    ["фамилия", "lastName"],
    ["имя", "firstName"],
    ["пол", "gender"],
    ["дата рождения", "birthDate"],
    ["дата", "birthDate"],
    ["email", "email"],
    ["почта", "email"],
    ["телефон", "phone"],
    ["страна", "country"],
    ["рост", "heightCm"],
    ["вес", "weightKg"]
  ]);
  const result = {};

  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^\s*([^:：-]+)\s*[:：-]\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const label = normalizedText(match[1]).replace(/\s+/g, " ");
    const key = fieldMap.get(label);
    if (!key) continue;
    result[key] = match[2].trim();
  }

  if (result.gender) result.gender = normalizeGender(result.gender);
  if (result.birthDate) result.birthDate = normalizeDate(result.birthDate);
  return result;
}

function isTelegramSecretValid(request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

async function sendTelegramMessage(chatId, text, replyMarkup = mainKeyboard) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${details}`);
  }
}

async function getParticipantsSummary() {
  const sql = getDb();

  try {
    const [row] = await sql`
      select count(*)::int as total
      from telegram_lookup
    `;
    return Number(row?.total || 0);
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }

  const [row] = await sql`
    select count(*)::int as total
    from participants
  `;
  return Number(row?.total || 0);
}

async function createParticipantFromTelegram(chatId, form) {
  const validation = validateParticipantInput({ ...form, photo: null });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const sql = getDb();
  const participant = validation.participant;
  const [row] = await sql`
    insert into participants (
      user_id, first_name, last_name, gender, birth_date, email, phone, country,
      height_cm, weight_kg, bmi, calories, photo_name, photo_data_url
    ) values (
      ${`telegram:${chatId}`}, ${participant.firstName}, ${participant.lastName},
      ${participant.gender}, ${participant.birthDate}, ${participant.email},
      ${participant.phone}, ${participant.country}, ${participant.heightCm},
      ${participant.weightKg}, ${participant.bmi}, ${participant.calories},
      null, null
    )
    returning *
  `;

  return {
    ok: true,
    participant: {
      firstName: row.first_name,
      lastName: row.last_name,
      bmi: Number(row.bmi),
      calories: Number(row.calories)
    }
  };
}

async function findValueBySurname(surname) {
  const sql = getDb();

  try {
    const [row] = await sql`
      select value
      from telegram_lookup
      where lower(surname) = lower(${surname})
      limit 1
    `;
    return row?.value || null;
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }

  const [participant] = await sql`
    select concat('ИМТ ', round(bmi::numeric, 1), ', калории ', calories, ' ккал') as value
    from participants
    where lower(last_name) = lower(${surname})
    limit 1
  `;
  return participant?.value || null;
}

async function findExampleSurname() {
  const sql = getDb();

  try {
    const [row] = await sql`
      select surname
      from telegram_lookup
      where surname is not null and surname <> ''
      order by surname
      limit 1
    `;
    return row?.surname || null;
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }

  const [participant] = await sql`
    select last_name as surname
    from participants
    where last_name is not null and last_name <> ''
    order by last_name
    limit 1
  `;
  return participant?.surname || null;
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "/api/telegram-webhook",
    message: "Telegram webhook endpoint is ready."
  });
}

export async function POST(request) {
  if (!isTelegramSecretValid(request)) {
    return Response.json({ ok: false, error: "Invalid Telegram secret." }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const message = getMessage(update);
  const chatId = message?.chat?.id;
  const rawText = String(message?.text || "").trim();
  const text = normalizeSurname(rawText);

  if (!chatId) return Response.json({ ok: true });

  try {
    if (isSupportRequest(text)) {
      await sendTelegramMessage(chatId, supportReply);
      return Response.json({ ok: true });
    }

    if (!text || text.startsWith("/start")) {
      await sendTelegramMessage(chatId, "Выберите действие на клавиатуре ниже, отправьте фамилию участника или нажмите «➕ Добавить участника».");
      return Response.json({ ok: true });
    }

    if (isAddParticipantRequest(rawText)) {
      const form = parseParticipantForm(rawText);
      if (Object.keys(form).length < 9) {
        await sendTelegramMessage(chatId, addParticipantTemplate);
        return Response.json({ ok: true });
      }

      const created = await createParticipantFromTelegram(chatId, form);
      if (!created.ok) {
        await sendTelegramMessage(chatId, `Не удалось добавить участника: ${created.error}\n\n${addParticipantTemplate}`);
        return Response.json({ ok: true });
      }

      await sendTelegramMessage(chatId, [
        "✅ Участник добавлен в базу данных",
        "",
        `Фамилия: ${created.participant.lastName}`,
        `Имя: ${created.participant.firstName}`,
        `ИМТ: ${created.participant.bmi.toFixed(1)}`,
        `Калории: ${created.participant.calories} ккал`
      ].join("\n"));
      return Response.json({ ok: true });
    }

    if (isButton(text, ["марафон"])) {
      await sendTelegramMessage(chatId, marathonReply);
      return Response.json({ ok: true });
    }

    if (isButton(text, ["дата", "место"])) {
      await sendTelegramMessage(chatId, datePlaceReply);
      return Response.json({ ok: true });
    }

    if (isButton(text, ["дистанц"])) {
      await sendTelegramMessage(chatId, distancesReply);
      return Response.json({ ok: true });
    }

    if (isButton(text, ["участник"]) && !isButton(text, ["найти"])) {
      const total = await getParticipantsSummary();
      await sendTelegramMessage(chatId, [
        "👥 Участники марафона:",
        "",
        `📊 Всего зарегистрировано: ${total}`,
        `🏃 Бегунов: ${total}`,
        "📋 Координаторов: 0",
        "",
        "Для поиска конкретного участника нажмите «🔍 Найти участника» или напишите его фамилию."
      ].join("\n"));
      return Response.json({ ok: true });
    }

    if (isButton(text, ["найти"])) {
      await sendTelegramMessage(chatId, "🔍 Напишите фамилию участника, и я найду его в базе.\n\nНапример: Петров");
      return Response.json({ ok: true });
    }

    if (isButton(text, ["открыть сайт", "сайт"])) {
      await sendTelegramMessage(chatId, `🌐 Открыть сайт Marathon Skills:\n${siteUrl}`);
      return Response.json({ ok: true });
    }

    if (text === "/example") {
      const surname = await findExampleSurname();
      await sendTelegramMessage(chatId, surname ? `Пример фамилии из базы: ${surname}` : "В базе пока нет фамилий для примера.");
      return Response.json({ ok: true });
    }

    const value = await findValueBySurname(text);
    const reply = value
      ? `Фамилия ${text} → значение: ${value}`
      : `Фамилия «${text}» не найдена в базе`;

    await sendTelegramMessage(chatId, reply);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    await sendTelegramMessage(chatId, "Не удалось выполнить запрос к базе данных. Попробуйте позже.").catch(console.error);
    return Response.json({ ok: false }, { status: 200 });
  }
}
