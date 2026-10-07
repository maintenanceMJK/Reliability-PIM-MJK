# Maintenance Work Management

Frontend statis untuk GitHub Pages, database/auth/storage/Edge Functions di Supabase, tanpa Render.

## Isi
- Login Supabase Auth dan role admin, technician, user.
- CRUD pekerjaan, foto sebelum/sesudah, filter, KPI, import Excel.
- Teknisi hanya menyelesaikan jika foto sesudah tersedia.
- User/admin memverifikasi menggunakan paraf digital.
- Master equipment dan import massal.
- Export XLSX dengan foto yang dikompresi dan ukuran seragam.
- Kirim XLSX melalui Email API HTTPS dari Edge Function.
- Workflow Gmail SMTP terjadwal.

## Pemasangan ringkas
1. Buat project Supabase. Jalankan `supabase/schema.sql` di SQL Editor.
2. Di Authentication, buat user pertama. Jalankan query terakhir di schema untuk menjadikannya admin.
3. Salin Project URL dan anon key ke `config.js`. Anon key boleh di frontend, SERVICE_ROLE tidak boleh.
4. Install Supabase CLI, login, link project, lalu deploy:
   `supabase functions deploy send-report`
   `supabase functions deploy admin-user`
5. Simpan secret Edge Function: `EMAIL_API_KEY`, `EMAIL_API_URL`, dan `EMAIL_FROM`. Endpoint default pada contoh kompatibel format Resend. Alamat Gmail sebagai From hanya dapat dipakai jika domain/alamat sudah diverifikasi pada provider.
6. Upload seluruh isi folder ini ke root repository GitHub. Settings > Pages > Deploy from branch > main / root.
7. Ganti `assets/logo.svg` dengan foto logo Anda, tetap memakai nama `logo.svg`, atau ubah path pada `index.html`.

## Template import
Gunakan `templates/template-pekerjaan.xlsx` dan `templates/template-equipment.xlsx`. Header jangan diubah.

## Secrets GitHub Actions
Tambahkan di Settings > Secrets and variables > Actions:
- `GMAIL_USERNAME`: maintenancemjkreport@gmail.com
- `GMAIL_APP_PASSWORD`: Google App Password, bukan password akun
- `REPORT_RECIPIENTS`: daftar penerima
- `SUPABASE_EXPORT_URL`: URL function export-report
- `REPORT_JOB_TOKEN`: token acak khusus job

> Penting: workflow auto-email tidak boleh menyimpan password Gmail di kode. File `export-report` sengaja berupa placeholder 501 karena pembuatan XLSX server-side dengan foto perlu disesuaikan dengan batas penggunaan dan provider Anda sebelum dijadwalkan. Tombol export dan kirim email pada frontend sudah berfungsi setelah Email API dikonfigurasi.

## Catatan keamanan produksi
Policy update generik pada `works` disediakan agar demo role segera berjalan. Untuk produksi, pindahkan transisi status teknisi dan verifikasi user ke RPC/Edge Functions agar tiap role hanya dapat mengubah kolom yang diizinkan. Aktifkan CAPTCHA/rate limit, batasi origin CORS ke domain GitHub Pages, dan pertimbangkan bucket private plus signed URL.
