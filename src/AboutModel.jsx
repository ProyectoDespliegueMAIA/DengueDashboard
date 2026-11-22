import React, { useEffect, useState } from 'react';
import ModelMethod from './ModelMethod.jsx';

const labels = { logistica: 'Regresión logística', mlp: 'Perceptrón multicapa', persistencia: 'Persistencia' };
const blocks = {
  retrospectiva_2024: 'Evaluación retrospectiva · 2024',
  retrospectiva_2025: 'Evaluación retrospectiva · 2025',
  umbral_2022_2023: 'Calibración del umbral · 2022–2023',
};
const windows = { lag1: 'Semana anterior', lag1_prev4: 'Semana anterior y resumen de cuatro semanas',
  prev4_lag2: 'De 5 a 2 semanas antes', prev4_lag3: 'De 6 a 3 semanas antes' };
const count = new Intl.NumberFormat('es-CO');
const pct = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });
const score = (value, format = pct) => value == null ? '—' : format.format(value);

function SearchPlot({ name, model }) {
  const candidates = model.busqueda;
  const ranked = [...candidates].sort((a,b) => a.ap-b.ap);
  const winning = ranked.findIndex(c => ['valor','ajuste','variante'].every(k => c[k] === model.mejor[k]));
  const x = i => 38 + i * 332 / Math.max(1, ranked.length - 1);
  const y = v => 121 - 104 * v;
  return <article className="panel model-card">
    <h3>{labels[name]}</h3>
    <p className="muted">{candidates.length} configuraciones · AP seleccionada {score(model.mejor.ap)}</p>
    <svg viewBox="0 0 386 151" className="model-plot" role="img" aria-label={`AP por configuración para ${labels[name]}`}>
      {[0, .25, .5, .75, 1].map(v => <g key={v}><line x1="38" x2="370" y1={y(v)} y2={y(v)} className="gridline" />
        <text x="33" y={y(v)+4} textAnchor="end">{score(v)}</text></g>)}
      {ranked.map((c,i) => <circle key={i} cx={x(i)} cy={y(c.ap)} r={i===winning?5:3}
        fill={i===winning?'#ad4609':c.avisos?'#9aaabc':'#1668a8'}>
        <title>{`AP ${score(c.ap)} · regularización ${c.valor.toPrecision(3)} · ${windows[c.variante] ?? c.variante}${c.avisos?' · aviso de convergencia':''}`}</title>
      </circle>)}
      <text x="204" y="145" textAnchor="middle">Configuraciones ordenadas por AP</text>
    </svg>
    <dl className="model-settings">
      <div><dt>{name==='logistica'?'Regularización C':'Regularización alpha'}</dt><dd>{model.mejor.valor.toPrecision(3)}</dd></div>
      <div><dt>{name==='logistica'?'Pesos de clase':'Capa oculta'}</dt><dd>{name==='logistica'?(model.mejor.ajuste?'Balanceados':'Uniformes'):`${model.mejor.ajuste} neuronas`}</dd></div>
      <div><dt>Ventana climática</dt><dd>{windows[model.mejor.variante] ?? model.mejor.variante}</dd></div>
      <div><dt>Umbral de alerta</dt><dd>{score(model.umbral)}</dd></div>
    </dl>
    <details><summary>Ver predictores ({model.predictores.length})</summary><p className="feature-list">{model.predictores.join(' · ')}</p></details>
  </article>;
}

export default function AboutModel({ cities, city, onCity, get }) {
  const [block, setBlock] = useState('retrospectiva_2024');
  const [request, setRequest] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const path = `/api/v1/ciudades/${city}`;
    Promise.all([get(path+'/modelo', controller.signal), get(path+'/datos', controller.signal)])
      .then(([evaluation, data]) => setRequest({ city, retry, evaluation, data }))
      .catch(error => { if (!controller.signal.aborted) setRequest({city,retry,error:error.message}); });
    return () => controller.abort();
  }, [city, get, retry]);

  const current = request?.city === city && request.retry === retry ? request : null;
  const evaluation = current?.evaluation, data = current?.data;
  const metrics = evaluation?.metricas.filter(m => m.bloque === block) ?? [];
  const active = cities.find(c => c.ciudad === city)?.nombre ?? city;
  const maximum = Math.max(1, ...(data?.anuales.map(a => a.notificaciones ?? 0) ?? []));
  return <>
    <div className="context"><div><h2>Acerca del modelo</h2><p className="muted">Resultados históricos y datos utilizados por municipio.</p></div>
      <label>Municipio del modelo<select value={city} onChange={e => onCity(e.target.value)}>
        {(cities.length ? cities : [{ciudad:'cali',nombre:'Cali'},{ciudad:'ibague',nombre:'Ibagué'},{ciudad:'villavicencio',nombre:'Villavicencio'}])
          .map(c => <option key={c.ciudad} value={c.ciudad}>{c.nombre}</option>)}
      </select></label></div>
    {!current && <p className="panel notice" role="status">Cargando información del modelo…</p>}
    {current?.error && <div className="panel notice error" role="alert">{current.error} <button onClick={()=>setRetry(v=>v+1)}>Reintentar</button></div>}
    {evaluation && data && <>
      <section className="panel model-section">
        <div className="table-top"><div><h2>Comparación en {active}</h2><p className="muted">La API utiliza regresión logística con clima. La persistencia sirve como referencia.</p></div>
          <label>Período de evaluación<select value={block} onChange={e=>setBlock(e.target.value)}>
            {Object.entries(blocks).map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select></label></div>
        <div className="metric-bars" aria-label="Comparación de F1">{metrics.map(m=><div key={m.modelo}>
          <span>{labels[m.modelo]}</span><div className="metric-track"><i style={{width:`${(m.f1??0)*100}%`}}/></div><strong>{score(m.f1)}</strong>
        </div>)}</div>
        <div className="table-scroll"><table><thead><tr><th>Modelo</th><th>Semanas</th><th>Excesos</th><th>F1</th><th>Precisión</th><th>Sensibilidad</th><th>AP</th><th>AUC ROC</th><th>Detectados</th><th>Falsas alertas</th><th>Omitidos</th></tr></thead>
          <tbody>{metrics.map(m=><tr key={m.modelo}><th scope="row">{labels[m.modelo]}</th><td>{m.n}</td><td>{m.positivos}</td>
            {['f1','precision','sensibilidad','ap','roc_auc'].map(k=><td key={k}>{score(m[k])}</td>)}<td>{m.tp}</td><td>{m.fp}</td><td>{m.fn}</td></tr>)}</tbody></table></div>
        <p className="muted model-note">— indica una métrica no disponible. La sensibilidad mide qué proporción de los excesos se detectó. La precisión indica qué proporción de las alertas acertó.</p>
      </section>
      <section className="panel model-section model-decision" aria-labelledby="decision-modelo">
        <h2 id="decision-modelo">Por qué elegimos la regresión logística</h2>
        <p className="muted">Segunda ronda · Evaluación retrospectiva conjunta de Cali, Ibagué y Villavicencio, 2024–2025.</p>
        <p>Seleccionamos la <strong>regresión logística con clima como modelo definitivo para la API</strong>. Al compararla con el <strong>perceptrón multicapa con clima (MLP)</strong>, detectó una mayor proporción de excesos en la evaluación retrospectiva conjunta.</p>
        <p>Priorizamos reducir los excesos omitidos porque una semana con exceso sin alerta puede retrasar la revisión epidemiológica. Una falsa alerta también tiene un costo: el equipo tendría que revisar una señal aunque esa semana no haya superado el P75. Reportamos estas alertas por municipio para ver dónde se concentra esa carga y para que el resultado conjunto no oculte diferencias locales. La persistencia se conserva como referencia de desempeño.</p>
        <div className="table-scroll"><table><thead><tr><th>Modelo</th><th>Excesos detectados</th><th>Sensibilidad</th><th>Falsas alertas</th><th>Excesos omitidos</th></tr></thead>
          <tbody><tr><th scope="row">Regresión logística</th><td>148 de 153</td><td>96,7 %</td><td>68</td><td>5</td></tr>
            <tr><th scope="row">Perceptrón multicapa</th><td>125 de 153</td><td>81,7 %</td><td>47</td><td>28</td></tr></tbody>
        </table></div>
        <p>En conjunto, la logística detectó <strong>23 excesos más</strong> y generó <strong>21 falsas alertas adicionales</strong>. El resultado varía por ciudad y año. En Villavicencio 2024, el MLP detectó 13 de 14 excesos con 5 falsas alertas, frente a 10 detecciones y 11 falsas alertas con la logística. En 2025, la logística detectó 47 de 48 excesos en esa ciudad, frente a 34 con el MLP, con 4 falsas alertas cada uno.</p>
      </section>
      <ModelMethod mlp={evaluation.modelos.mlp} />
      <section className="model-area"><h2>Búsqueda de hiperparámetros</h2>
        <p className="muted">Precisión promedio (AP) de las predicciones fuera de entrenamiento en cortes de {evaluation.busqueda_anios[0]} a {evaluation.busqueda_anios.at(-1)}. El punto naranja indica la configuración elegida.</p>
        <div className="graphs">{Object.entries(evaluation.modelos).map(([name,model])=><SearchPlot key={name} name={name} model={model}/>)}</div>
      </section>
      <section className="panel model-section"><h2>Estadísticas y fuentes</h2>
        <p className="muted">{data.fuente_notificaciones}. {data.fuente_clima}.</p>
        <div className="data-summary">
          <div><strong>{score(data.dias_clima,count)}</strong><span>Días con clima · {data.inicio_clima} a {data.fin_clima}</span></div>
          <div><strong>{score(data.semanas_elegibles,count)}</strong><span>Semanas elegibles para el modelo</span></div>
          <div><strong>{score(data.semanas_clima_completas,count)}</strong><span>Semanas climáticas completas</span></div>
        </div>
        <p className="muted">{data.variables_climaticas.join(' · ')}.</p>
        <div className="table-scroll model-note"><table><thead><tr><th>Año epidemiológico</th><th>Notificaciones observadas</th><th>Semanas con conteo</th><th>Semanas con etiqueta</th><th>Semanas con exceso</th></tr></thead>
          <tbody>{data.anuales.map(a=><tr key={a.anio_epi}><th scope="row">{a.anio_epi}</th>
            <td><div className="annual-cell"><div className="metric-track"><i style={{width:`${(a.notificaciones??0)*100/maximum}%`}} /></div>{score(a.notificaciones,count)}</div></td>
            <td>{a.semanas_con_conteo} de {a.semanas}</td><td>{a.semanas_con_etiqueta}</td><td>{score(a.semanas_con_exceso,count)}</td></tr>)}</tbody></table></div>
        <p className="muted model-note">El exceso se define al superar el P{evaluation.percentil_etiqueta} de la misma semana en los cinco años anteriores. El modelo anticipa una semana. Las evaluaciones de 2024 y 2025 usan datos históricos consolidados.</p>
      </section>
    </>}
  </>;
}
