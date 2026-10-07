// Placeholder aman untuk workflow terjadwal.
// Implementasi produksi sebaiknya membuat XLSX di server (misalnya SheetJS/ExcelJS yang kompatibel Deno),
// memvalidasi REPORT_JOB_TOKEN, mengambil data dengan SERVICE_ROLE, dan mengembalikan binary XLSX.
// Frontend sudah menyediakan export XLSX lengkap dengan foto. Lihat README bagian Auto Email.
Deno.serve(()=>new Response('Implement server-side export before enabling schedule',{status:501}));