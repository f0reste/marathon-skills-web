import { getDb } from "../../../lib/db";
import { validateParticipantInput } from "../../../lib/domain";
import { uploadParticipantPhoto } from "../../../lib/storage";

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

const yesNoKeyboard = {
  keyboard: [
    [{ text: "✅ Да, сохранить" }, { text: "❌ Нет, заново" }],
    [{ text: "Отмена" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const cancelKeyboard = {
  keyboard: [[{ text: "Отмена" }]],
  resize_keyboard: true,
  is_persistent: true
};

const registrationSteps = [
  {
    key: "firstName",
    question: "Введите имя участника.\n\nФормат: Иван"
  },
  {
    key: "lastName",
    question: "Введите фамилию участника.\n\nФормат: Иванов"
  },
  {
    key: "gender",
    question: "Введите пол участника.\n\nФормат: Мужской или Женский"
  },
  {
    key: "birthDate",
    question: "Введите дату рождения.\n\nФормат: 2000-01-31 или 31.01.2000"
  },
  {
    key: "email",
    question: "Введите Email.\n\nФормат: ivanov@example.com"
  },
  {
    key: "phone",
    question: "Введите телефон.\n\nФормат: +7 700 123 45 67"
  },
  {
    key: "country",
    question: "Введите страну.\n\nФормат: Казахстан"
  },
  {
    key: "heightCm",
    question: "Введите рост в сантиметрах.\n\nФормат: 180"
  },
  {
    key: "weightKg",
    question: "Введите вес в килограммах.\n\nФормат: 75"
  },
  {
    key: "photo",
    question: "Отправьте фото участника.\n\nФормат: прикрепите изображение сообщением. Если фото нет, напишите: Пропустить"
  }
];

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

function getTelegramPhoto(message) {
  const photos = message?.photo;
  if (!Array.isArray(photos) || photos.length === 0) return null;
  return photos[photos.length - 1];
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

function isCancelRequest(text) {
  const normalized = normalizedText(text);
  return normalized === "отмена" || normalized === "/cancel" || normalized === "❌ нет, заново";
}

function isConfirmRequest(text) {
  const normalized = normalizedText(text);
  return normalized === "да" || normalized === "да, сохранить" || normalized === "✅ да, сохранить";
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

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }
  return token;
}

async function ensureDraftTable(sql) {
  await sql`
    create table if not exists telegram_registration_drafts (
      chat_id text primary key,
      step_index integer not null default 0,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
}

async function getDraft(chatId) {
  const sql = getDb();
  await ensureDraftTable(sql);
  const [row] = await sql`
    select chat_id, step_index, data
    from telegram_registration_drafts
    where chat_id = ${String(chatId)}
  `;
  return row ? { chatId: row.chat_id, stepIndex: row.step_index, data: row.data || {} } : null;
}

async function saveDraft(chatId, stepIndex, data) {
  const sql = getDb();
  await ensureDraftTable(sql);
  await sql`
    insert into telegram_registration_drafts (chat_id, step_index, data, updated_at)
    values (${String(chatId)}, ${stepIndex}, ${sql.json(data)}, now())
    on conflict (chat_id) do update
    set step_index = excluded.step_index,
        data = excluded.data,
        updated_at = now()
  `;
}

async function clearDraft(chatId) {
  const sql = getDb();
  await ensureDraftTable(sql);
  await sql`
    delete from telegram_registration_drafts
    where chat_id = ${String(chatId)}
  `;
}

async function downloadTelegramPhoto(photo) {
  if (!photo?.file_id) return null;

  const token = getBotToken();
  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${photo.file_id}`);
  const fileData = await fileResponse.json();
  if (!fileResponse.ok || !fileData?.ok || !fileData?.result?.file_path) {
    throw new Error("Telegram getFile failed.");
  }

  const imageResponse = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
  if (!imageResponse.ok) {
    throw new Error("Telegram photo download failed.");
  }

  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) {
    throw new Error("Фото слишком большое. Отправьте изображение до 2 МБ.");
  }

  return {
    name: `telegram-${Date.now()}.jpg`,
    dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`
  };
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
  const validation = validateParticipantInput(form);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const sql = getDb();
  const participant = validation.participant;
  const photo = await uploadParticipantPhoto(participant.photo, `telegram:${chatId}`);
  const [row] = await sql`
    insert into participants (
      user_id, first_name, last_name, gender, birth_date, email, phone, country,
      height_cm, weight_kg, bmi, calories, photo_name, photo_data_url
    ) values (
      ${`telegram:${chatId}`}, ${participant.firstName}, ${participant.lastName},
      ${participant.gender}, ${participant.birthDate}, ${participant.email},
      ${participant.phone}, ${participant.country}, ${participant.heightCm},
      ${participant.weightKg}, ${participant.bmi}, ${participant.calories},
      ${photo?.name || null}, ${photo?.dataUrl || null}
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

function buildConfirmation(data) {
  const validation = validateParticipantInput(data);
  if (!validation.ok) return { ok: false, error: validation.error };

  const participant = validation.participant;
  return {
    ok: true,
    text: [
      "Проверьте анкету:",
      "",
      `Фамилия: ${participant.lastName}`,
      `Имя: ${participant.firstName}`,
      `Пол: ${participant.gender}`,
      `Дата рождения: ${participant.birthDate}`,
      `Email: ${participant.email}`,
      `Телефон: ${participant.phone}`,
      `Страна: ${participant.country}`,
      `Рост: ${participant.heightCm} см`,
      `Вес: ${participant.weightKg} кг`,
      `Фото: ${participant.photo?.dataUrl ? "добавлено" : "не добавлено"}`,
      "",
      `ИМТ: ${participant.bmi.toFixed(1)}`,
      `Калории: ${participant.calories} ккал`,
      "",
      "Все верно?"
    ].join("\n")
  };
}

async function askCurrentStep(chatId, stepIndex) {
  const step = registrationSteps[stepIndex];
  await sendTelegramMessage(chatId, step.question, cancelKeyboard);
}

async function startRegistration(chatId) {
  await saveDraft(chatId, 0, {});
  await sendTelegramMessage(chatId, "Начинаем добавление участника. Ответьте на вопросы по очереди.", cancelKeyboard);
  await askCurrentStep(chatId, 0);
}

async function handleRegistrationDraft(chatId, rawText, message) {
  const draft = await getDraft(chatId);
  if (!draft) return false;

  if (isCancelRequest(rawText)) {
    await clearDraft(chatId);
    await sendTelegramMessage(chatId, "Анкета отменена. Можно начать заново через «➕ Добавить участника».");
    return true;
  }

  if (draft.stepIndex >= registrationSteps.length) {
    if (!isConfirmRequest(rawText)) {
      await sendTelegramMessage(chatId, "Ответьте «✅ Да, сохранить» или «❌ Нет, заново».", yesNoKeyboard);
      return true;
    }

    const created = await createParticipantFromTelegram(chatId, draft.data);
    if (!created.ok) {
      await clearDraft(chatId);
      await sendTelegramMessage(chatId, `Не удалось сохранить участника: ${created.error}\n\nНачните заново через «➕ Добавить участника».`);
      return true;
    }

    await clearDraft(chatId);
    await sendTelegramMessage(chatId, [
      "✅ Участник добавлен в базу данных",
      "",
      `Фамилия: ${created.participant.lastName}`,
      `Имя: ${created.participant.firstName}`,
      `ИМТ: ${created.participant.bmi.toFixed(1)}`,
      `Калории: ${created.participant.calories} ккал`
    ].join("\n"));
    return true;
  }

  const step = registrationSteps[draft.stepIndex];
  const data = { ...draft.data };

  if (step.key === "photo") {
    const photo = getTelegramPhoto(message);
    if (photo) {
      try {
        data.photo = await downloadTelegramPhoto(photo);
      } catch (error) {
        await sendTelegramMessage(chatId, error.message || "Не удалось обработать фото. Отправьте другое фото или напишите: Пропустить", cancelKeyboard);
        return true;
      }
    } else if (normalizedText(rawText) === "пропустить") {
      data.photo = null;
    } else {
      await sendTelegramMessage(chatId, "Отправьте фото изображением или напишите: Пропустить", cancelKeyboard);
      return true;
    }
  } else {
    if (!rawText) {
      await askCurrentStep(chatId, draft.stepIndex);
      return true;
    }
    data[step.key] = step.key === "gender" ? normalizeGender(rawText) : step.key === "birthDate" ? normalizeDate(rawText) : rawText;
  }

  const nextStepIndex = draft.stepIndex + 1;
  await saveDraft(chatId, nextStepIndex, data);

  if (nextStepIndex < registrationSteps.length) {
    await askCurrentStep(chatId, nextStepIndex);
    return true;
  }

  const confirmation = buildConfirmation(data);
  if (!confirmation.ok) {
    await clearDraft(chatId);
    await sendTelegramMessage(chatId, `В анкете ошибка: ${confirmation.error}\n\nНачните заново через «➕ Добавить участника».`);
    return true;
  }

  await sendTelegramMessage(chatId, confirmation.text, yesNoKeyboard);
  return true;
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

    if (await handleRegistrationDraft(chatId, rawText, message)) {
      return Response.json({ ok: true });
    }

    if (!text || text.startsWith("/start")) {
      await sendTelegramMessage(chatId, "Выберите действие на клавиатуре ниже, отправьте фамилию участника или нажмите «➕ Добавить участника».");
      return Response.json({ ok: true });
    }

    if (isAddParticipantRequest(rawText)) {
      await startRegistration(chatId);
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
