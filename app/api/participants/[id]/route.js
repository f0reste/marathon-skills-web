import { auth } from "../../../../auth";
import { forbidden, isAdminUser } from "../../../../lib/authz";
import { getDb } from "../../../../lib/db";
import { validateParticipantInput } from "../../../../lib/domain";
import { participantFromRow } from "../../../../lib/participants";
import { uploadParticipantPhoto } from "../../../../lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Требуется авторизация." }, { status: 401 });
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  if (!isAdminUser(session.user)) return forbidden();

  const validation = validateParticipantInput(await request.json());
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

  try {
    const sql = getDb();
    const { id } = await params;
    const participant = validation.participant;
    const photo = await uploadParticipantPhoto(participant.photo, session.user.id);
    const [row] = await sql`
      update participants
      set first_name = ${participant.firstName},
          last_name = ${participant.lastName},
          gender = ${participant.gender},
          birth_date = ${participant.birthDate},
          email = ${participant.email},
          phone = ${participant.phone},
          country = ${participant.country},
          height_cm = ${participant.heightCm},
          weight_kg = ${participant.weightKg},
          bmi = ${participant.bmi},
          calories = ${participant.calories},
          photo_name = ${photo?.name || null},
          photo_data_url = ${photo?.dataUrl || null},
          updated_at = now()
      where id = ${id}
      returning *
    `;
    if (!row) return Response.json({ error: "Участник не найден." }, { status: 404 });
    return Response.json(participantFromRow(row));
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Не удалось обновить участника." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  if (!isAdminUser(session.user)) return forbidden();

  try {
    const sql = getDb();
    const { id } = await params;
    const rows = await sql`
      delete from participants
      where id = ${id}
      returning id
    `;
    if (!rows.length) return Response.json({ error: "Участник не найден." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Не удалось удалить участника." }, { status: 500 });
  }
}
