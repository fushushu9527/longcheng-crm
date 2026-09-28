/* dashboard.js — 数据驾驶舱 */
(function () {
  document.addEventListener('app:ready', render);

  function render() {
    renderBanner();
    renderKpis();
    renderTrend();
    renderFunnel();
    renderPodiums();
    renderRank();
    renderLists();
    App.$('#rank-metric').addEventListener('change', renderRank);
  }

  function renderBanner() {
    const el = App.$('#local-banner');
    if (!App.online) {
      el.innerHTML = `<div class="banner warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        当前为本地预览，数据只存在此浏览器；部署到 GitHub Pages 后数据将云端共享。
        <a href="settings.html">去部署</a></div>`;
    } else if (!App.isEditor()) {
      el.innerHTML = `<div class="banner info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        访客只读模式。管理员在「设置」中填写令牌后可录入数据。</div>`;
    } else el.innerHTML = '';
  }

  function kpiCard(cls, label, value, unit, totalLabel, totalVal, foot) {
    return `<div class="kpi ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}<small>${unit || ''}</small></div>
      <div class="kpi-foot">${foot != null ? foot : `<span>${totalLabel}<b>${totalVal}</b></span>`}</div>
    </div>`;
  }

  function renderKpis() {
    const t = App.today();
    const cum = App.cumulative();
    const convRate = App.rate(t.converted, t.collected);
    const cumRate = App.rate(cum.converted, cum.collected);
    App.$('#kpi-grid').innerHTML =
      kpiCard('accent-cyan', '今日信息收集', t.collected, '条', '累计', cum.collected) +
      kpiCard('accent-purple', '今日信息转换', t.converted, '条', '累计', cum.converted) +
      kpiCard('accent-blue', '今日客户到访', t.visited, '组', '累计', cum.visited) +
      kpiCard('accent-gold', '今日逼定', t.forced, '组', '累计', cum.forced) +
      kpiCard('accent-green', '今日成交', t.deals, '组', '累计', cum.deals) +
      kpiCard('accent-orange', '今日转换率', convRate, '%', null, null,
        `<span>累计转换率<b>${cumRate}%</b></span>`);
  }

  const AXIS_STYLE = { axisLine: { lineStyle: { color: '#3a4250' } }, axisLabel: { color: '#8a929e' }, splitLine: { lineStyle: { color: '#232831' } } };

  function renderTrend() {
    const dates = App.recentDates(14);
    const rows = dates.map(d => App.getDay(d));
    if (typeof echarts === 'undefined') {
      App.$('#trend-chart').innerHTML = '<div class="empty xs">图表库未加载（网络限制），数据统计不受影响</div>';
      return;
    }
    const chart = echarts.init(App.$('#trend-chart'));
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: '#232932', borderColor: '#3a4250', textStyle: { color: '#e8eaed' } },
      legend: { data: ['信息收集', '信息转换', '客户到访'], textStyle: { color: '#a8b0bb' }, top: 0, icon: 'roundRect' },
      grid: { left: 8, right: 12, top: 38, bottom: 4, containLabel: true },
      xAxis: Object.assign({ type: 'category', data: dates.map(d => d.slice(5)), boundaryGap: true }, AXIS_STYLE),
      yAxis: Object.assign({ type: 'value', minInterval: 1 }, AXIS_STYLE),
      series: [
        { name: '信息收集', type: 'bar', data: rows.map(r => r.collected), itemStyle: { color: '#45c8d6', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
        { name: '信息转换', type: 'bar', data: rows.map(r => r.converted), itemStyle: { color: '#bf5af2', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
        { name: '客户到访', type: 'line', data: rows.map(r => r.visited), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: '#3370ff', width: 2.5 }, itemStyle: { color: '#3370ff' }, areaStyle: { color: 'rgba(51,112,255,.12)' } }
      ]
    });
    window.addEventListener('resize', () => chart.resize());
  }

  function renderFunnel() {
    const cum = App.cumulative();
    if (typeof echarts === 'undefined') {
      App.$('#funnel-chart').innerHTML = '<div class="empty xs">图表库未加载（网络限制），数据统计不受影响</div>';
      return;
    }
    const chart = echarts.init(App.$('#funnel-chart'));
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: '#232932', borderColor: '#3a4250', textStyle: { color: '#e8eaed' }, formatter: '{b}: {c}' },
      series: [{
        type: 'funnel', left: '8%', right: '8%', top: 12, bottom: 8, minSize: '28%',
        label: { color: '#e8eaed', formatter: '{b} {c}', fontSize: 12 },
        labelLine: { lineStyle: { color: '#3a4250' } },
        itemStyle: { borderColor: '#181c22', borderWidth: 2 },
        data: [
          { value: cum.collected, name: '信息收集', itemStyle: { color: '#45c8d6' } },
          { value: cum.converted, name: '信息转换', itemStyle: { color: '#bf5af2' } },
          { value: cum.visited, name: '客户到访', itemStyle: { color: '#3370ff' } },
          { value: cum.forced, name: '逼定', itemStyle: { color: '#f5c542' } },
          { value: cum.deals, name: '成交', itemStyle: { color: '#2eb872' } }
        ]
      }]
    });
    window.addEventListener('resize', () => chart.resize());
  }

  function podiumHtml(rank) {
    const p = i => rank[i] || { name: '—', v: '' };
    const block = (cls, i) => `<div class="p-item ${cls}">
      ${cls === 'p1' ? '<div class="p-crown"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 18h20l-1.5-9-5 3.5L12 4 8.5 12.5l-5-3.5z"/></svg></div>' : ''}
      <div class="p-name">${App.esc(p(i).name)}</div>
      <div class="p-block">${p(i).v}</div></div>`;
    return `<div class="podium">${block('p2', 1)}${block('p1', 0)}${block('p3', 2)}</div>`;
  }

  function top2Html(day, metric) {
    const [a, b] = App.top2(day, metric);
    return `<div class="semibold small">冠军 ${App.esc(a)}</div><div class="muted xs mt8">复一 ${App.esc(b)}</div>`;
  }

  function renderPodiums() {
    const t = App.today();
    const cum = App.cumulative();
    App.$('#info-podium').innerHTML = podiumHtml(App.rank(cum, 'collected'));
    App.$('#visit-podium').innerHTML = podiumHtml(App.rank(cum, 'visited'));
    App.$('#info-today').innerHTML = top2Html(t, 'collected');
    App.$('#info-total').innerHTML = top2Html(cum, 'collected');
    App.$('#visit-today').innerHTML = top2Html(t, 'visited');
    App.$('#visit-total').innerHTML = top2Html(cum, 'visited');
  }

  function renderRank() {
    const metric = App.$('#rank-metric').value;
    const cum = App.cumulative();
    const rank = App.rank(cum, metric).slice(0, 8);
    const max = rank[0] ? rank[0].v : 1;
    App.$('#rank-list').innerHTML = rank.length ? rank.map((r, i) => `
      <div class="rank-item">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-name">${App.esc(r.name)}</span>
        <span class="rank-bar"><i style="width:${Math.round(r.v / max * 100)}%"></i></span>
        <span class="rank-val">${r.v}</span>
      </div>`).join('') : '<div class="empty xs">暂无数据</div>';
  }

  function renderLists() {
    const all = App.data.customers.customers;
    const follow = all.filter(c => ['已邀约', '已首访', '方案沟通', '再访跟进', '逼定中'].includes(c.stage))
      .sort((a, b) => (a.lastVisitAt || a.firstReportAt || '').localeCompare(b.lastVisitAt || b.firstReportAt || ''))
      .slice(0, 6);
    const aList = all.filter(c => c.intentLevel === 'A' && c.stage !== '已成交' && c.stage !== '已流失').slice(0, 6);
    App.$('#follow-list').innerHTML = follow.length ? follow.map(App.customerRow).join('')
      : '<div class="empty xs">暂无待跟进客户</div>';
    App.$('#a-list').innerHTML = aList.length ? aList.map(App.customerRow).join('')
      : '<div class="empty xs">暂无A类客户</div>';
  }
})();
