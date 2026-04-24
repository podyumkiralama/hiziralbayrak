import * as XLSX from "xlsx";

const MONTHS = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
];

const THRESHOLDS = [190000, 400000, 1500000, 5300000, Number.POSITIVE_INFINITY];
const RATES = [0.15, 0.2, 0.27, 0.35, 0.4];
export const KIDEM_TAVANI_2026_H1 = 64948.77;
export const DAMGA_VERGISI_ORANI_2026 = 0.00759;
export const BRUT_ASGARI_UCRET_2026 = 33030;
export const YEAR_OPTIONS = [2024, 2025, 2026];

const YEARLY_REFERENCE = {
  2024: {
    brutAsgariUcret: 20002.5,
    kidemTavan: {
      h1: 35058.58,
      h2: 41528.46,
    },
    incomeTaxThresholds: [110000, 230000, 870000, 3000000, Number.POSITIVE_INFINITY],
  },
  2025: {
    brutAsgariUcret: 26005.5,
    kidemTavan: {
      h1: 46655.43,
      h2: 53919.68,
    },
    incomeTaxThresholds: [158000, 330000, 1200000, 4300000, Number.POSITIVE_INFINITY],
  },
  2026: {
    brutAsgariUcret: 33030,
    kidemTavan: {
      h1: 64948.77,
      h2: 64948.77,
    },
    incomeTaxThresholds: [190000, 400000, 1500000, 5300000, Number.POSITIVE_INFINITY],
  },
};

const CONFIGS = {
  normal: {
    label: "Normal Calisan",
    note: "Varsayim: bekar, esi calismiyor, 0 cocuk, 5 puanlik isveren primi indirimi uygulanir.",
    exemptions: [4462.03, 4462.03, 4462.03, 4462.03, 4462.03, 4462.03, 4788.45, 5865.8, 5865.8, 5865.8, 5865.8, 5865.8],
    taxBaseFactor: 0.85,
    costFactor: 1.1875,
    netFactor: 0.991070588235294,
  },
  sgdp: {
    label: "SGDP Calisan",
    note: "Varsayim: emekli calisan (SGDP), bekar, esi calismiyor, 0 cocuk.",
    exemptions: [4462.03, 4462.03, 4462.03, 4462.03, 4462.03, 4462.03, 4788.45, 5865.8, 5865.8, 5865.8, 5865.8, 5865.8],
    taxBaseFactor: 0.925,
    costFactor: 1.2475,
    netFactor: 0.991794594594595,
  },
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundCurrency(value) {
  return round2(value ?? 0);
}

function normalizeNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getExitYearAndPeriod(cikisTarihi) {
  const exitDate = parseDate(cikisTarihi);
  if (!exitDate) {
    return {
      year: 2026,
      period: "h1",
    };
  }

  return {
    year: exitDate.getFullYear(),
    period: exitDate.getMonth() < 6 ? "h1" : "h2",
  };
}

export function calculateServiceFromDates(girisTarihi, cikisTarihi) {
  const start = parseDate(girisTarihi);
  const end = parseDate(cikisTarihi);

  if (!start || !end || end < start) {
    return {
      valid: false,
      totalDays: 0,
      totalMonths: 0,
      totalYearsDecimal: 0,
      years: 0,
      months: 0,
      days: 0,
    };
  }

  const diffMs = end.getTime() - start.getTime();
  const totalDays = Math.floor(diffMs / 86400000) + 1;
  const adjustedEnd = new Date(end);
  adjustedEnd.setDate(adjustedEnd.getDate() + 1);

  let years = adjustedEnd.getFullYear() - start.getFullYear();
  let months = adjustedEnd.getMonth() - start.getMonth();
  let days = adjustedEnd.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonthLastDay = new Date(adjustedEnd.getFullYear(), adjustedEnd.getMonth(), 0).getDate();
    days += previousMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months + days / 30;
  const totalYearsDecimal = years + months / 12 + days / 365;

  return {
    valid: true,
    totalDays,
    totalMonths,
    totalYearsDecimal,
    years,
    months,
    days,
  };
}

function calculateTaxBaseFromNet(netSalary, previousCumulative, exemption, netFactor) {
  let cumulativeNetCap = exemption;
  const tierBases = [];

  for (let i = 0; i < RATES.length; i += 1) {
    const lower = i === 0 ? 0 : THRESHOLDS[i - 1];
    const upper = THRESHOLDS[i];
    const available = Math.max(0, upper - Math.max(previousCumulative, lower));
    tierBases.push(available);
    cumulativeNetCap += available * (netFactor - RATES[i]);
    if (netSalary <= cumulativeNetCap) {
      const previousCap =
        i === 0
          ? exemption
          : exemption +
            tierBases.slice(0, i).reduce((sum, item, index) => sum + item * (netFactor - RATES[index]), 0);
      const taxBaseBefore = tierBases.slice(0, i).reduce((sum, item) => sum + item, 0);
      return round2(taxBaseBefore + (netSalary - previousCap) / (netFactor - RATES[i]));
    }
  }

  return round2(
    tierBases.reduce((sum, item) => sum + item, 0) +
      (netSalary - cumulativeNetCap) / (netFactor - RATES[RATES.length - 1]),
  );
}

function calculateYear(netSalary, config) {
  const rows = [];
  let cumulativeTaxBase = 0;

  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    const taxBase = calculateTaxBaseFromNet(
      netSalary,
      cumulativeTaxBase,
      config.exemptions[monthIndex],
      config.netFactor,
    );
    cumulativeTaxBase = round2(cumulativeTaxBase + taxBase);
    const totalCost = round2(round2(taxBase / config.taxBaseFactor) * config.costFactor);

    rows.push({
      ay: MONTHS[monthIndex],
      netMaas: round2(netSalary),
      vergiMatrahi: taxBase,
      toplamMaliyet: totalCost,
      kumulatifMatrah: cumulativeTaxBase,
    });
  }

  return rows;
}

export function parsePersonnelWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  return rows
    .slice(1)
    .map((row) => ({
      personel: row[0] ? String(row[0]).trim() : "",
      maas: normalizeNumber(row[1]),
    }))
    .filter((row) => row.personel && row.maas);
}

export function buildResultWorkbook(personnel, mode) {
  const config = CONFIGS[mode] ?? CONFIGS.normal;
  const workbook = XLSX.utils.book_new();
  const outputRows = [
    ["Tip", config.label],
    ["Not", config.note],
    [],
    ["Personel", "Net Maas", ...MONTHS, "Yillik Toplam Maliyet"],
  ];

  const detailRows = [["Personel", "Ay", "Net Maas", "Vergi Matrahi", "Kumulatif Matrah", "Toplam Maliyet"]];

  for (const person of personnel) {
    const months = calculateYear(person.maas, config);
    const yearlyTotal = round2(months.reduce((sum, item) => sum + item.toplamMaliyet, 0));

    outputRows.push([
      person.personel,
      round2(person.maas),
      ...months.map((item) => item.toplamMaliyet),
      yearlyTotal,
    ]);

    for (const item of months) {
      detailRows.push([
        person.personel,
        item.ay,
        item.netMaas,
        item.vergiMatrahi,
        item.kumulatifMatrah,
        item.toplamMaliyet,
      ]);
    }
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(outputRows);
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);

  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    ...MONTHS.map(() => ({ wch: 14 })),
    { wch: 18 },
  ];
  detailSheet["!cols"] = [
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Sonuc");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detay");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function calculateKidemTazminati({ brutUcret, yil = 0, ay = 0, gun = 0, tavan = KIDEM_TAVANI_2026_H1 }) {
  const grossSalary = normalizeNumber(brutUcret) ?? 0;
  const cappedSalary = Math.min(grossSalary, tavan);
  const totalServiceYears = (Number(yil) || 0) + (Number(ay) || 0) / 12 + (Number(gun) || 0) / 365;
  const brutTazminat = round2(cappedSalary * totalServiceYears);
  const damgaVergisi = round2(brutTazminat * DAMGA_VERGISI_ORANI_2026);

  return {
    esasBrutUcret: round2(grossSalary),
    tavanUygulananBrut: round2(cappedSalary),
    toplamHizmetYili: round2(totalServiceYears),
    brutTazminat,
    damgaVergisi,
    netTazminat: round2(brutTazminat - damgaVergisi),
  };
}

export function getIhbarWeeks(totalMonths) {
  if (totalMonths < 6) return 2;
  if (totalMonths < 18) return 4;
  if (totalMonths < 36) return 6;
  return 8;
}

export function getTaxRateForBase(cumulativeBase) {
  return getTaxRateForYear(cumulativeBase, 2026);
}

export function getTaxRateForYear(cumulativeBase, year = 2026) {
  const thresholds = YEARLY_REFERENCE[year]?.incomeTaxThresholds ?? YEARLY_REFERENCE[2026].incomeTaxThresholds;
  const base = Math.max(0, normalizeNumber(cumulativeBase) ?? 0);
  if (base <= thresholds[0]) return RATES[0];
  if (base <= thresholds[1]) return RATES[1];
  if (base <= thresholds[2]) return RATES[2];
  if (base <= thresholds[3]) return RATES[3];
  return RATES[4];
}

export function getYearReference(year = 2026) {
  return YEARLY_REFERENCE[year] ?? YEARLY_REFERENCE[2026];
}

export function calculateIhbarTazminati({
  brutUcret,
  yil = 0,
  ay = 0,
  gun = 0,
  cumulativeTaxBase = 0,
  year = 2026,
}) {
  const grossSalary = normalizeNumber(brutUcret) ?? 0;
  const totalMonths = (Number(yil) || 0) * 12 + (Number(ay) || 0) + (Number(gun) || 0) / 30;
  const ihbarWeeks = getIhbarWeeks(totalMonths);
  const ihbarDays = ihbarWeeks * 7;
  const brutTazminat = round2((grossSalary / 30) * ihbarDays);
  const appliedTaxRate = getTaxRateForYear(cumulativeTaxBase, year);
  const gelirVergisi = round2(brutTazminat * appliedTaxRate);
  const damgaVergisi = round2(brutTazminat * DAMGA_VERGISI_ORANI_2026);

  return {
    esasBrutUcret: round2(grossSalary),
    hizmetSuresiAy: totalMonths,
    ihbarHaftasi: ihbarWeeks,
    ihbarGunu: ihbarDays,
    uygulananVergiOrani: appliedTaxRate,
    brutTazminat,
    gelirVergisi,
    damgaVergisi,
    netTazminat: round2(brutTazminat - gelirVergisi - damgaVergisi),
  };
}

export function getIssizlikDurationDays(premiumDays) {
  const days = Number(premiumDays) || 0;
  if (days >= 1080) return 300;
  if (days >= 900) return 240;
  if (days >= 600) return 180;
  return 0;
}

export function calculateIssizlikMaasi({ son4AyOrtalamaBrut, premiumDays = 0 }) {
  return calculateIssizlikMaasiForYear({ son4AyOrtalamaBrut, premiumDays, year: 2026 });
}

export function calculateIssizlikMaasiForYear({ son4AyOrtalamaBrut, premiumDays = 0, year = 2026 }) {
  const avgGross = normalizeNumber(son4AyOrtalamaBrut) ?? 0;
  const rawMonthly = round2(avgGross * 0.4);
  const reference = getYearReference(year);
  const upperLimit = round2(reference.brutAsgariUcret * 0.8);
  const monthlyAllowance = Math.min(rawMonthly, upperLimit);
  const durationDays = getIssizlikDurationDays(premiumDays);

  return {
    ortalamaBrut: round2(avgGross),
    hesaplananOdeme: rawMonthly,
    ustSinir: upperLimit,
    aylikIssizlikMaasi: round2(monthlyAllowance),
    hakSuresiGun: durationDays,
    hakSuresiAy: durationDays ? round2(durationDays / 30) : 0,
  };
}

export function calculateIssizlikMaasiFromFourMonths({
  month1,
  month2,
  month3,
  month4,
  premiumDays = 0,
  year = 2026,
}) {
  const months = [month1, month2, month3, month4].map((item) => normalizeNumber(item) ?? 0);
  const average = months.reduce((sum, item) => sum + item, 0) / 4;
  const result = calculateIssizlikMaasiForYear({
    son4AyOrtalamaBrut: average,
    premiumDays,
    year,
  });

  return {
    ...result,
    aylar: months,
  };
}

export function calculateKidemTazminatiForPeriod({
  brutUcret,
  yil = 0,
  ay = 0,
  gun = 0,
  year = 2026,
  period = "h1",
}) {
  const reference = getYearReference(year);
  return calculateKidemTazminati({
    brutUcret,
    yil,
    ay,
    gun,
    tavan: reference.kidemTavan[period] ?? reference.kidemTavan.h1,
  });
}
