"use client";

import { useMemo, useState, useTransition } from "react";
import {
  calculateServiceFromDates,
  calculateIhbarTazminati,
  calculateIssizlikMaasiFromFourMonths,
  calculateKidemTazminatiForPeriod,
  getExitYearAndPeriod,
  YEAR_OPTIONS,
  getYearReference,
} from "@/lib/payroll";

const exampleHeaders = [["PERSONEL", "MAAS"], ["Ali Yilmaz", "50.000"], ["Ayse Kaya", "42.000"]];

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function normalizeNumericInput(value) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function formatNumericInput(value) {
  const normalized = normalizeNumericInput(value);
  if (!normalized) return "";
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Number(normalized));
}

function ResultCard({ title, rows }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-6">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">{row.label}</span>
            <span className="text-right text-sm font-semibold text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [mode, setMode] = useState("normal");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  const [giydirilmisBrut, setGiydirilmisBrut] = useState("0");
  const [kidemGiris, setKidemGiris] = useState("");
  const [kidemCikis, setKidemCikis] = useState("");

  const [ihbarGiris, setIhbarGiris] = useState("");
  const [ihbarCikis, setIhbarCikis] = useState("");
  const [ihbarCumulative, setIhbarCumulative] = useState("0");

  const [issizlikYear, setIssizlikYear] = useState("");
  const [issizlikAy1, setIssizlikAy1] = useState("");
  const [issizlikAy2, setIssizlikAy2] = useState("");
  const [issizlikAy3, setIssizlikAy3] = useState("");
  const [issizlikAy4, setIssizlikAy4] = useState("");
  const [issizlikPrim, setIssizlikPrim] = useState("");

  const kidemService = useMemo(
    () => calculateServiceFromDates(kidemGiris, kidemCikis),
    [kidemCikis, kidemGiris],
  );

  const ihbarService = useMemo(
    () => calculateServiceFromDates(ihbarGiris, ihbarCikis),
    [ihbarCikis, ihbarGiris],
  );

  const kidemExitInfo = useMemo(() => getExitYearAndPeriod(kidemCikis), [kidemCikis]);
  const ihbarExitInfo = useMemo(() => getExitYearAndPeriod(ihbarCikis), [ihbarCikis]);

  const kidemResult = useMemo(
    () =>
      calculateKidemTazminatiForPeriod({
        brutUcret: giydirilmisBrut,
        yil: kidemService.years,
        ay: kidemService.months,
        gun: kidemService.days,
        year: Number(kidemExitInfo.year),
        period: kidemExitInfo.period,
      }),
    [giydirilmisBrut, kidemExitInfo.period, kidemExitInfo.year, kidemService.days, kidemService.months, kidemService.years],
  );

  const ihbarResult = useMemo(
    () =>
      calculateIhbarTazminati({
        brutUcret: giydirilmisBrut,
        gun: ihbarService.totalDays,
        cumulativeTaxBase: ihbarCumulative,
        year: Number(ihbarExitInfo.year),
      }),
    [giydirilmisBrut, ihbarCumulative, ihbarExitInfo.year, ihbarService.totalDays],
  );

  const issizlikResult = useMemo(
    () =>
      calculateIssizlikMaasiFromFourMonths({
        month1: issizlikAy1,
        month2: issizlikAy2,
        month3: issizlikAy3,
        month4: issizlikAy4,
        premiumDays: issizlikPrim,
        year: Number(issizlikYear),
      }),
    [issizlikAy1, issizlikAy2, issizlikAy3, issizlikAy4, issizlikPrim, issizlikYear],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!file) {
      setError("Once bir Excel dosyasi secin.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const response = await fetch("/api/calculate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Hesaplama yapilamadi.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = mode === "sgdp" ? "sgdp_maas_maliyeti.xlsx" : "maas_maliyeti.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Excel hazirlandi. Indirme baslatildi.");
    });
  };

  const kidemReference = getYearReference(Number(kidemExitInfo.year));
  const issizlikReference = getYearReference(Number(issizlikYear));
  const toplamTazminatAlacagi = (kidemResult.netTazminat || 0) + (ihbarResult.netTazminat || 0);

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="shadow-soft overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-[var(--line)] p-8 lg:border-b-0 lg:border-r lg:p-12">
              <div className="mb-6 inline-flex rounded-full border border-amber-300/60 bg-amber-100 px-4 py-1 text-sm font-medium text-amber-900">
                Excel yukle, hesapla, yeni Excel indir
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                Maas maliyeti, kidem, ihbar ve issizlik maasi hesaplayan Next.js araci
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
                Personel Exceli yukleyin veya alttaki canli modullerde tekil hesap yapin. Toplu
                maas maliyeti Excel olarak geri doner; kidem, ihbar ve issizlik maasi ekranlari
                ise yil bazli olarak aninda sonuc verir.
              </p>

              <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="rounded-2xl border border-[var(--line)] bg-white/80 p-5">
                    <div className="text-sm font-semibold text-slate-900">Hesap tipi</div>
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none"
                    >
                      <option value="normal">Normal calisan</option>
                      <option value="sgdp">SGDP calisan</option>
                    </select>
                  </label>

                  <label className="rounded-2xl border border-[var(--line)] bg-white/80 p-5">
                    <div className="text-sm font-semibold text-slate-900">Excel dosyasi</div>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-[var(--primary)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Hesaplaniyor..." : "Hesapla ve Excel indir"}
                </button>

                {error ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </p>
                ) : null}
              </form>
            </div>

            <aside className="bg-slate-950 p-8 text-slate-100 lg:p-12">
              <h2 className="text-2xl font-semibold">Beklenen Excel duzeni</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Ilk iki sutun yeterli: `personel` ve `maas`. Maas net tutar olarak yazilmali.
              </p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {exampleHeaders.map((row, index) => (
                      <tr key={index} className={index === 0 ? "bg-white/10" : "bg-white/5"}>
                        {row.map((cell) => (
                          <td key={cell} className="border-b border-white/10 px-4 py-3">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Toplu maliyet export</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Yuklenen Excel icin aylik toplam isveren maliyeti ve detay sayfasi uretir.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Yila gore canli hesaplar</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Kidem ve ihbar cikis tarihine gore otomatik yil bulur. Issizlik maasinda yil
                    secimi manuel kalir.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-100/10 p-4">
                  <div className="text-sm font-semibold text-amber-100">Uyari</div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>- Hesaplamalarda Turk Lirasi esas alinmistir.</li>
                    <li>- Hesaplanan tutarlar bilgi amacli olup, kesin bordro olarak gosterilemez.</li>
                    <li>- Yapilan maas hesaplamalari ile ilgili olarak kesin bordro islemlerinde uzman veya danisman bilgisine basvurulmasini tavsiye ederiz.</li>
                    <li>- Hesaplama farkliliklarindan kaynakli olusabilecek hata ve eksikliklerden Hizir Albayrak sorumlu tutulamaz.</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-3xl border border-slate-200 bg-white/75 p-6">
                <h2 className="text-2xl font-semibold text-slate-900">Kidem ve Ihbar Tazminati</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Kidem ve ihbar hesabini tek alanda yapin. Ortak giris-cikis tarihleriyle calisir;
                  kidem cikis tarihine gore tavan donemini otomatik bulur, ihbar ise toplam hizmet
                  gunune gore sureyi korur.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Giydirilmis brut ucret</div>
                    <input
                      inputMode="numeric"
                      value={formatNumericInput(giydirilmisBrut)}
                      onChange={(event) => setGiydirilmisBrut(normalizeNumericInput(event.target.value))}
                      className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ise giris tarihi</div>
                    <input
                      type="date"
                      lang="tr"
                      placeholder="GG.AA.YY"
                      value={kidemGiris}
                      onChange={(event) => {
                        setKidemGiris(event.target.value);
                        setIhbarGiris(event.target.value);
                      }}
                      className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Isten cikis tarihi</div>
                    <input
                      type="date"
                      lang="tr"
                      placeholder="GG.AA.YY"
                      value={kidemCikis}
                      onChange={(event) => {
                        setKidemCikis(event.target.value);
                        setIhbarCikis(event.target.value);
                      }}
                      className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mevcut kumulatif vergi matrahi</div>
                    <input
                      inputMode="numeric"
                      value={formatNumericInput(ihbarCumulative)}
                      onChange={(event) => setIhbarCumulative(normalizeNumericInput(event.target.value))}
                      className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Tarih secimi takvimden yapilir. Format: GG.AA.YY
                </p>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5">
                    <div className="text-sm font-semibold text-amber-900">Kidem bilgisi</div>
                    <p className="mt-2 text-sm leading-6 text-amber-950/80">
                      Hizmet suresi: {kidemService.valid ? `${kidemService.years} yil ${kidemService.months} ay ${kidemService.days} gun` : "Gecerli tarih araligi girin"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-950/80">
                      Otomatik donem: {kidemExitInfo.year} {kidemExitInfo.period === "h1" ? "Ocak-Haziran" : "Temmuz-Aralik"} | Kidem tavani: {formatMoney(kidemReference.kidemTavan[kidemExitInfo.period])} TL
                    </p>
                  </div>

                  <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-5">
                    <div className="text-sm font-semibold text-sky-900">Ihbar bilgisi</div>
                    <p className="mt-2 text-sm leading-6 text-sky-950/80">
                      Toplam hizmet gunu: {ihbarService.valid ? `${ihbarService.totalDays} gun` : "Gecerli tarih araligi girin"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-sky-950/80">
                      Ihbar vergi yili cikis tarihinden otomatik gelir: {ihbarExitInfo.year}
                    </p>
                  </div>
                </div>
              </div>

              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <ResultCard
                      title="Kidem Ozeti"
                      rows={[
                        { label: "Esas brut ucret", value: `${formatMoney(kidemResult.esasBrutUcret)} TL` },
                        { label: "Tavan sonrasi esas ucret", value: `${formatMoney(kidemResult.tavanUygulananBrut)} TL` },
                        { label: "Toplam hizmet suresi", value: `${kidemService.years || 0} yil ${kidemService.months || 0} ay ${kidemService.days || 0} gun` },
                        { label: "Brut kidem", value: `${formatMoney(kidemResult.brutTazminat)} TL` },
                        { label: "Damga vergisi", value: `${formatMoney(kidemResult.damgaVergisi)} TL` },
                        { label: "Net kidem", value: `${formatMoney(kidemResult.netTazminat)} TL` },
                      ]}
                    />

                    <ResultCard
                      title="Ihbar Ozeti"
                      rows={[
                        { label: "Toplam hizmet gunu", value: `${ihbarService.totalDays || 0} gun` },
                        { label: "Ihbar suresi", value: `${ihbarResult.ihbarHaftasi} hafta / ${ihbarResult.ihbarGunu} gun` },
                        { label: "Brut ihbar", value: `${formatMoney(ihbarResult.brutTazminat)} TL` },
                        { label: "Gelir vergisi orani", value: `%${(ihbarResult.uygulananVergiOrani * 100).toFixed(0)}` },
                        { label: "Gelir vergisi", value: `${formatMoney(ihbarResult.gelirVergisi)} TL` },
                        { label: "Damga vergisi", value: `${formatMoney(ihbarResult.damgaVergisi)} TL` },
                        { label: "Net ihbar", value: `${formatMoney(ihbarResult.netTazminat)} TL` },
                      ]}
                    />
                  </div>

                  <div className="rounded-3xl border border-[var(--line)] bg-slate-950 p-6 text-white">
                    <div className="text-sm font-medium text-slate-300">Genel Toplam</div>
                    <div className="mt-3 text-right text-4xl font-semibold tracking-tight">{formatMoney(toplamTazminatAlacagi)} TL</div>
                    <p className="mt-3 text-right text-sm leading-6 text-slate-300">
                      Net kidem + net ihbar toplamidir.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-soft">
            <h2 className="text-2xl font-semibold text-slate-900">Issizlik Maası</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              4447 sayili Kanun m.50 mantigiyla; son 4 ay ortalama brut kazancin %40&apos;i esas
              alinir, aylik brut asgari ucretin %80&apos;i ust sinirdir. Hak suresi prim gunune gore belirlenir.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Yil</div>
                <select
                  value={issizlikYear}
                  onChange={(event) => setIssizlikYear(event.target.value === "" ? "" : Number(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                >
                  <option value="">Secin</option>
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. ay brut</div>
                <input
                  inputMode="numeric"
                  value={formatNumericInput(issizlikAy1)}
                  onChange={(event) => setIssizlikAy1(normalizeNumericInput(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. ay brut</div>
                <input
                  inputMode="numeric"
                  value={formatNumericInput(issizlikAy2)}
                  onChange={(event) => setIssizlikAy2(normalizeNumericInput(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. ay brut</div>
                <input
                  inputMode="numeric"
                  value={formatNumericInput(issizlikAy3)}
                  onChange={(event) => setIssizlikAy3(normalizeNumericInput(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">4. ay brut</div>
                <input
                  inputMode="numeric"
                  value={formatNumericInput(issizlikAy4)}
                  onChange={(event) => setIssizlikAy4(normalizeNumericInput(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Son 3 yildaki issizlik primi gunu</div>
                <input
                  inputMode="numeric"
                  value={formatNumericInput(issizlikPrim)}
                  onChange={(event) => setIssizlikPrim(normalizeNumericInput(event.target.value))}
                  className="mt-2 w-full bg-transparent text-slate-900 outline-none"
                />
              </label>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {issizlikYear} brut asgari ucret: {formatMoney(issizlikReference.brutAsgariUcret)} TL,
              issizlik maasi ust siniri: {formatMoney(issizlikReference.brutAsgariUcret * 0.8)} TL
            </p>

            <div className="mt-6">
              <ResultCard
                title="Sonuc"
                rows={[
                  { label: "4 ay ortalama brut", value: `${formatMoney(issizlikResult.ortalamaBrut)} TL` },
                  { label: "Hesaplanan odeme", value: `${formatMoney(issizlikResult.hesaplananOdeme)} TL` },
                  { label: "Yasal ust sinir", value: `${formatMoney(issizlikResult.ustSinir)} TL` },
                  { label: "Aylik issizlik maasi", value: `${formatMoney(issizlikResult.aylikIssizlikMaasi)} TL` },
                  { label: "Hak suresi", value: `${issizlikResult.hakSuresiGun} gun / ${formatMoney(issizlikResult.hakSuresiAy)} ay` },
                ]}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
