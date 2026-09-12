const LEGACY_STORAGE_KEY = "firstReadAssessmentProfilesV1";
const SELECTION_KEY = "firstReadSelectionV2";
const MIGRATION_KEY = "firstReadLegacyMigrationV2";
const REVIEW_LEVEL_KEY = "firstReadReviewLevelV1";
const REVIEW_LEVELS = new Set(["quick", "standard", "deep"]);

const state = {
  profiles: [],
  profilesLoaded: false,
  selectedAcademicYear: null,
  selectedUnitCode: null,
  selectedProfileId: null,
  libraryYear: "all",
  libraryStatus: "active",
  file: null,
  review: null,
  meta: null,
  reviewLevel: "quick",
  preflightConfirmed: false,
  approvalConfirmed: false
};

const $ = (id) => document.getElementById(id);
const els = {
  loginGate: $("loginGate"), appShell: $("appShell"), loginForm: $("loginForm"), password: $("password"), loginError: $("loginError"),
  logoutButton: $("logoutButton"), academicYearSelect: $("academicYearSelect"), unitSelect: $("unitSelect"), profileSelect: $("profileSelect"),
  profileSummary: $("profileSummary"), profileGrid: $("profileGrid"), libraryYearFilter: $("libraryYearFilter"), libraryStatusFilter: $("libraryStatusFilter"),
  libraryDatabaseBanner: $("libraryDatabaseBanner"), legacyMigration: $("legacyMigration"), migrateLegacyProfiles: $("migrateLegacyProfiles"),
  newProfileButton: $("newProfileButton"), goLibraryButton: $("goLibraryButton"), profileDialog: $("profileDialog"), profileForm: $("profileForm"),
  dialogTitle: $("dialogTitle"), closeDialog: $("closeDialog"), cancelProfile: $("cancelProfile"), deleteProfile: $("deleteProfile"),
  assessmentBriefFile: $("assessmentBriefFile"), briefImportStatus: $("briefImportStatus"),
  submissionFile: $("submissionFile"), dropZone: $("dropZone"), fileCard: $("fileCard"), analyseButton: $("analyseButton"), runHint: $("runHint"),
  reviewLevelGroup: $("reviewLevelGroup"),
  progressPanel: $("progressPanel"), progressText: $("progressText"), resultsSection: $("resultsSection"), resultsContent: $("resultsContent"),
  copyFeedback: $("copyFeedback"), exportFeedback: $("exportFeedback"), printFeedback: $("printFeedback"),
  exportProfiles: $("exportProfiles"), importProfiles: $("importProfiles"), toast: $("toast"),
  dashboardReviewButton: $("dashboardReviewButton"), dashboardNewAssessmentButton: $("dashboardNewAssessmentButton"),
  dashboardLibraryButton: $("dashboardLibraryButton"), dashboardQuickReview: $("dashboardQuickReview"),
  dashboardQuickAssessment: $("dashboardQuickAssessment"), dashboardYearLabel: $("dashboardYearLabel"),
  dashboardActiveCount: $("dashboardActiveCount"), dashboardReadyCount: $("dashboardReadyCount"),
  dashboardYearsCount: $("dashboardYearsCount"), dashboardReviewMode: $("dashboardReviewMode"),
  dashboardAssessmentList: $("dashboardAssessmentList"),
  preflightConfirm: $("preflightConfirm"), identifierNotice: $("identifierNotice"),
  approvalConfirm: $("approvalConfirm"), disclosureText: $("disclosureText"), copyDisclosure: $("copyDisclosure"),
  verifyProfile: $("verifyProfile"), verificationPanel: $("verificationPanel"),
  verificationTitle: $("verificationTitle"), verificationCopy: $("verificationCopy")
};

const profileFields = [
  "profileId", "academicYear", "unitCode", "unitName", "assessmentName", "academicLevel", "wordCount", "version",
  "feedbackStyle", "assessmentBrief", "learningOutcomes", "rubric", "additionalInstructions"
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function currentAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function nextAcademicYear(value) {
  const match = /^(\d{4})\/(\d{2})$/.exec(value || "");
  if (!match) return currentAcademicYear();
  const start = Number(match[1]) + 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function yearSort(a, b) { return b.localeCompare(a); }
function years() { return [...new Set(state.profiles.map((p) => p.academicYear).filter(Boolean))].sort(yearSort); }

function loadSavedSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || "{}");
    state.selectedAcademicYear = saved.academicYear || null;
    state.selectedUnitCode = saved.unitCode || null;
    state.selectedProfileId = saved.profileId || null;
  } catch {}
}

function saveSelection() {
  localStorage.setItem(SELECTION_KEY, JSON.stringify({
    academicYear: state.selectedAcademicYear,
    unitCode: state.selectedUnitCode,
    profileId: state.selectedProfileId
  }));
}

async function loadProfiles() {
  try {
    const data = await api("/api/assessments", { method: "GET", headers: {} });
    state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    state.profilesLoaded = true;
    els.libraryDatabaseBanner.classList.add("hidden");
    renderAllProfileViews();
    renderLegacyMigration();
  } catch (error) {
    state.profiles = [];
    state.profilesLoaded = false;
    renderAllProfileViews();
    if (error.status === 401) return showLogin();
    els.libraryDatabaseBanner.classList.remove("hidden");
    els.libraryDatabaseBanner.innerHTML = `<strong>Assessment library unavailable.</strong> ${escapeHtml(error.message)} The student review function is unchanged, but annual assessment profiles need the database connection.`;
  }
}

function profileComplete(p) {
  return Boolean(p?.unitCode?.trim() && p?.unitName?.trim() && p?.assessmentName?.trim() && p?.assessmentBrief?.trim().length >= 40 && p?.rubric?.trim().length >= 20);
}

function profileReady(p) {
  return Boolean(profileComplete(p) && p?.isVerified && !p?.isArchived);
}

function verificationLabel(p) {
  if (!profileComplete(p)) return "Setup required";
  return p?.isVerified ? "Verified" : "Verification required";
}

function formatDateTime(value) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return ""; }
}

function selectedProfile() { return state.profiles.find((p) => p.id === state.selectedProfileId) || null; }

function renderAllProfileViews() {
  renderDashboard();
  renderReviewSelectors();
  renderLibraryFilters();
  renderProfileGrid();
  updateRunState();
}

function openReviewForProfile(profileId) {
  const p = state.profiles.find((profile) => profile.id === profileId);
  if (!p) return;
  state.selectedAcademicYear = p.academicYear;
  state.selectedUnitCode = p.unitCode;
  state.selectedProfileId = p.id;
  saveSelection();
  renderReviewSelectors();
  updateRunState();
  navigate("review");
}

function renderDashboard() {
  if (!els.dashboardAssessmentList) return;

  const active = state.profiles.filter((p) => !p.isArchived);
  const ready = active.filter(profileReady);
  const academicYears = [...new Set(active.map((p) => p.academicYear).filter(Boolean))];
  const year = currentAcademicYear();

  els.dashboardYearLabel.textContent = year;
  els.dashboardActiveCount.textContent = String(active.length);
  els.dashboardReadyCount.textContent = String(ready.length);
  els.dashboardYearsCount.textContent = String(academicYears.length);
  els.dashboardReviewMode.textContent = state.reviewLevel.charAt(0).toUpperCase() + state.reviewLevel.slice(1);

  const yearProfiles = active
    .filter((p) => p.academicYear === year)
    .sort((a, b) => a.unitCode.localeCompare(b.unitCode) || a.assessmentName.localeCompare(b.assessmentName))
    .slice(0, 6);

  els.dashboardAssessmentList.innerHTML = "";

  if (!state.profilesLoaded) {
    els.dashboardAssessmentList.innerHTML = `<div class="dashboard-empty"><span class="dashboard-empty-icon">…</span><div><strong>Loading your assessment library</strong><p>First Read is checking the annual profiles available to this workspace.</p></div></div>`;
    return;
  }

  if (!yearProfiles.length) {
    els.dashboardAssessmentList.innerHTML = `<div class="dashboard-empty"><span class="dashboard-empty-icon">+</span><div><strong>No ${escapeHtml(year)} assessments yet</strong><p>Import an existing brief to build the current-year library.</p><button type="button" class="text-button dashboard-empty-add">Add first assessment</button></div></div>`;
    els.dashboardAssessmentList.querySelector(".dashboard-empty-add")?.addEventListener("click", () => openProfileDialog());
    return;
  }

  yearProfiles.forEach((p) => {
    const item = document.createElement("article");
    item.className = "dashboard-assessment-card";
    const readyStatus = profileReady(p);
    item.innerHTML = `
      <div class="dashboard-assessment-main">
        <div class="assessment-glyph" aria-hidden="true"><span>${escapeHtml((p.unitCode || "A").slice(0, 2))}</span></div>
        <div>
          <div class="dashboard-assessment-kicker">
            <span>${escapeHtml(p.unitCode)}</span>
            <span class="dashboard-status ${readyStatus ? "ready" : "setup"}">${readyStatus ? "Verified" : verificationLabel(p)}</span>
          </div>
          <h3>${escapeHtml(p.assessmentName)}</h3>
          <p>${escapeHtml(p.unitName)}</p>
          <div class="dashboard-assessment-meta">
            <span>${escapeHtml(p.academicLevel || "Level not set")}</span>
            <span>${escapeHtml(p.wordCount || "No word limit")}</span>
          </div>
        </div>
      </div>
      <div class="dashboard-assessment-actions">
        <button type="button" class="button secondary review-assessment" ${readyStatus ? "" : "disabled"}>Review</button>
        <button type="button" class="icon-action edit-assessment" aria-label="Edit ${escapeAttr(p.assessmentName)}">Edit</button>
      </div>`;
    item.querySelector(".review-assessment")?.addEventListener("click", () => openReviewForProfile(p.id));
    item.querySelector(".edit-assessment")?.addEventListener("click", () => openProfileDialog(p.id));
    els.dashboardAssessmentList.append(item);
  });
}

function renderReviewSelectors() {
  const active = state.profiles.filter((p) => !p.isArchived);
  const availableYears = [...new Set(active.map((p) => p.academicYear).filter(Boolean))].sort(yearSort);

  els.academicYearSelect.innerHTML = "";
  if (!availableYears.length) {
    addOption(els.academicYearSelect, "", "No academic years available");
    els.academicYearSelect.disabled = true;
    els.unitSelect.innerHTML = ""; addOption(els.unitSelect, "", "No units available"); els.unitSelect.disabled = true;
    els.profileSelect.innerHTML = ""; addOption(els.profileSelect, "", "No assessments available"); els.profileSelect.disabled = true;
    state.selectedAcademicYear = null; state.selectedUnitCode = null; state.selectedProfileId = null;
    renderProfileSummary();
    return;
  }

  els.academicYearSelect.disabled = false;
  availableYears.forEach((year) => addOption(els.academicYearSelect, year, year));
  if (!availableYears.includes(state.selectedAcademicYear)) {
    state.selectedAcademicYear = availableYears.includes(currentAcademicYear()) ? currentAcademicYear() : availableYears[0];
    state.selectedUnitCode = null; state.selectedProfileId = null;
  }
  els.academicYearSelect.value = state.selectedAcademicYear;

  const yearProfiles = active.filter((p) => p.academicYear === state.selectedAcademicYear);
  const unitMap = new Map();
  yearProfiles.forEach((p) => unitMap.set(p.unitCode, p.unitName));
  const units = [...unitMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  els.unitSelect.innerHTML = "";
  units.forEach(([code, name]) => addOption(els.unitSelect, code, `${code} · ${name}`));
  if (!units.some(([code]) => code === state.selectedUnitCode)) {
    state.selectedUnitCode = units[0]?.[0] || null;
    state.selectedProfileId = null;
  }
  els.unitSelect.disabled = !units.length;
  if (state.selectedUnitCode) els.unitSelect.value = state.selectedUnitCode;

  const assessments = yearProfiles
    .filter((p) => p.unitCode === state.selectedUnitCode)
    .sort((a, b) => a.assessmentName.localeCompare(b.assessmentName) || (b.version || 1) - (a.version || 1));
  els.profileSelect.innerHTML = "";
  assessments.forEach((p) => addOption(els.profileSelect, p.id, `${p.assessmentName} · v${p.version || 1}${profileReady(p) ? " · verified" : ` · ${verificationLabel(p).toLowerCase()}`}`));
  if (!assessments.some((p) => p.id === state.selectedProfileId)) state.selectedProfileId = assessments[0]?.id || null;
  els.profileSelect.disabled = !assessments.length;
  if (state.selectedProfileId) els.profileSelect.value = state.selectedProfileId;

  saveSelection();
  renderProfileSummary();
}

function renderProfileSummary() {
  const p = selectedProfile();
  if (!p) {
    els.profileSummary.className = "profile-summary empty-state";
    els.profileSummary.textContent = "Create or select an assessment profile before reviewing a submission.";
    return;
  }
  const status = verificationLabel(p);
  const verified = p.isVerified && p.verifiedAt ? ` · checked ${formatDateTime(p.verifiedAt)}` : "";
  els.profileSummary.className = `profile-summary ${p.isVerified ? "verified-profile" : "unverified-profile"}`;
  els.profileSummary.innerHTML = `<strong>${escapeHtml(p.unitName)}</strong><br>${escapeHtml(p.assessmentName)}<div class="profile-meta"><span class="mini-chip">${escapeHtml(p.academicYear)}</span><span class="mini-chip">v${escapeHtml(p.version || 1)}</span><span class="mini-chip">${escapeHtml(p.academicLevel || "Level not set")}</span><span class="mini-chip">${escapeHtml(p.wordCount || "No word limit set")}</span><span class="mini-chip ${p.isVerified ? "verified-chip" : "verification-chip"}">${escapeHtml(status + verified)}</span></div>`;
}

function renderLibraryFilters() {
  const availableYears = years();
  const currentValue = state.libraryYear;
  els.libraryYearFilter.innerHTML = "";
  addOption(els.libraryYearFilter, "all", "All academic years");
  availableYears.forEach((year) => addOption(els.libraryYearFilter, year, year));
  state.libraryYear = currentValue === "all" || availableYears.includes(currentValue) ? currentValue : "all";
  els.libraryYearFilter.value = state.libraryYear;
  els.libraryStatusFilter.value = state.libraryStatus;
}

function renderProfileGrid() {
  els.profileGrid.innerHTML = "";
  let profiles = [...state.profiles];
  if (state.libraryYear !== "all") profiles = profiles.filter((p) => p.academicYear === state.libraryYear);
  if (state.libraryStatus === "active") profiles = profiles.filter((p) => !p.isArchived);
  if (state.libraryStatus === "archived") profiles = profiles.filter((p) => p.isArchived);

  if (!profiles.length) {
    els.profileGrid.innerHTML = `<div class="empty-library"><p>No assessment profiles match this view.</p><p>Create a profile, change the filters, or duplicate a previous year's brief.</p></div>`;
    return;
  }

  const grouped = new Map();
  profiles.sort((a, b) => yearSort(a.academicYear, b.academicYear) || a.unitCode.localeCompare(b.unitCode) || a.assessmentName.localeCompare(b.assessmentName));
  profiles.forEach((p) => {
    if (!grouped.has(p.academicYear)) grouped.set(p.academicYear, []);
    grouped.get(p.academicYear).push(p);
  });

  for (const [year, yearProfiles] of grouped.entries()) {
    const group = document.createElement("section");
    group.className = "year-group";
    group.innerHTML = `<div class="year-heading"><div><p class="eyebrow">Academic year</p><h3>${escapeHtml(year)}</h3></div><span>${yearProfiles.length} assessment${yearProfiles.length === 1 ? "" : "s"}</span></div><div class="profile-grid-inner"></div>`;
    const grid = group.querySelector(".profile-grid-inner");
    yearProfiles.forEach((p) => grid.append(profileCard(p)));
    els.profileGrid.append(group);
  }
}

function profileCard(p) {
  const card = document.createElement("article");
  const ready = profileComplete(p);
  const hasBrief = Boolean(p.assessmentBrief?.trim().length >= 40);
  const hasRubric = Boolean(p.rubric?.trim().length >= 20);
  card.className = `profile-card${p.isArchived ? " archived" : ""}`;
  card.innerHTML = `
    <div class="profile-card-top">
      <div class="profile-card-icon" aria-hidden="true"><span>${escapeHtml((p.unitCode || "A").slice(0, 2))}</span></div>
      <div class="profile-card-heading">
        <div class="card-kickers"><span class="profile-code">${escapeHtml(p.unitCode || "NO CODE")}</span><span class="version-chip">v${escapeHtml(p.version || 1)}</span></div>
        <h3>${escapeHtml(p.unitName || "Untitled unit")}</h3>
        <p>${escapeHtml(p.assessmentName || "Untitled assessment")}</p>
      </div>
    </div>
    <div class="profile-card-meta">
      <span>${escapeHtml(p.academicLevel || "Level not set")}</span>
      <span>${escapeHtml(p.wordCount || "No word limit")}</span>
    </div>
    <div class="profile-readiness" aria-label="Profile completeness">
      <span class="${hasBrief ? "complete" : ""}">${hasBrief ? "✓" : "○"} Brief</span>
      <span class="${hasRubric ? "complete" : ""}">${hasRubric ? "✓" : "○"} Rubric</span>
      <span class="${p.isVerified ? "complete" : ""}">${p.isVerified ? "✓" : "○"} Verified</span>
    </div>
    <footer>
      <span class="setup-status ${profileReady(p) ? "" : "incomplete"}">${p.isArchived ? "Archived" : verificationLabel(p)}</span>
      <div class="card-actions">${profileComplete(p) && !p.isVerified && !p.isArchived ? '<button class="text-button verify-card" type="button">Verify</button>' : ""}<button class="text-button edit" type="button">Edit</button><button class="text-button duplicate" type="button">Duplicate</button><button class="text-button archive" type="button">${p.isArchived ? "Restore" : "Archive"}</button></div>
    </footer>`;
  card.querySelector(".verify-card")?.addEventListener("click", () => verifyAssessmentProfile(p.id));
  card.querySelector(".edit").addEventListener("click", () => openProfileDialog(p.id));
  card.querySelector(".duplicate").addEventListener("click", () => duplicateProfile(p.id));
  card.querySelector(".archive").addEventListener("click", () => toggleArchive(p.id));
  return card;
}

function addOption(select, value, label) {
  const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
}

function openProfileDialog(id = null) {
  const p = state.profiles.find((x) => x.id === id) || { academicYear: state.libraryYear !== "all" ? state.libraryYear : (state.selectedAcademicYear || currentAcademicYear()), version: 1 };
  profileFields.forEach((field) => {
    const el = $(field);
    if (el) el.value = field === "profileId" ? (p.id || "") : (p[field] ?? "");
  });
  $("isArchived").checked = Boolean(p.isArchived);
  els.dialogTitle.textContent = id ? "Edit assessment profile" : "New assessment profile";
  els.deleteProfile.classList.toggle("hidden", !id);
  renderVerificationPanel(p, Boolean(id));
  resetBriefImportStatus();
  if (els.assessmentBriefFile) els.assessmentBriefFile.value = "";
  els.profileDialog.showModal();
}

function renderVerificationPanel(profile, existing) {
  if (!els.verifyProfile) return;
  if (!existing) {
    els.verificationTitle.textContent = "Save the profile before verification";
    els.verificationCopy.textContent = "Verification is an explicit lecturer check performed after the assessment profile has been saved.";
    els.verifyProfile.disabled = true;
    els.verifyProfile.textContent = "Verify assessment profile";
    return;
  }
  if (!profileComplete(profile)) {
    els.verificationTitle.textContent = "Complete the brief and rubric first";
    els.verificationCopy.textContent = "Verification becomes available once the assessment profile contains the required assessment brief and marking criteria.";
    els.verifyProfile.disabled = true;
    els.verifyProfile.textContent = "Verify assessment profile";
    return;
  }
  if (profile.isVerified) {
    els.verificationTitle.textContent = "Assessment profile verified";
    els.verificationCopy.textContent = `Verified ${formatDateTime(profile.verifiedAt) || "for live review"}. Saving substantive edits will revoke this status until the revised profile is checked again.`;
    els.verifyProfile.disabled = true;
    els.verifyProfile.textContent = "Verified";
    return;
  }
  els.verificationTitle.textContent = "Lecturer verification required";
  els.verificationCopy.textContent = "Confirm that the brief, learning outcomes, rubric and instructions accurately represent what students were given. Only verified profiles can be used for a live review.";
  els.verifyProfile.disabled = false;
  els.verifyProfile.textContent = "Verify assessment profile";
}

async function verifyAssessmentProfile(id) {
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile || !profileComplete(profile)) return showToast("Complete and save the assessment profile before verification.");
  const confirmed = confirm("Verify this assessment profile?\n\nConfirm that you have checked the brief, learning outcomes, rubric and instructions against the assessment students received. Any later edits will require re-verification.");
  if (!confirmed) return;
  try {
    const data = await api(`/api/assessments?id=${encodeURIComponent(id)}&action=verify`, {
      method: "PATCH",
      body: JSON.stringify({})
    });
    state.profiles = state.profiles.map((p) => p.id === id ? data.profile : p);
    renderAllProfileViews();
    if (els.profileDialog.open) renderVerificationPanel(data.profile, true);
    showToast("Assessment profile verified");
  } catch (error) {
    if (error.status === 401) showLogin();
    else showToast(error.message || "Assessment profile could not be verified");
  }
}

function closeProfileDialog() {
  els.profileDialog.close();
  els.profileForm.reset();
  $("profileId").value = "";
  if (els.assessmentBriefFile) els.assessmentBriefFile.value = "";
  resetBriefImportStatus();
}

function resetBriefImportStatus() {
  if (!els.briefImportStatus) return;
  els.briefImportStatus.className = "brief-import-status hidden";
  els.briefImportStatus.innerHTML = "";
}

function setBriefImportStatus(kind, html) {
  if (!els.briefImportStatus) return;
  els.briefImportStatus.className = `brief-import-status ${kind}`;
  els.briefImportStatus.innerHTML = html;
}

async function importAssessmentBrief(file) {
  if (!file) return;
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["docx", "pdf"].includes(ext)) {
    setBriefImportStatus("error", "Please choose a DOCX or PDF assessment brief.");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    setBriefImportStatus("error", "This version accepts assessment briefs up to 4 MB.");
    return;
  }

  const chooser = els.assessmentBriefFile;
  if (chooser) chooser.disabled = true;
  setBriefImportStatus("working", `<strong>Reading ${escapeHtml(file.name)}…</strong><br>Extracting the brief, learning outcomes and marking criteria. Nothing is saved until you press Save profile.`);

  try {
    const fileBase64 = await fileToBase64(file);
    const data = await api("/api/extract-assessment", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, fileBase64, academicYear: $("academicYear").value.trim() })
    });
    const x = data.extracted || {};

    // The chosen annual-library year takes precedence over a year embedded in an old brief.
    if (!$("academicYear").value.trim() && x.academicYear) $("academicYear").value = x.academicYear;
    const metadataMappings = {
      unitCode: x.unitCode,
      unitName: x.unitName,
      assessmentName: x.assessmentName,
      academicLevel: x.academicLevel,
      wordCount: x.wordCount
    };
    Object.entries(metadataMappings).forEach(([id, value]) => {
      if (String(value || "").trim()) $(id).value = String(value).trim();
    });
    // Replace substantive content exactly with this import so an older brief cannot silently leave stale criteria behind.
    $("assessmentBrief").value = String(x.assessmentBrief || "").trim();
    $("learningOutcomes").value = String(x.learningOutcomes || "").trim();
    $("rubric").value = String(x.rubric || "").trim();
    $("additionalInstructions").value = String(x.additionalInstructions || "").trim();

    const notes = Array.isArray(x.extractionNotes) ? x.extractionNotes.filter(Boolean) : [];
    const briefReady = String(x.assessmentBrief || "").trim().length >= 40;
    const rubricReady = String(x.rubric || "").trim().length >= 20;
    const noteHtml = notes.length ? `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : "";
    const statusClass = briefReady && rubricReady ? "success" : "warning";
    const readiness = briefReady && rubricReady
      ? "The substantive brief and marking criteria were detected."
      : "Extraction completed, but check the highlighted content carefully. First Read will still require a substantive brief and rubric before saving.";
    setBriefImportStatus(statusClass, `<strong>Imported from ${escapeHtml(file.name)}.</strong> ${readiness}<br>Review every populated field below before saving.${noteHtml}`);
  } catch (error) {
    if (error.status === 401) showLogin();
    setBriefImportStatus("error", escapeHtml(error.message || "The assessment brief could not be imported."));
  } finally {
    if (chooser) { chooser.disabled = false; chooser.value = ""; }
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  const profile = {};
  profileFields.forEach((field) => { if (field !== "profileId") profile[field] = $(field).value.trim(); });
  profile.version = Number.parseInt(profile.version, 10) || 1;
  profile.isArchived = $("isArchived").checked;
  const existingId = $("profileId").value;
  try {
    const data = await api(existingId ? `/api/assessments?id=${encodeURIComponent(existingId)}` : "/api/assessments", {
      method: existingId ? "PATCH" : "POST",
      body: JSON.stringify(profile)
    });
    if (existingId) state.profiles = state.profiles.map((p) => p.id === existingId ? data.profile : p);
    else state.profiles.push(data.profile);
    state.selectedAcademicYear = data.profile.academicYear;
    state.selectedUnitCode = data.profile.unitCode;
    state.selectedProfileId = data.profile.isArchived ? null : data.profile.id;
    renderAllProfileViews(); closeProfileDialog(); showToast(existingId ? "Assessment saved. Verification is required after edits." : "Assessment profile saved. Verify it before live review.");
  } catch (error) {
    if (error.status === 401) showLogin();
    else showToast(error.message || "Assessment profile could not be saved");
  }
}

async function deleteCurrentProfile() {
  const id = $("profileId").value;
  if (!id || !confirm("Permanently delete this assessment profile from the annual library?")) return;
  try {
    await api(`/api/assessments?id=${encodeURIComponent(id)}`, { method: "DELETE", body: "{}" });
    state.profiles = state.profiles.filter((p) => p.id !== id);
    if (state.selectedProfileId === id) state.selectedProfileId = null;
    renderAllProfileViews(); closeProfileDialog(); showToast("Assessment profile deleted");
  } catch (error) { showToast(error.message || "Profile could not be deleted"); }
}

async function duplicateProfile(id) {
  const source = state.profiles.find((p) => p.id === id);
  if (!source) return;
  const suggested = nextAcademicYear(source.academicYear);
  const targetYear = prompt("Duplicate this assessment into which academic year?", suggested);
  if (targetYear === null) return;
  if (!/^\d{4}\/\d{2}$/.test(targetYear.trim())) return showToast("Use an academic year such as 2027/28");
  const copy = { ...source, id: undefined, academicYear: targetYear.trim(), version: 1, isArchived: false, isVerified: false, verifiedAt: null, sourceProfileId: source.id };
  try {
    const data = await api("/api/assessments", { method: "POST", body: JSON.stringify(copy) });
    state.profiles.push(data.profile);
    state.libraryYear = data.profile.academicYear;
    state.selectedAcademicYear = data.profile.academicYear;
    state.selectedUnitCode = data.profile.unitCode;
    state.selectedProfileId = data.profile.id;
    renderAllProfileViews(); showToast(`Duplicated to ${data.profile.academicYear}`);
  } catch (error) { showToast(error.message || "Profile could not be duplicated"); }
}

async function toggleArchive(id) {
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return;
  try {
    const data = await api(`/api/assessments?id=${encodeURIComponent(id)}&action=status`, {
      method: "PATCH",
      body: JSON.stringify({ isArchived: !profile.isArchived })
    });
    state.profiles = state.profiles.map((p) => p.id === id ? data.profile : p);
    if (data.profile.isArchived && state.selectedProfileId === id) state.selectedProfileId = null;
    renderAllProfileViews();
    showToast(data.profile.isArchived ? "Assessment archived" : "Assessment restored");
  } catch (error) { showToast(error.message || "Profile could not be updated"); }
}

function legacyProfiles() {
  if (localStorage.getItem(MIGRATION_KEY) === "complete") return [];
  try {
    const profiles = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    return Array.isArray(profiles) ? profiles : [];
  } catch { return []; }
}

function renderLegacyMigration() {
  const count = legacyProfiles().length;
  els.legacyMigration.classList.toggle("hidden", !count);
  if (count) els.legacyMigration.querySelector("p").textContent = `${count} older browser-only assessment profile${count === 1 ? " was" : "s were"} found. You can copy them into the persistent annual library.`;
}

async function migrateLegacy() {
  const legacy = legacyProfiles();
  if (!legacy.length) return;
  els.migrateLegacyProfiles.disabled = true;
  try {
    for (const p of legacy) {
      const profile = { ...p, id: undefined, academicYear: p.academicYear || currentAcademicYear(), version: p.version || 1, isArchived: false };
      const data = await api("/api/assessments", { method: "POST", body: JSON.stringify(profile) });
      state.profiles.push(data.profile);
    }
    localStorage.setItem(MIGRATION_KEY, "complete");
    renderAllProfileViews(); renderLegacyMigration(); showToast("Browser profiles copied into annual library");
  } catch (error) { showToast(error.message || "Migration stopped before completion"); }
  finally { els.migrateLegacyProfiles.disabled = false; }
}

function loadReviewLevel() {
  const saved = localStorage.getItem(REVIEW_LEVEL_KEY);
  state.reviewLevel = REVIEW_LEVELS.has(saved) ? saved : "quick";
  renderReviewLevel();
}

function setReviewLevel(level) {
  if (!REVIEW_LEVELS.has(level)) return;
  state.reviewLevel = level;
  localStorage.setItem(REVIEW_LEVEL_KEY, level);
  renderReviewLevel();
  renderDashboard();
}

function renderReviewLevel() {
  if (!els.reviewLevelGroup) return;
  els.reviewLevelGroup.querySelectorAll("[data-review-level]").forEach((button) => {
    const active = button.dataset.reviewLevel === state.reviewLevel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function filenameIdentifierRisk(name = "") {
  const findings = [];
  if (/@/.test(name)) findings.push("an email-like identifier");
  if (/\b\d{6,10}\b/.test(name)) findings.push("a possible student number");
  if (/student[_\s-]*\d+/i.test(name)) findings.push("a student identifier");
  return findings;
}

function resetPreflight() {
  state.preflightConfirmed = false;
  if (els.preflightConfirm) els.preflightConfirm.checked = false;
}

function setFile(file) {
  if (!file) return;
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["pdf","docx","txt"].includes(ext)) { showToast("Please choose a PDF, DOCX or TXT file"); return; }
  if (file.size > 4 * 1024 * 1024) { showToast("This version accepts files up to 4 MB"); return; }
  state.file = file;
  resetPreflight();
  resetApproval();
  els.fileCard.classList.remove("hidden");
  els.fileCard.innerHTML = `<div class="file-info"><span class="file-name">${escapeHtml(file.name)}</span><span class="file-size">${formatBytes(file.size)} · original filename is replaced before model processing</span></div><button class="text-button" id="removeFile" type="button">Remove</button>`;

  const risks = filenameIdentifierRisk(file.name);
  if (els.identifierNotice) {
    els.identifierNotice.classList.remove("hidden", "warning", "ok");
    if (risks.length) {
      els.identifierNotice.classList.add("warning");
      els.identifierNotice.innerHTML = `<strong>Check identifiers before review.</strong> The filename appears to contain ${escapeHtml(risks.join(" and "))}. First Read replaces the filename before model processing, but you should also check the document body for unnecessary personal information.`;
    } else {
      els.identifierNotice.classList.add("ok");
      els.identifierNotice.innerHTML = `<strong>Privacy pre-flight:</strong> no obvious identifier was detected in the filename. This does not inspect the document body, so please check the submission itself before confirming.`;
    }
  }

  $("removeFile").addEventListener("click", () => {
    state.file = null;
    els.submissionFile.value = "";
    els.fileCard.classList.add("hidden");
    els.identifierNotice?.classList.add("hidden");
    resetPreflight();
    resetApproval();
    updateRunState();
  });
  updateRunState();
}

function updateRunState() {
  const p = selectedProfile();
  const ready = Boolean(state.file && p && profileReady(p) && state.preflightConfirmed);
  els.analyseButton.disabled = !ready;
  if (!p) els.runHint.textContent = "Select an academic year, unit and verified assessment first.";
  else if (!profileComplete(p)) els.runHint.textContent = "Finish setting up the selected assessment profile.";
  else if (!p.isVerified) els.runHint.textContent = "This assessment profile must be verified by a lecturer before it can be used.";
  else if (!state.file) els.runHint.textContent = `${p.academicYear} · ${p.unitCode} · ${p.assessmentName} is verified. Add a student submission.`;
  else if (!state.preflightConfirmed) els.runHint.textContent = "Complete the privacy and responsibility check before starting the review.";
  else els.runHint.textContent = "Verified assessment and submission ready. The model will not generate a mark or misconduct decision.";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollReview(responseId) {
  const maxPolls = 180; // about 9 minutes at 3-second intervals
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const data = await api(`/api/review-status?id=${encodeURIComponent(responseId)}`, {
      method: "GET",
      headers: {}
    });

    if (data.status === "completed" && data.result) return data;

    const elapsed = (attempt + 1) * 3;
    if (elapsed < 30) {
      els.progressText.textContent = "Reading the submission and checking it against the assessment criteria…";
    } else if (elapsed < 90) {
      els.progressText.textContent = "The review is still running. Longer submissions can take a little while…";
    } else {
      els.progressText.textContent = "Still working through the submission. You can leave this tab open while First Read finishes…";
    }

    await wait(3000);
  }

  const error = new Error("The review is taking unusually long. Please try again.");
  error.status = 504;
  throw error;
}

async function runAnalysis() {
  const p = selectedProfile();
  if (!state.file || !p || !profileReady(p) || !state.preflightConfirmed) return;
  els.analyseButton.disabled = true;
  els.progressPanel.classList.remove("hidden");
  els.resultsSection.classList.add("hidden");
  els.progressText.textContent = "Packaging the submission without saving it to the site…";
  try {
    const fileBase64 = await fileToBase64(state.file);
    els.progressText.textContent = `Starting review against ${p.unitCode} · ${p.assessmentName} (${p.academicYear})…`;

    const started = await api("/api/analyse", {
      method: "POST",
      body: JSON.stringify({
        fileName: state.file.name,
        fileBase64,
        assessment: p,
        reviewLevel: state.reviewLevel
      })
    });

    if (!started.responseId) throw new Error("The review could not be started.");

    const levelName = state.reviewLevel.charAt(0).toUpperCase() + state.reviewLevel.slice(1);
    els.progressText.textContent = `${levelName} review started. Reading the submission and checking the assessment criteria…`;
    const completed = await pollReview(started.responseId);

    state.review = completed.result;
    state.meta = { ...(started.meta || {}), ...(completed.meta || {}), reviewLevel: started.meta?.reviewLevel || state.reviewLevel };
    renderResults();
    els.resultsSection.classList.remove("hidden");
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.status === 401) showLogin();
    showToast(error.message || "Review failed");
  } finally {
    els.progressPanel.classList.add("hidden");
    updateRunState();
  }
}

function renderResults() {
  const r = state.review;
  if (!r) return;
  els.resultsContent.innerHTML = "";

  const reviewLevel = (state.meta?.reviewLevel || state.reviewLevel || "quick");
  const reviewLabel = reviewLevel.charAt(0).toUpperCase() + reviewLevel.slice(1);
  const summary = document.createElement("section");
  summary.className = "review-summary";
  summary.innerHTML = `
    <div class="review-summary-label"><span class="summary-pulse"></span><div><small>Review complete</small><strong>${escapeHtml(reviewLabel)} first read</strong></div></div>
    <div class="review-stat"><span>Criteria</span><strong>${(r.criteria || []).length}</strong></div>
    <div class="review-stat"><span>Priorities</span><strong>${(r.development_priorities || []).length}</strong></div>
    <div class="review-stat"><span>Manual checks</span><strong>${(r.manual_checks || []).length}</strong></div>`;
  els.resultsContent.append(summary);

  const profile = selectedProfile();
  const audit = document.createElement("section");
  audit.className = "review-audit-strip";
  audit.innerHTML = `
    <div><span>Assessment</span><strong>${escapeHtml(profile?.unitCode || "")} · v${escapeHtml(profile?.version || 1)}</strong></div>
    <div><span>Profile status</span><strong>${profile?.isVerified ? "Verified" : "Unverified"}</strong></div>
    <div><span>Verified</span><strong>${escapeHtml(formatDateTime(profile?.verifiedAt) || "Not recorded")}</strong></div>
    <div><span>Model</span><strong>${escapeHtml(state.meta?.model || "Not recorded")}</strong></div>
    <div><span>Review engine</span><strong>Trust Layer v1.0</strong></div>`;
  els.resultsContent.append(audit);

  els.resultsContent.append(resultSection(
    "Overall reading",
    "Your editable high-level interpretation of the submission.",
    `<textarea class="feedback-editor" data-path="overall_summary">${escapeHtml(r.overall_summary || "")}</textarea>`,
    "featured-result"
  ));

  const priorityHtml = (r.development_priorities || []).map((p, i) => `<div class="priority-card"><div class="priority-index">${i + 1}</div><div class="priority-fields"><label><span class="field-label">Priority</span><input data-path="development_priorities.${i}.priority" value="${escapeAttr(p.priority)}"></label><label><span class="field-label">Why it matters</span><textarea data-path="development_priorities.${i}.why_it_matters">${escapeHtml(p.why_it_matters)}</textarea></label><label><span class="field-label">Suggested action</span><textarea data-path="development_priorities.${i}.suggested_action">${escapeHtml(p.suggested_action)}</textarea></label></div></div>`).join("");
  els.resultsContent.append(resultSection(
    "Development priorities",
    "The changes most likely to improve the work. These deserve your attention first.",
    `<div class="priority-list">${priorityHtml || "<p>No priorities returned.</p>"}</div>`,
    "priority-result"
  ));

  const criteriaHtml = (r.criteria || []).map((c, i) => `<div class="criterion-card"><div class="criterion-top"><div><span class="criterion-number">${String(i + 1).padStart(2, "0")}</span><div class="criterion-name">${escapeHtml(c.criterion)}</div></div><span class="judgement">${escapeHtml(c.judgement)} · ${escapeHtml(c.priority)} priority</span></div><div class="criterion-provenance"><span class="verification-badge ${String(c.verification_status || "").toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(c.verification_status || "Check manually")}</span><span>${escapeHtml(c.evidence_location || "Location not specified")}</span></div><div class="criterion-fields"><label><span class="field-label">Evidence identified</span><textarea data-path="criteria.${i}.evidence">${escapeHtml(c.evidence)}</textarea></label><label><span class="field-label">Developmental feedback</span><textarea data-path="criteria.${i}.feedback">${escapeHtml(c.feedback)}</textarea></label></div></div>`).join("");
  els.resultsContent.append(resultSection(
    "Criterion-by-criterion",
    "Inspect the evidence behind each comment before deciding what should reach the student.",
    `<div class="criteria-list">${criteriaHtml || "<p>No criteria returned.</p>"}</div>`,
    "criteria-result"
  ));

  const supportingGrid = document.createElement("div");
  supportingGrid.className = "supporting-results-grid";

  const strengthHtml = (r.strengths || []).map((s, i) => `<div class="bullet-editor"><span>+</span><textarea data-path="strengths.${i}">${escapeHtml(s)}</textarea></div>`).join("");
  supportingGrid.append(resultSection("What is working", "Candidate strengths identified from the submission.", `<div class="bullet-editors">${strengthHtml || "<p>No strengths returned.</p>"}</div>`, "compact-result"));

  const checksHtml = (r.manual_checks || []).map((m, i) => `<div class="manual-card"><label><span class="field-label">Category</span><input data-path="manual_checks.${i}.category" value="${escapeAttr(m.category)}"></label><label><span class="field-label">Observation</span><textarea data-path="manual_checks.${i}.observation">${escapeHtml(m.observation)}</textarea></label><label><span class="field-label">Lecturer action</span><textarea data-path="manual_checks.${i}.action">${escapeHtml(m.action)}</textarea></label></div>`).join("");
  supportingGrid.append(resultSection("Manual checks", "Items to verify rather than accept at face value.", `<div>${checksHtml || "<p>No manual checks were flagged.</p>"}</div>`, "compact-result"));
  els.resultsContent.append(supportingGrid);

  els.resultsContent.append(resultSection(
    "Student-facing draft",
    "The final working area. Edit this before copying or exporting.",
    `<div class="student-draft-header"><span>Editable draft</span><span>Lecturer approval required</span></div><textarea class="feedback-editor student-feedback-editor" data-path="student_feedback">${escapeHtml(r.student_feedback || "")}</textarea>`,
    "student-draft-result"
  ));

  resetApproval();
  els.resultsContent.querySelectorAll("[data-path]").forEach((el) => el.addEventListener("input", () => {
    setByPath(state.review, el.dataset.path, el.value);
    if (state.approvalConfirmed) {
      resetApproval();
      showToast("Approval removed because the draft was edited");
    }
  }));
}

function resultSection(title, intro, html, extraClass = "") {
  const section = document.createElement("section");
  section.className = `panel result-section ${extraClass}`.trim();
  section.innerHTML = `<div class="result-section-head"><h3>${title}</h3><p class="section-intro">${intro}</p></div>${html}`;
  return section;
}

function setByPath(obj, path, value) {
  const parts = path.split("."); let target = obj;
  for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
  target[parts.at(-1)] = value;
}

function resetApproval() {
  state.approvalConfirmed = false;
  if (els.approvalConfirm) els.approvalConfirm.checked = false;
  [els.copyFeedback, els.exportFeedback, els.printFeedback, els.copyDisclosure].forEach((button) => {
    if (button) button.disabled = true;
  });
}

function setApproval(approved) {
  state.approvalConfirmed = Boolean(approved && state.review);
  [els.copyFeedback, els.exportFeedback, els.printFeedback, els.copyDisclosure].forEach((button) => {
    if (button) button.disabled = !state.approvalConfirmed;
  });
}

function studentDisclosure() {
  return String(els.disclosureText?.value || "").trim();
}

function compiledFeedback() {
  const p = selectedProfile();
  const r = state.review;
  if (!r) return "";
  return `${p?.academicYear || ""}
${p?.unitCode || ""} ${p?.unitName || ""}
${p?.assessmentName || ""} · profile v${p?.version || 1}

STUDENT FEEDBACK

${r.student_feedback || ""}

TRANSPARENCY STATEMENT

${studentDisclosure()}

LECTURER WORKING NOTES

Overall reading
${r.overall_summary || ""}

Development priorities
${(r.development_priorities || []).map((x, i) => `${i+1}. ${x.priority}
Why it matters: ${x.why_it_matters}
Suggested action: ${x.suggested_action}`).join("\n\n")}

Criterion evidence
${(r.criteria || []).map((x, i) => `${i+1}. ${x.criterion}
Status: ${x.verification_status || "Check manually"}
Location: ${x.evidence_location || "Not specified"}
Evidence: ${x.evidence}
Feedback: ${x.feedback}`).join("\n\n")}

Manual checks
${(r.manual_checks || []).map((x, i) => `${i+1}. ${x.category}: ${x.observation}
Action: ${x.action}`).join("\n\n")}

REVIEW AUDIT
Review level: ${state.meta?.reviewLevel || state.reviewLevel}
Model: ${state.meta?.model || "not recorded"}
Assessment profile: ${p?.id || ""} · v${p?.version || 1}
Assessment verified: ${p?.verifiedAt || "not recorded"}
Generated: ${state.meta?.generatedAt || state.meta?.startedAt || new Date().toISOString()}
Review engine: First Read Trust Layer v1.0

Approved by lecturer before export: ${state.approvalConfirmed ? "Yes" : "No"}

Generated as AI-assisted decision-support. No automated mark, classification or academic misconduct decision has been produced.`; 
}

function downloadText(name, content, type = "text/plain") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportProfiles() {
  downloadText(`first-read-assessment-library-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), profiles: state.profiles }, null, 2), "application/json");
}

async function importProfiles(file) {
  try {
    const parsed = JSON.parse(await file.text()); const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    if (!Array.isArray(profiles)) throw new Error("No profile list found");
    let imported = 0;
    for (const p of profiles) {
      const profile = { ...p, id: undefined, academicYear: p.academicYear || currentAcademicYear(), version: p.version || 1, isArchived: Boolean(p.isArchived) };
      const data = await api("/api/assessments", { method: "POST", body: JSON.stringify(profile) });
      state.profiles.push(data.profile); imported += 1;
    }
    renderAllProfileViews(); showToast(`${imported} profile${imported === 1 ? "" : "s"} imported`);
  } catch (error) { showToast(error.message || "That file does not contain valid First Read profiles"); }
}

function navigate(screen) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === `screen-${screen}`));
  document.querySelectorAll(".nav-button").forEach((el) => el.classList.toggle("active", el.dataset.screen === screen));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function checkSession() {
  try { const data = await api("/api/session", { method: "GET", headers: {} }); data.authenticated ? showApp() : showLogin(); }
  catch { showLogin(); }
}
function showApp() {
  els.loginGate.classList.add("hidden"); els.appShell.classList.remove("hidden"); els.password.value = ""; els.loginError.textContent = "";
  if (!state.profilesLoaded) loadProfiles();
}
function showLogin() { els.appShell.classList.add("hidden"); els.loginGate.classList.remove("hidden"); setTimeout(() => els.password.focus(), 50); }
function showToast(message) { els.toast.textContent = message; els.toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3000); }
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function escapeAttr(value = "") { return escapeHtml(value).replace(/\n/g, " "); }

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); els.loginError.textContent = "";
  try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: els.password.value }) }); state.profilesLoaded = false; showApp(); }
  catch (error) { els.loginError.textContent = error.message; }
});
els.logoutButton.addEventListener("click", async () => { try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {} state.profilesLoaded = false; showLogin(); });
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.screen)));
els.dashboardReviewButton?.addEventListener("click", () => navigate("review"));
els.dashboardQuickReview?.addEventListener("click", () => navigate("review"));
els.dashboardNewAssessmentButton?.addEventListener("click", () => openProfileDialog());
els.dashboardQuickAssessment?.addEventListener("click", () => openProfileDialog());
els.dashboardLibraryButton?.addEventListener("click", () => navigate("library"));
els.goLibraryButton.addEventListener("click", () => navigate("library"));
els.newProfileButton.addEventListener("click", () => openProfileDialog());
els.closeDialog.addEventListener("click", closeProfileDialog); els.cancelProfile.addEventListener("click", closeProfileDialog);
els.profileForm.addEventListener("submit", handleProfileSave); els.deleteProfile.addEventListener("click", deleteCurrentProfile);
els.verifyProfile?.addEventListener("click", () => {
  const id = $("profileId").value;
  if (id) verifyAssessmentProfile(id);
});
if (els.assessmentBriefFile) els.assessmentBriefFile.addEventListener("change", () => importAssessmentBrief(els.assessmentBriefFile.files[0]));
els.academicYearSelect.addEventListener("change", () => { state.selectedAcademicYear = els.academicYearSelect.value || null; state.selectedUnitCode = null; state.selectedProfileId = null; renderReviewSelectors(); updateRunState(); });
els.unitSelect.addEventListener("change", () => { state.selectedUnitCode = els.unitSelect.value || null; state.selectedProfileId = null; renderReviewSelectors(); updateRunState(); });
els.profileSelect.addEventListener("change", () => { state.selectedProfileId = els.profileSelect.value || null; saveSelection(); renderProfileSummary(); updateRunState(); });
els.libraryYearFilter.addEventListener("change", () => { state.libraryYear = els.libraryYearFilter.value; renderProfileGrid(); });
els.libraryStatusFilter.addEventListener("change", () => { state.libraryStatus = els.libraryStatusFilter.value; renderProfileGrid(); });
els.migrateLegacyProfiles.addEventListener("click", migrateLegacy);
els.submissionFile.addEventListener("change", () => setFile(els.submissionFile.files[0]));
els.preflightConfirm?.addEventListener("change", () => {
  state.preflightConfirmed = Boolean(els.preflightConfirm.checked);
  updateRunState();
});
["dragenter","dragover"].forEach((name) => els.dropZone.addEventListener(name, (e) => { e.preventDefault(); els.dropZone.classList.add("dragover"); }));
["dragleave","drop"].forEach((name) => els.dropZone.addEventListener(name, (e) => { e.preventDefault(); els.dropZone.classList.remove("dragover"); }));
els.dropZone.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));
if (els.reviewLevelGroup) {
  els.reviewLevelGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-review-level]");
    if (button) setReviewLevel(button.dataset.reviewLevel);
  });
}
els.analyseButton.addEventListener("click", runAnalysis);
els.approvalConfirm?.addEventListener("change", () => setApproval(els.approvalConfirm.checked));
els.copyFeedback.addEventListener("click", async () => {
  if (!state.review || !state.approvalConfirmed) return showToast("Approve the reviewed feedback before copying it");
  await navigator.clipboard.writeText(state.review.student_feedback || "");
  showToast("Approved student feedback copied");
});
els.exportFeedback.addEventListener("click", () => {
  if (!state.review || !state.approvalConfirmed) return showToast("Approve the reviewed feedback before exporting it");
  const p = selectedProfile();
  downloadText(`${p?.unitCode || "assessment"}-${(p?.academicYear || "").replace("/", "-")}-first-read-feedback.txt`, compiledFeedback());
});
els.printFeedback.addEventListener("click", () => {
  if (!state.review || !state.approvalConfirmed) return showToast("Approve the reviewed feedback before printing it");
  window.print();
});
els.copyDisclosure?.addEventListener("click", async () => {
  if (!state.approvalConfirmed) return showToast("Approve the reviewed feedback before copying the disclosure");
  await navigator.clipboard.writeText(studentDisclosure());
  showToast("Disclosure statement copied");
});
els.exportProfiles.addEventListener("click", exportProfiles);
els.importProfiles.addEventListener("change", () => { if (els.importProfiles.files[0]) importProfiles(els.importProfiles.files[0]); els.importProfiles.value = ""; });

loadReviewLevel();
loadSavedSelection();
renderAllProfileViews();
checkSession();
