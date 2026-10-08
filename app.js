"use strict";const C=window.APP_CONFIG,sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let session,profile,works=[],equipment=[],verifyId,ctx,drawing=false;const icons=()=>window.lucide?.createIcons({attrs:{"stroke-width":1.9}});function toast(m,e=false){let t=$("#toast");t.textContent=m;t.className="toast show"+(e?" error":"");clearTimeout(toast.t);toast.t=setTimeout(()=>t.className="toast",3800)}const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));function url(p){return p?sb.storage.from(C.PHOTO_BUCKET).getPublicUrl(p).data.publicUrl:null}async function init(){icons();bind();setupCanvas();$("#today").textContent=new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(new Date());let{data}=await sb.auth.getSession();data.session?enter(data.session):showLogin();sb.auth.onAuthStateChange((_,s)=>s?enter(s):showLogin())}function bind(){$("#loginForm").onsubmit=login;$("#logoutBtn").onclick=()=>sb.auth.signOut();$$("#nav button").forEach(b=>b.onclick=()=>page(b.dataset.page,b));$$('[data-goto]').forEach(b=>b.onclick=()=>page(b.dataset.goto,$(`[data-page="${b.dataset.goto}"]`)));$$('[data-close]').forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));$("#addBtn").onclick=()=>openAdminForm();$("#workForm").onsubmit=saveWork;$("#workTable").onclick=tableClick;["searchInput","statusFilter","priorityFilter","typeFilter","picFilter"].forEach(id=>$("#"+id).oninput=renderWorks);$("#resetFilter").onclick=()=>{["searchInput","statusFilter","priorityFilter","typeFilter","picFilter"].forEach(id=>$("#"+id).value="");renderWorks()};$("#photoForm").onsubmit=savePhoto;$("#technicianPhoto").onchange=preview;$("#clearSignature").onclick=()=>ctx.clearRect(0,0,700,260);$("#saveSignature").onclick=verify;$("#exportBtn").onclick=()=>exportXlsx();$("#emailBtn").onclick=sendEmail;$("#masterAddBtn").onclick=editMaster;$("#userAddBtn").onclick=inviteUser}async function login(e){e.preventDefault();let b=$("#loginButton"),m=$("#loginMsg");b.disabled=true;m.textContent="Memeriksa akun...";let{error}=await sb.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});m.textContent=error?error.message:"";b.disabled=false}function showLogin(){$("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden")}async function enter(s){session=s;let{data,error}=await sb.from("profiles").select("*").eq("id",s.user.id).single();if(error||!data)return $("#loginMsg").textContent="Profil pengguna tidak tersedia: "+(error?.message||"");profile=data;$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");$("#userName").textContent=data.full_name||s.user.email;$("#userRole").textContent=data.role;$$('[data-admin]').forEach(x=>x.classList.toggle("hidden",data.role!=="admin"));await Promise.all([loadEquipment(),loadWorks(),data.role==="admin"?loadUsers():0]);icons()}function page(n,b){if(["manage","users"].includes(n)&&profile.role!=="admin")return;$$(".page").forEach(x=>x.classList.add("hidden"));$("#"+n+"Page").classList.remove("hidden");$$("#nav button").forEach(x=>x.classList.remove("active"));b?.classList.add("active");$("#pageTitle").textContent={dashboard:"Dashboard",works:"Pekerjaan",manage:"Master Data",users:"Pengguna"}[n]}async function loadWorks(){let{data,error}=await sb.from("works").select("*,equipment(*)").order("created_at",{ascending:false});if(error)return toast(error.message,true);works=data||[];render()}async function loadEquipment(){let{data}=await sb.from("equipment").select("*").order("name");equipment=data||[];$("#equipmentId").innerHTML='<option value="">Pilih equipment</option>'+equipment.map(x=>`<option value="${x.id}">${esc(x.name)} | ${esc(x.code_number)}</option>`).join("");renderMaster()}function render(){$("#kpiTotal").textContent=works.length;$("#kpiOpen").textContent=works.filter(x=>x.status==="Open").length;$("#kpiProcess").textContent=works.filter(x=>x.status==="Proses"||(x.status==="Selesai"&&!x.verified_at)).length;$("#kpiDone").textContent=works.filter(x=>x.verified_at).length;$("#recentList").innerHTML=works.slice(0,6).map(x=>`<div class="recent-item"><div><strong>${esc(x.title)}</strong><br><small class="muted">${esc(x.equipment?.name||"-")} • ${esc(x.pic)}</small></div><span class="badge ${x.status}">${x.verified_at?"Terverifikasi":x.status}</span></div>`).join("")||'<p class="muted">Belum ada data.</p>';renderWorks()}function filtered(){let q=$("#searchInput").value.toLowerCase(),s=$("#statusFilter").value,p=$("#priorityFilter").value,t=$("#typeFilter").value,pic=$("#picFilter").value.toLowerCase();return works.filter(x=>[x.title,x.description,x.pic,x.equipment?.name].join(" ").toLowerCase().includes(q)&&(!s||x.status===s)&&(!p||x.priority===p)&&(!t||x.work_type===t)&&(!pic||x.pic.toLowerCase().includes(pic)))}function renderWorks(){$("#workTable").innerHTML=filtered().map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.title)}</strong><br><small class="muted">${esc(x.description||"")}</small></td><td>${esc(x.equipment?.name||"-")}</td><td>${esc(x.work_type)}</td><td>${esc(x.priority)}</td><td>${esc(x.pic)}</td><td><span class="badge ${x.status}">${x.verified_at?"Terverifikasi":x.status}</span></td><td>${photo(x.before_photo_path)} ${photo(x.after_photo_path)}</td><td>${verifyCell(x)}</td><td>${actions(x)}</td></tr>`).join("")||'<tr><td colspan="10">Data tidak ditemukan</td></tr>';icons()}function photo(p){let u=url(p);return u?`<a href="${u}" target="_blank"><img class="photo" src="${u}"></a>`:""}function verifyCell(x){if(x.verified_at)return "✓ "+esc(x.verified_by_name||"Terverifikasi");if(["user","admin"].includes(profile.role)&&x.status==="Selesai"&&x.after_photo_path)return `<button class="mini-btn btn-upload" data-verify="${x.id}"><i data-lucide="signature"></i>Verifikasi</button>`;return x.status==="Proses"?"Menunggu teknisi":x.status==="Selesai"?"Menunggu user":"Belum dimulai"}function actions(x){let a=[`<button class="mini-btn" data-detail="${x.id}"><i data-lucide="eye"></i>Detail</button>`];if(profile.role==="admin")a.push(`<button class="mini-btn" data-edit="${x.id}"><i data-lucide="pencil"></i>Edit</button><button class="mini-btn" data-delete="${x.id}"><i data-lucide="trash-2"></i>Hapus</button>`);if(profile.role==="technician"){if(x.status==="Open")a.push(`<button class="mini-btn btn-start" data-start="${x.id}"><i data-lucide="play"></i>Mulai</button>`);else if(x.status==="Proses")a.push(`<button class="mini-btn btn-upload" data-photo="${x.id}"><i data-lucide="camera"></i>Foto</button>`)}return `<div class="action-group">${a.join("")}</div>`}function tableClick(e){let b=e.target.closest("button");if(!b)return;if(b.dataset.detail)detail(b.dataset.detail);if(b.dataset.edit)openAdminForm(b.dataset.edit);if(b.dataset.delete)del(b.dataset.delete);if(b.dataset.start)start(b.dataset.start);if(b.dataset.photo)openPhoto(b.dataset.photo);if(b.dataset.verify)openVerify(b.dataset.verify)}function detail(id){let x=works.find(w=>w.id===id),item=(a,b)=>`<div class="detail-item"><small>${a}</small><strong>${esc(b||"-")}</strong></div>`,images=p=>url(p)?`<img class="detail-photo" src="${url(p)}">`:"Belum tersedia";$("#detailGrid").innerHTML=item("Judul",x.title)+item("Equipment",x.equipment?.name)+item("PIC",x.pic)+item("Jenis",x.work_type)+item("Prioritas",x.priority)+item("Status",x.verified_at?"Terverifikasi":x.status)+`<div class="detail-item span2"><small>Deskripsi</small><p>${esc(x.description||"-")}</p></div><div class="detail-item"><small>Foto sebelum</small>${images(x.before_photo_path)}</div><div class="detail-item"><small>Foto sesudah</small>${images(x.after_photo_path)}</div>`;$("#detailModal").classList.remove("hidden")}function openAdminForm(id){if(profile.role!=="admin")return;let x=works.find(w=>w.id===id);$("#workModalTitle").textContent=x?"Edit Pekerjaan":"Tambah Pekerjaan";$("#workId").value=x?.id||"";$("#title").value=x?.title||"";$("#equipmentId").value=x?.equipment_id||"";$("#pic").value=x?.pic||"";$("#type").value=x?.work_type||"Preventive Maintenance";$("#priority").value=x?.priority||"Medium";$("#dueDate").value=x?.due_date||"";$("#status").value=x?.status||"Open";$("#description").value=x?.description||"";$("#beforePhoto").value=$("#afterPhoto").value="";$("#workModal").classList.remove("hidden")}async function upload(f,id,k){if(!f)return null;let p=`${id}/${k}-${Date.now()}.${f.name.split('.').pop()}`;let{error}=await sb.storage.from(C.PHOTO_BUCKET).upload(p,f);if(error)throw error;return p}async function saveWork(e){e.preventDefault();try{let id=$("#workId").value||crypto.randomUUID(),old=works.find(x=>x.id===id),p={id,title:$("#title").value,equipment_id:$("#equipmentId").value,pic:$("#pic").value,work_type:$("#type").value,priority:$("#priority").value,due_date:$("#dueDate").value||null,status:$("#status").value,description:$("#description").value,created_by:old?.created_by||session.user.id,updated_at:new Date().toISOString()},bf=await upload($("#beforePhoto").files[0],id,"before"),af=await upload($("#afterPhoto").files[0],id,"after");if(bf)p.before_photo_path=bf;if(af)p.after_photo_path=af;let{error}=await sb.from("works").upsert(p);if(error)throw error;$("#workModal").classList.add("hidden");toast("Pekerjaan disimpan");loadWorks()}catch(e){toast(e.message,true)}}async function del(id){if(!confirm("Hapus pekerjaan?"))return;let{error}=await sb.from("works").delete().eq("id",id);error?toast(error.message,true):loadWorks()}async function start(id){if(!confirm("Mulai pekerjaan ini?"))return;let{error}=await sb.rpc("technician_start_work",{p_work_id:id});error?toast(error.message,true):(toast("Pekerjaan dimulai"),loadWorks())}function openPhoto(id){let x=works.find(w=>w.id===id);$("#photoWorkId").value=id;$("#photoWorkInfo").innerHTML=`<small class="eyebrow">PEKERJAAN</small><h3>${esc(x.title)}</h3><p class="muted">${esc(x.equipment?.name||"-")}</p>`;$("#technicianPhoto").value="";$("#photoPreview").classList.add("hidden");$("#photoModal").classList.remove("hidden")}function preview(e){let f=e.target.files[0];if(!f)return;$("#previewImage").src=URL.createObjectURL(f);$("#photoPreview").classList.remove("hidden")}async function savePhoto(e){e.preventDefault();try{let id=$("#photoWorkId").value,f=$("#technicianPhoto").files[0];if(!f)throw Error("Foto wajib dipilih");let p=await upload(f,id,"after"),{error}=await sb.rpc("technician_complete_work",{p_work_id:id,p_after_photo_path:p});if(error)throw error;$("#photoModal").classList.add("hidden");toast("Foto berhasil. Menunggu verifikasi user");loadWorks()}catch(e){toast(e.message,true)}}function setupCanvas(){let c=$("#signatureCanvas");ctx=c.getContext("2d");ctx.lineWidth=3;ctx.lineCap="round";let pos=e=>{let r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*700/r.width,y:(e.clientY-r.top)*260/r.height}};c.onpointerdown=e=>{drawing=true;let p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};c.onpointermove=e=>{if(!drawing)return;let p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};c.onpointerup=c.onpointerleave=()=>drawing=false}function openVerify(id){verifyId=id;ctx.clearRect(0,0,700,260);$("#signatureModal").classList.remove("hidden")}async function verify(){try{let blob=await new Promise(r=>$("#signatureCanvas").toBlob(r));if(blob.size<500)throw Error("Buat paraf terlebih dahulu");let p=`signatures/${verifyId}-${Date.now()}.png`,{error}=await sb.storage.from(C.PHOTO_BUCKET).upload(p,blob);if(error)throw error;let r=await sb.rpc("user_verify_work",{p_work_id:verifyId,p_signature_path:p});if(r.error)throw r.error;$("#signatureModal").classList.add("hidden");toast("Pekerjaan terverifikasi");loadWorks()}catch(e){toast(e.message,true)}}function renderMaster(){$("#masterTable").innerHTML=equipment.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plant)}</td><td>${esc(x.code_number)}</td><td>${esc(x.funloc)}</td><td><button class="mini-btn" data-master="${x.id}">Edit</button></td></tr>`).join("");$$('[data-master]').forEach(b=>b.onclick=()=>editMaster(equipment.find(x=>x.id===b.dataset.master)))}async function editMaster(x){let name=prompt("Equipment",x?.name||"");if(!name)return;let p={id:x?.id,name,plant:prompt("Plant",x?.plant||""),code_number:prompt("Code Number",x?.code_number||""),funloc:prompt("Funloc",x?.funloc||"")},{error}=await sb.from("equipment").upsert(p);error?toast(error.message,true):loadEquipment()}async function loadUsers(){let{data}=await sb.from("profiles").select("*");$("#userTable").innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td>${x.is_active?"Aktif":"Nonaktif"}</td></tr>`).join("")}async function inviteUser(){let email=prompt("Email pengguna");if(!email)return;let full_name=prompt("Nama lengkap"),role=prompt("Role: admin / technician / user","user"),{error}=await sb.functions.invoke("admin-user",{body:{email,full_name,role}});toast(error?error.message:"Undangan dikirim",!!error)}function reportFileName() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `maintenance-report-${day}-${month}-${year}.xlsx`;
}

async function compressPhotoForExcel(photoBlob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(photoBlob);

    image.onload = () => {
      try {
        const scale = Math.min(1, 900 / image.width, 700 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(objectUrl);
          blob ? resolve(blob) : reject(new Error("Foto gagal dikompresi."));
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

async function getPhotoBlob(photoPath) {
  if (!photoPath) return null;

  try {
    const publicUrl = url(photoPath);
    if (publicUrl) {
      const response = await fetch(publicUrl, { cache: "no-store" });
      if (response.ok) return await response.blob();
    }
  } catch (error) {
    console.warn("Public URL foto gagal, mencoba Storage download:", error);
  }

  const { data, error } = await sb.storage
    .from(C.PHOTO_BUCKET)
    .download(photoPath);

  if (error) throw error;
  return data;
}

async function addPhotoToExcel(workbook, worksheet, photoPath, columnNumber, rowNumber) {
  if (!photoPath) return false;

  try {
    const originalBlob = await getPhotoBlob(photoPath);
    if (!originalBlob) throw new Error("File foto tidak ditemukan.");

    const compressedBlob = await compressPhotoForExcel(originalBlob);
    const imageId = workbook.addImage({
      buffer: await compressedBlob.arrayBuffer(),
      extension: "jpeg"
    });

    worksheet.addImage(imageId, {
      tl: { col: columnNumber - 1 + 0.12, row: rowNumber - 1 + 0.10 },
      ext: { width: 120, height: 82 },
      editAs: "oneCell"
    });
    return true;
  } catch (error) {
    console.error("Foto gagal dimasukkan ke Excel:", photoPath, error);
    return false;
  }
}

async function exportXlsx(returnBlob = false) {
  try {
    if (typeof ExcelJS === "undefined") throw new Error("Library ExcelJS tidak termuat.");

    toast("Membuat laporan XLSX...");
    const reportData = filtered();
    if (!reportData.length) throw new Error("Tidak ada data yang dapat diekspor.");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Maintenance Work Management";
    workbook.company = "PT. Padi Indonesia Maju";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Report");
    worksheet.columns = [
      { header: "No", key: "number", width: 7 },
      { header: "Pekerjaan", key: "title", width: 32 },
      { header: "Equipment", key: "equipment", width: 24 },
      { header: "Jenis", key: "type", width: 26 },
      { header: "Prioritas", key: "priority", width: 14 },
      { header: "PIC", key: "pic", width: 19 },
      { header: "Status", key: "status", width: 20 },
      { header: "Foto Sebelum", key: "beforePhoto", width: 19 },
      { header: "Foto Sesudah", key: "afterPhoto", width: 19 },
      { header: "Verifikasi", key: "verification", width: 24 }
    ];

    const header = worksheet.getRow(1);
    header.height = 30;
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    header.alignment = { vertical: "middle", horizontal: "center" };

    for (let index = 0; index < reportData.length; index += 1) {
      const work = reportData[index];
      const excelRow = index + 2;
      const row = worksheet.addRow({
        number: index + 1,
        title: work.title || "-",
        equipment: work.equipment?.name || "-",
        type: work.work_type || "-",
        priority: work.priority || "-",
        pic: work.pic || "-",
        status: work.verified_at ? "Terverifikasi" : work.status,
        beforePhoto: work.before_photo_path ? "" : "Tidak ada",
        afterPhoto: work.after_photo_path ? "" : "Tidak ada",
        verification: work.verified_by_name || (work.verified_at ? "Terverifikasi" : "Belum diverifikasi")
      });

      row.height = 72;
      row.alignment = { vertical: "middle", wrapText: true };

      await addPhotoToExcel(workbook, worksheet, work.before_photo_path, 8, excelRow);
      await addPhotoToExcel(workbook, worksheet, work.after_photo_path, 9, excelRow);
      toast(`Memproses laporan ${index + 1} dari ${reportData.length}...`);
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: "J1" };
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD8DEE9" } },
          left: { style: "thin", color: { argb: "FFD8DEE9" } },
          bottom: { style: "thin", color: { argb: "FFD8DEE9" } },
          right: { style: "thin", color: { argb: "FFD8DEE9" } }
        };
        if (rowNumber > 1) cell.alignment = { vertical: "middle", wrapText: true };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const reportBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    if (returnBlob) return reportBlob;
    saveAs(reportBlob, reportFileName());
    toast("XLSX dengan foto berhasil dibuat.");
    return reportBlob;
  } catch (error) {
    console.error("Export XLSX gagal:", error);
    toast("Export gagal: " + error.message, true);
    return null;
  }
}async function sendEmail() {
  const recipient = prompt("Email penerima", C.REPORT_RECIPIENT || "");
  if (!recipient) return;

  try {
    toast("Membuat laporan XLSX...");
    const reportBlob = await exportXlsx(true);
    if (!reportBlob) throw new Error("File XLSX gagal dibuat.");

    const attachmentBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || "").split(",")[1];
        base64 ? resolve(base64) : reject(new Error("Isi XLSX kosong."));
      };
      reader.onerror = () => reject(new Error("File XLSX gagal dibaca."));
      reader.readAsDataURL(reportBlob);
    });

    toast("Mengirim melalui Gmail...");
    const { data, error } = await sb.functions.invoke("send-report", {
      body: {
        to: recipient.trim(),
        filename: reportFileName(),
        attachmentBase64
      }
    });

    if (error) {
      let errorMessage = error.message;
      if (error.context) {
        try {
          const response = await error.context.json();
          errorMessage = response.error || response.message || errorMessage;
          console.error("Gmail function response:", response);
        } catch (responseError) {
          console.error("Response function tidak dapat dibaca:", responseError);
        }
      }
      throw new Error(errorMessage);
    }

    if (!data?.success) throw new Error(data?.error || "Email Gmail gagal dikirim.");
    toast(data.message || "Email berhasil dikirim melalui Gmail.");
  } catch (error) {
    console.error("Kirim Gmail gagal:", error);
    toast("Email gagal: " + error.message, true);
  }
}init();