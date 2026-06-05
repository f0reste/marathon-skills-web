import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

const siteUrl = "https://marathon-skills-web-three.vercel.app";

const mainKeyboard = {
  keyboard: [
    [{ text: "🏃 О марафоне" }, { text: "📅 Дата и место" }],
    [{ text: "🏅 Дистанции" }, { text: "👥 Участники" }],
    [{ text: "🔍 Найти участника" }, { text: "🌐 Открыть сайт" }],
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
  const text = normalizeSurname(message?.text);

  if (!chatId) return Response.json({ ok: true });

  try {
    if (isSupportRequest(text)) {
      await sendTelegramMessage(chatId, supportReply);
      return Response.json({ ok: true });
    }

    if (!text || text.startsWith("/start")) {
      await sendTelegramMessage(chatId, "Выберите действие на клавиатуре ниже или отправьте фамилию участника.");
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
