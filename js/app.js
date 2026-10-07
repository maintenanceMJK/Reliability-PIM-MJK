const C=window.APP_CONFIG;const sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let session=null,profile=null,works=[],equipment=[],signWorkId=null;const toast=(m,e=false)=>{let t=$('#toast');t.textContent=m;t.className='toast show'+(e?' error':'');setTimeout(()=>t.className='toast',3200)};const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function init(){ $('#today').textContent=new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(new Date()); const {data}=await sb.auth.getSession(); if(data.session) await enter(data.session); else showLogin(); sb.auth.onAuthStateChange(async(_,s)=>s?enter(s):showLogin()); bind(); }
function bind(){ $('#loginForm').onsubmit=login;$('#logoutBtn').onclick=()=>sb.auth.signOut();$$('#nav button').forEach(b=>b.onclick=()=>page(b.dataset.page,b));
$("#detailModalClose").onclick = () => {
  $("#detailModal").classList.add("hidden");
};

$("#detailCloseButton").onclick = () => {
  $("#detailModal").classList.add("hidden");
};

$("#technicianPhotoClose").onclick = () => {
  $("#technicianPhotoModal").classList.add("hidden");
};

$("#technicianPhotoCancel").onclick = () => {
  $("#technicianPhotoModal").classList.add("hidden");
};

$("#technicianPhotoForm").onsubmit =
  saveTechnicianPhoto;

$("#technicianAfterPhoto").onchange = event => {
  const file = event.target.files[0];

  if (!file) {
    $("#technicianPhotoPreview").classList.add(
      "hidden"
    );

    return;
  }

  const previewUrl = URL.createObjectURL(file);

  $("#technicianPreviewImage").src = previewUrl;
  $("#technicianPhotoPreview").classList.remove(
    "hidden"
  );
};
$$('[data-goto]').forEach(b=>b.onclick=()=>page(b.dataset.goto,$(`[data-page="${b.dataset.goto}"]`)));$('#addBtn').onclick=()=>openWork();$('#modalClose').onclick=$('#cancelBtn').onclick=()=>$('#modal').classList.add('hidden');$('#workForm').onsubmit=saveWork;$('#searchInput').oninput=renderWorks;['statusFilter','priorityFilter','typeFilter','picFilter'].forEach(id=>$(`#${id}`).oninput=renderWorks);$('#resetFilter').onclick=()=>{['searchInput','statusFilter','priorityFilter','typeFilter','picFilter'].forEach(id=>$(`#${id}`).value='');renderWorks()};$('#exportBtn').onclick = async () => {
try {
await exportXlsx(false);
} catch (error) {
console.error("Export XLSX gagal:", error);
toast("Export gagal: " + error.message, true);
}
};$('#emailBtn').onclick=sendEmail;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=importWorks;$('#masterImportBtn').onclick=()=>$('#masterFile').click();$('#masterFile').onchange=importMaster;$('#masterAddBtn').onclick=()=>editMaster();$('#userAddBtn').onclick=inviteUser;$('#clearSignature').onclick=clearSig;$('#saveSignature').onclick=saveVerification;$$('[data-close-sign]').forEach(x=>x.onclick=()=>$('#signatureModal').classList.add('hidden'));setupCanvas()}
async function login(e){e.preventDefault();$('#loginMsg').textContent='Memeriksa...';let {error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value,password:$('#loginPassword').value});$('#loginMsg').textContent=error?error.message:''}
function showLogin(){$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden')}
async function enter(s){session=s;let {data,error}=await sb.from('profiles').select('*').eq('id',s.user.id).single();if(error){toast('Profil pengguna belum tersedia',true);return}profile=data;$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#userName').textContent=profile.full_name||s.user.email;$('#userRole').textContent=profile.role;$$('[data-role="admin"]').forEach(el=>el.classList.toggle('hidden',profile.role!=='admin'));await Promise.all([loadEquipment(),loadWorks(),profile.role==='admin'?loadUsers():Promise.resolve()]);}
function page(n,b){$$('.page').forEach(x=>x.classList.add('hidden'));$(`#${n}Page`).classList.remove('hidden');$$('#nav button').forEach(x=>x.classList.remove('active'));b?.classList.add('active');$('#pageTitle').textContent={dashboard:'Dashboard',works:'Pekerjaan',manage:'Kelola Master',users:'Kelola Pengguna'}[n]}
async function loadWorks(){let {data,error}=await sb.from('works').select('*,equipment(*)').order('created_at',{ascending:false});if(error)return toast(error.message,true);works=data||[];renderAll()}
async function loadEquipment(){let {data,error}=await sb.from('equipment').select('*').order('name');if(error)return toast(error.message,true);equipment=data||[];$('#equipmentId').innerHTML='<option value="">Pilih equipment</option>'+equipment.map(x=>`<option value="${x.id}">${esc(x.name)} | ${esc(x.code_number)}</option>`).join('');renderMaster()}
function renderAll(){let done=works.filter(x=>x.status==='Selesai'&&x.verified_at).length;$('#kpiTotal').textContent=works.length;$('#kpiOpen').textContent=works.filter(x=>x.status==='Open').length;$('#kpiProcess').textContent=works.filter(x=>x.status==='Proses'||(x.status==='Selesai'&&!x.verified_at)).length;$('#kpiDone').textContent=done;$('#recentList').innerHTML=works.slice(0,6).map(x=>`<div class="recent-item"><div><strong>${esc(x.title)}</strong><br><small>${esc(x.equipment?.name||'-')} • ${esc(x.pic)}</small></div><span class="badge ${x.status}">${x.verified_at?'Selesai':esc(x.status)}</span></div>`).join('')||'<p class="muted">Belum ada data.</p>';renderWorks()}
function filtered(){let q=$('#searchInput').value.toLowerCase(),s=$('#statusFilter').value,p=$('#priorityFilter').value,t=$('#typeFilter').value,pic=$('#picFilter').value.toLowerCase();return works.filter(x=>[x.title,x.pic,x.equipment?.name].join(' ').toLowerCase().includes(q)&&(!s||x.status===s)&&(!p||x.priority===p)&&(!t||x.work_type===t)&&(!pic||x.pic.toLowerCase().includes(pic)))}
function renderWorks(){let rows=filtered();$('#workTable').innerHTML=rows.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.title)}
</strong><br><small>${esc(x.description||'')}</small></td><td>${esc(x.equipment?.name||'-')}
</td><td>${esc(x.work_type)}</td><td>${esc(x.priority)}</td><td>${esc(x.pic)}</td><td>
<span class="badge ${x.status}">${x.verified_at?'Selesai':esc(x.status)}</span></td><td>${photo(x.before_photo_path)} 
${photo(x.after_photo_path)}</td><td>${x.verified_at?'✓ '+esc(x.verified_by_name||'Terverifikasi'):verifyButton(x)}</td>
<td>${actionButtons(x)}</td></tr>`).join('')||'<tr><td colspan="10" class="muted">Data tidak ditemukan.</td></tr>';
$$("[data-detail]").forEach(button => {
  button.onclick = () => {
    openWorkDetail(button.dataset.detail);
  };
});

$$("[data-edit]").forEach(button => {
  button.onclick = () => {
    openWork(button.dataset.edit);
  };
});

$$("[data-del]").forEach(button => {
  button.onclick = () => {
    delWork(button.dataset.del);
  };
});

$$("[data-start-work]").forEach(button => {
  button.onclick = () => {
    startTechnicianWork(
      button.dataset.startWork
    );
  };
});

$$("[data-upload-photo]").forEach(button => {
  button.onclick = () => {
    openTechnicianPhotoModal(
      button.dataset.uploadPhoto
    );
  };
});

$$("[data-verify]").forEach(button => {
  button.onclick = () => {
    openSignature(button.dataset.verify);
  };
});
function photo(path){if(!path)return '';let {data}=sb.storage.from(C.PHOTO_BUCKET).getPublicUrl(path);return `<a href="${data.publicUrl}" target="_blank"><img class="photo" src="${data.publicUrl}" alt="Foto"></a>`}
function verifyButton(work) {
  if (work.verified_at) {
    return `
      <span class="badge Selesai">
        ✓ Terverifikasi
      </span>
    `;
  }

  /*
   * Teknisi tidak dapat melakukan verifikasi.
   */
  if (profile.role === "technician") {
    if (work.status === "Open") {
      return "Belum dimulai";
    }

    if (work.status === "Proses") {
      return "Sedang dikerjakan";
    }

    return "Menunggu user";
  }

  /*
   * User/admin hanya dapat verifikasi setelah:
   * 1. Status Selesai
   * 2. Foto sesudah tersedia
   */
  const mayVerify =
    ["user", "admin"].includes(profile.role) &&
    work.status === "Selesai" &&
    Boolean(work.after_photo_path);

  if (!mayVerify) {
    if (work.status === "Open") {
      return "Belum dimulai";
    }

    if (work.status === "Proses") {
      return "Menunggu teknisi";
    }

    if (!work.after_photo_path) {
      return "Foto belum tersedia";
    }

    return "Belum dapat diverifikasi";
  }

  return `
    <button
      class="mini-btn btn-upload"
      data-verify="${work.id}"
      type="button"
    >
      ✍ Paraf & Verifikasi
    </button>
  `;
}
function actionButtons(work) {
  const buttons = [];

  /*
   * Semua role boleh melihat detail.
   */
  buttons.push(`
    <button
      class="mini-btn btn-detail"
      data-detail="${work.id}"
      type="button"
      title="Lihat detail pekerjaan"
    >
      👁 Detail
    </button>
  `);

  /*
   * Aksi admin.
   */
  if (profile.role === "admin") {
    buttons.push(`
      <button
        class="mini-btn"
        data-edit="${work.id}"
        type="button"
        title="Edit pekerjaan"
      >
        ✎ Edit
      </button>
    `);

    buttons.push(`
      <button
        class="mini-btn"
        data-del="${work.id}"
        type="button"
        title="Hapus pekerjaan"
      >
        🗑 Hapus
      </button>
    `);
  }

  /*
   * Aksi teknisi berdasarkan status.
   */
  if (profile.role === "technician") {
    if (work.status === "Open") {
      buttons.push(`
        <button
          class="mini-btn btn-start"
          data-start-work="${work.id}"
          type="button"
        >
          ▶ Mulai Pekerjaan
        </button>
      `);
    }

    if (
      work.status === "Proses" &&
      !work.after_photo_path
    ) {
      buttons.push(`
        <button
          class="mini-btn btn-upload"
          data-upload-photo="${work.id}"
          type="button"
        >
          📷 Tambahkan Foto
        </button>
      `);
    }

    if (
      work.status === "Selesai" &&
      !work.verified_at
    ) {
      buttons.push(`
        <button
          class="mini-btn btn-waiting"
          type="button"
          disabled
        >
          ⏳ Menunggu Verifikasi
        </button>
      `);
    }

    if (work.verified_at) {
      buttons.push(`
        <button
          class="mini-btn"
          type="button"
          disabled
        >
          ✓ Terverifikasi
        </button>
      `);
    }
  }

  return `
    <div class="action-group">
      ${buttons.join("")}
    </div>
  `;
}
function openWork(id) {
  /*
   * Form tambah/edit utama hanya boleh digunakan admin.
   */
  if (profile.role !== "admin") {
    if (id) {
      openWorkDetail(id);
    } else {
      toast(
        "Hanya admin yang dapat menambahkan pekerjaan.",
        true
      );
    }

    return;
  }

  const work = works.find(item => item.id === id);

  $("#modalTitle").textContent = work
    ? "Edit Pekerjaan"
    : "Tambah Pekerjaan";

  $("#workId").value = work?.id || "";
  $("#title").value = work?.title || "";
  $("#equipmentId").value = work?.equipment_id || "";
  $("#pic").value = work?.pic || "";
  $("#type").value =
    work?.work_type || "Preventive Maintenance";
  $("#priority").value =
    work?.priority || "Medium";
  $("#dueDate").value =
    work?.due_date || "";
  $("#status").value =
    work?.status || "Open";
  $("#description").value =
    work?.description || "";

  /*
   * Pastikan semua field aktif untuk admin.
   */
  [
    "#title",
    "#equipmentId",
    "#pic",
    "#type",
    "#priority",
    "#dueDate",
    "#status",
    "#description",
    "#beforePhoto",
    "#afterPhoto"
  ].forEach(selector => {
    const element = $(selector);

    if (element) {
      element.disabled = false;
    }
  });

  /*
   * Kosongkan pilihan file lama.
   */
  $("#beforePhoto").value = "";
  $("#afterPhoto").value = "";

  $("#modal").classList.remove("hidden");
}
function getPublicPhotoUrl(path) {
  if (!path) {
    return null;
  }

  const { data } = sb
    .storage
    .from(C.PHOTO_BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}
async function startTechnicianWork(id) {
  try {
    if (profile.role !== "technician") {
      throw new Error(
        "Hanya teknisi yang dapat memulai pekerjaan."
      );
    }

    const work = works.find(item => item.id === id);

    if (!work) {
      throw new Error("Data pekerjaan tidak ditemukan.");
    }

    if (work.status !== "Open") {
      throw new Error(
        "Pekerjaan sudah dimulai atau sudah selesai."
      );
    }

    const confirmed = confirm(
      `Mulai pekerjaan "${work.title}"?\n\n` +
      "Status akan berubah dari Open menjadi Proses."
    );

    if (!confirmed) {
      return;
    }

    const { error } = await sb.rpc(
      "technician_start_work",
      {
        p_work_id: id
      }
    );

    if (error) {
      throw error;
    }

    toast(
      "Pekerjaan dimulai. Status berubah menjadi Proses."
    );

    await loadWorks();
  } catch (error) {
    console.error("Gagal memulai pekerjaan:", error);

    toast(
      "Gagal memulai pekerjaan: " + error.message,
      true
    );
  }
}
function renderDetailPhoto(containerSelector, path, label) {
  const container = $(containerSelector);
  const publicUrl = getPublicPhotoUrl(path);

  if (!publicUrl) {
    container.innerHTML = "Belum tersedia";
    return;
  }

  container.innerHTML = `
    ${publicUrl}
      ${publicUrl}"
      >
    </a>
  `;
}
function openTechnicianPhotoModal(id) {
  if (profile.role !== "technician") {
    toast(
      "Hanya teknisi yang dapat mengunggah foto pekerjaan.",
      true
    );

    return;
  }

  const work = works.find(item => item.id === id);

  if (!work) {
    toast("Data pekerjaan tidak ditemukan.", true);
    return;
  }

  if (work.status !== "Proses") {
    toast(
      "Pekerjaan harus berstatus Proses sebelum foto ditambahkan.",
      true
    );

    return;
  }

  $("#technicianWorkId").value = work.id;
  $("#technicianWorkTitle").textContent =
    work.title || "-";
  $("#technicianEquipment").textContent =
    work.equipment?.name || "-";

  $("#technicianAfterPhoto").value = "";
  $("#technicianPreviewImage").removeAttribute("src");
  $("#technicianPhotoPreview").classList.add("hidden");

  $("#technicianPhotoModal").classList.remove("hidden");
}

async function saveTechnicianPhoto(e) {
  e.preventDefault();

  const saveButton = $("#technicianPhotoSave");

  try {
    if (profile.role !== "technician") {
      throw new Error(
        "Hanya teknisi yang dapat mengunggah foto pekerjaan."
      );
    }

    const workId = $("#technicianWorkId").value;
    const file = $("#technicianAfterPhoto").files[0];

    if (!workId) {
      throw new Error("ID pekerjaan tidak ditemukan.");
    }

    if (!file) {
      throw new Error(
        "Foto sesudah pekerjaan wajib dipilih."
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "Format foto harus JPG, PNG, atau WebP."
      );
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
      throw new Error(
        "Ukuran foto maksimal 10 MB."
      );
    }

    saveButton.disabled = true;
    saveButton.textContent = "Mengunggah...";

    /*
     * Upload file terlebih dahulu ke Supabase Storage.
     */
    const afterPhotoPath = await upload(
      file,
      workId,
      "after"
    );

    /*
     * Setelah upload berhasil, jalankan RPC.
     * RPC mengisi path foto dan mengubah status menjadi Selesai.
     */
    const { error } = await sb.rpc(
      "technician_complete_work",
      {
        p_work_id: workId,
        p_after_photo_path: afterPhotoPath
      }
    );

    if (error) {
      throw error;
    }

    $("#technicianPhotoModal").classList.add("hidden");
    $("#technicianPhotoForm").reset();
    $("#technicianPhotoPreview").classList.add("hidden");

    toast(
      "Foto berhasil diunggah. Pekerjaan selesai dan menunggu verifikasi user."
    );

    await loadWorks();
  } catch (error) {
    console.error(
      "Gagal mengunggah foto pekerjaan:",
      error
    );

    toast(
      "Gagal mengunggah foto: " + error.message,
      true
    );
  } finally {
    saveButton.disabled = false;
    saveButton.textContent =
      "Upload Foto & Selesaikan";
  }
}

function openWorkDetail(id) {
  const work = works.find(item => item.id === id);

  if (!work) {
    toast("Data pekerjaan tidak ditemukan.", true);
    return;
  }

  $("#detailTitle").textContent =
    work.title || "-";

  $("#detailEquipment").textContent =
    work.equipment?.name || "-";

  $("#detailPic").textContent =
    work.pic || "-";

  $("#detailType").textContent =
    work.work_type || "-";

  $("#detailPriority").textContent =
    work.priority || "-";

  $("#detailDueDate").textContent =
    work.due_date
      ? new Intl.DateTimeFormat("id-ID").format(
          new Date(`${work.due_date}T00:00:00`)
        )
      : "-";

  $("#detailStatus").textContent =
    work.verified_at
      ? "Selesai dan terverifikasi"
      : work.status || "-";

  $("#detailDescription").textContent =
    work.description || "Tidak ada deskripsi.";

  renderDetailPhoto(
    "#detailBeforePhoto",
    work.before_photo_path,
    "Foto sebelum pekerjaan"
  );

  renderDetailPhoto(
    "#detailAfterPhoto",
    work.after_photo_path,
    "Foto sesudah pekerjaan"
  );

  $("#detailModal").classList.remove("hidden");
}
async function upload(file,workId,kind){if(!file)return null;let ext=file.name.split('.').pop().toLowerCase(),path=`${workId}/${kind}-${Date.now()}.${ext}`;let {error}=await sb.storage.from(C.PHOTO_BUCKET).upload(path,file,{upsert:true});if(error)throw error;return path}
async function saveWork(e) {
  e.preventDefault();

  try {
    const existingId = $("#workId").value;
    const oldWork = works.find(work => work.id === existingId);

    /*
     * MODE TEKNISI
     * Teknisi hanya diperbolehkan mengunggah foto sesudah.
     * Teknisi tidak menggunakan upsert karena tidak memiliki izin INSERT.
     */
    if (profile.role === "technician") {
      if (!existingId || !oldWork) {
        throw new Error("Data pekerjaan tidak ditemukan.");
      }

      const afterFile = $("#afterPhoto").files[0];

      if (!afterFile) {
        throw new Error("Pilih foto sesudah pekerjaan terlebih dahulu.");
      }

      const afterPhotoPath = await upload(
        afterFile,
        existingId,
        "after"
      );

      const { error } = await sb
        .from("works")
        .update({
          after_photo_path: afterPhotoPath,
          status: "Proses",
          updated_at: new Date().toISOString()
        })
        .eq("id", existingId);

      if (error) {
        throw error;
      }

      toast("Foto pekerjaan selesai berhasil disimpan.");

      $("#workForm").reset();
      $("#modal").classList.add("hidden");

      await loadWorks();
      return;
    }

    /*
     * MODE USER
     * User biasa tidak boleh menyimpan form pekerjaan.
     */
    if (profile.role === "user") {
      throw new Error(
        "Pengguna tidak memiliki izin mengubah data pekerjaan."
      );
    }

    /*
     * MODE ADMIN
     * Admin boleh menambah dan mengedit seluruh data pekerjaan.
     */
    if (profile.role !== "admin") {
      throw new Error("Role pengguna tidak dikenali.");
    }

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

    const beforeFile = $("#beforePhoto").files[0];
    const afterFile = $("#afterPhoto").files[0];

    if (beforeFile) {
      payload.before_photo_path = await upload(
        beforeFile,
        workId,
        "before"
      );
    }

    if (afterFile) {
      payload.after_photo_path = await upload(
        afterFile,
        workId,
        "after"
      );
    }

    const { error } = await sb
      .from("works")
      .upsert(payload);

    if (error) {
      throw error;
    }

    toast("Pekerjaan berhasil disimpan.");

    $("#workForm").reset();
    $("#modal").classList.add("hidden");

    await loadWorks();
  } catch (error) {
    console.error("Gagal menyimpan pekerjaan:", error);
    toast("Gagal menyimpan: " + error.message, true);
  }
}
async function delWork(id){if(!confirm('Hapus pekerjaan ini?'))return;let {error}=await sb.from('works').delete().eq('id',id);if(error)return toast(error.message,true);toast('Pekerjaan dihapus');loadWorks()}
async function finishWork(id) {
  try {
    if (profile.role !== "technician" && profile.role !== "admin") {
      throw new Error(
        "Pengguna tidak memiliki izin menyelesaikan pekerjaan."
      );
    }

    const work = works.find(item => item.id === id);

    if (!work) {
      throw new Error("Data pekerjaan tidak ditemukan.");
    }

    if (!work.after_photo_path) {
      openWork(id);

      toast(
        "Tambahkan foto sesudah pekerjaan terlebih dahulu.",
        true
      );

      return;
    }

    const { error } = await sb
      .from("works")
      .update({
        status: "Selesai",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      throw error;
    }

    toast(
      "Pekerjaan selesai dan menunggu verifikasi pengguna."
    );

    await loadWorks();
  } catch (error) {
    console.error("Gagal menyelesaikan pekerjaan:", error);
    toast("Gagal: " + error.message, true);
  }
}
function openSignature(id) {
  const work = works.find(item => item.id === id);

  if (!work) {
    toast("Data pekerjaan tidak ditemukan.", true);
    return;
  }

  if (!["user", "admin"].includes(profile.role)) {
    toast(
      "Hanya user atau admin yang dapat melakukan verifikasi.",
      true
    );

    return;
  }

  if (work.status !== "Selesai") {
    toast(
      "Pekerjaan belum dinyatakan selesai oleh teknisi.",
      true
    );

    return;
  }

  if (!work.after_photo_path) {
    toast(
      "Foto sesudah pekerjaan belum tersedia.",
      true
    );

    return;
  }

  if (work.verified_at) {
    toast(
      "Pekerjaan ini sudah diverifikasi.",
      true
    );

    return;
  }

  signWorkId = id;

  $("#signatureModal").classList.remove("hidden");

  clearSig();
}

function setupCanvas(){let c=$('#signatureCanvas');ctx=c.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';let pos=e=>{let r=c.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*c.width/r.width,y:(p.clientY-r.top)*c.height/r.height}};c.onpointerdown=e=>{drawing=true;let p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};c.onpointermove=e=>{if(!drawing)return;let p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};c.onpointerup=c.onpointerleave=()=>drawing=false}
function clearSig(){ctx?.clearRect(0,0,$('#signatureCanvas').width,$('#signatureCanvas').height)}
async function saveVerification() {
  try {
	  if (profile.role !== "admin") {
throw new Error(
"Hanya admin yang dapat menambah atau mengedit pekerjaan."
);
    if (!signWorkId) {
      throw new Error(
        "Pekerjaan yang akan diverifikasi tidak ditemukan."
      );
    }

    if (!["user", "admin"].includes(profile.role)) {
      throw new Error(
        "Anda tidak memiliki izin melakukan verifikasi."
      );
    }

    const canvas = $("#signatureCanvas");

    const signatureBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!signatureBlob || signatureBlob.size < 500) {
      throw new Error(
        "Buat paraf terlebih dahulu."
      );
    }

    const signaturePath =
      `signatures/${signWorkId}-${Date.now()}.png`;

    const { error: uploadError } = await sb
      .storage
      .from(C.PHOTO_BUCKET)
      .upload(
        signaturePath,
        signatureBlob,
        {
          contentType: "image/png",
          upsert: false
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const { error: verificationError } = await sb.rpc(
      "user_verify_work",
      {
        p_work_id: signWorkId,
        p_signature_path: signaturePath
      }
    );

    if (verificationError) {
      throw verificationError;
    }

    $("#signatureModal").classList.add("hidden");

    signWorkId = null;

    toast(
      "Pekerjaan berhasil diverifikasi."
    );

    await loadWorks();
  } catch (error) {
    console.error(
      "Verifikasi pekerjaan gagal:",
      error
    );

    toast(
      "Verifikasi gagal: " + error.message,
      true
    );
  }
}
async function importWorks(e){let data=await readExcel(e.target.files[0]);let rows=data.map(r=>({title:r['Judul'],pic:r['PIC'],work_type:r['Jenis'],priority:r['Prioritas']||'Medium',due_date:excelDate(r['Tanggal Rencana']),status:r['Status']||'Open',description:r['Deskripsi']||'',equipment_id:equipment.find(x=>x.code_number==r['Code Number'])?.id,created_by:session.user.id})).filter(x=>x.title&&x.equipment_id);let {error}=await sb.from('works').insert(rows);if(error)return toast(error.message,true);toast(`${rows.length} pekerjaan diimpor`);loadWorks()}
async function importMaster(e){let data=await readExcel(e.target.files[0]);let rows=data.map(r=>({name:r['Equipment'],plant:r['Plant'],code_number:String(r['Code Number']||''),funloc:r['Funloc']})).filter(x=>x.name&&x.code_number);let {error}=await sb.from('equipment').upsert(rows,{onConflict:'code_number'});if(error)return toast(error.message,true);toast(`${rows.length} equipment diperbarui`);loadEquipment()}
async function readExcel(f){let buf=await f.arrayBuffer(),wb=XLSX.read(buf),ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{defval:''})}function excelDate(v){if(!v)return null;if(typeof v==='number'){let d=XLSX.SSF.parse_date_code(v);return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}return String(v).slice(0,10)}
function renderMaster(){$('#masterTable').innerHTML=equipment.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plant)}</td><td>${esc(x.code_number)}</td><td>${esc(x.funloc)}</td><td><button class="mini-btn" onclick='editMaster(${JSON.stringify(x)})'>✎</button></td></tr>`).join('')}
window.editMaster=async x=>{let name=prompt('Nama equipment',x?.name||'');if(!name)return;let plant=prompt('Plant',x?.plant||''),code_number=prompt('Code Number',x?.code_number||''),funloc=prompt('Funloc',x?.funloc||'');let {error}=await sb.from('equipment').upsert({id:x?.id,name,plant,code_number,funloc});if(error)return toast(error.message,true);loadEquipment()}
async function loadUsers(){let {data}=await sb.from('profiles').select('*').order('full_name');$('#userTable').innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td><select data-role-change="${x.id}"><option ${x.role==='admin'?'selected':''}>admin</option><option ${x.role==='technician'?'selected':''}>technician</option><option ${x.role==='user'?'selected':''}>user</option></select></td><td>${x.is_active?'Aktif':'Nonaktif'}</td><td><button class="mini-btn" data-toggle-user="${x.id}" data-active="${x.is_active}">${x.is_active?'Nonaktifkan':'Aktifkan'}</button></td></tr>`).join('');$$('[data-role-change]').forEach(s=>s.onchange=()=>updateProfile(s.dataset.roleChange,{role:s.value}));$$('[data-toggle-user]').forEach(b=>b.onclick=()=>updateProfile(b.dataset.toggleUser,{is_active:b.dataset.active!=='true'}))}
async function updateProfile(id,p){let {error}=await sb.from('profiles').update(p).eq('id',id);if(error)return toast(error.message,true);toast('Pengguna diperbarui');loadUsers()}
async function inviteUser(){let email=prompt('Email pengguna baru');if(!email)return;let full_name=prompt('Nama lengkap')||email,role=prompt('Role: admin / technician / user','user');let {data,error}=await sb.functions.invoke('admin-user',{body:{email,full_name,role}});toast(error?.message||data?.message||'Undangan diproses',!!error)}
async function exportXlsx(returnBlob=false){toast('Membuat XLSX...');let wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Report',{properties:{defaultRowHeight:55}});ws.columns=[{header:'No',key:'no',width:6},{header:'Pekerjaan',key:'title',width:32},{header:'Equipment',key:'equipment',width:22},{header:'Jenis',key:'type',width:24},{header:'Prioritas',key:'priority',width:12},{header:'PIC',key:'pic',width:18},{header:'Status',key:'status',width:14},{header:'Foto Sebelum',key:'before',width:18},{header:'Foto Sesudah',key:'after',width:18},{header:'Verifikasi',key:'verified',width:22}];ws.getRow(1).height=26;ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D4ED8'}};for(let [i,x] of filtered().entries()){let row=ws.addRow({no:i+1,title:x.title,equipment:x.equipment?.name,type:x.work_type,priority:x.priority,pic:x.pic,status:x.verified_at?'Selesai':x.status,verified:x.verified_by_name||''});row.height=82;for(let [path,col] of [[x.before_photo_path,8],[x.after_photo_path,9]])if(path){try{let {data}=sb.storage.from(C.PHOTO_BUCKET).getPublicUrl(path),blob=await fetch(data.publicUrl).then(r=>r.blob()),compressed=await compress(blob),buf=await compressed.arrayBuffer(),ext=compressed.type.includes('png')?'png':'jpeg',img=wb.addImage({buffer:buf,extension:ext});ws.addImage(img,{tl:{col:col-1+.08,row:i+1+.08},ext:{width:110,height:75}})}catch{}}}ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:'A1',to:'J1'};let buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});if(returnBlob)return blob;saveAs(blob,`maintenance-report-${new Date().toISOString().slice(0,10)}.xlsx`);toast('XLSX berhasil dibuat')}
async function compress(blob){let bm=await createImageBitmap(blob),max=900,scale=Math.min(1,max/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=bm.width*scale;c.height=bm.height*scale;c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',.72))}
async function sendEmail(){let recipient=prompt('Kirim report ke email:',C.REPORT_RECIPIENT);if(!recipient)return;let blob=await exportXlsx(true),b64=await blobToBase64(blob);let {data,error}=await sb.functions.invoke('send-report',{body:{to:recipient,filename:`maintenance-report-${new Date().toISOString().slice(0,10)}.xlsx`,attachmentBase64:b64}});toast(error?.message||data?.message||'Email terkirim',!!error)}function blobToBase64(b){return new Promise((r,j)=>{let f=new FileReader;f.onload=()=>r(f.result.split(',')[1]);f.onerror=j;f.readAsDataURL(b)})}
init();