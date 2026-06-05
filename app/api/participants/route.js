import { auth } from "../../../auth";
import { isAdminUser } from "../../../lib/authz";
import { getDb } from "../../../lib/db";
import { validateParticipantInput } from "../../../lib/domain";
import { participantFromRow } from "../../../lib/participants";
import { uploadParticipantPhoto } from "../../../lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Требуется авторизация." }, { status: 401 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  try {
    const sql = getDb();
    const rows = isAdminUser(session.user)
      ? await sql`
        select *
        from participants
        order by registered_at desc
      `
      : await sql`
        select *
        from participants
        where user_id = ${session.user.id}
        order by registered_at desc
      `;
    return Response.json(rows.map(participantFromRow));
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Не удалось загрузить участников из базы данных." }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const validation = validateParticipantInput(await request.json());
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

  try {
    const sql = getDb();
    const participant = validation.participant;
    const photo = await uploadParticipantPhoto(participant.photo, session.user.id);
    const [row] = await sql`
      insert into participants (
        user_id, first_name, last_name, gender, birth_date, email, phone, country,
        height_cm, weight_kg, bmi, calories, photo_name, photo_data_url
      ) values (
        ${session.user.id}, ${participant.firstName}, ${participant.lastName},
        ${participant.gender}, ${participant.birthDate}, ${participant.email},
        ${participant.phone}, ${participant.country}, ${participant.heightCm},
        ${participant.weightKg}, ${participant.bmi}, ${participant.calories},
        ${photo?.name || null}, ${photo?.dataUrl || null}
      )
      returning *
    `;
    return Response.json(participantFromRow(row), { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Не удалось сохранить участника в базе данных." }, { status: 500 });
  }
}
