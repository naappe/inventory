(function () {
  const previousOpenPage = openPage;

  function footerFor(page) {
    const footer = document.querySelector(".summaryFooter");
    if (!footer) return;
    footer.classList.toggle("hidden", !["dashboard", "payments"].includes(page));
  }

  openPage = function (page) {
    previousOpenPage(page);
    const safe = ["dashboard", "payments", "categories", "payees", "history"].includes(page) ? page : "dashboard";
    footerFor(safe);
  };

  document.addEventListener("click", function (event) {
    const edit = event.target.closest && event.target.closest("#bills .edit");
    if (!edit) return;
    setTimeout(function () {
      try {
        if (editingBillIndex === null || !s.bills[editingBillIndex]) return;
        const bill = s.bills[editingBillIndex];
        const amount = document.getElementById("editAmount");
        const category = document.getElementById("editCategory");
        const form = document.getElementById("editForm");
        if (!amount || !category || !form) return;

        const old = form.querySelector(".paidEditNotice");
        if (old) old.remove();

        const locked = !isCreditCategory(bill[2]) && Number(paidValue(bill) || 0) > 0;
        amount.disabled = locked;
        category.disabled = locked;

        if (locked) {
          const note = document.createElement("p");
          note.className = "paidEditNotice";
          note.textContent = "This payment is already recorded. Undo it before changing the amount or category.";
          form.insertBefore(note, form.querySelector(".modalActions"));
        }
      } catch (error) {}
    }, 0);
  });

  const saved = localStorage.getItem("moneyPlanModernPage") || localStorage.getItem("moneyPlanActivePage") || "dashboard";
  footerFor(saved);
})();