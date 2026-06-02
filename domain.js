(() => {
  "use strict";

  const STORAGE_KEY = "marathon-skills-participants-v2";
  const LEGACY_STORAGE_KEY = "marathon-skills-participants-v1";
  const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function pluralize(value, forms) {
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

  function fullName(participant) {
    return `${participant.lastName} ${participant.firstName}`.trim();
  }

  function calculateAge(birthDate, now = new Date()) {
    if (!birthDate) return null;
    const birth = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(birth.getTime()) || birth > now) return null;
    let age = now.getFullYear() - birth.getFullYear();
    const monthDifference = now.getMonth() - birth.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  function safePhotoDataUrl(value) {
    return typeof value === "string" && /^data:image\/(jpeg|png|bmp);base64,/i.test(value);
  }

  function normalizeParticipant(participant) {
    return {
      calories: null,
      ...participant,
      photo: participant.photo && safePhotoDataUrl(participant.photo.dataUrl) ? participant.photo : null
    };
  }

  class ParticipantStore {
    #participants;

    constructor(storage = window.localStorage) {
      this.storage = storage;
      this.#participants = this.#load();
    }

    get count() {
      return this.#participants.length;
    }

    getAll() {
      return clone(this.#participants);
    }

    findById(id) {
      return clone(this.#participants.find((participant) => participant.id === id) || null);
    }

    upsert(participant) {
      const normalized = normalizeParticipant(participant);
      const index = this.#participants.findIndex((item) => item.id === normalized.id);
      if (index >= 0) this.#participants[index] = normalized;
      else this.#participants.push(normalized);
      this.#save();
      return clone(normalized);
    }

    remove(id) {
      const nextParticipants = this.#participants.filter((participant) => participant.id !== id);
      const changed = nextParticipants.length !== this.#participants.length;
      this.#participants = nextParticipants;
      if (changed) this.#save();
      return changed;
    }

    listCountries() {
      return [...new Set(this.#participants.map((participant) => participant.country).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ru"));
    }

    query({ search = "", gender = "all", country = "all", sortKey = "fullName", sortDirection = "asc" } = {}) {
      const searchToken = search.trim().toLocaleLowerCase("ru");
      const direction = sortDirection === "desc" ? -1 : 1;

      return clone(this.#participants
        .filter((participant) => {
          const matchesSearch = !searchToken ||
            fullName(participant).toLocaleLowerCase("ru").includes(searchToken) ||
            participant.email.toLocaleLowerCase("ru").includes(searchToken) ||
            participant.country.toLocaleLowerCase("ru").includes(searchToken);
          const matchesGender = gender === "all" || participant.gender === gender;
          const matchesCountry = country === "all" || participant.country === country;
          return matchesSearch && matchesGender && matchesCountry;
        })
        .sort((left, right) => {
          const leftValue = this.#sortValue(left, sortKey);
          const rightValue = this.#sortValue(right, sortKey);
          if (typeof leftValue === "number" && typeof rightValue === "number") {
            return (leftValue - rightValue) * direction;
          }
          return String(leftValue).localeCompare(String(rightValue), "ru", { sensitivity: "base" }) * direction;
        }));
    }

    #sortValue(participant, sortKey) {
      if (sortKey === "fullName") return fullName(participant);
      if (sortKey === "bmi" || sortKey === "calories") return participant[sortKey] ?? -1;
      return participant[sortKey] ?? "";
    }

    #load() {
      try {
        const saved = this.storage.getItem(STORAGE_KEY) || this.storage.getItem(LEGACY_STORAGE_KEY);
        const participants = JSON.parse(saved || "[]");
        return Array.isArray(participants) ? participants.map(normalizeParticipant) : [];
      } catch {
        return [];
      }
    }

    #save() {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.#participants));
    }
  }

  class BmiCalculator {
    static calculate({ heightCm, weightKg, gender, birthDate }) {
      const validationError = this.validate(heightCm, weightKg);
      if (validationError) return { ok: false, error: validationError };

      const heightMeters = heightCm / 100;
      const bmi = weightKg / (heightMeters * heightMeters);
      const age = calculateAge(birthDate);
      const calories = this.calculateCalories({ heightCm, weightKg, gender, age });

      return {
        ok: true,
        bmi,
        calories,
        age,
        visual: this.getVisual(bmi),
        calorieNote: calories
          ? "Расчет основного обмена учитывает рост, вес, возраст и пол участника."
          : "Для расчета калорий укажите дату рождения и выберите мужской или женский пол."
      };
    }

    static validate(heightCm, weightKg) {
      if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
        return "Введите положительные числовые значения роста и веса.";
      }
      if (heightCm < 80 || heightCm > 250) return "Рост должен быть в диапазоне от 80 до 250 см.";
      if (weightKg < 20 || weightKg > 300) return "Вес должен быть в диапазоне от 20 до 300 кг.";
      return "";
    }

    static calculateCalories({ heightCm, weightKg, gender, age }) {
      if (!Number.isFinite(age) || age < 10 || age > 120) return null;
      if (gender !== "Мужской" && gender !== "Женский") return null;
      const genderOffset = gender === "Мужской" ? 5 : -161;
      return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset);
    }

    static getVisual(bmi) {
      if (bmi < 18.5) return { label: "Недостаточный вес", color: "#6ec5e9", className: "is-low" };
      if (bmi < 25) return { label: "Норма", color: "#7fcf8a", className: "is-normal" };
      if (bmi < 30) return { label: "Избыточный вес", color: "#f3c969", className: "is-high" };
      return { label: "Ожирение", color: "#e9776b", className: "is-obesity" };
    }
  }

  class PhotoValidator {
    static validate(file) {
      if (!file) return { ok: false, error: "Файл фотографии не выбран." };
      const allowedTypes = new Set(["image/jpeg", "image/png", "image/bmp"]);
      if (!allowedTypes.has(file.type)) return { ok: false, error: "Выберите изображение JPG, PNG или BMP." };
      if (file.size <= 0) return { ok: false, error: "Выбранный файл фотографии пуст." };
      if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "Размер фотографии не должен превышать 2 МБ." };
      return { ok: true };
    }
  }

  class CountdownTimer {
    #intervalId = null;

    constructor(onTick) {
      this.onTick = onTick;
    }

    start() {
      if (this.#intervalId !== null) return;
      this.#emit();
      this.#intervalId = window.setInterval(() => this.#emit(), 1000);
    }

    stop() {
      if (this.#intervalId === null) return;
      window.clearInterval(this.#intervalId);
      this.#intervalId = null;
    }

    #emit() {
      this.onTick(CountdownTimer.createText());
    }

    static createText(now = new Date()) {
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
  }

  class RegistrationSession {
    #editingId = null;
    #selectedPhoto = null;
    #draftParticipant = null;
    #draftResult = null;

    startNew() {
      this.clear();
    }

    startEdit(participant) {
      this.#editingId = participant.id;
      this.#selectedPhoto = participant.photo || null;
      this.#draftParticipant = clone(participant);
      this.#draftResult = participant.bmi
        ? {
            ok: true,
            bmi: participant.bmi,
            calories: participant.calories,
            visual: BmiCalculator.getVisual(participant.bmi),
            calorieNote: participant.calories
              ? "Расчет основного обмена учитывает рост, вес, возраст и пол участника."
              : "Для расчета калорий укажите дату рождения и выберите мужской или женский пол."
          }
        : null;
    }

    prepareDraft(fields, previousParticipant = null) {
      const participant = {
        id: this.#editingId || crypto.randomUUID(),
        ...fields,
        photo: this.#selectedPhoto,
        heightCm: previousParticipant?.heightCm ?? null,
        weightKg: previousParticipant?.weightKg ?? null,
        bmi: previousParticipant?.bmi ?? null,
        calories: previousParticipant?.calories ?? null,
        registeredAt: previousParticipant?.registeredAt || new Date().toISOString()
      };
      this.#draftParticipant = participant;
      return clone(participant);
    }

    setPhoto(photo) {
      this.#selectedPhoto = clone(photo);
      if (this.#draftParticipant) this.#draftParticipant.photo = clone(photo);
    }

    clearPhoto() {
      this.#selectedPhoto = null;
      if (this.#draftParticipant) this.#draftParticipant.photo = null;
    }

    applyMetrics(heightCm, weightKg, result) {
      if (!this.#draftParticipant) return;
      this.#draftParticipant.heightCm = heightCm;
      this.#draftParticipant.weightKg = weightKg;
      this.#draftParticipant.bmi = result.bmi;
      this.#draftParticipant.calories = result.calories;
      this.#draftResult = clone(result);
    }

    getSnapshot() {
      return {
        editingId: this.#editingId,
        selectedPhoto: clone(this.#selectedPhoto),
        draftParticipant: clone(this.#draftParticipant),
        draftResult: clone(this.#draftResult)
      };
    }

    complete() {
      const participant = clone(this.#draftParticipant);
      this.clear();
      return participant;
    }

    clear() {
      this.#editingId = null;
      this.#selectedPhoto = null;
      this.#draftParticipant = null;
      this.#draftResult = null;
    }
  }

  class AppState {
    #store = new ParticipantStore();
    #session = new RegistrationSession();
    #page = "home";
    #filters = { search: "", gender: "all", country: "all" };
    #sort = { sortKey: "fullName", sortDirection: "asc" };
    #pendingDeleteId = null;

    navigate(page) {
      this.#page = page;
      return this.#page;
    }

    startNewRegistration() {
      this.#session.startNew();
    }

    startEditing(id) {
      const participant = this.#store.findById(id);
      if (!participant) return null;
      this.#session.startEdit(participant);
      return this.#session.getSnapshot();
    }

    prepareBmi(fields) {
      const error = this.#validateRegistration(fields);
      if (error) return { ok: false, error };
      const snapshot = this.#session.getSnapshot();
      const previous = snapshot.editingId ? this.#store.findById(snapshot.editingId) : null;
      return { ok: true, participant: this.#session.prepareDraft(fields, previous) };
    }

    calculateMetrics(heightCm, weightKg) {
      const snapshot = this.#session.getSnapshot();
      if (!snapshot.draftParticipant) return { ok: false, error: "Сначала выберите участника." };
      const result = BmiCalculator.calculate({
        heightCm,
        weightKg,
        gender: snapshot.draftParticipant.gender,
        birthDate: snapshot.draftParticipant.birthDate
      });
      if (result.ok) this.#session.applyMetrics(heightCm, weightKg, result);
      return result;
    }

    saveDraft() {
      const participant = this.#session.complete();
      if (!participant?.bmi) return null;
      return this.#store.upsert(participant);
    }

    setSelectedPhoto(photo) {
      this.#session.setPhoto(photo);
    }

    clearSelectedPhoto() {
      this.#session.clearPhoto();
    }

    requestDelete(id) {
      const participant = this.#store.findById(id);
      this.#pendingDeleteId = participant ? id : null;
      return participant;
    }

    confirmDelete() {
      if (!this.#pendingDeleteId) return false;
      const changed = this.#store.remove(this.#pendingDeleteId);
      this.#pendingDeleteId = null;
      return changed;
    }

    cancelDelete() {
      this.#pendingDeleteId = null;
    }

    setFilters(filters) {
      this.#filters = { ...this.#filters, ...filters };
    }

    clearFilters() {
      this.#filters = { search: "", gender: "all", country: "all" };
    }

    toggleSort(sortKey) {
      const sortDirection = this.#sort.sortKey === sortKey && this.#sort.sortDirection === "asc" ? "desc" : "asc";
      this.#sort = { sortKey, sortDirection };
    }

    getViewModel() {
      return {
        page: this.#page,
        participantsCount: this.#store.count,
        participants: this.#store.query({ ...this.#filters, ...this.#sort }),
        countries: this.#store.listCountries(),
        filters: { ...this.#filters },
        sort: { ...this.#sort },
        session: this.#session.getSnapshot()
      };
    }

    #validateRegistration(fields) {
      if (!fields.firstName || !fields.lastName || !fields.email || !fields.phone || !fields.country || !fields.birthDate) {
        return "Заполните все обязательные поля регистрации.";
      }
      if (!fields.email.includes("@") || !fields.email.includes(".")) return "Введите корректный email.";
      if (!calculateAge(fields.birthDate)) return "Укажите корректную дату рождения участника.";
      return "";
    }
  }

  window.MarathonSkillsDomain = Object.freeze({
    AppState,
    BmiCalculator,
    CountdownTimer,
    PhotoValidator,
    fullName,
    pluralize,
    safePhotoDataUrl
  });
})();
