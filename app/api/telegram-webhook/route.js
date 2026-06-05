import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

function getMessage(update) {
  return update?.message || update?.edited_message || null;
}

function normalizeSurname(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function isTelegramSecretValid(request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${details}`);
  }
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
    if (!text || text.startsWith("/start")) {
      await sendTelegramMessage(chatId, "Отправьте фамилию участника, например: Иванов. Команда /example покажет фамилию из базы.");
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
