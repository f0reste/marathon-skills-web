export function participantFromRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    birthDate: row.birth_date instanceof Date ? row.birth_date.toISOString().slice(0, 10) : String(row.birth_date),
    email: row.email,
    phone: row.phone,
    country: row.country,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    bmi: Number(row.bmi),
    calories: Number(row.calories),
    photo: row.photo_data_url ? { name: row.photo_name, dataUrl: row.photo_data_url } : null,
    registeredAt: row.registered_at
  };
}
