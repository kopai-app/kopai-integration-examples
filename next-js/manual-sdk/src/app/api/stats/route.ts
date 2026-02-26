import { NextResponse } from "next/server";
import db from "@/lib/db";

export function GET() {
  const totalStmt = db.prepare("SELECT COUNT(*) as total FROM surveys");
  const { total } = totalStmt.get() as { total: number };

  const sizeStmt = db.prepare(
    "SELECT orgSize as value, COUNT(*) as count FROM surveys GROUP BY orgSize",
  );
  const bySize = (sizeStmt.all() as { value: string; count: number }[]).map(
    (row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }),
  );

  const industryStmt = db.prepare(
    "SELECT industry as value, COUNT(*) as count FROM surveys GROUP BY industry",
  );
  const byIndustry = (
    industryStmt.all() as { value: string; count: number }[]
  ).map((row) => ({
    ...row,
    percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
  }));

  const otelStmt = db.prepare(
    "SELECT hasOtel as value, COUNT(*) as count FROM surveys GROUP BY hasOtel",
  );
  const byOtel = (otelStmt.all() as { value: string; count: number }[]).map(
    (row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }),
  );

  return NextResponse.json({ total, bySize, byIndustry, byOtel });
}
