import "./domain.js";

const {
  AppState,
  BmiCalculator,
  CountdownTimer,
  PhotoValidator,
  fullName,
  safePhotoDataUrl
} = window.MarathonSkillsDomain;

const state = new AppState();
const ui = {
  pages: [...document.querySelectorAll("[data-page]")],
  pageLinks: [...document.querySelectorAll("[data-page-link]")],
  registrationForm: document.querySelector("#registration-form"),
  registrationError: document.querySelector("#registration-error"),
  registrationTitle: document.querySelector("#registration-title"),
  registrationSubtitle: document.querySelector("#registration-subtitle"),
  continueBmiButton: document.querySelector("#continue-bmi-button"),
  bmiForm: document.querySelector("#bmi-form"),
  bmiError: document.querySelector("#bmi-error"),
  currentRunner: document.querySelector("#current-runner"),
  height: document.querySelector("#height"),
  weight: document.querySelector("#weight"),
  bmiValue: document.querySelector("#bmi-value"),
  bmiCategory: document.querySelector("#bmi-category"),
  dailyCalories: document.querySelector("#daily-calories"),
  calorieNote: document.querySelector("#calorie-note"),
  person: document.querySelector("#bmi-person"),
  scaleMarker: document.querySelector("#bmi-scale-marker"),
  photoInput: document.querySelector("#photo-input"),
  photoPreview: document.querySelector("#photo-preview"),
  photoPlaceholder: document.querySelector("#photo-placeholder"),
  photoFilename: document.querySelector("#photo-filename"),
  participantsBody: document.querySelector("#participants-body"),
  participantsTableWrap: document.querySelector("#participants-table-wrap"),
  participantsSubtitle: document.querySelector("#participants-subtitle"),
  visibleParticipantCount: document.querySelector("#visible-participant-count"),
  homeParticipantCount: document.querySelector("#home-participant-count"),
  emptyState: document.querySelector("#empty-state"),
  emptyStateTitle: document.querySelector("#empty-state-title"),
  emptyStateText: document.querySelector("#empty-state-text"),
  participantSearch: document.querySelector("#participant-search"),
  genderFilter: document.querySelector("#gender-filter"),
  countryFilter: document.querySelector("#country-filter"),
  sortButtons: [...document.querySelectorAll("[data-sort-key]")],
  confirmDialog: document.querySelector("#confirm-dialog"),
  dialogText: document.querySelector("#dialog-text"),
  countdown: document.querySelector("#countdown")
};

ui.pageLinks.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.pageLink;
    if (target === "registration" && button.closest(".topbar, .hero")) startNewRegistration();
    showPage(target);
  });
});

ui.registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  ui.registrationError.textContent = "";
  const result = state.prepareBmi(readRegistrationForm());
  if (!result.ok) {
    ui.registrationError.textContent = result.error;
    return;
  }

  ui.height.value = result.participant.heightCm ?? "";
  ui.weight.value = result.participant.weightKg ?? "";
  ui.currentRunner.textContent = `Участник: ${fullName(result.participant)}`;
  renderBmiResult(state.getViewModel().session.draftResult);
  showPage("bmi");
});

document.querySelector("#calculate-bmi-button").addEventListener("click", calculateBmi);

ui.bmiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!calculateBmi()) return;
  state.saveDraft();
  resetBmiForm();
  renderParticipants();
  showPage("participants");
});

document.querySelector("#select-photo-button").addEventListener("click", () => ui.photoInput.click());
document.querySelector("#clear-photo-button").addEventListener("click", () => {
  state.clearSelectedPhoto();
  ui.photoInput.value = "";
  renderPhotoPreview();
});

ui.photoInput.addEventListener("change", () => {
  const file = ui.photoInput.files[0];
  const validation = PhotoValidator.validate(file);
  ui.registrationError.textContent = "";
  if (!validation.ok) {
    ui.photoInput.value = "";
    ui.registrationError.textContent = validation.error;
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.setSelectedPhoto({ name: file.name, dataUrl: reader.result });
    renderPhotoPreview();
  });
  reader.addEventListener("error", () => {
    state.clearSelectedPhoto();
    ui.registrationError.textContent = "Не удалось прочитать файл фотографии. Выберите другой файл.";
    renderPhotoPreview();
  });
  reader.readAsDataURL(file);
});

ui.photoPreview.addEventListener("error", () => {
  state.clearSelectedPhoto();
  ui.registrationError.textContent = "Файл фотографии поврежден или недоступен.";
  renderPhotoPreview();
});

ui.participantSearch.addEventListener("input", () => {
  state.setFilters({ search: ui.participantSearch.value });
  renderParticipants();
});

ui.genderFilter.addEventListener("change", () => {
  state.setFilters({ gender: ui.genderFilter.value });
  renderParticipants();
});

ui.countryFilter.addEventListener("change", () => {
  state.setFilters({ country: ui.countryFilter.value });
  renderParticipants();
});

document.querySelector("#clear-filters").addEventListener("click", () => {
  state.clearFilters();
  renderParticipants();
});

ui.sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.toggleSort(button.dataset.sortKey);
    renderParticipants();
  });
});

document.querySelector("#cancel-delete").addEventListener("click", closeDeleteDialog);
document.querySelector("#confirm-delete").addEventListener("click", () => {
  state.confirmDelete();
  closeDeleteDialog();
  renderParticipants();
});

function showPage(pageName) {
  state.navigate(pageName);
  ui.pages.forEach((page) => {
    const active = page.dataset.page === pageName;
    page.hidden = !active;
    page.classList.toggle("is-active", active);
  });
  if (pageName === "participants") renderParticipants();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startNewRegistration() {
  state.startNewRegistration();
  ui.registrationForm.reset();
  ui.registrationError.textContent = "";
  ui.registrationTitle.textContent = "Регистрация бегуна";
  ui.registrationSubtitle.textContent = "Добавьте основную информацию о себе. Следующий шаг - расчет BMI.";
  ui.continueBmiButton.textContent = "Перейти к BMI";
  renderPhotoPreview();
  resetBmiForm();
}

function editParticipant(id) {
  const snapshot = state.startEditing(id);
  if (!snapshot) return;
  const participant = snapshot.draftParticipant;
  setFormValue("firstName", participant.firstName);
  setFormValue("lastName", participant.lastName);
  setFormValue("gender", participant.gender);
  setFormValue("birthDate", participant.birthDate);
  setFormValue("email", participant.email);
  setFormValue("phone", participant.phone);
  setFormValue("country", participant.country);
  ui.registrationError.textContent = "";
  ui.registrationTitle.textContent = "Редактирование участника";
  ui.registrationSubtitle.textContent = "Измените данные участника и снова сохраните BMI.";
  ui.continueBmiButton.textContent = "Сохранить через BMI";
  renderPhotoPreview();
  showPage("registration");
}

function requestDelete(id) {
  const participant = state.requestDelete(id);
  if (!participant) return;
  ui.dialogText.textContent = `Удалить участника ${fullName(participant)}?`;
  ui.confirmDialog.hidden = false;
}

function closeDeleteDialog() {
  state.cancelDelete();
  ui.confirmDialog.hidden = true;
}

function calculateBmi() {
  ui.bmiError.textContent = "";
  const result = state.calculateMetrics(numberValue(ui.height), numberValue(ui.weight));
  if (!result.ok) {
    ui.bmiError.textContent = result.error;
    return false;
  }
  renderBmiResult(result);
  return true;
}

function renderBmiResult(result) {
  const minimum = 12;
  const maximum = 40;
  ui.person.className = "person";

  if (!result?.bmi) {
    ui.bmiValue.textContent = "--";
    ui.bmiCategory.textContent = "Введите рост и вес";
    ui.dailyCalories.textContent = "-- ккал/день";
    ui.calorieNote.textContent = "Расчет калорий учитывает пол и возраст участника.";
    ui.person.style.setProperty("--person-color", "#ccf1e1");
    ui.scaleMarker.style.left = "0%";
    ui.scaleMarker.style.opacity = ".45";
    return;
  }

  const visual = result.visual || BmiCalculator.getVisual(result.bmi);
  ui.bmiValue.textContent = result.bmi.toFixed(1);
  ui.bmiCategory.textContent = visual.label;
  ui.dailyCalories.textContent = result.calories ? `${result.calories} ккал/день` : "Недостаточно данных";
  ui.calorieNote.textContent = result.calorieNote;
  ui.person.classList.add(visual.className);
  ui.person.style.setProperty("--person-color", visual.color);

  const clamped = Math.min(maximum, Math.max(minimum, result.bmi));
  ui.scaleMarker.style.left = `calc(${((clamped - minimum) / (maximum - minimum)) * 100}% - 2px)`;
  ui.scaleMarker.style.opacity = "1";
}

function renderParticipants() {
  const viewModel = state.getViewModel();
  renderCountryOptions(viewModel);
  ui.homeParticipantCount.textContent = countLabel(viewModel.participantsCount);
  ui.participantsSubtitle.textContent = viewModel.participantsCount
    ? `Всего участников: ${viewModel.participantsCount}`
    : "Зарегистрированные бегуны появятся здесь";
  ui.visibleParticipantCount.textContent = `Показано: ${viewModel.participants.length} из ${viewModel.participantsCount}`;

  ui.participantSearch.value = viewModel.filters.search;
  ui.genderFilter.value = viewModel.filters.gender;
  ui.countryFilter.value = viewModel.filters.country;
  updateSortIndicators(viewModel.sort);

  const hasRows = viewModel.participants.length > 0;
  ui.emptyState.hidden = hasRows;
  ui.participantsTableWrap.hidden = !hasRows;
  ui.emptyStateTitle.textContent = viewModel.participantsCount ? "Ничего не найдено" : "Пока нет участников";
  ui.emptyStateText.textContent = viewModel.participantsCount
    ? "Измените параметры поиска или очистите фильтры."
    : "Откройте регистрацию, заполните данные бегуна и сохраните BMI.";
  ui.participantsBody.replaceChildren();

  viewModel.participants.forEach((participant) => {
    const row = document.createElement("tr");
    const photo = participant.photo && safePhotoDataUrl(participant.photo.dataUrl)
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
      <td>${participant.bmi ? BmiCalculator.getVisual(participant.bmi).label : "Не рассчитан"}</td>
      <td>${participant.calories ? `${participant.calories} ккал` : "-"}</td>
      <td>
        <div class="table-actions">
          <button class="button button-soft edit-button" type="button">Изменить</button>
          <button class="button button-light delete-button" type="button">Удалить</button>
        </div>
      </td>
    `;
    row.querySelector(".edit-button").addEventListener("click", () => editParticipant(participant.id));
    row.querySelector(".delete-button").addEventListener("click", () => requestDelete(participant.id));
    ui.participantsBody.append(row);
  });
}

function renderCountryOptions(viewModel) {
  const options = [
    `<option value="all">Все страны</option>`,
    ...viewModel.countries.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
  ];
  ui.countryFilter.innerHTML = options.join("");
}

function updateSortIndicators(sort) {
  ui.sortButtons.forEach((button) => {
    const active = button.dataset.sortKey === sort.sortKey;
    button.classList.toggle("is-active", active);
    button.querySelector(".sort-indicator").textContent = active ? (sort.sortDirection === "asc" ? "↑" : "↓") : "↕";
  });
}

function renderPhotoPreview() {
  const photo = state.getViewModel().session.selectedPhoto;
  if (photo && safePhotoDataUrl(photo.dataUrl)) {
    ui.photoPreview.src = photo.dataUrl;
    ui.photoPreview.hidden = false;
    ui.photoPlaceholder.hidden = true;
    ui.photoFilename.textContent = photo.name;
  } else {
    ui.photoPreview.removeAttribute("src");
    ui.photoPreview.hidden = true;
    ui.photoPlaceholder.hidden = false;
    ui.photoFilename.textContent = "JPG, PNG, BMP до 2 МБ";
  }
}

function resetBmiForm() {
  ui.height.value = "";
  ui.weight.value = "";
  ui.bmiError.textContent = "";
  ui.currentRunner.textContent = "Участник не выбран";
  renderBmiResult(null);
}

function readRegistrationForm() {
  const formData = new FormData(ui.registrationForm);
  return {
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    gender: String(formData.get("gender") || "").trim(),
    birthDate: String(formData.get("birthDate") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    country: String(formData.get("country") || "").trim()
  };
}

function setFormValue(name, value) {
  ui.registrationForm.elements[name].value = value || "";
}

function numberValue(input) {
  return Number.parseFloat(input.value.replace(",", "."));
}

function countLabel(count) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return `${count} бегунов`;
  if (lastDigit === 1) return `${count} бегун`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} бегуна`;
  return `${count} бегунов`;
}

function formatDate(value) {
  if (!value) return "Не указана";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const countdownTimer = new CountdownTimer((text) => {
  ui.countdown.textContent = text;
});

window.addEventListener("beforeunload", () => countdownTimer.stop());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) countdownTimer.stop();
  else countdownTimer.start();
});

renderParticipants();
renderPhotoPreview();
resetBmiForm();
countdownTimer.start();
