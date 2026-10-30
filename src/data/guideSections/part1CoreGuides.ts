import { GuideSectionContent } from '../../types/userGuide';

export const PART1_CORE_GUIDES: GuideSectionContent[] = [
  {
    id: 'getting-started',
    number: '01',
    title: 'Getting Started & Quick Start',
    subtitle: 'Pengenalan NETLAB, konsep simulasi topologi jaringan, dan panduan cepat 6 langkah membuat proyek pertama.',
    category: 'Dasar & Workspace',
    iconName: 'Rocket',
    description:
      'NETLAB adalah aplikasi Network Topology Designer & Network Simulation berbasis web yang dirancang untuk memodelkan arsitektur jaringan fisik dan logis, mengonfigurasi perangkat MikroTik RouterOS (v6 & v7), mengelola sirkuit ISP & CIR, serta menyimulasikan beban trafik (Workload) dan alur paket (Packet Tracer) secara interaktif.',
    purpose:
      'Membantu pemula jaringan, mahasiswa, administrator jaringan, hingga Network Engineer memahami alur kerja utama NETLAB dan membangun topologi fungsional pertama dalam hitungan menit.',
    simulationNotice:
      'NETLAB menjalankan Discrete Topology & Traffic Simulation Engine berbasis model matematis dan evaluasi tabel state (Interface, Bridge, VLAN, IP, Route, Firewall, Queue). Simulator tidak mengirimkan paket jaringan mentah (raw frame/packet) ke jaringan fisik komputer Anda.',
    availableFeatures: [
      {
        name: 'Quick Start Project & Preset Topologies',
        status: 'active',
        description: 'Membuat kanvas kosong baru atau memuat skenario jaringan siap pakai (SOHO, Corporate VLAN, Dual-ISP Failover, Metro Ethernet).'
      },
      {
        name: 'Interactive Dual-Block Faceplate Node',
        status: 'active',
        description: 'Setiap perangkat menampilkan port Ethernet (Block A) dan SFP/SFP+ (Block B) secara terpisah dan proporsional untuk penarikan kabel langsung.'
      },
      {
        name: 'MikroTik CLI & Winbox-like GUI Console',
        status: 'active',
        description: 'Konfigurasi perangkat Router/Switch menggunakan terminal CLI RouterOS atau antarmuka GUI bergaya Winbox dengan sinkronisasi dua arah.'
      },
      {
        name: 'Live Traffic & Packet Tracer Engine',
        status: 'active',
        description: 'Uji konektivitas hop-by-hop (ICMP, TCP, UDP, DNS, DHCP) dan pantau utilisasi bandwidth, CIR, latency, serta packet loss secara real-time.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Langkah 1 — Tambah ISP atau Muat Skenario Awal',
        description: 'Buka katalog perangkat di Sidebar kiri kategori "ISP / WAN Cloud" lalu klik atau tarik node "ISP / Cloud" ke kanvas. Anda juga dapat membuka tab "ISP & WAN" di panel bawah untuk mengatur kapasitas bandwidth & CIR.',
        tip: 'Gunakan menu dropdown "Presets" di TopBar jika ingin langsung mempelajari contoh topologi yang sudah terkonfigurasi.'
      },
      {
        stepNumber: 2,
        title: 'Langkah 2 — Tambah Router MikroTik',
        description: 'Dari Sidebar kiri kategori "Routers", pilih model router (misalnya MikroTik RB5009UG+S+IN atau CCR2004-16G-2S+) untuk ditempatkan di kanvas.',
        tip: 'Perhatikan faceplate perangkat: port Ethernet berada di blok atas dan port optik SFP/SFP+ berada di blok bawah.'
      },
      {
        stepNumber: 3,
        title: 'Langkah 3 — Tambah Switch & Access Point / Endpoint',
        description: 'Tambahkan switch distribusi/akses (misalnya CRS326-24G-2S+) serta perangkat akhir seperti Access Point, PC Workstation, atau Server.',
        tip: 'Gunakan fitur pencarian di Sidebar kiri untuk menemukan model perangkat berdasarkan nama atau jumlah port.'
      },
      {
        stepNumber: 4,
        title: 'Langkah 4 — Hubungkan Interface Antarperangkat',
        description: 'Klik langsung pada kotak port asal (misal ge1 pada ISP) lalu klik pada port tujuan (misal ether1 pada Router). Lanjutkan menghubungkan port LAN Router ke Switch, dan Switch ke PC/AP.',
        tip: 'Media kabel (Copper Cat6 vs Fiber Optic SFP+) akan otomatis disesuaikan dengan tipe port yang Anda hubungkan.'
      },
      {
        stepNumber: 5,
        title: 'Langkah 5 — Atur Bandwidth, IP Address & Workload',
        description: 'Klik perangkat untuk mengatur IP Address & Gateway di Inspector kanan (atau klik tombol ">_ CLI" / "Winbox" pada kartu router). Buka tab "Workload" di panel bawah untuk mengatur jumlah pengguna aktif dan profil trafik.',
        tip: 'Pastikan port WAN memiliki mode "WAN" atau rule Firewall NAT masquerade aktif agar trafik LAN dapat menuju internet.'
      },
      {
        stepNumber: 6,
        title: 'Langkah 6 — Jalankan Simulasi & Lihat Hasil Monitoring',
        description: 'Klik tombol "Start Traffic" di TopBar untuk menyalakan simulasi trafik real-time, lalu buka tab "Monitoring", "Simulation" (Packet Tracer), dan "Diagnostics" di panel bawah.',
        tip: 'Klik tombol "Validate" di TopBar kapan saja untuk menjalankan pemeriksaan 30+ aturan diagnostik topologi dan konfigurasi.'
      }
    ],
    expectedResults: [
      'Perangkat tampil di atas kanvas dengan blok port Ethernet dan SFP/SFP+ yang rapi.',
      'Garis koneksi (link) tampil menghubungkan port spesifik dengan warna sesuai media dan status link.',
      'Saat simulasi berjalan, animasi aliran trafik tampil di kabel dan metrik throughput/utilisasi muncul di tab Monitoring.',
      'Packet Tracer menampilkan rute hop-by-hop dari perangkat sumber ke tujuan beserta latency tiap hop.'
    ],
    tips: [
      'Gunakan tombol Hide/Show Sidebar di kiri dan Hide/Show Inspector di kanan untuk memperluas area kerja kanvas hingga layar penuh.',
      'Geser (pan) kanvas dengan menahan tombol tengah mouse, Space + Drag, atau mengaktifkan mode "Pan Mode (H)" pada kontrol kanvas.',
      'Simpan pekerjaan Anda secara berkala menggunakan tombol "Export JSON" di TopBar.'
    ],
    commonProblems: [
      {
        problem: 'Kabel tidak bisa terhubung ketika diklik ke perangkat tujuan.',
        cause: 'Port tujuan sudah terpakai oleh kabel lain atau Anda mengklik badan kartu perangkat, bukan kotak port spesifik.',
        solution: 'Arahkan kursor tepat ke kotak port yang masih berstatus Available (kosong) pada faceplate perangkat tujuan.'
      },
      {
        problem: 'Simulasi berjalan tetapi trafik bernilai 0 Mbps.',
        cause: 'Belum ada perangkat endpoint (PC/AP/Server) yang memiliki Workload aktif atau port masih berstatus admin down.',
        solution: 'Pastikan status perangkat dan port "UP", lalu tambahkan atau aktifkan profil beban kerja pada tab "Workload".'
      }
    ],
    relatedGuides: ['application-overview', 'workspace-navigation', 'topology-editor', 'network-simulation']
  },
  {
    id: 'application-overview',
    number: '02',
    title: 'Application Overview',
    subtitle: 'Arsitektur modul NETLAB dan alur kerja terpadu dari perancangan fisik hingga analisis diagnostik.',
    category: 'Dasar & Workspace',
    iconName: 'Layers',
    description:
      'NETLAB mengintegrasikan perancangan topologi fisik (Layer 1), konfigurasi switching & VLAN (Layer 2), pengalamatan IP & routing RouterOS (Layer 3), manajemen kapasitas WAN/ISP (CIR & Contention), serta simulasi beban pengguna ke dalam satu lingkungan terpadu.',
    purpose:
      'Memberikan gambaran menyeluruh mengenai bagaimana setiap modul di dalam NETLAB saling terhubung sehingga pengguna dapat merancang dan menguji jaringan secara sistematis.',
    availableFeatures: [
      {
        name: 'Alur Kerja End-to-End 8 Tahap',
        status: 'active',
        description: 'Device Catalog → Topology Editor → Device Configuration → Network Connectivity → Workload → Simulation → Monitoring → Diagnostics.'
      },
      {
        name: 'Single Source of Truth State Synchronization',
        status: 'active',
        description: 'Perubahan yang dilakukan di Inspector, CLI Terminal, maupun Winbox GUI langsung memperbarui model konfigurasi perangkat yang sama.'
      },
      {
        name: 'Multi-Layer Validation & Diagnostics',
        status: 'active',
        description: 'Pemeriksaan otomatis mulai dari kecocokan transceiver SFP, VLAN mismatch, IP conflict, hingga saturasi CIR ISP.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: '1. Device Catalog & Custom Device',
        description: 'Pilih perangkat standar MikroTik (CCR, CRS, RB, cAP), Switch, Server, PC, atau buat perangkat kustom dengan kombinasi port Ethernet dan SFP/SFP+ sesuai kebutuhan.'
      },
      {
        stepNumber: 2,
        title: '2. Topology Editor & Interface Connections',
        description: 'Susun tata letak perangkat di kanvas interaktif dan hubungkan port fisik menggunakan media Copper Cat6, Fiber Multi-Mode, atau Fiber Single-Mode.'
      },
      {
        stepNumber: 3,
        title: '3. Device Configuration (Inspector, CLI & Winbox)',
        description: 'Konfigurasikan Bridge, VLAN, IP Address, DHCP Server/Pool, Static Route, DNS, Firewall Filter/NAT, dan Simple Queue.'
      },
      {
        stepNumber: 4,
        title: '4. ISP Management, Bandwidth & CIR',
        description: 'Definisikan sirkuit internet (Dedicated 1:1, Shared Broadband, Best Effort), kapasitas Download/Upload, dan jaminan CIR.'
      },
      {
        stepNumber: 5,
        title: '5. Workload Management',
        description: 'Tetapkan jumlah pengguna aktif, rata-rata kebutuhan bandwidth per user, jam sibuk, dan komposisi aplikasi (Web, Video, VoIP, Gaming).'
      },
      {
        stepNumber: 6,
        title: '6. Network Simulation & Packet Tracer',
        description: 'Nyalakan engine trafik kontinu dan jalankan pengujian paket ICMP/TCP/UDP/DNS/DHCP antar node untuk memverifikasi jalur paket.'
      },
      {
        stepNumber: 7,
        title: '7. Real-Time Monitoring',
        description: 'Pantau utilisasi link, pemakaian bandwidth WAN terhadap CIR, latency, packet loss, serta estimasi beban CPU/RAM perangkat.'
      },
      {
        stepNumber: 8,
        title: '8. Automated Diagnostics & Audit',
        description: 'Tinjau temuan masalah (Critical, Warning, Info), analisis akar penyebab (Confirmed vs Probable Cause), dan terapkan langkah perbaikan.'
      }
    ],
    technicalTables: [
      {
        title: 'Matriks Modul Utama NETLAB',
        headers: ['Modul', 'Lokasi UI', 'Fungsi Utama', 'Output'],
        rows: [
          ['Device Catalog', 'Sidebar Kiri', 'Menambah node built-in, custom device, dan grup VLAN', 'Node perangkat pada kanvas'],
          ['Topology Canvas', 'Area Tengah', 'Menyusun posisi node, faceplate port, dan penarikan kabel', 'Topologi fisik L1/L2'],
          ['Device Inspector', 'Panel Kanan', 'Konfigurasi cepat IP, VLAN, port, dan properti link', 'Update state interface/link'],
          ['MikroTik Console', 'Modal CLI / Winbox', 'Konfigurasi lengkap RouterOS v6/v7, backup, diff, & test suite', 'State RouterOSConfig & file .rsc'],
          ['ISP & Workload', 'Bottom Panel', 'Mengatur sirkuit WAN, CIR, dan beban trafik pengguna', 'Permintaan trafik (Demand Mbps)'],
          ['Simulation & Diagnostics', 'Bottom Panel', 'Packet tracer hop-by-hop, grafik telemetri, & 30+ aturan audit', 'Laporan kesehatan jaringan']
        ]
      }
    ],
    expectedResults: [
      'Pemahaman jelas mengenai hubungan sebab-akibat antara konfigurasi perangkat, kapasitas ISP, beban kerja, dan hasil monitoring.',
      'Kemampuan memilih alat yang tepat (Inspector untuk pengaturan cepat, CLI/Winbox untuk konfigurasi mendalam RouterOS).'
    ],
    tips: [
      'Selalu mulai perancangan dari lapisan fisik (pemilihan perangkat & koneksi port), dilanjutkan pengalamatan IP/VLAN, baru kemudian menjalankan simulasi beban.',
      'Gunakan fitur "Report" di TopBar untuk mengekspor dokumentasi arsitektur dan hasil analisis jaringan ke format Markdown.'
    ],
    commonProblems: [
      {
        problem: 'Bingung harus mengedit IP di Inspector kanan atau di Winbox/CLI.',
        cause: 'Kedua antarmuka disediakan untuk kenyamanan tingkat pengguna yang berbeda.',
        solution: 'Keduanya terhubung ke state yang sama. Perubahan IP di Inspector otomatis tercermin di `/ip address print` pada CLI/Winbox dan sebaliknya.'
      }
    ],
    relatedGuides: ['getting-started', 'workspace-navigation', 'mikrotik-console', 'diagnostics']
  },
  {
    id: 'workspace-navigation',
    number: '03',
    title: 'Workspace & Navigation',
    subtitle: 'Panduan lengkap bagian layar utama, kontrol panel lipat (collapsible), navigasi kanvas, dan pintasan keyboard.',
    category: 'Dasar & Workspace',
    iconName: 'Compass',
    description:
      'Antarmuka kerja (Workspace) NETLAB dibagi menjadi 4 area ergonomis: TopBar Header di bagian atas, Collapsible Device Catalog Sidebar di kiri, Interactive Topology Canvas di tengah, Collapsible Inspector Panel di kanan, serta Multi-Tab Bottom Panel di bagian bawah.',
    purpose:
      'Memastikan pengguna dapat bernavigasi dengan cepat, memaksimalkan ruang visual kanvas untuk topologi berskala besar, dan mengakses setiap alat bantu tanpa hambatan.',
    availableFeatures: [
      {
        name: 'TopBar Action & Simulation Controls',
        status: 'active',
        description: 'Memuat nama proyek, ringkasan jumlah node/link/health, Preset Selector, Start/Pause Traffic, Validate, Auto-Layout, Import/Export JSON, Export Report, Clear, dan User Guide.'
      },
      {
        name: 'Collapsible Left Sidebar & Right Inspector',
        status: 'active',
        description: 'Panel kiri dan kanan dapat disembunyikan (hide) atau ditampilkan (show) kapan saja agar kanvas topologi dapat tampil layar penuh (Full Canvas Mode).'
      },
      {
        name: 'Interactive Canvas Viewport Controls',
        status: 'active',
        description: 'Mendukung Select/Move Mode (V), Pan/Hand Mode (H), Directional Pan D-Pad, Zoom In/Out (20%–250%), Fit All Nodes to View, dan Reset Viewport.'
      },
      {
        name: 'Multi-Tab Resizable Bottom Dock',
        status: 'active',
        description: 'Berisi 8 tab fungsional: Diagnostics, Simulation, Monitoring, ISP & WAN, Workload, CLI Terminal, Event Log, dan Audit Log.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Menyembunyikan & Menampilkan Sidebar / Inspector (Full Canvas)',
        description: 'Klik tombol ikon panah lipat di tepi kiri atas kanvas untuk menyembunyikan/menampilkan Sidebar Katalog. Klik tombol panah di tepi kanan atas kanvas untuk menyembunyikan/menampilkan panel Inspector.',
        tip: 'Saat kedua panel disembunyikan, kanvas secara otomatis melebar penuh memudahkan inspeksi perangkat dengan banyak port (seperti switch 24–48 port).'
      },
      {
        stepNumber: 2,
        title: 'Menggeser (Panning) Kanvas ke Kanan, Kiri, Atas, dan Bawah',
        description: 'Terdapat 4 cara menggeser kanvas: (1) Klik & drag pada area kosong kanvas, (2) Aktifkan tombol "Pan Mode (H)" di kiri atas kanvas lalu drag di mana saja, (3) Tahan tombol Spacebar + Drag mouse, atau (4) Gunakan tombol arah panah (D-Pad) di pojok kanan bawah kanvas.',
        tip: 'Anda juga dapat menggunakan Scroll Wheel mouse: Scroll biasa untuk Zoom, Shift + Scroll untuk geser horizontal, dan Alt + Scroll untuk geser vertikal.'
      },
      {
        stepNumber: 3,
        title: 'Mengatur Zoom & Memusatkan Topologi (Fit to View)',
        description: 'Gunakan tombol (+) dan (-) di pojok kanan bawah kanvas untuk mengatur perbesaran antara 20% hingga 250%. Klik ikon "Fit to View" (kotak bidik) agar seluruh perangkat otomatis terpusat secara proporsional di layar.'
      },
      {
        stepNumber: 4,
        title: 'Beralih Antar Modul di Bottom Panel',
        description: 'Klik salah satu tab di bagian bawah layar (misalnya "Monitoring" atau "ISP & WAN"). Klik ikon panah atas/bawah di ujung kanan Bottom Panel untuk memperbesar, memperkecil, atau melipat panel bawah.'
      }
    ],
    technicalTables: [
      {
        title: 'Daftar Pintasan Keyboard & Interaksi Mouse',
        headers: ['Aksi / Pintasan', 'Konteks', 'Fungsi'],
        rows: [
          ['Tombol V', 'Topology Canvas', 'Beralih ke Select & Move Mode (memilih node & menghubungkan port)'],
          ['Tombol H', 'Topology Canvas', 'Beralih ke Hand / Pan Mode (menggeser kanvas dengan bebas)'],
          ['Space + Klik Kiri Drag', 'Topology Canvas', 'Menggeser kanvas sementara tanpa mengubah mode aktif'],
          ['Klik Tengah / Roda Mouse Drag', 'Topology Canvas', 'Menggeser kanvas ke segala arah'],
          ['Scroll Wheel Atas / Bawah', 'Topology Canvas', 'Zoom In / Zoom Out berpusat pada posisi kursor mouse'],
          ['Escape (Esc)', 'Canvas / Modal', 'Membatalkan penarikan kabel yang sedang berlangsung atau menutup modal aktif']
        ]
      }
    ],
    expectedResults: [
      'Kanvas dapat digeser dengan mulus ke seluruh arah tanpa batas kaku.',
      'Ruang kerja dapat disesuaikan antara tampilan fokus kanvas penuh atau tampilan berdampingan dengan Inspector dan Bottom Panel.'
    ],
    tips: [
      'Jika Anda kehilangan posisi perangkat karena menggeser kanvas terlalu jauh, cukup klik tombol "Fit to View" di pojok kanan bawah kanvas.',
      'Perhatikan indikator koordinat dan persentase Zoom di pojok kanan bawah untuk menjaga keterbacaan label port.'
    ],
    commonProblems: [
      {
        problem: 'Tidak sengaja menggeser posisi perangkat saat ingin menggeser layar kanvas.',
        cause: 'Kanvas sedang berada dalam mode "Select Mode (V)" dan Anda melakukan drag di atas kartu perangkat.',
        solution: 'Aktifkan "Pan Mode (H)" pada toolbar mengambang di kiri atas kanvas atau tahan tombol Spacebar saat melakukan drag.'
      }
    ],
    relatedGuides: ['getting-started', 'topology-editor', 'device-management']
  },
  {
    id: 'topology-editor',
    number: '04',
    title: 'Topology Editor',
    subtitle: 'Merancang topologi jaringan secara visual, mengatur tata letak otomatis, mengelola node, dan membaca indikator visual.',
    category: 'Topologi & Perangkat',
    iconName: 'Network',
    description:
      'Topology Editor adalah kanvas interaktif tempat Anda merakit arsitektur jaringan. Setiap perangkat direpresentasikan sebagai kartu perangkat interaktif (Interactive Faceplate Card) yang menampilkan identitas perangkat, indikator kesehatan, tombol akses cepat CLI/Winbox, serta matriks port Ethernet dan SFP/SFP+.',
    purpose:
      'Memungkinkan perancangan topologi jaringan yang akurat hingga ke tingkat port fisik (port-level accuracy) sekaligus menyediakan visualisasi aliran trafik dan status gangguan secara langsung.',
    availableFeatures: [
      {
        name: 'Interactive Device Cards with Dual-Block Faceplates',
        status: 'active',
        description: 'Kartu perangkat menampilkan Header identitas, tombol CLI & Winbox, Block A (Ethernet Ports), dan Block B (SFP/SFP+ Optical Ports).'
      },
      {
        name: 'Interactive Port-to-Port Cable Drawing',
        status: 'active',
        description: 'Penarikan garis koneksi kurva Bezier dinamis dengan pratinjau kabel mengikuti kursor dan pembatalan cepat.'
      },
      {
        name: 'Hierarchical Auto-Layout',
        status: 'active',
        description: 'Menyusun ulang posisi perangkat secara otomatis berdasarkan hierarki jaringan (ISP/WAN di atas → Router → Switch → AP/Client di bawah).'
      },
      {
        name: 'Visual Link Telemetry & Animated Packets',
        status: 'active',
        description: 'Kabel menampilkan label nama interface di kedua ujung, badge kecepatan/VLAN di tengah, serta titik animasi paket saat trafik mengalir.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Menambahkan Perangkat ke Kanvas',
        description: 'Buka kategori perangkat di Sidebar kiri, lalu klik kartu model perangkat atau seret (drag & drop) langsung ke titik koordinat yang diinginkan di atas kanvas.'
      },
      {
        stepNumber: 2,
        title: 'Memilih & Memindahkan Perangkat',
        description: 'Pastikan mode "Select (V)" aktif. Klik kartu perangkat untuk membuka detailnya di Inspector kanan. Tahan klik kiri pada bagian header kartu perangkat lalu geser untuk memindahkan posisinya.'
      },
      {
        stepNumber: 3,
        title: 'Menghubungkan Dua Perangkat',
        description: 'Klik satu kali pada kotak port sumber (misal `ether2` pada Router). Garis pratinjau biru akan mengikuti kursor Anda. Klik pada kotak port tujuan (misal `ether1` pada Switch) untuk menyelesaikan penyambungan.'
      },
      {
        stepNumber: 4,
        title: 'Merapikan Tata Letak Otomatis (Auto-Layout)',
        description: 'Jika posisi perangkat terlihat berantakan atau saling bertumpuk, klik tombol "Auto-Layout" (ikon kilau/sparkle) di TopBar. Kanvas akan merapikan jarak antar node secara proporsional.'
      },
      {
        stepNumber: 5,
        title: 'Menghapus Koneksi atau Perangkat',
        description: 'Klik pada garis kabel atau kartu perangkat untuk memilihnya, lalu klik tombol "Delete Device" / "Remove Link" berwarna merah di panel Inspector kanan.'
      }
    ],
    expectedResults: [
      'Seluruh perangkat tersusun rapi tanpa ada kartu yang saling menutupi berkat perhitungan lebar dinamis per perangkat.',
      'Garis koneksi terhubung presisi tepat di titik tengah koordinat port Ethernet maupun SFP/SFP+.'
    ],
    tips: [
      'Gunakan tombol "Cancel Connecting" di kiri atas kanvas atau tekan tombol Escape jika Anda salah memilih port awal saat menarik kabel.',
      'Arahkan kursor (hover) di atas kotak port mana pun untuk melihat tooltip instan berisi nama interface, tipe media, kecepatan, VLAN/IP, dan status koneksi.'
    ],
    commonProblems: [
      {
        problem: 'Garis kabel berwarna merah putus-putus atau muncul ikon peringatan.',
        cause: 'Salah satu port berstatus admin DOWN, perangkat mati, atau terdapat ketidakcocokan konfigurasi (misal transceiver mismatch atau loop).',
        solution: 'Klik garis kabel tersebut atau buka tab "Diagnostics" di panel bawah untuk melihat penyebab pasti dan langkah perbaikannya.'
      }
    ],
    relatedGuides: ['workspace-navigation', 'device-management', 'interface-connections']
  },
  {
    id: 'device-management',
    number: '05',
    title: 'Device Management & Faceplate UI',
    subtitle: 'Mengelola katalog perangkat bawaan, membuat Custom Device, dan memahami struktur Dual-Block Interface Faceplate.',
    category: 'Topologi & Perangkat',
    iconName: 'Server',
    description:
      'NETLAB menyediakan katalog perangkat jaringan dunia nyata (khususnya lini MikroTik RouterBoard, Cloud Core Router, dan Cloud Router Switch) serta fitur Custom Device Builder. Setiap perangkat dirender menggunakan arsitektur Dual-Block Interface Faceplate yang memisahkan port tembaga (Ethernet) dan port optik (SFP/SFP+) secara proporsional.',
    purpose:
      'Memberikan fleksibilitas kepada pengguna untuk merancang jaringan menggunakan spesifikasi perangkat keras nyata maupun perangkat kustom, serta memahami perbedaan antara template katalog dan instance perangkat di kanvas.',
    availableFeatures: [
      {
        name: 'Built-in Device Catalog',
        status: 'active',
        description: 'Katalog terkurasi mencakup ISP/Cloud, MikroTik Routers (hEX, RB4011, RB5009, CCR2004, CCR2116, CCR2216), Switches (CSS610, CRS326, CRS328, CRS354), Wireless AP, Firewall, Server, dan PC.'
      },
      {
        name: 'Custom Device Builder & JSON Persistence',
        status: 'active',
        description: 'Buat model perangkat sendiri dengan menentukan nama, vendor, kategori, jumlah port Ethernet (RJ45), jumlah port SFP/SFP+, kapasitas CPU/RAM, dan kemampuan PoE/VLAN/Routing.'
      },
      {
        name: 'Dual-Block Interface Faceplate (Block A & Block B)',
        status: 'active',
        description: 'Block A menampilkan seluruh port Ethernet (maksimal 2 baris) dan Block B menampilkan seluruh port SFP/SFP+/QSFP+ (maksimal 2 baris) dengan lebar kartu yang menyesuaikan otomatis.'
      },
      {
        name: 'Catalog Template vs Canvas Instance Separation',
        status: 'active',
        description: 'Menambahkan beberapa perangkat dari model katalog yang sama akan menghasilkan instance independen dengan ID, nama, alamat IP, dan konfigurasi RouterOS masing-masing.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Memilih Perangkat dari Built-in Catalog',
        description: 'Pada Sidebar kiri, gunakan kotak pencarian atau klik kategori (Routers, Switches, Wireless, Endpoints). Perhatikan badge jumlah port (misal `16G + 2S+`) sebelum menambahkan ke kanvas.'
      },
      {
        stepNumber: 2,
        title: 'Membuat Custom Device Baru',
        description: 'Klik tombol "+ Custom" di bagian atas Sidebar kiri. Isi Nama Model, Vendor, Kategori, Kecepatan Default, Jumlah Port RJ45 (Ethernet), dan Jumlah Port SFP+ (Fiber), lalu klik "Create Device".',
        tip: 'Perangkat kustom yang dibuat otomatis disimpan di penyimpanan lokal browser (localStorage) dan dapat diekspor/diimpor sebagai file JSON.'
      },
      {
        stepNumber: 3,
        title: 'Membaca Struktur Dual-Block Faceplate pada Kartu Perangkat',
        description: 'Perhatikan kartu perangkat di kanvas: Bagian atas adalah Header (ikon, nama, model, tombol `>_ CLI`, tombol `Winbox`, dan badge status). Di bawahnya terdapat `ETHERNET INTERFACES` (Block A) dan `SFP / SFP+ INTERFACES` (Block B) yang terpisah jelas.'
      },
      {
        stepNumber: 4,
        title: 'Mengubah Identitas, Role & Spesifikasi Instance Perangkat',
        description: 'Klik perangkat di kanvas, lalu pada panel Inspector kanan ubah "Hostname / Label", "RouterOS Version (v6/v7)", "Management IP", atau tambahkan port baru secara dinamis melalui bagian "Add Interface".'
      }
    ],
    technicalTables: [
      {
        title: 'Aturan Tata Letak Dual-Block Interface Faceplate',
        headers: ['Komponen', 'Aturan Layout', 'Rumus Kolom & Baris', 'Contoh Tampilan'],
        rows: [
          ['Block A — Ethernet Interfaces', 'Menampilkan seluruh port RJ45/Copper (`ether1..N`), maksimal 2 baris', 'Jika port <= 8: 1 baris. Jika > 8: `cols = ceil(N/2)`, `rows = 2`', '16 Ethernet → 8 kolom × 2 baris; 24 Ethernet → 12 kolom × 2 baris'],
          ['Block B — SFP / SFP+ Interfaces', 'Menampilkan seluruh port optik (`sfp`, `sfp-sfpplus`, `qsfp`), maksimal 2 baris', 'Jika port <= 8: 1 baris. Jika > 8: `cols = ceil(N/2)`, `rows = 2`', '4 SFP+ → 4 kolom × 1 baris; 12 SFP+ → 6 kolom × 2 baris'],
          ['Lebar Kartu Perangkat (Card Width)', 'Mengikuti blok interface terlebar secara dinamis tanpa horizontal scroll', '`max(minHeaderWidth, ethBlockWidth, sfpBlockWidth) + padding`', 'Switch 48 port otomatis melebar menjadi 24 kolom × 2 baris yang rapi']
        ]
      }
    ],
    expectedResults: [
      'Perangkat dengan hanya port Ethernet hanya menampilkan Block A; perangkat all-optical (seperti CRS317-1G-16S+ dalam mode optik) menampilkan blok sesuai port yang dimiliki.',
      'Custom Device muncul di kategori "Custom Devices" dan siap digunakan berulang kali di berbagai skenario topologi.'
    ],
    tips: [
      'Gunakan tombol Export/Import pada bagian Custom Devices di Sidebar kiri untuk membagikan koleksi perangkat kustom Anda kepada rekan tim.',
      'Tombol `>_ CLI` dan `Winbox` muncul secara kontekstual pada header kartu perangkat kategori Router, Switch, dan Firewall.'
    ],
    commonProblems: [
      {
        problem: 'Mengubah konfigurasi pada satu Router tidak mengubah Router lain dengan model yang sama.',
        cause: 'Setiap perangkat di kanvas adalah Device Instance yang berdiri sendiri, sedangkan daftar di Sidebar hanyalah Catalog Template.',
        solution: 'Konfigurasikan masing-masing perangkat secara spesifik, atau gunakan fitur Export/Import `.rsc` di dalam MikroTik Console untuk menyalin konfigurasi antar router.'
      }
    ],
    relatedGuides: ['topology-editor', 'interface-connections', 'mikrotik-console', 'import-export']
  },
  {
    id: 'interface-connections',
    number: '06',
    title: 'Interface & Connections',
    subtitle: 'Memahami jenis port Ethernet vs SFP/SFP+, status visual interface, kompatibilitas media kabel, dan contoh topologi.',
    category: 'Topologi & Perangkat',
    iconName: 'Cable',
    description:
      'Koneksi jaringan di NETLAB dibangun pada tingkat interface individual. Setiap port memiliki atribut fisik (tipe konektor, kecepatan, media transceiver, PoE) dan atribut logis (status administratif, mode Access/Trunk/WAN/Routed, VLAN ID, serta IP Address/CIDR).',
    purpose:
      'Memandu pengguna dalam menyambungkan perangkat dengan media yang tepat, memahami arti indikator warna port, dan mengonfigurasi parameter interface untuk konektivitas Layer 1 hingga Layer 3.',
    availableFeatures: [
      {
        name: 'Multi-Speed Ethernet & Optical SFP Port Types',
        status: 'active',
        description: 'Mendukung port Copper RJ45 (100M, 1G, 2.5G, 10G) serta port Optical Cage (SFP 1.25G, SFP+ 10G, SFP28 25G, QSFP+ 40G/100G).'
      },
      {
        name: 'Real-Time Port Visual Status Indicator',
        status: 'active',
        description: 'Indikator titik LED dan warna kotak port membedakan kondisi Running/Connected, Available, Disabled (Admin Down), dan Error/Saturated.'
      },
      {
        name: 'Link Media & Bandwidth Limiting',
        status: 'active',
        description: 'Koneksi otomatis menegosiasikan kecepatan efektif berdasarkan kemampuan terendah dari kedua ujung port atau batas bandwidth kustom pada link.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Memeriksa Detail Port Melalui Tooltip',
        description: 'Arahkan kursor mouse ke atas kotak port pada faceplate perangkat. Tooltip akan menampilkan nama port (`ether1`, `sfp-sfpplus1`), kategori blok, kecepatan (`1G`, `10G`), mode port, IP/VLAN, dan status koneksi.'
      },
      {
        stepNumber: 2,
        title: 'Menyambungkan Contoh Topologi: Router → Switch → Access Point',
        description: '1) Klik port `sfp-sfpplus1` pada Router (misal RB5009) lalu klik port `sfp-sfpplus1` pada Switch (CRS326) untuk membuat uplink Fiber 10Gbps.\n2) Klik port `ether1` pada Switch lalu klik port `ether1` pada Access Point (cAP ax) untuk koneksi Copper 1Gbps.'
      },
      {
        stepNumber: 3,
        title: 'Mengatur Mode Interface (Access, Trunk, WAN, Routed)',
        description: 'Klik perangkat, lalu di panel Inspector kanan gulir ke bagian "Interfaces". Pilih port yang ingin diatur: gunakan mode `WAN` untuk port ke arah ISP, `Trunk` untuk kabel antar-switch yang membawa banyak VLAN, atau `Access` untuk port ke PC/AP.'
      },
      {
        stepNumber: 4,
        title: 'Mengubah Media Kabel & Panjang Link',
        description: 'Klik langsung pada garis kabel di kanvas. Di Inspector kanan, Anda dapat mengubah tipe media (`Copper Cat6`, `Fiber Multi-Mode`, `Fiber Single-Mode`), panjang kabel (meter), serta menyimulasikan latency/packet loss tambahan pada link.'
      }
    ],
    technicalTables: [
      {
        title: 'Standar Indikator Warna & Status Port pada Faceplate',
        headers: ['Status Port', 'Tampilan Visual di Faceplate', 'Indikator Titik LED', 'Arti Kondisi'],
        rows: [
          ['Running / Connected (Ethernet)', 'Kotak hijau emerald (`emerald-500/20`) dengan border hijau', 'Titik hijau menyala', 'Port aktif (UP) dan terhubung dengan kabel yang berfungsi normal'],
          ['Running / Connected (SFP/SFP+)', 'Kotak biru sian (`cyan-500/20`) dengan border sian', 'Titik sian menyala', 'Port optik aktif (UP) dan link fiber terhubung normal'],
          ['Available (Idle / Unconnected)', 'Kotak gelap (`slate-900`) dengan border abu-abu/indigo', 'Titik abu-abu redup', 'Port menyala secara administratif tetapi belum dicolokkan kabel'],
          ['Disabled (Admin Down)', 'Kotak redup bergaris putus-putus (`opacity-50`)', 'Titik merah (`red-500`)', 'Port dimatikan secara administratif (`admin=down` atau `/interface disable`)'],
          ['Error / Link Fault', 'Border merah menyala pada link/port', 'Titik merah berkedip', 'Terjadi kegagalan L1/L2 seperti transceiver mismatch atau port lawan mati']
        ]
      }
    ],
    expectedResults: [
      'Koneksi uplink berkecepatan tinggi menggunakan blok SFP/SFP+ terpisah secara visual dari koneksi distribusi LAN di blok Ethernet.',
      'Kecepatan link otomatis mengikuti negosiasi port (misal port 10G dihubungkan ke port 1G akan beroperasi pada 1 Gbps).'
    ],
    tips: [
      'Gunakan port SFP+ (10G) untuk jalur backbone antar Router dan Core Switch guna mencegah bottleneck ketika banyak klien aktif secara bersamaan.',
      'Jika Anda menonaktifkan port melalui CLI (`/interface disable ether2`), tampilan port pada faceplate kanvas juga akan langsung berubah menjadi Disabled.'
    ],
    commonProblems: [
      {
        problem: 'Muncul peringatan "Optical Transceiver / Media Mismatch" di tab Diagnostics.',
        cause: 'Anda menghubungkan port Optical SFP/SFP+ langsung ke port Copper RJ45 tanpa media converter, atau panjang kabel melebihi batas spesifikasi media (misal Cat6 > 100 meter).',
        solution: 'Hubungkan port SFP/SFP+ ke sesama port SFP/SFP+ menggunakan media Fiber, dan port Ethernet RJ45 ke sesama port Ethernet RJ45.'
      }
    ],
    relatedGuides: ['device-management', 'topology-editor', 'diagnostics', 'mikrotik-console']
  }
];
