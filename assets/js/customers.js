/* customers.js — 客户档案列表 */
(function () {
  let filter = new URLSearchParams(location.search).get('filter') || 'all';
  if (filter === 'follow') filter = 'follow';
  let kw = '';

  document.addEventListener('app:ready', init);

  function init() {
    // 同步 URL 筛选到 chips
    App.$$('#filter-chips [data-f]').forEach(ch => {
      if (ch.dataset.f === filter) {
        App.$$('#filter-chips .chip').forEach(x => x.classList.remove('active'));
        ch.classList.add('active');
      }
    });
    App.$('#filter-chips').addEventListener('click', e => {
      const ch = e.target.closest('[data-f]');
      if (!ch) return;
      filter = ch.dataset.f;
      App.$$('#filter-chips .chip').forEach(x => x.classList.remove('active'));
      ch.classList.add('active');
      render();
    });
    App.$('#kw').addEventListener('input', e => { kw = e.target.value.trim(); render(); });
    App.$('#btn-new').onclick = newCustomerModal;
    render();
  }

  function applyFilter(list) {
    if (filter === 'follow')
      list = list.filter(c => ['已邀约', '已首访', '方案沟通', '再访跟进', '逼定中'].includes(c.stage));
    else if (['A', 'B', 'C'].includes(filter))
      list = list.filter(c => c.intentLevel === filter);
    else if (filter !== 'all')
      list = list.filter(c => c.stage === filter);
    if (kw) {
      const k = kw.toLowerCase();
      list = list.filter(c => [c.name, c.phone, c.wechat, c.intentProduct, c.source]
        .some(v => (v || '').toLowerCase().includes(k)));
    }
    return list;
  }

  function render() {
    const all = App.data.customers.customers.slice().sort((a, b) =>
      (b.firstReportAt || '').localeCompare(a.firstReportAt || ''));
    const list = applyFilter(all);
    App.$('#count-sub').textContent = `共 ${App.data.customers.customers.length} 位客户，当前显示 ${list.length} 位`;
    App.$('#list').innerHTML = list.length
      ? list.map(App.customerRow).join('')
      : `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <div class="e-title">没有符合条件的客户</div><div class="e-sub">换个筛选词，或点击右上角新增</div></div>`;
  }

  function newCustomerModal() {
    if (!App.requireEditor()) return;
    const mask = App.openModal('新增客户', `
      <div class="form-grid two-col">
        <div class="form-row"><label>客户姓名<span class="req">*</span></label><input class="input" id="nc-name"></div>
        <div class="form-row"><label>客户电话</label><input class="input" id="nc-phone"></div>
        <div class="form-row"><label>微信号</label><input class="input" id="nc-wechat"></div>
        <div class="form-row"><label>客户来源</label>
          <select class="input" id="nc-source">${App.data.settings.sources.map(s => `<option>${s}</option>`).join('')}</select></div>
        <div class="form-row"><label>意向产品</label><input class="input" id="nc-intent" placeholder="如：大三房114㎡"></div>
        <div class="form-row"><label>意向等级</label>
          <select class="input" id="nc-level"><option value="">暂不评级</option><option>A</option><option>B</option><option>C</option></select></div>
      </div>
      <div class="form-row"><label>备注</label><textarea class="input" id="nc-note" style="min-height:64px"></textarea></div>
      <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="nc-save">保存</button></div>`);
    mask.querySelector('#nc-save').onclick = async () => {
      const name = mask.querySelector('#nc-name').value.trim();
      if (!name) { App.toast('请填写客户姓名', 'error'); return; }
      const c = App.newCustomer({
        name,
        phone: mask.querySelector('#nc-phone').value.trim(),
        wechat: mask.querySelector('#nc-wechat').value.trim(),
        source: mask.querySelector('#nc-source').value,
        intent: mask.querySelector('#nc-intent').value.trim(),
        level: mask.querySelector('#nc-level').value
      });
      c.note = mask.querySelector('#nc-note').value.trim();
      App.data.customers.customers.push(c);
      await App.saveData('customers');
      App.closeModal();
      App.toast('已新增客户：' + name, 'success');
      render();
    };
  }
})();
