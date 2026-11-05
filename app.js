(() => {
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('ru-RU');
  const money = value => Number.isFinite(value) ? `${format.format(Math.round(value))} ₽` : '—';
  const percent = value => Number.isFinite(value) ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}%` : '—';
  const node = (tag, className, value) => { const element = document.createElement(tag); element.className = className; if (value != null) element.textContent = value; return element; };
  function metric(label, value) { const card = node('div', 'metric'); card.append(node('div', 'metric-label', label), node('div', 'metric-value', value)); return card; }
  function render(data) {
    const content = $('content'); content.replaceChildren();
    for (const point of Object.values(data.points || {})) {
      const card = node('section', 'point');
      card.append(node('h2', '', point.name));
      const metrics = node('div', 'metrics');
      metrics.append(metric('План выручки за месяц', money(point.plan?.revenue)), metric('Выручка за месяц', money(point.month?.revenue)), metric('Выручка сегодня', money(point.today?.revenue)), metric('План среднего чека', money(point.plan?.averageCheck)), metric('Средний чек за месяц', money(point.month?.averageCheck)), metric('Средний чек сегодня', money(point.today?.averageCheck)));
      card.append(metrics, node('h3', '', 'Конверсия бариста'));
      if (data.conversionAvailable === false) card.append(node('p', 'muted', 'Конверсия временно недоступна в источнике.'));
      else if (!point.baristas?.length) card.append(node('p', 'muted', 'Пока нет чеков бариста.'));
      else {
        const wrap = node('div', 'table-wrap'), table = node('table');
        const head = node('thead'), tr = node('tr');
        for (const label of ['Бариста', 'Чеки с добавкой / всего', 'Конверсия']) tr.append(node('th', '', label));
        head.append(tr); table.append(head);
        const body = node('tbody');
        for (const person of point.baristas) { const row = node('tr'); row.append(node('td', '', person.name), node('td', '', `${format.format(person.upsellChecks || 0)} / ${format.format(person.totalChecks || 0)}`), node('td', '', percent(person.conversion))); body.append(row); }
        table.append(body); wrap.append(table); card.append(wrap);
      }
      content.append(card);
    }
    const updated = new Date(data.updatedAt);
    $('updated').textContent = `Данные на ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Yekaterinburg' }).format(updated)} · обновляются по расписанию`;
    content.hidden = false;
  }
  async function load() {
    try {
      const response = await fetch('./data/current.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Данные ещё не опубликованы');
      const data = await response.json();
      if (!data.updatedAt || !data.points || !Object.keys(data.points).length) throw new Error('Неполные данные');
      render(data);
      $('message').textContent = '';
    } catch (error) {
      $('updated').textContent = 'Не удалось загрузить показатели';
      $('message').textContent = error.message || 'Не удалось загрузить данные';
    }
  }
  load();
})();

