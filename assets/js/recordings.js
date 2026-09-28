/* recordings.js — 录音归档 */
(function () {
  let mode = 'upload';
  const preCustomer = new URLSearchParams(location.search).get('customer');

  document.addEventListener('app:ready', init);

  function init() {
    const sel = App.$('#r-customer');
    sel.innerHTML = '<option value="">请选择客户</option>' +
      App.data.customers.customers.map(c =>
        `<option value="${c.id}" ${c.id === preCustomer ? 'selected' : ''}>${c.name}</option>`).join('');

    App.$('#src-chips').addEventListener('click', e => {
      const ch = e.target.closest('[data-src]');
      if (!ch) return;
      mode = ch.dataset.src;
      App.$$('#src-chips .chip').forEach(x => x.classList.remove('active'));
      ch.classList.add('active');
      App.$('#upload-box').classList.toggle('hide', mode !== 'upload');
      App.$('#link-box').classList.toggle('hide', mode !== 'link');
    });

    App.$('#rec-form').addEventListener('submit', submit);
    renderList();
  }

  async function submit(e) {
    e.preventDefault();
    if (!App.requireEditor()) return;
    const cid = App.$('#r-customer').value;
    if (!cid) { App.toast('请选择关联客户', 'error'); return; }
    const customer = App.data.customers.customers.find(c => c.id === cid);
    let url = '';
    const name = App.$('#r-name').value.trim() || (customer.name + '的沟通录音');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '处理中…';
    try {
      if (mode === 'upload') {
        const file = App.$('#r-file').files[0];
        if (!file) { App.toast('请选择音频文件', 'error'); btn.disabled = false; btn.textContent = '归档录音'; return; }
        if (file.size > 25 * 1024 * 1024) {
          App.toast('文件超过25MB，请改用飞书外链方式', 'error');
          btn.disabled = false; btn.textContent = '归档录音'; return;
        }
        const safe = file.name.replace(/[^\w.\u4e00-\u9fa5-]/g, '_');
        url = await App.uploadRepoFile(`assets/recordings/${cid}_${Date.now()}_${safe}`, file);
      } else {
        url = App.$('#r-url').value.trim();
        if (!url) { App.toast('请粘贴外链', 'error'); btn.disabled = false; btn.textContent = '归档录音'; return; }
      }
      const rec = {
        id: 'R' + Date.now(),
        customerId: cid, customerName: customer.name,
        name, url,
        summary: App.$('#r-summary').value.trim(),
        createdAt: App.nowStr()
      };
      await App.addRecording(rec, customer);
      App.toast('录音已归档', 'success');
      App.$('#rec-form').reset();
      renderList();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '归档录音';
    }
  }

  function isPlayable(url) {
    return /\.(mp3|m4a|wav|aac|ogg|amr)(\?|$)/i.test(url) || /raw\.githubusercontent/.test(url);
  }

  function renderList() {
    const recs = App.data.recordings.recordings;
    App.$('#rec-count').textContent = recs.length;
    App.$('#rec-list').innerHTML = recs.length ? recs.map(r => `
      <div class="card">
        <div class="audio-meta mb8">
          <a class="badge blue" href="customer.html?id=${r.customerId}">${App.esc(r.customerName)}</a>
          <span class="semibold small" style="flex:1">${App.esc(r.name)}</span>
          <span class="muted xs nowrap">${App.esc((r.createdAt || '').slice(0, 16))}</span>
        </div>
        ${isPlayable(r.url)
          ? `<audio controls preload="none" src="${App.esc(r.url)}" style="width:100%"></audio>`
          : `<a class="btn btn-sm" href="${App.esc(r.url)}" target="_blank" rel="noopener">打开录音链接</a>`}
        ${r.summary ? `<div class="small mt8" style="color:var(--text-2);white-space:pre-wrap">${App.esc(r.summary)}</div>` : ''}
      </div>`).join('')
      : '<div class="empty"><div class="e-title">还没有归档录音</div></div>';
  }
})();
