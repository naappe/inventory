(function () {
  const FILTER_KEY = "moneyPlanPaymentFilterV2";
  const GROUP_KEY = "moneyPlanOpenBillGroupV2";
  const $ = (id) => document.getElementById(id);
  const money = (n) => "MVR " + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  function waitingCount() {
    try { return (s.bills || []).filter(isWaitingBill).length; }
    catch { return 0; }
  }
  function paidTotalCompact() {
    try { return (s.bills || []).reduce((sum, bill) => sum + Number(paidValue(bill) || 0), 0); }
    catch { return 0; }
  }
  function dueTotalCompact() {
    try {
      return (s.bills || []).reduce((sum, bill) => {
        return sum + Math.max(0, Number(bill[1] || 0) - Number(paidValue(bill) || 0));
      }, 0);
    } catch { return 0; }
  }

  function ensurePaymentsIntro() {
    const view = $("paymentsView");
    const paymentTop = view?.querySelector(".paymentTop");
    if (!view || !paymentTop || $("paymentsIntro")) return;
    const intro = document.createElement("div");
    intro.id = "paymentsIntro";
    intro.className = "paymentsIntro";
    intro.innerHTML =
      '<div><span class="eyebrow">MONTHLY MONEY</span><h2>Payments</h2>' +
      '<p>Use one sequence: confirm money, pay what is due, then review the record.</p></div>' +
      '<div class="flowSteps" aria-label="Payment sequence">' +
        '<span class="flowStep"><b>1</b> Balance</span><span class="flowArrow">→</span>' +
        '<span class="flowStep"><b>2</b> Pay</span><span class="flowArrow">→</span>' +
        '<span class="flowStep"><b>3</b> History</span>' +
      '</div>';
    view.insertBefore(intro, paymentTop);
  }

  function hideDuplicatePaymentSections() {
    const view = $("paymentsView");
    if (!view) return;
    view.querySelector(".insightGrid")?.classList.add("compactLegacyHidden");
    const history = $("monthlyHistory");
    history?.closest(".card")?.classList.add("compactLegacyHidden");
  }

  function ensureBillSummary() {
    const card = document.querySelector("#paymentsView .billsCard");
    const head = card?.querySelector(".sectionHead");
    if (!card || !head) return;
    let summary = $("compactBillSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "compactBillSummary";
      summary.className = "compactBillSummary";
      summary.innerHTML =
        '<div class="compactBillStat due"><span>Still to pay</span><strong id="compactDue"></strong></div>' +
        '<div class="compactBillStat"><span>Waiting bills</span><strong id="compactWaiting"></strong></div>' +
        '<div class="compactBillStat paid"><span>Paid this month</span><strong id="compactPaid"></strong></div>';
      head.insertAdjacentElement("afterend", summary);
    }
    $("compactDue").textContent = money(dueTotalCompact());
    $("compactWaiting").textContent = waitingCount() + (waitingCount() === 1 ? " bill" : " bills");
    $("compactPaid").textContent = money(paidTotalCompact());
  }

  function ensurePaymentFilter() {
    const buttons = document.querySelectorAll("#paymentsView [data-bill-filter]");
    buttons.forEach((button) => {
      if (button.dataset.billFilter === "waiting") button.textContent = "To pay";
      if (button.dataset.compactWire) return;
      button.dataset.compactWire = "1";
      button.addEventListener("click", () => {
        localStorage.setItem(FILTER_KEY, button.dataset.billFilter || "waiting");
        localStorage.removeItem(GROUP_KEY + ":" + activeMonth + ":" + (button.dataset.billFilter || "waiting"));
        setTimeout(enhancePayments, 0);
      });
    });
  }

  function groupStorageKey() {
    let filter = "waiting";
    try { filter = activeBillFilter || "waiting"; } catch {}
    return GROUP_KEY + ":" + activeMonth + ":" + filter;
  }

  function titleForGroup(group) {
    return group.querySelector(".billGroupHead span")?.textContent?.trim() || "Bills";
  }

  function setOpenGroup(groupToOpen) {
    const groups = [...document.querySelectorAll("#paymentsView #bills .billGroup")];
    groups.forEach((group) => {
      const open = group === groupToOpen;
      group.classList.toggle("compactCollapsed", !open);
      const toggle = group.querySelector(".groupToggle");
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.title = open ? "Collapse" : "Expand";
      }
    });
    if (groupToOpen) localStorage.setItem(groupStorageKey(), titleForGroup(groupToOpen));
  }

  function enhanceGroups() {
    const groups = [...document.querySelectorAll("#paymentsView #bills .billGroup")];
    if (!groups.length) return;
    const saved = localStorage.getItem(groupStorageKey());
    let openGroup = groups.find((g) => titleForGroup(g) === saved) || groups[0];

    groups.forEach((group) => {
      const head = group.querySelector(".billGroupHead");
      if (!head) return;
      let toggle = head.querySelector(".groupToggle");
      if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "groupToggle";
        toggle.textContent = "⌄";
        toggle.setAttribute("aria-label", "Expand or collapse category");
        head.append(toggle);
      }
      if (!head.dataset.compactWire) {
        head.dataset.compactWire = "1";
        head.addEventListener("click", (event) => {
          event.preventDefault();
          const isClosed = group.classList.contains("compactCollapsed");
          if (isClosed) setOpenGroup(group);
          else {
            group.classList.add("compactCollapsed");
            const t = group.querySelector(".groupToggle");
            if (t) t.setAttribute("aria-expanded", "false");
            localStorage.removeItem(groupStorageKey());
          }
        });
      }
    });
    setOpenGroup(openGroup);
  }

  function ensureFootNote() {
    const card = document.querySelector("#paymentsView .billsCard");
    if (!card || $("paymentsFootNote")) return;
    const note = document.createElement("div");
    note.id = "paymentsFootNote";
    note.className = "paymentsFootNote";
    note.textContent = "Open one category at a time. Use History for completed payments and bank corrections.";
    card.append(note);
  }

  function enhancePayments() {
    ensurePaymentsIntro();
    hideDuplicatePaymentSections();
    ensureBillSummary();
    ensurePaymentFilter();
    enhanceGroups();
    ensureFootNote();
  }

  const previousRender = render;
  render = function () {
    previousRender();
    enhancePayments();
  };

  const previousOpenPage = openPage;
  openPage = function (page) {
    previousOpenPage(page);
    if (page === "payments") setTimeout(enhancePayments, 0);
  };

  try {
    const savedFilter = localStorage.getItem(FILTER_KEY) || "waiting";
    activeBillFilter = ["all", "waiting", "paid"].includes(savedFilter) ? savedFilter : "waiting";
  } catch {}

  render();
  enhancePayments();
})();
