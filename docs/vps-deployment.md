# Panduan Deployment ke Server VPS (Virtual Private Server)

Panduan ini mendokumentasikan cara menyajikan aplikasi **Training & Development System (TDS)** di server VPS mandiri (Ubuntu/Debian/CentOS/Rocky Linux).

---

## 1. 📋 Ringkasan Arsitektur
Proyek ini menghasilkan file statis murni (`index.html`, `css/`, `js/`, `favicon/`) yang tidak membutuhkan runtime server aktif (seperti PM2 atau backend Node runtime yang terus berjalan). Web server apa pun (Nginx, Caddy, Apache, atau Docker Nginx) dapat langsung menyajikan aplikasi ini dengan performa tinggi dan konsumsi memori minimal (< 50MB RAM).

---

## 2. 🚀 Opsi A: Deployment dengan Nginx (Sangat Direkomendasikan)

### Langkah 1: Clone Repository ke Server
```bash
# Pastikan git terpasang
sudo apt update && sudo apt install -y git

# Buat direktori web dan clone repo
sudo mkdir -p /var/www/form-training
sudo git clone https://github.com/<username>/<repo>.git /var/www/form-training

# Berikan izin akses ke web server
sudo chown -R www-data:www-data /var/www/form-training
sudo chmod -R 755 /var/www/form-training
```

### Langkah 2: Buat Konfigurasi Virtual Host Nginx
Buat file konfigurasi baru di `/etc/nginx/sites-available/form-training.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name training.domainanda.com; # Ganti dengan domain/subdomain VPS Anda

    root /var/www/form-training;
    index index.html;

    # Gzip Compression untuk performa cepat
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript image/svg+xml;

    # Single Page Application fallback & static routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Browser Caching untuk aset statis (CSS, JS, Favicon)
    location ~* \.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Blokir akses ke file sensitif, git, scripts internal, dan fixtures
    location ~ /\.(git|github) {
        deny all;
    }
    location ^~ /src/ {
        deny all;
    }
    location ^~ /scripts/ {
        deny all;
    }
    location ^~ /tests/ {
        deny all;
    }

    access_log /var/log/nginx/training_access.log;
    error_log /var/log/nginx/training_error.log;
}
```

### Langkah 3: Aktifkan Konfigurasi & Reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/form-training.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Langkah 4: Pasang SSL Gratis (Let's Encrypt / Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d training.domainanda.com
```

---

## 3. ⚡ Opsi B: Deployment dengan Caddy Server (Auto HTTPS)

Caddy Server sangat disukai karena secara otomatis mengurus sertifikat SSL HTTPS tanpa konfigurasi manual:

### `Caddyfile`
```caddy
training.domainanda.com {
    root * /var/www/form-training
    file_server
    encode gzip zstd

    # SPA routing
    try_files {path} /index.html

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }

    # Protect internal source files
    @internal path /src/* /scripts/* /tests/* /.git/*
    respond @internal 403
}
```

---

## 4. 🐳 Opsi C: Deployment dengan Docker & Docker Compose

Jika VPS Anda berbasis Docker, Anda dapat membuat file `Dockerfile` sederhana di root proyek:

### `Dockerfile`
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Jalankan container:
```bash
docker build -t form-training:latest .
docker run -d -p 8080:80 --name tds-app form-training:latest
```

---

## 5. 🔄 Alur Pembaruan Kode di VPS (Update Workflow)

Setiap kali Anda melakukan update kode dari komputer lokal dan melakukan push ke Git:

```bash
cd /var/www/form-training
git pull origin main

# OPSI 1: Jika index.html sudah di-compile dari lokal (Default)
# Anda tidak perlu menjalankan apa-apa lagi! Halaman langsung ter-update seketika.

# OPSI 2: Jika Anda mengedit file di src/ langsung di server
node scripts/build.js
```

### (Tips Opsional) Otomatisasi via Webhook atau GitHub Actions
Anda dapat memasang GitHub Action sederhana agar setiap kali merge ke `main`, VPS otomatis melakukan `git pull`:
```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: SSH and Pull
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          cd /var/www/form-training
          git pull origin main
```
