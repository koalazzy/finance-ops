/**
 * 对公业务 UI
 */

const F = FinanceOps;
const CORP_TABS = {
  acceptance: {
    title: '银行承兑汇票贴现',
    desc: '贴息计算 · 实际到账 · 多贴现率对比',
    form: [
      { id: 'a_face', label: '票面金额（万元）', type: 'number', default: 100 },
      { id: 'a_rate', label: '贴现年利率 %', type: 'number', default: 2.0, step: 0.01 },
      { id: 'a_days', label: '剩余天数', type: 'number', default: 90 }
    ],
    calc(p) {
      const face = p.a_face * 10000;
      const r = p.a_rate / 100;
      const result = F.acceptanceDiscount(face, r, p.a_days);
      const rates = [r - 0.005, r - 0.003, r, r + 0.003, r + 0.005].filter(v => v > 0);
      return { result, compare: F.acceptanceCompare(face, p.a_days, rates) };
    },
    render(res) {
      const r = res.result;
      return `
        <div class="card result">
          <h3>贴现结果</h3>
          <table>
            <tr><td>票面金额</td><td class="num">¥${fmt(r.faceValue)}</td></tr>
            <tr><td>贴现利率</td><td class="num">${(r.discountRate*100).toFixed(2)}%</td></tr>
            <tr><td>剩余天数</td><td class="num">${r.remainingDays} 天</td></tr>
            <tr><td>贴现利息</td><td class="num red">¥${fmt(r.discountInterest)}</td></tr>
            <tr class="total-row"><td>实际到账</td><td class="num">¥${fmt(r.actualReceived)}</td></tr>
            <tr><td>实际年化成本率</td><td class="num">${(r.actualAnnualRate*100).toFixed(4)}%</td></tr>
          </table>
        </div>
        <div class="card">
          <h3>多贴现率对比</h3>
          <table>
            <tr><th>贴现率</th><th>贴息</th><th>到账</th><th>年化成本</th></tr>
            ${res.compare.map(c => `<tr>
              <td class="num">${(c.rate*100).toFixed(2)}%</td>
              <td class="num">¥${fmt(c.discountInterest)}</td>
              <td class="num">¥${fmt(c.actualReceived)}</td>
              <td class="num">${(c.actualAnnualRate*100).toFixed(4)}%</td>
            </tr>`).join('')}
          </table>
        </div>
      `;
    }
  },

  lc: {
    title: '国内信用证',
    desc: '全流程费用拆解 · 综合成本率 · vs 流动资金贷款',
    form: [
      { id: 'l_amount', label: '信用证金额（万元）', type: 'number', default: 500 },
      { id: 'l_months', label: '期限（月）', type: 'number', default: 6 },
      { id: 'l_loan', label: '流贷对比年利率 %', type: 'number', default: 3.5, step: 0.01 },
      { id: 'l_issuing', label: '开证费率 %', type: 'number', default: 0.1, step: 0.01 },
      { id: 'l_nego', label: '议付费率 %', type: 'number', default: 0.2, step: 0.01 },
      { id: 'l_accept', label: '承兑费月率 %', type: 'number', default: 0.06, step: 0.01 }
    ],
    calc(p) {
      const amount = p.l_amount * 10000;
      const fees = {
        issuingFeeRate: p.l_issuing / 100,
        negotiationFeeRate: p.l_nego / 100,
        acceptanceFeeMonthly: p.l_accept / 100
      };
      return F.lcVsLoan(amount, p.l_months, fees, p.l_loan / 100);
    },
    render(c) {
      const d = c.lc.detail;
      return `
        <div class="card result">
          <h3>信用证费用明细</h3>
          <table>
            <tr><td>开证费</td><td class="num">¥${fmt(d.issuingFee)}</td></tr>
            <tr><td>通知费</td><td class="num">¥${fmt(d.advisingFee)}</td></tr>
            <tr><td>议付费</td><td class="num">¥${fmt(d.negotiationFee)}</td></tr>
            <tr><td>承兑费</td><td class="num">¥${fmt(d.acceptanceFee)}</td></tr>
            <tr><td>不符点费</td><td class="num">¥${fmt(d.discrepancyFee)}</td></tr>
            <tr><td>付款费</td><td class="num">¥${fmt(d.paymentFee)}</td></tr>
            <tr><td>电讯费</td><td class="num">¥${fmt(d.cableFee)}</td></tr>
            <tr class="total-row"><td>费用合计</td><td class="num">¥${fmt(c.lc.totalCost)}</td></tr>
            <tr><td>综合成本率</td><td class="num">${(c.lc.costRate*100).toFixed(4)}%</td></tr>
          </table>
        </div>
        <div class="card">
          <h3>信用证 vs 流动资金贷款</h3>
          <table>
            <tr><th></th><th>国内信用证</th><th>流动资金贷款</th></tr>
            <tr><td>总成本</td><td class="num">¥${fmt(c.lc.totalCost)}</td><td class="num">¥${fmt(c.loan.totalCost)}</td></tr>
            <tr><td>成本率</td><td class="num">${(c.lc.costRate*100).toFixed(4)}%</td><td class="num">${(c.loan.costRate*100).toFixed(4)}%</td></tr>
            <tr><td>结论</td><td colspan="2" class="num ${c.difference < 0 ? 'green' : 'red'}">${c.recommendation}</td></tr>
          </table>
        </div>
      `;
    }
  },

  structured: {
    title: '结构性存款',
    desc: '保底收益 · 高收益触发 · 年化对比',
    form: [
      { id: 's_amount', label: '本金（万元）', type: 'number', default: 1000 },
      { id: 's_days', label: '期限（天）', type: 'number', default: 90 },
      { id: 's_floor', label: '保底年利率 %', type: 'number', default: 1.0, step: 0.01 },
      { id: 's_cap', label: '高收益档年利率 %', type: 'number', default: 3.2, step: 0.01 },
      { id: 's_triggered', label: '触发高收益', type: 'checkbox', value: false }
    ],
    calc(p) {
      return F.structuredDeposit(p.s_amount * 10000, p.s_days, p.s_floor / 100, p.s_cap / 100, p.s_triggered);
    },
    render(r) {
      return `
        <div class="card result">
          <h3>结构性存款收益</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>期限</td><td class="num">${r.days} 天</td></tr>
            <tr><td>保底收益</td><td class="num">¥${fmt(r.floorReturn)}（${(r.floorAnnual*100).toFixed(4)}% 年化）</td></tr>
            <tr><td>高收益触发</td><td class="num green">¥${fmt(r.ceilingReturn)}（${(r.ceilingAnnual*100).toFixed(4)}% 年化）</td></tr>
            <tr class="total-row"><td>实际收益${r.triggered ? '（已触发）' : '（保底）'}</td>
              <td class="num">¥${fmt(r.actualReturn)}</td></tr>
            <tr><td>实际年化</td><td class="num">${(r.actualAnnual*100).toFixed(4)}%</td></tr>
          </table>
        </div>
      `;
    }
  },

  cd: {
    title: '对公大额存单',
    desc: '¥1,000 万起存 · 固定利率 · 到期一次还本付息',
    form: [
      { id: 'cd_amount', label: '本金（万元）', type: 'number', default: 1000 },
      { id: 'cd_rate', label: '年利率 %', type: 'number', default: 1.9, step: 0.01 },
      { id: 'cd_years', label: '期限（年）', type: 'number', default: 2 }
    ],
    calc(p) {
      return F.corporateCD(p.cd_amount * 10000, p.cd_rate / 100, p.cd_years);
    },
    render(r) {
      return `
        <div class="card result">
          <h3>对公大额存单</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>年利率</td><td class="num">${(r.annualRate*100).toFixed(2)}%</td></tr>
            <tr><td>期限</td><td class="num">${r.years} 年</td></tr>
            <tr><td>利息</td><td class="num">¥${fmt(r.interest)}</td></tr>
            <tr class="total-row"><td>到期本息合计</td><td class="num">¥${fmt(r.maturityValue)}</td></tr>
          </table>
          <p class="hint">⚠️ 对公存单利息需缴纳 25% 企业所得税。税后利息：¥${fmt(r.interest * 0.75)}</p>
        </div>
      `;
    }
  },

  notice: {
    title: '对公通知存款',
    desc: '1 天通知 / 7 天通知 · 按实际存期计息',
    form: [
      { id: 'n_amount', label: '本金（万元）', type: 'number', default: 500 },
      { id: 'n_rate', label: '年利率 %', type: 'number', default: 1.35, step: 0.01 },
      { id: 'n_days', label: '实际存期（天）', type: 'number', default: 30 }
    ],
    calc(p) {
      return F.noticeDeposit(p.n_amount * 10000, p.n_days, p.n_rate / 100);
    },
    render(r) {
      return `
        <div class="card result">
          <h3>通知存款收益</h3>
          <table>
            <tr><td>本金</td><td class="num">¥${fmt(r.principal)}</td></tr>
            <tr><td>年利率</td><td class="num">${(r.annualRate*100).toFixed(2)}%</td></tr>
            <tr><td>实际存期</td><td class="num">${r.days} 天</td></tr>
            <tr><td>利息</td><td class="num">¥${fmt(r.interest)}</td></tr>
            <tr><td>等效年化</td><td class="num">${(r.annualized*100).toFixed(4)}%</td></tr>
            <tr class="total-row"><td>到期本息</td><td class="num">¥${fmt(r.maturityValue)}</td></tr>
          </table>
        </div>
      `;
    }
  },

  agreement: {
    title: '协定存款',
    desc: '基本额度 + 超额部分 · 分层计息',
    form: [
      { id: 'ag_basic', label: '基本额度（万元）', type: 'number', default: 100 },
      { id: 'ag_excess', label: '超额部分（万元）', type: 'number', default: 900 },
      { id: 'ag_days', label: '计息天数', type: 'number', default: 90 },
      { id: 'ag_basic_rate', label: '基本利率 %', type: 'number', default: 0.2, step: 0.01 },
      { id: 'ag_agree_rate', label: '协定利率 %', type: 'number', default: 1.25, step: 0.01 }
    ],
    calc(p) {
      return F.agreementDeposit(p.ag_basic * 10000, p.ag_excess * 10000, p.ag_days,
        p.ag_basic_rate / 100, p.ag_agree_rate / 100);
    },
    render(r) {
      return `
        <div class="card result">
          <h3>协定存款收益</h3>
          <table>
            <tr><td>基本额度 (${
              (r.basicAmount/10000).toFixed(0)}万)</td><td class="num">¥${fmt(r.basicInterest)}（活期 ${(r.basicInterest / r.basicAmount * 360 / r.days * 100).toFixed(2)}%）</td></tr>
            <tr><td>超额部分 (${
              (r.excessAmount/10000).toFixed(0)}万)</td><td class="num">¥${fmt(r.excessInterest)}（协定）</td></tr>
            <tr class="total-row"><td>合计利息</td><td class="num">¥${fmt(r.totalInterest)}</td></tr>
            <tr><td>综合等效年化</td><td class="num">${(r.blendedAnnualRate*100).toFixed(4)}%</td></tr>
          </table>
        </div>
      `;
    }
  }
};

// Shared rendering infra
let curTab = 'acceptance';
function $(id) { return document.getElementById(id); }
function fmt(n) { return n.toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}); }

function renderForm(tabKey) {
  const t = CORP_TABS[tabKey];
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
  CORP_TABS[tabKey].form.forEach(f => {
    const el = $(f.id); if (!el) return;
    params[f.id] = f.type === 'checkbox' ? el.checked : (parseFloat(el.value) || 0);
  });
  return params;
}

function doCalc(e) {
  e.preventDefault();
  const t = CORP_TABS[curTab];
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
  $('content').innerHTML = renderForm('acceptance');
});
