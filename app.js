"use strict";

/* =========================================================
 * MAINTENANCE WORK MANAGEMENT
 * Reliability PT. Padi Indonesia Maju - Mojokerto
 *
 * Dependensi global dari index.html:
 * - window.supabase
 * - window.XLSX
 * - window.ExcelJS
 * - window.saveAs
 * - window.APP_CONFIG
 * ========================================================= */

const C = window.APP_CONFIG;

if (!C?.SUPABASE_URL || !C?.SUPABASE_ANON_KEY) {
  throw new Error("Konfigurasi Supabase pada config.js belum lengkap.");
}

const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let session = null;
let profile = null;
let works = [];
let equipment = [];
let signWorkId = null;
let signatureContext = null;
let signatureDrawing = false;
let technicianPreviewUrl = null;

/* =========================================================
 * UTILITAS
 * ========================================================= */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function showToast(message, isError = false) {
  const element = $("#toast");

  if (!element) {
    if (isError) console.error(message);
    else console.log(message);
    return;
  }

  element.textContent = message;
  element.className = `toast show${isError ? " error" : ""}`;

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    element.className = "toast";
  }, 4000);
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return String(dateValue);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function getPublicPhotoUrl(path) {
  if (!path) return null;

  const { data } = sb.storage
    .from(C.PHOTO_BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

function closeModal(selector) {
  const modal = $(selector);
  if (modal) modal.classList.add("hidden");
}

function setButtonLoading(button, loading, loadingText, normalText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
}

function requireRole(allowedRoles, message = "Anda tidak memiliki izin.") {
  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error(message);
  }
}

/* =========================================================
 * INISIALISASI DAN EVENT
 * ========================================================= */

async function init() {
  const today = $("#today");
  if (today) {
    today.textContent = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full"
    }).format(new Date());
  }

  bindEvents();
  setupSignatureCanvas();

  const { data, error } = await sb.auth.getSession();

  if (error) {
    showToast(`Gagal membaca sesi: ${error.message}`, true);
    showLogin();
    return;
  }

  if (data.session) await enterApplication(data.session);
  else showLogin();

  sb.auth.onAuthStateChange(async (_event, newSession) => {
    if (newSession) await enterApplication(newSession);
    else showLogin();
  });
}

function bindEvents() {
  $("#loginForm")?.addEventListener("submit", login);
  $("#logoutBtn")?.addEventListener("click", () => sb.auth.signOut());

  $$("#nav button").forEach(button => {
    button.addEventListener("click", () => {
      changePage(button.dataset.page, button);
    });
  });

  $$('[data-goto]').forEach(button => {
    button.addEventListener("click", () => {
      const pageName = button.dataset.goto;
      changePage(pageName, $(`[data-page="${pageName}"]`));
    });
  });

  $("#addBtn")?.addEventListener("click", () => openWork());
  $("#modalClose")?.addEventListener("click", () => closeModal("#modal"));
  $("#cancelBtn")?.addEventListener("click", () => closeModal("#modal"));
  $("#workForm")?.addEventListener("submit", saveWork);

  /* Event delegation untuk tombol tabel pekerjaan.
   * Tetap bekerja setiap kali isi tbody dirender ulang. */
  $("#workTable")?.addEventListener("click", handleWorkTableClick);

  $("#searchInput")?.addEventListener("input", renderWorks);

  ["statusFilter", "priorityFilter", "typeFilter", "picFilter"].forEach(id => {
    $(`#${id}`)?.addEventListener("input", renderWorks);
  });

  $("#resetFilter")?.addEventListener("click", resetFilters);
  $("#exportBtn")?.addEventListener("click", () => exportXlsx(false));
  $("#emailBtn")?.addEventListener("click", sendEmail);

  $("#importBtn")?.addEventListener("click", () => $("#importFile")?.click());
  $("#importFile")?.addEventListener("change", importWorks);
  $("#masterImportBtn")?.addEventListener("click", () => $("#masterFile")?.click());
  $("#masterFile")?.addEventListener("change", importMaster);
  $("#masterAddBtn")?.addEventListener("click", () => editMaster());
  $("#userAddBtn")?.addEventListener("click", inviteUser);

  $("#detailModalClose")?.addEventListener("click", () => closeModal("#detailModal"));
  $("#detailCloseButton")?.addEventListener("click", () => closeModal("#detailModal"));

  $("#technicianPhotoClose")?.addEventListener("click", closeTechnicianPhotoModal);
  $("#technicianPhotoCancel")?.addEventListener("click", closeTechnicianPhotoModal);
  $("#technicianPhotoForm")?.addEventListener("submit", saveTechnicianPhoto);
  $("#technicianAfterPhoto")?.addEventListener("change", previewTechnicianPhoto);

  $("#clearSignature")?.addEventListener("click", clearSignature);
  $("#saveSignature")?.addEventListener("click", saveVerification);

  $$('[data-close-sign]').forEach(button => {
    button.addEventListener("click", () => closeModal("#signatureModal"));
  });

  $$(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.classList.add("hidden");
    });
  });
}

/* =========================================================
 * AUTHENTICATION DAN ROLE
 * ========================================================= */

async function login(event) {
  event.preventDefault();

  const message = $("#loginMsg");
  if (message) message.textContent = "Memeriksa akun...";

  const email = $("#loginEmail")?.value.trim();
  const password = $("#loginPassword")?.value;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (message) message.textContent = error ? error.message : "";
}

function showLogin() {
  session = null;
  profile = null;
  works = [];
  equipment = [];

  $("#loginView")?.classList.remove("hidden");
  $("#appView")?.classList.add("hidden");
}

async function enterApplication(newSession) {
  session = newSession;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", newSession.user.id)
    .single();

  if (error || !data) {
    showToast("Profil pengguna belum tersedia.", true);
    return;
  }

  if (!data.is_active) {
    showToast("Akun ini sedang dinonaktifkan.", true);
    await sb.auth.signOut();
    return;
  }

  profile = data;

  $("#loginView")?.classList.add("hidden");
  $("#appView")?.classList.remove("hidden");

  if ($("#userName")) {
    $("#userName").textContent = profile.full_name || newSession.user.email;
  }

  if ($("#userRole")) {
    $("#userRole").textContent = profile.role;
  }

  applyRoleVisibility();

  await Promise.all([
    loadEquipment(),
    loadWorks(),
    profile.role === "admin" ? loadUsers() : Promise.resolve()
  ]);
}

function applyRoleVisibility() {
  $$('[data-role="admin"]').forEach(element => {
    element.classList.toggle("hidden", profile.role !== "admin");
  });

  const exportButton = $("#exportBtn");
  if (exportButton) {
    exportButton.classList.toggle("hidden", profile.role === "technician");
  }
}

/* =========================================================
 * NAVIGASI
 * ========================================================= */

function changePage(pageName, navigationButton) {
  const target = $(`#${pageName}Page`);
  if (!target) return;

  if (["manage", "users"].includes(pageName) && profile.role !== "admin") {
    showToast("Halaman ini hanya dapat dibuka admin.", true);
    return;
  }

  $$(".page").forEach(page => page.classList.add("hidden"));
  target.classList.remove("hidden");

  $$("#nav button").forEach(button => button.classList.remove("active"));
  navigationButton?.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    works: "Pekerjaan",
    manage: "Kelola Master",
    users: "Kelola Pengguna"
  };

  if ($("#pageTitle")) {
    $("#pageTitle").textContent = titles[pageName] || "Maintenance";
  }
}

/* =========================================================
 * LOAD DATA
 * ========================================================= */

async function loadWorks() {
  const { data, error } = await sb
    .from("works")
    .select("*, equipment(*)")
    .order("created_at", { ascending: false });

  if (error) {
    showToast(`Gagal mengambil pekerjaan: ${error.message}`, true);
    return;
  }

  works = data || [];
  renderAll();
}

async function loadEquipment() {
  const { data, error } = await sb
    .from("equipment")
    .select("*")
    .order("name");

  if (error) {
    showToast(`Gagal mengambil equipment: ${error.message}`, true);
    return;
  }

  equipment = data || [];

  const select = $("#equipmentId");
  if (select) {
    select.innerHTML = `
      <option value="">Pilih equipment</option>
      ${equipment.map(item => `
        <option value="${item.id}">
          ${escapeHtml(item.name)} | ${escapeHtml(item.code_number)}
        </option>
      `).join("")}
    `;
  }

  renderMaster();
}

/* =========================================================
 * DASHBOARD DAN FILTER
 * ========================================================= */

function renderAll() {
  const verifiedWorks = works.filter(work => Boolean(work.verified_at));

  if ($("#kpiTotal")) $("#kpiTotal").textContent = works.length;
  if ($("#kpiOpen")) {
    $("#kpiOpen").textContent = works.filter(work => work.status === "Open").length;
  }
  if ($("#kpiProcess")) {
    $("#kpiProcess").textContent = works.filter(work =>
      work.status === "Proses" || (work.status === "Selesai" && !work.verified_at)
    ).length;
  }
  if ($("#kpiDone")) $("#kpiDone").textContent = verifiedWorks.length;

  const recentList = $("#recentList");

  if (recentList) {
    recentList.innerHTML = works.slice(0, 6).map(work => `
      <div class="recent-item">
        <div>
          <strong>${escapeHtml(work.title)}</strong><br>
          <small>
            ${escapeHtml(work.equipment?.name || "-")} •
            ${escapeHtml(work.pic || "-")}
          </small>
        </div>
        <span class="badge ${escapeHtml(work.status)}">
          ${work.verified_at ? "Terverifikasi" : escapeHtml(work.status)}
        </span>
      </div>
    `).join("") || '<p class="muted">Belum ada data.</p>';
  }

  renderWorks();
}

function getFilteredWorks() {
  const query = $("#searchInput")?.value.toLowerCase().trim() || "";
  const status = $("#statusFilter")?.value || "";
  const priority = $("#priorityFilter")?.value || "";
  const type = $("#typeFilter")?.value || "";
  const pic = $("#picFilter")?.value.toLowerCase().trim() || "";

  return works.filter(work => {
    const searchableText = [
      work.title,
      work.description,
      work.pic,
      work.equipment?.name,
      work.equipment?.code_number
    ].join(" ").toLowerCase();

    return searchableText.includes(query) &&
      (!status || work.status === status) &&
      (!priority || work.priority === priority) &&
      (!type || work.work_type === type) &&
      (!pic || String(work.pic || "").toLowerCase().includes(pic));
  });
}

function resetFilters() {
  ["searchInput", "statusFilter", "priorityFilter", "typeFilter", "picFilter"]
    .forEach(id => {
      const element = $(`#${id}`);
      if (element) element.value = "";
    });

  renderWorks();
}

/* =========================================================
 * TABEL PEKERJAAN DAN TOMBOL ROLE
 * ========================================================= */

function renderWorks() {
  const tableBody = $("#workTable");
  if (!tableBody) return;

  const rows = getFilteredWorks();

  tableBody.innerHTML = rows.map((work, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <strong>${escapeHtml(work.title)}</strong><br>
        <small>${escapeHtml(work.description || "")}</small>
      </td>
      <td>${escapeHtml(work.equipment?.name || "-")}</td>
      <td>${escapeHtml(work.work_type || "-")}</td>
      <td>${escapeHtml(work.priority || "-")}</td>
      <td>${escapeHtml(work.pic || "-")}</td>
      <td>
        <span class="badge ${escapeHtml(work.status)}">
          ${work.verified_at ? "Terverifikasi" : escapeHtml(work.status)}
        </span>
      </td>
      <td>
        ${renderTablePhoto(work.before_photo_path, "Foto sebelum")}
        ${renderTablePhoto(work.after_photo_path, "Foto sesudah")}
      </td>
      <td>${renderVerificationCell(work)}</td>
      <td>${actionButtons(work)}</td>
    </tr>
  `).join("") || `
    <tr>
      <td colspan="10" class="muted">Data tidak ditemukan.</td>
    </tr>
  `;

}

function renderTablePhoto(path, label) {
  const publicUrl = getPublicPhotoUrl(path);
  if (!publicUrl) return "";

  return `
    <a href="${publicUrl}" target="_blank" rel="noopener noreferrer">
      <img class="photo" src="${publicUrl}" alt="${escapeHtml(label)}">
    </a>
  `;
}

function renderVerificationCell(work) {
  if (work.verified_at) {
    return `✓ ${escapeHtml(work.verified_by_name || "Terverifikasi")}`;
  }

  if (profile.role === "technician") {
    if (work.status === "Open") return "Belum dimulai";
    if (work.status === "Proses") return "Sedang dikerjakan";
    return "Menunggu user";
  }

  const mayVerify = ["user", "admin"].includes(profile.role) &&
    work.status === "Selesai" &&
    Boolean(work.after_photo_path);

  if (mayVerify) {
    return `
      <button class="mini-btn btn-upload" data-verify="${work.id}" type="button">
        ✍ Paraf & Verifikasi
      </button>
    `;
  }

  if (work.status === "Open") return "Belum dimulai";
  if (work.status === "Proses") return "Menunggu teknisi";
  if (!work.after_photo_path) return "Foto belum tersedia";
  return "Belum dapat diverifikasi";
}

function actionButtons(work) {
  const buttons = [
    `
      <button class="mini-btn btn-detail" data-detail="${work.id}" type="button">
        👁 Detail
      </button>
    `
  ];

  if (profile.role === "admin") {
    buttons.push(`
      <button class="mini-btn" data-edit="${work.id}" type="button">
        ✎ Edit
      </button>
      <button class="mini-btn" data-del="${work.id}" type="button">
        🗑 Hapus
      </button>
    `);
  }

  if (profile.role === "technician") {
    if (work.status === "Open") {
      buttons.push(`
        <button class="mini-btn btn-start" data-start-work="${work.id}" type="button">
          ▶ Mulai Pekerjaan
        </button>
      `);
    } else if (work.status === "Proses") {
      buttons.push(`
        <button class="mini-btn btn-upload" data-upload-photo="${work.id}" type="button">
          📷 Tambahkan Foto
        </button>
      `);
    } else if (work.status === "Selesai" && !work.verified_at) {
      buttons.push(`
        <button class="mini-btn btn-waiting" type="button" disabled>
          ⏳ Menunggu Verifikasi
        </button>
      `);
    } else if (work.verified_at) {
      buttons.push(`
        <button class="mini-btn" type="button" disabled>
          ✓ Terverifikasi
        </button>
      `);
    }
  }

  return `<div class="action-group">${buttons.join("")}</div>`;
}

function handleWorkTableClick(event) {
  const button = event.target.closest("button");

  if (!button || !event.currentTarget.contains(button) || button.disabled) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (button.dataset.detail) {
    openWorkDetail(button.dataset.detail);
    return;
  }

  if (button.dataset.edit) {
    openWork(button.dataset.edit);
    return;
  }

  if (button.dataset.del) {
    deleteWork(button.dataset.del);
    return;
  }

  if (button.dataset.startWork) {
    startTechnicianWork(button.dataset.startWork);
    return;
  }

  if (button.dataset.uploadPhoto) {
    openTechnicianPhotoModal(button.dataset.uploadPhoto);
    return;
  }

  if (button.dataset.verify) {
    openSignature(button.dataset.verify);
  }
}


/* =========================================================
 * DETAIL PEKERJAAN READ ONLY
 * ========================================================= */

function renderDetailPhoto(containerSelector, path, label) {
  const container = $(containerSelector);
  if (!container) return;

  const publicUrl = getPublicPhotoUrl(path);

  if (!publicUrl) {
    container.textContent = "Belum tersedia";
    return;
  }

  container.innerHTML = `
    <a href="${publicUrl}" target="_blank" rel="noopener noreferrer">
      <img src="${publicUrl}" alt="${escapeHtml(label)}">
    </a>
  `;
}

function openWorkDetail(id) {
  const work = works.find(item => item.id === id);

  if (!work) {
    showToast("Data pekerjaan tidak ditemukan.", true);
    return;
  }

  if (!$("#detailModal")) {
    showToast("Modal detail belum ditambahkan pada index.html.", true);
    return;
  }

  $("#detailTitle").textContent = work.title || "-";
  $("#detailEquipment").textContent = work.equipment?.name || "-";
  $("#detailPic").textContent = work.pic || "-";
  $("#detailType").textContent = work.work_type || "-";
  $("#detailPriority").textContent = work.priority || "-";
  $("#detailDueDate").textContent = formatDate(work.due_date);
  $("#detailStatus").textContent = work.verified_at
    ? "Selesai dan terverifikasi"
    : work.status || "-";
  $("#detailDescription").textContent = work.description || "Tidak ada deskripsi.";

  renderDetailPhoto("#detailBeforePhoto", work.before_photo_path, "Foto sebelum pekerjaan");
  renderDetailPhoto("#detailAfterPhoto", work.after_photo_path, "Foto sesudah pekerjaan");

  $("#detailModal").classList.remove("hidden");
}

/* =========================================================
 * FORM ADMIN: TAMBAH DAN EDIT PEKERJAAN
 * ========================================================= */

function openWork(id) {
  if (profile.role !== "admin") {
    if (id) openWorkDetail(id);
    else showToast("Hanya admin yang dapat menambahkan pekerjaan.", true);
    return;
  }

  const work = works.find(item => item.id === id);

  $("#modalTitle").textContent = work ? "Edit Pekerjaan" : "Tambah Pekerjaan";
  $("#workId").value = work?.id || "";
  $("#title").value = work?.title || "";
  $("#equipmentId").value = work?.equipment_id || "";
  $("#pic").value = work?.pic || "";
  $("#type").value = work?.work_type || "Preventive Maintenance";
  $("#priority").value = work?.priority || "Medium";
  $("#dueDate").value = work?.due_date || "";
  $("#status").value = work?.status || "Open";
  $("#description").value = work?.description || "";
  $("#beforePhoto").value = "";
  $("#afterPhoto").value = "";

  [
    "#title", "#equipmentId", "#pic", "#type", "#priority",
    "#dueDate", "#status", "#description", "#beforePhoto", "#afterPhoto"
  ].forEach(selector => {
    if ($(selector)) $(selector).disabled = false;
  });

  $("#modal")?.classList.remove("hidden");
}

async function uploadPhoto(file, workId, kind) {
  if (!file) return null;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ukuran foto maksimal 10 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${workId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await sb.storage
    .from(C.PHOTO_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;
  return path;
}

async function saveWork(event) {
  event.preventDefault();

  try {
    requireRole(["admin"], "Hanya admin yang dapat menambah atau mengedit pekerjaan.");

    const existingId = $("#workId").value;
    const oldWork = works.find(item => item.id === existingId);
    const workId = existingId || crypto.randomUUID();

    const payload = {
      id: workId,
      title: $("#title").value.trim(),
      equipment_id: $("#equipmentId").value,
      pic: $("#pic").value.trim(),
      work_type: $("#type").value,
      priority: $("#priority").value,
      due_date: $("#dueDate").value || null,
      status: $("#status").value,
      description: $("#description").value.trim(),
      created_by: oldWork?.created_by || session.user.id,
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.equipment_id || !payload.pic) {
      throw new Error("Judul, equipment, dan PIC wajib diisi.");
    }

    const beforeFile = $("#beforePhoto").files[0];
    const afterFile = $("#afterPhoto").files[0];

    if (beforeFile) {
      payload.before_photo_path = await uploadPhoto(beforeFile, workId, "before");
    }

    if (afterFile) {
      payload.after_photo_path = await uploadPhoto(afterFile, workId, "after");
    }

    const { error } = await sb.from("works").upsert(payload);
    if (error) throw error;

    $("#workForm").reset();
    closeModal("#modal");
    showToast("Pekerjaan berhasil disimpan.");
    await loadWorks();
  } catch (error) {
    console.error("Gagal menyimpan pekerjaan:", error);
    showToast(`Gagal menyimpan: ${error.message}`, true);
  }
}

async function deleteWork(id) {
  try {
    requireRole(["admin"], "Hanya admin yang dapat menghapus pekerjaan.");

    if (!window.confirm("Hapus pekerjaan ini?")) return;

    const { error } = await sb.from("works").delete().eq("id", id);
    if (error) throw error;

    showToast("Pekerjaan berhasil dihapus.");
    await loadWorks();
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, true);
  }
}

/* =========================================================
 * ALUR TEKNISI
 * Open -> Proses -> Upload Foto -> Selesai
 * ========================================================= */

async function startTechnicianWork(id) {
  try {
    requireRole(["technician"], "Hanya teknisi yang dapat memulai pekerjaan.");

    const work = works.find(item => item.id === id);

    if (!work) throw new Error("Data pekerjaan tidak ditemukan.");
    if (work.status !== "Open") {
      throw new Error("Pekerjaan sudah dimulai atau sudah selesai.");
    }

    const confirmed = window.confirm(
      `Mulai pekerjaan "${work.title}"?\n\nStatus akan berubah dari Open menjadi Proses.`
    );

    if (!confirmed) return;

    const { error } = await sb.rpc("technician_start_work", {
      p_work_id: id
    });

    if (error) throw error;

    showToast("Pekerjaan dimulai. Status berubah menjadi Proses.");
    await loadWorks();
  } catch (error) {
    console.error("Gagal memulai pekerjaan:", error);
    showToast(`Gagal memulai pekerjaan: ${error.message}`, true);
  }
}

function openTechnicianPhotoModal(id) {
  try {
    requireRole(["technician"], "Hanya teknisi yang dapat mengunggah foto pekerjaan.");

    const work = works.find(item => item.id === id);

    if (!work) throw new Error("Data pekerjaan tidak ditemukan.");
    if (work.status !== "Proses") {
      throw new Error("Pekerjaan harus berstatus Proses sebelum foto ditambahkan.");
    }

    if (!$("#technicianPhotoModal")) {
      throw new Error("Modal foto teknisi belum ditambahkan pada index.html.");
    }

    $("#technicianWorkId").value = work.id;
    $("#technicianWorkTitle").textContent = work.title || "-";
    $("#technicianEquipment").textContent = work.equipment?.name || "-";
    $("#technicianAfterPhoto").value = "";
    $("#technicianPreviewImage")?.removeAttribute("src");
    $("#technicianPhotoPreview")?.classList.add("hidden");
    $("#technicianPhotoModal").classList.remove("hidden");
  } catch (error) {
    showToast(error.message, true);
  }
}

function closeTechnicianPhotoModal() {
  if (technicianPreviewUrl) {
    URL.revokeObjectURL(technicianPreviewUrl);
    technicianPreviewUrl = null;
  }

  $("#technicianPhotoForm")?.reset();
  $("#technicianPhotoPreview")?.classList.add("hidden");
  closeModal("#technicianPhotoModal");
}

function previewTechnicianPhoto(event) {
  const file = event.target.files[0];

  if (technicianPreviewUrl) {
    URL.revokeObjectURL(technicianPreviewUrl);
    technicianPreviewUrl = null;
  }

  if (!file) {
    $("#technicianPhotoPreview")?.classList.add("hidden");
    return;
  }

  technicianPreviewUrl = URL.createObjectURL(file);
  $("#technicianPreviewImage").src = technicianPreviewUrl;
  $("#technicianPhotoPreview")?.classList.remove("hidden");
}

async function saveTechnicianPhoto(event) {
  event.preventDefault();

  const saveButton = $("#technicianPhotoSave");
  let uploadedPath = null;

  try {
    requireRole(["technician"], "Hanya teknisi yang dapat mengunggah foto pekerjaan.");

    const workId = $("#technicianWorkId").value;
    const file = $("#technicianAfterPhoto").files[0];
    const work = works.find(item => item.id === workId);

    if (!workId || !work) throw new Error("Data pekerjaan tidak ditemukan.");
    if (work.status !== "Proses") throw new Error("Pekerjaan tidak lagi berstatus Proses.");
    if (!file) throw new Error("Foto sesudah pekerjaan wajib dipilih.");

    setButtonLoading(saveButton, true, "Mengunggah...", "Upload Foto & Selesaikan");

    uploadedPath = await uploadPhoto(file, workId, "after");

    const { error } = await sb.rpc("technician_complete_work", {
      p_work_id: workId,
      p_after_photo_path: uploadedPath
    });

    if (error) throw error;

    closeTechnicianPhotoModal();
    showToast("Foto berhasil diunggah. Pekerjaan selesai dan menunggu verifikasi user.");
    await loadWorks();
  } catch (error) {
    console.error("Gagal mengunggah foto pekerjaan:", error);
    showToast(`Gagal mengunggah foto: ${error.message}`, true);
  } finally {
    setButtonLoading(saveButton, false, "Mengunggah...", "Upload Foto & Selesaikan");
  }
}

/* =========================================================
 * PARAF DAN VERIFIKASI USER/ADMIN
 * ========================================================= */

function setupSignatureCanvas() {
  const canvas = $("#signatureCanvas");
  if (!canvas) return;

  signatureContext = canvas.getContext("2d");
  signatureContext.lineWidth = 3;
  signatureContext.lineCap = "round";
  signatureContext.strokeStyle = "#111827";

  const getPosition = event => {
    const rectangle = canvas.getBoundingClientRect();
    const pointer = event.touches?.[0] || event;

    return {
      x: (pointer.clientX - rectangle.left) * canvas.width / rectangle.width,
      y: (pointer.clientY - rectangle.top) * canvas.height / rectangle.height
    };
  };

  canvas.addEventListener("pointerdown", event => {
    signatureDrawing = true;
    const position = getPosition(event);
    signatureContext.beginPath();
    signatureContext.moveTo(position.x, position.y);
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!signatureDrawing) return;
    const position = getPosition(event);
    signatureContext.lineTo(position.x, position.y);
    signatureContext.stroke();
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach(eventName => {
    canvas.addEventListener(eventName, () => {
      signatureDrawing = false;
    });
  });
}

function clearSignature() {
  const canvas = $("#signatureCanvas");
  if (canvas && signatureContext) {
    signatureContext.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function openSignature(id) {
  try {
    requireRole(["user", "admin"], "Hanya user atau admin yang dapat melakukan verifikasi.");

    const work = works.find(item => item.id === id);

    if (!work) throw new Error("Data pekerjaan tidak ditemukan.");
    if (work.status !== "Selesai") {
      throw new Error("Pekerjaan belum dinyatakan selesai oleh teknisi.");
    }
    if (!work.after_photo_path) {
      throw new Error("Foto sesudah pekerjaan belum tersedia.");
    }
    if (work.verified_at) {
      throw new Error("Pekerjaan ini sudah diverifikasi.");
    }

    signWorkId = id;
    clearSignature();
    $("#signatureModal")?.classList.remove("hidden");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveVerification() {
  const saveButton = $("#saveSignature");

  try {
    requireRole(["user", "admin"], "Anda tidak memiliki izin melakukan verifikasi.");

    if (!signWorkId) throw new Error("Pekerjaan yang akan diverifikasi tidak ditemukan.");

    const canvas = $("#signatureCanvas");
    const signatureBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

    if (!signatureBlob || signatureBlob.size < 500) {
      throw new Error("Buat paraf terlebih dahulu.");
    }

    setButtonLoading(saveButton, true, "Menyimpan...", "Simpan & Verifikasi");

    const signaturePath = `signatures/${signWorkId}-${Date.now()}.png`;

    const { error: uploadError } = await sb.storage
      .from(C.PHOTO_BUCKET)
      .upload(signaturePath, signatureBlob, {
        contentType: "image/png",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: verificationError } = await sb.rpc("user_verify_work", {
      p_work_id: signWorkId,
      p_signature_path: signaturePath
    });

    if (verificationError) throw verificationError;

    closeModal("#signatureModal");
    signWorkId = null;
    showToast("Pekerjaan berhasil diverifikasi.");
    await loadWorks();
  } catch (error) {
    console.error("Verifikasi pekerjaan gagal:", error);
    showToast(`Verifikasi gagal: ${error.message}`, true);
  } finally {
    setButtonLoading(saveButton, false, "Menyimpan...", "Simpan & Verifikasi");
  }
}

/* =========================================================
 * IMPORT EXCEL
 * ========================================================= */

async function readExcel(file) {
  if (!file) throw new Error("Pilih file Excel terlebih dahulu.");

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
}

function convertExcelDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  return String(value).slice(0, 10);
}

async function importWorks(event) {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengimpor pekerjaan.");

    const rows = await readExcel(event.target.files[0]);

    const payload = rows.map(row => ({
      title: String(row["Judul"] || "").trim(),
      pic: String(row["PIC"] || "").trim(),
      work_type: row["Jenis"],
      priority: row["Prioritas"] || "Medium",
      due_date: convertExcelDate(row["Tanggal Rencana"]),
      status: row["Status"] || "Open",
      description: row["Deskripsi"] || "",
      equipment_id: equipment.find(item =>
        String(item.code_number) === String(row["Code Number"])
      )?.id,
      created_by: session.user.id
    })).filter(row => row.title && row.pic && row.equipment_id);

    if (!payload.length) {
      throw new Error("Tidak ada baris valid. Periksa Code Number dan header template.");
    }

    const { error } = await sb.from("works").insert(payload);
    if (error) throw error;

    showToast(`${payload.length} pekerjaan berhasil diimpor.`);
    event.target.value = "";
    await loadWorks();
  } catch (error) {
    showToast(`Import pekerjaan gagal: ${error.message}`, true);
  }
}

async function importMaster(event) {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengimpor equipment.");

    const rows = await readExcel(event.target.files[0]);

    const payload = rows.map(row => ({
      name: String(row["Equipment"] || "").trim(),
      plant: String(row["Plant"] || "").trim(),
      code_number: String(row["Code Number"] || "").trim(),
      funloc: String(row["Funloc"] || "").trim()
    })).filter(row => row.name && row.code_number);

    if (!payload.length) throw new Error("Tidak ada data equipment yang valid.");

    const { error } = await sb
      .from("equipment")
      .upsert(payload, { onConflict: "code_number" });

    if (error) throw error;

    showToast(`${payload.length} equipment berhasil diperbarui.`);
    event.target.value = "";
    await loadEquipment();
  } catch (error) {
    showToast(`Import equipment gagal: ${error.message}`, true);
  }
}

/* =========================================================
 * MASTER EQUIPMENT
 * ========================================================= */

function renderMaster() {
  const table = $("#masterTable");
  if (!table) return;

  table.innerHTML = equipment.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.plant || "-")}</td>
      <td>${escapeHtml(item.code_number)}</td>
      <td>${escapeHtml(item.funloc || "-")}</td>
      <td>
        <button class="mini-btn" data-master-edit="${item.id}" type="button">
          ✎ Edit
        </button>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="5">Belum ada equipment.</td></tr>';

  $$('[data-master-edit]').forEach(button => {
    button.onclick = () => {
      const item = equipment.find(value => value.id === button.dataset.masterEdit);
      editMaster(item);
    };
  });
}

async function editMaster(item = null) {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengelola equipment.");

    const name = window.prompt("Nama equipment", item?.name || "");
    if (!name) return;

    const plant = window.prompt("Plant", item?.plant || "") ?? "";
    const codeNumber = window.prompt("Code Number", item?.code_number || "");
    if (!codeNumber) throw new Error("Code Number wajib diisi.");

    const funloc = window.prompt("Funloc", item?.funloc || "") ?? "";

    const payload = {
      name: name.trim(),
      plant: plant.trim(),
      code_number: codeNumber.trim(),
      funloc: funloc.trim()
    };

    if (item?.id) payload.id = item.id;

    const { error } = await sb.from("equipment").upsert(payload);
    if (error) throw error;

    showToast("Equipment berhasil disimpan.");
    await loadEquipment();
  } catch (error) {
    showToast(`Gagal menyimpan equipment: ${error.message}`, true);
  }
}

/* =========================================================
 * KELOLA PENGGUNA
 * ========================================================= */

async function loadUsers() {
  if (profile?.role !== "admin") return;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .order("full_name");

  if (error) {
    showToast(`Gagal mengambil pengguna: ${error.message}`, true);
    return;
  }

  const table = $("#userTable");
  if (!table) return;

  table.innerHTML = (data || []).map(user => `
    <tr>
      <td>${escapeHtml(user.full_name || "-")}</td>
      <td>${escapeHtml(user.email || "-")}</td>
      <td>
        <select data-role-change="${user.id}">
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          <option value="technician" ${user.role === "technician" ? "selected" : ""}>technician</option>
          <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
        </select>
      </td>
      <td>${user.is_active ? "Aktif" : "Nonaktif"}</td>
      <td>
        <button
          class="mini-btn"
          data-toggle-user="${user.id}"
          data-active="${user.is_active}"
          type="button"
        >
          ${user.is_active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </td>
    </tr>
  `).join("");

  $$('[data-role-change]').forEach(select => {
    select.onchange = () => updateProfile(select.dataset.roleChange, {
      role: select.value
    });
  });

  $$('[data-toggle-user]').forEach(button => {
    button.onclick = () => updateProfile(button.dataset.toggleUser, {
      is_active: button.dataset.active !== "true"
    });
  });
}

async function updateProfile(id, updates) {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengubah pengguna.");

    const { error } = await sb.from("profiles").update(updates).eq("id", id);
    if (error) throw error;

    showToast("Pengguna berhasil diperbarui.");
    await loadUsers();
  } catch (error) {
    showToast(`Gagal memperbarui pengguna: ${error.message}`, true);
  }
}

async function inviteUser() {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengundang pengguna.");

    const email = window.prompt("Email pengguna baru");
    if (!email) return;

    const fullName = window.prompt("Nama lengkap") || email;
    const role = (window.prompt("Role: admin / technician / user", "user") || "user")
      .toLowerCase()
      .trim();

    if (!["admin", "technician", "user"].includes(role)) {
      throw new Error("Role harus admin, technician, atau user.");
    }

    const { data, error } = await sb.functions.invoke("admin-user", {
      body: {
        email: email.trim(),
        full_name: fullName.trim(),
        role
      }
    });

    if (error) throw error;

    showToast(data?.message || "Undangan pengguna berhasil dikirim.");
    await loadUsers();
  } catch (error) {
    showToast(`Undangan gagal: ${error.message}`, true);
  }
}

/* =========================================================
 * EXPORT XLSX DENGAN FOTO
 * ========================================================= */

async function compressImage(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);

    image.onload = () => {
      try {
        const maximumSize = 900;
        const scale = Math.min(1, maximumSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(compressedBlob => {
          URL.revokeObjectURL(objectUrl);

          if (!compressedBlob) {
            reject(new Error("Foto tidak dapat dikompresi."));
            return;
          }

          resolve(compressedBlob);
        }, "image/jpeg", 0.72);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Foto tidak dapat dibaca browser."));
    };

    image.src = objectUrl;
  });
}

async function addPhotoToWorksheet(workbook, worksheet, path, column, rowNumber) {
  if (!path) return;

  try {
    const publicUrl = getPublicPhotoUrl(path);
    if (!publicUrl) return;

    const response = await fetch(publicUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const originalBlob = await response.blob();
    const compressedBlob = await compressImage(originalBlob);
    const buffer = await compressedBlob.arrayBuffer();

    const imageId = workbook.addImage({
      buffer,
      extension: "jpeg"
    });

    worksheet.addImage(imageId, {
      tl: { col: column - 1 + 0.08, row: rowNumber - 1 + 0.08 },
      ext: { width: 110, height: 75 }
    });
  } catch (error) {
    console.warn("Foto tidak dapat dimasukkan ke XLSX:", path, error);
  }
}

async function exportXlsx(returnBlob = false) {
  try {
    if (typeof ExcelJS === "undefined") {
      throw new Error("Library ExcelJS tidak termuat.");
    }

    if (!returnBlob && typeof saveAs === "undefined") {
      throw new Error("Library FileSaver tidak termuat.");
    }

    showToast("Membuat file XLSX...");

    const reportWorks = getFilteredWorks();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report", {
      properties: { defaultRowHeight: 55 }
    });

    worksheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Pekerjaan", key: "title", width: 32 },
      { header: "Equipment", key: "equipment", width: 22 },
      { header: "Code Number", key: "code", width: 18 },
      { header: "Jenis", key: "type", width: 24 },
      { header: "Prioritas", key: "priority", width: 12 },
      { header: "PIC", key: "pic", width: 18 },
      { header: "Status", key: "status", width: 18 },
      { header: "Foto Sebelum", key: "before", width: 18 },
      { header: "Foto Sesudah", key: "after", width: 18 },
      { header: "Verifikasi", key: "verified", width: 22 }
    ];

    const header = worksheet.getRow(1);
    header.height = 28;
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" }
    };
    header.alignment = { vertical: "middle", horizontal: "center" };

    for (const [index, work] of reportWorks.entries()) {
      const rowNumber = index + 2;
      const row = worksheet.addRow({
        no: index + 1,
        title: work.title,
        equipment: work.equipment?.name || "-",
        code: work.equipment?.code_number || "-",
        type: work.work_type,
        priority: work.priority,
        pic: work.pic,
        status: work.verified_at ? "Selesai Terverifikasi" : work.status,
        verified: work.verified_by_name || ""
      });

      row.height = 82;
      row.alignment = { vertical: "middle", wrapText: true };

      await addPhotoToWorksheet(workbook, worksheet, work.before_photo_path, 9, rowNumber);
      await addPhotoToWorksheet(workbook, worksheet, work.after_photo_path, 10, rowNumber);
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: "K1" };

    worksheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    if (returnBlob) return blob;

    const filename = `maintenance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, filename);
    showToast("File XLSX berhasil dibuat.");
    return null;
  } catch (error) {
    console.error("Export XLSX gagal:", error);
    showToast(`Export gagal: ${error.message}`, true);
    throw error;
  }
}

/* =========================================================
 * KIRIM EMAIL MANUAL
 * ========================================================= */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function sendEmail() {
  try {
    requireRole(["admin"], "Hanya admin yang dapat mengirim report.");

    const recipient = window.prompt(
      "Kirim report ke email:",
      C.REPORT_RECIPIENT || ""
    );

    if (!recipient) return;

    const blob = await exportXlsx(true);
    const attachmentBase64 = await blobToBase64(blob);
    const filename = `maintenance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    const { data, error } = await sb.functions.invoke("send-report", {
      body: {
        to: recipient.trim(),
        filename,
        attachmentBase64
      }
    });

    if (error) throw error;

    showToast(data?.message || "Email berhasil dikirim.");
  } catch (error) {
    console.error("Pengiriman email gagal:", error);
    showToast(`Email gagal: ${error.message}`, true);
  }
}

/* =========================================================
 * MULAI APLIKASI
 * ========================================================= */

init().catch(error => {
  console.error("Inisialisasi aplikasi gagal:", error);
  showToast(`Aplikasi gagal dimuat: ${error.message}`, true);
});
