import { GuideSectionContent } from '../../types/userGuide';

export const PART2_SIMULATION_GUIDES: GuideSectionContent[] = [
  {
    id: 'isp-management',
    number: '07',
    title: 'ISP Management & WAN Architecture',
    subtitle: 'Mengelola penyedia layanan internet (ISP), sirkuit WAN, perangkat CPE/Modem/ONT, dan skenario Dual-ISP Failover.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'Globe',
    description:
      'Modul ISP Management di NETLAB memodelkan koneksi hulu (upstream) jaringan Anda ke internet. Anda dapat mengatur profil ISP, jenis layanan (Dedicated Fiber, Metro-E, Broadband FTTH, Wireless/Starlink), perangkat terminasi CPE (Modem/ONT), serta peran sirkuit sebagai jalur Primary atau Backup (Failover).',
    purpose:
      'Membantu perancang jaringan memahami rantai konektivitas fisik dan logis dari penyedia layanan hingga ke router utama (`ISP Cloud → Modem/ONT/CPE → Router WAN Interface`) serta menguji keandalan multi-homing.',
    availableFeatures: [
      {
        name: 'ISP Circuit & Service Type Manager',
        status: 'active',
        description: 'Kelola daftar sirkuit ISP lengkap dengan nama provider, tipe layanan, SLA uptime, status kesehatan link (Up, Degraded, Down), dan IP Gateway publik.'
      },
      {
        name: 'Primary, Secondary & Load-Balancing Roles',
        status: 'active',
        description: 'Tetapkan prioritas sirkuit WAN dan uji skenario putus jalur utama (Failover Test) secara instan dari dashboard ISP.'
      },
      {
        name: 'CPE / Modem / ONT Termination Modes',
        status: 'active',
        description: 'Pilih mode perangkat CPE (Bridge Mode, Routed NAT Mode, atau Direct Optical Metro-E) dan hubungkan ke port WAN Router.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka Dashboard ISP & WAN Management',
        description: 'Klik tab "ISP & WAN" pada Bottom Panel di bagian bawah layar. Anda akan melihat ringkasan kapasitas total WAN, utilisasi saat ini, dan kartu konfigurasi setiap sirkuit ISP.'
      },
      {
        stepNumber: 2,
        title: 'Memahami Alur Fisik: ISP → Modem/ONT → Router WAN',
        description: 'Pada topologi nyata maupun di NETLAB: Sirkuit ISP diterminasi oleh perangkat CPE (Modem/ONT) atau langsung ke port SFP/Ethernet WAN pada Router utama. Pastikan node ISP di kanvas terhubung ke port Router yang disetel sebagai mode `WAN`.'
      },
      {
        stepNumber: 3,
        title: 'Menambahkan atau Mengedit Sirkuit ISP',
        description: 'Klik tombol "+ Add ISP Circuit" di tab ISP & WAN. Atur nama provider (misal "Biznet Dedicated" atau "IndiHome Corporate"), pilih tipe layanan (`Dedicated`, `Shared Broadband`, atau `Best Effort`), dan tentukan apakah sirkuit berperan sebagai `Primary` atau `Backup`.'
      },
      {
        stepNumber: 4,
        title: 'Menguji Skenario Gangguan ISP (Outage / Degraded Simulation)',
        description: 'Pada kartu sirkuit ISP di tab "ISP & WAN", ubah status operasional sirkuit dari `UP (Normal)` menjadi `DEGRADED (High Latency/Loss)` atau `DOWN (Outage)` untuk mengamati perpindahan trafik otomatis ke ISP Backup.'
      }
    ],
    technicalTables: [
      {
        title: 'Komponen Arsitektur WAN di NETLAB',
        headers: ['Komponen', 'Peran dalam Topologi', 'Pengaturan Penting'],
        rows: [
          ['ISP / Provider Cloud', 'Sumber konektivitas upstream & gateway publik', 'Kapasitas Download/Upload, CIR, Contention Ratio, Base Latency'],
          ['Modem / ONT / CPE', 'Perangkat terminasi media fiber/wireless dari ISP', 'Mode operasi: Bridge (IP publik di Router) vs Routed (Double NAT)'],
          ['Router WAN Interface', 'Port fisik pada Router yang menghadap ke arah ISP/ONT', 'Mode port `WAN`, IP Address sesuai subnet ISP, Default Route `0.0.0.0/0`, NAT Masquerade']
        ]
      }
    ],
    expectedResults: [
      'Router utama mengenali sirkuit ISP aktif dan menyalurkan trafik internet dari jaringan lokal.',
      'Saat sirkuit Primary disetel ke status `DOWN`, trafik beralih ke sirkuit Backup (jika tersedia dan terhubung) serta tercatat di Event Log.'
    ],
    tips: [
      'Untuk jaringan kantor/enterprise yang membutuhkan akses server dari luar (Port Forwarding/VPN), gunakan mode CPE `Bridge` agar IP Publik langsung terpasang di interface WAN Router MikroTik.',
      'Selalu tambahkan minimal dua sirkuit ISP (Primary Dedicated + Backup Broadband) saat merancang jaringan kritikal.'
    ],
    commonProblems: [
      {
        problem: 'Sirkuit ISP sudah ditambahkan di tab ISP & WAN tetapi utilisasinya tetap 0%.',
        cause: 'Sirkuit ISP belum diikat (bound) ke perangkat Router/ISP di kanvas atau belum ada default route menuju gateway ISP.',
        solution: 'Pastikan node ISP di kanvas terhubung dengan kabel ke port WAN Router dan sirkuit ISP telah dikaitkan ke perangkat tersebut.'
      }
    ],
    relatedGuides: ['bandwidth-cir', 'workload-management', 'network-simulation', 'diagnostics']
  },
  {
    id: 'bandwidth-cir',
    number: '08',
    title: 'Bandwidth, CIR & Contention Ratio',
    subtitle: 'Memahami perhitungan matematis kapasitas Download/Upload, Committed Information Rate (CIR), dan rasio berbagi pakai.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'Gauge',
    description:
      'Dalam perencanaan kapasitas jaringan (Capacity Planning), angka "Up To Bandwidth" dari ISP sering kali berbeda dengan kapasitas nyata saat jam sibuk. NETLAB menggunakan engine kalkulasi berbasis CIR (Committed Information Rate) dan Contention Ratio untuk menyimulasikan performa nyata layanan Dedicated vs Shared Broadband.',
    purpose:
      'Membantu pengguna menghitung secara akurat apakah kapasitas kontrak ISP dan jaminan CIR mencukupi kebutuhan trafik rata-rata maupun trafik puncak (Peak Demand) organisasi.',
    simulationNotice:
      'Rumus di bawah ini adalah formula aktual yang dieksekusi oleh `trafficEngine.ts` di dalam NETLAB saat menghitung throughput efektif, utilisasi CIR, latency antrean (queuing delay), dan packet loss.',
    availableFeatures: [
      {
        name: 'Contracted Bandwidth vs Guaranteed CIR Modeling',
        status: 'active',
        description: 'Pengaturan terpisah untuk Max/Burst Download & Upload (Mbps) serta Guaranteed CIR Download & Upload (Mbps).'
      },
      {
        name: 'Contention Ratio Simulator (1:1, 1:4, 1:8, 1:16, 1:32)',
        status: 'active',
        description: 'Menyimulasikan penurunan throughput efektif pada layanan Shared Broadband ketika jumlah pengguna aktif meningkat.'
      },
      {
        name: 'CIR Breach & Saturation Alerting',
        status: 'active',
        description: 'Peringatan otomatis ketika beban trafik melampaui batas jaminan CIR (potensi throttling ISP) atau melampaui 100% kapasitas pipa.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membedakan Layanan Dedicated, Shared Broadband, dan Best Effort',
        description: 'Buka tab "ISP & WAN". Pilih tipe layanan:\n- `Dedicated (DIA / Metro-E)`: Rasio 1:1, CIR umumnya 100% dari bandwidth kontrak.\n- `Shared Broadband`: Rasio 1:4 s/d 1:16, memiliki batas burst maksimum tetapi jaminan minimum hanya sebesar nilai CIR.\n- `Best Effort`: Rasio hingga 1:32 tanpa jaminan CIR ketat.'
      },
      {
        stepNumber: 2,
        title: 'Mengatur Nilai Bandwidth & CIR',
        description: 'Masukkan nilai `Max Download / Upload (Mbps)` sesuai paket ISP, lalu masukkan nilai `CIR Download / Upload (Mbps)` sesuai jaminan SLA kontrak Anda (misal Bandwidth 100 Mbps dengan CIR 25 Mbps pada rasio 1:4).'
      },
      {
        stepNumber: 3,
        title: 'Membaca Bar Indikator Demand vs CIR vs Max Bandwidth',
        description: 'Perhatikan grafik bar pada kartu sirkuit ISP: garis penanda vertikal menunjukkan posisi batas CIR. Jika bar trafik melampaui garis CIR, status sirkuit berubah menjadi `CIR Exceeded (Bursting)`. Jika melampaui kapasitas maksimum, status menjadi `Saturated (Congested)`.'
      }
    ],
    technicalTables: [
      {
        title: 'Rumus Aktual Kalkulasi Kapasitas di NETLAB (trafficEngine.ts)',
        headers: ['Parameter', 'Rumus / Logika Aktual Engine', 'Penjelasan Praktis'],
        rows: [
          ['Dedicated Effective Capacity', '`Effective = cirDownMbps` (Rasio 1:1, umumnya `CIR == Bandwidth`)', 'Kapasitas selalu terjamin penuh 24 jam tanpa dipengaruhi tetangga jaringan'],
          ['Shared Fair-Share Capacity', '`activeLoadFactor = max(1, activeUsers / ratioNum)`\n`Effective = min(BW, max(CIR, BW / activeLoadFactor))`', 'Saat pengguna aktif meningkat melebihi rasio bagi, kapasitas turun mendekati batas lantai CIR'],
          ['CIR Utilization (%)', '`cirUtil = (actualDemandMbps / cirMbps) * 100`', 'Menunjukkan persentase pemakaian terhadap jaminan minimum SLA. Nilai > 100% berarti sedang memakai kuota burst'],
          ['Contract Utilization (%)', '`linkUtil = (actualDemandMbps / contractedBwMbps) * 100`', 'Jika > 85% memicu peringatan kongesti; jika > 100% memicu packet loss dan lonjakan latency']
        ]
      }
    ],
    expectedResults: [
      'Pengguna dapat membuktikan secara kuantitatif mengapa koneksi "Broadband Up To 100 Mbps (1:8)" terasa lambat untuk 80 karyawan dibandingkan "Dedicated 50 Mbps (1:1)".',
      'Tab Monitoring dan Diagnostics langsung melaporkan apabila Peak Traffic melampaui CIR.'
    ],
    tips: [
      'Untuk jaringan kantor dengan lebih dari 30 pengguna aktif atau kebutuhan VoIP/Video Conference intensif, pastikan nilai CIR minimal mampu menampung 70% dari rata-rata beban kerja (Average Demand).',
      'Gunakan Simple Queue di MikroTik Console untuk membatasi trafik non-prioritas agar tidak menghabiskan kuota CIR.'
    ],
    commonProblems: [
      {
        problem: 'Muncul peringatan "WAN CIR Commitment Exceeded" padahal total trafik masih di bawah Max Bandwidth.',
        cause: 'Beban trafik Anda sudah melewati batas jaminan minimum (CIR) dan saat ini bergantung pada ketersediaan sisa bandwidth burst dari ISP.',
        solution: 'Tingkatkan paket CIR pada ISP Anda, aktifkan kompresi/QoS Queue pada Router, atau kurangi beban aplikasi berat di jam sibuk.'
      }
    ],
    relatedGuides: ['isp-management', 'workload-management', 'monitoring', 'diagnostics']
  },
  {
    id: 'workload-management',
    number: '09',
    title: 'Workload Management',
    subtitle: 'Menyimulasikan beban pengguna aktif, komposisi aplikasi, jadwal jam sibuk, dan skenario kepadatan trafik.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'Users',
    description:
      'Topologi jaringan yang baik harus diuji terhadap beban kerja nyata. Modul Workload Management memungkinkan Anda menetapkan profil penggunaan pada setiap perangkat endpoint (PC, Laptop, Server, Access Point) atau menerapkan preset beban skala organisasi.',
    purpose:
      'Menghasilkan permintaan trafik (Traffic Demand dalam Mbps dan paket per detik) yang realistis untuk menguji ketahanan link lokal (LAN) maupun kapasitas pipa internet (WAN/CIR).',
    availableFeatures: [
      {
        name: 'Per-Device Workload Profiles',
        status: 'active',
        description: 'Atur kategori profil (Office Worker, HD Streaming, VoIP Call Center, Gaming/Low-Latency, Server Backup, IoT Sensor), jumlah user/klien aktif, dan rata-rata Mbps per user.'
      },
      {
        name: 'Peak Concurrency & Time-of-Day Multiplier',
        status: 'active',
        description: 'Simulasikan lonjakan trafik pada jam sibuk (Peak Hours) menggunakan faktor pengali burst (Peak Multiplier) dan tingkat konkurensi pengguna.'
      },
      {
        name: 'Application Mix Breakdown',
        status: 'active',
        description: 'Distribusi persentase trafik ke dalam kategori Web/SaaS, Video Streaming, VoIP/Conferencing, File Transfer, dan Gaming.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka Dashboard Workload Management',
        description: 'Klik tab "Workload" pada Bottom Panel. Di sini ditampilkan total pengguna aktif di seluruh topologi, total Average Demand (Mbps), Peak Demand (Mbps), serta daftar profil beban per perangkat.'
      },
      {
        stepNumber: 2,
        title: 'Mengatur Jumlah Pengguna & Kebutuhan Bandwidth per Perangkat',
        description: 'Pada daftar perangkat endpoint (misal Access Point Lantai 1 atau PC Lab), sesuaikan jumlah `Active Users / Clients`, `Avg Down/Up per User (Mbps)`, dan `Concurrency Factor (%)`.'
      },
      {
        stepNumber: 3,
        title: 'Memilih Profil Aktivitas & Jam Sibuk',
        description: 'Pilih profil beban kerja atau gunakan tombol skenario cepat (Normal Office Hours, Peak Video Conference, Heavy Backup/Download) untuk melihat dampak lonjakan trafik secara langsung.'
      },
      {
        stepNumber: 4,
        title: 'Mengamati Dampak Workload terhadap Jaringan',
        description: 'Pastikan tombol "Start Traffic" di TopBar menyala. Ketika Anda menaikkan jumlah pengguna atau memilih skenario jam sibuk, perhatikan kenaikan persentase utilisasi di tab "Monitoring" dan munculnya peringatan baru di tab "Diagnostics".'
      }
    ],
    expectedResults: [
      'Perhitungan otomatis Total Average Throughput dan Total Peak Throughput dari seluruh perangkat klien.',
      'Simulasi bottleneck yang akurat pada port uplink switch atau sirkuit WAN ketika jumlah pengguna pada Access Point ditambah.'
    ],
    tips: [
      'Satu Access Point standar umumnya optimal menangani 25–40 klien aktif secara bersamaan. Jika Anda memasukkan > 60 klien aktif pada satu AP, perhatikan peringatan kepadatan klien di Diagnostics.',
      'Uji desain jaringan Anda menggunakan nilai "Peak Demand", bukan hanya "Average Demand", agar jaringan tetap stabil saat seluruh staf melakukan rapat daring bersamaan.'
    ],
    commonProblems: [
      {
        problem: 'Sudah menambah perangkat PC/AP baru di kanvas tetapi belum menghasilkan trafik.',
        cause: 'Profil workload pada perangkat baru tersebut mungkin masih bernilai 0 user atau belum diaktifkan.',
        solution: 'Buka tab "Workload" dan pastikan perangkat tersebut memiliki Active Users >= 1 serta tombol toggle Workload dalam keadaan aktif.'
      }
    ],
    relatedGuides: ['bandwidth-cir', 'network-simulation', 'monitoring']
  },
  {
    id: 'network-simulation',
    number: '10',
    title: 'Network Simulation & Packet Tracer',
    subtitle: 'Menjalankan simulasi trafik kontinu, menguji jalur paket hop-by-hop (ICMP, TCP, UDP, DNS, DHCP), dan memahami batasan simulator.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'Activity',
    description:
      'NETLAB dilengkapi dua mesin simulasi yang bekerja berdampingan: (1) Live Traffic Simulation Engine yang menghitung aliran throughput, utilisasi link, dan antrean secara kontinu setiap detik, serta (2) Interactive Packet Tracer (`simulatePacketTrace`) yang mengevaluasi perjalanan paket langkah demi langkah (hop-by-hop) melewati aturan L1, L2, dan L3.',
    purpose:
      'Memverifikasi apakah paket dari satu perangkat benar-benar dapat mencapai perangkat tujuan atau internet, serta mengidentifikasi di titik (hop) mana paket tertahan oleh VLAN, tabel routing, atau aturan Firewall.',
    simulationNotice:
      'Penting: Packet Tracer mengevaluasi status fisik kabel (L1), keanggotaan Bridge & VLAN ID (L2), subnet IP, Default Gateway, tabel `/ip route`, `/ip firewall filter`, `/ip firewall nat`, dan `/queue simple` (L3/QoS) yang dikonfigurasi pada perangkat. Simulator tidak mengeksekusi kernel jaringan Linux/RouterOS biner penuh.',
    availableFeatures: [
      {
        name: 'Interactive Hop-by-Hop Packet Tracer',
        status: 'active',
        description: 'Uji pengiriman paket antara Source Device dan Destination Device menggunakan protokol ICMP (Ping), TCP (HTTP/HTTPS/SSH), UDP, DNS Query, atau DHCP Discovery.'
      },
      {
        name: 'RouterOS-Aware L2/L3 Evaluation',
        status: 'active',
        description: 'Memeriksa tabel routing perangkat, pencocokan rule Firewall Filter (`input`/`forward` accept/drop), translasi NAT (`srcnat` masquerade), dan pembatasan Simple Queue.'
      },
      {
        name: 'Continuous Live Traffic Generator',
        status: 'active',
        description: 'Dijalankan melalui tombol "Start Traffic" / "Pause Traffic" di TopBar untuk memperbarui telemetri seluruh link dan perangkat secara periodik.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Menyalakan Live Traffic Simulation',
        description: 'Klik tombol hijau "Start Traffic" pada TopBar. Status simulasi akan berubah menjadi aktif, animasi titik paket akan bergerak di sepanjang kabel yang memiliki aliran trafik, dan grafik di tab Monitoring mulai bergerak.'
      },
      {
        stepNumber: 2,
        title: 'Menjalankan Pengujian Packet Tracer',
        description: 'Buka tab "Simulation" di Bottom Panel. Pilih `Source Device` (misal PC-Client-1), pilih `Destination Device` (misal ISP Cloud atau Server-DB), pilih `Protocol` (`ICMP`, `TCP`, `UDP`, `DNS`, atau `DHCP`), lalu klik tombol "Run Trace".'
      },
      {
        stepNumber: 3,
        title: 'Membaca Tabel Hop-by-Hop Trace Result',
        description: 'Perhatikan daftar hop yang dihasilkan: setiap baris menampilkan nomor Hop, nama perangkat, interface masuk/keluar, aksi yang dilakukan (misal `L2 Bridge Forward`, `L3 Route Lookup`, `NAT Masquerade Applied`, atau `Firewall Drop`), latency (ms), dan status (`DELIVERED`, `DROPPED`, `UNREACHABLE`).'
      }
    ],
    technicalTables: [
      {
        title: 'Evaluasi Lapisan Jaringan pada Engine Simulasi NETLAB',
        headers: ['Lapisan', 'Aspek yang Dievaluasi Secara Aktual', 'Batasan Simulasi (Simulator Boundaries)'],
        rows: [
          ['Layer 1 (Physical)', 'Status power perangkat, status admin port (`up`/`down`), keberadaan link kabel, kompatibilitas media Copper vs Fiber, panjang kabel', 'Tidak menyimulasikan redaman optik dBm spektral atau interferensi gelombang radio RF 2.4/5GHz secara fisika gelombang'],
          ['Layer 2 (Data Link)', 'Mode port (`Access`/`Trunk`), pencocokan `VLAN ID`, konfigurasi `/interface bridge`, `/interface bridge port`, dan `/interface vlan`', 'STP/RSTP dievaluasi sebagai deteksi loop topologi, bukan pertukaran paket BPDU frame per milidetik'],
          ['Layer 3 (Network)', 'IP Address & Subnet mask, Default Gateway, tabel `/ip route`, `/ip firewall filter` (drop/reject/accept), `/ip firewall nat` (masquerade)', 'Protokol routing dinamis kompleks (BGP/OSPF multi-area penuh) dan enkripsi tunnel kriptografi tidak dieksekusi pada level payload byte'],
          ['QoS & WAN Capacity', 'Evaluasi `/queue simple` (`max-limit`), bandwidth link, CIR ISP, contention ratio, kalkulasi latency & packet loss saat kongesti', 'Antrean dihitung menggunakan model trafik agregat per interval simulasi, bukan penjadwalan token bucket per-mikrodetik']
        ]
      }
    ],
    expectedResults: [
      'Status `DELIVERED` berwarna hijau dengan rincian setiap hop dan total Round-Trip Time (RTT ms) jika jalur dan konfigurasi benar.',
      'Status `DROPPED` atau `UNREACHABLE` berwarna merah lengkap dengan alasan teknis pada hop tempat paket berhenti.'
    ],
    tips: [
      'Jika Packet Tracer gagal menuju node ISP/Internet, periksa apakah hop Router sudah menerapkan rule `/ip firewall nat add chain=srcnat action=masquerade`.',
      'Anda juga dapat menjalankan perintah `/tool ping <ip>` dan `/tool traceroute <ip>` langsung dari dalam modal MikroTik CLI Console.'
    ],
    commonProblems: [
      {
        problem: 'Packet Tracer menampilkan "L2 VLAN Mismatch" pada hop Switch.',
        cause: 'Port sumber berada di VLAN tertentu (misal VLAN 10), tetapi port uplink Switch belum disetel ke mode `Trunk` atau VLAN ID tidak diizinkan.',
        solution: 'Ubah mode port penghubung antar-switch/router menjadi `Trunk` atau samakan VLAN ID pada kedua port Access.'
      }
    ],
    relatedGuides: ['monitoring', 'diagnostics', 'mikrotik-console', 'troubleshooting']
  },
  {
    id: 'monitoring',
    number: '11',
    title: 'Network Monitoring & Telemetry',
    subtitle: 'Membaca metrik RX/TX throughput, utilisasi link, utilisasi WAN/CIR, latency, packet loss, dan beban perangkat.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'BarChart3',
    description:
      'Modul Monitoring menyajikan visibilitas real-time terhadap performa seluruh elemen jaringan saat simulasi berjalan. Data telemetri dikumpulkan dari setiap interface, link kabel, sirkuit WAN, dan sumber daya perangkat (CPU/RAM).',
    purpose:
      'Membantu pengguna mendeteksi gejala penurunan kualitas layanan (QoS degradation), mengidentifikasi link yang mengalami kejenuhan (bottleneck), dan memantau kepatuhan terhadap SLA.',
    availableFeatures: [
      {
        name: 'Aggregate Network Health & Throughput Summary',
        status: 'active',
        description: 'Menampilkan total throughput jaringan (Mbps), rata-rata latency (ms), rata-rata packet loss (%), dan skor kesehatan topologi.'
      },
      {
        name: 'Link & Interface Utilization Table',
        status: 'active',
        description: 'Daftar seluruh link aktif lengkap dengan metrik RX/TX Mbps, kapasitas link, persentase utilisasi, latency, dan indikator warna beban.'
      },
      {
        name: 'Device Resource Telemetry (CPU, Memory & Temperature)',
        status: 'active',
        description: 'Estimasi pemakaian CPU (%) dan RAM pada Router/Switch berdasarkan jumlah paket yang diproses, aturan firewall, dan antrean aktif.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka Tab Monitoring',
        description: 'Pastikan simulasi trafik sedang berjalan ("Start Traffic" aktif di TopBar), lalu klik tab "Monitoring" pada Bottom Panel.'
      },
      {
        stepNumber: 2,
        title: 'Menganalisis Utilisasi Link & Bottleneck',
        description: 'Perhatikan kolom `Utilization (%)` pada tabel koneksi. Link dengan utilisasi di bawah 70% berwarna hijau (Optimal), 70%–85% berwarna kuning (Moderate/High), dan di atas 85% berwarna merah (Congested/Saturated).'
      },
      {
        stepNumber: 3,
        title: 'Memantau Latency (ms) dan Packet Loss (%)',
        description: 'Amati kenaikan angka Latency dan Packet Loss ketika suatu link mendekati 100% utilisasi. Pada kondisi normal, latency kabel lokal berada di bawah 2 ms dengan packet loss 0%.'
      },
      {
        stepNumber: 4,
        title: 'Memeriksa Beban CPU & RAM Perangkat',
        description: 'Lihat bagian status perangkat di tab Monitoring atau Inspector kanan. Jika sebuah router kelas entry-level dibebani trafik ratusan Mbps dengan banyak rule firewall/queue, utilisasi CPU akan melonjak tinggi.'
      }
    ],
    technicalTables: [
      {
        title: 'Panduan Interpretasi Ambang Batas (Threshold) Monitoring',
        headers: ['Metrik', 'Normal (Hijau)', 'Waspada / Warning (Kuning)', 'Kritis / Critical (Merah)', 'Tindakan Rekomendasi'],
        rows: [
          ['Link Utilization', '< 70%', '70% – 85%', '> 85%', 'Upgrade kecepatan port (misal 1G ke 10G SFP+) atau tambah link agregasi'],
          ['WAN CIR Utilization', '< 80% dari CIR', '80% – 100% dari CIR', '> 100% (Melebihi CIR)', 'Aktifkan QoS Simple Queue atau tingkatkan kapasitas CIR ISP'],
          ['End-to-End Latency', '< 25 ms', '25 ms – 80 ms', '> 80 ms', 'Periksa antrean link yang penuh atau status sirkuit ISP yang Degraded'],
          ['Packet Loss', '0%', '0.1% – 1.5%', '> 1.5%', 'Atasi kongesti bandwidth atau periksa kerusakan/ketidakcocokan media fisik'],
          ['Device CPU Load', '< 60%', '60% – 85%', '> 85%', 'Gunakan model Router dengan prosesor lebih tinggi (misal seri CCR) atau sederhanakan rule firewall']
        ]
      }
    ],
    expectedResults: [
      'Deteksi cepat titik kemacetan trafik (bottleneck) baik di jaringan lokal maupun di gerbang WAN.',
      'Data kuantitatif yang siap diekspor ke dalam laporan arsitektur jaringan.'
    ],
    tips: [
      'Klik langsung pada baris link atau perangkat di panel bawah untuk menyorot (highlight) elemen tersebut di atas kanvas.',
      'Bandingkan angka utilisasi sebelum dan sesudah Anda mengaktifkan limitasi `/queue simple` pada Router MikroTik.'
    ],
    commonProblems: [
      {
        problem: 'Angka latency tiba-tiba naik drastis dari 5 ms menjadi > 120 ms.',
        cause: 'Terjadi Tail-Drop / Bufferbloat akibat total permintaan trafik (Workload Demand) melebihi kapasitas link atau kapasitas efektif ISP.',
        solution: 'Buka tab Monitoring untuk menemukan link mana yang utilisasinya mencapai > 95%, lalu tingkatkan kapasitas link tersebut atau batasi beban kerja.'
      }
    ],
    relatedGuides: ['network-simulation', 'bandwidth-cir', 'diagnostics']
  },
  {
    id: 'diagnostics',
    number: '12',
    title: 'Network Diagnostics & Validation Engine',
    subtitle: 'Memahami 30+ aturan pemeriksaan otomatis, tingkat keparahan (Error/Warning/Info), serta Confirmed vs Probable Cause.',
    category: 'WAN, Beban & Simulasi',
    iconName: 'Stethoscope',
    description:
      'Validation & Diagnostics Engine di NETLAB secara aktif mengaudit topologi fisik, konfigurasi L2/L3, aturan RouterOS, dan metrik kapasitas WAN Anda terhadap lebih dari 30 aturan rekayasa jaringan terbaik (Network Engineering Best Practices).',
    purpose:
      'Menemukan kesalahan konfigurasi, konflik IP, ketidakcocokan VLAN, kegagalan routing, maupun risiko kapasitas secara otomatis beserta penjelasan akar masalah dan rekomendasi perbaikannya.',
    availableFeatures: [
      {
        name: '30+ Multi-Layer Diagnostic Rules',
        status: 'active',
        description: 'Mencakup audit L1 (Unconnected device, Media mismatch, Cable length), L2 (VLAN mismatch, Trunk/Access error, Loop), L3 (Duplicate IP, Subnet mismatch, Missing Gateway/NAT), dan Capacity (CIR breach, High CPU, Link saturation).'
      },
      {
        name: 'Severity Classification (Critical/Error, Warning, Info)',
        status: 'active',
        description: 'Mengelompokkan temuan berdasarkan dampaknya terhadap ketersediaan layanan jaringan.'
      },
      {
        name: 'Root Cause Analysis & Actionable Remediation',
        status: 'active',
        description: 'Setiap temuan menyertakan rincian perangkat terdampak, penjelasan penyebab, dan langkah konkrit cara memperbaikinya.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Menjalankan Pemeriksaan Diagnostik',
        description: 'Klik tombol "Validate" di TopBar atau buka tab "Diagnostics" pada Bottom Panel. Engine juga otomatis memperbarui daftar diagnostik setiap kali ada perubahan topologi atau simulasi.'
      },
      {
        stepNumber: 2,
        title: 'Memahami Perbedaan Confirmed Cause vs Probable Cause',
        description: '- `Confirmed Cause (Penyebab Pasti)`: Kesalahan konfigurasi deterministik yang terverifikasi langsung dari state perangkat (contoh: Duplicate IP Address `192.168.1.1` pada dua interface, Port Admin Down, atau tidak adanya Default Route).\n- `Probable Cause (Kemungkinan Penyebab)`: Indikasi gejala performa yang dipengaruhi oleh dinamika beban kerja (contoh: tingginya latency WAN yang kemungkinan disebabkan oleh pelampauan CIR pada jam sibuk atau rasio contention ISP).'
      },
      {
        stepNumber: 3,
        title: 'Memahami Tingkat Keparahan (Error/Critical, Warning, Info)',
        description: '- `Error / Critical (Merah)`: Menyebabkan terputusnya konektivitas atau kegagalan fungsi jaringan (wajib segera diperbaiki).\n- `Warning (Kuning)`: Jaringan masih berjalan namun berisiko mengalami degradasi performa, bottleneck, atau tidak memiliki redundansi.\n- `Info (Biru)`: Saran optimasi arsitektur atau pemberitahuan status normal.'
      },
      {
        stepNumber: 4,
        title: 'Menindaklanjuti Rekomendasi Perbaikan',
        description: 'Klik kartu temuan diagnostik untuk memfokuskan perangkat yang bermasalah di kanvas, baca bagian `Recommendation`, lalu lakukan perbaikan di Inspector atau MikroTik Console.'
      }
    ],
    expectedResults: [
      'Daftar masalah jaringan terstruktur dari prioritas tertinggi (Critical) hingga saran optimasi (Info).',
      'Ketika seluruh masalah kritikal diperbaiki, indikator kesehatan di TopBar berubah menjadi hijau (`Healthy`).'
    ],
    tips: [
      'Selalu selesaikan masalah berstatus `Error / Critical` pada Layer 1 dan Layer 2 terlebih dahulu sebelum mendiagnosis masalah Layer 3 atau aplikasi.',
      'Anda juga dapat mengetik perintah `diagnose all` atau `simulate validate` pada tab CLI Terminal di panel bawah.'
    ],
    commonProblems: [
      {
        problem: 'Masih muncul peringatan Warning meskipun koneksi ping sudah berhasil.',
        cause: 'Ping berhasil hanya membuktikan konektivitas dasar L3, namun Warning mendeteksi potensi risiko seperti Single Point of Failure (hanya 1 ISP) atau utilisasi CIR yang mendekati batas.',
        solution: 'Baca detail Warning tersebut untuk memutuskan apakah perlu menambah redundansi/kapasitas sesuai kebutuhan desain Anda.'
      }
    ],
    relatedGuides: ['monitoring', 'troubleshooting', 'event-audit-log']
  },
  {
    id: 'event-audit-log',
    number: '13',
    title: 'Event Log & Audit Log',
    subtitle: 'Membedakan catatan kejadian simulasi sistem (Event Log) dan jejak perubahan konfigurasi pengguna (Audit Log).',
    category: 'WAN, Beban & Simulasi',
    iconName: 'FileText',
    description:
      'Untuk mendukung observabilitas dan tata kelola perubahan (Change Management), NETLAB memisahkan pencatatan log menjadi dua aliran independen di Bottom Panel: Event Log dan Audit Log.',
    purpose:
      'Memudahkan pengguna melacak kapan suatu gangguan jaringan atau perubahan status simulasi terjadi (Event Log) serta siapa/apa perubahan konfigurasi terakhir yang dilakukan pada topologi maupun perangkat (Audit Log).',
    availableFeatures: [
      {
        name: 'System & Simulation Event Log',
        status: 'active',
        description: 'Mencatat kejadian operasional seperti link up/down, mulai/berhentinya simulasi, failover ISP, pelampauan ambang batas trafik, dan hasil eksekusi Packet Tracer.'
      },
      {
        name: 'Configuration & Topology Audit Log',
        status: 'active',
        description: 'Mencatat riwayat aksi pengguna seperti penambahan/penghapusan perangkat, penyambungan kabel, perubahan IP/VLAN, eksekusi perintah CLI RouterOS, serta restore backup.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka dan Membaca Event Log',
        description: 'Klik tab "Event Log" pada Bottom Panel. Setiap baris menampilkan stempel waktu (Timestamp), kategori kejadian, tingkat keparahan (`INFO`, `WARN`, `ERROR`), dan pesan deskriptif peristiwa jaringan.'
      },
      {
        stepNumber: 2,
        title: 'Membuka dan Membaca Audit Log',
        description: 'Klik tab "Audit Log" pada Bottom Panel. Perhatikan catatan kronologis setiap modifikasi yang Anda lakukan baik dari kanvas, Inspector, maupun konsol MikroTik.'
      },
      {
        stepNumber: 3,
        title: 'Menggunakan Log untuk Investigasi Masalah',
        description: 'Jika jaringan tiba-tiba bermasalah setelah melakukan beberapa perubahan, buka Audit Log untuk melihat perubahan konfigurasi terakhir, lalu cocokkan waktunya dengan pesan error yang muncul di Event Log.'
      }
    ],
    technicalTables: [
      {
        title: 'Perbandingan Event Log vs Audit Log',
        headers: ['Aspek', 'Event Log', 'Audit Log'],
        rows: [
          ['Fokus Pencatatan', 'Kejadian operasional jaringan & dinamika simulasi', 'Jejak perubahan konfigurasi & aksi administratif pengguna'],
          ['Sumber Pemicu', 'Traffic Engine, Packet Tracer, ISP Status, Diagnostic Alerts', 'Topology Editor, Device Inspector, CLI Command, Winbox GUI, Config Backup'],
          ['Contoh Entri', '`[WARN] WAN Primary ISP CIR exceeded (115%)`', '`[AUDIT] Added firewall NAT masquerade rule on Router-Core`'],
          ['Kegunaan Utama', 'Monitoring kesehatan operasional & deteksi insiden', 'Change tracking, kepatuhan konfigurasi, & rollback investigasi']
        ]
      }
    ],
    expectedResults: [
      'Transparansi penuh atas seluruh aktivitas yang terjadi di dalam ruang kerja NETLAB.',
      'Kemudahan menelusuri urutan kejadian saat melakukan pengujian skenario failover atau troubleshooting.'
    ],
    tips: [
      'Selain Audit Log global di panel bawah, setiap Router/Switch MikroTik juga memiliki tab "Backup, Diff & History" di dalam modal konsolnya untuk melihat diff perubahan konfigurasi spesifik perangkat tersebut.'
    ],
    commonProblems: [
      {
        problem: 'Log terlihat sangat banyak setelah menjalankan simulasi lama.',
        cause: 'Engine mencatat peristiwa perubahan status secara berkala.',
        solution: 'Gunakan fitur filter/clear log yang tersedia pada panel log untuk membersihkan catatan lama sebelum memulai skenario pengujian baru.'
      }
    ],
    relatedGuides: ['diagnostics', 'configuration-management', 'mikrotik-console']
  }
];
