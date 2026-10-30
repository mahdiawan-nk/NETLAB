import { GuideSectionContent } from '../../types/userGuide';

export const PART3_CONSOLE_AND_SUPPORT_GUIDES: GuideSectionContent[] = [
  {
    id: 'mikrotik-console',
    number: '14',
    title: 'MikroTik Management Console (CLI & Winbox GUI)',
    subtitle: 'Mengonfigurasi perangkat menggunakan terminal RouterOS CLI dan Winbox-like GUI Manager dengan sinkronisasi dua arah.',
    category: 'MikroTik & Konfigurasi',
    iconName: 'Terminal',
    description:
      'Setiap perangkat kategori Router, Switch, dan Firewall di NETLAB memiliki MikroTik Device Management Console terintegrasi. Anda dapat memilih untuk bekerja menggunakan baris perintah RouterOS CLI (`>_ CLI`), antarmuka grafis bergaya Winbox (`Winbox` GUI), atau mengelola cadangan & pengujian kompatibilitas (`Backup & Diff`).',
    purpose:
      'Memberikan pengalaman konfigurasi perangkat MikroTik RouterOS (v6 & v7) yang autentik dan edukatif, di mana perubahan melalui perintah CLI langsung tampil di tabel Winbox GUI dan sebaliknya.',
    simulationNotice:
      'PENTING: Konfigurasi yang Anda buat di dalam MikroTik Management Console adalah konfigurasi tersimulasi (Simulated RouterOS Configuration State) di dalam memori aplikasi NETLAB. Aplikasi ini TIDAK terhubung ke perangkat keras MikroTik fisik di jaringan Anda kecuali Anda mengekspor file `.rsc` dan mengimpornya sendiri ke perangkat fisik.',
    availableFeatures: [
      {
        name: 'Bi-Directional CLI & Winbox GUI Synchronization',
        status: 'active',
        description: 'Menambah IP Address, Bridge, VLAN, Route, atau Firewall via CLI otomatis memperbarui tabel di Winbox GUI, begitu pula sebaliknya.'
      },
      {
        name: '14 Winbox-Style Management Menus',
        status: 'active',
        description: 'Mencakup Interfaces, Bridge (Bridges & Ports), VLAN (802.1Q), IP Addresses, DHCP Server (Servers, Networks, Pools), Routes, DNS, Firewall (Filter & NAT), Queues (Simple Queues), System Identity, Resources, Log, Tools (Ping/Traceroute), dan Backup/Diff.'
      },
      {
        name: 'RouterOS v6 vs v7 Version Profile Switcher',
        status: 'active',
        description: 'Uji perilaku sintaks perintah dan validasi kompatibilitas antara profil RouterOS v6 (Long-term) dan RouterOS v7 (Stable).'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka MikroTik Console dari Kartu Perangkat atau Inspector',
        description: 'Pada kartu perangkat Router/Switch di kanvas, klik tombol `>_ CLI` untuk langsung membuka mode Terminal, atau klik tombol `Winbox` untuk langsung membuka mode GUI Manager. Anda juga bisa membukanya dari panel Inspector kanan.'
      },
      {
        stepNumber: 2,
        title: 'Menggunakan Winbox-like GUI Manager',
        description: 'Di dalam modal konsol, pastikan tab atas berada pada mode `Winbox GUI`. Pilih menu di sidebar kiri Winbox (misal `IP` → `Addresses` atau `Bridge`). Gunakan tombol `+ Add` untuk menambah entri baru, klik ikon Enable/Disable untuk mengaktifkan/menonaktifkan item, atau klik ikon hapus untuk menghapus entri.'
      },
      {
        stepNumber: 3,
        title: 'Beralih ke Mode CLI Terminal & Melihat Sinkronisasi',
        description: 'Klik tombol mode `CLI Terminal` di header modal. Ketik `/ip address print` atau `/export compact`. Anda akan melihat seluruh konfigurasi yang baru saja Anda buat di Winbox GUI tercetak dalam format skrip RouterOS standar.'
      },
      {
        stepNumber: 4,
        title: 'Menguji Ping & Traceroute dari Dalam Perangkat',
        description: 'Buka menu `Tools (Ping/Trace)` di Winbox GUI atau ketik `/tool ping 8.8.8.8` di CLI Terminal untuk menguji konektivitas langsung dari perspektif router tersebut.'
      }
    ],
    technicalTables: [
      {
        title: 'Daftar Menu Winbox-like GUI Manager yang Tersedia',
        headers: ['Menu Winbox', 'Sub-Menu / Fitur Aktual', 'Padanan Path CLI RouterOS'],
        rows: [
          ['Interfaces', 'Daftar port fisik (Ethernet/SFP+), status Running, MTU, MAC, Enable/Disable', '`/interface`'],
          ['Bridge', 'Tab Bridges (STP/RSTP, VLAN Filtering) & Tab Bridge Ports (PVID)', '`/interface bridge`, `/interface bridge port`'],
          ['VLAN', 'Pembuatan interface 802.1Q VLAN di atas interface fisik atau bridge', '`/interface vlan`'],
          ['IP -> Addresses', 'Penambahan IP/CIDR pada interface dan kalkulasi network otomatis', '`/ip address`'],
          ['IP -> Pool & DHCP Server', 'Tab DHCP Servers, DHCP Networks (Gateway/DNS), dan IP Pools', '`/ip pool`, `/ip dhcp-server`'],
          ['IP -> Routes', 'Tabel routing statis & connected (`DAC`, `AS`) beserta distance', '`/ip route`'],
          ['IP -> DNS', 'Pengaturan DNS Servers, Allow Remote Requests, dan Static DNS Host', '`/ip dns`, `/ip dns static`'],
          ['IP -> Firewall', 'Tab Filter Rules (`input`,`forward`,`output`) & Tab NAT Rules (`srcnat`,`dstnat`)', '`/ip firewall filter`, `/ip firewall nat`'],
          ['Queues', 'Simple Queues (`target`, `max-limit` Upload/Download, `priority`)', '`/queue simple`'],
          ['System & Tools', 'System Identity, Resource Monitor, Device Log, Ping & Traceroute', '`/system identity`, `/system resource`, `/tool`']
        ]
      }
    ],
    expectedResults: [
      'Pengguna dapat mempraktikkan konfigurasi RouterOS baik dengan cara klik visual (Winbox) maupun pengetikan perintah (CLI).',
      'Setiap perubahan konfigurasi langsung memengaruhi hasil evaluasi Packet Tracer dan Diagnostics.'
    ],
    tips: [
      'Gunakan tombol pintas perintah (Quick Commands) di bagian bawah jendela CLI Terminal untuk mengeksekusi perintah populer dengan satu klik.',
      'Tekan tombol Panah Atas / Panah Bawah pada keyboard saat berada di input CLI untuk memanggil riwayat perintah sebelumnya.'
    ],
    commonProblems: [
      {
        problem: 'Menambahkan IP Address pada port yang sudah menjadi anggota Bridge menyebabkan peringatan di Diagnostics.',
        cause: 'Dalam praktik standar RouterOS, jika sebuah port fisik (misal `ether2`) dimasukkan ke dalam `bridge1`, maka IP Address dan DHCP Server seharusnya dipasang pada interface `bridge1`, bukan pada `ether2`.',
        solution: 'Pindahkan IP Address dan DHCP Server Anda ke interface Bridge induknya.'
      }
    ],
    relatedGuides: ['cli-reference', 'configuration-management', 'network-simulation']
  },
  {
    id: 'cli-reference',
    number: '15',
    title: 'CLI Reference (RouterOS & Topology CLI)',
    subtitle: 'Referensi lengkap perintah CLI yang didukung secara aktual di MikroTik Device Console dan Global Topology Terminal.',
    category: 'MikroTik & Konfigurasi',
    iconName: 'Code2',
    description:
      'NETLAB menyediakan dua lingkungan Command Line Interface (CLI): (1) MikroTik RouterOS Device CLI di dalam modal konsol setiap perangkat untuk mengonfigurasi RouterOS, dan (2) Global Topology CLI di tab "CLI Terminal" Bottom Panel untuk memanipulasi topologi secara cepat.',
    purpose:
      'Memberikan dokumentasi akurat mengenai sintaks perintah yang benar-benar didukung oleh parser NETLAB, contoh skrip konfigurasi lengkap, serta batasan perintah yang tidak diimplementasikan.',
    simulationNotice:
      'Hanya perintah yang tercantum dalam referensi di bawah ini yang didukung secara aktif oleh parser (`routerOsCliEngine.ts` dan `cliParser.ts`). Perintah di luar daftar ini (seperti `/routing bgp`, `/ip ipsec`, `/mpls`, atau scripting loop kompleks `:foreach`) tidak dieksekusi oleh simulator.',
    availableFeatures: [
      {
        name: 'Context-Aware RouterOS Command Parser',
        status: 'active',
        description: 'Mendukung eksekusi perintah dengan path penuh (misal `/ip address add ...`) maupun berpindah direktori menu aktif (misal ketik `/ip address` lalu ketik `print` atau `add ...`).'
      },
      {
        name: 'RouterOS v6 vs v7 Syntax Guard',
        status: 'active',
        description: 'Mendeteksi ketidaksesuaian sintaks antar versi (misal parameter `route-distinguisher` atau perubahan properti BGP/Route di v7) dan memberikan pesan peringatan versi.'
      },
      {
        name: 'Global Topology Manipulation CLI',
        status: 'active',
        description: 'Tambah/hapus perangkat, sambungkan link, atur VLAN, dan jalankan validasi topologi melalui perintah teks di panel bawah.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Menjalankan Perintah di MikroTik Device CLI',
        description: 'Buka modal konsol perangkat (`>_ CLI`). Ketik perintah RouterOS (misal `/interface print`) lalu tekan Enter. Untuk berpindah ke level menu tertentu, ketik path menu (misal `/ip firewall nat`), lalu ketik `print`. Ketik `/` untuk kembali ke root atau `..` untuk naik satu level.'
      },
      {
        stepNumber: 2,
        title: 'Menggunakan Parameter key=value',
        description: 'Saat menggunakan perintah `add` atau `set`, gunakan format pasangan `parameter=nilai` sesuai standar RouterOS, misalnya: `/ip address add address=192.168.10.1/24 interface=ether2 comment="LAN_Gateway"`.'
      },
      {
        stepNumber: 3,
        title: 'Menghapus atau Mengubah Entri Berdasarkan Nomor Index / Nama',
        description: 'Jalankan `print` terlebih dahulu untuk melihat nomor indeks baris (kolom `#`, dimulai dari `0`), lalu jalankan `remove numbers=0` atau `disable numbers=0`.'
      }
    ],
    cliCommands: [
      {
        context: 'MikroTik RouterOS CLI (`/interface`)',
        command: '/interface print | set | enable | disable',
        syntax: '/interface set [find name=ether1] name=ether1-WAN comment="Uplink ISP"\n/interface disable ether5\n/interface enable ether5',
        description: 'Menampilkan daftar interface fisik, mengubah nama/komentar/MTU, serta menonaktifkan atau mengaktifkan port.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/interface bridge`)',
        command: '/interface bridge & /interface bridge port',
        syntax: '/interface bridge add name=bridge-lan protocol-mode=rstp vlan-filtering=no\n/interface bridge port add bridge=bridge-lan interface=ether2 pvid=1\n/interface bridge port print',
        description: 'Membuat interface Bridge Layer 2 dan menambahkan port fisik sebagai anggota bridge beserta PVID-nya.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/interface vlan`)',
        command: '/interface vlan add | print | remove',
        syntax: '/interface vlan add name=vlan10-staff vlan-id=10 interface=bridge-lan\n/interface vlan print',
        description: 'Membuat sub-interface VLAN 802.1Q di atas interface induk (port fisik atau bridge).'
      },
      {
        context: 'MikroTik RouterOS CLI (`/ip address`)',
        command: '/ip address add | print | set | remove',
        syntax: '/ip address add address=192.168.10.1/24 interface=bridge-lan comment="LAN Subnet"\n/ip address print\n/ip address remove numbers=0',
        description: 'Mengelola alamat IPv4/CIDR pada interface perangkat.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/ip pool` & `/ip dhcp-server`)',
        command: '/ip pool & /ip dhcp-server',
        syntax: '/ip pool add name=pool-lan ranges=192.168.10.10-192.168.10.250\n/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=pool-lan disabled=no\n/ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=8.8.8.8,1.1.1.1',
        description: 'Mengonfigurasi layanan DHCP Server lengkap dengan rentang IP Pool dan opsi gateway/DNS.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/ip route`)',
        command: '/ip route add | print | remove',
        syntax: '/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1 distance=1 comment="Primary_ISP"\n/ip route print',
        description: 'Menambahkan rute statis atau Default Gateway serta melihat tabel routing (`DAC` dan `AS`).'
      },
      {
        context: 'MikroTik RouterOS CLI (`/ip dns`)',
        command: '/ip dns set | print & /ip dns static',
        syntax: '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes\n/ip dns static add name=intranet.local address=192.168.10.50',
        description: 'Mengatur resolver DNS perangkat dan entri DNS statis lokal.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/ip firewall`)',
        command: '/ip firewall filter & /ip firewall nat',
        syntax: '/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="WAN_NAT"\n/ip firewall filter add chain=forward src-address=192.168.20.0/24 dst-address=192.168.10.0/24 action=drop comment="Isolate_Guest"',
        description: 'Mengatur translasi alamat NAT (masquerade/dst-nat) dan aturan pemfilteran paket (accept/drop/reject).'
      },
      {
        context: 'MikroTik RouterOS CLI (`/queue simple`)',
        command: '/queue simple add | print | enable | disable | remove',
        syntax: '/queue simple add name="Limit-Guest" target=192.168.20.0/24 max-limit=10M/20M priority=8',
        description: 'Membatasi bandwidth Upload/Download (`max-limit=UP/DOWN`) untuk subnet atau IP tertentu.'
      },
      {
        context: 'MikroTik RouterOS CLI (`/system`, `/tool`, `/export`)',
        command: '/system, /tool ping/traceroute, /export',
        syntax: '/system identity set name=RTR-CORE-01\n/system resource print\n/system backup save name=sebelum-migrasi\n/export compact\n/tool ping 8.8.8.8',
        description: 'Mengubah nama router, melihat resource CPU/RAM, membuat snapshot backup, mengekspor skrip `.rsc`, dan menguji ping/traceroute.'
      },
      {
        context: 'Global Topology CLI (Bottom Panel Tab `CLI Terminal`)',
        command: 'show | device | link | interface | vlan | simulate | diagnose',
        syntax: 'show devices\ndevice add router model=mikrotik-rb5009 name=RTR-CABANG\nlink add RTR-CABANG:ether1 SW-UTAMA:ether24\ninterface set RTR-CABANG:ether1 ip=10.10.10.1/24 mode=routed\nsimulate validate\ndiagnose all',
        description: 'Perintah cepat tingkat workspace untuk membangun dan memvalidasi topologi dari tab CLI bawah.'
      }
    ],
    codeExamples: [
      {
        title: 'Contoh Skrip Lengkap Konfigurasi Router Gateway SOHO (Siap Tempel di CLI)',
        language: 'routeros',
        description: 'Skrip berikut mengonfigurasi identitas router, bridge LAN, IP WAN & LAN, DHCP Server, DNS, NAT Masquerade, Default Route, dan Simple Queue:',
        code: `/system identity set name=RTR-OFFICE-HQ
/interface bridge add name=bridge-lan protocol-mode=rstp
/interface bridge port add bridge=bridge-lan interface=ether2
/interface bridge port add bridge=bridge-lan interface=ether3
/interface bridge port add bridge=bridge-lan interface=ether4
/ip address add address=203.0.113.2/30 interface=ether1 comment="WAN_ISP"
/ip address add address=192.168.88.1/24 interface=bridge-lan comment="LAN_Default"
/ip pool add name=pool-office ranges=192.168.88.10-192.168.88.200
/ip dhcp-server add name=dhcp-office interface=bridge-lan address-pool=pool-office disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes
/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
/queue simple add name="Queue-All-LAN" target=192.168.88.0/24 max-limit=50M/100M`
      }
    ],
    expectedResults: [
      'Perintah dieksekusi tanpa error dan langsung memperbarui state konfigurasi perangkat.',
      'Output `/export compact` menampilkan skrip konfigurasi RouterOS yang bersih dan terstandarisasi.'
    ],
    tips: [
      'Ketik `help` atau `?` di dalam terminal untuk melihat daftar perintah yang tersedia pada konteks menu saat ini.',
      'Anda dapat menempelkan (paste) beberapa baris perintah sekaligus (multi-line script) ke dalam kotak input atau menggunakan fitur Import `.rsc`.'
    ],
    commonProblems: [
      {
        problem: 'Muncul pesan "bad command name" atau "syntax error" saat mengetik perintah.',
        cause: 'Perintah diketik tanpa awalan `/` saat berada di sub-menu yang berbeda, atau perintah tersebut termasuk fitur yang belum disimulasikan (misal OSPF/MPLS).',
        solution: 'Awali perintah dengan `/` (contoh `/ip address print`) untuk mengeksekusi dari root path dan pastikan sintaks sesuai tabel referensi di atas.'
      }
    ],
    relatedGuides: ['mikrotik-console', 'configuration-management', 'troubleshooting']
  },
  {
    id: 'configuration-management',
    number: '16',
    title: 'Configuration Management, Backup, Diff & Compatibility',
    subtitle: 'Mengelola snapshot konfigurasi, membandingkan perubahan (Config Diff), validasi RouterOS v6 vs v7, dan 12 skenario regresi.',
    category: 'MikroTik & Konfigurasi',
    iconName: 'GitCompare',
    description:
      'Kesalahan konfigurasi pada router produksi sering kali menyebabkan downtime. Di dalam MikroTik Management Console NETLAB, tab "Backup, Diff & Testing" menyediakan peralatan kelas enterprise untuk membuat titik pemulihan (Snapshot Backup), membandingkan perbedaan baris konfigurasi (Side-by-Side / Unified Diff), memeriksa kompatibilitas lintas versi RouterOS v6/v7, serta menjalankan 12 skenario pengujian otomatis.',
    purpose:
      'Melatih kebiasaan manajemen perubahan (Change Control) yang aman: selalu lakukan backup sebelum perubahan, tinjau diff konfigurasi, dan validasi kompatibilitas sebelum menerapkan skrip ke perangkat.',
    availableFeatures: [
      {
        name: 'Snapshot Backup & One-Click Restore',
        status: 'active',
        description: 'Simpan state penuh konfigurasi RouterOS perangkat ke dalam daftar snapshot bernama dan pulihkan (Restore) kapan saja.'
      },
      {
        name: 'Visual Configuration Diff Viewer',
        status: 'active',
        description: 'Bandingkan konfigurasi aktif saat ini (`Running Config`) dengan snapshot backup mana pun untuk melihat baris yang ditambah (`+` hijau) dan dihapus (`-` merah).'
      },
      {
        name: 'RouterOS v6 / v7 Compatibility Validator & Migrator',
        status: 'active',
        description: 'Audit skrip konfigurasi terhadap perbedaan sintaks RouterOS v6 dan v7 serta konversi profil versi perangkat.'
      },
      {
        name: '12-Scenario Automated Regression Test Suite',
        status: 'active',
        description: 'Jalankan 12 skenario uji otomatis (Switching, VLAN, Routing, NAT, Firewall, DHCP, Queue, v6/v7 compatibility) langsung di dalam konsol.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Membuka Panel Configuration Management',
        description: 'Buka konsol perangkat Router/Switch (`>_ CLI` atau `Winbox`), lalu klik tombol tab `Backup & Diff` di bagian kanan atas modal konsol (atau pilih menu `Backup / Diff` di sidebar Winbox).'
      },
      {
        stepNumber: 2,
        title: 'Membuat Snapshot Backup & Melakukan Restore',
        description: 'Masukkan nama backup (misal `sebelum-ubah-firewall`) lalu klik "Create Snapshot". Jika konfigurasi baru yang Anda uji ternyata salah, cukup klik tombol "Restore" pada snapshot tersebut untuk mengembalikan state router seketika.'
      },
      {
        stepNumber: 3,
        title: 'Melihat Perbedaan Konfigurasi (Config Diff)',
        description: 'Pilih salah satu snapshot dari daftar untuk dibandingkan dengan `Running Configuration`. Panel Diff akan menyorot setiap baris perintah `.rsc` yang berubah, ditambah, atau dihapus beserta log riwayat perubahannya (Change History).'
      },
      {
        stepNumber: 4,
        title: 'Memvalidasi Kompatibilitas RouterOS v6 vs v7 & Menjalankan 12 Test Suite',
        description: 'Gulir ke bagian "RouterOS v6 / v7 Compatibility Validator" untuk melihat apakah ada parameter yang usang (deprecated) saat berpindah versi. Klik "Run All 12 Scenarios" pada bagian Regression Test Suite untuk memverifikasi integritas engine.'
      }
    ],
    expectedResults: [
      'Setiap perubahan konfigurasi memiliki titik kembali (rollback point) yang aman.',
      'Skrip `.rsc` yang diekspor terjamin bersih dari konflik sintaks antara RouterOS v6 dan RouterOS v7.'
    ],
    tips: [
      'Anda juga dapat membuat dan memuat backup melalui perintah CLI `/system backup save name=backup1` dan `/system backup load name=backup1`.',
      'Gunakan fitur "Reset Configuration" jika ingin mengembalikan perangkat ke pengaturan awal pabrik (Factory Default).'
    ],
    commonProblems: [
      {
        problem: 'Diff Viewer menampilkan "No differences found".',
        cause: 'Anda belum melakukan perubahan konfigurasi apa pun sejak snapshot backup tersebut dibuat.',
        solution: 'Lakukan penambahan/perubahan di Winbox atau CLI, lalu buka kembali tampilan Diff untuk melihat baris yang berubah.'
      }
    ],
    relatedGuides: ['mikrotik-console', 'cli-reference', 'import-export']
  },
  {
    id: 'import-export',
    number: '17',
    title: 'Import & Export',
    subtitle: 'Menyimpan dan membagikan proyek topologi (JSON), katalog perangkat kustom (JSON), skrip RouterOS (.rsc), dan laporan Markdown (.md).',
    category: 'MikroTik & Konfigurasi',
    iconName: 'Download',
    description:
      'NETLAB mendukung portabilitas data penuh melalui berbagai format standar terbuka. Anda dapat mengekspor dan mengimpor seluruh proyek topologi jaringan, mengekspor katalog perangkat kustom, mengunduh atau mengunggah skrip konfigurasi MikroTik `.rsc`, serta menghasilkan dokumen laporan teknis berformat Markdown.',
    purpose:
      'Memungkinkan kolaborasi tim, pengarsipan desain jaringan, dokumentasi proyek untuk klien/akademik, serta pemindahan konfigurasi ke perangkat MikroTik sesungguhnya.',
    availableFeatures: [
      {
        name: 'Full Topology Project JSON Export & Import',
        status: 'active',
        description: 'Menyimpan seluruh perangkat, koordinat kanvas, link kabel, VLAN, sirkuit ISP, profil Workload, dan state konfigurasi RouterOS ke dalam satu file `.json`.'
      },
      {
        name: 'MikroTik RouterOS Script (.rsc) Export & Import',
        status: 'active',
        description: 'Unduh konfigurasi perangkat sebagai file `.rsc` standar atau impor potongan skrip `.rsc` ke dalam perangkat di NETLAB.'
      },
      {
        name: 'Custom Device Catalog JSON Export & Import',
        status: 'active',
        description: 'Ekspor dan impor spesifikasi perangkat kustom yang telah Anda rancang di Custom Device Builder.'
      },
      {
        name: 'Comprehensive Network Architecture Report (.md)',
        status: 'active',
        description: 'Hasilkan dokumen laporan Markdown berisi inventaris perangkat, tabel koneksi kabel, kapasitas WAN/CIR, beban kerja, dan hasil audit diagnostik.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Mengekspor & Mengimpor Proyek Topologi (JSON)',
        description: 'Pada TopBar utama, klik tombol ikon Unduh ("Export Topology JSON") untuk menyimpan file proyek ke komputer Anda. Untuk membuka kembali proyek tersebut di lain waktu, klik tombol ikon Unggah ("Import Topology JSON") di sebelahnya.'
      },
      {
        stepNumber: 2,
        title: 'Mengekspor & Mengimpor Skrip Konfigurasi MikroTik (.rsc)',
        description: 'Buka konsol perangkat MikroTik (`>_ CLI` atau `Winbox`), masuk ke tab `Backup & Diff`, lalu klik tombol "Download .rsc" atau "Copy .rsc" untuk menyalin skrip. Anda juga dapat menempelkan skrip `.rsc` ke kotak Import Script untuk menerapkannya ke perangkat.'
      },
      {
        stepNumber: 3,
        title: 'Mengekspor Laporan Dokumentasi Jaringan (Markdown Report)',
        description: 'Klik tombol "Report" (ikon dokumen) pada TopBar utama. Sebuah file `.md` berisi rincian lengkap desain jaringan dan analisis kesehatan topologi akan otomatis terunduh.'
      },
      {
        stepNumber: 4,
        title: 'Mengekspor & Mengimpor Custom Devices',
        description: 'Pada Sidebar kiri di bagian header "Custom Devices", gunakan tombol kecil Export dan Import untuk mencadangkan daftar perangkat kustom Anda.'
      }
    ],
    technicalTables: [
      {
        title: 'Ringkasan Format File Import & Export di NETLAB',
        headers: ['Jenis Data', 'Ekstensi File', 'Lokasi Tombol', 'Dukungan Import / Export'],
        rows: [
          ['Proyek Topologi Lengkap', '`.json`', 'TopBar Header (Ikon Upload / Download)', 'Import & Export Penuh'],
          ['Skrip Konfigurasi RouterOS', '`.rsc`', 'MikroTik Console → Tab Backup & Diff / CLI `/export`', 'Import & Export Skrip'],
          ['Katalog Custom Device', '`.json`', 'Sidebar Kiri → Bagian Custom Devices', 'Import & Export Katalog'],
          ['Laporan Dokumentasi Jaringan', '`.md` (Markdown)', 'TopBar Header → Tombol `Report`', 'Export Dokumentasi']
        ]
      }
    ],
    expectedResults: [
      'Pekerjaan perancangan topologi dapat dilanjutkan kapan saja di perangkat/komputer berbeda menggunakan file JSON proyek.',
      'File `.rsc` yang dihasilkan mengikuti struktur perintah RouterOS yang rapi dan mudah dibaca.'
    ],
    tips: [
      'Selalu lakukan "Export Topology JSON" sebelum menekan tombol "Clear" di TopBar atau sebelum bereksperimen dengan perubahan topologi besar.',
      'Jika Anda ingin menerapkan file `.rsc` dari NETLAB ke router MikroTik fisik, periksa kembali nama interface (`ether1`, `sfp-sfpplus1`) dan alamat IP agar sesuai dengan kondisi perangkat fisik Anda.'
    ],
    commonProblems: [
      {
        problem: 'Gagal mengimpor file JSON proyek.',
        cause: 'File yang dipilih bukan merupakan file JSON hasil ekspor topologi NETLAB (misal salah memilih file JSON custom device di menu import topologi).',
        solution: 'Pastikan file JSON proyek diimpor melalui tombol Import di TopBar, sedangkan file JSON Custom Device diimpor melalui bagian Custom Devices di Sidebar kiri.'
      }
    ],
    relatedGuides: ['configuration-management', 'device-management', 'cli-reference']
  },
  {
    id: 'troubleshooting',
    number: '18',
    title: 'Troubleshooting Guide (13 Skenario Masalah Umum)',
    subtitle: 'Panduan praktis langkah demi langkah mendiagnosis dan memperbaiki 13 masalah jaringan paling sering terjadi.',
    category: 'Troubleshooting & FAQ',
    iconName: 'Wrench',
    description:
      'Ketika koneksi gagal, trafik tidak mengalir, atau muncul peringatan merah di Diagnostics, pendekatan sistematis sangat diperlukan. Bagian ini merangkum 13 skenario masalah jaringan yang paling sering ditemui di NETLAB lengkap dengan gejala, kemungkinan penyebab, cara pemeriksaan, langkah perbaikan, dan hasil yang diharapkan.',
    purpose:
      'Menjadi buku saku pemecahan masalah (Troubleshooting Playbook) yang langsung dapat dipraktikkan pengguna saat merancang dan menguji topologi jaringan.',
    availableFeatures: [
      {
        name: '13 Structured Troubleshooting Scenarios',
        status: 'active',
        description: 'Panduan terstruktur mencakup masalah Layer 1 (Kabel/Port/SFP), Layer 2 (VLAN/Bridge), Layer 3 (IP/Gateway/Route/NAT), hingga Kapasitas (Bandwidth/CIR/Latency/Packet Loss).'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Metodologi Troubleshooting 4 Langkah di NETLAB',
        description: '1) Amati indikator visual pada kanvas (warna port & link) dan buka tab `Diagnostics`.\n2) Gunakan `Packet Tracer` di tab Simulation untuk melihat pada hop ke berapa paket terhenti.\n3) Periksa konfigurasi perangkat pada hop tersebut melalui `Inspector` atau `MikroTik Console`.\n4) Terapkan perbaikan lalu klik `Validate` dan ulangi `Run Trace`.'
      }
    ],
    troubleshootingCards: [
      {
        id: 'ts-1',
        number: 1,
        title: 'Device Tidak Bisa Dihubungkan (Link Tidak Terbentuk)',
        symptom: 'Saat mengklik port pada perangkat pertama lalu mengklik perangkat kedua, garis kabel tidak tersambung atau langsung batal.',
        probableCause: 'Port tujuan sudah terhubung ke kabel lain (satu port fisik hanya bisa menerima 1 kabel), atau klik kedua tidak tepat mengenai kotak port pada faceplate.',
        inspectionMethod: 'Arahkan kursor (hover) ke port tujuan untuk melihat apakah statusnya sudah `Connected` ke perangkat lain.',
        remediationSteps: [
          'Pastikan kanvas berada pada mode Select (V), bukan Pan Mode (H).',
          'Klik tepat pada kotak port sumber yang berstatus Available.',
          'Klik tepat pada kotak port tujuan yang masih kosong (Available) pada Block A (Ethernet) atau Block B (SFP/SFP+).'
        ],
        expectedOutcome: 'Garis koneksi terbentuk di antara kedua port dan status kedua port berubah menjadi Connected.'
      },
      {
        id: 'ts-2',
        number: 2,
        title: 'Port Tidak Aktif (Interface Admin Down / Disabled)',
        symptom: 'Kabel sudah terpasang tetapi garis link berwarna merah putus-putus dan kotak port tampak redup dengan titik indikator merah.',
        probableCause: 'Salah satu atau kedua ujung interface dimatikan secara administratif (`adminStatus = down` atau `disabled=yes` di RouterOS).',
        inspectionMethod: 'Klik perangkat terkait, periksa bagian Interfaces di Inspector kanan, atau jalankan `/interface print` di CLI Console (perhatikan flag `X` artinya disabled).',
        remediationSteps: [
          'Di panel Inspector kanan, ubah tombol status port dari `DOWN` menjadi `UP`.',
          'Atau melalui CLI MikroTik, jalankan perintah `/interface enable <nama-port>` (contoh: `/interface enable ether2`).'
        ],
        expectedOutcome: 'Indikator port berubah menjadi hijau/sian (`Running`), garis kabel menjadi solid, dan trafik dapat melewati link tersebut.'
      },
      {
        id: 'ts-3',
        number: 3,
        title: 'SFP / SFP+ Optical Transceiver Tidak Kompatibel',
        symptom: 'Muncul pesan error/warning di Diagnostics mengenai ketidakcocokan media optik vs tembaga ketika menghubungkan port SFP/SFP+.',
        probableCause: 'Port pada Block B (SFP/SFP+ Optical) dihubungkan langsung ke port pada Block A (Ethernet RJ45 Copper) atau media link disetel ke Copper Cat6 pada koneksi SFP+.',
        inspectionMethod: 'Buka tab Diagnostics atau klik garis link tersebut dan periksa tipe port kedua ujungnya di Inspector.',
        remediationSteps: [
          'Putuskan link yang salah, lalu hubungkan port SFP/SFP+ (Block B) pada perangkat pertama ke port SFP/SFP+ (Block B) pada perangkat kedua.',
          'Pastikan tipe media link di Inspector disetel ke `Fiber Single-Mode` atau `Fiber Multi-Mode`.'
        ],
        expectedOutcome: 'Peringatan media mismatch hilang dan link optik beroperasi pada kecepatan penuh (10 Gbps / 25 Gbps).'
      },
      {
        id: 'ts-4',
        number: 4,
        title: 'IP Address Conflict (Duplikasi Alamat IP)',
        symptom: 'Muncul temuan Critical `Duplicate IP Address Detected` di tab Diagnostics dan komunikasi ke perangkat menjadi tidak konsisten.',
        probableCause: 'Dua atau lebih interface pada perangkat yang sama atau perangkat berbeda menggunakan alamat IPv4 yang persis sama (misal `192.168.1.1/24`).',
        inspectionMethod: 'Klik tombol `Validate` di TopBar dan baca detail temuan Duplicate IP di tab Diagnostics untuk melihat daftar perangkat yang bentrok.',
        remediationSteps: [
          'Pilih salah satu perangkat yang mengalami konflik.',
          'Ubah alamat IP pada Inspector kanan atau melalui Winbox (`IP -> Addresses`) menjadi host ID yang unik di dalam subnet tersebut (misal ubah salah satu menjadi `192.168.1.2/24`).'
        ],
        expectedOutcome: 'Error Duplicate IP hilang dari Diagnostics dan setiap host memiliki identitas Layer 3 yang unik.'
      },
      {
        id: 'ts-5',
        number: 5,
        title: 'Gateway Salah atau Tidak Satu Subnet (Gateway Unreachable)',
        symptom: 'Perangkat klien (PC/Server/AP) tidak dapat melakukan ping ke jaringan lain atau ke internet; Packet Tracer berhenti di hop pertama.',
        probableCause: 'Alamat Default Gateway yang diisi pada perangkat klien tidak berada dalam subnet yang sama dengan IP perangkat klien, atau tidak sesuai dengan IP interface LAN Router.',
        inspectionMethod: 'Klik perangkat klien dan bandingkan `IP Address/CIDR` serta `Default Gateway`-nya dengan IP pada port LAN/Bridge Router.',
        remediationSteps: [
          'Pastikan IP klien (misal `192.168.10.15/24`) berada satu subnet dengan IP LAN Router (misal `192.168.10.1/24`).',
          'Isi kolom Default Gateway pada perangkat klien tepat dengan alamat IP LAN Router (`192.168.10.1`).'
        ],
        expectedOutcome: 'Perangkat klien berhasil meneruskan paket menuju Router gateway pada pengujian Packet Tracer.'
      },
      {
        id: 'ts-6',
        number: 6,
        title: 'VLAN Mismatch (Ketidakcocokan VLAN ID / Mode Trunk)',
        symptom: 'Klien pada VLAN tertentu tidak dapat berkomunikasi melewati Switch ke Router atau ke Switch lain; Packet Tracer menampilkan `L2 VLAN Mismatch`.',
        probableCause: 'Port Access memiliki VLAN ID yang berbeda, atau kabel uplink antar-Switch / Switch-ke-Router masih berstatus `Access` (belum disetel ke mode `Trunk`).',
        inspectionMethod: 'Jalankan Packet Tracer antara PC klien dan Router, lalu periksa konfigurasi mode port (`Access` vs `Trunk`) dan `VLAN ID` pada Switch yang dilewati.',
        remediationSteps: [
          'Pada Switch, setel port yang mengarah ke PC/AP sebagai mode `Access` dengan `VLAN ID` yang sesuai (misal VLAN 10).',
          'Setel port uplink yang menghubungkan Switch ke Switch lain atau ke Router sebagai mode `Trunk`.'
        ],
        expectedOutcome: 'Trafik ber-tag VLAN berhasil melewati jalur Trunk dan diterminasi dengan benar di sub-interface VLAN Router.'
      },
      {
        id: 'ts-7',
        number: 7,
        title: 'Bridge Port Belum Terhubung ke Interface Induk',
        symptom: 'IP Address dan DHCP Server sudah dipasang pada `bridge1` di Router MikroTik, tetapi PC yang dicolokkan ke `ether3` tidak mendapat koneksi.',
        probableCause: 'Interface fisik `ether3` belum dimasukkan sebagai anggota (port member) dari `bridge1` pada menu `/interface bridge port`.',
        inspectionMethod: 'Buka Winbox GUI pada Router → pilih menu `Bridge` → buka tab `Ports`, lalu periksa apakah `ether3` sudah terdaftar di dalam `bridge1`.',
        remediationSteps: [
          'Di menu `Bridge -> Ports`, klik `+ Add`, pilih Interface `ether3` dan Bridge `bridge1`.',
          'Atau jalankan perintah CLI: `/interface bridge port add bridge=bridge1 interface=ether3`.'
        ],
        expectedOutcome: 'Port `ether3` tergabung ke domain broadcast `bridge1` dan klien yang terhubung dapat berkomunikasi dengan gateway bridge.'
      },
      {
        id: 'ts-8',
        number: 8,
        title: 'Routing Belum Tersedia (Missing Default Route / Static Route)',
        symptom: 'Klien dapat melakukan ping ke IP Router, tetapi gagal melakukan ping ke subnet lain atau ke internet (`Destination Network Unreachable`).',
        probableCause: 'Tabel routing (`/ip route`) pada Router belum memiliki Default Route (`0.0.0.0/0`) ke arah gateway ISP atau belum memiliki rute statis menuju subnet di belakang router tetangga.',
        inspectionMethod: 'Buka konsol Router dan jalankan `/ip route print` untuk memeriksa ketersediaan rute menuju jaringan tujuan.',
        remediationSteps: [
          'Untuk akses internet, tambahkan Default Route: `/ip route add dst-address=0.0.0.0/0 gateway=<IP-Gateway-ISP>`.',
          'Untuk jaringan antar-router lokal, tambahkan rute statis menuju subnet tujuan dengan gateway IP router lawan.'
        ],
        expectedOutcome: 'Tabel routing memiliki entri aktif (`AS`) dan router mampu meneruskan paket ke hop berikutnya.'
      },
      {
        id: 'ts-9',
        number: 9,
        title: 'WAN / ISP Belum Dikonfigurasi atau NAT Masquerade Belum Aktif',
        symptom: 'Router sudah terhubung ke node ISP dan memiliki Default Route, tetapi trafik dari jaringan LAN tetap ditolak saat menuju internet.',
        probableCause: 'Alamat IP privat dari jaringan LAN tidak ditranslasikan ke IP publik WAN karena rule Firewall NAT `srcnat masquerade` belum dibuat pada Router.',
        inspectionMethod: 'Buka Winbox GUI → `IP -> Firewall -> NAT` atau jalankan `/ip firewall nat print` untuk melihat apakah ada rule masquerade pada interface WAN.',
        remediationSteps: [
          'Pastikan port yang mengarah ke ISP disetel sebagai mode `WAN` atau menjadi `out-interface` pada rule NAT.',
          'Tambahkan rule NAT via CLI: `/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade`.'
        ],
        expectedOutcome: 'Packet Tracer menampilkan informasi `NAT Masquerade Applied` pada hop Router dan paket berhasil mencapai node ISP/Internet.'
      },
      {
        id: 'ts-10',
        number: 10,
        title: 'Bandwidth Tidak Mencukupi (Link Bottleneck)',
        symptom: 'Utilisasi link pada tab Monitoring mencapai 95%–100% berwarna merah dan throughput klien tertahan di batas kecepatan port.',
        probableCause: 'Total permintaan trafik dari pengguna (Workload Demand) melebihi kapasitas fisik link atau batas kecepatan port (misal uplink 100Mbps atau 1Gbps untuk ratusan pengguna berat).',
        inspectionMethod: 'Buka tab `Monitoring` dan urutkan/periksa tabel Link berdasarkan persentase `Utilization (%)` tertinggi.',
        remediationSteps: [
          'Pindahkan kabel uplink dari port Ethernet 1G ke port optik SFP+ 10G pada perangkat Router dan Switch.',
          'Atau kurangi/atur pembagian bandwidth per subnet menggunakan `/queue simple`.'
        ],
        expectedOutcome: 'Persentase utilisasi link turun ke zona hijau (< 70%) dan throughput tersalurkan tanpa hambatan fisik.'
      },
      {
        id: 'ts-11',
        number: 11,
        title: 'CIR Terlampaui (WAN CIR Commitment Exceeded)',
        symptom: 'Muncul peringatan `CIR Exceeded` pada tab ISP & WAN serta Diagnostics ketika beban kerja jaringan meningkat.',
        probableCause: 'Permintaan trafik internet melewati nilai jaminan minimum `CIR (Mbps)` pada sirkuit Shared Broadband, sehingga koneksi rawan terkena pelambatan (throttling) oleh ISP.',
        inspectionMethod: 'Buka tab `ISP & WAN` dan bandingkan angka `Current Demand` serta `Peak Demand` terhadap nilai `CIR Download/Upload`.',
        remediationSteps: [
          'Tingkatkan nilai CIR pada konfigurasi sirkuit ISP atau beralih ke tipe layanan `Dedicated (1:1)`.',
          'Terapkan manajemen bandwidth (QoS Simple Queue) pada Router untuk membatasi trafik hiburan/unduhan besar.'
        ],
        expectedOutcome: 'Pemakaian bandwidth WAN terjaga di dalam batas aman komitmen SLA CIR.'
      },
      {
        id: 'ts-12',
        number: 12,
        title: 'Latency Tinggi (High End-to-End Latency / Bufferbloat)',
        symptom: 'Waktu tempuh paket (RTT) pada Monitoring dan Packet Tracer melonjak di atas 80–150 ms.',
        probableCause: 'Terjadi antrean panjang akibat saturasi link (> 90%), status sirkuit ISP disetel ke `DEGRADED`, atau rasio contention broadband terlalu tinggi (misal 1:32) saat jam sibuk.',
        inspectionMethod: 'Periksa latency per-hop di `Packet Tracer` untuk melihat pada segmen kabel atau sirkuit ISP mana lonjakan latency terjadi.',
        remediationSteps: [
          'Jika terjadi pada hop WAN, periksa status kesehatan sirkuit di tab `ISP & WAN` (pastikan berstatus `UP`, bukan `DEGRADED`) dan perbaiki rasio contention.',
          'Jika terjadi pada link lokal, periksa apakah ada tambahan latency manual pada properti link di Inspector atau kemacetan bandwidth.'
        ],
        expectedOutcome: 'Latency kembali stabil ke nilai dasar normal (< 5 ms untuk LAN, 10–25 ms untuk WAN).'
      },
      {
        id: 'ts-13',
        number: 13,
        title: 'Packet Loss Tinggi atau Paket Diblokir Firewall',
        symptom: 'Trafik mengalami kehilangan paket (> 1%) di Monitoring atau Packet Tracer langsung berhenti dengan status `DROPPED by Firewall`.',
        probableCause: 'Untuk Packet Loss parsial: kapasitas link/ISP mengalami kejenuhan ekstrem (> 100%). Untuk Drop total: terdapat rule `/ip firewall filter` dengan `action=drop` atau `reject` yang mencocokkan trafik tersebut.',
        inspectionMethod: 'Jalankan Packet Tracer untuk melihat apakah paket di-drop oleh rule Firewall tertentu, dan periksa tab `IP -> Firewall -> Filter` di Winbox GUI.',
        remediationSteps: [
          'Jika terblokir oleh Firewall yang tidak disengaja, nonaktifkan (`Disable`) atau hapus rule filter drop tersebut di Winbox/CLI.',
          'Jika disebabkan oleh kongesti 100%, naikkan kapasitas bandwidth link/ISP atau kurangi beban Workload.'
        ],
        expectedOutcome: 'Packet loss turun menjadi 0% dan paket yang sah diizinkan melewati router.'
      }
    ],
    expectedResults: [
      'Setiap permasalahan jaringan dapat diisolasi secara cepat berdasarkan lapisan OSI (L1, L2, L3, atau Kapasitas WAN).',
      'Pengguna terbiasa menggunakan kombinasi Diagnostics, Packet Tracer, dan Monitoring untuk memverifikasi perbaikan.'
    ],
    tips: [
      'Gunakan fitur pencarian (Search) di bagian atas modal User Guide ini untuk langsung melompat ke skenario masalah yang sedang Anda hadapi (misal ketik "VLAN", "CIR", atau "NAT").'
    ],
    commonProblems: [],
    relatedGuides: ['diagnostics', 'network-simulation', 'bandwidth-cir', 'mikrotik-console']
  },
  {
    id: 'faq',
    number: '19',
    title: 'FAQ & Simulator Limitations',
    subtitle: 'Jawaban atas pertanyaan yang sering diajukan dan penjelasan transparan mengenai batasan simulator dibanding perangkat fisik.',
    category: 'Troubleshooting & FAQ',
    iconName: 'HelpCircle',
    description:
      'Bagian ini menjawab pertanyaan umum seputar penggunaan NETLAB sekaligus menjelaskan secara jujur dan transparan perbedaan antara lingkungan simulasi NETLAB dengan perangkat keras jaringan fisik di dunia nyata.',
    purpose:
      'Menetapkan ekspektasi teknis yang tepat bagi mahasiswa, pengajar, maupun praktisi jaringan dalam memanfaatkan NETLAB sebagai alat bantu perancangan, pembelajaran, dan validasi arsitektur.',
    availableFeatures: [
      {
        name: 'Frequently Asked Questions (FAQ)',
        status: 'active',
        description: 'Kumpulan tanya-jawab praktis mengenai penyimpanan data, penggunaan fitur, dan kompatibilitas perangkat.'
      },
      {
        name: 'Simulator vs Physical Hardware Transparency Matrix',
        status: 'active',
        description: 'Rincian transparan mengenai apa yang disimulasikan secara penuh, apa yang dimodelkan secara matematis, dan apa yang berada di luar cakupan simulator.'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Memahami Cakupan Simulasi NETLAB',
        description: 'Gunakan NETLAB untuk: (1) Merancang topologi fisik hingga akurasi port Ethernet vs SFP+, (2) Merencanakan alokasi VLAN, Subnetting IP, dan Routing, (3) Mempraktikkan sintaks CLI & Winbox MikroTik RouterOS, (4) Menghitung kecukupan Bandwidth & CIR ISP terhadap beban pengguna, dan (5) Menghasilkan skrip awal `.rsc` serta dokumentasi laporan.'
      }
    ],
    faqItems: [
      {
        question: 'Apakah konfigurasi MikroTik di NETLAB terhubung langsung ke router MikroTik fisik saya?',
        answer: 'Tidak. Seluruh konfigurasi CLI dan Winbox di dalam NETLAB berjalan di dalam engine simulasi memori browser (sandboxed). Perubahan yang Anda buat tidak akan memengaruhi jaringan komputer lokal Anda. Namun, Anda dapat mengekspor hasilnya sebagai file skrip `.rsc` untuk diimpor ke perangkat MikroTik fisik.',
        category: 'Simulasi & Perangkat Keras'
      },
      {
        question: 'Bagaimana perbedaan utama antara blok port Ethernet (Block A) dan SFP/SFP+ (Block B) pada kartu perangkat?',
        answer: 'Block A menampilkan seluruh port tembaga RJ45 (`ether1`, `ether2`, dst.) sedangkan Block B menampilkan seluruh port optik (`sfp1`, `sfp-sfpplus1`, `qsfpplus1`, dst.) secara terpisah. Masing-masing blok disusun maksimal 2 baris ke samping dan lebar kartu perangkat otomatis menyesuaikan jumlah port yang dimiliki.',
        category: 'Topologi & Faceplate'
      },
      {
        question: 'Apakah pekerjaan saya akan hilang jika halaman browser di-refresh?',
        answer: 'Custom Device yang Anda buat otomatis tersimpan di `localStorage` browser. Untuk proyek topologi dan konfigurasi router yang sedang dikerjakan, sangat disarankan menggunakan tombol "Export Topology JSON" di TopBar untuk menyimpan file proyek ke komputer Anda agar dapat dimuat kembali kapan saja.',
        category: 'Penyimpanan & File'
      },
      {
        question: 'Mengapa hasil throughput efektif pada ISP Shared Broadband bisa turun saat jumlah user dinaikkan?',
        answer: 'Karena NETLAB menghitung efek Contention Ratio (misal 1:8) dan batas lantai CIR (Committed Information Rate). Ketika jumlah pengguna aktif melebihi rasio bagi pakai, bandwidth efektif yang diterima akan turun dari angka maksimum "Up To" menuju angka jaminan minimum CIR.',
        category: 'WAN, Bandwidth & CIR'
      },
      {
        question: 'Apakah semua perintah RouterOS di dunia nyata bisa dijalankan di terminal CLI NETLAB?',
        answer: 'Tidak semuanya. NETLAB mendukung perintah-perintah inti yang paling sering digunakan dalam perancangan jaringan (`/interface`, `bridge`, `vlan`, `/ip address`, `pool`, `dhcp-server`, `route`, `dns`, `firewall filter/nat`, `/queue simple`, `/system`, `/tool ping/traceroute`, `/export`). Fitur lanjutan seperti MPLS, BGP full-table, IPsec tunnel kriptografi, atau Hotspot HTML customization belum dieksekusi oleh simulator.',
        category: 'MikroTik Console & CLI'
      },
      {
        question: 'Bagaimana cara menampilkan kanvas secara layar penuh (Full Screen Canvas)?',
        answer: 'Anda dapat mengklik tombol lipat (Hide Sidebar) di tepi kiri atas kanvas, mengklik tombol lipat (Hide Inspector) di tepi kanan atas kanvas, serta melipat (Collapse) Bottom Panel di bagian bawah layar.',
        category: 'Workspace & Navigasi'
      }
    ],
    technicalTables: [
      {
        title: 'Batasan Simulator Dibandingkan Jaringan & Perangkat Fisik',
        headers: ['Aspek Jaringan', 'Di Perangkat Keras Fisik', 'Di Simulator NETLAB'],
        rows: [
          ['Pemrosesan Paket (Data Plane)', 'Meneruskan paket byte-demi-byte melalui ASIC switch atau kernel Linux/RouterOS', 'Mengevaluasi jalur paket secara logis (hop-by-hop state evaluation) dan menghitung aliran trafik menggunakan model matematis diskrit'],
          ['Cakupan Perintah RouterOS', 'Seluruh paket sub-menu RouterOS v6/v7 sesuai arsitektur lisensi', 'Mendukung subset perintah esensial L2/L3/Firewall/QoS/System seperti tercantum pada bagian CLI Reference'],
          ['Sinyal Fisik & Wireless RF', 'Dipengaruhi redaman dB kabel fiber, kualitas konektor, dan interferensi frekuensi radio', 'Memodelkan kompatibilitas tipe konektor, batas panjang kabel standar, dan kapasitas agregat klien per Access Point'],
          ['Keamanan & Isolasi', 'Kesalahan konfigurasi dapat memutus akses manajemen (lockout) ke perangkat nyata', 'Bebas risiko lockout: Anda selalu dapat membuka kembali konsol, melihat Diff, atau melakukan Restore Snapshot satu klik']
        ]
      }
    ],
    expectedResults: [
      'Pengguna dapat memanfaatkan kekuatan simulasi NETLAB secara maksimal sambil memahami batasan teknisnya sebelum implementasi di lapangan.'
    ],
    tips: [
      'Gunakan NETLAB sebagai tahap "Pre-Deployment Design & Validation" sebelum Anda membeli perangkat keras atau berlangganan kapasitas sirkuit ISP.'
    ],
    commonProblems: [],
    relatedGuides: ['getting-started', 'cli-reference', 'network-simulation', 'troubleshooting']
  }
];
