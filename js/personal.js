/**
 * 个人业务 UI
 */

const F = FinanceOps;
const PERSONAL_TABS = {
  mortgage: {
    title: '住房按揭测算',
    desc: '等额本息 vs 等额本金 · 提前还款损益 · 敏感性分析',
    form: [
      { id: 'm_principal', label: '贷款本金（万元）', type: 'number', default: 300 },
      { id: 'm_years', label: '贷款年限', type: 'number', default: 30 },
      { id: 'm_rate', label: '年利率 %', type: 'number', default: 3.35, step: 0.01 },
      { id: 'm_early', label: '提前还款金额（万元，0=不提前）', type: 'number', default: 0 },
      { id: 'm_paid', label: '已还月数', type: 'number', default: 60 }
    ],
    calc(p) {
      const pr = p.m_principal * 10000;
      const r = p.m_rate / 100;
      const ei = F.equalInstallment(pr, r, p.m_years);
      const ep = F.equalPrincipal(pr, r, p.m_years);
      let early = null;
      if (p.m_early > 0) early = F.earlyRepayment(pr, r, p.m_years, p.m_paid, p.m_early * 10000);
      return { ei, ep, early, params: p };
    },
    render(res) {
      const { ei, ep, early, params } = res;
      const sr = [params.m_rate - 0.5, params.m_rate, params.m_rate + 0.5];
      const sa = sr.map(rt => {
        const c = F.equalInstallment(params.m_principal * 10000, rt / 100, params.m_years);
        return { rate: rt, monthly: c.monthly, total: c.totalInterest };
      });
      return `
        <div class="card result">
          <h3>还款方案对比</h3>
          <table>
            <tr><th></th><th>等额本息</th><th>等额本金</th></tr>
            <tr><td>月供</td><td class="num">¥${fmt(ei.monthly)}<br><span class="hint">固定不变</span></td>
              <td class="num">¥${fmt(ep.firstMonthly)} → ¥${fmt(ep.lastMonthly)}</td></tr>
            <tr><td>总利息</td><td class="num">¥${fmt(ei.totalInterest)}</td>
              <td class="num">¥${fmt(ep.totalInterest)}</td></tr>
            <tr class="total-row"><td>总还款</td><td class="num">¥${fmt(ei.totalPayment)}</td>
              <td class="num">¥${fmt(ep.totalPayment)}</td></tr>
            <tr><td>节省利息</td><td></td>
              <td class="num green">¥${fmt(ei.totalInterest - ep.totalInterest)}</td></tr>
          </table>
        </div>
        ${early ? `
        <div class="card result">
          <h3>提前还款方案（已还 ${params.m_paid} 期，提前还 ¥${fmt(params.m_early * 10000)}）</h3>
          <p>当前剩余本金：<strong>¥${fmt(early.currentBalance)}</strong></p>
          <table>
            <tr><th></th><th>缩短期限</th><th>减少月供</th></tr>
            <tr><td>新月供</td><td class="num">不变 ¥${fmt(ei.monthly)}</td>
              <td class="num">¥${fmt(early.optionB_reduceMonthly.newMonthly)}</td></tr>
            <tr><td>月供减少</td><td class="num">—</td>
              <td class="num green">¥${fmt(early.optionB_reduceMonthly.monthlyReduced)}</td></tr>
            <tr><td>节省利息</td><td class="num green"> 期限缩短</td>
              <td class="num green">¥${fmt(early.optionB_reduceMonthly.interestSaved)}</td></tr>
          </table>
        </div>` : ''}
        <div class="card">
          <h3>利率敏感性（±50bp）</h3>
          <table>
            <tr><th>年利率</th><th>等额本息月供</th><th>总利息</th></tr>
            ${sa.map(s => `<tr${s.rate === params.m_rate ? ' class="base-row"':''}>
              <td class="num">${s.rate.toFixed(2)}%</td>
              <td class="num">¥${fmt(s.monthly)}</td>
              <td class="num">¥${fmt(s.total)}</td>
            </tr>`).join('')}
          </table>
        </div>
      `;
    }
  },

  deposit: {
    title: '个人定期存款',
    desc: '整存整取 · 到期一次还本付息',
    form: [
      { id: 'd_amount', label: '本金（万元）', type: 'number', default: 50 },
      { id: 'd_rate', label: '年利率 %', type: 'number', default: 1.5, step: 0.01 },
      { id: 'd_years', label: '期限（年）', type: 'number', default: 3 }
    ],
    calc(p) { return F.fixedDeposit(p.d_amount * 10000, p.d_rate / 100, p.d_years); },
    render(r) {
      return `
        <div class="card result">
          <h3>定期存款收益</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>年利率</td><td class="num">${(r.annualRate*100).toFixed(2)}%</td></tr>
            <tr><td>期限</td><td class="num">${r.years} 年</td></tr>
            <tr><td>利息</td><td class="num">¥${fmt(r.interest)}</td></tr>
            <tr class="total-row"><td>到期本息</td><td class="num">¥${fmt(r.maturityValue)}</td></tr>
          </table>
          <p class="hint">⚠️ 提前支取按活期利率（~0.2%）计息</p>
        </div>
      `;
    }
  },

  cd: {
    title: '个人大额存单',
    desc: '¥20 万起存 · 利率高于普通定存',
    form: [
      { id: 'cd_amount', label: '本金（万元）', type: 'number', default: 50 },
      { id: 'cd_rate', label: '年利率 %', type: 'number', default: 2.15, step: 0.01 },
      { id: 'cd_years', label: '期限（年）', type: 'number', default: 3 }
    ],
    calc(p) { return F.corporateCD(p.cd_amount * 10000, p.cd_rate / 100, p.cd_years); },
    render(r) {
      return `
        <div class="card result">
          <h3>大额存单（个人）</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>年利率</td><td class="num">${(r.annualRate*100).toFixed(2)}%</td></tr>
            <tr><td>期限</td><td class="num">${r.years} 年</td></tr>
            <tr><td>利息</td><td class="num">¥${fmt(r.interest)}</td></tr>
            <tr class="total-row"><td>到期本息</td><td class="num">¥${fmt(r.maturityValue)}</td></tr>
          </table>
          <p class="hint">✅ 个人存款利息免征个人所得税</p>
        </div>
      `;
    }
  },

  fund: {
    title: '货币基金',
    desc: '七日年化收益率估算',
    form: [
      { id: 'f_amount', label: '本金（万元）', type: 'number', default: 10 },
      { id: 'f_rate', label: '七日年化 %', type: 'number', default: 1.8, step: 0.01 },
      { id: 'f_days', label: '持有天数', type: 'number', default: 90 }
    ],
    calc(p) { return F.moneyFund(p.f_amount * 10000, p.f_rate / 100, p.f_days); },
    render(r) {
      return `
        <div class="card result">
          <h3>货币基金收益估算</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>七日年化</td><td class="num">${(r.annual7Day*100).toFixed(2)}%</td></tr>
            <tr><td>持有天数</td><td class="num">${r.days} 天</td></tr>
            <tr class="total-row"><td>预估收益</td><td class="num">¥${fmt(r.estimatedReturn)}</td></tr>
            <tr><td>到期总额</td><td class="num">¥${fmt(r.totalValue)}</td></tr>
          </table>
          <p class="hint">⚠️ 七日年化为历史数据，不代表未来收益</p>
        </div>
      `;
    }
  },

  nav: {
    title: '净值型理财',
    desc: '申购赎回 · 费用穿透 · 实际到手',
    form: [
      { id: 'nv_amount', label: '申购金额（万元）', type: 'number', default: 50 },
      { id: 'nv_buy', label: '申购净值', type: 'number', default: 1.0, step: 0.0001 },
      { id: 'nv_sell', label: '赎回净值', type: 'number', default: 1.025, step: 0.0001 },
      { id: 'nv_days', label: '持有天数', type: 'number', default: 180 },
      { id: 'nv_mgmt', label: '管理费率 %/年', type: 'number', default: 0.3, step: 0.01 },
      { id: 'nv_custody', label: '托管费率 %/年', type: 'number', default: 0.03, step: 0.01 }
    ],
    calc(p) {
      return F.navWealth(p.nv_amount * 10000, p.nv_buy, p.nv_sell, p.nv_days, {
        manageFeeRate: p.nv_mgmt / 100,
        custodyFeeRate: p.nv_custody / 100
      });
    },
    render(r) {
      return `
        <div class="card result">
          <h3>净值型理财</h3>
          <table>
            <tr><td>申购金额</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>申购净值 / 赎回净值</td><td class="num">${r.buyNav} / ${r.sellNav}</td></tr>
            <tr><td>持有份额</td><td class="num">${r.units}</td></tr>
            <tr><td>赎回到账</td><td class="num">¥${fmt(r.netValue)}</td></tr>
            <tr class="${r.profit >= 0 ? 'green' : 'red'}"><td>实际收益</td>
              <td class="num ${r.profit >= 0 ? 'green' : 'red'}">¥${fmt(r.profit)}</td></tr>
            <tr><td>年化收益率</td><td class="num">${(r.annualized*100).toFixed(4)}%</td></tr>
          </table>
          <h4 style="margin-top:12px">费用明细</h4>
          <table>
            <tr><td>管理费</td><td class="num">¥${fmt(r.fees.manageFee)}</td></tr>
            <tr><td>托管费</td><td class="num">¥${fmt(r.fees.custodyFee)}</td></tr>
          </table>
        </div>
      `;
    }
  },

  bond: {
    title: '国债',
    desc: '一级认购 / 二级买入 · 免税优势',
    form: [
      { id: 'b_face', label: '面值（万元）', type: 'number', default: 50 },
      { id: 'b_rate', label: '票面利率 %', type: 'number', default: 2.5, step: 0.01 },
      { id: 'b_years', label: '剩余年限', type: 'number', default: 3 },
      { id: 'b_price', label: '买入价（万元，0=面值买入）', type: 'number', default: 0 }
    ],
    calc(p) {
      const bp = p.b_price > 0 ? p.b_price * 10000 : null;
      return F.treasuryBond(p.b_face * 10000, p.b_rate / 100, p.b_years, bp);
    },
    render(r) {
      return `
        <div class="card result">
          <h3>国债收益${r.type === '二级买入' ? '（二级市场）' : '（一级认购）'}</h3>
          <table>
            <tr><td>面值</td><td class="num">¥${fmt(r.faceValue)}</td></tr>
            <tr><td>票面利率</td><td class="num">${(r.couponRate*100).toFixed(2)}%</td></tr>
            <tr><td>每年利息</td><td class="num">¥${fmt(r.annualCoupon)}</td></tr>
            ${r.type === '二级买入' ? `
            <tr><td>买入价</td><td class="num">¥${fmt(r.buyPrice)}</td></tr>
            <tr><td>价差收益</td><td class="num">¥${fmt(r.priceDiff)}</td></tr>
            <tr><td>到期收益率 YTM</td><td class="num">${(r.ytm*100).toFixed(4)}%</td></tr>` : ''}
            <tr class="total-row"><td>总收益</td><td class="num">¥${fmt(r.totalReturn)}</td></tr>
          </table>
          <p class="hint">✅ 国债利息收入免征个人所得税</p>
        </div>
      `;
    }
  },

  broker: {
    title: '券商收益凭证',
    desc: '约定年化 · 固定收益型',
    form: [
      { id: 'br_amount', label: '本金（万元）', type: 'number', default: 50 },
      { id: 'br_rate', label: '约定年化 %', type: 'number', default: 2.8, step: 0.01 },
      { id: 'br_days', label: '期限（天）', type: 'number', default: 90 }
    ],
    calc(p) { return F.brokerNote(p.br_amount * 10000, p.br_rate / 100, p.br_days); },
    render(r) {
      return `
        <div class="card result">
          <h3>券商收益凭证</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>约定年化</td><td class="num">${(r.annualRate*100).toFixed(2)}%</td></tr>
            <tr><td>期限</td><td class="num">${r.days} 天</td></tr>
            <tr><td>到期收益</td><td class="num">¥${fmt(r.return)}</td></tr>
            <tr class="total-row"><td>到期总额</td><td class="num">¥${fmt(r.totalValue)}</td></tr>
          </table>
        </div>
      `;
    }
  }
};

let curTab = 'mortgage';
function $(id) { return document.getElementById(id); }
function fmt(n) { return n.toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}); }

function renderForm(tabKey) {
  const t = PERSONAL_TABS[tabKey];
  let h = `<div class="card"><h2>${t.title}</h2><p class="desc">${t.desc}</p>`;
  h += '<form id="calcForm" onsubmit="return doCalc(event)">';
  t.form.forEach(f => {
    h += `<div class="field"><label for="${f.id}">${f.label}</label>`;
    if (f.type === 'checkbox') h += `<input type="checkbox" id="${f.id}" ${f.value?'checked':''}>`;
    else h += `<input type="${f.type}" id="${f.id}" value="${f.default??''}" ${f.step?`step="${f.step}"`:''}>`;
    h += '</div>';
  });
  h += '<button type="submit" class="btn-calc">开始计算</button></form></div><div id="result"></div>';
  return h;
}

function readForm(tabKey) {
  const params = {};
  PERSONAL_TABS[tabKey].form.forEach(f => {
    const el = $(f.id); if (!el) return;
    params[f.id] = f.type === 'checkbox' ? el.checked : (parseFloat(el.value) || 0);
  });
  return params;
}

function doCalc(e) {
  e.preventDefault();
  const t = PERSONAL_TABS[curTab];
  const res = t.calc(readForm(curTab));
  $('result').innerHTML = t.render(res);
  $('result').scrollIntoView({behavior:'smooth'});
  return false;
}

function switchTab(k) {
  curTab = k;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector(`[data-tab="${k}"]`).classList.add('active');
  $('content').innerHTML = renderForm(k);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('content').innerHTML = renderForm('mortgage');
});
