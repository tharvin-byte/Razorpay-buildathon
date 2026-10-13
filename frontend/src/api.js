// Centralized API client with configurable timeouts, structured error handling, and transient retry logic.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, status = 500, detail = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Enhanced fetch wrapper with:
 * 1. AbortController / timeout handling
 * 2. Structured FastAPI error detail extraction
 * 3. Exponential backoff retry on idempotent GET requests
 */
async function request(url, options = {}, { timeout = DEFAULT_TIMEOUT_MS, retries = 0 } = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD";
  const maxAttempts = isIdempotent ? Math.max(1, retries + 1) : 1;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Chain external abort signals if provided
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorData = null;
        let errorMessage = `Request failed (${res.status} ${res.statusText})`;

        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            errorData = await res.json();
            if (errorData) {
              if (typeof errorData.detail === "string") {
                errorMessage = errorData.detail;
              } else if (Array.isArray(errorData.detail)) {
                // FastAPI pydantic validation errors list
                errorMessage = errorData.detail
                  .map((e) => (e.loc ? `${e.loc.slice(-1)[0]}: ${e.msg}` : e.msg))
                  .join("; ");
              } else if (errorData.message) {
                errorMessage = errorData.message;
              }
            }
          } else {
            const raw = await res.text();
            if (raw && raw.length < 200) {
              errorMessage = raw;
            }
          }
        } catch {
          // Fall back to default status text if body parsing fails
        }

        // Retry transient gateway / service unavailable errors (502, 503, 504) for idempotent calls
        if (isIdempotent && [502, 503, 504].includes(res.status) && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt)));
          continue;
        }

        throw new ApiError(errorMessage, res.status, errorData);
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError" && !options.signal?.aborted) {
        lastError = new ApiError(`Request to ${url} timed out after ${timeout}ms`, 408);
      } else {
        lastError = err;
      }

      // Retry network errors for idempotent requests
      const isNetworkError = !(err instanceof ApiError);
      if (isIdempotent && isNetworkError && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt)));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}

async function requestJson(url, options = {}, clientOptions = {}) {
  const res = await request(url, options, clientOptions);
  return res.json();
}

export const api = {
  async getStatus(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/status`, {}, { retries: 1, ...options });
  },

  async getSources(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/sources`, {}, { retries: 1, ...options });
  },

  async getTransactions(runId, params = {}, options = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    const url = query ? `${API_BASE}/run/${runId}/transactions?${query}` : `${API_BASE}/run/${runId}/transactions`;
    return requestJson(url, {}, { retries: 1, ...options });
  },

  async getDiscrepancies(runId, discTypeOrParams = "", extraParams = {}, options = {}) {
    let params = {};
    if (typeof discTypeOrParams === "object" && discTypeOrParams !== null) {
      params = { ...discTypeOrParams };
    } else {
      params = { ...extraParams };
      if (discTypeOrParams) {
        params.disc_type = discTypeOrParams;
      }
    }
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    const url = query ? `${API_BASE}/run/${runId}/discrepancies?${query}` : `${API_BASE}/run/${runId}/discrepancies`;
    return requestJson(url, {}, { retries: 1, ...options });
  },

  async getExceptions(runId, sideOrParams = "", extraParams = {}, options = {}) {
    let params = {};
    if (typeof sideOrParams === "object" && sideOrParams !== null) {
      params = { ...sideOrParams };
    } else {
      params = { ...extraParams };
      if (sideOrParams) {
        params.side = sideOrParams;
      }
    }
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    const url = query ? `${API_BASE}/run/${runId}/exceptions?${query}` : `${API_BASE}/run/${runId}/exceptions`;
    return requestJson(url, {}, { retries: 1, ...options });
  },

  async getTransactionDetail(runId, txnId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/transaction/${txnId}`, {}, { retries: 1, ...options });
  },

  async getTrace(runId, txnId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/trace/${txnId}`, {}, { retries: 1, ...options });
  },

  async getSummary(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/summary`, {}, { retries: 1, ...options });
  },

  async recomputeThreshold(runId, threshold, options = {}) {
    return requestJson(
      `${API_BASE}/run/${runId}/recompute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      },
      options
    );
  },

  async getThresholdSweep(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/threshold_sweep`, {}, { retries: 1, ...options });
  },

  async startRun(runId, threshold = 0.75, options = {}) {
    return requestJson(
      `${API_BASE}/run/${runId}?threshold=${encodeURIComponent(threshold)}`,
      {
        method: "POST",
      },
      options
    );
  },

  async uploadOrGenerate({ bankFile, ledgerFile, settlementFile, generateSynthetic, recordsCount, seed }, options = {}) {
    const formData = new FormData();
    if (bankFile) formData.append("bank_file", bankFile);
    if (ledgerFile) formData.append("ledger_file", ledgerFile);
    if (settlementFile) formData.append("settlement_file", settlementFile);
    formData.append("generate_synthetic", generateSynthetic ? "true" : "false");
    formData.append("records_count", recordsCount || 70);
    formData.append("seed", seed || 42);

    return requestJson(
      `${API_BASE}/upload`,
      {
        method: "POST",
        body: formData,
      },
      // Ingestion and file parsing can take slightly longer than default timeout
      { timeout: 30000, ...options }
    );
  },

  async sendChatMessage(runId, question, options = {}) {
    return requestJson(
      `${API_BASE}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId, question }),
      },
      // Gemini API calls can take up to 25s
      { timeout: 30000, ...options }
    );
  },

  async getReport(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/report`, {}, { retries: 1, ...options });
  },

  getDownloadUrl(runId, format = "csv") {
    return `${API_BASE}/run/${runId}/report/download?format=${encodeURIComponent(format)}`;
  },

  async getErpVouchers(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/erp-vouchers`, {}, { retries: 1, ...options });
  },

  getTallyXmlUrl(runId) {
    return `${API_BASE}/run/${runId}/erp-vouchers/tally-xml`;
  },

  async downloadTallyXml(runId, options = {}) {
    const res = await request(`${API_BASE}/run/${runId}/erp-vouchers/tally-xml`, {}, { retries: 1, ...options });
    return res.blob();
  },

  async getDisputes(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/disputes`, {}, { retries: 1, ...options });
  },

  async getStatutoryDossier(runId, options = {}) {
    return requestJson(`${API_BASE}/run/${runId}/statutory-dossier`, {}, { retries: 1, ...options });
  },

  async downloadStatutoryDossier(runId, options = {}) {
    const res = await request(`${API_BASE}/run/${runId}/statutory-dossier/download`, {}, { retries: 1, ...options });
    return res.blob();
  },

  getStatutoryDossierDownloadUrl(runId) {
    return `${API_BASE}/run/${runId}/statutory-dossier/download`;
  },
};
