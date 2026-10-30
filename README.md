# NETLAB — Network Topology & MikroTik Simulator

**NETLAB** adalah platform interaktif untuk merancang, mengonfigurasi, memvisualisasikan, dan menyimulasikan jaringan komputer (kampus & enterprise) sebelum diimplementasikan pada infrastruktur fisik nyata.

---

## Ringkasan Tahap 1: Phase 1–3 (Fondasi, Konektivitas, dan Konfigurasi)

Pada tahap ini, modul-modul berikut telah dibangun secara terintegrasi dan fungsional:

### 1. Phase 1 — Foundation (Fondasi)
- **Unified Graph Model**: Seluruh perangkat (*Nodes*), interface fisik (*Ports*), kabel link (*Edges*), dan VLAN berada di bawah satu model data reaktif terpadu (Zustand store + REST API).
- **Device Catalog Berbasis Data Nyata**:
  - **MikroTik RB Series**: RB750Gr3 (hEX, 5x 1G), RB4011 (10x 1G, 1x SFP+ 10G), RB5009 (7x 1G, 1x 2.5G, 1x SFP+ 10G).
  - **MikroTik CCR Series**: CCR1009-7G-1C-1S+, CCR2004 (12x SFP+ 10G, 2x 25G SFP28), CCR2116-12G-4S+ (13x 1G, 4x SFP+ 10G), CHR (Virtual Router).
  - **MikroTik CRS & Managed Switches**: CRS326-24G-2S+IN (24x 1G, 2x SFP+ 10G), CRS328-24P-4S+RM (PoE+), Enterprise 48-port Core Switch.
  - **Wireless Access Points**: MikroTik hAP ax3 (Wi-Fi 6 ax), cAP ax (Ceiling AP).
  - **WAN / ISP Devices**: ISP Dedicated Fiber Metro-E (SFP+ handoff, 1:1 CIR), ISP Broadband GPON ONT, Starlink Satellite Gateway.
  - **Servers & Endpoints**: Enterprise Compute Server, Workstation PC, Laptop, IP CCTV, Network Printer.
- **Topology Canvas NOC**:
  - Drag-and-drop perangkat, pergerakan bebas, zoom, pan, dan fit-to-screen.
  - Visualisasi faceplate port perangkat fisik (RJ45 vs SFP/SFP+ cage) dengan indikator LED link status (hijau menyala jika terhubung).
- **Manajemen Proyek & JSON Repository**:
  - REST API backend dengan persistence atomik pada file `data/projects.json` dan `data/audit_logs.json`.
  - Simpan, buka, duplikasi, buat baru, ekspor, dan impor file `.json`.

### 2. Phase 2 — Connectivity (Interface & Fiber Optic Engine)
- **Model Interface Fisik**:
  - Tipe port nyata: `ethernet` (RJ45), `sfp` (1G), `sfp-plus` (10G), `sfp28` (25G), `wireless`, `management`.
- **Engine Kabel & Media Optik**:
  - Single-Mode Fiber OS2 9/125µm (Kabel Kuning, konektor LC-LC, 1310nm/1550nm, jangkauan hingga 40km, redaman 0.35 dB/km).
  - Multi-Mode Fiber OM3/OM4 50/125µm (Kabel Aqua, konektor LC-LC, 850nm, jangkauan hingga 300-550m, redaman 3.0 dB/km).
  - Cat6 / Cat6A STP Copper Cable (RJ45, batas 100m).
- **Spesifikasi & Kompatibilitas Transceiver**:
  - S-31DLC20D (1G LX), S-85DLC05D (1G SX), S-RJ01 (1G RJ45).
  - S+31DLC10D (10G LR), S+85DLC03D (10G SR), S+55DLC40D (10G ER 40km).
  - S+23LC10D (10G BiDi Up Tx1270/Rx1330) & S+32LC10D (10G BiDi Down Tx1330/Rx1270).
  - S+RJ10 (10G Copper module).
- **Validasi Koneksi Fisik (L1)**:
  - Mencegah kabel fiber dicolokkan ke port RJ45 tanpa SFP.
  - Mencegah kabel tembaga dicolokkan ke cage SFP tanpa modul tembaga S-RJ01/S+RJ10.
  - Memvalidasi pasangan optik BiDi (BiDi Up harus berpasangan dengan BiDi Down).
  - Menghitung batas jarak kabel dan redaman sinyal (*attenuation loss*).

### 3. Phase 3 — Configuration (CLI, Form, & Validation Engine)
- **NETLAB CLI Terminal**:
  - Eksekusi perintah topologi instan:
    - `device add <model> name=<NAME> [x=<X>] [y=<Y>]`
    - `device remove <NAME>`
    - `link add <DEV1>:<PORT1> <DEV2>:<PORT2> [media=fiber-sm|copper-cat6] [length=<METERS>]`
    - `interface set <DEV>:<PORT> [ip=<CIDR>] [mode=access|trunk|wan] [vlan=<ID>] [admin=up|down]`
    - `vlan add id=<ID> name=<NAME> [subnet=<CIDR>] [gw=<IP>]`
    - `simulate validate` / `diagnose all`
    - `show devices` / `show links` / `show vlans`
    - `help` & `clear`
  - Dilengkapi *command history* (panah atas/bawah) dan *autocomplete suggestions*.
- **Form Device & Interface Inspector**:
  - Pengubahan hostname, mode port (Access, Trunk, WAN, Routed), IP CIDR, PVID, MTU, transceiver slot, dan admin up/down.
- **Rule Engine Diagnostik Terstruktur**:
  - Kode eror terverifikasi: `LINK_ENDPOINT_MISSING`, `INTERFACE_DISABLED`, `TRANSCEIVER_INCOMPATIBLE`, `MEDIA_MISMATCH`, `SPEED_MISMATCH`, `FIBER_SIGNAL_LOSS`, `VLAN_NOT_ALLOWED`, `VLAN_MISMATCH`, `IP_SUBNET_MISMATCH`, `IP_ADDRESS_CONFLICT`, `GATEWAY_UNREACHABLE`, `DEVICE_NAME_DUPLICATE`.
  - Setiap temuan dilengkapi *Observed Condition*, *Evidence*, *Probable Cause*, dan *Recommended Fix*.
- **Undo / Redo Stack**:
  - Riwayat langkah pengubahan hingga 25 level riwayat.
- **Audit Log Trail**:
  - Pencatatan seluruh aksi pengguna (dari Canvas, Form, maupun CLI).

---

## Struktur Folder

```
├── data/                         # Direktori persistent JSON database
│   ├── projects.json             # Penyimpanan proyek topologi
│   └── audit_logs.json           # Log riwayat audit
├── public/                       # Aset publik
├── src/
│   ├── components/               # Komponen UI
│   │   ├── TopBar.tsx            # Header bar & project selector
│   │   ├── Sidebar.tsx           # Katalog perangkat, template & spesifikasi kabel
│   │   ├── TopologyCanvas.tsx    # Kanvas SVG/React interaktif
│   │   ├── DeviceInspector.tsx   # Panel inspeksi properti & interface perangkat
│   │   ├── ConnectionModal.tsx   # Dialog negosiasi kabel & transceiver
│   │   └── BottomPanel.tsx       # Konsol CLI, diagnostik, VLAN & audit log
│   ├── data/
│   │   ├── deviceCatalog.ts      # Spesifikasi otentik MikroTik & perangkat
│   │   └── mediaSpecs.ts         # Spesifikasi kabel, serat optik & transceiver SFP
│   ├── server/
│   │   └── storage.ts            # Repository penyimpanan file JSON atomik
│   ├── services/
│   │   ├── validationEngine.ts   # Rule engine validasi Layer 1-3
│   │   └── cliParser.ts          # Parser & eksekutor perintah NETLAB CLI
│   ├── store/
│   │   └── useNetworkStore.ts    # Reaktif state management Zustand
│   ├── types/
│   │   └── network.ts            # Tipe TypeScript & skema Zod
│   ├── App.tsx                   # Layout utama antarmuka NOC
│   ├── index.css                 # Konfigurasi Tailwind CSS v4 & custom styles
│   └── main.tsx                  # Titik masuk React 19
├── server.ts                     # Express server & integrasi Vite dev middleware
├── package.json
└── tsconfig.json
```

---

## Persyaratan Runtime & Instalasi

### Persyaratan
- Node.js versi 18 atau 20+
- npm versi 9+

### Instalasi & Menjalankan Server
```bash
# Instal dependensi
npm install

# Jalankan dalam mode pengembangan (Express API + Vite pada Port 3000)
npm run dev

# Kompilasi aplikasi untuk produksi
npm run build

# Menjalankan server produksi
npm start
```

---

## Petunjuk Pengujian (Acceptance Tests)

### 1. Uji Pembuatan & Penghapusan Perangkat
- Buka tab **Device Catalog** di sidebar kiri.
- Klik ikon `+` pada router **CCR2116-12G-4S+** atau **RB5009**.
- Perangkat akan muncul di kanvas dengan 16/9 port fisik dan status `RUN`.
- Klik perangkat untuk membuka **Device Inspector** di sebelah kanan. Ubah hostname dan pastikan nama di kanvas ikut berubah secara otomatis.

### 2. Uji Penarikan Kabel & Serat Optik (Fiber Engine)
- Klik salah satu port SFP+ (misal `sfp-sfpplus1`) pada router. Port akan berkedip tanda mode koneksi aktif.
- Klik port SFP+ pada switch distribusi **CRS326**.
- Modal negosiasi fisik akan terbuka otomatis:
  - Pilih **Single-Mode Fiber OS2 (Yellow)** dengan transceiver **10G LR (1310nm)** pada kedua ujung.
  - Atur panjang kabel menjadi 120m.
  - Klik **Establish Physical Link**.
  - Garis kabel kuning dengan animasi pulsa optik putih akan menghubungkan kedua port di kanvas.
- Coba sambungkan port fiber langsung ke port RJ45 Ethernet: sistem akan mendeteksi `MEDIA_MISMATCH` dan memberi peringatan.

### 3. Uji CLI Interaktif
- Di panel bawah, pilih tab **NETLAB CLI**.
- Ketik perintah:
  ```bash
  device add router RB5009 name=EDGE-ROUTER
  ```
  Perangkat baru akan langsung dibuat dan ditambahkan ke kanvas secara instan.
- Ketik:
  ```bash
  simulate validate
  ```
  CLI akan menampilkan hasil audit diagnostik komprehensif.

### 4. Uji Diagnostik Root-Cause
- Di Device Inspector, pilih salah satu port yang terhubung dan ubah status admin dari `UP` menjadi `DOWN`.
- Status tautan link akan langsung berubah menjadi `DISABLED` dengan indikator kuning/merah.
- Buka tab **Diagnostics** di panel bawah: periksa rincian kode `INTERFACE_DISABLED` lengkap dengan bukti (*evidence*) dan langkah perbaikannya (*recommended action*).
- Kembalikan status admin ke `UP`, dan status akan kembali normal `RUN`.

### 5. Uji Simpan & Ekspor Proyek
- Klik tombol **Save** di bar atas: proyek disimpan secara atomik ke backend `data/projects.json`.
- Klik tombol **Export**: berkas JSON lengkap dari topologi dapat diunduh ke komputer Anda.

---

## Ringkasan Tahap 2: Phase 4–6 (Simulasi dan Monitoring)

Pada tahap ini, modul-modul berikut telah dibangun secara terintegrasi dan fungsional:

### 1. Phase 4 — Logical Network Simulation Engine
- **Packet Tracer Simulation Lab**:
  - Simulasi menyeluruh lintasan paket hop-by-hop (L1 Carrier, L2 Switching & 802.1Q Tagging/Access/Trunk, L3 Routing Table Lookup, hingga NAT Masquerade pada batas router WAN).
  - Penghitungan latensi round-trip (RTT) dan jitter per hop berdasarkan media kabel, panjang serat optik, dan kapasitas port.
  - Timeline visual hop-by-hop di panel bawah dengan status detail: ingress interface, VLAN encapsulation tag, route lookup, egress interface, dan L3 packet rewrite (NAT).
  - Visualisasi berkas sinar cahaya pulsa animasi di kanvas topologi mengikuti kabel yang dilalui paket, lengkap dengan HUD floating card.
- **Interaktif Ping & Traceroute Prober**:
  - CLI `ping <IP>` dan `traceroute <IP>` dengan output terminal real-time.
  - Prober cepat langsung di panel **Device Inspector** untuk perangkat aktif yang sedang dipilih.

### 2. Phase 5 — ISP CIR & Contention Profiles & Live Traffic Telemetry
- **Profil Kontrak ISP Nyata**:
  - **Dedicated Internet Access (DIA 1:1)**: Bandwidth simetris, CIR 100%, rasio contention 1:1 tanpa pengaruh beban pengguna lain.
  - **Shared Broadband GPON**: Rasio contention 1:4 hingga 1:10 dengan kalkulasi throughput dinamis berbasis formula:
    $$\text{Throughput} = \min\left(\text{Access Capacity}, \frac{\text{Shared Capacity}}{\text{Active Users}}\right)$$
  - Slider interaktif untuk simulasi fluktuasi beban pengguna concurrent.
- **Live Traffic Telemetry Engine**:
  - Background ticker berkala (2.5 detik) yang menghitung throughput aktual (RX/TX Mbps), packet rate (PPS), dan persentase utilisasi link.
  - Alert kemacetan tautan (*Link Congestion Alert*) otomatis ke Event Log ketika utilisasi melampaui 80% kapasitas link.
  - Badges throughput dan status kemacetan di kanvas topologi pada titik tengah kabel.
  - Sparkline grafik bentuk gelombang (*Waveform Sparkline*) pada kartu telemetri di panel bawah (RX hijau, TX cyan).

### 3. Phase 6 — Device Health, Diagnostics & Audit Report Export
- **Event Log Stream**:
  - Pencatatan seluruh kejadian transisi link carrier, simulasi paket, perubahan throughput, dan peringatan kemacetan link.
- **Ekspor Laporan Audit Lengkap (Markdown)**:
  - Tombol **Export Audit Report** di tab Traffic & Diagnostics untuk mengunduh laporan menyeluruh arsitektur jaringan (Ringkasan Diagnostik, Inventaris Perangkat, Tautan Serat Optik & Redaman, Database VLAN, Kontrak ISP & CIR, serta Riwayat Jejak Paket Simulasi).

---

## Petunjuk Pengujian Phase 4–6

### 1. Uji Packet Tracer & Ping Simulasi
1. Buka tab **Packet Tracer** di panel bawah (atau gunakan CLI `ping 8.8.8.8` / `ping 10.20.0.1`).
2. Pilih Source Node: `PC-LAB-01` atau `SERVER-DC-01`.
3. Masukkan Target IP: `8.8.8.8` (Public DNS) atau IP gateway lokal `10.20.0.1`.
4. Klik **Dispatch Simulation**:
   - Perhatikan timeline hop demi hop yang menampilkan enkapsulasi VLAN, route forwarding, dan NAT Masquerade saat melewati router WAN.
   - Perhatikan animasi pulsa sinar cyan/kuning yang merambat sepanjang kabel yang dilalui paket di kanvas.

### 2. Uji Traffic Telemetry & Kemacetan (Congestion)
1. Buka tab **Traffic Telemetry** di panel bawah.
2. Lihat indikator `Engine: ACTIVE` dengan angka throughput RX/TX yang terus diperbarui setiap 2.5 detik.
3. Periksa grafik bentuk gelombang (*waveform sparkline*) pada setiap kartu link fisik.
4. Anda dapat menjeda atau melanjutkan telemetri dengan tombol **Pause / Resume Engine**.

### 3. Uji Model ISP CIR & Contention
1. Buka tab **ISP & CIR** di panel bawah.
2. Pada kartu **Telkom IndiHome Bisnis (Broadband 1:4)**, geser slider **Concurrent Shared Users** dari 4 menjadi 25.
3. Amati bagaimana perkiraan throughput (*Est. Throughput*) turun secara dinamis sesuai rumus contention.

### 4. Uji Ekspor Laporan Audit Jaringan
1. Pada tab **Traffic Telemetry**, klik tombol **Export Audit Report**.
2. Berkas Markdown `NETLAB_Report_<Nama_Proyek>.md` akan langsung terunduh ke komputer Anda dengan audit komprehensif seluruh layer 1–3 topologi.

---

## Ringkasan Fitur: Custom Device Builder & Device Catalog Management

Fitur **Custom Device Builder** memungkinkan perancang jaringan menambahkan perangkat jaringan secara mandiri berdasarkan spesifikasi fisik autentik yang ada di pasaran/datasheet produsen resmi (MikroTik, Cisco, Ubiquiti, Dell, Juniper, Fortinet, dll).

### 1. Unified Device Architecture & 9-Step Wizard
- **Step 1 — Basic Information**: Nama perangkat, merek, manufaktur, nomor model, seri, kategori (19 kategori didukung: Router, Switch, L3 Switch, Firewall, Wireless Router, AP, WLC, Modem, ONT, ISP Gateway, Optical Terminal, Server, Storage Server, Hypervisor, VM, Container Host, Load Balancer, Appliance, Custom Generic), deskripsi, form factor, tahun rilis, link resmi, link datasheet, sumber referensi, dan Verification Status (`VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`).
- **Step 2 — Hardware Specifications**: CPU model, manufaktur, arsitektur, jumlah core, frekuensi (MHz), RAM (MB), Storage (MB), OS/Firmware, konsumsi daya (Watts), power supply redundant, dan sistem pendingin (fan / passive heatsink).
- **Step 3 — Physical Interfaces**: Manajemen port granular dengan penentuan ID, nama port, tipe interface (GbE, 2.5G, 10G SFP+, 25G SFP28, 40G, 100G, Fiber, Wi-Fi, Console, dll.), kategori (Fixed, Modular, Combo, Expansion, Wireless, Logical), kecepatan manual (100M, 1000M, 2.5G, 10G, 25G, 40G, 100G), duplex, konektor (RJ45, LC, SFP, SFP+, USB, dll.), media type default, port group, dan MTU range.
- **Step 4 — Interface Layout**: Faceplate visual preview dua sisi (Front & Rear ports), pengaturan baris & kolom grid, LED link indicator simulator, dan re-ordering port.
- **Step 5 — Network Capabilities**: Penentuan kapabilitas autentik perangkat (L2/L3, IPv4/IPv6, Static & Dynamic Routing, 802.1Q VLAN & Trunking, STP/RSTP/MSTP, LACP / Link Aggregation, Jumbo Frames, OSPF, BGP, RIP, ECMP, Policy Based Routing, NAT, DHCP Server/Client, DNS Forwarder, Firewall, VPN, QoS, Traffic Shaping, Hotspot, RADIUS).
- **Step 6 — Capacity & Performance**: Switching capacity (Gbps), forwarding rate (Mpps), maximum throughput (Gbps), firewall throughput, IPsec VPN throughput, MAC table size, routing table capacity, maximum VLANs, dan concurrent connection limit.
- **Step 7 — PoE Capabilities**: Dukungan PoE (Passive PoE, 802.3af, 802.3at PoE+, 802.3bt Type 3/4), total power budget (Watts), dan batas watt per port.
- **Step 8 — Wireless Specifications**: Dukungan Wi-Fi multi-band (2.4 GHz, 5 GHz, 6 GHz), standar (Wi-Fi 4, 5, 6, 6E, 7), konfigurasi spatial streams MIMO (e.g. 4x4 MU-MIMO), tipe antena (internal/external), channel width (20/40/80/160 MHz), batas klien bersamaan, dan mesh support.
- **Step 9 — Compatibility & Simulation Profile**: Validasi modul optik (SFP/SFP+), media transmisi yang didukung, versi RouterOS minimum, kabel yang tervalidasi, profil engine simulasi (Packet-accurate vs Standard), overhead CPU/RAM factor, penalti latensi, dan dukungan Live CLI.

### 2. AI Specification Assistant (Gemini API Integration)
- Tombol **Auto-Extract Specs with AI** di dalam modal wizard.
- Cukup ketik nama model / nomor seri perangkat (misal `MikroTik CCR2004-16G-2S+PC` atau `Cisco Catalyst 2960-X`) atau tempel teks cuplikan datasheet.
- Backend server-side AI mengekstrak spesifikasi autentik secara terstruktur ke dalam skema Zod dan mengisi form 9-step secara otomatis dalam hitungan detik.

### 3. Isolated Catalog Storage & Immutable Instance Snapshots
- Katalog custom disimpan secara terpisah di `data/custom_devices.json` dan tidak bercampur dengan file proyek `data/projects.json`.
- Saat perangkat diletakkan ke atas kanvas, sebuah *immutable snapshot* dengan `specificationVersion` disematkan ke perangkat instans tersebut.
- Pengubahan atau pembaruan spesifikasi pada katalog di masa depan **tidak akan merusak** konfigurasi perangkat yang sudah terpasang pada kanvas atau topologi yang sudah berjalan.
- **Device Usage Protection**: Jika pengguna mencoba menghapus custom device dari katalog yang sedang digunakan oleh satu atau beberapa proyek, modal proteksi akan muncul menampilkan daftar proyek dan jumlah instans aktif, serta meminta konfirmasi paksa (*force deletion*) sebelum menghapus.
- **Import & Export**: Dukungan ekspor satu perangkat (.json) maupun ekspor seluruh katalog custom (.json) beserta impor file JSON dengan validasi skema Zod terperinci.

---

## 12 Skenario Pengujian Custom Device Builder (Section 12 Tests)

1. **Test 1 — Pembuatan Router Kustom**:
   - Buka tab **My Custom Devices** di sidebar kiri.
   - Buat perangkat baru atau lihat seed **MikroTik CCR2004-16G-2S+PC** (16 port GbE RJ45 + 2 port 10G SFP+).
2. **Test 2 — Pembuatan Switch Terkelola**:
   - Lihat atau buat **Cisco Catalyst 2960-X-24TD-L** (24 port GbE Access + 2 port 10G SFP+ Uplinks).
3. **Test 3 — Pembuatan Access Point Wi-Fi 6**:
   - Lihat atau buat **Ubiquiti UniFi 6 Pro (U6-Pro)** (1x GbE PoE Uplink, dual-band 2.4/5GHz Wi-Fi 6).
4. **Test 4 — Pembuatan Server Multi-NIC**:
   - Lihat atau buat **Dell PowerEdge R640 Enterprise Server** (2x GbE + 2x 10G SFP+ NICs).
5. **Test 5 — Verifikasi Penyimpanan File JSON**:
   - Verifikasi file `data/custom_devices.json` tersimpan dengan format atomik dan data terbaca otomatis saat refresh browser.
6. **Test 6 — Penempatan ke Atas Kanvas Topologi**:
   - Klik tombol `+` pada salah satu perangkat di tab **My Custom Devices**.
   - Perangkat instans muncul di kanvas dengan seluruh interface fisik terpetakan sempurna.
7. **Test 7 — Penarikan Kabel Antara Perangkat Custom & Built-in**:
   - Tarik kabel serat optik dari port SFP+ perangkat custom (e.g. `sfp-plus1` pada CCR2004) ke port SFP+ switch bawaan (e.g. `sfp-sfpplus1` pada CRS326).
   - Sambungan kabel terbentuk normal dan link carrier aktif.
8. **Test 8 — Validasi Kompatibilitas Port**:
   - Coba sambungkan port fiber optik ke port Ethernet RJ45 biasa: sistem menampilkan peringatan `MEDIA_MISMATCH` sesuai aturan konektivitas fisik.
9. **Test 9 — Immutability Versi Spesifikasi**:
   - Ubah spesifikasi perangkat di katalog (misal nama atau deskripsi): perangkat yang sudah ada di kanvas tetap mempertahankan snapshot interface dan versi spesifikasinya tanpa error.
10. **Test 10 — Ekspor & Impor JSON**:
    - Klik tombol download (Export) pada kartu perangkat di katalog untuk mengunduh `.json`.
    - Klik tombol **Import Device** dan unggah berkas `.json` untuk memvalidasi parser skema Zod.
11. **Test 11 — Audit Log Trail**:
    - Buka tab **Audit Log** di panel bawah: periksa pencatatan aksi `DEVICE_CREATED`, `DEVICE_UPDATED`, `DEVICE_DUPLICATED`, dan `DEVICE_DELETED`.
12. **Test 12 — Kompatibilitas Engine Simulasi & Telemetri**:
    - Jalankan Packet Tracer simulasi (Ping / Traceroute) melewati perangkat custom: paket terkirim, hop tercatat di timeline, dan telemetri throughput live beroperasi normal.
