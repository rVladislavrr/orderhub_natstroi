const fmt = (value, decimals = 2) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtNum = (value) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return '—';
  return String(num);
};

const fmtInt = (value) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return '—';
  return num.toLocaleString('ru-RU');
};

const fmtDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return value;
  }
};

const progressBar = (pct) => {
  const val = Math.min(100, Math.max(0, parseFloat(pct) || 0));
  const total = 12;
  const filled = Math.round((val / 100) * total);
  const empty = total - filled;
  const bar = '='.repeat(filled) + '-'.repeat(empty);
  return `<span class="pbar">[${bar}]&nbsp;${val.toFixed(1)}%</span>`;
};

const kmdRows = (kmd_breakdown = []) =>
  kmd_breakdown
    .map(
      (k, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${k.num_kmd || '—'}</td>
        <td>${k.status || '—'}</td>
        <td>${fmtInt(k.marks_total)}</td>
        <td>${fmtInt(k.marks_completed)}</td>
        <td>${fmtInt(k.marks_shipped)}</td>
        <td>${fmt(k.marks_weight)} кг</td>
        <td>${fmt(k.shipped_weight)} кг</td>
        <td>${progressBar(k.completion_pct)}</td>
      </tr>`,
    )
    .join('');

export const buildReportHtml = (data) => {
  const { time, progress, delivery, workload, kmd_breakdown } = data;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Отчёт по заказу №${data.internal_num_orders}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;500;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 10.5pt;
      color: #000;
      background: #fff;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 18mm 18mm 20mm 22mm;
    }

    .report-header {
      border-bottom: 2.5pt solid #000;
      padding-bottom: 10pt;
      margin-bottom: 18pt;
    }

    .report-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16pt;
    }

    .report-title {
      font-family: 'Roboto Condensed', Arial Narrow, sans-serif;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: -0.3pt;
      line-height: 1.1;
    }

    .report-subtitle {
      font-size: 11pt;
      margin-top: 4pt;
      color: #333;
    }

    .report-meta {
      text-align: right;
      font-size: 9pt;
      color: #444;
      line-height: 1.8;
      font-family: 'Roboto Mono', monospace;
    }

    .report-meta strong {
      font-size: 9.5pt;
      color: #000;
    }

    .status-badge {
      display: inline-block;
      border: 1.5pt solid #000;
      padding: 2pt 8pt;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.5pt;
      text-transform: uppercase;
      margin-top: 6pt;
      font-family: 'Roboto Condensed', sans-serif;
    }

    .section {
      margin-bottom: 18pt;
    }

    .section-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1pt;
      border-bottom: 1pt solid #000;
      padding-bottom: 4pt;
      margin-bottom: 10pt;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1pt solid #000;
    }

    .metric-cell {
      padding: 7pt 10pt;
      border-right: 1pt solid #ccc;
      border-bottom: 1pt solid #ccc;
    }

    .metric-cell:nth-child(3n) { border-right: none; }

    .metric-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      color: #555;
      margin-bottom: 3pt;
      font-family: 'Roboto Condensed', sans-serif;
    }

    .metric-value {
      font-size: 13pt;
      font-weight: 700;
      font-family: 'Roboto Mono', monospace;
      line-height: 1;
    }

    .metric-value.large { font-size: 16pt; }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14pt;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }

    .data-table th {
      text-align: left;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      padding: 5pt 8pt;
      background: #000;
      color: #fff;
      font-family: 'Roboto Condensed', sans-serif;
    }

    .data-table td {
      padding: 5pt 8pt;
      border-bottom: 0.5pt solid #ddd;
      vertical-align: middle;
      white-space: nowrap;
    }

    .data-table td:first-child {
      white-space: normal;
      font-weight: 500;
      color: #333;
      width: 55%;
    }

    .data-table .row-even td { background: #f5f5f5; }
    .data-table .row-odd td  { background: #fff; }

    .kmd-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .kmd-table th {
      background: #000;
      color: #fff;
      text-align: left;
      padding: 5pt 6pt;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      font-family: 'Roboto Condensed', sans-serif;
      border-right: 1pt solid #444;
    }

    .kmd-table th:last-child { border-right: none; }

    .kmd-table td {
      padding: 5pt 6pt;
      border-bottom: 0.5pt solid #ddd;
      border-right: 0.5pt solid #e8e8e8;
      vertical-align: middle;
      white-space: nowrap;
    }

    .kmd-table td:last-child { border-right: none; }
    .kmd-table .row-even td { background: #f5f5f5; }
    .kmd-table .row-odd td  { background: #fff; }

    .pbar {
      font-family: 'Roboto Mono', monospace;
      font-size: 9pt;
      font-weight: 500;
      white-space: nowrap;
      display: inline-block;
    }

    .report-footer {
      margin-top: 24pt;
      padding-top: 10pt;
      border-top: 1pt solid #000;
      font-size: 8pt;
      color: #666;
      display: flex;
      justify-content: space-between;
      font-family: 'Roboto Condensed', sans-serif;
    }

    @media print {
      body { background: #fff; }
      .page { padding: 12mm 14mm 16mm 18mm; width: 100%; }
      .section { page-break-inside: avoid; }
      .kmd-section { page-break-before: always; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="report-header">
    <div class="report-header-top">
      <div>
        <div class="report-title">Отчёт по заказу №${data.internal_num_orders}</div>
        <div class="report-subtitle">${data.order_name || '—'}</div>
        <div class="status-badge">${data.order_status || '—'}</div>
      </div>
      <div class="report-meta">
        <strong>Дата формирования</strong><br>
        ${new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })},
        ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}<br><br>
        Активен: ${data.is_active ? 'Да' : 'Нет'}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Временные метрики</div>
    <div class="metrics-grid">
      <div class="metric-cell">
        <div class="metric-label">Дата создания</div>
        <div class="metric-value">${fmtDate(time?.order_created_date)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Первая активность</div>
        <div class="metric-value">${fmtDate(time?.first_activity_date)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Последняя активность</div>
        <div class="metric-value">${fmtDate(time?.last_activity_date)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Первая отгрузка</div>
        <div class="metric-value">${fmtDate(time?.first_shipment_date)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Последняя отгрузка</div>
        <div class="metric-value">${fmtDate(time?.last_shipment_date)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Дней с создания</div>
        <div class="metric-value large">${fmtNum(time?.days_since_created)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Дней в производстве</div>
        <div class="metric-value large">${fmtNum(time?.days_in_production)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Дней до завершения</div>
        <div class="metric-value large">${fmtNum(time?.days_to_completion)}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-label">Ср. дней / марка</div>
        <div class="metric-value large">${fmt(time?.avg_days_per_mark, 1)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Прогресс выполнения</div>
    <div class="two-col">
      <table class="data-table">
        <thead><tr><th>Показатель</th><th>Значение</th></tr></thead>
        <tbody>
          <tr class="row-even"><td>Уникальных марок</td><td>${fmtNum(progress?.total_marks_uq)}</td></tr>
          <tr class="row-odd"><td>Всего марок</td><td>${fmtNum(progress?.total_marks_qty)}</td></tr>
          <tr class="row-even"><td>Собрано марок</td><td>${fmtNum(progress?.assembled_marks)}</td></tr>
          <tr class="row-odd"><td>Отгружено марок</td><td>${fmtNum(progress?.shipped_marks)}</td></tr>
          <tr class="row-even"><td>Собрано марок (%)</td><td>${progressBar(progress?.marks_assembly_pct)}</td></tr>
          <tr class="row-odd"><td>Отгружено марок (%)</td><td>${progressBar(progress?.marks_shipment_pct)}</td></tr>
        </tbody>
      </table>
      <table class="data-table">
        <thead><tr><th>Показатель</th><th>Значение</th></tr></thead>
        <tbody>
          <tr class="row-even"><td>Всего деталей</td><td>${fmtNum(progress?.total_details)}</td></tr>
          <tr class="row-odd"><td>Завершено деталей</td><td>${fmtNum(progress?.completed_details)}</td></tr>
          <tr class="row-even"><td>Выполненных деталей (%)</td><td>${progressBar(progress?.details_completion_pct)}</td></tr>
          <tr class="row-odd"><td>Всего КМД</td><td>${fmtNum(progress?.total_kmd)}</td></tr>
          <tr class="row-even"><td>Завершено КМД</td><td>${fmtNum(progress?.completed_kmd)}</td></tr>
          <tr class="row-odd"><td>Выполненных КМД (%)</td><td>${progressBar(progress?.kmd_completion_pct)}</td></tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:10pt;">
      <table class="data-table">
        <thead><tr><th>Показатель</th><th>Значение</th></tr></thead>
        <tbody>
          <tr class="row-even"><td>Общий вес марок</td><td>${fmt(progress?.total_marks_weight)} кг</td></tr>
          <tr class="row-odd"><td>Вес отгруженных марок</td><td>${fmt(progress?.shipped_marks_weight)} кг</td></tr>
          <tr class="row-even"><td>Отгружено по весу (%)</td><td>${progressBar(progress?.weight_shipment_pct)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Поставки металла</div>
    <table class="data-table">
      <thead><tr><th>Показатель</th><th>Значение</th></tr></thead>
      <tbody>
        <tr class="row-even"><td>Кол-во поставок</td><td>${fmtNum(delivery?.total_deliveries)}</td></tr>
        <tr class="row-odd"><td>Позиций в поставках</td><td>${fmtNum(delivery?.total_delivery_items)}</td></tr>
        <tr class="row-even"><td>Общий вес поставок</td><td>${fmt(delivery?.total_delivery_weight)} кг</td></tr>
        <tr class="row-odd"><td>Распределено по КМД</td><td>${fmt(delivery?.allocated_weight)} кг</td></tr>
        <tr class="row-even"><td>Остаток на складе</td><td>${fmt(delivery?.remaining_weight)} кг</td></tr>
        <tr class="row-odd"><td>Распределено по КМД (%)</td><td>${progressBar(delivery?.allocation_pct)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">4. Нагрузка на рабочих</div>
    <table class="data-table">
      <thead><tr><th>Показатель</th><th>Значение</th></tr></thead>
      <tbody>
        <tr class="row-even"><td>Рабочих задействовано</td><td>${fmtNum(workload?.total_workers)}</td></tr>
        <tr class="row-odd"><td>Операций по деталям</td><td>${fmtNum(workload?.total_detail_operations)}</td></tr>
        <tr class="row-even"><td>Операций по сборке</td><td>${fmtNum(workload?.total_assembly_operations)}</td></tr>
        <tr class="row-odd"><td>Операций по отгрузке</td><td>${fmtNum(workload?.total_shipment_operations)}</td></tr>
        <tr class="row-even"><td>Самый занятый рабочий</td><td>${workload?.busiest_worker_name || '—'} (${fmtNum((workload?.total_detail_operations ?? 0) + (workload?.total_assembly_operations ?? 0) + (workload?.total_shipment_operations ?? 0))} оп.)</td></tr>
        <tr class="row-odd"><td>Деталей выполнено (самый занятый)</td><td>${fmtNum(workload?.busiest_worker_operations)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section kmd-section">
    <div class="section-title">5. Разбивка по КМД</div>
    <table class="kmd-table">
      <thead>
        <tr>
          <th>№ КМД</th>
          <th>Статус</th>
          <th>Марок всего</th>
          <th>Завершено</th>
          <th>Отгружено</th>
          <th>Вес марок, кг</th>
          <th>Вес отгр., кг</th>
          <th>Готовность (%)</th>
        </tr>
      </thead>
      <tbody>
        ${kmdRows(kmd_breakdown)}
      </tbody>
    </table>
  </div>

  <div class="report-footer">
    <span>Сформировано автоматически · ${new Date().toLocaleDateString('ru-RU')}</span>
    <span>Заказ №${data.internal_num_orders} · ${data.order_name || ''}</span>
  </div>

</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;
};
