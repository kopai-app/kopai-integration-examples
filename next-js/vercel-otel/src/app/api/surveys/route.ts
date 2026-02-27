import { NextResponse } from "next/server";
import db from "@/lib/db";

export function GET() {
  const stmt = db.prepare("SELECT * FROM surveys ORDER BY id DESC");
  const surveys = stmt.all();
  return NextResponse.json(surveys);
}

export async function POST(request: Request) {
  const { orgName, orgSize, industry, hasOtel, email } = await request.json();
  const stmt = db.prepare(
    "INSERT INTO surveys (orgName, orgSize, industry, hasOtel, email) VALUES (?, ?, ?, ?, ?)",
  );
  const result = stmt.run(orgName, orgSize, industry, hasOtel, email);

  const getStmt = db.prepare("SELECT * FROM surveys WHERE id = ?");
  const survey = getStmt.get(result.lastInsertRowid);
  return NextResponse.json(survey);
}
