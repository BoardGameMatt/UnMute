import { renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireHostOffering } from "@/lib/trane-quiz/auth";
import { buildReportPayload } from "@/lib/trane-quiz/report-data";
import { TraneReportDocument } from "@/lib/trane-quiz/report-document";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const auth = await requireHostOffering(params.token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = await buildReportPayload(auth.admin, auth.offering);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 500 });
  }

  const logoPath = join(
    process.cwd(),
    "public/trane-quiz/trane-technologies-logo.png"
  );
  let logoSrc: string;
  try {
    const buf = readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoSrc = "";
  }

  const buffer = await renderToBuffer(
    <TraneReportDocument payload={payload} logoSrc={logoSrc} />
  );

  const filename = `Trane_PM_KnowledgeCheck_${payload.courseSlug}_${payload.classDate}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
