'use client';

import { useMemo } from 'react';
import { Activity, ArrowDownRight, ChartNoAxesCombined, CircleCheck, Target } from 'lucide-react';
import { formatCurrency as money, formatPercent as percent } from '@/lib/analysis';
import { buildAnalysisInsights } from '@/lib/analysis-insights';
import type { RowResult, Scenario } from '@/lib/contracts';
import styles from './analysis-insights.module.css';

const colors = ['#2563eb', '#d89725', '#cf5265', '#94a3b8'];
const compact = (value: number) => value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export default function AnalysisInsights({ rows, scenario, invalidCount, onDiscountChange }: {
  rows: RowResult[]; scenario: Scenario; invalidCount: number; onDiscountChange: (bps: number) => void;
}) {
  const data = useMemo(() => buildAnalysisInsights(rows, scenario, invalidCount), [rows, scenario, invalidCount]);
  const basis = scenario.feeEnabled ? 'contribuição' : 'margem bruta';
  const groups = ['Na meta ou acima', 'Abaixo da meta, sem perda', 'Resultado negativo', 'Percentual não aplicável'];
  let offset = 0;
  const slices = data.counts.map((count, index) => {
    const length = rows.length ? count / rows.length * 100 : 0;
    const slice = { count, length, offset, color: colors[index], label: groups[index] };
    offset += length;
    return slice;
  });
  const margins = data.trend.flatMap(point => point.margin === null ? [] : [point.margin]);
  const low = Math.min(0, ...margins), high = Math.max(10, scenario.targetBps / 100, ...margins);
  const padding = (high - low) * .12, min = low - padding, max = high + padding;
  const x = (bps: number) => 64 + bps / Math.max(2000, scenario.discountBps) * 352;
  const y = (value: number) => 190 - (value - min) / (max - min) * 160;
  const line = data.trend.map((point, index) => point.margin === null ? '' : `${index === 0 || data.trend[index - 1].margin === null ? 'M' : 'L'} ${x(point.discountBps)} ${y(point.margin)}`).join(' ');
  const barMin = Math.min(0, ...data.lowest.map(row => row.activeCents));
  const barMax = Math.max(0, ...data.lowest.map(row => row.activeCents));
  const barPosition = (value: number) => (value - barMin) / (barMax - barMin || 1) * 100;
  const balance = data.averageBalance ?? 0;
  const afterCost = data.averagePrice - data.averageCost;
  const waterfall = [
    { label: 'Preço', start: 0, end: data.averagePrice, value: data.averagePrice, color: colors[0] },
    { label: 'Custo', start: data.averagePrice, end: afterCost, value: -data.averageCost, color: '#94a3b8' },
    ...(scenario.feeEnabled ? [{ label: 'Taxa', start: afterCost, end: balance, value: -data.averageFee, color: colors[1] }] : []),
    { label: 'Saldo', start: 0, end: balance, value: balance, color: balance < 0 ? colors[2] : '#0d9488' },
  ];
  const waterMin = Math.min(0, balance), waterMax = Math.max(1, data.averagePrice);
  const wy = (value: number) => 192 - (value - waterMin) / (waterMax - waterMin) * 148;
  const wx = (index: number) => 35 + index * (350 / waterfall.length);
  const waterWidth = 350 / waterfall.length - 25;
  const metrics = [
    { label: 'Margem média', value: percent(data.averageMargin), detail: `Média simples de ${data.applicable} cadastros com percentual.`, Icon: Activity },
    { label: 'Produtos na meta', value: percent(data.atTargetPercent), detail: `${data.counts[0]} de ${data.applicable} com percentual aplicável.`, Icon: Target },
    { label: 'Resultado médio / unidade', value: data.averageBalance === null ? 'Não aplicável' : money(data.averageBalance), detail: `Uma unidade por cadastro · ${basis}.`, Icon: ChartNoAxesCombined },
    { label: 'Aproveitamento do arquivo', value: percent(data.importPercent), detail: `${rows.length} válidos de ${rows.length + invalidCount} registros.`, Icon: CircleCheck },
  ];

  return <section className={styles.insights} aria-labelledby="insights-title">
    <div className={styles.heading}>
      <div><span className="eyebrow">SEU CATÁLOGO, EM PERSPECTIVA</span><h2 id="insights-title">Mais clareza em cada decisão.</h2></div>
      <span className={styles.live}><span /> Acompanha seu cenário</span>
    </div>
    <div className={styles.metrics} aria-label="Indicadores do catálogo">
      {metrics.map(({ label, value, detail, Icon }) => <article className={styles.metric} key={label}>
        <div><span>{label}</span><Icon size={17} aria-hidden="true" /></div><strong>{value}</strong><small>{detail}</small>
      </article>)}
    </div>
    <div className={styles.grid}>
      <article className={styles.card}>
        <span className={styles.kicker}>01 / DISTRIBUIÇÃO</span><h3>Quanto do catálogo está na meta?</h3>
        <p>Cadastros por situação, com meta de {percent(scenario.targetBps / 100)}.</p>
        <div className={styles.donutLayout}>
          <div className={styles.donut}>
            <svg viewBox="0 0 200 200" role="img" aria-label={`Distribuição em relação à meta: ${slices.map(s => `${s.label}: ${s.count}`).join('; ')}.`}>
              <circle cx="100" cy="100" r="76" fill="none" stroke="#edf1f7" strokeWidth="25" />
              {slices.filter(s => s.count).map(s => <circle key={s.label} cx="100" cy="100" r="76" fill="none" stroke={s.color} strokeWidth="25" pathLength="100" strokeDasharray={`${s.length} ${100 - s.length}`} strokeDashoffset={-s.offset} transform="rotate(-90 100 100)"><title>{s.label}: {s.count} ({percent(s.length)})</title></circle>)}
            </svg>
            <div className={styles.donutCenter}><strong>{compact(rows.length)}</strong><span>cadastros</span></div>
          </div>
          <ul className={styles.legend}>{slices.map(s => <li key={s.label}><span className={styles.dot} style={{ background: s.color }} /><span>{s.label}<small>{percent(s.length)} do catálogo</small></span><b>{s.count.toLocaleString('pt-BR')}</b></li>)}</ul>
        </div>
        <p className={styles.footnote}>Cada cadastro aparece uma vez. Preço simulado zero fica em “percentual não aplicável”.</p>
      </article>

      <article className={styles.card}>
        <span className={styles.kicker}>02 / SIMULAÇÃO DE DESCONTOS</span><h3>Até onde o desconto leva a margem?</h3>
        <p>Média de {basis} por desconto. A taxa atual é mantida.</p>
        <svg className={styles.plot} viewBox="0 0 450 232" role="img" aria-label={`Simulação, não histórico de vendas. ${data.trend.map(p => `Desconto ${percent(p.discountBps / 100)}: margem ${percent(p.margin)}`).join('; ')}.`}>
          {[low, (low + high) / 2, high].map((value, i) => <g key={i}><line x1="64" x2="416" y1={y(value)} y2={y(value)} stroke="#e5eaf1" /><text x="56" y={y(value) + 4} textAnchor="end">{compact(value)}%</text></g>)}
          <line x1="64" x2="416" y1={y(scenario.targetBps / 100)} y2={y(scenario.targetBps / 100)} stroke="#d89725" strokeDasharray="5 5" />
          <path d={line} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
          {data.trend.map(point => <g key={point.discountBps}>
            {point.margin !== null && <circle cx={x(point.discountBps)} cy={y(point.margin)} r={point.discountBps === scenario.discountBps ? 6 : 4} fill={point.discountBps === scenario.discountBps ? '#2563eb' : '#fff'} stroke="#2563eb" strokeWidth="2"><title>Desconto {percent(point.discountBps / 100)}: {percent(point.margin)}</title></circle>}
          </g>)}
          {[0, Math.max(2000, scenario.discountBps) / 2, Math.max(2000, scenario.discountBps)].map(value => <text key={value} x={x(value)} y="213" textAnchor="middle">{percent(value / 100)}</text>)}
          <text x="240" y="230" textAnchor="middle">Desconto aplicado</text>
          {!margins.length && <text x="240" y="100" textAnchor="middle">Sem percentuais aplicáveis</text>}
        </svg>
        <div className={styles.chartKey}><span><i style={{ background: colors[0] }} />Margem média</span><span><i style={{ background: colors[1] }} />Meta {percent(scenario.targetBps / 100)}</span></div>
        <div className={styles.discounts} role="group" aria-label="Aplicar desconto ao cenário">{data.trend.map(point => <button type="button" key={point.discountBps} aria-pressed={scenario.discountBps === point.discountBps} onClick={() => onDiscountChange(point.discountBps)} title={`Margem média: ${percent(point.margin)}`} aria-label={`Aplicar desconto de ${percent(point.discountBps / 100)}`}>{percent(point.discountBps / 100)}</button>)}</div>
        <p className={styles.footnote}>Selecione um desconto para atualizar a análise. Médias excluem preços simulados zero; a base pode variar.</p>
      </article>

      <article className={styles.card}>
        <span className={styles.kicker}>03 / RESULTADO POR UNIDADE</span><h3>Os menores saldos do catálogo.</h3>
        <p>Até cinco cadastros, do menor ao maior resultado em reais.</p>
        <div className={styles.horizontalBars}>
          {data.lowest.map(row => <div className={styles.barRow} key={row.sourceRow}>
            <div className={styles.barHeading}><span title={row.name}>{row.name}<small>Linha {row.sourceRow}</small></span><b className={row.activeCents < 0 ? styles.negative : ''}>{money(row.activeCents)}</b></div>
            <div className={styles.barTrack} aria-hidden="true"><span className={styles.zero} style={{ left: `${barPosition(0)}%` }} /><span className={styles.bar} style={{ left: `${barPosition(Math.min(0, row.activeCents))}%`, width: `${Math.abs(row.activeCents) / (barMax - barMin || 1) * 100}%`, background: row.activeCents < 0 ? colors[2] : colors[0] }} /></div>
          </div>)}
          {!data.lowest.length && <p>Nenhum cadastro disponível.</p>}
        </div>
        <p className={styles.footnote}><ArrowDownRight size={14} aria-hidden="true" /> A linha marca o zero. Barras à esquerda representam resultado negativo.</p>
      </article>

      <article className={styles.card}>
        <span className={styles.kicker}>04 / COMPOSIÇÃO DO PREÇO</span><h3>Do preço ao que sobra.</h3>
        <p>Preço simulado médio, menos custo{scenario.feeEnabled ? ' e taxa' : ''}, até o saldo por unidade.</p>
        <svg className={styles.plot} viewBox="0 0 410 238" role="img" aria-label={`Composição média por unidade: ${waterfall.map(step => `${step.label}: ${money(step.value)}`).join('; ')}.`}>
          <line x1="20" x2="390" y1={wy(0)} y2={wy(0)} stroke="#cbd5e1" strokeDasharray="4 4" />
          {waterfall.map((step, i) => <g key={step.label}>
            <rect x={wx(i)} y={Math.min(wy(step.start), wy(step.end))} width={waterWidth} height={Math.max(1, Math.abs(wy(step.start) - wy(step.end)))} rx="3" fill={step.color}><title>{step.label}: {money(step.value)}</title></rect>
            <text x={wx(i) + waterWidth / 2} y={Math.min(wy(step.start), wy(step.end)) - 10} textAnchor="middle">{compact(step.value / 100)}</text>
            <text x={wx(i) + waterWidth / 2} y="220" textAnchor="middle">{step.label}</text>
            {i < waterfall.length - 1 && <line x1={wx(i) + waterWidth} x2={wx(i + 1)} y1={wy(step.end)} y2={wy(step.end)} stroke="#cbd5e1" strokeDasharray="3 3" />}
          </g>)}
          <text x="20" y="16">R$ por unidade</text>
        </svg>
        <div className={styles.balance}><span>Saldo médio estimado</span><strong className={balance < 0 ? styles.negative : ''}>{data.averageBalance === null ? 'Não aplicável' : money(balance)}</strong></div>
        <p className={styles.footnote}>Médias considerando uma unidade de cada cadastro. O saldo é {basis}, sem ponderar vendas ou estoque.</p>
      </article>
    </div>
  </section>;
}
