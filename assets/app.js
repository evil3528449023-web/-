const API_BASE = "https://selector-api.coolify.aozoomusa.com";
const ORIGINAL_SITE = "https://selector.coolify.aozoomusa.com";
const QUICK_QUERIES = ["哈弗H6", "哈弗H9", "途乐", "亚洲龙", "卡罗拉", "普拉多LC250"];

const input = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const quickTags = document.querySelector("#quickTags");
const results = document.querySelector("#fitmentResults");
const newProducts = document.querySelector("#newProducts");
const hotProducts = document.querySelector("#hotProducts");
const hero = document.querySelector("#hero");

let fitments = [];

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${ORIGINAL_SITE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function productImage(fitment) {
  const product = fitment.product || {};
  const images = fitment.productImages || product.productImages || [];
  return absoluteUrl(images[0]?.url) || "";
}

function price(value) {
  if (value === null || value === undefined || value === "") return "待确认";
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toLocaleString("zh-CN")}` : String(value);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/长城哈弗/g, "哈弗")
    .replace(/哈佛/g, "哈弗")
    .replace(/haval/g, "哈弗")
    .replace(/[，。；：、（）()\-_/\s|]+/g, "");
}

function vehicleYear(vehicle) {
  if (vehicle.yearStart && vehicle.yearEnd) return `${vehicle.yearStart}-${vehicle.yearEnd}`;
  if (vehicle.yearStart) return `${vehicle.yearStart}+`;
  if (vehicle.yearEnd) return `-${vehicle.yearEnd}`;
  return "";
}

function vehicleLabel(vehicle) {
  return [vehicle.make, vehicle.model, vehicleYear(vehicle), vehicle.trim].filter(Boolean).join(" ");
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
    ...getVehicles(fitment).flatMap((vehicle) => [vehicleLabel(vehicle), vehicle.make, vehicle.model, vehicle.trim]),
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
  const vehicleText = normalize(getVehicles(fitment).map(vehicleLabel).join(" "));
  const allText = normalize(fitmentText(fitment));
  let best = 0;

  for (const alias of aliases) {
    if (vehicleText.includes(alias)) best = Math.max(best, 140);
    if (allText.includes(alias)) best = Math.max(best, 100);
    if (alias.length <= 2 && vehicleText.includes(alias)) best = Math.max(best, 90);
  }

  const product = fitment.product || {};
  if (normalize(product.productModel).includes(normalize(query))) best += 120;
  return best;
}

function openDetail(fitmentId) {
  window.open(`${ORIGINAL_SITE}/pages/product/detail?fitmentId=${encodeURIComponent(fitmentId)}`, "_blank");
}

function renderProductGrid(container, items) {
  container.innerHTML = "";
  const rows = items.slice(0, 8);
  for (const item of rows) {
    const fitment = item.fitment || item;
    const product = item.product || fitment.product || {};
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img alt="" />
      <div class="product-name"></div>
      <div class="product-sku"></div>
      <div class="product-price"></div>
    `;
    card.querySelector("img").src = productImage(fitment);
    card.querySelector(".product-name").textContent = fitment.title || product.productName || "奥滋姆雾灯产品";
    card.querySelector(".product-sku").textContent = product.productModel || product.sku || "待确认 SKU";
    card.querySelector(".product-price").textContent = price(fitment.retailInstalled ?? product.retailInstalled);
    card.addEventListener("click", () => openDetail(fitment.id));
    container.appendChild(card);
  }
}

function renderSearch(rows, query) {
  results.innerHTML = "";
  if (!query.trim()) return;
  if (!rows.length) {
    results.innerHTML = '<div class="fitment-status">没有找到适配产品，可以换成“品牌+车系”再试</div>';
    return;
  }
  for (const fitment of rows.slice(0, 8)) {
    const product = fitment.product || {};
    const vehicles = getVehicles(fitment);
    const vehiclePreview = vehicles.slice(0, 3).map(vehicleLabel).join("，");
    const card = document.createElement("article");
    card.className = "fitment-card";
    card.innerHTML = `
      <strong></strong>
      <span></span>
      <em></em>
    `;
    card.querySelector("strong").textContent = `${fitment.title || product.productName || "适配产品"}（${product.productModel || "SKU待确认"}）`;
    card.querySelector("span").textContent = vehiclePreview || "适配车型待确认";
    card.querySelector("em").textContent = price(fitment.retailInstalled ?? product.retailInstalled);
    card.addEventListener("click", () => openDetail(fitment.id));
    results.appendChild(card);
  }
}

function runSearch() {
  const query = input.value.trim();
  const rows = fitments
    .map((fitment) => ({ fitment, score: scoreFitment(fitment, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.fitment);
  renderSearch(rows, query);
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`加载失败：${response.status}`);
  return response.json();
}

async function initHome() {
  const [bannerData, activityData, fitmentData] = await Promise.all([
    fetchJson("/banners"),
    fetchJson("/activities"),
    fetchJson("/fitments?limit=5000"),
  ]);

  fitments = fitmentData.fitments || [];
  const banners = (bannerData.banners || []).filter((item) => item.enabled);
  if (banners[0]?.imageUrl) {
    hero.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.42) 42%, rgba(0,0,0,.05) 100%), url("${absoluteUrl(banners[0].imageUrl)}")`;
  }

  const activities = (activityData.activities || []).filter((item) => item.enabled);
  const newest = activities.find((item) => item.title?.includes("新品")) || activities[0];
  const hot = activities.find((item) => item.title?.includes("热门")) || activities[1];
  renderProductGrid(newProducts, (newest?.productList?.items || []).map((item) => ({ ...item, product: item.product || item.fitment?.product })));
  renderProductGrid(hotProducts, (hot?.productList?.items || []).map((item) => ({ ...item, product: item.product || item.fitment?.product })));
}

searchButton.addEventListener("click", runSearch);
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
  quickTags.appendChild(tag);
}

initHome().catch(() => {
  results.innerHTML = '<div class="fitment-status">数据加载失败，请稍后刷新</div>';
});
