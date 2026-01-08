import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");

db.exec(`
  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orgName TEXT NOT NULL,
    orgSize TEXT NOT NULL,
    industry TEXT NOT NULL,
    hasOtel TEXT NOT NULL,
    email TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = express();
app.use(cors());
app.use(express.json());

// Get all surveys
app.get("/api/surveys", (req, res) => {
  const stmt = db.prepare("SELECT * FROM surveys ORDER BY id DESC");
  const surveys = stmt.all();
  res.json(surveys);
});

// Create survey
app.post("/api/surveys", (req, res) => {
  const { orgName, orgSize, industry, hasOtel, email } = req.body;
  const stmt = db.prepare(
    "INSERT INTO surveys (orgName, orgSize, industry, hasOtel, email) VALUES (?, ?, ?, ?, ?)",
  );
  const result = stmt.run(orgName, orgSize, industry, hasOtel, email);

  const getStmt = db.prepare("SELECT * FROM surveys WHERE id = ?");
  const survey = getStmt.get(result.lastInsertRowid);
  res.json(survey);
});

// Get statistics
app.get("/api/stats", (req, res) => {
  const totalStmt = db.prepare("SELECT COUNT(*) as total FROM surveys");
  const { total } = totalStmt.get();

  const sizeStmt = db.prepare(
    "SELECT orgSize as value, COUNT(*) as count FROM surveys GROUP BY orgSize",
  );
  const bySize = sizeStmt.all().map((row) => ({
    ...row,
    percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
  }));

  const industryStmt = db.prepare(
    "SELECT industry as value, COUNT(*) as count FROM surveys GROUP BY industry",
  );
  const byIndustry = industryStmt.all().map((row) => ({
    ...row,
    percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
  }));

  const otelStmt = db.prepare(
    "SELECT hasOtel as value, COUNT(*) as count FROM surveys GROUP BY hasOtel",
  );
  const byOtel = otelStmt.all().map((row) => ({
    ...row,
    percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
  }));

  res.json({ total, bySize, byIndustry, byOtel });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
