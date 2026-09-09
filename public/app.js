const STORAGE_KEY = "firstReadAssessmentProfilesV1";
const state = { profiles: [], selectedProfileId: null, file: null, review: null, meta: null };

const $ = (id) => document.getElementById(id);
const els = {
  loginGate: $("loginGate"), appShell: $("appShell"), loginForm: $("loginForm"), password: $("password"), loginError: $("loginError"),
  logoutButton: $("logoutButton"), profileSelect: $("profileSelect"), profileSummary: $("profileSummary"), profileGrid: $("profileGrid"),
  newProfileButton: $("newProfileButton"), goLibraryButton: $("goLibraryButton"), profileDialog: $("profileDialog"), profileForm: $("profileForm"),
  dialogTitle: $("dialogTitle"), closeDialog: $("closeDialog"), cancelProfile: $("cancelProfile"), deleteProfile: $("deleteProfile"),
  submissionFile: $("submissionFile"), dropZone: $("dropZone"), fileCard: $("fileCard"), analyseButton: $("analyseButton"), runHint: $("runHint"),
  progressPanel: $("progressPanel"), progressText: $("progressText"), resultsSection: $("resultsSection"), resultsContent: $("resultsContent"),
  copyFeedback: $("copyFeedback"), exportFeedback: $("exportFeedback"), printFeedback: $("printFeedback"),
  exportProfiles: $("exportProfiles"), importProfiles: $("importProfiles"), toast: $("toast")
};

const profileFields = ["profileId","unitCode","unitName","assessmentName","academicLevel","wordCount","feedbackStyle","assessmentBrief","learningOutcomes","rubric","additionalInstructions"];

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

function loadProfiles() {
  try { state.profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { state.profiles = []; }
  if (!Array.isArray(state.profiles)) state.profiles = [];
  state.selectedProfileId = localStorage.getItem(`${STORAGE_KEY}:selected`) || state.profiles[0]?.id || null;
}

function saveProfiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profiles));
  if (state.selectedProfileId) localStorage.setItem(`${STORAGE_KEY}:selected`, state.selectedProfileId);
  renderProfileSelect();
  renderProfileGrid();
  updateRunState();
}

function profileComplete(p) {
  return Boolean(p?.unitCode?.trim() && p?.unitName?.trim() && p?.assessmentName?.trim() && p?.assessmentBrief?.trim().length >= 40 && p?.rubric?.trim().length >= 20);
}

function selectedProfile() { return state.profiles.find((p) => p.id === state.selectedProfileId) || null; }

function renderProfileSelect() {
  els.profileSelect.innerHTML = "";
  if (!state.profiles.length) {
    const option = document.createElement("option"); option.textContent = "No assessment profiles yet"; option.value = ""; els.profileSelect.append(option);
    state.selectedProfileId = null;
    renderProfileSummary();
    return;
  }
  for (const p of state.profiles) {
    const option = document.createElement("option");
    option.value = p.id; option.textContent = `${p.unitCode} · ${p.assessmentName}${profileComplete(p) ? "" : " · setup required"}`;
    els.profileSelect.append(option);
  }
  if (!state.profiles.some(p => p.id === state.selectedProfileId)) state.selectedProfileId = state.profiles[0].id;
  els.profileSelect.value = state.selectedProfileId;
  renderProfileSummary();
}

function renderProfileSummary() {
  const p = selectedProfile();
  if (!p) {
    els.profileSummary.className = "profile-summary empty-state";
    els.profileSummary.textContent = "Create an assessment profile before reviewing a submission.";
    return;
  }
  const status = profileComplete(p) ? "Ready to use" : "Setup required: add a substantive brief and marking criteria";
  els.profileSummary.className = "profile-summary";
  els.profileSummary.innerHTML = `<strong>${escapeHtml(p.unitName)}</strong><br>${escapeHtml(p.assessmentName)}<div class="profile-meta"><span class="mini-chip">${escapeHtml(p.academicLevel || "Level not set")}</span><span class="mini-chip">${escapeHtml(p.wordCount || "No word limit set")}</span><span class="mini-chip">${status}</span></div>`;
}

function renderProfileGrid() {
  els.profileGrid.innerHTML = "";
  if (!state.profiles.length) {
    els.profileGrid.innerHTML = `<div class="empty-library"><p>No assessment profiles yet.</p><p>Create one by pasting in the brief, learning outcomes and marking criteria.</p></div>`;
    return;
  }
  state.profiles.forEach((p) => {
    const card = document.createElement("article"); card.className = "profile-card";
    card.innerHTML = `<div><span class="profile-code">${escapeHtml(p.unitCode || "NO CODE")}</span><h3>${escapeHtml(p.unitName || "Untitled unit")}</h3><p>${escapeHtml(p.assessmentName || "Untitled assessment")}</p></div><footer><span class="setup-status ${profileComplete(p) ? "" : "incomplete"}">${profileComplete(p) ? "Ready" : "Setup required"}</span><button class="text-button" type="button">Edit profile</button></footer>`;
    card.querySelector("button").addEventListener("click", () => openProfileDialog(p.id));
    els.profileGrid.append(card);
  });
}

function openProfileDialog(id = null) {
  const p = state.profiles.find((x) => x.id === id) || {};
  profileFields.forEach((field) => { const el = $(field); if (el) el.value = field === "profileId" ? (p.id || "") : (p[field] || ""); });
  els.dialogTitle.textContent = id ? "Edit assessment profile" : "New assessment profile";
  els.deleteProfile.classList.toggle("hidden", !id);
  els.profileDialog.showModal();
}

function closeProfileDialog() { els.profileDialog.close(); els.profileForm.reset(); $("profileId").value = ""; }

function handleProfileSave(event) {
  event.preventDefault();
  const profile = {};
  profileFields.forEach((field) => { if (field !== "profileId") profile[field] = $(field).value.trim(); });
  const existingId = $("profileId").value;
  profile.id = existingId || crypto.randomUUID();
  profile.updatedAt = new Date().toISOString();
  if (existingId) state.profiles = state.profiles.map((p) => p.id === existingId ? profile : p);
  else state.profiles.unshift(profile);
  state.selectedProfileId = profile.id;
  saveProfiles(); closeProfileDialog(); showToast("Assessment profile saved");
}

function deleteCurrentProfile() {
  const id = $("profileId").value;
  if (!id || !confirm("Delete this assessment profile from this browser?")) return;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  state.selectedProfileId = state.profiles[0]?.id || null;
  saveProfiles(); closeProfileDialog(); showToast("Assessment profile deleted");
}

function setFile(file) {
  if (!file) return;
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["pdf","docx","txt"].includes(ext)) { showToast("Please choose a PDF, DOCX or TXT file"); return; }
  if (file.size > 4 * 1024 * 1024) { showToast("This MVP accepts files up to 4 MB"); return; }
  state.file = file;
  els.fileCard.classList.remove("hidden");
  els.fileCard.innerHTML = `<div class="file-info"><span class="file-name">${escapeHtml(file.name)}</span><span class="file-size">${formatBytes(file.size)} · local file, not stored by the app</span></div><button class="text-button" id="removeFile" type="button">Remove</button>`;
  $("removeFile").addEventListener("click", () => { state.file = null; els.submissionFile.value = ""; els.fileCard.classList.add("hidden"); updateRunState(); });
  updateRunState();
}

function updateRunState() {
  const p = selectedProfile();
  const ready = Boolean(state.file && p && profileComplete(p));
  els.analyseButton.disabled = !ready;
  if (!p) els.runHint.textContent = "Create an assessment profile first.";
  else if (!profileComplete(p)) els.runHint.textContent = "Finish setting up the selected assessment profile.";
  else if (!state.file) els.runHint.textContent = "Assessment ready. Add a student submission.";
  else els.runHint.textContent = "Assessment and submission ready. The model will not generate a mark.";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runAnalysis() {
  const p = selectedProfile();
  if (!state.file || !p || !profileComplete(p)) return;
  els.analyseButton.disabled = true;
  els.progressPanel.classList.remove("hidden");
  els.resultsSection.classList.add("hidden");
  els.progressText.textContent = "Packaging the submission without saving it to the site…";
  try {
    const fileBase64 = await fileToBase64(state.file);
    els.progressText.textContent = "Checking evidence against the brief and marking criteria…";
    const data = await api("/api/analyse", { method: "POST", body: JSON.stringify({ fileName: state.file.name, fileBase64, assessment: p }) });
    state.review = data.result; state.meta = data.meta;
    renderResults();
    els.resultsSection.classList.remove("hidden");
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.status === 401) { showLogin(); }
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

  els.resultsContent.append(resultSection("Overall reading", "Edit the model's high-level interpretation before using it.", `<textarea class="feedback-editor" data-path="overall_summary">${escapeHtml(r.overall_summary || "")}</textarea>`));

  const criteriaHtml = (r.criteria || []).map((c, i) => `<div class="criterion-card"><div class="criterion-top"><div class="criterion-name">${escapeHtml(c.criterion)}</div><span class="judgement">${escapeHtml(c.judgement)} · ${escapeHtml(c.priority)} priority</span></div><div class="criterion-fields"><label><span class="field-label">Evidence identified</span><textarea data-path="criteria.${i}.evidence">${escapeHtml(c.evidence)}</textarea></label><label><span class="field-label">Developmental feedback</span><textarea data-path="criteria.${i}.feedback">${escapeHtml(c.feedback)}</textarea></label></div></div>`).join("");
  els.resultsContent.append(resultSection("Criterion-by-criterion", "Evidence and feedback are separated so that you can inspect the basis of each comment.", `<div class="criteria-list">${criteriaHtml || "<p>No criteria returned.</p>"}</div>`));

  const strengthHtml = (r.strengths || []).map((s, i) => `<div class="bullet-editor"><span>+</span><textarea data-path="strengths.${i}">${escapeHtml(s)}</textarea></div>`).join("");
  els.resultsContent.append(resultSection("What is working", "Candidate strengths identified from the submission.", `<div class="bullet-editors">${strengthHtml || "<p>No strengths returned.</p>"}</div>`));

  const priorityHtml = (r.development_priorities || []).map((p, i) => `<div class="priority-card"><label><span class="field-label">Priority</span><input data-path="development_priorities.${i}.priority" value="${escapeAttr(p.priority)}"></label><label><span class="field-label">Why it matters</span><textarea data-path="development_priorities.${i}.why_it_matters">${escapeHtml(p.why_it_matters)}</textarea></label><label><span class="field-label">Suggested action</span><textarea data-path="development_priorities.${i}.suggested_action">${escapeHtml(p.suggested_action)}</textarea></label></div>`).join("");
  els.resultsContent.append(resultSection("Development priorities", "The small number of changes most likely to improve the work.", `<div class="priority-list">${priorityHtml || "<p>No priorities returned.</p>"}</div>`));

  const checksHtml = (r.manual_checks || []).map((m, i) => `<div class="manual-card"><label><span class="field-label">Category</span><input data-path="manual_checks.${i}.category" value="${escapeAttr(m.category)}"></label><label><span class="field-label">Observation</span><textarea data-path="manual_checks.${i}.observation">${escapeHtml(m.observation)}</textarea></label><label><span class="field-label">Lecturer action</span><textarea data-path="manual_checks.${i}.action">${escapeHtml(m.action)}</textarea></label></div>`).join("");
  els.resultsContent.append(resultSection("Manual checks", "Items the model thinks should be verified rather than asserted.", `<div>${checksHtml || "<p>No manual checks were flagged.</p>"}</div>`));

  els.resultsContent.append(resultSection("Student-facing draft", "This is the text intended for you to edit, copy or export after review.", `<textarea class="feedback-editor student-feedback-editor" data-path="student_feedback">${escapeHtml(r.student_feedback || "")}</textarea>`));

  els.resultsContent.querySelectorAll("[data-path]").forEach((el) => el.addEventListener("input", () => setByPath(state.review, el.dataset.path, el.value)));
}

function resultSection(title, intro, html) {
  const section = document.createElement("section"); section.className = "panel result-section";
  section.innerHTML = `<h3>${title}</h3><p class="section-intro">${intro}</p>${html}`;
  return section;
}

function setByPath(obj, path, value) {
  const parts = path.split("."); let target = obj;
  for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
  target[parts.at(-1)] = value;
}

function compiledFeedback() {
  const p = selectedProfile(); const r = state.review;
  if (!r) return "";
  return `${p?.unitCode || ""} ${p?.unitName || ""}\n${p?.assessmentName || ""}\n\nSTUDENT FEEDBACK\n\n${r.student_feedback || ""}\n\nLECTURER WORKING NOTES\n\nOverall reading\n${r.overall_summary || ""}\n\nDevelopment priorities\n${(r.development_priorities || []).map((x, i) => `${i+1}. ${x.priority}\nWhy it matters: ${x.why_it_matters}\nSuggested action: ${x.suggested_action}`).join("\n\n")}\n\nManual checks\n${(r.manual_checks || []).map((x, i) => `${i+1}. ${x.category}: ${x.observation}\nAction: ${x.action}`).join("\n\n")}\n\nGenerated as an AI-assisted draft for lecturer review. No automated mark or grade has been produced.`;
}

function downloadText(name, content, type = "text/plain") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportProfiles() {
  downloadText(`first-read-assessment-profiles-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), profiles: state.profiles }, null, 2), "application/json");
}

async function importProfiles(file) {
  try {
    const parsed = JSON.parse(await file.text()); const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    if (!Array.isArray(profiles)) throw new Error("No profile list found");
    const normalised = profiles.map((p) => ({ ...p, id: p.id || crypto.randomUUID() }));
    state.profiles = normalised; state.selectedProfileId = normalised[0]?.id || null; saveProfiles(); showToast("Profiles imported");
  } catch { showToast("That file does not contain valid First Read profiles"); }
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
function showApp() { els.loginGate.classList.add("hidden"); els.appShell.classList.remove("hidden"); els.password.value = ""; els.loginError.textContent = ""; }
function showLogin() { els.appShell.classList.add("hidden"); els.loginGate.classList.remove("hidden"); setTimeout(() => els.password.focus(), 50); }
function showToast(message) { els.toast.textContent = message; els.toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600); }
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function escapeAttr(value = "") { return escapeHtml(value).replace(/\n/g, " "); }

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); els.loginError.textContent = "";
  try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: els.password.value }) }); showApp(); }
  catch (error) { els.loginError.textContent = error.message; }
});
els.logoutButton.addEventListener("click", async () => { try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {} showLogin(); });
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.screen)));
els.goLibraryButton.addEventListener("click", () => navigate("library"));
els.newProfileButton.addEventListener("click", () => openProfileDialog());
els.closeDialog.addEventListener("click", closeProfileDialog); els.cancelProfile.addEventListener("click", closeProfileDialog);
els.profileForm.addEventListener("submit", handleProfileSave); els.deleteProfile.addEventListener("click", deleteCurrentProfile);
els.profileSelect.addEventListener("change", () => { state.selectedProfileId = els.profileSelect.value || null; saveProfiles(); renderProfileSummary(); });
els.submissionFile.addEventListener("change", () => setFile(els.submissionFile.files[0]));
["dragenter","dragover"].forEach((name) => els.dropZone.addEventListener(name, (e) => { e.preventDefault(); els.dropZone.classList.add("dragover"); }));
["dragleave","drop"].forEach((name) => els.dropZone.addEventListener(name, (e) => { e.preventDefault(); els.dropZone.classList.remove("dragover"); }));
els.dropZone.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));
els.analyseButton.addEventListener("click", runAnalysis);
els.copyFeedback.addEventListener("click", async () => { if (!state.review) return; await navigator.clipboard.writeText(state.review.student_feedback || ""); showToast("Student feedback copied"); });
els.exportFeedback.addEventListener("click", () => { if (!state.review) return; const p = selectedProfile(); downloadText(`${p?.unitCode || "assessment"}-first-read-feedback.txt`, compiledFeedback()); });
els.printFeedback.addEventListener("click", () => window.print());
els.exportProfiles.addEventListener("click", exportProfiles);
els.importProfiles.addEventListener("change", () => { if (els.importProfiles.files[0]) importProfiles(els.importProfiles.files[0]); els.importProfiles.value = ""; });

loadProfiles(); renderProfileSelect(); renderProfileGrid(); updateRunState(); checkSession();
