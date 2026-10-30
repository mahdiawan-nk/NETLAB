export interface CoreFeatureItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  capabilities: string[];
  span?: 'wide' | 'normal';
}

export interface UseCaseItem {
  id: string;
  code: string;
  title: string;
  targetAudience: string;
  scenario: string;
  keyModules: string[];
}

export interface PreviewModuleItem {
  id: string;
  label: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface WorkflowStepItem {
  step: string;
  title: string;
  description: string;
  moduleRef: string;
}

export interface DocTopicItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  bulletPoints: string[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const CORE_FEATURES: CoreFeatureItem[] = [
  {
    id: 'topology-designer',
    number: '01',
    title: 'Network Topology Designer',
    subtitle: 'Interactive Visual Canvas & Multi-Layer Cabling',
    description:
      'Rancang arsitektur jaringan secara visual menggunakan kanvas interaktif berfitur pan, zoom, full-canvas mode, serta pengkabelan langsung antar-port fisik (Copper Cat6/Cat6A, Fiber Single-Mode/Multi-Mode, dan Direct Attach Copper).',
    capabilities: [
      'Drag-and-drop perangkat dari katalog standar maupun preset skenario siap pakai',
      'Koneksi kabel presisi tingkat port dengan negosiasi media dan kecepatan otomatis',
      'Undo/Redo riwayat perubahan serta ekspor/impor topologi dalam format JSON',
    ],
    span: 'wide',
  },
  {
    id: 'device-faceplate',
    number: '02',
    title: 'Device & Dual-Block Interface Faceplate',
    subtitle: 'Block A (Ethernet) & Block B (SFP/SFP+/QSFP) Separation',
    description:
      'Setiap perangkat menampilkan faceplate fisik interaktif yang memisahkan kelompok port RJ45 Ethernet (Block A) dan port optik SFP/SFP+/QSFP (Block B) secara proporsional sesuai jumlah port perangkat.',
    capabilities: [
      'Indikator LED status port real-time (RUN, Link Up, Disabled, VLAN Trunk/Access)',
      'Katalog Router, Core Switch, Access Switch, OLT, Server, dan Workstation',
      'Custom Device Builder untuk membuat spesifikasi perangkat dan jumlah port kustom',
    ],
  },
  {
    id: 'isp-bandwidth',
    number: '03',
    title: 'ISP & Bandwidth CIR/MIR Management',
    subtitle: 'Multi-Homed Upstream, SLA & WAN Port Mapping',
    description:
      'Kelola penyedia layanan internet (ISP) dan sirkuit WAN lengkap dengan konfigurasi kapasitas Download/Upload, Committed Information Rate (CIR), rasio kontensi, serta pemetaan langsung ke port CPE router.',
    capabilities: [
      'Simulasi kondisi operasional link ISP: Normal (Up), Degraded (High Latency/Loss), atau Down',
      'Kalkulasi jaminan bandwidth minimum (CIR) saat terjadi beban puncak jaringan',
      'Pemetaan sirkuit upstream ke interface spesifik pada router gateway',
    ],
  },
  {
    id: 'traffic-simulation',
    number: '04',
    title: 'Network Simulation & Packet Tracer',
    subtitle: 'End-to-End Hop Analysis & Workload Generator',
    description:
      'Uji alur paket data (ICMP, TCP, UDP) dari perangkat sumber ke tujuan dan amati bagaimana trafik mengalir melintasi port switch, tag VLAN 802.1Q, tabel routing, aturan NAT, dan filter firewall.',
    capabilities: [
      'Hop-by-hop packet trace lengkap dengan status diteruskan (Forwarded) atau ditolak (Dropped)',
      'Device Workload Manager untuk membangkitkan profil beban trafik pada server dan klien',
      'Simulasi utilisasi link real-time untuk mengidentifikasi bottleneck kapasitas',
    ],
    span: 'wide',
  },
  {
    id: 'monitoring-diagnostics',
    number: '05',
    title: 'Monitoring, Diagnostics & Audit',
    subtitle: 'Automated Topology Validation & 12 Regression Scenarios',
    description:
      'Deteksi kesalahan desain sebelum perangkat fisik dipasang. Engine diagnostik memeriksa konflik alamat IP, ketidakcocokan VLAN PVID/Trunk, potensi loop Layer-2, hingga ketiadaan default route.',
    capabilities: [
      'Peringatan dini (Error & Warning) beserta rekomendasi perbaikan teknis',
      'Pemantauan throughput per-link, tingkat utilisasi, packet loss, dan antrean kongesti',
      'Audit Log terstruktur dan 12 skenario pengujian regresi topologi otomatis',
    ],
  },
  {
    id: 'mikrotik-console',
    number: '06',
    title: 'MikroTik CLI, Winbox GUI & Script Generator',
    subtitle: 'Bi-Directional RouterOS v6/v7 Configuration & Export',
    description:
      'Konfigurasikan perangkat melalui antarmuka bergaya Winbox atau terminal CLI interaktif yang saling tersinkronisasi, lalu ekspor ke script konfigurasi RouterOS (.rsc) siap pakai.',
    capabilities: [
      'Konfigurasi Bridge, VLAN Filtering, IP Address, DHCP, Static Route, NAT, Firewall, dan Simple Queue',
      'Fitur Configuration Backup/Restore, Config Diff perbandingan perubahan, dan Change History',
      'Validator kompatibilitas sintaks otomatis antara RouterOS v6 dan RouterOS v7',
    ],
    span: 'wide',
  },
];

export const USE_CASES: UseCaseItem[] = [
  {
    id: 'learning-education',
    code: 'UC-01',
    title: 'Pembelajaran Jaringan Komputer',
    targetAudience: 'Mahasiswa, Siswa TKJ, & Peserta Pelatihan Jaringan',
    scenario:
      'Mempelajari konsep subnetting IPv4, segmentasi VLAN Access/Trunk, routing statis, NAT masquerade, dan manajemen bandwidth secara visual tanpa memerlukan perangkat keras fisik.',
    keyModules: ['Topology Canvas', 'Packet Tracer', 'User Guide', 'CLI & Winbox GUI'],
  },
  {
    id: 'office-smes',
    code: 'UC-02',
    title: 'Perencanaan Jaringan Kantor & UMKM',
    targetAudience: 'IT Support, System Administrator, & Konsultan IT',
    scenario:
      'Merancang pemisahan jaringan staf, server lokal, dan Wi-Fi tamu menggunakan router gateway dan managed switch, sekaligus menghitung kebutuhan bandwidth internet kantor.',
    keyModules: ['Preset Templates', 'VLAN & Bridge Manager', 'Workload Generator', 'RouterOS .rsc Export'],
  },
  {
    id: 'residential-rtrwnet',
    code: 'UC-03',
    title: 'Desain Jaringan Perumahan & RT/RW Net',
    targetAudience: 'Praktisi Jaringan Komunitas & Penyedia Akses Lokal',
    scenario:
      'Memodelkan distribusi akses fiber optik (OLT/ONU) atau distribusi Ethernet ke pelanggan, mengatur alokasi limitasi Simple Queue, serta menguji ketahanan link upstream ISP.',
    keyModules: ['Fiber SMF/MMF Cabling', 'ISP & CIR Management', 'Simple Queue Configuration', 'Traffic Simulation'],
  },
  {
    id: 'campus-school',
    code: 'UC-04',
    title: 'Desain Jaringan Kampus & Sekolah',
    targetAudience: 'Tim Infrastruktur Akademik & Network Engineer',
    scenario:
      'Merancang arsitektur hierarkis Core, Distribution, dan Access Switch antar-gedung dengan uplink SFP+ 10G, memvalidasi trunk VLAN laboratorium, dan menguji beban trafik serentak.',
    keyModules: ['Dual-Block SFP+ Faceplate', 'Multi-Switch VLAN Audit', 'Device Workload Profiles', 'Diagnostics Engine'],
  },
  {
    id: 'isp-metro-ethernet',
    code: 'UC-05',
    title: 'Perencanaan Topologi ISP & Metro Ethernet',
    targetAudience: 'Network Architect & NOC Engineer',
    scenario:
      'Mensimulasikan interkoneksi multi-ISP, skema backup link WAN, evaluasi jaminan CIR vs MIR pada sirkuit dedicated maupun broadband, serta dampak degradasi link terhadap layanan.',
    keyModules: ['ISP Circuit Dashboard', 'WAN Failover Simulation', 'Link Utilization Telemetry', 'Audit Log'],
  },
  {
    id: 'pre-deployment-validation',
    code: 'UC-06',
    title: 'Validasi Sebelum Implementasi Fisik',
    targetAudience: 'Field Engineer & Integrator Sistem',
    scenario:
      'Menguji perubahan konfigurasi firewall, tabel routing, dan struktur bridge secara virtual, memeriksa diff konfigurasi, serta mengekspor script .rsc yang telah tervalidasi untuk RouterOS v6/v7.',
    keyModules: ['Config Diff & Backup', 'RouterOS v6/v7 Validator', 'Packet Trace Verification', '.rsc Script Generator'],
  },
];

export const PREVIEW_MODULES: PreviewModuleItem[] = [
  {
    id: 'topology',
    label: '01. Topology Editor',
    badge: 'INTERACTIVE CANVAS',
    title: 'Visualisasi Topologi & Koneksi Kabel Presisi',
    description:
      'Kanvas kerja dirancang untuk visibilitas penuh terhadap perangkat, port fisik, jenis media transmisi, dan metrik utilisasi secara langsung di atas lembar kerja.',
    highlights: [
      'Mode layar penuh (Collapsible Sidebar & Inspector) dengan navigasi pan & zoom halus',
      'Visualisasi warna kabel berdasarkan media: Copper UTP, Fiber SMF, Fiber MMF, dan DAC',
      'Indikator status operasional perangkat (RUN) dan deteksi instan link terputus',
    ],
  },
  {
    id: 'faceplate',
    label: '02. Device Faceplate',
    badge: 'DUAL-BLOCK HARDWARE UI',
    title: 'Pemisahan Port Ethernet (Block A) & SFP/SFP+ (Block B)',
    description:
      'Representasi faceplate perangkat mengikuti tata letak perangkat jaringan sesungguhnya dengan memisahkan blok port tembaga dan blok port optik secara proporsional.',
    highlights: [
      'Block A menampilkan port Ethernet (ether1..etherN) dalam susunan maksimal 2 baris',
      'Block B menampilkan port optik (sfp1, sfp-sfpplus1, qsfpplus1) secara terpisah',
      'Lebar kartu perangkat beradaptasi dinamis mengikuti jumlah port dari model perangkat',
    ],
  },
  {
    id: 'isp-cir',
    label: '03. ISP & CIR Manager',
    badge: 'WAN & BANDWIDTH SLA',
    title: 'Manajemen Sirkuit Upstream, Kapasitas, dan CIR',
    description:
      'Atur parameter kualitas layanan dari satu atau beberapa ISP sekaligus dan uji bagaimana jaringan merespons ketika kondisi sirkuit mengalami kongesti atau gangguan.',
    highlights: [
      'Pengaturan kapasitas Download/Upload maksimum (MIR) dan jaminan komitmen (CIR)',
      'Simulasi status sirkuit: Up (Normal), Degraded (Latency/Loss meningkat), atau Down',
      'Integrasi langsung dengan kalkulasi utilisasi link pada engine simulasi trafik',
    ],
  },
  {
    id: 'simulation',
    label: '04. Network Simulation',
    badge: 'PACKET TRACE & WORKLOAD',
    title: 'Simulasi Beban Trafik & Pelacakan Paket Hop-by-Hop',
    description:
      'Kombinasikan pengujian jalur paket spesifik (Packet Tracer) dengan pembangkit beban trafik berkelanjutan (Workload Generator) untuk menguji kesiapan desain jaringan.',
    highlights: [
      'Pelacakan paket L2/L3 dengan rincian analisa di setiap hop perangkat',
      'Profil beban kerja terukur untuk mensimulasikan aktivitas klien, server, dan layanan',
      'Evaluasi langsung dampak aturan Firewall Filter dan NAT terhadap jalannya paket',
    ],
  },
  {
    id: 'diagnostics',
    label: '05. Monitoring & Diagnostics',
    badge: 'VALIDATION & AUDIT',
    title: 'Inspeksi Kesehatan Topologi & Diagnostik Otomatis',
    description:
      'Panel NOC memadukan grafik utilisasi jaringan dengan pemeriksaan aturan desain secara otomatis untuk mencegah kesalahan konfigurasi umum.',
    highlights: [
      'Deteksi konflik IP/subnet, port trunk tanpa pasangan VLAN yang sesuai, dan loop L2',
      'Rekomendasi teknis terarah untuk setiap temuan Error maupun Warning',
      'Pencatatan riwayat perubahan pada Event Log dan Audit Log',
    ],
  },
  {
    id: 'mikrotik-cli',
    label: '06. CLI & Winbox GUI',
    badge: 'ROUTEROS v6 / v7 CONSOLE',
    title: 'Konsol Manajemen Perangkat Dua Arah & Generator .rsc',
    description:
      'Kelola konfigurasi internal perangkat menggunakan antarmuka tabel ala Winbox atau ketik perintah langsung di terminal CLI dengan sinkronisasi state otomatis.',
    highlights: [
      'Perintah CLI mendukung struktur `/interface`, `/ip address`, `/ip route`, `/ip firewall`, dan `/queue simple`',
      'Manajemen snapshot konfigurasi: Backup, Restore, Config Diff, dan Change History',
      'Ekspor script `.rsc` lengkap dengan pemeriksaan kompatibilitas RouterOS v6 dan v7',
    ],
  },
];

export const HOW_IT_WORKS_STEPS: WorkflowStepItem[] = [
  {
    step: '01',
    title: 'Buat Topologi Baru atau Pilih Preset',
    description:
      'Mulai dari kanvas kosong atau muat skenario topologi siap pakai (seperti jaringan kantor, kampus, atau multi-ISP) untuk mempercepat perancangan awal.',
    moduleRef: 'Project Selector & Preset Templates',
  },
  {
    step: '02',
    title: 'Tambahkan Perangkat Standar atau Custom',
    description:
      'Tempatkan Router, Switch, OLT, Server, dan PC dari katalog ke kanvas, atau rancang perangkat khusus melalui Custom Device Builder sesuai spesifikasi perangkat Anda.',
    moduleRef: 'Device Catalog & Custom Device Wizard',
  },
  {
    step: '03',
    title: 'Hubungkan Interface pada Faceplate',
    description:
      'Klik port pada Block A (Ethernet) atau Block B (SFP/SFP+) untuk menghubungkan antar-perangkat dengan pemilihan media kabel dan kecepatan link yang sesuai.',
    moduleRef: 'Dual-Block Interface Faceplate & Connection Modal',
  },
  {
    step: '04',
    title: 'Konfigurasi IP, VLAN, RouterOS & Sirkuit ISP',
    description:
      'Atur pengalamatan IP, Bridge VLAN, tabel routing, firewall, beban kerja perangkat (Workload), serta parameter bandwidth dan CIR sirkuit ISP upstream.',
    moduleRef: 'Device Inspector, Winbox/CLI Console & ISP Dashboard',
  },
  {
    step: '05',
    title: 'Jalankan Simulasi Trafik & Packet Tracer',
    description:
      'Aktifkan simulasi trafik untuk melihat beban link secara real-time dan jalankan Packet Tracer untuk menguji konektivitas end-to-end antar-perangkat.',
    moduleRef: 'Simulation Engine & Traffic Engine',
  },
  {
    step: '06',
    title: 'Analisis Diagnostik & Ekspor Script .rsc',
    description:
      'Tinjau hasil audit topologi pada panel Diagnostics, perbaiki peringatan konfigurasi, lalu ekspor script RouterOS (.rsc) atau simpan proyek dalam format JSON.',
    moduleRef: 'Validation Engine & RouterOS Generator',
  },
];

export const DOCUMENTATION_TOPICS: DocTopicItem[] = [
  {
    id: 'doc-getting-started',
    title: '1. Getting Started',
    category: 'PANDUAN AWAL',
    summary:
      'Memahami ruang kerja NETLAB Workspace yang terdiri dari TopBar, Sidebar Katalog, Kanvas Topologi Interaktif, Device Inspector di sisi kanan, dan NOC Bottom Panel.',
    bulletPoints: [
      'Gunakan tombol sidebar/inspector toggle atau pintasan layar penuh untuk memperluas area kanvas.',
      'Simpan perubahan proyek ke penyimpanan server lokal atau ekspor ke file `.json` untuk portabilitas.',
      'Akses tombol "User Guide" di bagian atas aplikasi kapan saja untuk membuka pusat bantuan lengkap.',
    ],
  },
  {
    id: 'doc-topology-basics',
    title: '2. Dasar Topologi & Pengkabelan',
    category: 'ARSITEKTUR & LINK',
    summary:
      'Cara menyusun node perangkat di atas kanvas dan membangun koneksi fisik yang valid antar-interface.',
    bulletPoints: [
      'Geser perangkat di kanvas untuk menata tata letak logis (Core, Distribution, Access, Endpoint).',
      'Pilih port sumber dan port tujuan; sistem memvalidasi kecocokan tipe port (RJ45 vs Optik SFP/SFP+).',
      'Setiap link menampilkan status operasional serta warna media kabel untuk memudahkan identifikasi visual.',
    ],
  },
  {
    id: 'doc-device-interfaces',
    title: '3. Mengenal Perangkat & Interface Faceplate',
    category: 'HARDWARE & PORT',
    summary:
      'Struktur antarmuka perangkat menggunakan desain Dual-Block Faceplate untuk membedakan port tembaga dan port optik.',
    bulletPoints: [
      'Block A (Ethernet Interfaces): Menampilkan port `ether1`, `ether2`, dst. dalam tata letak maksimal 2 baris.',
      'Block B (SFP / SFP+ Interfaces): Menampilkan port `sfp1`, `sfp-sfpplus1`, dst. pada blok terpisah.',
      'Klik langsung pada port di kartu perangkat atau gunakan panel Inspector untuk mengatur IP, VLAN mode, dan PVID.',
    ],
  },
  {
    id: 'doc-isp-bandwidth',
    title: '4. Mengatur ISP, Bandwidth, dan CIR',
    category: 'WAN & CAPACITY',
    summary:
      'Memodelkan koneksi internet upstream dan mengevaluasi kecukupan kapasitas terhadap beban kerja jaringan.',
    bulletPoints: [
      'Tambahkan profil ISP beserta sirkuit WAN dengan nilai kapasitas Download/Upload (Mbps) dan jaminan CIR.',
      'Petakan sirkuit ISP ke interface WAN pada router gateway melalui menu CPE WAN Mapping.',
      'Uji skenario penurunan kualitas layanan dengan mengubah status sirkuit ke mode Degraded atau Down.',
    ],
  },
  {
    id: 'doc-running-simulation',
    title: '5. Menjalankan Simulasi & Konsol RouterOS',
    category: 'SIMULASI & KONFIGURASI',
    summary:
      'Menguji alur paket, membangkitkan beban trafik aplikasi, dan mengonfigurasi fitur RouterOS melalui CLI maupun GUI.',
    bulletPoints: [
      'Gunakan tab Packet Simulation untuk menguji ping/koneksi antar-perangkat dan melihat detail setiap hop.',
      'Aktifkan Traffic Simulation untuk menghitung utilisasi link berdasarkan profil Device Workload yang aktif.',
      'Buka RouterOS Console pada perangkat MikroTik untuk menyunting konfigurasi via Winbox GUI atau CLI dan mengekspor script `.rsc`.',
    ],
  },
  {
    id: 'doc-diagnostics-limits',
    title: '6. Membaca Diagnostics & Batasan Simulator',
    category: 'DIAGNOSTIK & BATASAN',
    summary:
      'Memahami cara membaca hasil validasi topologi serta batasan simulasi virtual dibandingkan perangkat keras fisik.',
    bulletPoints: [
      'Tab Diagnostics mengelompokkan temuan menjadi Error (kritis, menghentikan trafik) dan Warning (anomali desain).',
      'Batasan Simulator: NETLAB mensimulasikan logika kontrol, alur paket, kalkulasi kapasitas, dan struktur konfigurasi secara deterministik; bukan emulator mesin virtual tingkat firmware/kernel penuh.',
      'Gunakan hasil validasi dan script `.rsc` dari NETLAB sebagai cetak biru teruji sebelum diterapkan pada perangkat produksi.',
    ],
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Apa itu NETLAB dan apa bedanya Website Resmi ini dengan NETLAB Workspace?',
    answer:
      'NETLAB adalah platform perancangan topologi dan simulasi jaringan komputer berbasis web. Website resmi ini berfungsi sebagai pusat informasi produk, dokumentasi ringkas, dan panduan penggunaan, sedangkan NETLAB Workspace adalah lingkungan kerja interaktif tempat Anda merancang topologi, mengonfigurasi perangkat, dan menjalankan simulasi.',
  },
  {
    id: 'faq-2',
    question: 'Siapa saja yang dapat menggunakan NETLAB?',
    answer:
      'NETLAB dirancang untuk mahasiswa dan pelajar jaringan komputer, instruktur laboratorium, administrator jaringan kantor/UMKM, praktisi RT/RW Net, hingga network engineer yang ingin memvalidasi desain topologi dan konfigurasi RouterOS sebelum implementasi fisik.',
  },
  {
    id: 'faq-3',
    question: 'Apakah NETLAB dapat digunakan untuk belajar jaringan dari dasar?',
    answer:
      'Ya. NETLAB menyediakan Preset Topology siap pakai, visualisasi faceplate port yang jelas, pelacakan paket langkah demi langkah (Packet Tracer), serta User Guide berbahasa Indonesia yang menjelaskan konsep dasar hingga skenario lanjutan.',
  },
  {
    id: 'faq-4',
    question: 'Bagaimana cara kerja simulasi jaringan di dalam NETLAB?',
    answer:
      'NETLAB mengevaluasi topologi menggunakan tiga engine terintegrasi: Simulation Engine untuk melacak perjalanan paket L2/L3 melewati VLAN, tabel routing, NAT, dan firewall; Traffic Engine untuk menghitung utilisasi link berdasarkan beban Device Workload dan kapasitas CIR/MIR ISP; serta Validation Engine untuk mendeteksi kesalahan konfigurasi secara otomatis.',
  },
  {
    id: 'faq-5',
    question: 'Apakah NETLAB menggantikan pengujian pada perangkat jaringan fisik?',
    answer:
      'NETLAB berperan sebagai lingkungan perancangan, simulasi logika jaringan, dan validasi konfigurasi pra-implementasi. Simulator ini membantu menemukan kesalahan pengalamatan, VLAN, routing, maupun kapasitas lebih awal, namun pengujian fisik akhir tetap disarankan sebelum sistem masuk ke lingkungan produksi kritis.',
  },
  {
    id: 'faq-6',
    question: 'Apakah hasil konfigurasi perangkat di NETLAB dapat diekspor ke MikroTik RouterOS?',
    answer:
      'Ya. Konfigurasi yang Anda buat melalui antarmuka Winbox-like GUI maupun terminal CLI di dalam NETLAB dapat divalidasi untuk kompatibilitas RouterOS v6 dan v7, lalu diekspor menjadi script konfigurasi `.rsc`. Selain itu, seluruh proyek topologi dapat diekspor dan diimpor kembali dalam format file `.json`.',
  },
];
