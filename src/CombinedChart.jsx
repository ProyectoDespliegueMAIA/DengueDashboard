import React, { useEffect, useState } from 'react';

const climates = {
  precipitacion_mm: { label: 'Precipitación', unit: 'mm', color: '#427fa8' },
  temperatura_C: { label: 'Temperatura', unit: '°C', color: '#bd5725' },
  humedad_relativa: { label: 'Humedad relativa', unit: '%', color: '#00857e' },
};
const results = {
  acierto_alerta: ['Exceso detectado', '#00857e'],
  falsa_alerta: ['Falsa alerta', '#b97712'],
  exceso_omitido: ['Exceso omitido', '#b4425a'],
  acierto_sin_alerta: ['Sin exceso ni alerta', '#8795a3'],
  sin_prediccion: ['Sin predicción', '#a78bda'],
};
const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const display = n => n == null ? '—' : number.format(n);
const labelWeek = p => `SE ${p.semana_epi} · ${p.anio_epi}`;

export default function CombinedChart({ rows, city, api, selected, onSelect, statuses }) {
  const [variable, setVariable] = useState('precipitacion_mm');
  const [lag, setLag] = useState(0);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setHistory(null); setError('');
    fetch(`${api}/api/v1/ciudades/${city}/dashboard`, { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('No se pudo cargar el clima anterior al período.'); return response.json(); })
      .then(data => setHistory(new Map(data.serie.map(p => [p.inicio_semana, p]))))
      .catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [city, api, attempt]);

  const climate = climates[variable];
  const points = rows.map(row => {
    const date = new Date(row.inicio_semana + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - lag * 7);
    const sourceDate = date.toISOString().slice(0, 10);
    const source = history?.get(sourceDate);
    return { ...row, sourceDate, climate: source?.[variable] ?? null };
  });
  const w = 1200, h = 325, left = 66, right = 1124, top = 36, bottom = 234, strip = 258;
  const maxCases = Math.max(1, ...rows.flatMap(p => [p.casos_observados, p.p75_casos]).filter(v => v != null)) * 1.08;
  const climateValues = points.map(p => p.climate).filter(v => v != null);
  const rawMin = Math.min(...climateValues), rawMax = Math.max(...climateValues);
  const pad = Math.max(1, (rawMax - rawMin) * .1);
  const minClimate = variable === 'precipitacion_mm' || !climateValues.length ? 0 : Math.max(0, rawMin - pad);
  const maxClimate = climateValues.length ? Math.max(minClimate + 1, rawMax + pad) : 1;
  const x = i => left + (i + .5) * (right - left) / Math.max(1, rows.length);
  const y = v => bottom - v / maxCases * (bottom - top);
  const cy = v => bottom - (v - minClimate) / (maxClimate - minClimate) * (bottom - top);
  const cell = (right - left) / Math.max(1, rows.length);
  const ticks = [...new Set([0, .25, .5, .75, 1].map(f => Math.round(f * (rows.length - 1))))];
  const active = points.find(p => p.inicio_semana === (hover ?? selected));
  function path(read, scale) {
    let valid = false;
    return points.map((p, i) => {
      const value = read(p);
      if (value == null) { valid = false; return ''; }
      const command = valid ? 'L' : 'M'; valid = true;
      return `${command}${x(i)},${scale(value)}`;
    }).join(' ');
  }
  function pointed(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) * w / rect.width;
    return Math.max(0, Math.min(rows.length - 1, Math.floor((px - left) / cell)));
  }
  return <section className="panel combined-panel">
    <div className="table-top"><div><h2>Clima previo, notificaciones y respuesta del modelo</h2>
      <p className="muted">Explora cómo cambia el clima antes de las semanas con aumento de notificaciones.</p></div>
      <div className="combined-controls">
        <label>Variable climática<select value={variable} onChange={e => setVariable(e.target.value)}>
          {Object.entries(climates).map(([key, c]) => <option key={key} value={key}>{c.label} ({c.unit})</option>)}
        </select></label>
        <label>Rezago climático<select value={lag} onChange={e => setLag(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 8, 12].map(n => <option value={n} key={n}>{n === 0 ? 'Misma semana' : `${n} semana${n > 1 ? 's' : ''} antes`}</option>)}
        </select></label>
      </div>
    </div>
    <p className="muted">El rezago desplaza el clima para la exploración visual. La probabilidad y las alertas corresponden al modelo ya entrenado. Cada eje conserva sus unidades.</p>
    {error && <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Reintentar clima</button></p>}
    {!history && !error && <p role="status">Cargando antecedentes climáticos…</p>}
    <div className="legend">
      <span><i style={{ background: '#1668a8' }} />Notificaciones · eje izquierdo</span>
      <span><i style={{ background: '#c026a0' }} />P75 · eje izquierdo</span>
      <span><i style={{ background: climate.color }} />{climate.label} ({climate.unit}) · eje derecho</span>
    </div>
    {rows.length > 0 ? <>
      <div className="combined-scroll"><svg className="combined-svg" viewBox={`0 0 ${w} ${h}`} role="img"
        aria-label="Gráfico combinado de clima, notificaciones y resultados semanales"
        onPointerMove={e => setHover(points[pointed(e)].inicio_semana)} onPointerLeave={() => setHover(null)}
        onClick={e => onSelect(points[pointed(e)].inicio_semana)}>
        <text x={left} y="18">Notificaciones</text><text x={right} y="18" textAnchor="end">{climate.label} ({climate.unit})</text>
        {[0, .25, .5, .75, 1].map(f => <g key={f}>
          <line className="gridline" x1={left} x2={right} y1={y(f * maxCases)} y2={y(f * maxCases)} />
          <text x={left - 9} y={y(f * maxCases) + 4} textAnchor="end">{display(f * maxCases)}</text>
          <text x={right + 9} y={y(f * maxCases) + 4}>{display(minClimate + f * (maxClimate - minClimate))}</text>
        </g>)}
        {variable === 'precipitacion_mm'
          ? points.map((p, i) => p.climate == null ? null : <rect key={p.inicio_semana} x={x(i) - cell * .36} width={Math.max(.5, cell * .72)}
            y={cy(p.climate)} height={Math.max(0, bottom - cy(p.climate))} fill={climate.color} opacity=".28" />)
          : <path d={path(p => p.climate, cy)} fill="none" stroke={climate.color} strokeWidth="2" />}
        <path d={path(p => p.p75_casos, y)} fill="none" stroke="#c026a0" strokeWidth="2" strokeDasharray="6 4" />
        <path d={path(p => p.casos_observados, y)} fill="none" stroke="#1668a8" strokeWidth="2.5" />
        {points.map((p, i) => <rect key={p.inicio_semana} x={left + i * cell} y={strip} width={cell} height="17"
          fill={results[p.resultado ?? 'sin_prediccion'][1]} stroke="white" strokeWidth={rows.length < 120 ? 1 : 0}>
          <title>{labelWeek(p)} · {statuses[p.resultado] ?? 'Sin predicción'}</title>
        </rect>)}
        {ticks.map(i => <text x={x(i)} y="297" key={i} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>{rows[i].inicio_semana}</text>)}
        {active && <line x1={x(points.indexOf(active))} x2={x(points.indexOf(active))} y1={top} y2={strip + 17} className="cursor-line" />}
      </svg></div>
      <div className="legend outcome-legend">{Object.entries(results).map(([key, [name, color]]) => <span key={key}><i style={{ background: color }} />{name}</span>)}</div>
      <div className="chart-detail" aria-live="polite">{active ? <>
        <strong>{labelWeek(active)}</strong><span>Notificaciones: {display(active.casos_observados)}</span>
        <span>P75: {display(active.p75_casos)}</span><span>{climate.label}: {display(active.climate)} {climate.unit} · semana del {active.sourceDate}</span>
        <span>{statuses[active.resultado] ?? 'Sin predicción'}</span>
      </> : 'Selecciona una semana en el gráfico o en la tabla para consultar sus valores y su resultado.'}</div>
    </> : <p className="empty">No hay semanas en el rango seleccionado.</p>}
  </section>;
}
