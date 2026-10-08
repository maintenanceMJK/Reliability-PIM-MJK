"use strict";

const C = window.APP_CONFIG;
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let session = null;
let profile = null;
let works = [];
let equipment = [];
let verifyId = null;
let signatureContext = null;
let drawing = false;
let previewUrl = null;

function icons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.9 } });
}

function toast(message, isError = false) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.className = "toast", 4200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function publicPhotoUrl(path) {
  if (!path) return null;
  return sb.storage.from(C.PHOTO_BUCKET).getPublicUrl(path).data?.publicUrl || null;
}

function reportFileName() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `maintenance-report-${day}-${month}-${now.getFullYear()}.xlsx`;
}

async function init() {
  bindEvents();
  setupSignatureCanvas();
  icons();
  $("#today").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
  const { data, error } = await sb.auth.getSession();
  if (error) toast(error.message, true);
  data?.session ? await enterApplication(data.session) : showLogin();
  sb.auth.onAuthStateChange(async (_event, nextSession) => {
    nextSession ? await enterApplication(nextSession) : showLogin();
  });
}

function bindEvents() {
  $("#loginForm").onsubmit = login;
  $("#logoutBtn").onclick = () => sb.auth.signOut();
  $$("#nav button").forEach(button => button.onclick = () => changePage(button.dataset.page, button));
  $$('[data-goto]').forEach(button => button.onclick = () => changePage(button.dataset.goto, $(`[data-page="${button.dataset.goto}"]`)));
  $$('[data-close]').forEach(button => button.onclick = () => $("#" + button.dataset.close).classList.add("hidden"));
  $("#addBtn").onclick = () => openAdminForm();
  $("#workForm").onsubmit = saveWork;
  $("#workTable").onclick = handleTableClick;
  ["searchInput", "statusFilter", "priorityFilter", "typeFilter", "picFilter"].forEach(id => $("#" + id).oninput = renderWorks);
  $("#resetFilter").onclick = resetFilters;
  $("#photoForm").onsubmit = saveTechnicianPhoto;
  $("#technicianPhoto").onchange = previewTechnicianPhoto;
  $("#clearSignature").onclick = clearSignature;
  $("#saveSignature").onclick = saveVerification;
  $("#exportBtn").onclick = () => exportXlsx(false);
  $("#emailBtn").onclick = sendEmail;
  $("#masterAddBtn").onclick = () => editMaster();
  $("#userAddBtn").onclick = inviteUser;
}

async function login(event) {
  event.preventDefault();
  const button = $("#loginButton");
  const message = $("#loginMsg");
  button.disabled = true;
  message.textContent = "Memeriksa akun...";
  const { error } = await sb.auth.signInWithPassword({
    email: $("#loginEmail").value.trim(),
    password: $("#loginPassword").value
  });
  message.textContent = error ? error.message : "";
  button.disabled = false;
}

function showLogin() {
  session = null;
  profile = null;
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
}

async function enterApplication(nextSession) {
  session = nextSession;
  const { data, error } = await sb.from("profiles").select("*").eq("id", nextSession.user.id).single();
  if (error || !data) {
    $("#loginMsg").textContent = `Profil pengguna tidak tersedia: ${error?.message || ""}`;
    return;
  }
  if (!data.is_active) {
    toast("Akun dinonaktifkan.", true);
    await sb.auth.signOut();
    return;
  }
  profile = data;
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#userName").textContent = data.full_name || nextSession.user.email;
  $("#userRole").textContent = data.role;
  $$('[data-admin]').forEach(element => element.classList.toggle("hidden", data.role !== "admin"));
  await Promise.all([loadEquipment(), loadWorks(), data.role === "admin" ? loadUsers() : Promise.resolve()]);
  icons();
}

function changePage(name, button) {
  if (["manage", "users"].includes(name) && profile.role !== "admin") return;
  $$(".page").forEach(page => page.classList.add("hidden"));
  $("#" + name + "Page").classList.remove("hidden");
  $$("#nav button").forEach(item => item.classList.remove("active"));
  button?.classList.add("active");
  $("#pageTitle").textContent = { dashboard: "Dashboard", works: "Pekerjaan", manage: "Master Data", users: "Pengguna" }[name];
}

async function loadWorks() {
  const { data, error } = await sb.from("works").select("*,equipment(*)").order("created_at", { ascending: false });
  if (error) return toast(error.message, true);
  works = data || [];
  renderDashboard();
}

async function loadEquipment() {
  const { data, error } = await sb.from("equipment").select("*").order("name");
  if (error) return toast(error.message, true);
  equipment = data || [];
  $("#equipmentId").innerHTML = '<option value="">Pilih equipment</option>' + equipment.map(item =>
    `<option value="${item.id}">${escapeHtml(item.name)} | ${escapeHtml(item.code_number)}</option>`
  ).join("");
  renderMaster();
}

function renderDashboard() {
  $("#kpiTotal").textContent = works.length;
  $("#kpiOpen").textContent = works.filter(work => work.status === "Open").length;
  $("#kpiProcess").textContent = works.filter(work => work.status === "Proses" || (work.status === "Selesai" && !work.verified_at)).length;
  $("#kpiDone").textContent = works.filter(work => work.verified_at).length;
  $("#recentList").innerHTML = works.slice(0, 6).map(work => `
    <div class="recent-item"><div><strong>${escapeHtml(work.title)}</strong><br>
    <small class="muted">${escapeHtml(work.equipment?.name || "-")} • ${escapeHtml(work.pic || "-")}</small></div>
    <span class="badge ${escapeHtml(work.status)}">${work.verified_at ? "Terverifikasi" : escapeHtml(work.status)}</span></div>
  `).join("") || '<p class="muted">Belum ada data.</p>';
  renderWorks();
}

function filteredWorks() {
  const query = $("#searchInput").value.toLowerCase();
  const status = $("#statusFilter").value;
  const priority = $("#priorityFilter").value;
  const type = $("#typeFilter").value;
  const pic = $("#picFilter").value.toLowerCase();
  return works.filter(work => {
    const searchable = [work.title, work.description, work.pic, work.equipment?.name].join(" ").toLowerCase();
    return searchable.includes(query) && (!status || work.status === status) && (!priority || work.priority === priority) &&
      (!type || work.work_type === type) && (!pic || String(work.pic || "").toLowerCase().includes(pic));
  });
}

function resetFilters() {
  ["searchInput", "statusFilter", "priorityFilter", "typeFilter", "picFilter"].forEach(id => $("#" + id).value = "");
  renderWorks();
}

function tablePhoto(path) {
  const photoUrl = publicPhotoUrl(path);
  return photoUrl ? `<a href="${photoUrl}" target="_blank" rel="noopener"><img class="photo" src="${photoUrl}" alt="Foto pekerjaan"></a>` : "";
}

function verificationCell(work) {
  if (work.verified_at) return `✓ ${escapeHtml(work.verified_by_name || "Terverifikasi")}`;
  if (["user", "admin"].includes(profile.role) && work.status === "Selesai" && work.after_photo_path) {
    return `<button class="mini-btn btn-upload" data-verify="${work.id}"><i data-lucide="signature"></i>Verifikasi</button>`;
  }
  if (work.status === "Proses") return "Menunggu teknisi";
  if (work.status === "Selesai") return "Menunggu user";
  return "Belum dimulai";
}

function actionButtons(work) {
  const buttons = [`<button class="mini-btn" data-detail="${work.id}"><i data-lucide="eye"></i>Detail</button>`];
  if (profile.role === "admin") {
    buttons.push(`<button class="mini-btn" data-edit="${work.id}"><i data-lucide="pencil"></i>Edit</button>`);
    buttons.push(`<button class="mini-btn" data-delete="${work.id}"><i data-lucide="trash-2"></i>Hapus</button>`);
  }
  if (profile.role === "technician" && work.status === "Open") {
    buttons.push(`<button class="mini-btn btn-start" data-start="${work.id}"><i data-lucide="play"></i>Mulai</button>`);
  }
  if (profile.role === "technician" && work.status === "Proses") {
    buttons.push(`<button class="mini-btn btn-upload" data-photo="${work.id}"><i data-lucide="camera"></i>Foto</button>`);
  }
  return `<div class="action-group">${buttons.join("")}</div>`;
}

function renderWorks() {
  $("#workTable").innerHTML = filteredWorks().map((work, index) => `
    <tr><td>${index + 1}</td><td><strong>${escapeHtml(work.title)}</strong><br><small class="muted">${escapeHtml(work.description || "")}</small></td>
    <td>${escapeHtml(work.equipment?.name || "-")}</td><td>${escapeHtml(work.work_type || "-")}</td>
    <td>${escapeHtml(work.priority || "-")}</td><td>${escapeHtml(work.pic || "-")}</td>
    <td><span class="badge ${escapeHtml(work.status)}">${work.verified_at ? "Terverifikasi" : escapeHtml(work.status)}</span></td>
    <td>${tablePhoto(work.before_photo_path)} ${tablePhoto(work.after_photo_path)}</td>
    <td>${verificationCell(work)}</td><td>${actionButtons(work)}</td></tr>
  `).join("") || '<tr><td colspan="10">Data tidak ditemukan.</td></tr>';
  icons();
}

function handleTableClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.detail) openDetail(button.dataset.detail);
  else if (button.dataset.edit) openAdminForm(button.dataset.edit);
  else if (button.dataset.delete) deleteWork(button.dataset.delete);
  else if (button.dataset.start) startWork(button.dataset.start);
  else if (button.dataset.photo) openPhotoModal(button.dataset.photo);
  else if (button.dataset.verify) openVerification(button.dataset.verify);
}

function openDetail(id) {
  const work = works.find(item => item.id === id);
  if (!work) return toast("Pekerjaan tidak ditemukan.", true);
  const item = (label, value, className = "") => `<div class="detail-item ${className}"><small>${label}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
  const image = path => publicPhotoUrl(path) ? `<img class="detail-photo" src="${publicPhotoUrl(path)}" alt="Foto pekerjaan">` : "Belum tersedia";
  $("#detailGrid").innerHTML = item("Judul", work.title, "span2") + item("Equipment", work.equipment?.name) + item("PIC", work.pic) +
    item("Jenis", work.work_type) + item("Prioritas", work.priority) + item("Status", work.verified_at ? "Terverifikasi" : work.status) +
    `<div class="detail-item span2"><small>Deskripsi</small><p>${escapeHtml(work.description || "-")}</p></div>` +
    `<div class="detail-item"><small>Foto sebelum</small>${image(work.before_photo_path)}</div>` +
    `<div class="detail-item"><small>Foto sesudah</small>${image(work.after_photo_path)}</div>`;
  $("#detailModal").classList.remove("hidden");
}

function openAdminForm(id) {
  if (profile.role !== "admin") return;
  const work = works.find(item => item.id === id);
  $("#workModalTitle").textContent = work ? "Edit Pekerjaan" : "Tambah Pekerjaan";
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
  $("#workModal").classList.remove("hidden");
}

async function uploadPhoto(file, workId, kind) {
  if (!file) return null;
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${workId}/${kind}-${Date.now()}.${extension}`;
  const { error } = await sb.storage.from(C.PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

async function saveWork(event) {
  event.preventDefault();
  try {
    if (profile.role !== "admin") throw new Error("Hanya admin yang dapat menyimpan pekerjaan.");
    const existingId = $("#workId").value;
    const oldWork = works.find(item => item.id === existingId);
    const id = existingId || crypto.randomUUID();
    const payload = {
      id, title: $("#title").value.trim(), equipment_id: $("#equipmentId").value,
      pic: $("#pic").value.trim(), work_type: $("#type").value, priority: $("#priority").value,
      due_date: $("#dueDate").value || null, status: $("#status").value,
      description: $("#description").value.trim(), created_by: oldWork?.created_by || session.user.id,
      updated_at: new Date().toISOString()
    };
    const before = await uploadPhoto($("#beforePhoto").files[0], id, "before");
    const after = await uploadPhoto($("#afterPhoto").files[0], id, "after");
    if (before) payload.before_photo_path = before;
    if (after) payload.after_photo_path = after;
    const { error } = await sb.from("works").upsert(payload);
    if (error) throw error;
    $("#workModal").classList.add("hidden");
    toast("Pekerjaan berhasil disimpan.");
    await loadWorks();
  } catch (error) {
    toast(error.message, true);
  }
}

async function deleteWork(id) {
  if (profile.role !== "admin" || !confirm("Hapus pekerjaan ini?")) return;
  const { error } = await sb.from("works").delete().eq("id", id);
  error ? toast(error.message, true) : await loadWorks();
}

async function startWork(id) {
  if (!confirm("Mulai pekerjaan ini?")) return;
  const { error } = await sb.rpc("technician_start_work", { p_work_id: id });
  if (error) return toast(error.message, true);
  toast("Pekerjaan dimulai.");
  await loadWorks();
}

function openPhotoModal(id) {
  const work = works.find(item => item.id === id);
  if (!work) return;
  $("#photoWorkId").value = id;
  $("#photoWorkInfo").innerHTML = `<small class="eyebrow">PEKERJAAN</small><h3>${escapeHtml(work.title)}</h3><p class="muted">${escapeHtml(work.equipment?.name || "-")}</p>`;
  $("#technicianPhoto").value = "";
  $("#photoPreview").classList.add("hidden");
  $("#photoModal").classList.remove("hidden");
}

function previewTechnicianPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $("#previewImage").src = previewUrl;
  $("#photoPreview").classList.remove("hidden");
}

async function saveTechnicianPhoto(event) {
  event.preventDefault();
  try {
    const id = $("#photoWorkId").value;
    const file = $("#technicianPhoto").files[0];
    if (!file) throw new Error("Foto wajib dipilih.");
    const path = await uploadPhoto(file, id, "after");
    const { error } = await sb.rpc("technician_complete_work", { p_work_id: id, p_after_photo_path: path });
    if (error) throw error;
    $("#photoModal").classList.add("hidden");
    toast("Foto berhasil. Menunggu verifikasi user.");
    await loadWorks();
  } catch (error) {
    toast(error.message, true);
  }
}

function setupSignatureCanvas() {
  const canvas = $("#signatureCanvas");
  signatureContext = canvas.getContext("2d");
  signatureContext.lineWidth = 3;
  signatureContext.lineCap = "round";
  const position = event => {
    const rectangle = canvas.getBoundingClientRect();
    return { x: (event.clientX - rectangle.left) * canvas.width / rectangle.width, y: (event.clientY - rectangle.top) * canvas.height / rectangle.height };
  };
  canvas.onpointerdown = event => { drawing = true; const point = position(event); signatureContext.beginPath(); signatureContext.moveTo(point.x, point.y); };
  canvas.onpointermove = event => { if (!drawing) return; const point = position(event); signatureContext.lineTo(point.x, point.y); signatureContext.stroke(); };
  canvas.onpointerup = canvas.onpointerleave = () => drawing = false;
}

function clearSignature() {
  signatureContext.clearRect(0, 0, $("#signatureCanvas").width, $("#signatureCanvas").height);
}

function openVerification(id) {
  verifyId = id;
  clearSignature();
  $("#signatureModal").classList.remove("hidden");
}

async function saveVerification() {
  try {
    const blob = await new Promise(resolve => $("#signatureCanvas").toBlob(resolve, "image/png"));
    if (!blob || blob.size < 500) throw new Error("Buat paraf terlebih dahulu.");
    const path = `signatures/${verifyId}-${Date.now()}.png`;
    const uploadResult = await sb.storage.from(C.PHOTO_BUCKET).upload(path, blob, { contentType: "image/png" });
    if (uploadResult.error) throw uploadResult.error;
    const result = await sb.rpc("user_verify_work", { p_work_id: verifyId, p_signature_path: path });
    if (result.error) throw result.error;
    $("#signatureModal").classList.add("hidden");
    toast("Pekerjaan berhasil diverifikasi.");
    await loadWorks();
  } catch (error) {
    toast(error.message, true);
  }
}

function renderMaster() {
  if (!$("#masterTable")) return;
  $("#masterTable").innerHTML = equipment.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.plant || "-")}</td><td>${escapeHtml(item.code_number)}</td><td>${escapeHtml(item.funloc || "-")}</td><td><button class="mini-btn" data-master="${item.id}">Edit</button></td></tr>`).join("");
  $$('[data-master]').forEach(button => button.onclick = () => editMaster(equipment.find(item => item.id === button.dataset.master)));
}

async function editMaster(item = null) {
  if (profile?.role !== "admin") return;
  const name = prompt("Equipment", item?.name || "");
  if (!name) return;
  const payload = { id: item?.id, name, plant: prompt("Plant", item?.plant || "") || "", code_number: prompt("Code Number", item?.code_number || "") || "", funloc: prompt("Funloc", item?.funloc || "") || "" };
  const { error } = await sb.from("equipment").upsert(payload);
  error ? toast(error.message, true) : await loadEquipment();
}

async function loadUsers() {
  const { data, error } = await sb.from("profiles").select("*").order("full_name");
  if (error) return toast(error.message, true);
  $("#userTable").innerHTML = (data || []).map(user => `<tr><td>${escapeHtml(user.full_name || "-")}</td><td>${escapeHtml(user.email || "-")}</td><td>${escapeHtml(user.role)}</td><td>${user.is_active ? "Aktif" : "Nonaktif"}</td></tr>`).join("");
}

async function inviteUser() {
  const email = prompt("Email pengguna");
  if (!email) return;
  const full_name = prompt("Nama lengkap") || email;
  const role = prompt("Role: admin / technician / user", "user") || "user";
  const { error } = await sb.functions.invoke("admin-user", { body: { email, full_name, role } });
  toast(error ? error.message : "Undangan dikirim.", Boolean(error));
}

async function getPhotoBlob(path) {
  if (!path) return null;
  try {
    const photoUrl = publicPhotoUrl(path);
    if (photoUrl) {
      const response = await fetch(photoUrl, { cache: "no-store" });
      if (response.ok) return await response.blob();
    }
  } catch (error) {
    console.warn("Public URL foto gagal:", error);
  }
  const { data, error } = await sb.storage.from(C.PHOTO_BUCKET).download(path);
  if (error) throw error;
  return data;
}

async function compressPhoto(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);
    image.onload = () => {
      const scale = Math.min(1, 900 / image.width, 700 / image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(result => { URL.revokeObjectURL(objectUrl); result ? resolve(result) : reject(new Error("Foto gagal dikompresi.")); }, "image/jpeg", 0.72);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Foto tidak dapat dibaca.")); };
    image.src = objectUrl;
  });
}

async function addPhotoToExcel(workbook, worksheet, path, column, row) {
  if (!path) return;
  try {
    const compressed = await compressPhoto(await getPhotoBlob(path));
    const imageId = workbook.addImage({ buffer: await compressed.arrayBuffer(), extension: "jpeg" });
    worksheet.addImage(imageId, { tl: { col: column - 1 + 0.12, row: row - 1 + 0.1 }, ext: { width: 120, height: 82 }, editAs: "oneCell" });
  } catch (error) {
    console.error("Foto gagal dimasukkan ke Excel:", path, error);
  }
}

async function exportXlsx(returnBlob = false) {
  try {
    toast("Membuat laporan XLSX...");
    const data = filteredWorks();
    if (!data.length) throw new Error("Tidak ada data yang dapat diekspor.");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");
    worksheet.columns = [
      { header: "No", key: "number", width: 7 }, { header: "Pekerjaan", key: "title", width: 32 },
      { header: "Equipment", key: "equipment", width: 24 }, { header: "Jenis", key: "type", width: 26 },
      { header: "Prioritas", key: "priority", width: 14 }, { header: "PIC", key: "pic", width: 19 },
      { header: "Status", key: "status", width: 20 }, { header: "Foto Sebelum", key: "before", width: 19 },
      { header: "Foto Sesudah", key: "after", width: 19 }, { header: "Verifikasi", key: "verification", width: 24 }
    ];
    const header = worksheet.getRow(1);
    header.height = 30;
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    for (let index = 0; index < data.length; index += 1) {
      const work = data[index];
      const excelRow = index + 2;
      const row = worksheet.addRow({ number: index + 1, title: work.title, equipment: work.equipment?.name || "-", type: work.work_type,
        priority: work.priority, pic: work.pic, status: work.verified_at ? "Terverifikasi" : work.status,
        before: work.before_photo_path ? "" : "Tidak ada", after: work.after_photo_path ? "" : "Tidak ada",
        verification: work.verified_by_name || (work.verified_at ? "Terverifikasi" : "Belum diverifikasi") });
      row.height = 72;
      await addPhotoToExcel(workbook, worksheet, work.before_photo_path, 8, excelRow);
      await addPhotoToExcel(workbook, worksheet, work.after_photo_path, 9, excelRow);
      toast(`Memproses laporan ${index + 1} dari ${data.length}...`);
    }
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: "J1" };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (returnBlob) return blob;
    saveAs(blob, reportFileName());
    toast("XLSX dengan foto berhasil dibuat.");
    return blob;
  } catch (error) {
    toast("Export gagal: " + error.message, true);
    return null;
  }
}

async function sendEmail() {
  const recipient = prompt("Email penerima", C.REPORT_RECIPIENT || "");
  if (!recipient) return;
  try {
    const blob = await exportXlsx(true);
    if (!blob) throw new Error("File XLSX gagal dibuat.");
    const attachmentBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("File XLSX gagal dibaca."));
      reader.readAsDataURL(blob);
    });
    toast("Mengirim melalui Gmail...");
    const { data, error } = await sb.functions.invoke("send-report", {
      body: { to: recipient.trim(), filename: reportFileName(), attachmentBase64 }
    });
    if (error) {
      let message = error.message;
      if (error.context) {
        try { const response = await error.context.json(); message = response.error || response.message || message; } catch {}
      }
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "Email Gmail gagal dikirim.");
    toast(data.message || "Email berhasil dikirim melalui Gmail.");
  } catch (error) {
    toast("Email gagal: " + error.message, true);
  }
}

init().catch(error => toast("Aplikasi gagal dimuat: " + error.message, true));
