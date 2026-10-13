import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function AgentsTraceView({ runId, selectedTxnId }) {
  const [transactions, setTransactions] = useState([]);
  const [selectedId, setSelectedId] = useState(selectedTxnId || '');
  const [traceData, setTraceData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getTransactions(runId).then((items) => {
      if (!active) return;
      setTransactions(items);
      const nextId = selectedTxnId || items[0]?.record_id || '';
      setSelectedId(nextId);
      if (nextId) return api.getTrace(runId, nextId).then((trace) => active && setTraceData(trace));
    }).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [runId, selectedTxnId]);

  const selectTransaction = async (event) => {
    const id = event.target.value;
    setSelectedId(id);
    setTraceData(null);
    setError('');
    try { setTraceData(await api.getTrace(runId, id)); }
    catch (err) { setError(err.message); }
  };

  return (
    <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      <PageHeader
        title="Recorded Decision Trace"
        description="Shows trace steps recorded by the reconciliation engine. Missing telemetry is reported as unavailable."
      />
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label htmlFor="trace-transaction">Transaction</label>{' '}
        <select id="trace-transaction" value={selectedId} onChange={selectTransaction}>
          {transactions.map((item) => <option key={item.record_id} value={item.record_id}>{item.record_id}</option>)}
        </select>
        {traceData && <p>Status: {traceData.status} · Recorded score: {Number(traceData.confidence_score).toFixed(4)}</p>}
      </div>
      {error && <div role="alert" className="card" style={{ padding: 16 }}>{error}</div>}
      {traceData && !traceData.trace_available && (
        <div className="card" style={{ padding: 20 }}>No execution trace was recorded for this transaction.</div>
      )}
      {traceData?.trace?.map((step, index) => (
        <article className="card" key={`${step.step_num}-${index}`} style={{ padding: 20, marginBottom: 12 }}>
          <h3>{step.step_num}. {step.agent_name} · {step.action}</h3>
          <p>{step.input_summary}</p>
          <p>{step.output_summary}</p>
          {step.reasoning && <p>{step.reasoning}</p>}
          {step.timestamp && <small>Recorded at {step.timestamp}</small>}
          {step.duration_ms != null && <small> · Recorded duration {step.duration_ms} ms</small>}
          {step.tools_called?.length > 0 && <p>Recorded tools: {step.tools_called.join(', ')}</p>}
          {step.step_hash && <code>{step.step_hash}</code>}
        </article>
      ))}
    </div>
  );
}