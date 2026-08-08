/**
 * FinanceOps UI — Tab 切换 + 表单 + 计算 + 渲染
 * 纯 JS，无框架依赖
 */

const F = FinanceOps;

// ============================================================
// Tab 定义
// ============================================================

const TABS = {
  mortgage: {
    title: '🏠 住房按揭测算',
    desc: '等额本息 / 等额本金 / 提前还款损益',
    form: [
      { id: 'm_principal', label: '贷款本金（万元）', type: 'number', placeholder: '如 300', default: 300 },
      { id: 'm_years', label: '贷款年限', type: 'number', placeholder: '如 30', default: 30 },
      { id: 'm_rate', label: '年利率 %', type: 'number', placeholder: '如 3.35', default: 3.35, step: 0.01 },
      { id: 'm_early', label: '提前还款金额（万元，0=不提前）', type: 'number', placeholder: '如 50', default: 0 },
      { id: 'm_paid', label: '已还月数（仅提前还款时填）', type: 'number', placeholder: '如 60', default: 60 }
    ],
    calc(params) {
      const p = params.m_principal * 10000;
      const r = params.m_rate / 100;
      const ei = F.equalInstallment(p, r, params.m_years);
      const ep = F.equalPrincipal(p, r, params.m_years);

      let early = null;
      if (params.m_early > 0 && params.m_paid > 0) {
        early = F.earlyRepayment(p, r, params.m_years, params.m_paid, params.m_early * 10000);
      }
      return { ei, ep, early };
    },
    render(res, params) {
      const { ei, ep, early } = res;
      return `
        <div class="card result">
          <h3>📊 还款方案对比</h3>
          <table>
            <tr><th></th><th>等额本息</th><th>等额本金</th></tr>
            <tr><td>月供</td><td class="num">¥${fmt(ei.monthly)} <span class="hint">固定</span></td>
              <td class="num">¥${fmt(ep.firstMonthly)}→¥${fmt(ep.lastMonthly)}</td></tr>
            <tr><td>总利息</td><td class="num">¥${fmt(ei.totalInterest)}</td>
              <td class="num">¥${fmt(ep.totalInterest)}</td></tr>
            <tr><td>总还款</td><td class="num">¥${fmt(ei.totalPayment)}</td>
              <td class="num">¥${fmt(ep.totalPayment)}</td></tr>
            <tr><td>节省利息</td><td></td>
              <td class="num green">¥${fmt(ei.totalInterest - ep.totalInterest)}</td></tr>
          </table>
        </div>
        ${early ? `
        <div class="card result">
          <h3>🔄 提前还款方案（已还 ${params.m_paid} 期，提前还 ¥${params.m_early * 10000}）</h3>
          <p>当前剩余本金：<strong>¥${fmt(early.currentBalance)}</strong></p>
          <p>剩余应付利息：<strong>¥${fmt(early.originalRemainingInterest)}</strong></p>
          <table>
            <tr><th></th><th>缩短期限</th><th>减少月供</th></tr>
            <tr><td>新月供</td><td class="num">同原月供 ¥${fmt(ei.monthly)}</td>
              <td class="num">¥${fmt(early.optionB_reduceMonthly.newMonthly)}</td></tr>
            <tr><td>节省利息</td><td class="num green">约 ¥${fmt(early.currentBalance + early.originalRemainingInterest - ei.monthly * (params.m_years * 12 - params.m_paid))}</td>
              <td class="num green">¥${fmt(early.optionB_reduceMonthly.interestSaved)}</td></tr>
            <tr><td>当前月供</td><td class="num">不变</td>
              <td class="num">减少 ¥${fmt(early.optionB_reduceMonthly.monthlyReduced)}</td></tr>
          </table>
        </div>` : ''}
        <div class="card">
          <h3>📈 敏感性分析（利率 ±50bp）</h3>
          <table>
            <tr><th>利率</th><th>等额本息月供</th><th>总利息</th></tr>
            ${sensRow(ei, params.m_rate, 'installment')}
          </table>
        </div>
      `;
    }
  },

  acceptance: {
    title: '📄 银行承兑汇票贴现',
    desc: '贴息计算 · 实际到账 · 多贴现率对比',
    form: [
      { id: 'a_face', label: '票面金额（万元）', type: 'number', placeholder: '如 100', default: 100 },
      { id: 'a_rate', label: '贴现年利率 %', type: 'number', placeholder: '如 2.0', default: 2.0, step: 0.01 },
      { id: 'a_days', label: '剩余天数', type: 'number', placeholder: '如 90', default: 90 }
    ],
    calc(params) {
      const face = params.a_face * 10000;
      const r = params.a_rate / 100;
      const result = F.acceptanceDiscount(face, r, params.a_days);
      const compare = F.acceptanceCompare(face, params.a_days,
        [r - 0.005, r - 0.003, r, r + 0.003, r + 0.005].filter(v => v > 0));
      return { result, compare };
    },
    render(res) {
      const { result, compare } = res;
      return `
        <div class="card result">
          <h3>📊 贴现结果</h3>
          <table>
            <tr><td>票面金额</td><td class="num">¥${fmt(result.faceValue)}</td></tr>
            <tr><td>贴现利率</td><td class="num">${(result.discountRate * 100).toFixed(2)}%</td></tr>
            <tr><td>剩余天数</td><td class="num">${result.remainingDays} 天</td></tr>
            <tr><td>贴现利息</td><td class="num red">¥${fmt(result.discountInterest)}</td></tr>
            <tr><td>实际到账</td><td class="num bold">¥${fmt(result.actualReceived)}</td></tr>
            <tr><td>实际年化成本</td><td class="num">${(result.actualAnnualRate * 100).toFixed(4)}%</td></tr>
          </table>
        </div>
        <div class="card">
          <h3>📈 多贴现率对比</h3>
          <table>
            <tr><th>贴现率</th><th>贴息</th><th>到账金额</th><th>年化成本</th></tr>
            ${compare.map(c => `<tr>
              <td class="num">${(c.rate * 100).toFixed(2)}%</td>
              <td class="num">¥${fmt(c.discountInterest)}</td>
              <td class="num">¥${fmt(c.actualReceived)}</td>
              <td class="num">${(c.actualAnnualRate * 100).toFixed(4)}%</td>
            </tr>`).join('')}
          </table>
        </div>
      `;
    }
  },

  lc: {
    title: '📜 国内信用证',
    desc: '全流程费用拆解 · 综合成本率 · vs 流动资金贷款',
    form: [
      { id: 'l_amount', label: '信用证金额（万元）', type: 'number', placeholder: '如 500', default: 500 },
      { id: 'l_months', label: '期限（月）', type: 'number', placeholder: '如 6', default: 6 },
      { id: 'l_loan', label: '流贷对比年利率 %', type: 'number', placeholder: '如 3.5', default: 3.5, step: 0.01 }
    ],
    calc(params) {
      const amount = params.l_amount * 10000;
      const comparison = F.lcVsLoan(amount, params.l_months, {}, params.l_loan / 100);
      return { comparison };
    },
    render(res) {
      const c = res.comparison;
      const d = c.lc.detail;
      return `
        <div class="card result">
          <h3>📊 信用证费用明细</h3>
          <table>
            <tr><td>开证费</td><td class="num">¥${fmt(d.issuingFee)}</td></tr>
            <tr><td>通知费</td><td class="num">¥${fmt(d.advisingFee)}</td></tr>
            <tr><td>议付费</td><td class="num">¥${fmt(d.negotiationFee)}</td></tr>
            <tr><td>承兑费</td><td class="num">¥${fmt(d.acceptanceFee)}</td></tr>
            <tr><td>不符点费</td><td class="num">¥${fmt(d.discrepancyFee)}</td></tr>
            <tr><td>付款费</td><td class="num">¥${fmt(d.paymentFee)}</td></tr>
            <tr><td>电讯费</td><td class="num">¥${fmt(d.cableFee)}</td></tr>
            <tr class="total-row"><td>费用合计</td><td class="num bold">¥${fmt(c.lc.totalCost)}</td></tr>
            <tr><td>综合成本率</td><td class="num">${(c.lc.costRate * 100).toFixed(4)}%</td></tr>
          </table>
        </div>
        <div class="card">
          <h3>📈 信用证 vs 流动资金贷款</h3>
          <table>
            <tr><th></th><th>国内信用证</th><th>流动资金贷款</th></tr>
            <tr><td>总成本</td><td class="num">¥${fmt(c.lc.totalCost)}</td><td class="num">¥${fmt(c.loan.totalCost)}</td></tr>
            <tr><td>成本率</td><td class="num">${(c.lc.costRate * 100).toFixed(4)}%</td><td class="num">${(c.loan.costRate * 100).toFixed(4)}%</td></tr>
            <tr><td>差额</td><td colspan="2" class="num ${c.difference < 0 ? 'green' : 'red'}">
              ${c.recommendation}
            </td></tr>
          </table>
        </div>
      `;
    }
  },

  corp: {
    title: '🏢 对公理财',
    desc: '结构性存款 · 大额存单 · 通知存款 · 协定存款',
    form: [
      { id: 'c_type', label: '产品类型', type: 'select', options: [
        { value: 'structured', label: '结构性存款' },
        { value: 'cd', label: '大额存单' },
        { value: 'notice', label: '通知存款' },
        { value: 'agreement', label: '协定存款' }
      ]},
      { id: 'c_amount', label: '本金（万元）', type: 'number', placeholder: '如 1000', default: 1000 },
      { id: 'c_days', label: '期限（天）', type: 'number', placeholder: '如 90', default: 90 },
      { id: 'c_rate', label: '利率/保底利率 %', type: 'number', placeholder: '如 1.5', default: 1.5, step: 0.01 },
      { id: 'c_rate2', label: '高收益档利率 %（仅结构性）', type: 'number', placeholder: '如 3.5', default: 3.5, step: 0.01 },
      { id: 'c_years', label: '期限（年，仅大额存单）', type: 'number', placeholder: '如 2', default: 2 },
      { id: 'c_excess', label: '超额金额（万元，仅协定存款）', type: 'number', placeholder: '如 900', default: 900 },
      { id: 'c_triggered', label: '触发高收益？', type: 'checkbox', value: false }
    ],
    calc(params) {
      const amount = params.c_amount * 10000;
      const r = params.c_rate / 100;
      const r2 = params.c_rate2 / 100;
      switch (params.c_type) {
        case 'structured':
          return { type: '结构性存款', ...F.structuredDeposit(amount, params.c_days, r, r2, params.c_triggered) };
        case 'cd':
          return { type: '大额存单', ...F.corporateCD(amount, r, params.c_years) };
        case 'notice':
          return { type: '通知存款', ...F.noticeDeposit(amount, params.c_days, r) };
        case 'agreement':
          return { type: '协定存款', ...F.agreementDeposit(amount, params.c_excess * 10000, params.c_days) };
      }
    },
    render(res) {
      if (res.type === '结构性存款') {
        return `
          <div class="card result">
            <h3>📊 结构性存款</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>期限</td><td class="num">${res.days} 天</td></tr>
              <tr><td>保底收益</td><td class="num">¥${fmt(res.floorReturn)}（年化 ${(res.floorAnnual * 100).toFixed(4)}%）</td></tr>
              <tr><td>高收益</td><td class="num green">¥${fmt(res.ceilingReturn)}（年化 ${(res.ceilingAnnual * 100).toFixed(4)}%）</td></tr>
              <tr class="total-row"><td>实际收益（${res.triggered ? '已触发' : '未触发'}）</td>
                <td class="num bold">¥${fmt(res.actualReturn)}（年化 ${(res.actualAnnual * 100).toFixed(4)}%）</td></tr>
            </table>
          </div>
        `;
      }
      if (res.type === '大额存单') {
        return `
          <div class="card result">
            <h3>📊 对公大额存单</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>利率</td><td class="num">${(res.annualRate * 100).toFixed(2)}%</td></tr>
              <tr><td>期限</td><td class="num">${res.years} 年</td></tr>
              <tr><td>利息</td><td class="num">¥${fmt(res.interest)}</td></tr>
              <tr class="total-row"><td>到期本息</td><td class="num bold">¥${fmt(res.maturityValue)}</td></tr>
            </table>
          </div>
        `;
      }
      if (res.type === '通知存款') {
        return `
          <div class="card result">
            <h3>📊 通知存款</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>利率</td><td class="num">${(res.annualRate * 100).toFixed(2)}%</td></tr>
              <tr><td>天数</td><td class="num">${res.days} 天</td></tr>
              <tr><td>利息</td><td class="num">¥${fmt(res.interest)}</td></tr>
              <tr class="total-row"><td>到期本息</td><td class="num bold">¥${fmt(res.maturityValue)}</td></tr>
            </table>
          </div>
        `;
      }
      if (res.type === '协定存款') {
        return `
          <div class="card result">
            <h3>📊 协定存款</h3>
            <table>
              <tr><td>基本额度利息</td><td class="num">¥${fmt(res.basicInterest)}</td></tr>
              <tr><td>超额部分利息</td><td class="num">¥${fmt(res.excessInterest)}</td></tr>
              <tr class="total-row"><td>合计利息</td><td class="num bold">¥${fmt(res.totalInterest)}</td></tr>
              <tr><td>等效年化</td><td class="num">${(res.blendedAnnualRate * 100).toFixed(4)}%</td></tr>
            </table>
          </div>
        `;
      }
    }
  },

  personal: {
    title: '👤 对私理财',
    desc: '定期 · 大额存单 · 货币基金 · 净值型 · 国债 · 收益凭证',
    form: [
      { id: 'p_type', label: '产品类型', type: 'select', options: [
        { value: 'fixed', label: '定期存款' },
        { value: 'cd', label: '大额存单（个人）' },
        { value: 'fund', label: '货币基金' },
        { value: 'nav', label: '净值型理财' },
        { value: 'bond', label: '国债' },
        { value: 'broker', label: '券商收益凭证' }
      ]},
      { id: 'p_amount', label: '本金（万元）', type: 'number', placeholder: '如 50', default: 50 },
      { id: 'p_rate', label: '年化利率 % / 七日年化 %', type: 'number', placeholder: '如 2.0', default: 2.0, step: 0.01 },
      { id: 'p_years', label: '期限（年）', type: 'number', placeholder: '如 2', default: 2 },
      { id: 'p_days', label: '期限（天，货基/收益凭证用）', type: 'number', placeholder: '如 90', default: 90 },
      { id: 'p_buy_nav', label: '买入净值（净值型）', type: 'number', placeholder: '如 1.0000', default: 1.0, step: 0.0001 },
      { id: 'p_sell_nav', label: '赎回净值（净值型）', type: 'number', placeholder: '如 1.0200', default: 1.02, step: 0.0001 },
      { id: 'p_buy_price', label: '买入价（国债二级，0=一级买入）', type: 'number', placeholder: '如 98', default: 0 },
      { id: 'p_face', label: '国债面值（万元）', type: 'number', placeholder: '如 50', default: 50 }
    ],
    calc(params) {
      const amount = params.p_amount * 10000;
      const r = params.p_rate / 100;
      const face = params.p_face * 10000;
      switch (params.p_type) {
        case 'fixed': return { type: '定期存款', ...F.fixedDeposit(amount, r, params.p_years) };
        case 'cd': return { type: '大额存单（个人）', ...F.corporateCD(amount, r, params.p_years) };
        case 'fund': return { type: '货币基金', ...F.moneyFund(amount, r, params.p_days) };
        case 'nav':
          return { type: '净值型理财', ...F.navWealth(amount, params.p_buy_nav, params.p_sell_nav, params.p_days) };
        case 'bond':
          const buyPrice = params.p_buy_price > 0 ? params.p_buy_price * 10000 : null;
          return { type: '国债', ...F.treasuryBond(face, r, params.p_years, buyPrice) };
        case 'broker': return { type: '券商收益凭证', ...F.brokerNote(amount, r, params.p_days) };
      }
    },
    render(res) {
      if (res.type === '定期存款' || res.type === '大额存单（个人）') {
        return `
          <div class="card result">
            <h3>📊 ${res.type}</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>利率</td><td class="num">${(res.annualRate * 100).toFixed(2)}%</td></tr>
              <tr><td>期限</td><td class="num">${res.years} 年</td></tr>
              <tr><td>利息</td><td class="num">¥${fmt(res.interest)}</td></tr>
              <tr><td>税后利息（免税）</td><td class="num green">¥${fmt(res.interest)}</td></tr>
              <tr class="total-row"><td>到期本息</td><td class="num bold">¥${fmt(res.maturityValue)}</td></tr>
            </table>
          </div>
        `;
      }
      if (res.type === '货币基金') {
        return `
          <div class="card result">
            <h3>📊 货币基金</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>七日年化</td><td class="num">${(res.annual7Day * 100).toFixed(2)}%</td></tr>
              <tr><td>持有天数</td><td class="num">${res.days} 天</td></tr>
              <tr><td>预估收益</td><td class="num">¥${fmt(res.estimatedReturn)}</td></tr>
              <tr class="total-row"><td>到期总额</td><td class="num bold">¥${fmt(res.totalValue)}</td></tr>
            </table>
            <p class="hint">⚠️ 七日年化为历史数据，不代表未来收益。万份收益法更精确但需每日数据。</p>
          </div>
        `;
      }
      if (res.type === '净值型理财') {
        return `
          <div class="card result">
            <h3>📊 净值型理财</h3>
            <table>
              <tr><td>买入净值</td><td class="num">${res.buyNav}</td></tr>
              <tr><td>赎回净值</td><td class="num">${res.sellNav}</td></tr>
              <tr><td>持有份额</td><td class="num">${res.units}</td></tr>
              <tr><td>赎回到账</td><td class="num bold">¥${fmt(res.netValue)}</td></tr>
              <tr><td>实际收益</td><td class="num ${res.profit >= 0 ? 'green' : 'red'}">¥${fmt(res.profit)}</td></tr>
              <tr><td>年化收益率</td><td class="num">${(res.annualized * 100).toFixed(4)}%</td></tr>
            </table>
            <h4>费用明细</h4>
            <table>
              <tr><td>管理费</td><td class="num">¥${fmt(res.fees.manageFee)}</td></tr>
              <tr><td>托管费</td><td class="num">¥${fmt(res.fees.custodyFee)}</td></tr>
              <tr><td>申购费</td><td class="num">¥${fmt(res.fees.subscriptionFee)}</td></tr>
              <tr><td>赎回费</td><td class="num">¥${fmt(res.fees.redemptionFee)}</td></tr>
            </table>
          </div>
        `;
      }
      if (res.type === '国债') {
        return `
          <div class="card result">
            <h3>📊 国债</h3>
            <table>
              <tr><td>类型</td><td class="num">${res.type}</td></tr>
              <tr><td>面值</td><td class="num">¥${fmt(res.faceValue)}</td></tr>
              <tr><td>票面利率</td><td class="num">${(res.couponRate * 100).toFixed(2)}%</td></tr>
              <tr><td>每年利息</td><td class="num">¥${fmt(res.annualCoupon)}</td></tr>
              ${res.type === '二级买入' ? `
                <tr><td>买入价</td><td class="num">¥${fmt(res.buyPrice)}</td></tr>
                <tr><td>价差收益</td><td class="num">¥${fmt(res.priceDiff)}</td></tr>
                <tr><td>到期收益率</td><td class="num bold">${(res.ytm * 100).toFixed(4)}%</td></tr>
              ` : ''}
              <tr><td>总收益</td><td class="num bold">¥${fmt(res.totalReturn)}</td></tr>
            </table>
            <p class="hint">✅ 国债利息免征个人所得税</p>
          </div>
        `;
      }
      if (res.type === '券商收益凭证') {
        return `
          <div class="card result">
            <h3>📊 券商收益凭证</h3>
            <table>
              <tr><td>本金</td><td class="num">¥${fmt(res.principal)}</td></tr>
              <tr><td>约定年化</td><td class="num">${(res.annualRate * 100).toFixed(2)}%</td></tr>
              <tr><td>期限</td><td class="num">${res.days} 天</td></tr>
              <tr><td>收益</td><td class="num">¥${fmt(res.return)}</td></tr>
              <tr class="total-row"><td>到期总额</td><td class="num bold">¥${fmt(res.totalValue)}</td></tr>
            </table>
          </div>
        `;
      }
    }
  }
};

// ============================================================
// 渲染引擎
// ============================================================

let currentTab = 'mortgage';
let lastResult = null;

function $(id) { return document.getElementById(id); }

function fmt(n) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sensRow(ei, baseRate, type) {
  const basePct = baseRate;
  const rates = [basePct - 0.5, basePct, basePct + 0.5];
  const p = parseFloat($('m_principal')?.value || 300) * 10000;
  const y = parseInt($('m_years')?.value || 30);
  return rates.map(r => {
    const calc = F.equalInstallment(p, r / 100, y);
    return `<tr${r === basePct ? ' class="base-row"' : ''}>
      <td class="num">${r.toFixed(2)}%</td>
      <td class="num">¥${fmt(calc.monthly)}</td>
      <td class="num">¥${fmt(calc.totalInterest)}</td>
    </tr>`;
  }).join('');
}

function renderForm(tabKey) {
  const tab = TABS[tabKey];
  let html = `<div class="card"><h2>${tab.title}</h2><p class="desc">${tab.desc}</p>`;
  html += '<form id="calcForm" onsubmit="return doCalc(event)">';
  tab.form.forEach(f => {
    html += `<div class="field">`;
    html += `<label for="${f.id}">${f.label}</label>`;
    if (f.type === 'select') {
      html += `<select id="${f.id}">${f.options.map(o =>
        `<option value="${o.value}">${o.label}</option>`).join('')}</select>`;
    } else if (f.type === 'checkbox') {
      html += `<input type="checkbox" id="${f.id}" ${f.value ? 'checked' : ''}>`;
    } else {
      html += `<input type="${f.type}" id="${f.id}" value="${f.default ?? ''}"
        placeholder="${f.placeholder ?? ''}" ${f.step ? `step="${f.step}"` : ''}>`;
    }
    html += `</div>`;
  });
  html += `<button type="submit" class="btn-calc">开始计算</button>`;
  html += '</form></div>';
  html += '<div id="result"></div>';
  return html;
}

function readForm(tabKey) {
  const fields = TABS[tabKey].form;
  const params = {};
  fields.forEach(f => {
    const el = $(f.id);
    if (!el) return;
    if (f.type === 'checkbox') {
      params[f.id] = el.checked;
    } else if (f.type === 'select') {
      params[f.id] = el.value;
    } else {
      params[f.id] = parseFloat(el.value) || 0;
    }
  });
  return params;
}

function doCalc(e) {
  e.preventDefault();
  const tab = TABS[currentTab];
  const params = readForm(currentTab);
  const result = tab.calc(params);
  lastResult = { tab: currentTab, params, result };
  $('result').innerHTML = tab.render(result, params);
  $('result').scrollIntoView({ behavior: 'smooth' });
  return false;
}

function switchTab(tabKey) {
  currentTab = tabKey;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabKey}"]`).classList.add('active');
  $('content').innerHTML = renderForm(tabKey);
  $('result') && ($('result').innerHTML = '');
}

// 监听对公产品类型切换，显示/隐藏相关字段
document.addEventListener('change', function(e) {
  if (e.target.id === 'c_type') {
    const val = e.target.value;
    $('c_rate2').closest('.field').style.display = val === 'structured' ? '' : 'none';
    $('c_triggered').closest('.field').style.display = val === 'structured' ? '' : 'none';
    $('c_years').closest('.field').style.display = val === 'cd' ? '' : 'none';
    $('c_excess').closest('.field').style.display = val === 'agreement' ? '' : 'none';
    $('c_days').closest('.field').style.display = val !== 'cd' ? '' : 'none';
  }
  if (e.target.id === 'p_type') {
    const val = e.target.value;
    ['p_years', 'p_days', 'p_buy_nav', 'p_sell_nav', 'p_buy_price', 'p_face'].forEach(id => {
      const el = $(id); if (!el) return;
      el.closest('.field').style.display = 'none';
    });
    switch (val) {
      case 'fixed': case 'cd':
        $('p_years').closest('.field').style.display = ''; break;
      case 'fund': case 'broker':
        $('p_days').closest('.field').style.display = ''; break;
      case 'nav':
        ['p_days', 'p_buy_nav', 'p_sell_nav'].forEach(id =>
          $(id).closest('.field').style.display = ''); break;
      case 'bond':
        ['p_years', 'p_buy_price', 'p_face'].forEach(id =>
          $(id).closest('.field').style.display = ''); break;
    }
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $('content').innerHTML = renderForm('mortgage');
  // 初始化隐藏字段
  ['c_rate2', 'c_triggered', 'c_years', 'c_excess'].forEach(id => {
    const el = $(id); if (el) el.closest('.field').style.display = 'none';
  });
  ['p_years', 'p_days', 'p_buy_nav', 'p_sell_nav', 'p_buy_price', 'p_face'].forEach(id => {
    const el = $(id); if (el) el.closest('.field').style.display = 'none';
  });
});
