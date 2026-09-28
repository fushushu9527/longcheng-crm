/* daily-page.js — 日报表渲染与编辑 */
(function () {
  let date = App.todayStr();
  const blank = () => ({ collected: 0, converted: 0, visited: 0, levelA: 0, levelB: 0, levelC: 0, forced: 0, deals: 0, byStaff: {} });

  document.addEventListener('app:ready', init);

  function init() {
    App.$('#date-pick').value = date;
    App.$('#date-pick').onchange = e => { date = e.target.value; render(); };
    App.$('#btn-save').onclick = save;
    App.$('#btn-add-plan').onclick = addPlan;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-del-plan]');
      if (b) delPlan(+b.dataset.delPlan);
    });
    render();
  }

  function render() {
    const auto = App.buildAutoStats()[date] || blank();
    const day = App.getDay(date);
    const cum = App.cumulative(date);
    const man = (App.data.daily.days[date] || {}).manual || {};
    App.$('#week-pill').textContent = App.weekday(date);

    const inCell = (field, av) =>
      `<td class="input-cell"><input type="number" min="0" inputmode="numeric" data-m="${field}" value="${man[field] != null ? man[field] : ''}" placeholder="${av}"></td>`;
    const autoCell = v => `<td class="auto-cell">${v}</td>`;
    const topCells = (d, m) => {
      const [a, b] = App.top2(d, m);
      return `<td>${App.esc(a)}</td><td>${App.esc(b)}</td>`;
    };

    /* ---- 信息资源 + 信息擂台 ---- */
    const need = Math.max(cum.collected - cum.converted, 0);
    const needRate = App.rate(need, cum.collected);
    App.$('#t-info').innerHTML = `
      <tr><th class="section-th" colspan="8">信息资源统计</th><th class="section-th" colspan="4">信息擂台</th></tr>
      <tr>
        <th>收集今日</th><th>收集累计</th>
        <th>今日转换</th><th>今日转换率</th>
        <th>累计转换</th><th>累计转换率</th>
        <th>还需邀约</th><th>未转换比例</th>
        <th>今日冠军</th><th>今日复一</th><th>累计冠军</th><th>累计复一</th>
      </tr>
      <tr>
        ${inCell('collected', auto.collected)}${autoCell(cum.collected)}
        ${inCell('converted', auto.converted)}${autoCell(App.rate(day.converted, day.collected) + '%')}
        ${autoCell(cum.converted)}${autoCell(App.rate(cum.converted, cum.collected) + '%')}
        ${autoCell(need)}${autoCell(needRate + '%')}
        ${topCells(day, 'collected').replace(/<td>/g, '<td class="auto-cell">')}
      </tr>`;

    /* ---- 到访统计 + 到访擂台 ---- */
    const lvTot = day.levelA + day.levelB + day.levelC;
    App.$('#t-visit').innerHTML = `
      <tr><th class="section-th" colspan="8">客户到访统计</th><th class="section-th" colspan="4">到访擂台</th></tr>
      <tr>
        <th>接待今日</th><th>接待累计</th>
        <th>A类</th><th>A占比</th><th>B类</th><th>B占比</th><th>C类</th><th>C占比</th>
        <th>今日冠军</th><th>今日复一</th><th>累计冠军</th><th>累计复一</th>
      </tr>
      <tr>
        ${inCell('visited', auto.visited)}${autoCell(cum.visited)}
        ${inCell('levelA', auto.levelA)}${autoCell(App.rate(day.levelA, lvTot) + '%')}
        ${inCell('levelB', auto.levelB)}${autoCell(App.rate(day.levelB, lvTot) + '%')}
        ${inCell('levelC', auto.levelC)}${autoCell(App.rate(day.levelC, lvTot) + '%')}
        ${topCells(day, 'visited').replace(/<td>/g, '<td class="auto-cell">')}
      </tr>`;

    /* ---- 逼定布局 ---- */
    App.$('#t-force').innerHTML = staffTable('近期总逼定数量', 'forced', inCell, autoCell, day, cum, man, auto);

    /* ---- 成交统计 ---- */
    App.$('#t-deal').innerHTML = staffTable('客户成交统计', 'deals', inCell, autoCell, day, cum, man, auto);

    /* ---- 布局清单 / 注意事项 ---- */
    renderPlans();
    App.$('#force-notes').value = man.forceNotes || '';
  }

  function staffTable(title, metric, inCell, autoCell, day, cum, man, auto) {
    const staff = App.data.settings.staff;
    const head1 = `<th class="section-th" colspan="2">${title}</th>` +
      staff.map(s => `<th class="section-th" colspan="2">${s}</th>`).join('');
    const head2 = '<th>今日</th><th>累计</th>'.repeat(6);
    const staffCells = staff.map(s =>
      autoCell((day.byStaff[s] || {})[metric] || 0) + autoCell((cum.byStaff[s] || {})[metric] || 0)).join('');
    const names = new Set([...Object.keys(day.byStaff), ...Object.keys(cum.byStaff)]
      .filter(n => !staff.includes(n) && n !== '未填写'));
    let extra = '';
    for (const n of names) {
      extra += `<tr><td colspan="2">${App.esc(n)}</td>
        <td class="auto-cell">${(day.byStaff[n] || {})[metric] || 0}</td>
        <td class="auto-cell">${(cum.byStaff[n] || {})[metric] || 0}</td>
        <td colspan="8"></td></tr>`;
    }
    const first = metric === 'forced'
      ? inCell('forced', auto.forced) + autoCell(cum.forced)
      : inCell('deals', auto.deals) + autoCell(cum.deals);
    return `<tr>${head1}</tr><tr>${head2}</tr><tr>${first}${staffCells}</tr>${extra}`;
  }

  /* ---------------- 逼定布局清单 ---------------- */
  function renderPlans() {
    const plans = App.data.daily.forcedPlans;
    const todayCount = plans.filter(p => p.planDate === date).length;
    const head = `<span class="card-note">今日布局 ${todayCount} 组 · 累计 ${plans.length} 组</span>`;
    const title = App.$('#plan-list').previousElementSibling;
    if (title) title.querySelector('.card-note')?.remove();
    if (title) title.insertAdjacentHTML('beforeend', head);
    App.$('#plan-list').innerHTML = plans.length ? plans.map((p, i) => `
      <div class="flex aic gap8" style="padding:9px 0;border-bottom:1px solid var(--border-soft)">
        <span class="badge gold nowrap">${p.planDate}</span>
        <span class="small" style="flex:1;min-width:0">
          <b>${App.esc(p.customerName)}</b> · ${App.esc(p.staff || '未分配')}
          ${p.note ? '<span class="muted"> · ' + App.esc(p.note) + '</span>' : ''}
        </span>
        <button class="btn btn-sm btn-danger nowrap" data-del-plan="${i}">删除</button>
      </div>`).join('') : '<div class="muted xs" style="padding:8px 0">暂无布局计划</div>';
  }

  function addPlan() {
    if (!App.requireEditor()) return;
    const customers = App.data.customers.customers;
    const copts = customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const sopts = App.data.settings.staff.map(s => `<option>${s}</option>`).join('');
    const mask = App.openModal('添加逼定布局', `
      <div class="form-row"><label>计划逼定日期</label><input class="input" type="date" id="pl-date" value="${date}"></div>
      <div class="form-row"><label>客户</label><select class="input" id="pl-customer">${copts}</select></div>
      <div class="form-row"><label>负责专员</label><select class="input" id="pl-staff">${sopts}</select></div>
      <div class="form-row"><label>注意事项</label><input class="input" id="pl-note"></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="pl-save">保存</button></div>`);
    mask.querySelector('#pl-save').onclick = async () => {
      const cid = mask.querySelector('#pl-customer').value;
      const c = customers.find(x => x.id === cid);
      App.data.daily.forcedPlans.push({
        planDate: mask.querySelector('#pl-date').value,
        customerId: cid, customerName: c ? c.name : '未知',
        staff: mask.querySelector('#pl-staff').value,
        note: mask.querySelector('#pl-note').value.trim()
      });
      await App.saveData('daily');
      App.closeModal(); App.toast('布局已添加', 'success'); renderPlans();
    };
  }

  async function delPlan(i) {
    if (!App.requireEditor()) return;
    if (await App.confirm('确定删除该布局计划？')) {
      App.data.daily.forcedPlans.splice(i, 1);
      await App.saveData('daily');
      renderPlans();
    }
  }

  /* ---------------- 保存 ---------------- */
  async function save() {
    if (!App.requireEditor()) return;
    if (!App.data.daily.days[date]) App.data.daily.days[date] = { manual: {} };
    const manual = App.data.daily.days[date].manual || (App.data.daily.days[date].manual = {});
    App.$$('[data-m]').forEach(inp => {
      const k = inp.dataset.m;
      if (inp.value !== '') manual[k] = +inp.value;
      else delete manual[k];
    });
    manual.forceNotes = App.$('#force-notes').value.trim();
    await App.saveData('daily');
    App.toast('日报已保存', 'success');
    render();
  }
})();
