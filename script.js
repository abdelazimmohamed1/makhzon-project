"use strict";
const $ = (s, r = document) => r.querySelector(s);
const view = $("#view"),
  sidebar = $("#sidebar"),
  overlay = $("#overlay"),
  menuBtn = $("#menuBtn"),
  themeToggle = $("#themeToggle"),
  modalEl = $("#appModal");
const KEY = "makhzon-db";
let db,
  cart = [],
  cartCust = "",
  current = "dashboard",
  chart,
  qs = "",
  pcat = "",
  psort = "name";

/* ---------- helpers ---------- */
const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ج.م";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dayISO = (ago = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - ago);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const fmtDate = (d) =>
  new Date(d + "T00:00").toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const find = (list, id) => list.find((x) => x.id === id);
const sum = (list, fn) => list.reduce((s, x) => s + fn(x), 0);
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const done = () => db.invoices.filter((i) => i.status === "done");
const custName = (id) => (find(db.customers, id) || { name: "عميل نقدي" }).name;
const invCust = (i) => find(db.customers, i.cid)?.name || i.cname || "عميل نقدي";
const clean = (v) => (Array.isArray(v) ? v : []);
const avail = (p) => p.qty - (cart.find((c) => c.pid === p.id)?.qty || 0);
const commit = (msg) => {
  save();
  show(current);
  toast(msg);
};

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) => {
  let t = String(v ?? "");
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
};
const toCsv = (rows) => "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "سهران لسه؟" : h < 12 ? "صباح الفل" : h < 17 ? "يومك سعيد" : "مساء الخير";
};

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ""), 2600);
}

/* ---------- data ---------- */
function sell(cid, lines, date = dayISO()) {
  const items = lines.map((l) => {
    const p = find(db.products, l.pid);
    p.qty -= l.qty;
    db.moves.unshift({
      id: uid(),
      date,
      pid: p.id,
      type: "out",
      qty: l.qty,
      note: "بيع",
    });
    return {
      pid: p.id,
      name: p.name,
      qty: l.qty,
      price: p.price,
      cost: p.cost,
    };
  });
  const inv = {
    id: uid(),
    no: ++db.seq,
    cid,
    cname: custName(cid),
    date,
    items,
    status: "done",
    total: sum(items, (i) => i.qty * i.price),
  };
  db.invoices.unshift(inv);
  return inv;
}

function seedDb() {
  const P = (name, cat, price, cost, qty, min) => ({
    id: uid(),
    name,
    cat,
    price,
    cost,
    qty,
    min,
  });
  db = {
    seq: 1000,
    invoices: [],
    moves: [],
    products: [
      P("تلفزيون Samsung 55 بوصة", "شاشات", 18500, 15500, 6, 3),
      P("ثلاجة LG 18 قدم", "ثلاجات", 22000, 18500, 5, 4),
      P("تكييف Sharp 1.5 حصان", "تكييفات", 19500, 16500, 5, 3),
      P("غسالة Zanussi 8 كجم", "غسالات", 12000, 9800, 10, 3),
      P("بوتاجاز Unionaire", "بوتاجازات", 8500, 6900, 12, 4),
      P("مروحة Toshiba", "مراوح", 1800, 1300, 25, 8),
    ],
    customers: [
      { id: uid(), name: "أحمد محمد", phone: "01012345678" },
      { id: uid(), name: "محمود علي", phone: "01123456789" },
      { id: uid(), name: "سارة حسن", phone: "01234567890" },
    ],
  };
  const [tv, fr, ac, wm, ov, fan] = db.products.map((p) => p.id);
  const [c1, c2, c3] = db.customers.map((c) => c.id);
  [
    [6, c1, [[tv, 1]]],
    [
      5,
      "",
      [
        [fan, 3],
        [ov, 1],
      ],
    ],
    [4, c2, [[ac, 2]]],
    [3, c3, [[wm, 1]]],
    [
      2,
      c1,
      [
        [fr, 1],
        [fan, 2],
      ],
    ],
    [1, c2, [[tv, 2]]],
    [
      0,
      c3,
      [
        [ac, 1],
        [ov, 2],
      ],
    ],
  ].forEach(([ago, c, l]) =>
    sell(
      c,
      l.map(([pid, qty]) => ({ pid, qty })),
      dayISO(ago),
    ),
  );
}
function loadDb() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(KEY));
  } catch {
    d = null;
  }
  if (!d || typeof d !== "object" || !Array.isArray(d.products)) return null;
  d.invoices = clean(d.invoices);
  d.moves = clean(d.moves);
  d.customers = clean(d.customers);
  d.seq = Number(d.seq) || 1000;
  return d;
}
db = loadDb();
if (!db) {
  seedDb();
  save();
}

/* ---------- ui building blocks ---------- */
const panel = (title, sub, actions, body) =>
  `<div class="panel-card mb-3"><div class="panel-header"><div><h3>${title}</h3><p>${sub}</p></div><div class="d-flex gap-2 align-items-center">${actions}</div></div>${body}</div>`;
const table = (heads, rows) =>
  `<div class="table-responsive"><table class="table custom-table align-middle mb-0"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="text-center text-secondary py-4">لا توجد بيانات بعد</td></tr>`}</tbody></table></div>`;
const searchBox = `<input id="q" class="form-control form-control-sm search" placeholder="بحث..." aria-label="بحث">`;
const addBtn = (act, label, kind = "") =>
  `<button class="btn btn-primary btn-sm" data-act="${act}" data-kind="${kind}"><i class="bi bi-plus-lg"></i> ${label}</button>`;
const rowBtns = (kind, id) =>
  `<button class="icon-btn sm" data-act="edit" data-kind="${kind}" data-id="${id}" aria-label="تعديل"><i class="bi bi-pencil"></i></button> <button class="icon-btn sm" data-act="del" data-kind="${kind}" data-id="${id}" aria-label="حذف"><i class="bi bi-trash"></i></button>`;
const stat = (label, icon, color, value, note) =>
  `<div class="col-12 col-sm-6 col-xl-3"><div class="stat-card"><div class="stat-top">${label}<span class="stat-icon ${color}"><i class="bi bi-${icon}"></i></span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div></div>`;
const stockPill = (p) =>
  `<span class="stock-count ${p.qty <= 0 ? "danger" : p.qty <= p.min ? "warning" : "ok"}">${p.qty <= 0 ? "نفد" : p.qty + " قطعة"}</span>`;
const stockBar = (p) => {
  const top = Math.max(p.min * 3, p.qty, 1);
  const w = Math.min(100, Math.round((Math.max(p.qty, 0) / top) * 100));
  return `<div class="stock-bar" aria-hidden="true"><span class="${p.qty <= 0 ? "danger" : p.qty <= p.min ? "warning" : "ok"}" style="width:${w}%"></span></div>`;
};
const pill = (i) =>
  `<span class="status-pill ${i.status === "done" ? "success" : "danger"}">${i.status === "done" ? "مكتملة" : "ملغاة"}</span>`;
const fields = (list, v = {}) =>
  list
    .map(
      ([n, t, ty = "text", a = "required"]) =>
        `<div class="mb-3"><label class="form-label">${t}</label><input class="form-control" name="${n}" type="${ty}" value="${esc(v[n] ?? "")}" ${a}></div>`,
    )
    .join("");
const readForm = (f) => {
  const o = {};
  for (const el of f.elements)
    if (el.name)
      o[el.name] = el.type === "number" ? +el.value : el.value.trim();
  return o;
};
function openModal(title, body, onSave, label = "حفظ") {
  $(".modal-title", modalEl).textContent = title;
  $(".modal-body", modalEl).innerHTML = `<form>${body}</form>`;
  const b = $("#modalSave");
  b.textContent = label;
  b.classList.toggle("d-none", !onSave);
  b.onclick = () => {
    if (onSave && onSave() === false) return;
    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  };
  $("form", modalEl).addEventListener("submit", (e) => {
    e.preventDefault();
    b.click();
  });
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/* ---------- pages ---------- */
const invTable = (list, acts) =>
  table(
    ["رقم الفاتورة", "العميل", "التاريخ", "الإجمالي", "الحالة"].concat(
      acts ? [""] : [],
    ),
    list.map(
      (i) =>
        `<tr><td>#${i.no}</td><td>${esc(invCust(i))}</td><td>${fmtDate(i.date)}</td><td>${money(i.total)}</td><td>${pill(i)}</td>${acts ? `<td class="text-end"><button class="icon-btn sm" data-act="view" data-id="${i.id}" aria-label="عرض"><i class="bi bi-eye"></i></button> ${i.status === "done" ? `<button class="icon-btn sm" data-act="cancel" data-id="${i.id}" aria-label="إلغاء"><i class="bi bi-x-circle"></i></button>` : ""}</td>` : ""}</tr>`,
    ),
  );

const PF = [
  ["name", "اسم المنتج"],
  ["cat", "التصنيف"],
  ["price", "سعر البيع", "number", 'required min="0" step="any"'],
  ["cost", "سعر التكلفة", "number", 'required min="0" step="any"'],
  ["qty", "الكمية", "number", 'required min="0" step="1"'],
  ["min", "حد التنبيه", "number", 'required min="0" step="1"'],
];
const PFE = PF.filter((f) => f[0] !== "qty");
const CF = [
  ["name", "اسم العميل"],
  ["phone", "رقم الهاتف", "tel"],
];
const defs = {
  products: { f: PF, n: "المنتج", d: { qty: 0, min: 3 } },
  customers: { f: CF, n: "العميل", d: {} },
};

const pages = {
  dashboard: {
    title: "لوحة التحكم",
    sub: "أهلاً بيك، دي نظرة عامة على المعرض.",
    render() {
      const low = db.products
        .filter((p) => p.qty <= p.min)
        .sort((a, b) => a.qty - b.qty);
      return `<div class="welcome-banner"><div><span class="welcome-tag">ملخص المعرض</span><h2>${greeting()} يا معلم 👋</h2><p>${low.length ? `فيه ${low.length} صنف محتاج تشتريه قريب.` : "كل حاجة تحت السيطرة، ولا يهمك."}</p></div><div class="welcome-icon"><i class="bi bi-shop"></i></div></div>
      <div class="row g-3 mb-3">${stat("إجمالي المنتجات", "box-seam", "blue", db.products.length, "منتج مسجل")}
      ${stat(
        "مبيعات اليوم",
        "currency-exchange",
        "green",
        money(
          sum(
            done().filter((i) => i.date === dayISO()),
            (i) => i.total,
          ),
        ),
        "الفواتير المكتملة اليوم",
      )}
      ${stat("قيمة المخزون", "wallet2", "purple", money(sum(db.products, (p) => p.qty * p.cost)), "بسعر التكلفة")}
      ${stat("منتجات منخفضة", "exclamation-triangle", "orange", low.length, "تحتاج مراجعة المخزون")}</div>
      <div class="row g-3 mb-3"><div class="col-12 col-xl-8"><div class="panel-card h-100"><div class="panel-header"><div><h3>نظرة على المبيعات</h3><p>الفواتير المكتملة</p></div><span class="panel-badge">آخر 7 أيام</span></div><div class="chart-placeholder"><canvas id="salesChart"></canvas></div></div></div>
      <div class="col-12 col-xl-4"><div class="panel-card h-100"><div class="panel-header"><div><h3>مخزون منخفض</h3><p>أجهزة قاربت على النفاد</p></div></div><div class="stock-list">${
        low
          .slice(0, 5)
          .map(
            (p) =>
              `<div class="stock-item"><div class="product-symbol"><i class="bi bi-box-seam"></i></div><div class="stock-info"><strong>${esc(p.name)}</strong><small>${esc(p.cat)}</small></div>${stockPill(p)}<button class="icon-btn sm" data-act="restock" data-id="${p.id}" aria-label="إضافة كمية" title="إضافة كمية"><i class="bi bi-plus-lg"></i></button></div>`,
          )
          .join("") || `<p class="text-secondary">كل المنتجات كميتها كافية.</p>`
      }</div><button class="outline-btn w-100 mt-3" data-page="inventory">عرض حركة المخزون</button></div></div></div>
      ${panel("آخر العمليات", "أحدث 5 فواتير", `<button class="outline-btn" data-page="invoices">كل الفواتير</button>`, invTable(db.invoices.slice(0, 5)))}`;
    },
  },
  products: {
    title: "المنتجات",
    sub: "إدارة أجهزة المعرض وأسعارها وكمياتها.",
    render() {
      const cats = [...new Set(db.products.map((p) => p.cat).filter(Boolean))];
      if (pcat && !cats.includes(pcat)) pcat = "";
      const list = db.products
        .filter((p) => !pcat || p.cat === pcat)
        .sort((a, b) =>
          psort === "qty"
            ? a.qty - b.qty
            : psort === "price"
              ? b.price - a.price
              : a.name.localeCompare(b.name, "ar"),
        );
      const chips =
        `<div class="chips"><button class="chip ${pcat ? "" : "on"}" data-act="pcat" data-id="">الكل</button>` +
        cats
          .map((c) => `<button class="chip ${pcat === c ? "on" : ""}" data-act="pcat" data-id="${esc(c)}">${esc(c)}</button>`)
          .join("") +
        `</div>`;
      const sortSel = `<select id="ps" class="form-select form-select-sm sort-select" aria-label="ترتيب"><option value="name" ${psort === "name" ? "selected" : ""}>ترتيب بالاسم</option><option value="qty" ${psort === "qty" ? "selected" : ""}>الأقل كمية أولاً</option><option value="price" ${psort === "price" ? "selected" : ""}>الأغلى أولاً</option></select>`;
      return panel(
        "قائمة المنتجات",
        `${list.length} منتج`,
        searchBox + sortSel + `<button class="outline-btn" data-act="csv" data-id="products"><i class="bi bi-download"></i> CSV</button>` + addBtn("add", "منتج جديد", "products"),
        chips +
          table(
            ["المنتج", "التصنيف", "السعر", "التكلفة", "المخزون", ""],
            list.map(
              (p) =>
                `<tr><td>${esc(p.name)}</td><td>${esc(p.cat)}</td><td>${money(p.price)}</td><td>${money(p.cost)}</td><td>${stockPill(p)}${stockBar(p)}</td><td class="text-end">${rowBtns("products", p.id)}</td></tr>`,
            ),
          ),
      );
    },
  },
  inventory: {
    title: "حركة المخزون",
    sub: "متابعة الوارد والمنصرف من الأجهزة.",
    render: () =>
      panel(
        "سجل الحركات",
        "آخر 100 حركة",
        searchBox + addBtn("move", "تسجيل حركة"),
        table(
          ["التاريخ", "المنتج", "النوع", "الكمية", "ملاحظة"],
          db.moves
            .slice(0, 100)
            .map(
              (m) =>
                `<tr><td>${fmtDate(m.date)}</td><td>${esc((find(db.products, m.pid) || { name: "منتج محذوف" }).name)}</td><td><span class="status-pill ${m.type === "in" ? "success" : "pending"}">${m.type === "in" ? "وارد" : "منصرف"}</span></td><td>${m.qty}</td><td>${esc(m.note)}</td></tr>`,
            ),
        ),
      ),
  },
  sales: {
    title: "المبيعات",
    sub: "تسجيل عمليات البيع وحساب الإجماليات.",
    render() {
      cart = cart.filter((c) => find(db.products, c.pid));
      const opts = db.products
        .filter((p) => avail(p) > 0)
        .map(
          (p) =>
            `<option value="${p.id}">${esc(p.name)} — ${money(p.price)} (متاح ${avail(p)})</option>`,
        )
        .join("");
      const custs =
        `<option value="">عميل نقدي</option>` +
        db.customers
          .map(
            (c) =>
              `<option value="${c.id}" ${c.id === cartCust ? "selected" : ""}>${esc(c.name)}</option>`,
          )
          .join("");
      const total = sum(cart, (c) => c.qty * find(db.products, c.pid).price);
      return `<div class="row g-3"><div class="col-12 col-xl-5"><div class="panel-card"><div class="panel-header"><div><h3>إضافة للفاتورة</h3><p>اختار العميل والمنتج والكمية</p></div></div>
      <label class="form-label" for="sc">العميل</label><select id="sc" class="form-select mb-3">${custs}</select>
      <label class="form-label" for="sp">المنتج</label><select id="sp" class="form-select mb-3">${opts}</select>
      <label class="form-label" for="sq">الكمية</label><input id="sq" type="number" min="1" value="1" class="form-control mb-3">
      <button class="btn btn-primary w-100" data-act="addCart" ${opts ? "" : "disabled"}><i class="bi bi-cart-plus"></i> إضافة للفاتورة</button></div></div>
      <div class="col-12 col-xl-7"><div class="panel-card"><div class="panel-header"><div><h3>الفاتورة الحالية</h3><p>${cart.length} صنف</p></div></div>
      ${table(
        ["المنتج", "الكمية", "السعر", "الإجمالي", ""],
        cart.map((c) => {
          const p = find(db.products, c.pid);
          return `<tr><td>${esc(p.name)}</td><td>${c.qty}</td><td>${money(p.price)}</td><td>${money(c.qty * p.price)}</td><td class="text-end"><button class="icon-btn sm" data-act="rmCart" data-id="${c.pid}" aria-label="حذف"><i class="bi bi-x-lg"></i></button></td></tr>`;
        }),
      )}
      <div class="d-flex justify-content-between align-items-center mt-3"><strong>الإجمالي: ${money(total)}</strong><button class="btn btn-primary" data-act="checkout" ${cart.length ? "" : "disabled"}><i class="bi bi-check2-circle"></i> إتمام البيع</button></div></div></div></div>`;
    },
  },
  invoices: {
    title: "الفواتير",
    sub: "عرض ومراجعة فواتير المعرض.",
    render: () =>
      panel(
        "كل الفواتير",
        `${db.invoices.length} فاتورة`,
        searchBox + `<button class="outline-btn" data-act="csv" data-id="invoices"><i class="bi bi-download"></i> CSV</button>`,
        invTable(db.invoices, true),
      ),
  },
  customers: {
    title: "العملاء",
    sub: "إدارة بيانات العملاء وسجل مشترياتهم.",
    render: () =>
      panel(
        "قائمة العملاء",
        `${db.customers.length} عميل`,
        searchBox + addBtn("add", "عميل جديد", "customers"),
        table(
          ["العميل", "الهاتف", "الفواتير", "إجمالي المشتريات", ""],
          db.customers.map((c) => {
            const inv = done().filter((i) => i.cid === c.id);
            return `<tr><td>${esc(c.name)}</td><td dir="ltr" class="text-end">${esc(c.phone)}</td><td>${inv.length}</td><td>${money(sum(inv, (i) => i.total))}</td><td class="text-end">${rowBtns("customers", c.id)}</td></tr>`;
          }),
        ),
      ),
  },
  reports: {
    title: "التقارير",
    sub: "متابعة المبيعات والمخزون والأرباح.",
    render() {
      const inv = done(),
        revenue = sum(inv, (i) => i.total),
        top = {};
      inv.forEach((i) =>
        i.items.forEach((l) => {
          const t = (top[l.name] ||= { q: 0, r: 0 });
          t.q += l.qty;
          t.r += l.qty * l.price;
        }),
      );
      return `<div class="row g-3 mb-3">${stat("إجمالي المبيعات", "cash-stack", "green", money(revenue), `${inv.length} فاتورة مكتملة`)}
      ${stat("صافي الربح", "graph-up-arrow", "blue", money(sum(inv, (i) => sum(i.items, (l) => l.qty * (l.price - l.cost)))), "المبيعات − التكلفة")}
      ${stat("قيمة المخزون", "wallet2", "purple", money(sum(db.products, (p) => p.qty * p.cost)), "بسعر التكلفة")}
      ${stat("متوسط الفاتورة", "receipt", "orange", money(inv.length ? revenue / inv.length : 0), "من الفواتير المكتملة")}</div>
      ${panel(
        "الأكثر مبيعًا",
        "حسب الكمية المباعة",
        `<button class="outline-btn" data-act="backup"><i class="bi bi-cloud-arrow-down"></i> نسخة احتياطية</button><button class="outline-btn" data-act="restoreBtn"><i class="bi bi-cloud-arrow-up"></i> استرجاع</button><input type="file" id="restoreFile" accept="application/json,.json" hidden><button class="outline-btn" data-act="reset">إعادة ضبط البيانات التجريبية</button>`,
        table(
          ["المنتج", "الكمية المباعة", "الإيراد"],
          Object.entries(top)
            .sort((a, b) => b[1].q - a[1].q)
            .slice(0, 5)
            .map(
              ([n, t]) =>
                `<tr><td>${esc(n)}</td><td>${t.q}</td><td>${money(t.r)}</td></tr>`,
            ),
        ),
      )}`;
    },
  },
};

/* ---------- actions ---------- */
function editEntity(kind, id) {
  const d = defs[kind],
    item = id ? find(db[kind], id) : { ...d.d };
  const isEditProduct = id && kind === "products";
  const hint = isEditProduct
    ? `<p class="form-hint">الكمية الحالية: <b>${item.qty}</b>. لتغيير الكمية استخدم "تسجيل حركة" في صفحة حركة المخزون عشان تتسجل في السجل.</p>`
    : "";
  openModal((id ? "تعديل " : "إضافة ") + d.n, fields(isEditProduct ? PFE : d.f, item) + hint, () => {
    const f = $("form", modalEl);
    if (!f.reportValidity()) return false;
    const data = readForm(f);
    if (id) Object.assign(item, data);
    else {
      const row = { id: uid(), ...data };
      db[kind].push(row);
      if (kind === "products" && row.qty > 0)
        db.moves.unshift({ id: uid(), date: dayISO(), pid: row.id, type: "in", qty: row.qty, note: "رصيد افتتاحي" });
    }
    commit(id ? "تم حفظ التعديلات" : "تمت الإضافة");
  });
}
function viewInvoice(id) {
  const i = find(db.invoices, id);
  openModal(
    `فاتورة #${i.no}`,
    `<p class="text-secondary">${esc(invCust(i))} — ${fmtDate(i.date)} — ${pill(i)}</p>` +
      table(
        ["المنتج", "الكمية", "السعر", "الإجمالي"],
        i.items.map(
          (l) =>
            `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${money(l.price)}</td><td>${money(l.qty * l.price)}</td></tr>`,
        ),
      ) +
      `<div class="fw-bold mt-3">الإجمالي: ${money(i.total)}</div><button type="button" class="outline-btn mt-3 no-print" data-print><i class="bi bi-printer"></i> طباعة</button>`,
  );
}
const actions = {
  add: (_, b) => editEntity(b.dataset.kind),
  edit: (id, b) => editEntity(b.dataset.kind, id),
  del(id, b) {
    const msg =
      b.dataset.kind === "customers"
        ? "متأكد من الحذف؟ الفواتير القديمة هتفضل محتفظة باسمه."
        : "متأكد من الحذف؟ الفواتير والحركات القديمة هتفضل في السجل، بس مش هترجع كمياتها للمخزون لو اتلغت.";
    if (!confirm(msg)) return;
    db[b.dataset.kind] = db[b.dataset.kind].filter((x) => x.id !== id);
    commit("تم الحذف");
  },
  move(pid) {
    const opts = db.products
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === pid ? "selected" : ""}>${esc(p.name)} — المتاح ${p.qty}</option>`,
      )
      .join("");
    if (!opts) return toast("أضف منتجًا أولاً", true);
    openModal(
      "تسجيل حركة مخزون",
      `<div class="mb-3"><label class="form-label">المنتج</label><select class="form-select" name="pid">${opts}</select></div>
       <div class="mb-3"><label class="form-label">نوع الحركة</label><select class="form-select" name="type"><option value="in">وارد (إضافة للمخزون)</option><option value="out">منصرف (خصم من المخزون)</option></select></div>` +
        fields([
          ["qty", "الكمية", "number", 'required min="1"'],
          ["note", "ملاحظة", "text", ""],
        ]),
      () => {
        const f = $("form", modalEl);
        if (!f.reportValidity()) return false;
        const d = readForm(f),
          p = find(db.products, d.pid);
        if (!Number.isInteger(d.qty) || d.qty < 1) {
          toast("الكمية لازم تكون رقم صحيح", true);
          return false;
        }
        if (d.type === "out" && d.qty > p.qty) {
          toast("الكمية أكبر من المتاح في المخزون", true);
          return false;
        }
        const inCart = cart.find((c) => c.pid === p.id)?.qty || 0;
        if (d.type === "out" && p.qty - d.qty < inCart) {
          toast(`في فاتورة مفتوحة فيها ${inCart} من الصنف ده، شيلها الأول`, true);
          return false;
        }
        p.qty += d.type === "in" ? d.qty : -d.qty;
        db.moves.unshift({
          id: uid(),
          date: dayISO(),
          pid: p.id,
          type: d.type,
          qty: d.qty,
          note: d.note,
        });
        commit("تم تسجيل الحركة");
      },
    );
  },
  addCart() {
    const pid = $("#sp")?.value,
      qty = +$("#sq").value,
      p = find(db.products, pid);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > avail(p))
      return toast("تأكد من المنتج والكمية المتاحة", true);
    const line = cart.find((c) => c.pid === pid);
    if (line) line.qty += qty;
    else cart.push({ pid, qty });
    show("sales");
  },
  rmCart(id) {
    cart = cart.filter((c) => c.pid !== id);
    show("sales");
  },
  checkout() {
    if (!cart.length) return toast("الفاتورة فارغة", true);
    const short = cart.find((c) => {
      const p = find(db.products, c.pid);
      return !p || c.qty > p.qty;
    });
    if (short) {
      const p = find(db.products, short.pid);
      cart = cart.filter((c) => c !== short);
      show("sales");
      return toast(`الكمية المتاحة من "${p ? p.name : "صنف محذوف"}" مابقتش كفاية، اتشال من الفاتورة`, true);
    }
    const inv = sell(cartCust, cart);
    cart = [];
    cartCust = "";
    save();
    show("sales");
    toast(`تم إنشاء الفاتورة #${inv.no}`);
    viewInvoice(inv.id);
  },
  view: (id) => viewInvoice(id),
  pcat(id) {
    pcat = id || "";
    show("products");
  },
  restock: (id) => actions.move(id),
  csv(kind) {
    if (kind === "products")
      download(
        "makhzon-products.csv",
        toCsv([["المنتج", "التصنيف", "السعر", "التكلفة", "الكمية", "حد التنبيه"], ...db.products.map((p) => [p.name, p.cat, p.price, p.cost, p.qty, p.min])]),
        "text/csv;charset=utf-8",
      );
    else
      download(
        "makhzon-invoices.csv",
        toCsv([["رقم", "العميل", "التاريخ", "الحالة", "الإجمالي"], ...db.invoices.map((i) => [i.no, invCust(i), i.date, i.status === "done" ? "مكتملة" : "ملغاة", i.total])]),
        "text/csv;charset=utf-8",
      );
    toast("اتحمل الملف");
  },
  backup() {
    download("makhzon-backup-" + dayISO() + ".json", JSON.stringify(db, null, 2), "application/json");
    toast("اتحملت نسخة احتياطية");
  },
  restoreBtn: () => $("#restoreFile")?.click(),
  cancel(id) {
    const i = find(db.invoices, id);
    if (
      i.status !== "done" ||
      !confirm("إلغاء الفاتورة وإرجاع الكميات للمخزون؟")
    )
      return;
    let skipped = 0;
    i.items.forEach((l) => {
      const p = find(db.products, l.pid);
      if (!p) skipped++;
      if (p) {
        p.qty += l.qty;
        db.moves.unshift({
          id: uid(),
          date: dayISO(),
          pid: p.id,
          type: "in",
          qty: l.qty,
          note: `إلغاء فاتورة #${i.no}`,
        });
      }
    });
    i.status = "cancelled";
    commit(skipped ? "اتلغت الفاتورة (فيه صنف محذوف مارجعش للمخزون)" : "تم إلغاء الفاتورة");
  },
  reset() {
    if (confirm("هترجع كل البيانات للوضع التجريبي، متأكد؟")) {
      seedDb();
      cart = [];
      commit("تمت إعادة ضبط البيانات");
    }
  },
};

/* ---------- chart ---------- */
function drawChart() {
  if (chart) chart.destroy();
  chart = null;
  const c = $("#salesChart");
  if (!c || typeof Chart === "undefined") return;
  const dark = document.documentElement.dataset.theme === "dark";
  const txt = dark ? "#94a3b8" : "#6b778c",
    grid = dark ? "#273449" : "#e5eaf2";
  const days = [6, 5, 4, 3, 2, 1, 0].map(dayISO);
  Chart.defaults.font.family = "Cairo, Tahoma, sans-serif";
  chart = new Chart(c, {
    type: "line",
    data: {
      labels: days.map((d) =>
        new Date(d + "T00:00").toLocaleDateString("ar-EG", { weekday: "long" }),
      ),
      datasets: [
        {
          label: "المبيعات",
          data: days.map((d) =>
            sum(
              done().filter((i) => i.date === d),
              (i) => i.total,
            ),
          ),
          borderColor: "#4f83ff",
          backgroundColor: "rgba(79,131,255,.12)",
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { rtl: true, callbacks: { label: (x) => money(x.parsed.y) } },
      },
      scales: {
        x: {
          reverse: true,
          grid: { display: false },
          ticks: { color: txt },
          border: { color: grid },
        },
        y: {
          beginAtZero: true,
          ticks: { color: txt, callback: (v) => v.toLocaleString("en-US") },
          grid: { color: grid },
          border: { display: false },
        },
      },
    },
  });
}

/* ---------- navigation ---------- */
function show(name) {
  const page = pages[name];
  if (!page) return;
  if (name !== current) qs = "";
  current = name;
  $("#pageTitle").textContent = page.title;
  $("#pageSubtitle").textContent = page.sub;
  view.innerHTML = page.render();
  document.querySelectorAll(".side-link").forEach((l) => {
    const on = l.dataset.page === name;
    l.classList.toggle("active", on);
    if (on) l.setAttribute("aria-current", "page");
    else l.removeAttribute("aria-current");
  });
  const qEl = $("#q");
  if (qEl && qs) {
    qEl.value = qs;
    applySearch();
  }
  if (name === "dashboard") drawChart();
}
const route = () => {
  const n = location.hash.slice(1);
  show(pages[n] ? n : "dashboard");
  closeMenu();
  window.scrollTo({ top: 0 });
};
window.addEventListener("hashchange", route);

view.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act],[data-page]");
  if (!el) return;
  if (el.dataset.page) location.hash = el.dataset.page;
  else actions[el.dataset.act]?.(el.dataset.id, el);
});
function applySearch() {
  const q = qs.trim().toLowerCase();
  view
    .querySelectorAll("tbody tr")
    .forEach((r) => (r.hidden = !r.textContent.toLowerCase().includes(q)));
}
view.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    qs = e.target.value;
    applySearch();
  } else if (e.target.id === "sc") cartCust = e.target.value;
});
view.addEventListener("change", (e) => {
  if (e.target.id === "ps") {
    psort = e.target.value;
    show("products");
  } else if (e.target.id === "restoreFile") {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.products)) throw 0;
        if (!confirm("هيتم استبدال كل البيانات الحالية بالنسخة دي، متأكد؟")) return;
        localStorage.setItem(KEY, JSON.stringify(d));
        db = loadDb();
        cart = [];
        commit("اتسترجعت البيانات");
      } catch {
        toast("الملف مش نسخة احتياطية صالحة", true);
      }
    };
    r.readAsText(file);
  }
});
modalEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-print]")) window.print();
});
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  const d = loadDb();
  if (d) {
    db = d;
    show(current);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    const q = $("#q");
    if (q) {
      e.preventDefault();
      q.focus();
    }
  }
});
document.querySelectorAll(".side-link").forEach((b) =>
  b.addEventListener("click", () => {
    if (location.hash.slice(1) === b.dataset.page) closeMenu();
    else location.hash = b.dataset.page;
  }),
);

/* ---------- theme & mobile menu ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.setAttribute("data-bs-theme", theme);
  themeToggle.querySelector("i").className =
    theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن",
  );
  localStorage.setItem("makhzon-theme", theme);
}
themeToggle.addEventListener("click", () => {
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
  if (current === "dashboard") drawChart();
});
function setMenu(open) {
  sidebar.classList.toggle("show", open);
  overlay.classList.toggle("show", open);
  menuBtn.setAttribute("aria-expanded", String(open));
}
function closeMenu() {
  setMenu(false);
}
menuBtn.addEventListener("click", () =>
  setMenu(!sidebar.classList.contains("show")),
);
overlay.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
window.matchMedia("(min-width: 992px)").addEventListener("change", closeMenu);

const now = new Date();
$("#todayDate").textContent = now.toLocaleDateString("ar-EG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
$("#currentYear").textContent = now.getFullYear();
applyTheme(localStorage.getItem("makhzon-theme") || "light");
route();
