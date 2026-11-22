import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import ColombiaMap from './ColombiaMap.jsx';
import AboutModel from './AboutModel.jsx';
import NewPredictions from './NewPredictions.jsx';
import CombinedChart from './CombinedChart.jsx';

const api = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const fmt = new Intl.NumberFormat('es-CO');
const pct = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });
const statuses = {
  acierto_alerta: 'Exceso detectado',
  falsa_alerta: 'Falsa alerta',
  exceso_omitido: 'Exceso omitido',
  acierto_sin_alerta: 'Sin exceso ni alerta',
};
const defaults = { ciudad: 'cali', desde: '2023-12-31', hasta: '2024-12-28', umbral: '' };
const keyOf = (p) => p.inicio_semana;
const value = (n, form = fmt) => n == null ? '—' : form.format(n);
const week = (p) => `SE ${String(p.semana_epi).padStart(2, '0')} · ${p.anio_epi}`;

async function get(path, signal) {
  const response = await fetch(api + path, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `La API respondió con código ${response.status}.`);
  }
  return response.json();
}

function Chart({ rows, selected, onSelect, title, subtitle, series, probability = false }) {
  const [hover, setHover] = useState(null);
  const width = 640, height = 215, left = 51, right = 620, top = 15, bottom = 176;
  const maxValue = Math.max(1, ...series.flatMap(s => rows.map(s.read).filter(n => n != null)));
  const unit = 10 ** Math.floor(Math.log10(maxValue));
  const max = probability ? 1 : Math.ceil(maxValue / (unit / 2)) * unit / 2;
  const x = i => rows.length < 2 ? (left + right) / 2 : left + i * (right - left) / (rows.length - 1);
  const y = n => bottom - (n / max) * (bottom - top);
  const active = rows[hover] ?? rows.find(p => keyOf(p) === selected);
  const activeIndex = active ? rows.indexOf(active) : -1;
  const ticks = [...new Set([0, .25, .5, .75, 1].map(f => Math.round(f * (rows.length - 1))))];
  function path(read) {
    let previous = false;
    return rows.map((p, i) => {
      const n = read(p);
      if (n == null) { previous = false; return ''; }
      const command = previous ? 'L' : 'M';
      previous = true;
      return `${command}${x(i)},${y(n)}`;
    }).join(' ');
  }
  function pointed(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) * width / rect.width;
    return Math.max(0, Math.min(rows.length - 1, Math.round((pos - left) / (right - left) * (rows.length - 1))));
  }
  return <section className="panel chart-panel">
    <h2>{title}</h2><p className="muted">{subtitle}</p>
    <div className="legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    {rows.some(p => series[0].read(p) != null) ? <>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}
        onPointerMove={e => setHover(pointed(e))} onPointerLeave={() => setHover(null)}
        onClick={e => onSelect(keyOf(rows[pointed(e)]))}>
        {[0, .25, .5, .75, 1].map(f => <g key={f}>
          <line x1={left} y1={y(f * max)} x2={right} y2={y(f * max)} className="gridline" />
          <text x={left - 8} y={y(f * max) + 4} textAnchor="end">{value(f * max, probability ? pct : fmt)}</text>
        </g>)}
        {ticks.map(i => <text key={i} x={x(i)} y={bottom + 22} textAnchor={rows.length === 1 ? 'middle' : i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>
          {rows[i].inicio_semana.slice(0, 10)}
        </text>)}
        {series.map(s => <g key={s.label}>
          <path d={path(s.read)} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '6 5' : undefined} />
          {rows.map((p, i) => {
            const n = s.read(p);
            const isolated = s.read(rows[i - 1] ?? {}) == null && s.read(rows[i + 1] ?? {}) == null;
            return n != null && (isolated || (s.alerts && p.alerta))
              ? <circle key={keyOf(p)} cx={x(i)} cy={y(n)} r={3} fill={s.alerts && p.alerta ? '#b45309' : s.color} /> : null;
          })}
        </g>)}
        {activeIndex >= 0 && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} className="cursor-line" />}
      </svg>
      <div className="chart-detail">{active ? <><strong>{week(active)}</strong>{series.map(s =>
        <span key={s.label}>{s.label}: {value(s.read(active), probability ? pct : fmt)}</span>)}</> : 'Selecciona una semana en el gráfico o la tabla.'}</div>
    </> : <div className="empty">Sin datos para esta serie en el período.</div>}
  </section>;
}

function App() {
  const [view, setView] = useState(() => location.hash === '#nuevas' ? 'nuevas' : location.hash === '#modelo' ? 'modelo' : 'dashboard');
  useEffect(() => {
    const sync = () => setView(location.hash === '#nuevas' ? 'nuevas' : location.hash === '#modelo' ? 'modelo' : 'dashboard');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [cities, setCities] = useState([]);
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(defaults);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [newest, setNewest] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({ desde: filters.desde, hasta: filters.hasta });
    if (filters.umbral !== '') params.set('umbral', filters.umbral);
    Promise.all([get('/api/v1/ciudades', abort.signal),
      get(`/api/v1/ciudades/${filters.ciudad}/dashboard?${params}`, abort.signal)])
      .then(([municipios, dashboard]) => {
        setCities(municipios); setData(dashboard); setSelected(null); setPage(0);
      })
      .catch(err => { if (!abort.signal.aborted) setError(err instanceof TypeError ? 'No se pudo conectar con la API. Comprueba que el contenedor está activo y que el origen del frontend está permitido.' : err.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [filters, attempt]);

  const update = (name, val) => setDraft(d => ({ ...d, [name]: val }));
  function apply(event) {
    event.preventDefault();
    setError(''); setLoading(true); setFilters({ ...draft });
  }
  function selectCity(ciudad) {
    setDraft(d => ({ ...d, ciudad }));
    if (ciudad === filters.ciudad) return;
    setError(''); setLoading(true); setFilters(f => ({ ...f, ciudad }));
  }
  function retry() { setError(''); setLoading(true); setAttempt(n => n + 1); }

  const rows = data?.serie ?? [];
  const selection = rows.find(p => keyOf(p) === selected);
  const matching = rows.filter(p => !status || (status === 'sin_prediccion' ? p.alerta == null : p.resultado === status));
  const ordered = newest ? [...matching].reverse() : matching;
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const cards = data ? [
    ['Notificaciones', data.indicadores.notificaciones_observadas, `${data.indicadores.semanas_con_conteo} semanas con conteo`, 'blue'],
    ['Semanas con exceso', data.indicadores.semanas_con_exceso_observado, `${data.indicadores.semanas_con_etiqueta} semanas con etiqueta`, 'blue'],
    ['Alertas del modelo', data.indicadores.alertas_del_modelo, `${data.indicadores.semanas_con_prediccion} semanas con predicción`, 'teal'],
    ['Falsas alertas', data.indicadores.falsas_alertas, `${data.indicadores.semanas_evaluables} semanas evaluables`, 'amber'],
    ['Excesos omitidos', data.indicadores.excesos_omitidos, `${data.indicadores.semanas_evaluables} semanas evaluables`, 'red'],
  ] : [];

  return <>
    <header className="top"><div className="shell masthead"><span className="brand-mark" aria-hidden="true">✚</span><div>
      <p className="eyebrow">Vigilancia epidemiológica</p><h1>Alertas semanales de dengue</h1>
    </div><span className="mode">Consulta retrospectiva</span></div></header>
    <nav className="app-nav" aria-label="Menú principal"><div className="shell">
      <a href="#dashboard" aria-current={view==='dashboard'?'page':undefined}>Dashboard</a>
      <a href="#nuevas" aria-current={view==='nuevas'?'page':undefined}>Nuevas predicciones</a>
      <a href="#modelo" aria-current={view==='modelo'?'page':undefined}>Acerca del modelo</a>
    </div></nav>
    <main className="shell">
      {view==='nuevas' ? <NewPredictions api={api} /> : view==='modelo' ? <AboutModel cities={cities} city={filters.ciudad} onCity={selectCity} get={get} /> : <>
      <form className="panel filters" onSubmit={apply}>
        <label>Municipio<select value={draft.ciudad} onChange={e => selectCity(e.target.value)}>
          {(cities.length ? cities : [{ ciudad: 'cali', nombre: 'Cali' }, { ciudad: 'ibague', nombre: 'Ibagué' }, { ciudad: 'villavicencio', nombre: 'Villavicencio' }]).map(c => <option value={c.ciudad} key={c.ciudad}>{c.nombre}</option>)}
        </select></label>
        <label>Desde<input required type="date" value={draft.desde} max={draft.hasta || undefined} onChange={e => update('desde', e.target.value)} /></label>
        <label>Hasta<input required type="date" value={draft.hasta} min={draft.desde || undefined} onChange={e => update('hasta', e.target.value)} /></label>
        <label>Umbral de simulación<select value={draft.umbral} onChange={e => update('umbral', e.target.value)}>
          <option value="">Umbral del municipio</option>
          <option value="0">0 % · Cualquier probabilidad positiva</option>
          <option value="0.25">25 %</option>
          <option value="0.5">50 %</option>
          <option value="0.75">75 %</option>
          <option value="1">100 % · Sin alertas</option>
        </select></label>
        <button type="submit" className="primary" disabled={loading}>Aplicar filtros</button>
      </form>
      <div className="regional-overview">
        <ColombiaMap active={filters.ciudad} onSelect={selectCity} />
        <div className="regional-data">
      {loading && <div className="panel notice" role="status">Cargando series semanales…</div>}
      {error && <div className="panel notice error" role="alert">{error} <button onClick={retry}>Reintentar</button></div>}
      {data && !loading && !error && <>
        <div className="context"><div><h2>{data.municipio.nombre}</h2><p className="muted">Notificaciones por inicio de síntomas · {data.desde} a {data.hasta}</p></div>
          <div className="context-pill">Umbral aplicado: <strong>{value(data.umbral_probabilidad, pct)}</strong></div></div>
        <div className="cards">{cards.map(([label, n, help, tone]) => <section className={`panel card ${tone}`} key={label}>
          <h3>{label}</h3><strong>{value(n)}</strong><small>{help}</small>
        </section>)}</div>
      </>}
        </div>
      </div>
      {data && !loading && !error && <>
        <CombinedChart key={data.municipio.ciudad} rows={rows} city={data.municipio.ciudad} api={api}
          selected={selected} onSelect={setSelected} statuses={statuses} />
        <div className="graphs">
          <Chart key={`casos-${data.municipio.ciudad}-${data.desde}-${data.hasta}`} title="Notificaciones y referencia histórica" subtitle="Conteos semanales y percentil 75 de la misma semana en los cinco años previos." rows={rows} selected={selected} onSelect={setSelected}
            series={[{ label: 'Notificaciones', color: '#1668a8', read: p => p.casos_observados }, { label: 'P75 histórico', color: '#c026a0', dashed: true, read: p => p.p75_casos }]} />
          <Chart key={`prob-${data.municipio.ciudad}-${data.desde}-${data.hasta}`} title="Probabilidad y alertas" subtitle="Los puntos ámbar indican semanas donde la probabilidad superó el umbral." rows={rows} selected={selected} onSelect={setSelected} probability
            series={[{ label: 'Probabilidad de exceso', color: '#00857e', alerts: true, read: p => p.probabilidad_exceso },
              { label: 'Umbral de alerta', color: '#b45309', dashed: true, read: p => p.probabilidad_exceso == null ? null : data.umbral_probabilidad }]} />
        </div>
        <section className="climate-section">
          <h2>Clima del período seleccionado</h2>
          <p className="muted">Valores observados de cada semana. Selecciona una semana para comparar los gráficos de clima, notificaciones y alertas. El modelo utiliza las ventanas climáticas anteriores descritas en «Acerca del modelo».</p>
          <div className="graphs">
            {[['precipitacion_mm', 'Precipitación acumulada', 'Milímetros de lluvia acumulados durante la semana.', '#1668a8'],
              ['temperatura_C', 'Temperatura media', 'Promedio semanal de temperatura a 2 metros, en °C.', '#bb5727'],
              ['humedad_relativa', 'Humedad relativa media', 'Promedio semanal de humedad relativa, en %.','#00857e']].map(([field, title, subtitle, color]) =>
                <Chart key={field + data.municipio.ciudad + data.desde + data.hasta} title={title} subtitle={subtitle}
                  rows={rows} selected={selected} onSelect={setSelected}
                  series={[{label: field==='precipitacion_mm'?'Lluvia (mm)':field==='temperatura_C'?'Temperatura (°C)':'Humedad (%)',color,read:p=>p[field]}]} />
            )}
          </div>
        </section>
        {selection && <section className="panel selection" aria-live="polite">
          <div><h2>{week(selection)}</h2><p className="muted">{selection.inicio_semana} a {selection.fin_semana} · Corte nominal {selection.corte_prediccion}</p></div>
          <div><strong>{statuses[selection.resultado] ?? 'Sin predicción disponible'}</strong><p>Probabilidad {value(selection.probabilidad_exceso, pct)} · P75 {value(selection.p75_casos)}</p></div>
          <button onClick={() => setSelected(null)}>Cerrar detalle</button>
        </section>}
        <section className="panel table-panel">
          <div className="table-top"><div><h2>Detalle semanal</h2><p className="muted">{matching.length} semanas · selecciona una para ver su detalle</p></div>
            <label>Resultado<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
              <option value="">Todos</option>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="sin_prediccion">Sin predicción</option>
            </select></label></div>
          <div className="table-scroll"><table><thead><tr>
            <th aria-sort={newest ? 'descending' : 'ascending'}><button className="sort" onClick={() => { setNewest(n => !n); setPage(0); }}>Semana {newest ? '↓' : '↑'}</button></th>
            <th>Inicio</th><th>Notificaciones</th><th>P75</th><th>Probabilidad</th><th>Resultado</th>
          </tr></thead><tbody>
            {ordered.slice(page * pageSize, (page + 1) * pageSize).map(p => <tr key={keyOf(p)} className={selected === keyOf(p) ? 'selected' : ''}>
              <td><button className="link" onClick={() => setSelected(keyOf(p))}>{week(p)}</button></td>
              <td>{p.inicio_semana}</td><td>{value(p.casos_observados)}</td><td>{value(p.p75_casos)}</td><td>{value(p.probabilidad_exceso, pct)}</td>
              <td><span className={`badge ${p.resultado ?? ''}`}>{statuses[p.resultado] ?? 'Sin predicción'}</span></td>
            </tr>)}
            {!ordered.length && <tr><td colSpan="6">No hay semanas para este filtro.</td></tr>}
          </tbody></table></div>
          <div className="paging"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
            <span>Página {page + 1} de {pages}</span>
            <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
        </section>
        <footer>Fuente epidemiológica: notificaciones agrupadas por inicio de síntomas. Las predicciones disponibles corresponden a semanas elegibles de 2022–2025.</footer>
      </>}
      </>}
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
