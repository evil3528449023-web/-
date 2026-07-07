const API_BASE = "https://selector-api.coolify.aozoomusa.com";
const QUICK_QUERIES = ["哈弗H6", "哈弗H9", "途乐", "亚洲龙", "卡罗拉", "普拉多LC250", "ALFP-13/01"];

const input = document.querySelector("#searchInput");
const button = document.querySelector("#searchButton");
const resultsEl = document.querySelector("#results");
const summaryEl = document.querySelector("#summary");
const quickTagsEl = document.querySelector("#quickTags");

let fitments = [];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/长城哈弗/g, "哈弗")
    .replace(/哈佛/g, "哈弗")
    .replace(/haval/g, "哈弗")
    .replace(/greatwall/g, "长城")
    .replace(/[，。；：、（）()\-_/\s|]+/g, "");
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "待确认";
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toLocaleString("zh-CN")}` : String(value);
}

function vehicleYear(vehicle) {
  if (vehicle.yearStart && vehicle.yearEnd) return `${vehicle.yearStart}-${vehicle.yearEnd}`;
  if (vehicle.yearStart) return `${vehicle.yearStart}+`;
  if (vehicle.yearEnd) return `-${vehicle.yearEnd}`;
  return "不限年份";
}

function vehicleLabel(vehicle) {
  return [vehicle.make, vehicle.model, vehicleYear(vehicle), vehicle.trim].filter(Boolean).join(" / ");
}

function getVehicles(fitment) {
  return fitment.vehicles || (fitment.vehicle ? [fitment.vehicle] : []);
}

function fitmentText(fitment) {
  const product = fitment.product || {};
  return [
    fitment.title,
    fitment.bracketSku,
    fitment.installNote,
    product.productModel,
    product.productName,
    ...getVehicles(fitment).flatMap((vehicle) => [
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      vehicle.yearStart,
      vehicle.yearEnd,
      vehicleLabel(vehicle),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function queryAliases(query) {
  const compact = normalize(query);
  const aliases = new Set([compact]);
  if (compact.includes("长城") && compact.includes("h6")) aliases.add("哈弗h6");
  if (compact.includes("长城") && compact.includes("h9")) aliases.add("哈弗h9");
  if (compact === "h6" || compact.endsWith("h6")) aliases.add("哈弗h6");
  if (compact === "h9" || compact.endsWith("h9")) aliases.add("哈弗h9");
  if (compact.includes("途乐")) aliases.add("日产途乐");
  if (compact.includes("lc250")) aliases.add("普拉多lc250");
  return [...aliases].filter(Boolean);
}

function scoreFitment(fitment, query) {
  const aliases = queryAliases(query);
  const vehicles = getVehicles(fitment);
  const product = fitment.product || {};
  const vehicleText = normalize(vehicles.map(vehicleLabel).join(" "));
  const allText = normalize(fitmentText(fitment));
  let best = 0;

  for (const alias of aliases) {
    if (vehicleText.includes(alias)) best = Math.max(best, 140);
    if (allText.includes(alias)) best = Math.max(best, 100);
    if (alias.length <= 2 && vehicleText.includes(alias)) best = Math.max(best, 90);
  }

  const tokens = normalize(query).match(/[a-z0-9]+|[\u4e00-\u9fa5]+/g) || [];
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (vehicleText.includes(token)) best += 18;
    else if (allText.includes(token)) best += 8;
  }

  if (normalize(product.productModel).includes(normalize(query))) best += 120;
  return best;
}

function fitmentSummary(fitment) {
  const product = fitment.product || {};
  const vehicles = getVehicles(fitment);
  const vehiclePreview = vehicles.slice(0, 4).map(vehicleLabel).join("，");
  const more = vehicles.length > 4 ? ` 等 ${vehicles.length} 个车型` : "";
  return {
    title: fitment.title || product.productName || "适配产品",
    sku: product.productModel || fitment.productId || "待确认 SKU",
    onlinePrice: formatPrice(fitment.onlinePrice ?? product.onlinePrice),
    retailPrice: formatPrice(fitment.retailInstalled ?? product.retailInstalled),
    vehicle: `${vehiclePreview}${more}`,
    note: fitment.installNote || product.note || "",
  };
}

function renderResults(rows, query) {
  resultsEl.innerHTML = "";
  if (!query.trim()) {
    summaryEl.textContent = `已加载 ${fitments.length} 组适配数据。输入车型后即可查询。`;
    resultsEl.innerHTML = '<div class="empty">请输入车型、品牌、年款或产品型号</div>';
    return;
  }

  summaryEl.textContent = rows.length ? `找到 ${rows.length} 个适配产品` : "没有找到适配产品，可以换成“品牌+车系”再试";
  if (!rows.length) {
    resultsEl.innerHTML = '<div class="empty">暂无匹配结果</div>';
    return;
  }

  for (const fitment of rows.slice(0, 40)) {
    const item = fitmentSummary(fitment);
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-head">
        <div class="result-title"></div>
        <div class="sku"></div>
      </div>
      <div class="vehicle"></div>
      <div class="price-row">
        <span class="online"></span>
        <span class="retail"></span>
      </div>
      <div class="note"></div>
    `;
    card.querySelector(".result-title").textContent = item.title;
    card.querySelector(".sku").textContent = item.sku;
    card.querySelector(".vehicle").textContent = item.vehicle || "适配车型待确认";
    card.querySelector(".online").textContent = `线上：${item.onlinePrice}`;
    card.querySelector(".retail").textContent = `安装：${item.retailPrice}`;
    card.querySelector(".note").textContent = item.note;
    card.addEventListener("click", () => {
      location.href = `/pages/product/detail?fitmentId=${encodeURIComponent(fitment.id)}`;
    });
    resultsEl.appendChild(card);
  }
}

function runSearch() {
  const query = input.value.trim();
  const rows = fitments
    .map((fitment) => ({ fitment, score: scoreFitment(fitment, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || fitmentSummary(a.fitment).sku.localeCompare(fitmentSummary(b.fitment).sku, "zh-CN"))
    .map((item) => item.fitment);
  renderResults(rows, query);
}

async function loadFitments() {
  summaryEl.textContent = "正在加载适配数据...";
  const response = await fetch(`${API_BASE}/fitments?limit=5000`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`加载失败：${response.status}`);
  const data = await response.json();
  fitments = data.fitments || [];
  renderResults([], "");
}

button.addEventListener("click", runSearch);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});

for (const query of QUICK_QUERIES) {
  const tag = document.createElement("button");
  tag.className = "tag";
  tag.type = "button";
  tag.textContent = query;
  tag.addEventListener("click", () => {
    input.value = query;
    runSearch();
  });
  quickTagsEl.appendChild(tag);
}

loadFitments().catch((error) => {
  summaryEl.textContent = error.message || "适配数据加载失败";
  resultsEl.innerHTML = '<div class="empty">请检查接口或稍后再试</div>';
});
