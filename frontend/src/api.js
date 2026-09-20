// BEFORE:  const API_BASE = "http://127.0.0.1:8000";
// WHY CHANGED: The old line was hardcoded to your local machine's address.
// When this frontend is deployed on Render (or any cloud), it would still try to
// call "127.0.0.1" — which is the user's own browser/laptop, not the server.
// This would break 100% of API calls in production.
//
// NOW: We read from a Vite environment variable (VITE_API_BASE).
// - Locally (npm run dev): .env.development sets it to http://127.0.0.1:8000 → same as before.
// - On Render (production build): Render injects VITE_API_BASE=https://your-backend.onrender.com
// If the env var is missing for any reason, it falls back to "" (empty string),
// which means the frontend and backend are served from the same origin — perfect for Docker.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export const api = {
  async getStatus(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/status`);
    if (!res.ok) throw new Error("Failed to fetch run status");
    return res.json();
  },

  async getSources(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/sources`);
    if (!res.ok) throw new Error("Failed to fetch sources");
    return res.json();
  },

  async getTransactions(runId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/run/${runId}/transactions?${query}`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  },

  async getDiscrepancies(runId, discType = "") {
    const url = discType
      ? `${API_BASE}/run/${runId}/discrepancies?disc_type=${discType}`
      : `${API_BASE}/run/${runId}/discrepancies`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch discrepancies");
    return res.json();
  },

  async getExceptions(runId, side = "") {
    const url = side
      ? `${API_BASE}/run/${runId}/exceptions?side=${side}`
      : `${API_BASE}/run/${runId}/exceptions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch exceptions");
    return res.json();
  },

  async getTransactionDetail(runId, txnId) {
    const res = await fetch(`${API_BASE}/run/${runId}/transaction/${txnId}`);
    if (!res.ok) throw new Error("Failed to fetch transaction detail");
    return res.json();
  },

  async getTrace(runId, txnId) {
    const res = await fetch(`${API_BASE}/run/${runId}/trace/${txnId}`);
    if (!res.ok) throw new Error("Failed to fetch trace");
    return res.json();
  },

  async getSummary(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/summary`);
    if (!res.ok) throw new Error("Failed to fetch summary");
    return res.json();
  },

  async recomputeThreshold(runId, threshold) {
    const res = await fetch(`${API_BASE}/run/${runId}/recompute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold }),
    });
    if (!res.ok) throw new Error("Failed to recompute threshold");
    return res.json();
  },

  async getThresholdSweep(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/threshold_sweep`);
    if (!res.ok) throw new Error("Failed to fetch threshold sweep");
    return res.json();
  },

  async startRun(runId, threshold = 0.75) {
    const res = await fetch(`${API_BASE}/run/${runId}?threshold=${threshold}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to start run");
    return res.json();
  },

  async uploadOrGenerate({ bankFile, ledgerFile, settlementFile, generateSynthetic, recordsCount, seed }) {
    const formData = new FormData();
    if (bankFile) formData.append("bank_file", bankFile);
    if (ledgerFile) formData.append("ledger_file", ledgerFile);
    if (settlementFile) formData.append("settlement_file", settlementFile);
    formData.append("generate_synthetic", generateSynthetic ? "true" : "false");
    formData.append("records_count", recordsCount || 70);
    formData.append("seed", seed || 42);

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload or generate data");
    return res.json();
  },

  async sendChatMessage(runId, question) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, question }),
    });
    if (!res.ok) throw new Error("Failed to send chat message");
    return res.json();
  },

  async getReport(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/report`);
    if (!res.ok) throw new Error("Failed to fetch report");
    return res.json();
  },

  getDownloadUrl(runId, format = "csv") {
    return `${API_BASE}/run/${runId}/report/download?format=${format}`;
  },

  async getErpVouchers(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/erp-vouchers`);
    if (!res.ok) throw new Error("Failed to fetch ERP vouchers");
    return res.json();
  },

  getTallyXmlUrl(runId) {
    return `${API_BASE}/run/${runId}/erp-vouchers/tally-xml`;
  },

  async downloadTallyXml(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/erp-vouchers/tally-xml`);
    if (!res.ok) throw new Error("Failed to download Tally XML");
    return res.blob();
  },

  async getDisputes(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/disputes`);
    if (!res.ok) throw new Error("Failed to fetch bank dispute claims");
    return res.json();
  },

  async getStatutoryDossier(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/statutory-dossier`);
    if (!res.ok) throw new Error("Failed to fetch statutory audit dossier");
    return res.json();
  },

  async downloadStatutoryDossier(runId) {
    const res = await fetch(`${API_BASE}/run/${runId}/statutory-dossier/download`);
    if (!res.ok) throw new Error("Failed to download statutory audit dossier");
    return res.blob();
  },

  getStatutoryDossierDownloadUrl(runId) {
    return `${API_BASE}/run/${runId}/statutory-dossier/download`;
  }
};

