const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function pluralize(value, forms) {
  const absolute = Math.abs(value) % 100;
  const lastDigit = absolute % 10;
  if (absolute > 10 && absolute < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

function formatTimePart(value, forms, padded = true) {
  const number = padded ? String(value).padStart(2, "0") : String(value);
  return `${number} ${pluralize(value, forms)}`;
}

export function createCountdownText(now = new Date()) {
  let target = new Date(now.getFullYear(), 5, 15, 9, 0, 0);
  if (now > target) target = new Date(now.getFullYear() + 1, 5, 15, 9, 0, 0);

  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    formatTimePart(days, ["день", "дня", "дней"], false),
    formatTimePart(hours, ["час", "часа", "часов"]),
    formatTimePart(minutes, ["минута", "минуты", "минут"]),
    formatTimePart(seconds, ["секунда", "секунды", "секунд"]),
    "до старта 15 июня"
  ].join(" ");
}

export function calculateAge(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDifference = now.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function getBmiVisual(bmi) {
  if (bmi < 18.5) return { label: "Недостаточный вес", className: "is-low", color: "#6ec5e9" };
  if (bmi < 25) return { label: "Норма", className: "is-normal", color: "#7fcf8a" };
  if (bmi < 30) return { label: "Избыточный вес", className: "is-high", color: "#f3c969" };
  return { label: "Ожирение", className: "is-obesity", color: "#e9776b" };
}

export function calculateMetrics({ heightCm, weightKg, gender, birthDate }) {
  const height = Number.parseFloat(heightCm);
  const weight = Number.parseFloat(weightKg);
  if (!Number.isFinite(height) || height < 80 || height > 250) {
    return { ok: false, error: "Укажите рост от 80 до 250 см." };
  }
  if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
    return { ok: false, error: "Укажите вес от 20 до 300 кг." };
  }

  const age = calculateAge(birthDate);
  if (!age) return { ok: false, error: "Укажите корректную дату рождения." };
  if (!["Мужской", "Женский"].includes(gender)) {
    return { ok: false, error: "Для расчета калорий выберите мужской или женский пол." };
  }

  const bmi = weight / ((height / 100) ** 2);
  const genderOffset = gender === "Мужской" ? 5 : -161;
  const calories = Math.round(10 * weight + 6.25 * height - 5 * age + genderOffset);
  return { ok: true, bmi, calories, visual: getBmiVisual(bmi) };
}

export function safePhotoDataUrl(value) {
  return typeof value === "string" && /^data:image\/(jpeg|png|bmp);base64,/i.test(value);
}

export function validatePhotoFile(file) {
  if (!file) return { ok: false, error: "Файл фотографии не выбран." };
  if (!["image/jpeg", "image/png", "image/bmp"].includes(file.type)) {
    return { ok: false, error: "Выберите изображение JPG, PNG или BMP." };
  }
  if (!file.size || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Размер фотографии не должен превышать 2 МБ." };
  }
  return { ok: true };
}

export function validateParticipantInput(input) {
  const required = ["firstName", "lastName", "gender", "birthDate", "email", "phone", "country", "heightCm", "weightKg"];
  if (required.some((field) => !String(input[field] ?? "").trim())) {
    return { ok: false, error: "Заполните все обязательные поля участника." };
  }
  if (!String(input.email).includes("@") || !String(input.email).includes(".")) {
    return { ok: false, error: "Введите корректный email." };
  }
  if (input.photo?.dataUrl && !safePhotoDataUrl(input.photo.dataUrl)) {
    return { ok: false, error: "Фотография имеет неподдерживаемый формат." };
  }
  if (input.photo?.dataUrl?.length > 2.9 * 1024 * 1024) {
    return { ok: false, error: "Размер фотографии не должен превышать 2 МБ." };
  }

  const metrics = calculateMetrics(input);
  if (!metrics.ok) return metrics;
  return {
    ok: true,
    participant: {
      firstName: String(input.firstName).trim(),
      lastName: String(input.lastName).trim(),
      gender: String(input.gender),
      birthDate: String(input.birthDate),
      email: String(input.email).trim(),
      phone: String(input.phone).trim(),
      country: String(input.country).trim(),
      heightCm: Number.parseFloat(input.heightCm),
      weightKg: Number.parseFloat(input.weightKg),
      bmi: metrics.bmi,
      calories: metrics.calories,
      photo: input.photo?.dataUrl ? {
        name: String(input.photo.name || "photo.jpg"),
        dataUrl: input.photo.dataUrl,
        width: Number.parseInt(input.photo.width, 10) || null,
        height: Number.parseInt(input.photo.height, 10) || null
      } : null
    }
  };
}

export function filterAndSortParticipants(participants, filters, sort) {
  const search = filters.search.trim().toLocaleLowerCase("ru");
  return participants
    .filter((participant) => {
      const haystack = `${participant.lastName} ${participant.firstName} ${participant.email} ${participant.country}`.toLocaleLowerCase("ru");
      return (!search || haystack.includes(search))
        && (filters.gender === "all" || participant.gender === filters.gender)
        && (filters.country === "all" || participant.country === filters.country);
    })
    .sort((left, right) => {
      const key = sort.key;
      const direction = sort.direction === "desc" ? -1 : 1;
      const leftValue = key === "fullName" ? `${left.lastName} ${left.firstName}` : left[key];
      const rightValue = key === "fullName" ? `${right.lastName} ${right.firstName}` : right[key];
      if (typeof leftValue === "number" && typeof rightValue === "number") return (leftValue - rightValue) * direction;
      return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "ru") * direction;
    });
}
