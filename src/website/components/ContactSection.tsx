import React, { useState } from 'react';
import {
  Globe,
  BookOpen,
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
  Send,
} from 'lucide-react';
import {
  APP_CONFIG,
  WebsiteSectionId,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

interface ContactSectionProps {
  onSelectSection: (section: WebsiteSectionId, path: string) => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  onSelectSection,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Pertanyaan Umum & Produk');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitted(true);
  };

  return (
    <section
      id="contact"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Project Channels & Domain Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                CONTACT &amp; PROJECT INFORMATION
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Informasi Proyek &amp; Saluran Komunikasi
              </h2>
              <p className="text-base text-slate-300 leading-relaxed">
                Memiliki pertanyaan teknis mengenai pemodelan topologi, kompatibilitas konfigurasi
                RouterOS, atau masukan pengembangan fitur {APP_CONFIG.brandName}? Gunakan saluran
                resmi proyek atau kirimkan pesan melalui formulir di samping.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start gap-3.5">
                <Globe className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">
                    Arsitektur Dua Domain {APP_CONFIG.brandName}
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Website Resmi:{' '}
                    <span className="text-cyan-400">{APP_CONFIG.mainDomain}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Aplikasi Simulator:{' '}
                    <span className="text-emerald-400">
                      {APP_CONFIG.applicationDomain}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start gap-3.5">
                <BookOpen className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white">
                    Pusat Dokumentasi &amp; User Guide
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pelajari langkah penggunaan setiap modul melalui halaman{' '}
                    <button
                      type="button"
                      onClick={() => onSelectSection('docs', '/docs')}
                      className="text-cyan-400 hover:underline font-medium"
                    >
                      Documentation Overview
                    </button>{' '}
                    atau buka User Guide interaktif di dalam Workspace.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex items-start gap-3.5">
                <MessageSquare className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <div className="text-sm font-bold text-white">
                    Akses Langsung Lingkungan Simulator
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Buka {APP_CONFIG.applicationName} untuk mulai merancang topologi dan menjalankan
                    simulasi jaringan tanpa perlu instalasi perangkat lunak tambahan.
                  </p>
                  <a
                    href={getWorkspaceLaunchUrl()}
                    onClick={handleLaunchWorkspace}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    <span>Launch {APP_CONFIG.applicationName}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Validated Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-xl border border-slate-800 bg-slate-900/80">
              {submitted ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Pesan Anda Telah Diterima
                  </h3>
                  <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Terima kasih, <span className="text-white font-semibold">{name}</span>.
                    Catatan Anda mengenai <span className="text-cyan-400">{topic}</span> telah
                    dicatat pada saluran komunikasi proyek {APP_CONFIG.brandName}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setName('');
                      setEmail('');
                      setMessage('');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800 text-xs font-semibold text-slate-200"
                  >
                    Kirim Pesan Lainnya
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="border-b border-slate-800 pb-4">
                    <h3 className="text-lg font-bold text-white">
                      Kirim Pesan atau Diskusi Teknis
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Gunakan formulir ini untuk menyampaikan pertanyaan produk, laporan skenario
                      topologi, atau saran pengembangan.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama Anda"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@institusi.id"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Topik Pembahasan
                    </label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Pertanyaan Umum & Produk">
                        Pertanyaan Umum &amp; Produk
                      </option>
                      <option value="Perancangan Topologi & Simulasi">
                        Perancangan Topologi &amp; Simulasi
                      </option>
                      <option value="Konfigurasi MikroTik RouterOS (.rsc)">
                        Konfigurasi MikroTik RouterOS (.rsc)
                      </option>
                      <option value="Penggunaan Akademik / Laboratorium">
                        Penggunaan Akademik / Laboratorium
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Pesan / Detail Pertanyaan
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tuliskan skenario jaringan atau pertanyaan Anda..."
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>Kirim Pesan</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
