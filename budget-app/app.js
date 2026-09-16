(() => {
  "use strict";

  const cfg = window.TRIP_CONFIG || {};
  const allowedUsers = new Set(["saad", "bayan", "admin"]);
  const moneyFmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const integerFmt = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });
  const pctFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "short",
  });
  const weekdayDateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const categoryPalettes = [
    { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    { color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
    { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
    { color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
    { color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8" },
    { color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
    { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
    { color: "#4d7c0f", bg: "#f7fee7", border: "#d9f99d" },
    { color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
    { color: "#a16207", bg: "#fffbeb", border: "#fde68a" },
    { color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  ];

  let db = null;
  let currentUser = null;
  let profile = null;
  let trip = null;
  let categories = [];
  let expenses = [];
  let profiles = [];
  let realtimeChannel = null;
  let reloadTimer = null;
  let toastTimer = null;
  let currentCategoryId = null;
  let currentLedgerDate = null;
  let currentLedgerMode = "day";
  let summaryCollapsed = false;
  let testDateOverride = null;

  const $ = (id) => document.getElementById(id);
  const els = {};
  const ids = [
    "loginView",
    "appView",
    "loginForm",
    "username",
    "password",
    "configHint",
    "tripPhase",
    "dateContext",
    "userBadge",
    "logoutBtn",
    "testTimeBar",
    "testDate",
    "testPrevDay",
    "testNextDay",
    "testRealDate",
    "addEntryBtn",
    "budgetBtn",
    "summaryArea",
    "categoryGrid",
    "categoryPrev",
    "categoryNext",
    "categoryCardSelect",
    "categoryPosition",
    "categoriesSection",
    "categoriesBody",
    "categoriesToggle",
    "ledgerSection",
    "ledgerBody",
    "ledgerToggle",
    "ledgerPrevDay",
    "ledgerNextDay",
    "ledgerDayLabel",
    "ledgerAllDays",
    "expenseCount",
    "categoryFilter",
    "expenseList",
    "entryDialog",
    "entryForm",
    "entryMode",
    "modeDirectBtn",
    "modeBalanceBtn",
    "directAmountFields",
    "balanceAmountFields",
    "entryAmount",
    "entryBalance",
    "entryCategory",
    "entryDate",
    "entryNote",
    "expectedBalance",
    "reconcileDifference",
    "sameDayBox",
    "entryGuard",
    "entrySubmit",
    "editDialog",
    "editForm",
    "editTitle",
    "editId",
    "editType",
    "editDirectFields",
    "editAmount",
    "editReconcileFields",
    "editReportedBalance",
    "editExpectedBalance",
    "editComputedAmount",
    "editCategory",
    "editDate",
    "editNote",
    "editWarning",
    "budgetDialog",
    "budgetForm",
    "totalBudgetInput",
    "categoryBudgetFields",
    "budgetDifference",
    "deleteDialog",
    "deleteForm",
    "deleteId",
    "toast",
    "analyticsPanel",
    "analyticsBody",
    "analyticsToggle",
    "distributionTab",
    "trendTab",
    "distributionPanel",
    "trendPanel",
    "spendingDistribution",
    "spendingTrend",
    "chartCategoryFilter",
  ];

  function initEls() {
    ids.forEach((id) => {
      els[id] = $(id);
    });
  }

  function isConfigured() {
    return Boolean(
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_KEY &&
      !String(cfg.SUPABASE_URL).includes("YOUR_PROJECT") &&
      !String(cfg.SUPABASE_KEY).includes("YOUR_PUBLISHABLE"),
    );
  }

  function normalizeDigits(value) {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    return String(value ?? "")
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/٫/g, ".")
      .replace(/[٬،]/g, ",");
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = normalizeDigits(value)
      .replace(/,/g, "")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2(value) {
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
  }
  function formatAmount(value) {
    const rounded = round2(value);
    return Number.isInteger(rounded)
      ? integerFmt.format(rounded)
      : moneyFmt.format(rounded);
  }
  function money(value) {
    return `\u2067\u2066${formatAmount(value)}\u2069 ر.س\u2069`;
  }
  function moneyValue(value) {
    return formatAmount(Math.max(0, num(value)));
  }
  function setMoneyField(input, value) {
    if (input) input.value = moneyValue(value);
  }

  function formatMoneyField(input, forceTwo = false) {
    if (!input) return;
    const raw = normalizeDigits(input.value);
    if (raw.trim() === "") {
      input.value = "";
      return;
    }
    const caret = input.selectionStart ?? raw.length;
    const leftLogical = normalizeDigits(raw.slice(0, caret)).replace(
      /[^0-9.]/g,
      "",
    ).length;
    const firstDot = raw.indexOf(".");
    let intRaw = firstDot >= 0 ? raw.slice(0, firstDot) : raw;
    let decRaw = firstDot >= 0 ? raw.slice(firstDot + 1) : "";
    const hadDot = firstDot >= 0;
    intRaw = intRaw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    decRaw = decRaw.replace(/\D/g, "").slice(0, 2);
    if (!intRaw) intRaw = "0";
    const intFormatted = Number(intRaw).toLocaleString("en-US");
    let formatted = intFormatted;
    if (forceTwo) formatted = formatAmount(num(`${intRaw}.${decRaw || "0"}`));
    else if (hadDot) formatted += `.${decRaw}`;
    input.value = formatted;
    if (forceTwo) return;
    let logical = 0;
    let newPos = leftLogical === 0 ? 0 : formatted.length;
    for (let i = 0; i < formatted.length; i += 1) {
      if (leftLogical === 0) break;
      if (/[0-9.]/.test(formatted[i])) logical += 1;
      if (logical >= leftLogical) {
        newPos = i + 1;
        break;
      }
    }
    try {
      input.setSelectionRange(newPos, newPos);
    } catch (_) {}
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function setBusy(button, busy, busyText = "جارٍ الحفظ…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parseDate(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function keyFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function utcDay(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }
  function dayDiff(a, b) {
    return utcDay(b) - utcDay(a);
  }
  function isTestClockActive() {
    return Boolean(els.testTimeBar && testDateOverride);
  }
  function appDate() {
    if (isTestClockActive()) return parseDate(testDateOverride);
    return new Date();
  }
  function dateKey(d = null) {
    return keyFromDate(d || appDate());
  }

  function clampTripDate(value) {
    if (!trip) return value;
    const key = String(value || "");
    if (!key || key < trip.start_date) return trip.start_date;
    if (key > trip.end_date) return trip.end_date;
    return key;
  }
  function isDateInTrip(value) {
    return Boolean(trip && value >= trip.start_date && value <= trip.end_date);
  }

  function tripDays() {
    if (!trip) return [];
    const out = [];
    for (
      let d = parseDate(trip.start_date), end = parseDate(trip.end_date);
      d <= end;
      d.setDate(d.getDate() + 1)
    )
      out.push(keyFromDate(d));
    return out;
  }

  function defaultEntryDate() {
    return trip ? clampTripDate(dateKey()) : dateKey();
  }

  function timeline() {
    const actualToday = dateKey();
    const start = trip.start_date;
    const end = trip.end_date;
    const totalDays = dayDiff(start, end) + 1;
    if (actualToday < start)
      return {
        phase: "before",
        today: start,
        actualToday,
        totalDays,
        elapsedDays: 0,
        remainingDays: totalDays,
        daysUntil: dayDiff(actualToday, start),
      };
    if (actualToday > end)
      return {
        phase: "after",
        today: end,
        actualToday,
        totalDays,
        elapsedDays: totalDays,
        remainingDays: 0,
        daysAfter: dayDiff(end, actualToday),
      };
    return {
      phase: "active",
      today: actualToday,
      actualToday,
      totalDays,
      elapsedDays: dayDiff(start, actualToday) + 1,
      remainingDays: dayDiff(actualToday, end) + 1,
    };
  }

  function spentForCategory(categoryId, throughDate = null) {
    return expenses
      .filter(
        (e) =>
          Number(e.category_id) === Number(categoryId) &&
          (!throughDate || e.expense_date <= throughDate),
      )
      .reduce((s, e) => s + num(e.amount), 0);
  }
  function totalSpent(throughDate = null) {
    return expenses
      .filter((e) => !throughDate || e.expense_date <= throughDate)
      .reduce((s, e) => s + num(e.amount), 0);
  }

  function categoryById(id) {
    return categories.find((c) => Number(c.id) === Number(id));
  }
  function categoryPalette(id) {
    const index = Math.max(
      0,
      categories.findIndex((c) => Number(c.id) === Number(id)),
    );
    return categoryPalettes[index % categoryPalettes.length];
  }
  function categoryStyle(id) {
    const p = categoryPalette(id);
    return `--category-color:${p.color};--category-bg:${p.bg};--category-border:${p.border}`;
  }

  function computeMetrics(budget, spent, closed = false) {
    const t = timeline();
    budget = num(budget);
    spent = num(spent);
    const remaining = round2(budget - spent);
    const usage = budget > 0 ? (spent / budget) * 100 : null;
    const averageDaily = t.elapsedDays > 0 ? spent / t.elapsedDays : null;
    const spendDays =
      t.phase === "before"
        ? t.totalDays
        : t.phase === "active"
          ? t.remainingDays
          : 0;
    const dailyAvailable =
      spendDays > 0 && !closed ? Math.max(remaining, 0) / spendDays : null;
    const targetUsage =
      t.phase === "before"
        ? 0
        : t.phase === "after"
          ? 100
          : (t.elapsedDays / t.totalDays) * 100;
    const targetSpent = (budget * targetUsage) / 100;
    const paceDifference = round2(spent - targetSpent);
    let state = "neutral",
      label = "مطابق";
    if (remaining < 0) {
      state = "danger";
      label = "عجز";
    } else if (closed && Math.abs(remaining) <= 0.005) {
      state = "good";
      label = "مكتمل";
    } else if (budget <= 0 && spent <= 0) {
      state = "neutral";
      label = "غير محدد";
    } else if (Math.abs(remaining) <= 0.005) {
      state = "neutral";
      label = "مطابق";
    } else if (closed) {
      state = "danger";
      label = "غير متوازن";
    } else if (t.phase === "after") {
      state = "good";
      label = "فائض";
    } else if (t.phase === "before") {
      state = "neutral";
      label = "قبل الرحلة";
    } else if (paceDifference > 0.005) {
      state = "warn";
      label = "تجاوز";
    } else if (paceDifference < -0.005) {
      state = "good";
      label = "موفر";
    }
    return {
      budget,
      spent,
      remaining,
      usage,
      averageDaily,
      dailyAvailable,
      targetUsage,
      paceDifference,
      state,
      label,
      t,
      closed,
    };
  }

  function budgetCard({
    title,
    icon,
    budget,
    spent,
    total = false,
    closed = false,
    categoryId = null,
    collapsible = false,
    collapsed = false,
  }) {
    const m = computeMetrics(budget, spent, closed);
    const barWidth =
      m.usage === null
        ? spent > 0
          ? 100
          : 0
        : Math.max(0, Math.min(m.usage, 100));
    const marker = Math.max(0, Math.min(m.targetUsage, 100));
    const remainingLabel = m.remaining < 0 ? "العجز" : "المتبقي";
    const progressClass = m.remaining < 0 ? "progress over-budget" : "progress";
    const usageText = m.usage === null ? "—" : `${pctFmt.format(m.usage)}%`;
    const statusTitle = closed ? "اكتمل الصرف ورصيد التصنيف صفر" : m.label;
    const style = categoryId ? ` style="${categoryStyle(categoryId)}"` : "";
    const categoryClass = categoryId ? " category-budget-card" : "";
    const toggle = collapsible
      ? `<button class="collapse-btn card-collapse-btn${collapsed ? " collapsed" : ""}" type="button" data-budget-collapse aria-expanded="${collapsed ? "false" : "true"}" aria-label="تصغير أو تكبير البطاقة"><svg class="chevron-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`
      : "";
    return `
      <article class="budget-card ${total ? "total-card" : ""}${categoryClass}"${style}>
        <div class="card-head">
          <div class="card-title"><span class="card-icon">${total ? '<img src="app-icon.png?v=9" alt="" style="width:30px;height:30px;object-fit:contain;display:block;">' : escapeHtml(icon)}</span><div><h3>${escapeHtml(title)}</h3></div></div>
          <div class="card-head-actions"><span class="status-pill ${m.state}" title="${escapeHtml(statusTitle)}">${escapeHtml(m.label)}</span>${toggle}</div>
        </div>
        <div class="budget-card-content${collapsed ? " collapsed" : ""}">
          <div class="metrics-grid">
            <div class="metric metric-budget"><span>الميزانية</span><b>${money(m.budget)}</b></div>
            <div class="metric metric-spent"><span>المصروف</span><b>${money(m.spent)}</b></div>
            <div class="metric metric-remaining ${m.remaining < 0 ? "metric-deficit" : ""}"><span>${remainingLabel}</span><b>${money(Math.abs(m.remaining))}</b></div>
            <div class="metric metric-average" title="المصروف ÷ الأيام المنقضية"><span>متوسط الصرف</span><b>${m.averageDaily === null ? "—" : money(m.averageDaily)}</b></div>
            <div class="metric metric-daily"><span>المتاح اليومي للصرف</span><b>${m.dailyAvailable === null ? "—" : money(m.dailyAvailable)}</b></div>
          </div>
          <div class="progress-wrap">
            <div class="progress-meta"><span>نسبة الصرف ${usageText}</span><span class="pace-legend">المدة المنقضية ${pctFmt.format(m.targetUsage)}%</span></div>
            <div class="${progressClass}"><i class="${m.state}" style="width:${barWidth}%"></i><span class="pace-marker" style="right:${marker}%" title="المدة المنقضية"></span></div>
          </div>
        </div>
      </article>`;
  }

  function renderHeader() {
    const t = timeline();
    els.tripPhase.textContent = "";
    els.tripPhase.classList.add("hidden");
    if (t.phase === "before")
      els.dateContext.textContent = `${weekdayDateFmt.format(parseDate(t.actualToday))} • تبدأ بعد ${t.daysUntil} يوم`;
    else if (t.phase === "active")
      els.dateContext.textContent = `${weekdayDateFmt.format(parseDate(t.actualToday))} • ${t.remainingDays} يوم متبقي`;
    else
      els.dateContext.textContent = `${weekdayDateFmt.format(parseDate(t.actualToday))} • انتهت الرحلة`;
    els.userBadge.textContent = profile?.display_name || "";
    els.userBadge.title = profile?.role === "admin" ? "أدمن" : "عضو";
  }

  function renderDashboard() {
    renderHeader();
    els.summaryArea.innerHTML = budgetCard({
      title: "ميزانية الرحلة كاملة",
      icon: "✈️",
      budget: trip.total_budget,
      spent: totalSpent(),
      total: true,
      collapsible: true,
      collapsed: summaryCollapsed,
    });
    if (!categories.length) {
      els.categoryGrid.innerHTML = "";
      els.categoryPosition.textContent = "";
      return;
    }
    const selected = categoryById(currentCategoryId) || categories[0];
    currentCategoryId = selected.id;
    els.categoryGrid.innerHTML = budgetCard({
      title: selected.name,
      icon: selected.icon,
      budget: selected.budget,
      spent: spentForCategory(selected.id),
      closed: selected.is_closed === true,
      categoryId: selected.id,
    });
    const index = categories.findIndex(
      (c) => Number(c.id) === Number(selected.id),
    );
    els.categoryPosition.innerHTML = `<span class="category-count-number" dir="ltr">${index + 1}</span><span>من</span><span class="category-count-number" dir="ltr">${categories.length}</span>`;
    els.categoryCardSelect.value = String(selected.id);
    els.categoryPrev.disabled = categories.length < 2;
    els.categoryNext.disabled = categories.length < 2;
  }

  function renderSelects() {
    const options = categories
      .map(
        (c) =>
          `<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`,
      )
      .join("");
    [els.entryCategory, els.editCategory].forEach((sel) => {
      if (!sel) return;
      const selected = sel.value;
      sel.innerHTML = options;
      if (categories.some((c) => String(c.id) === selected))
        sel.value = selected;
    });
    const currentFilter = els.categoryFilter.value || "all";
    els.categoryFilter.innerHTML = `<option value="all">كل التصنيفات</option>${options}`;
    els.categoryFilter.value = categories.some(
      (c) => String(c.id) === currentFilter,
    )
      ? currentFilter
      : "all";
    if (!categories.some((c) => Number(c.id) === Number(currentCategoryId)))
      currentCategoryId = categories[0]?.id || null;
    els.categoryCardSelect.innerHTML = options;
    if (currentCategoryId !== null)
      els.categoryCardSelect.value = String(currentCategoryId);
    const chartFilter = els.chartCategoryFilter.value || "all";
    els.chartCategoryFilter.innerHTML = `<option value="all">كل التصنيفات</option>${options}`;
    els.chartCategoryFilter.value = categories.some(
      (c) => String(c.id) === chartFilter,
    )
      ? chartFilter
      : "all";
  }

  function profileName(userId) {
    const p = profiles.find((x) => x.user_id === userId);
    return p?.display_name || "مستخدم";
  }

  function applyPermissions() {
    const isAdmin = profile?.role === "admin";
    els.budgetBtn.classList.toggle("hidden", !isAdmin);
    els.budgetBtn.parentElement.classList.toggle("single-action", !isAdmin);
  }

  function moveCategory(step) {
    if (categories.length < 2) return;
    const currentIndex = categories.findIndex(
      (c) => Number(c.id) === Number(currentCategoryId),
    );
    const nextIndex =
      (Math.max(currentIndex, 0) + step + categories.length) %
      categories.length;
    currentCategoryId = categories[nextIndex].id;
    renderDashboard();
  }

  function selectAnalyticsTab(name) {
    const distribution = name === "distribution";
    [
      [els.distributionTab, distribution],
      [els.trendTab, !distribution],
    ].forEach(([tab, selected]) => {
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    els.distributionPanel.classList.toggle("hidden", !distribution);
    els.trendPanel.classList.toggle("hidden", distribution);
  }

  function dailySpending(categoryId = "all") {
    return tripDays().map((day) => {
      const perCategory = categories
        .map((c) => {
          const amount = expenses
            .filter(
              (e) =>
                e.expense_date === day &&
                Number(e.category_id) === Number(c.id) &&
                (categoryId === "all" || String(c.id) === String(categoryId)),
            )
            .reduce((sum, e) => sum + num(e.amount), 0);
          return {
            category: c,
            amount: round2(amount),
            palette: categoryPalette(c.id),
          };
        })
        .filter((x) => x.amount > 0);
      return {
        day,
        total: round2(perCategory.reduce((sum, x) => sum + x.amount, 0)),
        segments: perCategory,
      };
    });
  }

  function tripProgressStrip() {
    const t = timeline();
    const totalDays = Math.max(1, t.totalDays);
    const elapsed =
      t.phase === "before"
        ? 0
        : t.phase === "after"
          ? totalDays
          : t.elapsedDays;
    const elapsedPct = Math.max(0, Math.min(100, (elapsed / totalDays) * 100));
    const days = tripDays();
    const currentKey = t.actualToday;
    const cells = days
      .map((day, index) => {
        const done = index < elapsed;
        const today = t.phase === "active" && day === currentKey;
        const cls = `${done ? " elapsed" : ""}${today ? " today" : ""}`;
        return `<i class="trip-day-cell${cls}" title="${escapeHtml(weekdayDateFmt.format(parseDate(day)))}"></i>`;
      })
      .join("");
    const context =
      t.phase === "before"
        ? `تبدأ بعد ${t.daysUntil} يوم`
        : t.phase === "active"
          ? `${t.remainingDays} يوم متبقي`
          : "انتهت الرحلة";
    return `<div class="analytics-trip-progress" aria-label="تقدم مدة الرحلة"><div class="trip-progress-head"><span>المدة المنقضية</span><b>${pctFmt.format(elapsedPct)}%</b><span>${escapeHtml(context)}</span></div><div class="trip-days-track" aria-hidden="true">${cells}</div></div>`;
  }

  function renderAnalytics() {
    const total = totalSpent();
    const spentCategories = categories.map((c) => ({
      ...c,
      spent: spentForCategory(c.id),
      palette: categoryPalette(c.id),
    }));
    const donutCategories = spentCategories.filter((c) => c.spent > 0);

    const tripProgress = tripProgressStrip();
    if (total <= 0) {
      els.spendingDistribution.innerHTML = `${tripProgress}<div class="empty-state">لا توجد مصروفات</div>`;
    } else {
      let offset = 0;
      const segments = donutCategories
        .map((c) => {
          const share = (c.spent / total) * 100;
          const title = `${c.name}: ${pctFmt.format(share)}% من المصروف الإجمالي — ${formatAmount(c.spent)} ر.س`;
          const segment = `<circle class="donut-segment" tabindex="0" role="button" cx="100" cy="100" r="76" pathLength="100" fill="none" stroke="${c.palette.color}" stroke-width="24" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)" data-name="${escapeHtml(c.name)}" data-amount="${escapeHtml(formatAmount(c.spent))}" data-share="${escapeHtml(pctFmt.format(share))}" aria-label="${escapeHtml(title)}"><title>${escapeHtml(title)}</title></circle>`;
          offset += share;
          return segment;
        })
        .join("");
      const donut = `<div class="donut-wrap"><svg viewBox="0 0 200 200" aria-label="توزيع المصروف حسب التصنيف"><circle cx="100" cy="100" r="76" fill="none" stroke="#edf0f3" stroke-width="24"/>${segments}</svg><div class="donut-total"><span class="donut-label">إجمالي المصروف</span><b class="donut-value">${money(total)}</b><small class="donut-share">المجموع 100%</small></div></div>`;
      const rows = spentCategories
        .map((c) => {
          const budget = num(c.budget);
          const usage =
            budget > 0 ? (c.spent / budget) * 100 : c.spent > 0 ? 100 : 0;
          const width = Math.max(0, Math.min(usage, 100));
          const remaining = round2(budget - c.spent);
          const balanceText =
            remaining < 0
              ? `عجز ${money(Math.abs(remaining))}`
              : `متبقي ${money(remaining)}`;
          return `<li style="${categoryStyle(c.id)}"><div class="ranking-head"><span><i class="chart-dot" style="background:${c.palette.color}"></i>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</span><b>${money(c.spent)} من ${money(budget)}</b></div><div class="budget-compare-meta"><span>استهلاك الميزانية ${pctFmt.format(usage)}%</span><span class="${remaining < 0 ? "danger-text" : ""}">${balanceText}</span></div><div class="ranking-track budget-ranking-track"><i style="width:${width}%;background:${c.palette.color}"></i></div></li>`;
        })
        .join("");
      els.spendingDistribution.innerHTML = `${tripProgress}<div class="distribution-layout">${donut}<ol class="chart-ranking" aria-label="المصروف مقارنة بميزانية كل تصنيف">${rows}</ol></div>`;

      const donutWrap = els.spendingDistribution.querySelector(".donut-wrap");
      const labelEl = donutWrap?.querySelector(".donut-label");
      const valueEl = donutWrap?.querySelector(".donut-value");
      const shareEl = donutWrap?.querySelector(".donut-share");
      const segmentEls = [
        ...(donutWrap?.querySelectorAll(".donut-segment") || []),
      ];
      let pinned = null;
      const showTotal = () => {
        if (!labelEl || !valueEl || !shareEl) return;
        labelEl.textContent = "إجمالي المصروف";
        valueEl.innerHTML = money(total);
        shareEl.textContent = "المجموع 100%";
        segmentEls.forEach((x) => x.classList.remove("active"));
      };
      const showSegment = (seg) => {
        if (!seg || !labelEl || !valueEl || !shareEl) return;
        segmentEls.forEach((x) => x.classList.toggle("active", x === seg));
        labelEl.textContent = seg.dataset.name || "";
        valueEl.textContent = `${seg.dataset.amount || "0"} ر.س`;
        shareEl.textContent = `${seg.dataset.share || "0"}% من المصروف الإجمالي`;
      };
      segmentEls.forEach((seg) => {
        seg.addEventListener("pointerenter", () => showSegment(seg));
        seg.addEventListener("pointerleave", () =>
          pinned ? showSegment(pinned) : showTotal(),
        );
        seg.addEventListener("focus", () => showSegment(seg));
        seg.addEventListener("blur", () =>
          pinned ? showSegment(pinned) : showTotal(),
        );
        seg.addEventListener("click", () => {
          pinned = pinned === seg ? null : seg;
          pinned ? showSegment(pinned) : showTotal();
        });
        seg.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            seg.click();
          }
        });
      });
    }

    const filter = els.chartCategoryFilter.value || "all";
    const daily = dailySpending(filter);
    const legendCategories =
      filter === "all"
        ? categories
        : categories.filter((c) => String(c.id) === filter);
    const legend = `<div class="daily-legend">${legendCategories.map((c) => `<span><i style="background:${categoryPalette(c.id).color}"></i>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</span>`).join("")}</div>`;
    const comparisonDays = daily.slice(1);
    const scaleMax = Math.max(0, ...comparisonDays.map((d) => d.total));
    const visualMax = scaleMax > 0 ? scaleMax : 1;
    const cards = daily
      .map((d, dayIndex) => {
        const fillHeight =
          d.total > 0
            ? Math.max(4, Math.min((d.total / visualMax) * 100, 100))
            : 0;
        const segments = d.segments
          .map((seg) => {
            const share = d.total > 0 ? (seg.amount / d.total) * 100 : 0;
            const title = `${seg.category.name}: ${pctFmt.format(share)}% من صرف اليوم — ${formatAmount(seg.amount)} ر.س`;
            return `<i class="daily-column-segment" style="height:${share}%;background:${seg.palette.color}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></i>`;
          })
          .join("");
        const capped = dayIndex === 0 && scaleMax > 0 && d.total > scaleMax;
        const cardTitle = capped
          ? `صرف اليوم الأول أعلى من مقياس الأيام 2–30: ${formatAmount(d.total)} ر.س`
          : `مصروف ${dateFmt.format(parseDate(d.day))}: ${formatAmount(d.total)} ر.س`;
        return `<article class="daily-column-card${capped ? " scale-capped" : ""}" title="${escapeHtml(cardTitle)}"><div class="daily-card-date">${escapeHtml(dateFmt.format(parseDate(d.day)))}</div><div class="daily-column-stage" aria-label="مصروف ${escapeHtml(dateFmt.format(parseDate(d.day)))}"><div class="daily-column-fill" style="height:${fillHeight}%">${segments}</div></div><b class="daily-card-amount">${d.total > 0 ? money(d.total) : "—"}</b></article>`;
      })
      .join("");
    els.spendingTrend.innerHTML = `<div class="daily-chart"><div class="daily-columns-grid">${cards}</div>${legend}</div>`;
  }

  function ledgerSnapshots() {
    const ordered = expenses.slice().sort((a, b) => {
      if (a.expense_date !== b.expense_date)
        return a.expense_date.localeCompare(b.expense_date);
      const ca = String(a.created_at || ""),
        cb = String(b.created_at || "");
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a.id).localeCompare(String(b.id));
    });
    let tripSpent = 0;
    const catSpent = new Map();
    const map = new Map();
    ordered.forEach((e) => {
      const amount = num(e.amount);
      tripSpent += amount;
      const cid = Number(e.category_id);
      const nextCatSpent = (catSpent.get(cid) || 0) + amount;
      catSpent.set(cid, nextCatSpent);
      const c = categoryById(cid);
      map.set(e.id, {
        tripRemaining: round2(num(trip.total_budget) - tripSpent),
        categoryRemaining: round2(num(c?.budget) - nextCatSpent),
      });
    });
    return map;
  }

  function ensureLedgerDate() {
    if (!trip) return;
    currentLedgerDate = clampTripDate(currentLedgerDate || defaultEntryDate());
  }
  function moveLedgerDay(step) {
    currentLedgerMode = "day";
    ensureLedgerDate();
    const days = tripDays();
    const index = Math.max(0, days.indexOf(currentLedgerDate));
    const next = Math.max(0, Math.min(days.length - 1, index + step));
    currentLedgerDate = days[next];
    renderExpenses();
  }
  function balanceLabel(value) {
    return value < -0.005 ? "عجز" : "متبقي";
  }

  function renderExpenses() {
    ensureLedgerDate();
    const allDays = currentLedgerMode === "all";
    const days = tripDays();
    const dayIndex = Math.max(0, days.indexOf(currentLedgerDate));
    if (allDays) {
      els.ledgerDayLabel.textContent = "كل الأيام";
      els.ledgerPrevDay.disabled = true;
      els.ledgerNextDay.disabled = true;
      els.ledgerAllDays.textContent = "عرض اليوم";
      els.ledgerAllDays.classList.add("active");
    } else {
      els.ledgerDayLabel.textContent = weekdayDateFmt.format(
        parseDate(currentLedgerDate),
      );
      els.ledgerPrevDay.disabled = dayIndex <= 0;
      els.ledgerNextDay.disabled = dayIndex >= days.length - 1;
      els.ledgerAllDays.textContent = "كل العمليات";
      els.ledgerAllDays.classList.remove("active");
    }

    const filter = els.categoryFilter.value || "all";
    let list = allDays
      ? expenses.slice()
      : expenses.filter((e) => e.expense_date === currentLedgerDate);
    if (filter !== "all")
      list = list.filter((e) => String(e.category_id) === filter);
    if (allDays) {
      list.sort(
        (a, b) =>
          String(b.created_at || "").localeCompare(
            String(a.created_at || ""),
          ) ||
          String(b.expense_date).localeCompare(String(a.expense_date)) ||
          String(b.id).localeCompare(String(a.id)),
      );
    } else {
      list.sort(
        (a, b) =>
          String(b.created_at || "").localeCompare(
            String(a.created_at || ""),
          ) || String(b.id).localeCompare(String(a.id)),
      );
    }

    els.expenseCount.textContent = allDays
      ? `${list.length} عملية • كل الأيام`
      : `${list.length} عملية`;
    if (!list.length) {
      els.expenseList.innerHTML = `<div class="empty-state">لا توجد عمليات${allDays ? "" : " في هذا اليوم"}${filter !== "all" ? " لهذا التصنيف" : ""}.</div>`;
      return;
    }

    const snapshots = ledgerSnapshots();
    const isAdmin = profile?.role === "admin";
    els.expenseList.innerHTML = list
      .map((e) => {
        const c = categoryById(e.category_id) || {
          id: 0,
          icon: "•",
          name: "تصنيف",
          is_closed: false,
        };
        const kind = e.entry_type === "reconciliation" ? "فرق" : "مباشر";
        const metadata = [
          allDays ? weekdayDateFmt.format(parseDate(e.expense_date)) : null,
          e.note || "بدون ملاحظة",
          kind,
          profileName(e.created_by),
        ].filter(Boolean);
        const snapshot = snapshots.get(e.id) || {
          tripRemaining: round2(num(trip.total_budget)),
          categoryRemaining: round2(num(c.budget)),
        };
        const categoryBalance = `${balanceLabel(snapshot.categoryRemaining)} ${c.name}`;
        const tripBalance = `${balanceLabel(snapshot.tripRemaining)} الرحلة`;
        return `
        <div class="expense-row" data-id="${e.id}" style="${categoryStyle(c.id)}">
          <span class="expense-ico">${escapeHtml(c.icon)}</span>
          <div class="expense-main">
            <b>${escapeHtml(c.name)}</b>
            <small class="expense-meta">${metadata.map((value) => `<span>${escapeHtml(value)}</span>`).join('<span aria-hidden="true">•</span>')}</small>
            <small class="expense-balances"><span class="balance-chip ${snapshot.categoryRemaining < -0.005 ? "deficit" : ""}">${escapeHtml(categoryBalance)}: <b>${money(Math.abs(snapshot.categoryRemaining))}</b></span><span class="balance-chip ${snapshot.tripRemaining < -0.005 ? "deficit" : ""}">${escapeHtml(tripBalance)}: <b>${money(Math.abs(snapshot.tripRemaining))}</b></span></small>
          </div>
          <div class="expense-amount">${money(e.amount)}</div>
          <div class="row-actions">
            ${isAdmin ? `<button class="row-btn edit-expense" type="button" data-id="${e.id}" title="تعديل">✎</button>` : ""}
            ${isAdmin ? `<button class="row-btn delete delete-expense" type="button" data-id="${e.id}" title="حذف" aria-label="حذف العملية"><svg viewBox="0 0 24 24" class="trash-icon" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg></button>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  function renderAll() {
    if (!trip) return;
    renderSelects();
    applyPermissions();
    renderDashboard();
    renderExpenses();
    renderAnalytics();
    updateEntryPreview();
    if (els.editDialog.open) {
      if (els.editType.value === "reconciliation") updateEditReconcilePreview();
      else updateEditDirectGuard();
    }
  }

  async function loadExpenses() {
    const rows = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const result = await db
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + pageSize - 1);
      if (result.error) return result;
      rows.push(...(result.data || []));
      if ((result.data || []).length < pageSize)
        return { data: rows, error: null };
    }
  }

  async function ensureCurrentProfile() {
    if (!db || !currentUser) return;
    try {
      const result = await db.rpc("ensure_current_profile");
      if (result?.error && result.error.code !== "PGRST202")
        console.warn("ensure_current_profile:", result.error);
    } catch (error) {
      console.warn("ensure_current_profile:", error);
    }
  }

  async function loadAll({ quiet = false, retries = 3 } = {}) {
    if (!db) return false;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const [tripRes, catRes, expRes, profRes] = await Promise.all([
        db.from("trip").select("*").eq("id", 1).single(),
        db.from("categories").select("*").order("sort_order"),
        loadExpenses(),
        db.from("profiles").select("user_id,username,display_name,role"),
      ]);
      lastError =
        tripRes.error || catRes.error || expRes.error || profRes.error;
      if (!lastError) {
        trip = tripRes.data;
        categories = catRes.data || [];
        expenses = (expRes.data || []).filter(
          (e) =>
            e.expense_date >= trip.start_date &&
            e.expense_date <= trip.end_date,
        );
        profiles = profRes.data || [];
        profile = profiles.find((p) => p.user_id === currentUser?.id) || null;
        ensureLedgerDate();
        renderAll();
        return true;
      }
      console.warn(`loadAll attempt ${attempt + 1} failed`, lastError);
      if (attempt < retries) {
        if (attempt === 0) await ensureCurrentProfile();
        if (attempt === 1) {
          try {
            await db.auth.refreshSession();
          } catch (_) {}
        }
        await wait(180 * (attempt + 1));
      }
    }
    console.error(lastError);
    if (!quiet) showToast("تعذر تحميل البيانات");
    return false;
  }

  async function showApp(session) {
    currentUser = session.user;
    els.loginView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    await ensureCurrentProfile();
    const loaded = await loadAll({ retries: 4 });
    if (!loaded) return;
    initTestClock();
    renderAll();
    subscribeRealtime();
  }

  function showLogin() {
    currentUser = null;
    profile = null;
    trip = null;
    categories = [];
    expenses = [];
    profiles = [];
    clearTimeout(reloadTimer);
    [
      els.entryDialog,
      els.editDialog,
      els.budgetDialog,
      els.deleteDialog,
    ].forEach(closeDialog);
    if (realtimeChannel && db) db.removeChannel(realtimeChannel);
    realtimeChannel = null;
    els.appView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
  }

  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db
      .channel("trip-budget-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip" },
        scheduleReload,
      )
      .subscribe();
  }
  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => loadAll({ quiet: true }), 250);
  }

  function updateTestDateButtons() {
    if (!trip || !els.testDate) return;
    const value = clampTripDate(els.testDate.value || defaultEntryDate());
    els.testPrevDay.disabled = value <= trip.start_date;
    els.testNextDay.disabled = value >= trip.end_date;
  }
  function initTestClock() {
    if (!els.testTimeBar || !els.testDate || !trip) return;
    testDateOverride = null;
    els.testDate.min = trip.start_date;
    els.testDate.max = trip.end_date;
    els.testDate.value = clampTripDate(keyFromDate(new Date()));
    updateTestDateButtons();
  }
  function moveTestDate(days) {
    if (!els.testDate || !trip) return;
    const base = parseDate(
      clampTripDate(els.testDate.value || defaultEntryDate()),
    );
    base.setDate(base.getDate() + days);
    const next = clampTripDate(keyFromDate(base));
    els.testDate.value = next;
    testDateOverride = next;
    currentLedgerDate = next;
    updateTestDateButtons();
    renderAll();
  }
  function useRealDate() {
    if (!els.testDate || !trip) return;
    testDateOverride = null;
    els.testDate.value = clampTripDate(keyFromDate(new Date()));
    currentLedgerDate = els.testDate.value;
    updateTestDateButtons();
    renderAll();
  }

  function setDialogDateInputs() {
    if (!trip) return;
    [els.entryDate, els.editDate].forEach((input) => {
      if (!input) return;
      input.min = trip.start_date;
      input.max = trip.end_date;
      input.value = clampTripDate(input.value || defaultEntryDate());
    });
  }
  function openDialog(dialog) {
    setDialogDateInputs();
    if (typeof dialog?.showModal === "function") dialog.showModal();
  }
  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
  }

  function setEntryMode(mode, { clearValues = false } = {}) {
    const balance = mode === "reconciliation";
    if (clearValues) {
      els.entryAmount.value = "";
      els.entryBalance.value = "";
      els.reconcileDifference.textContent = "—";
      els.entryGuard.className = "inline-note";
      els.entryGuard.textContent = "";
    }
    els.entryMode.value = balance ? "reconciliation" : "direct";
    els.modeDirectBtn.classList.toggle("active", !balance);
    els.modeBalanceBtn.classList.toggle("active", balance);
    els.directAmountFields.classList.toggle("hidden", balance);
    els.balanceAmountFields.classList.toggle("hidden", !balance);
    els.entryAmount.required = !balance;
    els.entryBalance.required = balance;
    updateEntryPreview();
  }

  function expensesThrough(date, excludeId = null) {
    return expenses.filter((e) => e.expense_date <= date && e.id !== excludeId);
  }
  function expectedBalanceFor(date, excludeId = null) {
    const spent = expensesThrough(date, excludeId).reduce(
      (s, e) => s + num(e.amount),
      0,
    );
    return round2(num(trip.total_budget) - spent);
  }
  function sameDayDirect(date, excludeId = null) {
    return expenses.filter(
      (e) =>
        e.expense_date === date &&
        e.entry_type === "direct" &&
        e.id !== excludeId,
    );
  }

  function renderSameDayOps(date) {
    const dayOps = sameDayDirect(date);
    if (!dayOps.length) {
      els.sameDayBox.innerHTML = "";
      return;
    }
    els.sameDayBox.innerHTML = dayOps
      .map((e) => {
        const c = categoryById(e.category_id);
        return `<div class="same-day-item"><span>${escapeHtml(c?.name || "تصنيف")}${e.note ? ` • ${escapeHtml(e.note)}` : ""}</span><b>${money(e.amount)}</b></div>`;
      })
      .join("");
  }

  function showRemainingPreview(
    target,
    totalRemaining,
    category,
    categoryRemaining,
  ) {
    const label = (value) => (value < -0.005 ? "عجز" : "متبقي");
    target.className =
      totalRemaining < -0.005 || categoryRemaining < -0.005
        ? "inline-note danger"
        : "inline-note good";
    const items = [];
    if (category) items.push({ name: category.name, value: categoryRemaining });
    items.push({ name: "الرحلة", value: totalRemaining });
    target.innerHTML = items
      .map(
        (item) =>
          `<div class="preview-row"><span>${label(item.value)} ${escapeHtml(item.name)}</span><b>${money(Math.abs(item.value))}</b></div>`,
      )
      .join("");
  }

  function updateDirectPreview() {
    if (!trip) return;
    const amount = round2(num(els.entryAmount.value));
    const c = categoryById(els.entryCategory.value);
    if (c?.is_closed) {
      els.entryGuard.className = "inline-note danger";
      els.entryGuard.textContent =
        "هذا التصنيف مكتمل. افتحه من الميزانيات قبل إضافة عملية جديدة.";
      els.entrySubmit.disabled = true;
      return;
    }
    const totalRemaining = round2(
      num(trip.total_budget) - totalSpent() - amount,
    );
    const catRemaining = c
      ? round2(num(c.budget) - spentForCategory(c.id) - amount)
      : 0;
    if (!amount) {
      els.entryGuard.className = "inline-note";
      els.entryGuard.textContent = "";
      els.entrySubmit.disabled = false;
      return;
    }
    showRemainingPreview(els.entryGuard, totalRemaining, c, catRemaining);
    els.entrySubmit.disabled = false;
  }

  function updateBalancePreview() {
    if (!trip) return;
    const date = clampTripDate(els.entryDate.value || defaultEntryDate());
    const c = categoryById(els.entryCategory.value);
    if (c?.is_closed) {
      els.entryGuard.className = "inline-note danger";
      els.entryGuard.textContent =
        "هذا التصنيف مكتمل. افتحه من الميزانيات قبل إضافة عملية جديدة.";
      els.entrySubmit.disabled = true;
      return;
    }
    const expected = expectedBalanceFor(date);
    const actualRaw = els.entryBalance.value;
    els.expectedBalance.textContent = money(expected);
    renderSameDayOps(date);
    if (actualRaw === "") {
      els.reconcileDifference.textContent = "—";
      els.entryGuard.className = "inline-note";
      els.entryGuard.textContent = "";
      els.entrySubmit.disabled = true;
      return;
    }
    const actual = round2(num(actualRaw));
    const diff = round2(expected - actual);
    const remainingAllBefore = round2(num(trip.total_budget) - totalSpent());
    els.reconcileDifference.textContent = money(diff);
    if (actual < 0) {
      els.entryGuard.className = "inline-note danger";
      els.entryGuard.textContent = "القيمة غير صحيحة";
      els.entrySubmit.disabled = true;
    } else if (actual > num(trip.total_budget)) {
      els.entryGuard.className = "inline-note danger";
      els.entryGuard.textContent = `أعلى من ميزانية الرحلة بـ ${money(actual - num(trip.total_budget))}`;
      els.entrySubmit.disabled = true;
    } else if (diff < -0.005) {
      els.entryGuard.className = "inline-note warn";
      els.entryGuard.textContent = `أعلى من الرصيد الحالي بـ ${money(Math.abs(diff))}`;
      els.entrySubmit.disabled = true;
    } else if (Math.abs(diff) <= 0.005) {
      els.entryGuard.className = "inline-note good";
      els.entryGuard.textContent = "مطابق";
      els.entrySubmit.disabled = true;
    } else {
      const catRemaining = c
        ? round2(num(c.budget) - spentForCategory(c.id) - diff)
        : 0;
      showRemainingPreview(
        els.entryGuard,
        round2(remainingAllBefore - diff),
        c,
        catRemaining,
      );
      els.entrySubmit.disabled = false;
    }
  }

  function updateEntryPreview() {
    if (!trip || !els.entryMode) return;
    if (els.entryMode.value === "reconciliation") updateBalancePreview();
    else updateDirectPreview();
  }

  function updateBudgetDifference() {
    const total = round2(num(els.totalBudgetInput.value));
    const fields = [
      ...els.categoryBudgetFields.querySelectorAll("input[data-category-id]"),
    ];
    const sum = round2(fields.reduce((s, input) => s + num(input.value), 0));
    const diff = round2(sum - total);
    const balanced = Math.abs(diff) <= 0.005;
    els.budgetDifference.classList.toggle("invalid", !balanced);
    els.budgetDifference.innerHTML = balanced
      ? `مجموع التصنيفات: <b>${money(sum)}</b> • مطابق لميزانية الرحلة`
      : `مجموع التصنيفات: <b>${money(sum)}</b> • يجب أن يساوي ميزانية الرحلة. الفرق: <b>${money(Math.abs(diff))}</b>`;
    const submit = els.budgetForm?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !balanced;
    updateTransferControls();
  }

  function transferOptions(sourceId) {
    return categories
      .filter((c) => Number(c.id) !== Number(sourceId) && !c.is_closed)
      .map(
        (c) =>
          `<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`,
      )
      .join("");
  }

  function updateTransferControls() {
    if (!els.categoryBudgetFields) return;
    categories.forEach((c) => {
      const input = els.categoryBudgetFields.querySelector(
        `[data-category-id="${c.id}"]`,
      );
      const checkbox = els.categoryBudgetFields.querySelector(
        `[data-closed-id="${c.id}"]`,
      );
      const box = els.categoryBudgetFields.querySelector(
        `[data-transfer-box-id="${c.id}"]`,
      );
      const text = els.categoryBudgetFields.querySelector(
        `[data-transfer-text-id="${c.id}"]`,
      );
      if (!input || !checkbox || !box || !text) return;
      const diff = round2(num(input.value) - spentForCategory(c.id));
      const needsTransfer = checkbox.checked && Math.abs(diff) > 0.005;
      box.classList.toggle("hidden", !needsTransfer);
      if (needsTransfer)
        text.textContent =
          diff > 0
            ? `فائض ${money(diff)} — يرحّل إلى`
            : `عجز ${money(Math.abs(diff))} — يؤخذ من`;
    });
  }

  function openBudgets() {
    if (profile?.role !== "admin") return;
    setMoneyField(els.totalBudgetInput, trip.total_budget);
    els.categoryBudgetFields.innerHTML = categories
      .map(
        (c) => `
      <div class="budget-mini" style="${categoryStyle(c.id)}">
        <label for="category-budget-${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</label>
        <input id="category-budget-${c.id}" class="money-number" data-category-id="${c.id}" type="text" inputmode="decimal" autocomplete="off" value="${moneyValue(c.budget)}" />
        <label class="category-close-toggle"><input type="checkbox" data-closed-id="${c.id}" ${c.is_closed ? "checked" : ""} /><span>اكتمل الصرف</span></label>
        <div class="transfer-box hidden" data-transfer-box-id="${c.id}">
          <span data-transfer-text-id="${c.id}"></span>
          <select data-transfer-target-id="${c.id}" aria-label="تصنيف ترحيل الفرق"><option value="">اختر التصنيف</option>${transferOptions(c.id)}</select>
        </div>
      </div>`,
      )
      .join("");
    updateBudgetDifference();
    openDialog(els.budgetDialog);
  }

  function prepareBudgetPayload() {
    const draft = new Map();
    const closed = new Map();
    categories.forEach((c) => {
      const input = els.categoryBudgetFields.querySelector(
        `[data-category-id="${c.id}"]`,
      );
      const checkbox = els.categoryBudgetFields.querySelector(
        `[data-closed-id="${c.id}"]`,
      );
      draft.set(Number(c.id), round2(num(input?.value)));
      closed.set(Number(c.id), Boolean(checkbox?.checked));
    });

    for (const c of categories) {
      const cid = Number(c.id);
      if (!closed.get(cid)) continue;
      const spent = round2(spentForCategory(cid));
      const diff = round2((draft.get(cid) || 0) - spent);
      if (Math.abs(diff) <= 0.005) {
        draft.set(cid, spent);
        continue;
      }
      const select = els.categoryBudgetFields.querySelector(
        `[data-transfer-target-id="${cid}"]`,
      );
      const targetId = Number(select?.value || 0);
      if (!targetId || targetId === cid || !draft.has(targetId))
        return { error: `اختر تصنيفًا لترحيل فرق ${c.name}.` };
      if (closed.get(targetId))
        return { error: "لا يمكن ترحيل الفرق إلى تصنيف سيتم إغلاقه." };
      const nextTarget = round2((draft.get(targetId) || 0) + diff);
      if (nextTarget < -0.005)
        return { error: "ميزانية التصنيف المستلم لا تكفي لتغطية العجز." };
      draft.set(cid, spent);
      draft.set(targetId, Math.max(0, nextTarget));
    }

    const total = round2(num(els.totalBudgetInput.value));
    const sum = round2(
      [...draft.values()].reduce((acc, value) => acc + num(value), 0),
    );
    if (Math.abs(sum - total) > 0.005)
      return {
        error: "مجموع ميزانيات التصنيفات يجب أن يساوي ميزانية الرحلة بالكامل.",
      };
    return {
      payload: categories.map((c) => ({
        id: Number(c.id),
        budget: round2(draft.get(Number(c.id))),
        is_closed: closed.get(Number(c.id)),
      })),
    };
  }

  function openEdit(id) {
    if (profile?.role !== "admin") return;
    const e = expenses.find((x) => x.id === id);
    if (!e) return;
    els.editId.value = e.id;
    els.editType.value = e.entry_type;
    els.editCategory.value = e.category_id;
    els.editDate.value = clampTripDate(e.expense_date);
    els.editNote.value = e.note || "";
    els.editWarning.className = "inline-note";
    els.editWarning.textContent = "";
    if (e.entry_type === "reconciliation") {
      els.editTitle.textContent = "تعديل الفرق";
      els.editDirectFields.classList.add("hidden");
      els.editReconcileFields.classList.remove("hidden");
      setMoneyField(els.editReportedBalance, e.reported_balance);
      updateEditReconcilePreview();
    } else {
      els.editTitle.textContent = "تعديل المصروف";
      els.editDirectFields.classList.remove("hidden");
      els.editReconcileFields.classList.add("hidden");
      setMoneyField(els.editAmount, e.amount);
      updateEditDirectGuard();
    }
    openDialog(els.editDialog);
  }

  function updateEditDirectGuard() {
    if (!trip) return;
    const id = els.editId.value;
    const old = expenses.find((x) => x.id === id);
    if (!old || old.entry_type !== "direct") return;
    const c = categoryById(els.editCategory.value);
    const submit = els.editForm.querySelector('button[type="submit"]');
    const amount = round2(num(els.editAmount.value));
    const spentOthers = expenses
      .filter((e) => e.id !== id)
      .reduce((s, e) => s + num(e.amount), 0);
    const remaining = round2(num(trip.total_budget) - spentOthers - amount);
    const catSpentOthers = c
      ? expenses
          .filter((e) => e.id !== id && Number(e.category_id) === Number(c.id))
          .reduce((s, e) => s + num(e.amount), 0)
      : 0;
    const catRemaining = c
      ? round2(num(c.budget) - catSpentOthers - amount)
      : 0;
    if (amount <= 0) {
      els.editWarning.className = "inline-note danger";
      els.editWarning.textContent = "المبلغ يجب أن يكون أكبر من صفر";
      submit.disabled = true;
    } else {
      showRemainingPreview(els.editWarning, remaining, c, catRemaining);
      submit.disabled = false;
    }
  }

  function updateEditReconcilePreview() {
    if (!trip) return;
    const id = els.editId.value;
    const date = clampTripDate(els.editDate.value);
    const actualRaw = els.editReportedBalance.value;
    if (!id || !date) return;
    const c = categoryById(els.editCategory.value);
    const submit = els.editForm.querySelector('button[type="submit"]');
    const expected = expectedBalanceFor(date, id);
    els.editExpectedBalance.textContent = money(expected);
    if (actualRaw === "") {
      els.editComputedAmount.textContent = "—";
      els.editWarning.textContent = "";
      submit.disabled = true;
      return;
    }
    const actual = round2(num(actualRaw));
    const diff = round2(expected - actual);
    const spentOthers = expenses
      .filter((e) => e.id !== id)
      .reduce((s, e) => s + num(e.amount), 0);
    const totalRemainingAfter = round2(
      num(trip.total_budget) - spentOthers - diff,
    );
    els.editComputedAmount.textContent = money(diff);
    if (actual > num(trip.total_budget)) {
      els.editWarning.className = "inline-note danger";
      els.editWarning.textContent = `أعلى من ميزانية الرحلة بـ ${money(actual - num(trip.total_budget))}`;
      submit.disabled = true;
    } else if (diff < -0.005) {
      els.editWarning.className = "inline-note warn";
      els.editWarning.textContent = `أعلى من الرصيد الحالي بـ ${money(Math.abs(diff))}`;
      submit.disabled = true;
    } else if (Math.abs(diff) <= 0.005) {
      els.editWarning.className = "inline-note warn";
      els.editWarning.textContent = "الفرق صفر";
      submit.disabled = true;
    } else {
      const catSpentOthers = c
        ? expenses
            .filter(
              (e) => e.id !== id && Number(e.category_id) === Number(c.id),
            )
            .reduce((s, e) => s + num(e.amount), 0)
        : 0;
      showRemainingPreview(
        els.editWarning,
        totalRemainingAfter,
        c,
        c ? round2(num(c.budget) - catSpentOthers - diff) : 0,
      );
      submit.disabled = false;
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!isConfigured()) {
      els.configHint.classList.remove("hidden");
      showToast("أضف بيانات Supabase في config.js");
      return;
    }
    const username = els.username.value.trim().toLowerCase();
    const password = els.password.value;
    const genericError = "اسم المستخدم أو الرقم السري غير صحيح";
    if (!allowedUsers.has(username)) {
      els.password.value = "";
      showToast(genericError);
      return;
    }
    const submit = els.loginForm.querySelector('button[type="submit"]');
    setBusy(submit, true, "دخول…");
    const email = `${username}@budget-app.example.com`;
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(submit, false);
    if (error || !data.session) {
      els.password.value = "";
      showToast(genericError);
      return;
    }
    els.password.value = "";
    await showApp(data.session);
  }

  async function handleEntry(e) {
    e.preventDefault();
    const mode = els.entryMode.value;
    const categoryId = Number(els.entryCategory.value);
    const category = categoryById(categoryId);
    const expenseDate = els.entryDate.value;
    const note = els.entryNote.value.trim() || null;
    if (!isDateInTrip(expenseDate)) {
      showToast("التاريخ يجب أن يكون من 1 إلى 30 أكتوبر فقط.");
      return;
    }
    if (category?.is_closed) {
      showToast("هذا التصنيف مكتمل.");
      return;
    }
    let payload, successText;
    if (mode === "reconciliation") {
      const actual = round2(num(els.entryBalance.value));
      const expected = expectedBalanceFor(expenseDate);
      const diff = round2(expected - actual);
      if (diff <= 0) return;
      payload = {
        category_id: categoryId,
        amount: diff,
        expense_date: expenseDate,
        entry_type: "reconciliation",
        reported_balance: actual,
        note,
        created_by: currentUser.id,
      };
      successText = `تم تسجيل ${money(diff)}`;
    } else {
      const amount = round2(num(els.entryAmount.value));
      if (amount <= 0) return;
      payload = {
        category_id: categoryId,
        amount,
        expense_date: expenseDate,
        entry_type: "direct",
        reported_balance: null,
        note,
        created_by: currentUser.id,
      };
      successText = "تم تسجيل المصروف";
    }
    const submit = els.entrySubmit;
    setBusy(submit, true);
    const { error } = await db.from("expenses").insert(payload);
    setBusy(submit, false);
    if (error) {
      console.error(error);
      showToast(readableDbError(error));
      return;
    }
    currentLedgerDate = expenseDate;
    closeDialog(els.entryDialog);
    els.entryForm.reset();
    setEntryMode("direct");
    showToast(successText);
    await loadAll({ quiet: true });
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    const id = els.editId.value;
    const type = els.editType.value;
    const payload = {
      category_id: Number(els.editCategory.value),
      expense_date: els.editDate.value,
      note: els.editNote.value.trim() || null,
    };
    if (!isDateInTrip(payload.expense_date)) {
      showToast("التاريخ يجب أن يكون من 1 إلى 30 أكتوبر فقط.");
      return;
    }
    if (type === "reconciliation") {
      const expected = expectedBalanceFor(payload.expense_date, id);
      const actual = round2(num(els.editReportedBalance.value));
      const amount = round2(expected - actual);
      if (amount <= 0) return;
      payload.amount = amount;
      payload.reported_balance = actual;
      payload.entry_type = "reconciliation";
    } else {
      payload.amount = round2(num(els.editAmount.value));
      payload.reported_balance = null;
      payload.entry_type = "direct";
    }
    const submit = els.editForm.querySelector('button[type="submit"]');
    setBusy(submit, true);
    const { error } = await db.from("expenses").update(payload).eq("id", id);
    setBusy(submit, false);
    if (error) {
      console.error(error);
      showToast(readableDbError(error));
      return;
    }
    currentLedgerDate = payload.expense_date;
    closeDialog(els.editDialog);
    showToast("تم حفظ التعديل");
    await loadAll({ quiet: true });
  }

  async function handleBudgets(e) {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    const total = round2(num(els.totalBudgetInput.value));
    const prepared = prepareBudgetPayload();
    if (prepared.error) {
      showToast(prepared.error);
      return;
    }
    const categorySum = round2(
      prepared.payload.reduce((sum, item) => sum + num(item.budget), 0),
    );
    if (Math.abs(categorySum - total) > 0.005) {
      showToast(
        "مجموع ميزانيات التصنيفات يجب أن يساوي ميزانية الرحلة بالكامل.",
      );
      return;
    }
    const submit = els.budgetForm.querySelector('button[type="submit"]');
    setBusy(submit, true);
    const { error } = await db.rpc("save_budgets", {
      p_total: total,
      p_categories: prepared.payload,
    });
    setBusy(submit, false);
    if (error) {
      console.error(error);
      showToast(readableDbError(error));
      return;
    }
    closeDialog(els.budgetDialog);
    showToast("تم حفظ الميزانيات");
    await loadAll({ quiet: true });
  }

  async function handleDelete(e) {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    const id = els.deleteId.value;
    const submit = els.deleteForm.querySelector('button[type="submit"]');
    setBusy(submit, true, "حذف…");
    const { error } = await db.from("expenses").delete().eq("id", id);
    setBusy(submit, false);
    if (error) {
      console.error(error);
      showToast(readableDbError(error));
      return;
    }
    closeDialog(els.deleteDialog);
    showToast("تم حذف العملية");
    await loadAll({ quiet: true });
  }

  function readableDbError(error) {
    const msg = String(error?.message || "");
    if (msg.includes("Expense date must be between"))
      return "التاريخ يجب أن يكون من 1 إلى 30 أكتوبر فقط.";
    if (msg.includes("Category is closed") || msg.includes("closed category"))
      return "التصنيف مكتمل. افتحه أولًا.";
    if (msg.includes("Closed category must have zero balance"))
      return "لا يمكن إكمال الصرف بوجود فائض أو عجز. رحّل الفرق أولًا.";
    if (
      msg.includes("Category budgets must equal trip total") ||
      msg.includes("Budget payload must allocate the full trip budget")
    )
      return "مجموع ميزانيات التصنيفات يجب أن يساوي ميزانية الرحلة بالكامل.";
    if (msg.includes("Not allowed") || error?.code === "42501")
      return "التعديل للأدمن فقط.";
    return "تعذر تنفيذ العملية. راجع البيانات.";
  }

  function bindMoneyInput(input, afterInput = null) {
    if (!input) return;
    input.addEventListener("input", () => {
      formatMoneyField(input, false);
      if (afterInput) afterInput();
    });
    input.addEventListener("blur", () => {
      if (input.value !== "") formatMoneyField(input, true);
      if (afterInput) afterInput();
    });
  }

  function setCollapsed(button, body, collapsed) {
    if (!button || !body) return;
    button.setAttribute("aria-expanded", String(!collapsed));
    body.classList.toggle("collapsed", collapsed);
    button.classList.toggle("collapsed", collapsed);
  }
  function toggleSection(button, body) {
    setCollapsed(button, body, button.getAttribute("aria-expanded") === "true");
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutBtn.addEventListener("click", async () => {
      await db.auth.signOut();
      showLogin();
    });

    els.addEntryBtn.addEventListener("click", () => {
      els.entryForm.reset();
      renderSelects();
      setEntryMode("direct");
      els.entryDate.value = defaultEntryDate();
      setDialogDateInputs();
      updateEntryPreview();
      openDialog(els.entryDialog);
      setTimeout(() => els.entryAmount.focus(), 50);
    });
    els.modeDirectBtn.addEventListener("click", () => {
      if (els.entryMode.value !== "direct")
        setEntryMode("direct", { clearValues: true });
      setTimeout(() => els.entryAmount.focus(), 20);
    });
    els.modeBalanceBtn.addEventListener("click", () => {
      if (els.entryMode.value !== "reconciliation")
        setEntryMode("reconciliation", { clearValues: true });
      setTimeout(() => els.entryBalance.focus(), 20);
    });
    els.entryCategory.addEventListener("change", updateEntryPreview);
    els.entryDate.addEventListener("change", () => {
      els.entryDate.value = clampTripDate(els.entryDate.value);
      updateEntryPreview();
    });
    bindMoneyInput(els.entryAmount, updateEntryPreview);
    bindMoneyInput(els.entryBalance, updateEntryPreview);
    els.entryForm.addEventListener("submit", handleEntry);

    els.budgetBtn.addEventListener("click", openBudgets);
    els.distributionTab.addEventListener("click", () =>
      selectAnalyticsTab("distribution"),
    );
    els.trendTab.addEventListener("click", () => selectAnalyticsTab("trend"));
    [els.distributionTab, els.trendTab].forEach((tab) =>
      tab.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const distribution =
          e.key === "Home" || (e.key !== "End" && tab === els.trendTab);
        selectAnalyticsTab(distribution ? "distribution" : "trend");
        (distribution ? els.distributionTab : els.trendTab).focus();
      }),
    );
    els.chartCategoryFilter.addEventListener("change", renderAnalytics);
    els.categoryFilter.addEventListener("change", renderExpenses);
    els.categoryCardSelect.addEventListener("change", () => {
      currentCategoryId = Number(els.categoryCardSelect.value);
      renderDashboard();
    });
    els.categoryPrev.addEventListener("click", () => moveCategory(-1));
    els.categoryNext.addEventListener("click", () => moveCategory(1));
    els.ledgerPrevDay.addEventListener("click", () => moveLedgerDay(-1));
    els.ledgerNextDay.addEventListener("click", () => moveLedgerDay(1));
    els.ledgerAllDays.addEventListener("click", () => {
      currentLedgerMode = currentLedgerMode === "all" ? "day" : "all";
      if (currentLedgerMode === "day") ensureLedgerDate();
      renderExpenses();
    });
    els.analyticsToggle.addEventListener("click", () =>
      toggleSection(els.analyticsToggle, els.analyticsBody),
    );
    els.categoriesToggle.addEventListener("click", () =>
      toggleSection(els.categoriesToggle, els.categoriesBody),
    );
    els.ledgerToggle.addEventListener("click", () =>
      toggleSection(els.ledgerToggle, els.ledgerBody),
    );

    let categorySwipeStart = null;
    els.categoryGrid.addEventListener("pointerdown", (e) => {
      categorySwipeStart = e.clientX;
    });
    els.categoryGrid.addEventListener("pointerup", (e) => {
      if (categorySwipeStart === null) return;
      const distance = e.clientX - categorySwipeStart;
      categorySwipeStart = null;
      if (Math.abs(distance) < 45) return;
      moveCategory(distance > 0 ? 1 : -1);
    });
    els.categoryGrid.addEventListener("pointercancel", () => {
      categorySwipeStart = null;
    });

    els.summaryArea.addEventListener("click", (e) => {
      const button = e.target.closest("[data-budget-collapse]");
      if (!button) return;
      const card = button.closest(".budget-card");
      const body = card?.querySelector(".budget-card-content");
      toggleSection(button, body);
      summaryCollapsed = button.getAttribute("aria-expanded") !== "true";
    });

    bindMoneyInput(els.editAmount, updateEditDirectGuard);
    bindMoneyInput(els.editReportedBalance, updateEditReconcilePreview);
    els.editCategory.addEventListener("change", () => {
      if (els.editType.value === "reconciliation") updateEditReconcilePreview();
      else updateEditDirectGuard();
    });
    els.editDate.addEventListener("change", () => {
      els.editDate.value = clampTripDate(els.editDate.value);
      if (els.editType.value === "reconciliation") updateEditReconcilePreview();
      else updateEditDirectGuard();
    });
    els.editForm.addEventListener("submit", handleEdit);

    bindMoneyInput(els.totalBudgetInput, updateBudgetDifference);
    els.categoryBudgetFields.addEventListener("input", (e) => {
      if (e.target.matches(".money-number")) formatMoneyField(e.target, false);
      updateBudgetDifference();
    });
    els.categoryBudgetFields.addEventListener("focusout", (e) => {
      if (e.target.matches(".money-number") && e.target.value !== "")
        formatMoneyField(e.target, true);
      updateBudgetDifference();
    });
    els.categoryBudgetFields.addEventListener("change", (e) => {
      if (e.target.matches("[data-closed-id], [data-transfer-target-id]"))
        updateTransferControls();
    });
    els.budgetForm.addEventListener("submit", handleBudgets);
    els.deleteForm.addEventListener("submit", handleDelete);

    els.expenseList.addEventListener("click", (e) => {
      const edit = e.target.closest(".edit-expense");
      if (edit) {
        openEdit(edit.dataset.id);
        return;
      }
      const del = e.target.closest(".delete-expense");
      if (del && profile?.role === "admin") {
        els.deleteId.value = del.dataset.id;
        openDialog(els.deleteDialog);
      }
    });

    document.addEventListener("click", (e) => {
      const close = e.target.closest("[data-close]");
      if (close) closeDialog($(close.dataset.close));
    });

    if (els.testTimeBar) {
      els.testDate.addEventListener("change", () => {
        if (!trip) return;
        const clamped = clampTripDate(els.testDate.value);
        els.testDate.value = clamped;
        testDateOverride = clamped;
        currentLedgerDate = clamped;
        currentLedgerMode = "day";
        updateTestDateButtons();
        renderAll();
      });
      els.testPrevDay.addEventListener("click", () => moveTestDate(-1));
      els.testNextDay.addEventListener("click", () => moveTestDate(1));
      els.testRealDate.addEventListener("click", useRealDate);
    }
  }

  async function init() {
    initEls();
    bindEvents();
    if (!isConfigured()) {
      els.configHint.classList.remove("hidden");
      return;
    }
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const { data } = await db.auth.getSession();
    if (data.session) await showApp(data.session);
    else showLogin();
    db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) showLogin();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
