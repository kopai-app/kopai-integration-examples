"use client";

import { useState } from "react";

interface Survey {
  id: number;
  orgName: string;
  orgSize: string;
  industry: string;
  hasOtel: string;
  email: string;
  createdAt: string;
}

interface StatRow {
  value: string;
  count: number;
  percent: number;
}

interface Stats {
  total: number;
  bySize: StatRow[];
  byIndustry: StatRow[];
  byOtel: StatRow[];
}

type View = "form" | "list" | "stats";

function SurveyForm({ onSubmit }: { onSubmit: () => void }) {
  const [form, setForm] = useState({
    orgName: "",
    orgSize: "",
    industry: "",
    hasOtel: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    onSubmit();
    setForm({ orgName: "", orgSize: "", industry: "", hasOtel: "", email: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold">Survey</h2>

      <div>
        <label className="block text-sm font-medium">Organization Name</label>
        <input
          type="text"
          required
          value={form.orgName}
          onChange={(e) => setForm({ ...form, orgName: e.target.value })}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Organization Size</label>
        <select
          required
          value={form.orgSize}
          onChange={(e) => setForm({ ...form, orgSize: e.target.value })}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">Select size</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201-1000">201-1000</option>
          <option value="1000+">1000+</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Industry</label>
        <select
          required
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">Select industry</option>
          <option value="Technology">Technology</option>
          <option value="Finance">Finance</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Retail">Retail</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">
          Already instrumenting with OpenTelemetry?
        </label>
        <select
          required
          value={form.hasOtel}
          onChange={(e) => setForm({ ...form, hasOtel: e.target.value })}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="planning">Planning to</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        Submit
      </button>
    </form>
  );
}

function SurveyList({ surveys }: { surveys: Survey[] }) {
  if (!surveys.length)
    return <p className="text-center text-gray-500">No surveys yet</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">All Surveys</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2">Org Name</th>
              <th className="border border-gray-300 px-4 py-2">Size</th>
              <th className="border border-gray-300 px-4 py-2">Industry</th>
              <th className="border border-gray-300 px-4 py-2">
                OpenTelemetry
              </th>
              <th className="border border-gray-300 px-4 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id}>
                <td className="border border-gray-300 px-4 py-2">
                  {s.orgName}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {s.orgSize}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {s.industry}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {s.hasOtel}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {s.email}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTable({
  title,
  rows,
}: {
  title: string;
  rows: StatRow[];
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <table className="w-full border-collapse border border-gray-300 mt-2">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">Value</th>
            <th className="border border-gray-300 px-4 py-2">Count</th>
            <th className="border border-gray-300 px-4 py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.value}>
              <td className="border border-gray-300 px-4 py-2">{row.value}</td>
              <td className="border border-gray-300 px-4 py-2">{row.count}</td>
              <td className="border border-gray-300 px-4 py-2">
                {row.percent}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Statistics({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Statistics</h2>
      <p className="text-lg">Total Responses: {stats.total}</p>
      <StatTable title="By Organization Size" rows={stats.bySize} />
      <StatTable title="By Industry" rows={stats.byIndustry} />
      <StatTable title="OpenTelemetry Adoption" rows={stats.byOtel} />
    </div>
  );
}

export default function SurveyApp() {
  const [view, setView] = useState<View>("form");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState("");

  const loadSurveys = async () => {
    const res = await fetch("/api/surveys");
    setSurveys(await res.json());
  };

  const loadStats = async () => {
    const res = await fetch("/api/stats");
    setStats(await res.json());
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
    if (newView === "list") loadSurveys();
    if (newView === "stats") loadStats();
  };

  const handleSubmit = () => {
    setMessage("Survey submitted successfully!");
    setTimeout(() => setMessage(""), 3000);
  };

  const tabs: { key: View; label: string }[] = [
    { key: "form", label: "Survey Form" },
    { key: "list", label: "All Surveys" },
    { key: "stats", label: "Statistics" },
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          OpenTelemetry Survey
        </h1>

        <nav className="flex justify-center gap-4 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleViewChange(tab.key)}
              className={`px-4 py-2 rounded ${
                view === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {message && (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded mb-4 text-center">
            {message}
          </div>
        )}

        {view === "form" && <SurveyForm onSubmit={handleSubmit} />}
        {view === "list" && <SurveyList surveys={surveys} />}
        {view === "stats" && <Statistics stats={stats} />}
      </div>
    </div>
  );
}
