import { NextResponse } from "next/server";
import { buildResultWorkbook, parsePersonnelWorkbook } from "@/lib/payroll";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = formData.get("mode") === "sgdp" ? "sgdp" : "normal";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Excel dosyasi gerekli." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const personnel = parsePersonnelWorkbook(Buffer.from(arrayBuffer));

    if (!personnel.length) {
      return NextResponse.json(
        { error: "Dosyada en az bir personel ve net maas satiri bulunamadi." },
        { status: 400 },
      );
    }

    const resultBuffer = buildResultWorkbook(personnel, mode);
    const fileName = mode === "sgdp" ? "sgdp_maas_maliyeti.xlsx" : "maas_maliyeti.xlsx";

    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Dosya islenirken hata olustu.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
