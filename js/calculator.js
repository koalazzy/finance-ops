/**
 * FinanceOps 核心计算引擎
 * 纯 JS，无依赖，所有金融公式的标准实现
 */

const FinanceOps = {
  // ============================================================
  // 通用工具
  // ============================================================

  /** 精确到分 */
  round2(v) { return Math.round(v * 100) / 100; },
  /** 精确到 bp (0.0001) */
  round4(v) { return Math.round(v * 10000) / 10000; },
  /** 天数 */
  daysBetween(d1, d2) {
    return Math.ceil((new Date(d2) - new Date(d1)) / 86400000);
  },

  // ============================================================
  // 一、按揭计算
  // ============================================================

  /**
   * 等额本息
   * @param {number} principal 贷款本金
   * @param {number} annualRate 年利率 (如 0.0335 = 3.35%)
   * @param {number} years 年限
   * @returns {{ monthly: number, totalInterest: number, totalPayment: number, schedule: Array }}
   */
  equalInstallment(principal, annualRate, years) {
    const months = years * 12;
    const monthlyRate = annualRate / 12;
    const monthly = principal * monthlyRate * Math.pow(1 + monthlyRate, months)
                  / (Math.pow(1 + monthlyRate, months) - 1);
    const totalPayment = monthly * months;
    const totalInterest = totalPayment - principal;

    const schedule = [];
    let balance = principal;
    for (let i = 1; i <= Math.min(months, 360); i++) {
      const interest = balance * monthlyRate;
      const principalPaid = monthly - interest;
      balance -= principalPaid;
      schedule.push({
        period: i, monthly: this.round2(monthly),
        interest: this.round2(interest), principalPaid: this.round2(principalPaid),
        balance: this.round2(Math.max(0, balance))
      });
    }

    return {
      monthly: this.round2(monthly),
      totalInterest: this.round2(totalInterest),
      totalPayment: this.round2(totalPayment),
      schedule
    };
  },

  /**
   * 等额本金
   */
  equalPrincipal(principal, annualRate, years) {
    const months = years * 12;
    const monthlyRate = annualRate / 12;
    const monthlyPrincipal = principal / months;
    let totalInterest = 0;
    const schedule = [];

    for (let i = 1; i <= Math.min(months, 360); i++) {
      const balance = principal - monthlyPrincipal * (i - 1);
      const interest = balance * monthlyRate;
      totalInterest += interest;
      schedule.push({
        period: i,
        monthly: this.round2(monthlyPrincipal + interest),
        interest: this.round2(interest),
        principalPaid: this.round2(monthlyPrincipal),
        balance: this.round2(Math.max(0, principal - monthlyPrincipal * i))
      });
    }

    return {
      firstMonthly: this.round2(monthlyPrincipal + principal * monthlyRate),
      lastMonthly: this.round2(monthlyPrincipal + monthlyPrincipal * monthlyRate),
      totalInterest: this.round2(totalInterest),
      totalPayment: this.round2(principal + totalInterest),
      schedule
    };
  },

  /**
   * 提前还款损益
   */
  earlyRepayment(principal, annualRate, years, paidMonths, extraPayment) {
    const monthlyRate = annualRate / 12;
    const months = years * 12;

    // 计算已还本金
    const monthly = principal * monthlyRate * Math.pow(1 + monthlyRate, months)
                  / (Math.pow(1 + monthlyRate, months) - 1);
    let balance = principal;
    for (let i = 0; i < paidMonths; i++) {
      balance -= (monthly - balance * monthlyRate);
    }
    balance = this.round2(balance);

    // 原方案剩余利息
    const originalRemainingInterest = monthly * (months - paidMonths) - balance;

    // 提前还款后（两种方式）
    // A: 缩短期限
    const newBalanceA = Math.max(0, balance - extraPayment);
    const remainingA = months - paidMonths;
    let monthsA = remainingA;
    if (newBalanceA > 0) {
      const newMonthlyA = newBalanceA * monthlyRate * Math.pow(1 + monthlyRate, remainingA)
                        / (Math.pow(1 + monthlyRate, remainingA) - 1);
      // 简化：按比例缩短
      monthsA = Math.ceil(Math.log(monthly / (monthly - newBalanceA * monthlyRate)) / Math.log(1 + monthlyRate));
    } else {
      monthsA = 0;
    }

    // B: 减少月供
    const newBalanceB = Math.max(0, balance - extraPayment);
    let newMonthlyB = 0;
    if (newBalanceB > 0) {
      newMonthlyB = newBalanceB * monthlyRate * Math.pow(1 + monthlyRate, remainingA)
                  / (Math.pow(1 + monthlyRate, remainingA) - 1);
    }
    const newInterestB = newMonthlyB * remainingA - newBalanceB;
    const interestSavedB = originalRemainingInterest - Math.max(0, newInterestB);

    return {
      currentBalance: this.round2(balance),
      newBalance: this.round2(Math.max(0, balance - extraPayment)),
      originalRemainingInterest: this.round2(originalRemainingInterest),
      optionA_shortenTerm: {
        estimatedNewMonths: monthsA,
        monthsReduced: remainingA - monthsA
      },
      optionB_reduceMonthly: {
        newMonthly: this.round2(newMonthlyB),
        monthlyReduced: this.round2(monthly - newMonthlyB),
        interestSaved: this.round2(Math.max(0, interestSavedB))
      }
    };
  },

  // ============================================================
  // 二、银承贴现
  // ============================================================

  /**
   * @param {number} faceValue 票面金额
   * @param {number} discountRate 贴现年利率 (如 0.02 = 2%)
   * @param {number} remainingDays 剩余天数
   */
  acceptanceDiscount(faceValue, discountRate, remainingDays) {
    const discountInterest = this.round2(faceValue * discountRate * remainingDays / 360);
    const actualReceived = this.round2(faceValue - discountInterest);
    // 推算实际年化成本率
    const actualAnnualRate = this.round4(discountInterest / actualReceived * 360 / remainingDays);

    return { faceValue, discountRate, remainingDays, discountInterest, actualReceived, actualAnnualRate };
  },

  /** 多贴现率对比 */
  acceptanceCompare(faceValue, remainingDays, rates) {
    return rates.map(r => ({
      rate: r,
      ...this.acceptanceDiscount(faceValue, r, remainingDays)
    }));
  },

  // ============================================================
  // 三、国内信用证
  // ============================================================

  /**
   * @param {number} amount 信用证金额
   * @param {number} months 期限（月）
   * @param {object} fees 费率覆盖（未传则用默认中位值）
   */
  letterOfCredit(amount, months, fees = {}) {
    const f = {
      issuingFeeRate: fees.issuingFeeRate ?? 0.001,    // 开证费 0.1%
      advisingFee: fees.advisingFee ?? 300,             // 通知费
      negotiationFeeRate: fees.negotiationFeeRate ?? 0.002, // 议付费 0.2%
      acceptanceFeeMonthly: fees.acceptanceFeeMonthly ?? 0.0006, // 承兑费 0.06%/月
      discrepancyFee: fees.discrepancyFee ?? 0,         // 不符点费（假设无）
      paymentFeeRate: fees.paymentFeeRate ?? 0.0015,    // 付款费 0.15%
      cableFee: fees.cableFee ?? 200                    // 电讯费
    };

    const issuingFee = this.round2(amount * f.issuingFeeRate);
    const advisingFee = f.advisingFee;
    const negotiationFee = this.round2(amount * f.negotiationFeeRate);
    const acceptanceFee = this.round2(amount * f.acceptanceFeeMonthly * months);
    const discrepancyFee = f.discrepancyFee;
    const paymentFee = this.round2(amount * f.paymentFeeRate);
    const cableFee = f.cableFee;

    const total = issuingFee + advisingFee + negotiationFee + acceptanceFee
                + discrepancyFee + paymentFee + cableFee;
    const totalRate = this.round4(total / amount);

    return {
      breakdown: { issuingFee, advisingFee, negotiationFee, acceptanceFee,
                   discrepancyFee, paymentFee, cableFee },
      total: this.round2(total),
      totalRate,
      amount, months
    };
  },

  /**
   * 国内信用证融资成本（含保证金+福费廷+存款利息抵扣）
   * @param {number} amount 开证金额
   * @param {number} months 期限（月）
   * @param {object} opts
   *   marginRatio: 保证金比例 (如 0.3 = 30%)
   *   marginDepositRate: 保证金存款年利率
   *   forfeitingRate: 福费廷贴现年利率
   *   issuingFeeRate: 开证手续费率
   *   acceptanceFeeMonthly: 承兑费月率
   */
  letterOfCreditV2(amount, months, opts = {}) {
    const marginRatio = opts.marginRatio ?? 0.3;
    const marginDepositRate = opts.marginDepositRate ?? 0.0035;
    const forfeitingRate = opts.forfeitingRate ?? 0.025;
    const issuingFeeRate = opts.issuingFeeRate ?? 0.001;
    const acceptanceFeeMonthly = opts.acceptanceFeeMonthly ?? 0.0006;

    // 保证金
    const margin = this.round2(amount * marginRatio);
    // 融资敞口 = 开证金额 - 保证金
    const exposure = this.round2(amount - margin);

    // 收费项
    const issuingFee = this.round2(amount * issuingFeeRate);
    const acceptanceFee = this.round2(amount * acceptanceFeeMonthly * months);

    // 福费廷贴现利息（按融资敞口、期限计算）
    const forfeitingInterest = this.round2(exposure * forfeitingRate * months / 12);

    // 保证金存款利息收入
    const marginDepositIncome = this.round2(margin * marginDepositRate * months / 12);

    // 总成本 = 利息支出 + 开证费 + 承兑费 - 保证金存款利息收入
    const totalCost = this.round2(forfeitingInterest + issuingFee + acceptanceFee - marginDepositIncome);
    // 融资成本率 = 总成本 / 融资敞口 × 12 / 月数
    const costRate = this.round4(totalCost / exposure * 12 / months);

    return {
      amount, months,
      margin, marginRatio, marginDepositRate,
      exposure,
      detail: {
        forfeitingInterest,
        issuingFee,
        acceptanceFee,
        marginDepositIncome
      },
      feeSubtotal: this.round2(forfeitingInterest + issuingFee + acceptanceFee),
      marginIncome: this.round2(-marginDepositIncome),
      totalCost,
      costRate
    };
  },

  /**
   * 信用证 vs 流动资金贷款（V2，含保证金模型）
   */
  lcVsLoanV2(amount, months, lcOpts = {}, loanAnnualRate = 0.035) {
    const lc = this.letterOfCreditV2(amount, months, lcOpts);
    // 流动资金贷款：按敞口（实际用信金额）计息
    // 保证金是企业自有资金，不需要向银行融资，所以流贷也只需覆盖敞口部分
    const loanInterest = this.round2(lc.exposure * loanAnnualRate * months / 12);
    const loanCostRate = this.round4(loanInterest / lc.exposure * 12 / months);

    return {
      lc: { totalCost: lc.totalCost, costRate: lc.costRate, detail: lc.detail, 
             margin: lc.margin, marginRatio: lc.marginRatio, exposure: lc.exposure, months: lc.months,
             feeSubtotal: lc.feeSubtotal },
      loan: { totalCost: loanInterest, costRate: loanCostRate },
      difference: this.round2(lc.totalCost - loanInterest),
      recommendation: lc.totalCost < loanInterest ? '国内信用证成本更低' : '流动资金贷款成本更低'
    };
  },

  /** 信用证 vs 流动资金贷款对比 (V1 兼容) */
  lcVsLoan(amount, months, lcFees = {}, loanAnnualRate = 0.035) {
    const lc = this.letterOfCredit(amount, months, lcFees);
    const loanInterest = this.round2(amount * loanAnnualRate * months / 12);
    const loanTotal = loanInterest;

    return {
      lc: { totalCost: lc.total, costRate: lc.totalRate, detail: lc.breakdown },
      loan: { totalCost: loanTotal, costRate: this.round4(loanInterest / amount) },
      difference: this.round2(lc.total - loanTotal),
      recommendation: lc.total < loanTotal ? '信用证成本更低' : '流动资金贷款成本更低'
    };
  },

  // ============================================================
  // 四、对公理财
  // ============================================================

  /**
   * 结构性存款
   */
  structuredDeposit(principal, days, floorRate, ceilingRate, triggered = false) {
    const floor = this.round2(principal * floorRate * days / 365);
    const ceiling = this.round2(principal * ceilingRate * days / 365);
    const actual = triggered ? ceiling : floor;
    return {
      principal, days,
      floorReturn: floor, floorAnnual: this.round4(floor / principal * 365 / days),
      ceilingReturn: ceiling, ceilingAnnual: this.round4(ceiling / principal * 365 / days),
      triggered, actualReturn: actual,
      actualAnnual: this.round4(actual / principal * 365 / days)
    };
  },

  /** 大额存单（对公） */
  corporateCD(principal, annualRate, years) {
    const interest = this.round2(principal * annualRate * years);
    return {
      principal, annualRate, years,
      interest, maturityValue: this.round2(principal + interest)
    };
  },

  /** 通知存款 */
  noticeDeposit(principal, days, annualRate) {
    const interest = this.round2(principal * annualRate * days / 360);
    return { principal, days, annualRate, interest,
      maturityValue: this.round2(principal + interest),
      annualized: this.round4(interest / principal * 365 / days) };
  },

  /** 协定存款 */
  agreementDeposit(basicAmount, excessAmount, days,
                   basicRate = 0.002, agreementRate = 0.0125) {
    const basicInterest = this.round2(basicAmount * basicRate * days / 360);
    const excessInterest = this.round2(excessAmount * agreementRate * days / 360);
    const total = basicInterest + excessInterest;
    const blendedRate = this.round4(total / (basicAmount + excessAmount) * 360 / days);
    return { basicAmount, excessAmount, days, basicInterest, excessInterest,
      totalInterest: this.round2(total), blendedAnnualRate: blendedRate };
  },

  // ============================================================
  // 五、对私理财
  // ============================================================

  /** 定期存款 */
  fixedDeposit(principal, annualRate, years) {
    const interest = this.round2(principal * annualRate * years);
    return { principal, annualRate, years, interest,
      maturityValue: this.round2(principal + interest) };
  },

  /** 货币基金 */
  moneyFund(principal, annual7Day, days) {
    const estimatedReturn = this.round2(principal * annual7Day * days / 365);
    return { principal, annual7Day, days, estimatedReturn,
      totalValue: this.round2(principal + estimatedReturn) };
  },

  /** 净值型理财 */
  navWealth(principal, buyNav, sellNav, days, fees = {}) {
    const units = principal / buyNav;
    const grossValue = units * sellNav;
    const manageFee = this.round2(principal * (fees.manageFeeRate ?? 0.003) * days / 365);
    const custodyFee = this.round2(principal * (fees.custodyFeeRate ?? 0.0003) * days / 365);
    const subscriptionFee = this.round2(principal * (fees.subscriptionFeeRate ?? 0));
    const redemptionFee = this.round2(grossValue * (fees.redemptionFeeRate ?? 0));
    const netValue = grossValue - manageFee - custodyFee - subscriptionFee - redemptionFee;
    const profit = netValue - principal;
    return {
      principal, days, units: this.round4(units), buyNav, sellNav,
      grossValue: this.round2(grossValue),
      fees: { manageFee, custodyFee, subscriptionFee, redemptionFee },
      netValue: this.round2(netValue),
      profit: this.round2(profit),
      annualized: this.round4(profit / principal * 365 / days)
    };
  },

  /** 国债 */
  treasuryBond(faceValue, couponRate, years, buyPrice = null) {
    const annualCoupon = this.round2(faceValue * couponRate);
    if (buyPrice === null || buyPrice === faceValue) {
      // 一级市场买入
      return {
        type: '一级买入', faceValue, couponRate, years, annualCoupon,
        maturityValue: faceValue,
        totalReturn: this.round2(annualCoupon * years)
      };
    }
    // 二级市场买入
    const couponTotal = annualCoupon * years;
    const priceDiff = faceValue - buyPrice;
    const totalReturn = couponTotal + priceDiff;
    const ytm = this.round4(totalReturn / buyPrice / years);
    return {
      type: '二级买入', faceValue, buyPrice, couponRate, years, annualCoupon,
      couponTotal, priceDiff, totalReturn: this.round2(totalReturn),
      ytm
    };
  },

  /** 券商收益凭证 */
  brokerNote(principal, annualRate, days) {
    const return_ = this.round2(principal * annualRate * days / 365);
    return { principal, annualRate, days, return: return_,
      totalValue: this.round2(principal + return_) };
  },

  // ============================================================
  // 六、敏感性分析
  // ============================================================

  /** 通用敏感性：利率 ±50bp, 期限 ±1年 */
  sensitivity(baseCalc, paramName, baseValue, deltas = []) {
    // deltas: [{param, delta}] — 返回多个扰动场景
    return deltas.map(d => ({
      scenario: `${paramName} ${d.delta > 0 ? '+' : ''}${d.delta}`,
      ...d.compute(baseValue + d.delta)
    }));
  }
};

// Node.js / 浏览器 通用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinanceOps;
}
