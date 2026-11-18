"use strict";

const byId = (id) => document.getElementById(id);
const groups = byId("groups");
const form = byId("planner");
const formatter = new Intl.NumberFormat("en");
const sat = (value) => `${formatter.format(value)} sat`;
const fields = [
  ["amount", "Denomination in sat"],
  ["count", "Proof count"],
  ["feeRate", "Fee in parts per thousand"],
];

function updateLabels() {
  for (const [index, row] of Array.from(groups.rows).entries()) {
    for (const [field, label] of fields) {
      row.querySelector(`[data-field="${field}"]`).setAttribute("aria-label", `${label}, group ${index + 1}`);
    }
    const remove = row.querySelector("button");
    remove.setAttribute("aria-label", `Remove proof group ${index + 1}`);
    remove.disabled = groups.rows.length === 1;
  }
  byId("add").disabled = groups.rows.length === MintMargin.limits.proofs;
}

function addGroup({ amount, count, feeRate }, focus = false) {
  const row = byId("proof-row").content.firstElementChild.cloneNode(true);
  for (const [field, value] of Object.entries({ amount, count, feeRate })) {
    row.querySelector(`[data-field="${field}"]`).value = value;
  }
  row.querySelector("button").addEventListener("click", () => {
    const nextRow = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    updateLabels();
    (nextRow?.querySelector("input") ?? byId("add")).focus();
    update();
  });
  groups.append(row);
  updateLabels();
  if (focus) row.querySelector("input").focus();
}

function inputGroups() {
  return Array.from(groups.rows, (row) => Object.fromEntries(
    fields.map(([field]) => [field, row.querySelector(`[data-field="${field}"]`).valueAsNumber]),
  ));
}

function showPlan(plan, values) {
  const verdict = byId("verdict");
  verdict.classList.toggle("short", !plan.fits);
  verdict.textContent = plan.fits ? "Quote covered" : `${sat(plan.shortfall)} short`;
  byId("receipt-details").hidden = false;

  const totals = {
    "receipt-invoice": plan.invoice,
    "receipt-fee": plan.fee,
    "receipt-reserve": plan.reserve,
    selected: plan.selected,
    required: plan.required,
    maximum: plan.maximumInvoice,
  };
  for (const [id, amount] of Object.entries(totals)) byId(id).textContent = sat(amount);

  const scale = Math.max(plan.selected, plan.required);
  byId("available-bar").style.width = `${100 * plan.selected / scale}%`;
  byId("required-bar").style.width = `${100 * plan.required / scale}%`;

  const chosen = plan.selectedCounts.flatMap((count, index) => count > 0
    ? [`${count} × ${sat(values[index].amount)} from group ${index + 1}`] : []);
  const choice = chosen.length ? `Selected ${chosen.join(", ")}.` : "The available proofs add no value after their mint fees.";
  const unused = plan.balance - plan.selected;
  byId("selection").textContent = unused > 0 ? `${choice} ${sat(unused)} left unselected.` : choice;
}

function update() {
  const values = inputGroups();
  const error = byId("input-error");
  try {
    showPlan(MintMargin.plan(values, byId("invoice").valueAsNumber, byId("reserve").valueAsNumber), values);
    error.hidden = true;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    byId("verdict").classList.remove("short");
    byId("verdict").textContent = "Check your inputs";
    byId("receipt-details").hidden = true;
  }
}

function loadExample() {
  groups.replaceChildren();
  for (const amount of [64, 32, 4]) addGroup({ amount, count: 1, feeRate: 100 });
  byId("invoice").value = 99;
  byId("reserve").value = 1;
  update();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", update);
byId("sample").addEventListener("click", loadExample);
byId("add").addEventListener("click", () => {
  addGroup({ amount: 1, count: 1, feeRate: 0 }, true);
  update();
});
byId("help-link").addEventListener("click", () => { byId("about").open = true; });
loadExample();
