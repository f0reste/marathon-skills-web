const STORAGE_KEY = "marathon-skills-participants-v1";
const pages = [...document.querySelectorAll("[data-page]")];
const pageLinks = [...document.querySelectorAll("[data-page-link]")];
const registrationForm = document.querySelector("#registration-form");
const bmiForm = document.querySelector("#bmi-form");
const photoInput = document.querySelector("#photo-input");
const photoPreview = document.querySelector("#photo-preview");
const photoPlaceholder = document.querySelector("#photo-placeholder");
const photoFilename = document.querySelector("#photo-filename");
const participantsBody = document.querySelector("#participants-body");
const participantsTableWrap = document.querySelector("#participants-table-wrap");
const emptyState = document.querySelector("#empty-state");
const confirmDialog = document.querySelector("#confirm-dialog");
const person = document.querySelector("#bmi-person");
const scaleMarker = document.querySelector("#bmi-scale-marker");

let participants = loadParticipants();
let selectedPhoto = null;
let draftParticipant = null;
let editingId = null;
let pendingDeleteId = null;
let draftBmi = null;

pageLinks.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.pageLink;
    if (target === "registration" && button.closest(".topbar, .hero")) {
      startNewRegistration();
    }
    showPage(target);
  });
});

registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const error = document.querySelector("#registration-error");
  error.textContent = "";

  const participant = {
    id: editingId || crypto.randomUUID(),
    firstName: valueOf("#first-name"),
    lastName: valueOf("#last-name"),
    gender: valueOf("#gender"),
    birthDate: valueOf("#birth-date"),
    email: valueOf("#email"),
    phone: valueOf("#phone"),
    country: valueOf("#country"),
    photo: selectedPhoto,
    heightCm: null,
    weightKg: null,
    bmi: null,
    registeredAt: editingId ? findParticipant(editingId)?.registeredAt : new Date().toISOString()
  };

  if (!participant.firstName || !participant.lastName || !participant.email || !participant.phone || !participant.country) {
    error.textContent = "Заполните все обязательные поля регистрации.";
    return;
  }

  if (!participant.email.includes("@") || !participant.email.includes(".")) {
    error.textContent = "Введите корректный email.";
    return;
  }

  const previous = editingId ? findParticipant(editingId) : null;
  if (previous) {
    participant.heightCm = previous.heightCm;
    participant.weightKg = previous.weightKg;
    participant.bmi = previous.bmi;
  }

  draftParticipant = participant;
  draftBmi = participant.bmi;
  document.querySelector("#height").value = participant.heightCm ?? "";
  document.querySelector("#weight").value = participant.weightKg ?? "";
  document.querySelector("#current-runner").textContent = `Участник: ${fullName(participant)}`;
  updateBmiResult(participant.bmi);
  showPage("bmi");
});

document.querySelector("#calculate-bmi-button").addEventListener("click", calculateBmi);

bmiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!draftParticipant || !calculateBmi()) return;

  draftParticipant.heightCm = numberValue("#height");
  draftParticipant.weightKg = numberValue("#weight");
  draftParticipant.bmi = draftBmi;

  const index = participants.findIndex((participant) => participant.id === draftParticipant.id);
  if (index >= 0) participants[index] = draftParticipant;
  else participants.push(draftParticipant);

  saveParticipants();
  resetDraft();
  renderParticipants();
  showPage("participants");
});

document.querySelector("#select-photo-button").addEventListener("click", () => photoInput.click());
document.querySelector("#clear-photo-button").addEventListener("click", () => {
  selectedPhoto = null;
  photoInput.value = "";
  renderPhotoPreview();
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    document.querySelector("#registration-error").textContent = "Выберите изображение JPG, PNG или BMP.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    selectedPhoto = { name: file.name, dataUrl: reader.result };
    renderPhotoPreview();
  });
  reader.readAsDataURL(file);
});

document.querySelector("#cancel-delete").addEventListener("click", closeDeleteDialog);
document.querySelector("#confirm-delete").addEventListener("click", () => {
  if (!pendingDeleteId) return;
  participants = participants.filter((participant) => participant.id !== pendingDeleteId);
  saveParticipants();
  closeDeleteDialog();
  renderParticipants();
});

function showPage(pageName) {
  pages.forEach((page) => {
    const active = page.dataset.page === pageName;
    page.hidden = !active;
    page.classList.toggle("is-active", active);
  });
  if (pageName === "participants") renderParticipants();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startNewRegistration() {
  registrationForm.reset();
  editingId = null;
  selectedPhoto = null;
  resetDraft();
  renderPhotoPreview();
  document.querySelector("#registration-error").textContent = "";
  document.querySelector("#registration-title").textContent = "Регистрация бегуна";
  document.querySelector("#registration-subtitle").textContent = "Добавьте основную информацию о себе. Следующий шаг - расчет BMI.";
  document.querySelector("#continue-bmi-button").textContent = "Перейти к BMI";
}

function editParticipant(id) {
  const participant = findParticipant(id);
  if (!participant) return;

  editingId = participant.id;
  selectedPhoto = participant.photo || null;
  setValue("#first-name", participant.firstName);
  setValue("#last-name", participant.lastName);
  setValue("#gender", participant.gender);
  setValue("#birth-date", participant.birthDate);
  setValue("#email", participant.email);
  setValue("#phone", participant.phone);
  setValue("#country", participant.country);
  renderPhotoPreview();

  document.querySelector("#registration-title").textContent = "Редактирование участника";
  document.querySelector("#registration-subtitle").textContent = "Измените данные участника и снова сохраните BMI.";
  document.querySelector("#continue-bmi-button").textContent = "Сохранить через BMI";
  showPage("registration");
}

function requestDelete(id) {
  const participant = findParticipant(id);
  if (!participant) return;
  pendingDeleteId = id;
  document.querySelector("#dialog-text").textContent = `Удалить участника ${fullName(participant)}?`;
  confirmDialog.hidden = false;
}

function closeDeleteDialog() {
  pendingDeleteId = null;
  confirmDialog.hidden = true;
}

function calculateBmi() {
  const heightCm = numberValue("#height");
  const weightKg = numberValue("#weight");
  const error = document.querySelector("#bmi-error");
  error.textContent = "";

  if (!heightCm || !weightKg) {
    error.textContent = "Введите положительные числовые значения роста и веса.";
    return false;
  }
  if (heightCm < 80 || heightCm > 250) {
    error.textContent = "Рост должен быть в диапазоне от 80 до 250 см.";
    return false;
  }
  if (weightKg < 20 || weightKg > 300) {
    error.textContent = "Вес должен быть в диапазоне от 20 до 300 кг.";
    return false;
  }

  const heightMeters = heightCm / 100;
  draftBmi = weightKg / (heightMeters * heightMeters);
  updateBmiResult(draftBmi);
  return true;
}

function updateBmiResult(bmi) {
  const bmiValue = document.querySelector("#bmi-value");
  const bmiCategory = document.querySelector("#bmi-category");
  const minimum = 12;
  const maximum = 40;

  person.className = "person";
  if (!bmi) {
    bmiValue.textContent = "--";
    bmiCategory.textContent = "Введите рост и вес";
    person.style.setProperty("--person-color", "#ccf1e1");
    scaleMarker.style.left = "0%";
    scaleMarker.style.opacity = ".45";
    return;
  }

  const visual = bmiVisual(bmi);
  bmiValue.textContent = bmi.toFixed(1);
  bmiCategory.textContent = visual.label;
  person.classList.add(visual.className);
  person.style.setProperty("--person-color", visual.color);

  const clamped = Math.min(maximum, Math.max(minimum, bmi));
  scaleMarker.style.left = `calc(${((clamped - minimum) / (maximum - minimum)) * 100}% - 2px)`;
  scaleMarker.style.opacity = "1";
}

function bmiVisual(bmi) {
  if (bmi < 18.5) return { label: "Недостаточный вес", color: "#6ec5e9", className: "is-low" };
  if (bmi < 25) return { label: "Норма", color: "#7fcf8a", className: "is-normal" };
  if (bmi < 30) return { label: "Избыточный вес", color: "#f3c969", className: "is-high" };
  return { label: "Ожирение", color: "#e9776b", className: "is-obesity" };
}

function renderParticipants() {
  document.querySelector("#home-participant-count").textContent = countLabel(participants.length);
  document.querySelector("#participants-subtitle").textContent = participants.length
    ? `Всего участников: ${participants.length}`
    : "Зарегистрированные бегуны появятся здесь";

  emptyState.hidden = participants.length > 0;
  participantsTableWrap.hidden = participants.length === 0;
  participantsBody.replaceChildren();

  participants.forEach((participant) => {
    const row = document.createElement("tr");
    const photo = participant.photo?.dataUrl
      ? `<img class="participant-photo" src="${participant.photo.dataUrl}" alt="Фото ${escapeHtml(fullName(participant))}">`
      : `<span class="participant-photo photo-empty" aria-label="Фото отсутствует">-</span>`;

    row.innerHTML = `
      <td>${photo}</td>
      <td>${escapeHtml(fullName(participant))}</td>
      <td>${escapeHtml(participant.gender)}</td>
      <td>${escapeHtml(formatDate(participant.birthDate))}</td>
      <td>${escapeHtml(participant.country)}</td>
      <td>${escapeHtml(participant.email)}</td>
      <td>${escapeHtml(participant.phone)}</td>
      <td>${participant.heightCm ? `${participant.heightCm} см` : "-"}</td>
      <td>${participant.weightKg ? `${participant.weightKg} кг` : "-"}</td>
      <td>${participant.bmi ? participant.bmi.toFixed(1) : "Не рассчитан"}</td>
      <td>${participant.bmi ? bmiVisual(participant.bmi).label : "Не рассчитан"}</td>
      <td>
        <div class="table-actions">
          <button class="button button-soft edit-button" type="button">Изменить</button>
          <button class="button button-light delete-button" type="button">Удалить</button>
        </div>
      </td>
    `;
    row.querySelector(".edit-button").addEventListener("click", () => editParticipant(participant.id));
    row.querySelector(".delete-button").addEventListener("click", () => requestDelete(participant.id));
    participantsBody.append(row);
  });
}

function renderPhotoPreview() {
  if (selectedPhoto?.dataUrl) {
    photoPreview.src = selectedPhoto.dataUrl;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    photoFilename.textContent = selectedPhoto.name;
  } else {
    photoPreview.removeAttribute("src");
    photoPreview.hidden = true;
    photoPlaceholder.hidden = false;
    photoFilename.textContent = "JPG, PNG, BMP";
  }
}

function resetDraft() {
  draftParticipant = null;
  draftBmi = null;
  document.querySelector("#height").value = "";
  document.querySelector("#weight").value = "";
  document.querySelector("#bmi-error").textContent = "";
  document.querySelector("#current-runner").textContent = "Участник не выбран";
  updateBmiResult(null);
}

function updateCountdown() {
  const now = new Date();
  let target = new Date(now.getFullYear(), 5, 15, 9, 0, 0);
  if (now > target) target = new Date(now.getFullYear() + 1, 5, 15, 9, 0, 0);

  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  document.querySelector("#countdown").textContent =
    `${days} дн. ${pad(hours)} ч. ${pad(minutes)} мин. ${pad(seconds)} сек. до старта 15 июня`;
}

function saveParticipants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
}

function loadParticipants() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function countLabel(count) {
  if (count === 1) return "1 бегун";
  if (count >= 2 && count <= 4) return `${count} бегуна`;
  return `${count} бегунов`;
}

function fullName(participant) {
  return `${participant.lastName} ${participant.firstName}`;
}

function findParticipant(id) {
  return participants.find((participant) => participant.id === id);
}

function formatDate(value) {
  if (!value) return "Не указана";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function valueOf(selector) {
  return document.querySelector(selector).value.trim();
}

function setValue(selector, value) {
  document.querySelector(selector).value = value || "";
}

function numberValue(selector) {
  return Number.parseFloat(document.querySelector(selector).value.replace(",", "."));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderParticipants();
renderPhotoPreview();
resetDraft();
updateCountdown();
setInterval(updateCountdown, 1000);
