"use strict";
const C=window.APP_CONFIG,sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let session,profile,works=[],equipment=[],barChart,doughnutChart,verifyWorkId=null,signatureContext=null,signatureDrawing=false;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));const icons=()=>lucide?.createIcons();
function toast(m,e=false){const t=$("#toast");t.textContent=m;t.className="toast show"+(e?" error":"");clearTimeout(toast.t);toast.t=setTimeout(()=>t.className="toast",4000)}
function monthKey(v){return v?String(v).slice(0,7):"no-date"}function monthLabel(v){if(!v)return"Tanpa Tanggal";const[a,b]=String(v).slice(0,7).split("-");return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(+a,+b-1,1))}function photoUrl(p){return p?sb.storage.from(C.PHOTO_BUCKET).getPublicUrl(p).data.publicUrl:null}
function normalizeValue(value){return String(value||"").trim().toLowerCase()}
function isTechnician(){return ["technician","teknisi","technician user","role_technician"].includes(normalizeValue(profile?.role))}
function canVerify(){return ["user","admin","pemohon","requester"].includes(normalizeValue(profile?.role))}
function normalizedStatus(value){
  const status=normalizeValue(value);
  if(["open","baru","pending","belum dimulai"].includes(status))return "open";
  if(["proses","process","in progress","in-progress","sedang dikerjakan","started"].includes(status))return "proses";
  if(["selesai","done","completed","complete"].includes(status))return "selesai";
  return status;
}
function workActionButtons(work){
  const status=normalizedStatus(work.status);
  let buttons="";
  if(isTechnician()&&status==="open")buttons+=`<button class="mini-btn btn-start" data-start="${work.id}"><i data-lucide="play"></i>Mulai Pekerjaan</button>`;
  if(isTechnician()&&status==="proses")buttons+=`<button class="mini-btn btn-complete" data-complete="${work.id}"><i data-lucide="circle-check-big"></i>Selesaikan Pekerjaan</button>`;
  if(canVerify()&&status==="selesai"&&!work.verified_at&&work.after_photo_path)buttons+=`<button class="mini-btn btn-verify" data-verify="${work.id}"><i data-lucide="badge-check"></i>Verifikasi</button>`;
  return buttons;
}
async function init(){bind();icons();$("#today").textContent=new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(new Date());$("#kpiYearFilter").value=new Date().getFullYear();const{data}=await sb.auth.getSession();data.session?enter(data.session):showLogin();sb.auth.onAuthStateChange((_,s)=>s?enter(s):showLogin())}
function bind(){$("#loginForm").onsubmit=login;$("#logoutBtn").onclick=()=>sb.auth.signOut();$$("#nav button").forEach(b=>b.onclick=()=>page(b.dataset.page,b));$$('[data-goto]').forEach(b=>b.onclick=()=>page(b.dataset.goto,$(`[data-page="${b.dataset.goto}"]`)));$$('[data-close]').forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));$("#groupedWorks").onclick=tableAction;$("#addBtn").onclick=()=>openForm();$("#workForm").onsubmit=saveWork;["searchInput","statusFilter","priorityFilter","typeFilter","picFilter","monthFilter"].forEach(id=>$("#"+id).oninput=renderGrouped);$("#resetFilter").onclick=()=>{["searchInput","statusFilter","priorityFilter","typeFilter","picFilter","monthFilter"].forEach(id=>$("#"+id).value="");renderGrouped()};$("#kpiYearFilter").oninput=renderKpiPage;$("#completeForm").onsubmit=completeWork;$("#completePhoto").onchange=previewCompletePhoto;setupSignatureCanvas();$("#clearSignatureBtn").onclick=clearSignature;$("#saveVerificationBtn").onclick=saveVerification}
async function login(e){e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});$("#loginMsg").textContent=error?error.message:""}function showLogin(){$("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden")}
async function enter(s){session=s;const{data,error}=await sb.from("profiles").select("*").eq("id",s.user.id).single();if(error)return toast(error.message,true);profile=data;$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");$("#userName").textContent=data.full_name||s.user.email;$("#userRole").textContent=data.role;$$('[data-admin]').forEach(x=>x.classList.toggle("hidden",data.role!=="admin"));await Promise.all([loadEquipment(),loadWorks()]);icons()}
function page(n,b){$$(".page").forEach(x=>x.classList.add("hidden"));$("#"+n+"Page").classList.remove("hidden");$$("#nav button").forEach(x=>x.classList.remove("active"));b?.classList.add("active");$("#pageTitle").textContent={dashboard:"Dashboard",kpi:"KPI & Grafik",works:"Pekerjaan",manage:"Master Data"}[n];if(n==="kpi")setTimeout(renderKpiPage,50)}
async function loadWorks(){const{data,error}=await sb.from("works").select("*,equipment(*)").order("due_date",{ascending:false});if(error)return toast(error.message,true);works=data||[];renderAll()}async function loadEquipment(){const{data}=await sb.from("equipment").select("*").order("name");equipment=data||[];$("#equipmentId").innerHTML='<option value="">Pilih equipment</option>'+equipment.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");$("#masterTable").innerHTML=equipment.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plant)}</td><td>${esc(x.code_number)}</td><td>${esc(x.funloc)}</td></tr>`).join("")}
function renderAll(){$("#kpiTotal").textContent=works.length;$("#kpiOpen").textContent=works.filter(x=>x.status==="Open").length;$("#kpiProcess").textContent=works.filter(x=>x.status==="Proses").length;$("#kpiDone").textContent=works.filter(x=>x.verified_at).length;$("#recentList").innerHTML=works.slice(0,6).map(x=>`<div class="recent-item"><strong>${esc(x.title)}</strong><span>${esc(monthLabel(x.due_date))}</span></div>`).join("");renderGrouped();renderKpiPage()}
function filtered(){const q=$("#searchInput").value.toLowerCase(),s=$("#statusFilter").value,p=$("#priorityFilter").value,t=$("#typeFilter").value,pic=$("#picFilter").value.toLowerCase(),m=$("#monthFilter").value;return works.filter(x=>[x.title,x.pic,x.equipment?.name].join(" ").toLowerCase().includes(q)&&(!s||x.status===s)&&(!p||x.priority===p)&&(!t||x.work_type===t)&&(!pic||String(x.pic||"").toLowerCase().includes(pic))&&(!m||monthKey(x.due_date)===m))}
function renderGrouped(){const groups={};filtered().forEach(x=>(groups[monthKey(x.due_date)]??=[]).push(x));const keys=Object.keys(groups).sort((a,b)=>b.localeCompare(a));$("#groupedWorks").innerHTML=keys.map(k=>`<section class="month-group"><div class="month-group-head"><div class="month-group-title"><i data-lucide="calendar-days"></i><strong>${esc(monthLabel(groups[k][0]?.due_date))}</strong></div><span class="month-count">${groups[k].length} pekerjaan</span></div><div class="table-wrap"><table><thead><tr><th>No</th><th>Pekerjaan</th><th>Equipment</th><th>Jenis</th><th>Prioritas</th><th>PIC</th><th>Status</th><th>Foto</th><th>Aksi</th></tr></thead><tbody>${groups[k].map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.title)}</strong><br><small>${esc(x.description||"")}</small></td><td>${esc(x.equipment?.name||"-")}</td><td>${esc(x.work_type)}</td><td>${esc(x.priority)}</td><td>${esc(x.pic)}</td><td><span class="badge ${x.verified_at?"Terverifikasi":x.status}">${x.verified_at?"Terverifikasi":esc(x.status)}</span></td><td>${[x.before_photo_path,x.after_photo_path].filter(Boolean).map(p=>`<img class="photo" src="${photoUrl(p)}">`).join(" ")}</td><td><div class="action-group"><button class="mini-btn" data-detail="${x.id}"><i data-lucide="eye"></i>Detail</button>${profile.role==="admin"?`<button class="mini-btn" data-edit="${x.id}">Edit</button>`:""}${workActionButtons(x)}</div></td></tr>`).join("")}</tbody></table></div></section>`).join("")||'<div class="panel panel-head">Tidak ada data.</div>';icons()}
function tableAction(e){const b=e.target.closest("button");if(!b)return;if(b.dataset.detail)detail(b.dataset.detail);else if(b.dataset.edit)openForm(b.dataset.edit);else if(b.dataset.start)startWork(b.dataset.start);else if(b.dataset.complete)openCompleteModal(b.dataset.complete);else if(b.dataset.verify)openVerifyModal(b.dataset.verify)}
async function startWork(id){
  if(!isTechnician())return toast("Hanya teknisi yang dapat memulai pekerjaan.",true);
  const work=works.find(x=>x.id===id);
  if(!work)return toast("Pekerjaan tidak ditemukan.",true);
  if(normalizedStatus(work.status)!=="open")return toast("Pekerjaan ini tidak berstatus Open.",true);
  if(!confirm(`Mulai pekerjaan: ${work.title}?`))return;

  try{
    const{error}=await sb.rpc("technician_start_work",{p_work_id:id});
    if(error)throw error;
    toast("Pekerjaan berhasil dimulai.");
    await loadWorks();
  }catch(error){
    console.error("Mulai pekerjaan gagal:",error);
    toast("Gagal memulai pekerjaan: "+error.message,true);
  }
}
function openCompleteModal(id){
  if(!isTechnician())return toast("Hanya teknisi yang dapat menyelesaikan pekerjaan.",true);
  const work=works.find(x=>x.id===id);
  if(!work)return toast("Pekerjaan tidak ditemukan.",true);
  if(normalizedStatus(work.status)!=="proses")return toast("Pekerjaan harus berstatus Proses.",true);
  $("#completeWorkId").value=id;
  $("#completeWorkInfo").innerHTML=`<small class="eyebrow">PEKERJAAN</small><h3>${esc(work.title)}</h3><p>${esc(work.equipment?.name||"-")} • ${esc(work.pic||"-")}</p>`;
  $("#completePhoto").value="";
  $("#completePreview").classList.add("hidden");
  $("#completePreviewImage").removeAttribute("src");
  $("#completeModal").classList.remove("hidden");
  icons();
}
function previewCompletePhoto(event){
  const file=event.target.files?.[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){event.target.value="";return toast("File harus berupa gambar.",true)}
  const imageUrl=URL.createObjectURL(file);
  $("#completePreviewImage").src=imageUrl;
  $("#completePreview").classList.remove("hidden");
  $("#completePreviewImage").onload=()=>URL.revokeObjectURL(imageUrl);
}
async function uploadCompletionPhoto(file,workId){
  const extension=(file.name.split(".").pop()||"jpg").toLowerCase();
  const path=`${workId}/after-${Date.now()}.${extension}`;
  const{error}=await sb.storage.from(C.PHOTO_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return path;
}
async function completeWork(event){
  event.preventDefault();
  const button=$("#completeSubmitBtn");
  const workId=$("#completeWorkId").value;
  const file=$("#completePhoto").files?.[0];
  if(!file)return toast("Foto sesudah pekerjaan wajib dipilih.",true);
  button.disabled=true;
  const original=button.innerHTML;
  button.textContent="Menyelesaikan...";
  try{
    const photoPath=await uploadCompletionPhoto(file,workId);
    const{error}=await sb.rpc("technician_complete_work",{p_work_id:workId,p_after_photo_path:photoPath});
    if(error)throw error;
    $("#completeModal").classList.add("hidden");
    toast("Pekerjaan selesai dan menunggu verifikasi user.");
    await loadWorks();
  }catch(error){
    console.error("Selesaikan pekerjaan gagal:",error);
    toast("Gagal menyelesaikan pekerjaan: "+error.message,true);
  }finally{
    button.disabled=false;
    button.innerHTML=original;
    icons();
  }
}
function setupSignatureCanvas(){
  const canvas=$("#signatureCanvas");
  if(!canvas)return;
  signatureContext=canvas.getContext("2d");
  signatureContext.lineWidth=3;
  signatureContext.lineCap="round";
  signatureContext.strokeStyle="#0f172a";
  const point=event=>{const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}};
  canvas.onpointerdown=event=>{signatureDrawing=true;canvas.setPointerCapture?.(event.pointerId);const p=point(event);signatureContext.beginPath();signatureContext.moveTo(p.x,p.y)};
  canvas.onpointermove=event=>{if(!signatureDrawing)return;const p=point(event);signatureContext.lineTo(p.x,p.y);signatureContext.stroke()};
  canvas.onpointerup=canvas.onpointercancel=canvas.onpointerleave=()=>signatureDrawing=false;
}
function clearSignature(){if(signatureContext)signatureContext.clearRect(0,0,$("#signatureCanvas").width,$("#signatureCanvas").height)}
function openVerifyModal(id){
  if(!canVerify())return toast("Hanya user atau admin yang dapat melakukan verifikasi.",true);
  const work=works.find(x=>x.id===id);
  if(!work)return toast("Pekerjaan tidak ditemukan.",true);
  if(normalizedStatus(work.status)!=="selesai"||work.verified_at)return toast("Pekerjaan belum dapat diverifikasi.",true);
  if(!work.after_photo_path)return toast("Foto sesudah pekerjaan belum tersedia.",true);
  verifyWorkId=id;
  $("#verifyWorkInfo").innerHTML=`<small class="eyebrow">PEKERJAAN</small><h3>${esc(work.title)}</h3><p>${esc(work.equipment?.name||"-")} • ${esc(work.pic||"-")}</p>`;
  clearSignature();
  $("#verifyModal").classList.remove("hidden");
  icons();
}
async function saveVerification(){
  const canvas=$("#signatureCanvas");
  const button=$("#saveVerificationBtn");
  if(!verifyWorkId)return toast("Pekerjaan verifikasi tidak ditemukan.",true);
  const signatureBlob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!signatureBlob||signatureBlob.size<700)return toast("Buat paraf terlebih dahulu.",true);
  button.disabled=true;
  const original=button.innerHTML;
  button.textContent="Menyimpan...";
  try{
    const path=`signatures/${verifyWorkId}-${Date.now()}.png`;
    const upload=await sb.storage.from(C.PHOTO_BUCKET).upload(path,signatureBlob,{contentType:"image/png",upsert:false});
    if(upload.error)throw upload.error;
    const{error}=await sb.rpc("user_verify_work",{p_work_id:verifyWorkId,p_signature_path:path});
    if(error)throw error;
    $("#verifyModal").classList.add("hidden");
    toast("Pekerjaan berhasil diverifikasi.");
    verifyWorkId=null;
    await loadWorks();
  }catch(error){
    console.error("Verifikasi gagal:",error);
    toast("Verifikasi gagal: "+error.message,true);
  }finally{
    button.disabled=false;
    button.innerHTML=original;
    icons();
  }
}
function detail(id){const x=works.find(w=>w.id===id),item=(a,b,c="")=>`<div class="detail-item ${c}"><small>${a}</small><strong>${esc(b||"-")}</strong></div>`,img=p=>p?`<img class="detail-photo" src="${photoUrl(p)}">`:"Belum tersedia";$("#detailGrid").innerHTML=item("Pekerjaan",x.title,"span2")+item("Equipment",x.equipment?.name)+item("PIC",x.pic)+`<div class="detail-item"><small>Bulan</small><div class="month-detail"><i data-lucide="calendar-days"></i><strong>${esc(monthLabel(x.due_date))}</strong></div></div>`+item("Tanggal Rencana",x.due_date)+item("Jenis",x.work_type)+item("Prioritas",x.priority)+item("Status",x.verified_at?"Terverifikasi":x.status)+`<div class="detail-item span2"><small>Deskripsi</small><p>${esc(x.description||"-")}</p></div><div class="detail-item">${img(x.before_photo_path)}</div><div class="detail-item">${img(x.after_photo_path)}</div>`;$("#detailModal").classList.remove("hidden");icons()}
function openForm(id){const x=works.find(w=>w.id===id);$("#workModalTitle").textContent=x?"Edit Pekerjaan":"Tambah Pekerjaan";[["workId",x?.id],["title",x?.title],["equipmentId",x?.equipment_id],["pic",x?.pic],["type",x?.work_type],["priority",x?.priority],["dueDate",x?.due_date],["status",x?.status],["description",x?.description]].forEach(([a,b])=>$("#"+a).value=b||"");$("#workModal").classList.remove("hidden")}
async function saveWork(e){e.preventDefault();const id=$("#workId").value||crypto.randomUUID(),old=works.find(x=>x.id===id),payload={id,title:$("#title").value,equipment_id:$("#equipmentId").value,pic:$("#pic").value,work_type:$("#type").value,priority:$("#priority").value,due_date:$("#dueDate").value,status:$("#status").value,description:$("#description").value,created_by:old?.created_by||session.user.id};const{error}=await sb.from("works").upsert(payload);if(error)return toast(error.message,true);$("#workModal").classList.add("hidden");loadWorks()}
function renderKpiPage(){const year=Number($("#kpiYearFilter").value)||new Date().getFullYear(),data=works.filter(x=>String(x.due_date||"").startsWith(String(year))),monthly=Array(12).fill(0);data.forEach(x=>{const m=Number(String(x.due_date).slice(5,7));if(m)monthly[m-1]++});$("#yearTotal").textContent=data.length;$("#yearOpen").textContent=data.filter(x=>x.status==="Open").length;$("#yearProcess").textContent=data.filter(x=>x.status==="Proses").length;$("#yearDone").textContent=data.filter(x=>x.verified_at||x.status==="Selesai").length;const labels=Array.from({length:12},(_,i)=>new Intl.DateTimeFormat("id-ID",{month:"short"}).format(new Date(year,i,1)));barChart?.destroy();doughnutChart?.destroy();barChart=new Chart($("#monthlyBarChart"),{type:"bar",data:{labels,datasets:[{label:"Pekerjaan",data:monthly,backgroundColor:"#22d3ee",borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#cbd5e1"}}},scales:{x:{ticks:{color:"#94a3b8"},grid:{color:"#ffffff0a"}},y:{beginAtZero:true,ticks:{color:"#94a3b8",precision:0},grid:{color:"#ffffff12"}}}}});const statuses=[data.filter(x=>x.status==="Open").length,data.filter(x=>x.status==="Proses").length,data.filter(x=>x.status==="Selesai").length];doughnutChart=new Chart($("#statusDoughnutChart"),{type:"doughnut",data:{labels:["Open","Proses","Selesai"],datasets:[{data:statuses,backgroundColor:["#f43f5e","#f59e0b","#10b981"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:"#cbd5e1"}}}}});$("#monthSummaryGrid").innerHTML=labels.map((l,i)=>`<div class="month-summary-card"><span>${l} ${year}</span><strong>${monthly[i]}</strong></div>`).join("")}
init();
"use strict";
(function(){
const $=s=>document.querySelector(s),norm=v=>String(v||"").trim().toLowerCase();
const bind=(id,event,fn)=>{const el=document.getElementById(id);if(el)el[event]=fn};
const reportName=()=>{const d=new Date();return `maintenance-report-${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}.xlsx`};
function readExcel(file){return new Promise((resolve,reject)=>{if(!file)return reject(Error("Pilih file Excel."));const r=new FileReader;r.onload=()=>{try{const b=XLSX.read(r.result,{type:"array",cellDates:true});resolve(XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]],{defval:"",raw:false}))}catch(e){reject(e)}};r.onerror=()=>reject(Error("File gagal dibaca."));r.readAsArrayBuffer(file)})}
function value(row,names){const a=names.map(norm),k=Object.keys(row).find(x=>a.includes(norm(x)));return k?row[k]:""}
function dateValue(v){if(!v)return null;const t=String(v).trim();if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);const m=t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:null}
async function importWorks(e){try{const rows=await readExcel(e.target.files?.[0]),payload=[];for(const r of rows){const title=String(value(r,["Pekerjaan","Judul","Title"])).trim(),eqText=String(value(r,["Equipment","Nama Equipment","Code Number"])).trim(),eq=equipment.find(x=>norm(x.name)===norm(eqText)||norm(x.code_number)===norm(eqText));if(!title||!eq)continue;payload.push({title,equipment_id:eq.id,work_type:String(value(r,["Jenis","Work Type"])).trim()||"Others",priority:String(value(r,["Prioritas","Priority"])).trim()||"Medium",pic:String(value(r,["PIC"])).trim(),status:String(value(r,["Status"])).trim()||"Open",description:String(value(r,["Deskripsi","Description"])).trim(),due_date:dateValue(value(r,["Tanggal Rencana","Due Date","Tanggal"])),created_by:session.user.id})}if(!payload.length)throw Error("Tidak ada baris valid. Equipment harus cocok dengan Master Data.");const{error}=await sb.from("works").insert(payload);if(error)throw error;toast(`${payload.length} pekerjaan berhasil diunggah.`);await loadWorks()}catch(err){toast("Mass upload pekerjaan gagal: "+err.message,true)}finally{e.target.value=""}}
async function importEquipment(e){try{const rows=await readExcel(e.target.files?.[0]),payload=rows.map(r=>({name:String(value(r,["Equipment","Name","Nama Equipment"])).trim(),plant:String(value(r,["Plant"])).trim(),code_number:String(value(r,["Code Number","Code_Number","Kode"])).trim(),funloc:String(value(r,["Funloc","Functional Location"])).trim()})).filter(x=>x.name);if(!payload.length)throw Error("Tidak ada equipment valid.");const{error}=await sb.from("equipment").upsert(payload);if(error)throw error;toast(`${payload.length} equipment berhasil diunggah.`);await loadEquipment()}catch(err){toast("Mass upload equipment gagal: "+err.message,true)}finally{e.target.value=""}}
async function addEquipment(){if(norm(profile?.role)!=="admin")return toast("Hanya admin yang dapat menambah equipment.",true);const name=prompt("Nama Equipment");if(!name)return;const{error}=await sb.from("equipment").insert({name:name.trim(),plant:(prompt("Plant")||"").trim(),code_number:(prompt("Code Number")||"").trim(),funloc:(prompt("Functional Location")||"").trim()});if(error)return toast(error.message,true);toast("Equipment berhasil ditambahkan.");await loadEquipment()}
async function addPhoto(book,sheet,path,col,row){if(!path)return;try{let blob;try{const r=await fetch(photoUrl(path),{cache:"no-store"});if(r.ok)blob=await r.blob()}catch{}if(!blob){const d=await sb.storage.from(C.PHOTO_BUCKET).download(path);if(d.error)throw d.error;blob=d.data}const bitmap=await createImageBitmap(blob),canvas=document.createElement("canvas"),scale=Math.min(1,900/bitmap.width,700/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const c=canvas.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(bitmap,0,0,canvas.width,canvas.height);const jpg=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.72)),id=book.addImage({buffer:await jpg.arrayBuffer(),extension:"jpeg"});sheet.addImage(id,{tl:{col:col-1+.1,row:row-1+.1},ext:{width:120,height:82}})}catch(err){console.error(err)}}
async function exportXlsx(ret=false){try{const rows=filtered();if(!rows.length)throw Error("Tidak ada data untuk diekspor.");toast("Membuat XLSX...");const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Report");sheet.columns=[{header:"No",key:"no",width:7},{header:"Pekerjaan",key:"title",width:32},{header:"Equipment",key:"eq",width:24},{header:"Jenis",key:"type",width:25},{header:"Prioritas",key:"priority",width:14},{header:"PIC",key:"pic",width:18},{header:"Bulan",key:"month",width:18},{header:"Status",key:"status",width:18},{header:"Foto Sebelum",key:"before",width:19},{header:"Foto Sesudah",key:"after",width:19}];for(let i=0;i<rows.length;i++){const x=rows[i],r=sheet.addRow({no:i+1,title:x.title,eq:x.equipment?.name||"-",type:x.work_type,priority:x.priority,pic:x.pic,month:monthLabel(x.due_date),status:x.verified_at?"Terverifikasi":x.status,before:x.before_photo_path?"":"Tidak ada",after:x.after_photo_path?"":"Tidak ada"});r.height=72;await addPhoto(book,sheet,x.before_photo_path,9,i+2);await addPhoto(book,sheet,x.after_photo_path,10,i+2)}const blob=new Blob([await book.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});if(ret)return blob;saveAs(blob,reportName());toast("XLSX berhasil dibuat.");return blob}catch(err){toast("Export gagal: "+err.message,true);return null}}
async function sendEmail(){const to=prompt("Email penerima",C.REPORT_RECIPIENT||"");if(!to)return;try{const blob=await exportXlsx(true);if(!blob)throw Error("XLSX gagal dibuat.");const base64=await new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(blob)});toast("Mengirim melalui Gmail...");const{data,error}=await sb.functions.invoke("send-report",{body:{to:to.trim(),filename:reportName(),attachmentBase64:base64}});if(error)throw error;if(!data?.success)throw Error(data?.error||"Email gagal dikirim.");toast(data.message||"Email berhasil dikirim.")}catch(err){toast("Kirim email gagal: "+err.message,true)}}
function wire(){bind("emailBtn","onclick",sendEmail);bind("exportBtn","onclick",()=>exportXlsx(false));bind("importWorksBtn","onclick",()=>$("#importWorksFile")?.click());bind("importWorksFile","onchange",importWorks);bind("importEquipmentBtn","onclick",()=>$("#importEquipmentFile")?.click());bind("importEquipmentFile","onchange",importEquipment);bind("masterAddBtn","onclick",addEquipment)}
window.addEventListener("load",wire);setTimeout(wire,500);
})();
