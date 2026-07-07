(function () {
  const API_BASE = "https://selector-api.coolify.aozoomusa.com";
  const PANEL_ID = "aozoom-fitment-keyword-panel";
  const STYLE_ID = "aozoom-fitment-keyword-style";
  const QUICK_QUERIES = ["哈弗H6", "哈弗H9", "途乐", "亚洲龙", "卡罗拉", "普拉多LC250"];
  let fitmentsCache = null;
  let loadingPromise = null;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/长城哈弗/g, "哈弗")
      .replace(/哈佛/g, "哈弗")
      .replace(/greatwall/g, "长城")
      .replace(/haval/g, "哈弗")
      .replace(/[，。；：、（）()\-_/\s|]+/g, "");
  }

  function price(value) {
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

  function fitmentText(fitment) {
    const product = fitment.product || {};
    const vehicles = fitment.vehicles || (fitment.vehicle ? [fitment.vehicle] : []);
    return [
      fitment.title,
      fitment.bracketSku,
      fitment.installNote,
      product.productModel,
      product.productName,
      ...vehicles.flatMap((vehicle) => [
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
    const vehicles = fitment.vehicles || (fitment.vehicle ? [fitment.vehicle] : []);
    const product = fitment.product || {};
    const vehicleText = normalize(vehicles.map(vehicleLabel).join(" "));
    const allText = normalize(fitmentText(fitment));
    let best = 0;

    for (const alias of aliases) {
      if (!alias) continue;
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

  async function loadFitments() {
    if (fitmentsCache) return fitmentsCache;
    if (!loadingPromise) {
      loadingPromise = fetch(`${API_BASE}/fitments?limit=5000`, { headers: { Accept: "application/json" } })
        .catch(() => fetch("./data/fitments.json", { headers: { Accept: "application/json" } }))
        .then((response) => {
          if (!response.ok) throw new Error(`加载失败：${response.status}`);
          return response.json();
        })
        .then((data) => data.fitments || []);
    }
    fitmentsCache = await loadingPromise;
    return fitmentsCache;
  }

  function resultSummary(fitment) {
    const product = fitment.product || {};
    const vehicles = fitment.vehicles || (fitment.vehicle ? [fitment.vehicle] : []);
    const vehiclePreview = vehicles.slice(0, 3).map(vehicleLabel).join("，");
    const more = vehicles.length > 3 ? ` 等 ${vehicles.length} 个车型` : "";
    return {
      title: fitment.title || product.productName || "适配产品",
      sku: product.productModel || fitment.productId || "待确认 SKU",
      price: price(fitment.onlinePrice ?? product.onlinePrice),
      vehicle: `${vehiclePreview}${more}`,
    };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} { padding: 14px; background: #fff; border-bottom: 1px solid #f0f0f0; }
      #${PANEL_ID} .aoz-title { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 10px; }
      #${PANEL_ID} .aoz-title strong { color: #171615; font-size: 15px; font-weight: 900; }
      #${PANEL_ID} .aoz-title span { color: #888; font-size: 12px; text-align: right; }
      #${PANEL_ID} .aoz-search { display: grid; grid-template-columns: minmax(0, 1fr) 78px; gap: 8px; }
      #${PANEL_ID} input { min-width: 0; height: 44px; border: 1px solid #e6e6e6; border-radius: 8px; padding: 0 12px; color: #171615; font-size: 14px; outline: none; background: #fff; box-sizing: border-box; }
      #${PANEL_ID} button { height: 44px; border: 0; border-radius: 8px; color: #fff; background: #ff6f15; font-size: 14px; font-weight: 900; }
      #${PANEL_ID} .aoz-tags { display: flex; gap: 8px; overflow-x: auto; padding: 10px 0 2px; }
      #${PANEL_ID} .aoz-tag { flex: 0 0 auto; border: 1px solid rgba(255,111,21,.28); border-radius: 999px; padding: 7px 10px; color: #ff6f15; background: #fff8f3; font-size: 12px; font-weight: 800; }
      #${PANEL_ID} .aoz-status { padding: 14px 0 2px; color: #888; font-size: 13px; text-align: center; }
      #${PANEL_ID} .aoz-result { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #f0f0f0; padding: 12px 0; cursor: pointer; }
      #${PANEL_ID} .aoz-result:first-child { border-top: 0; }
      #${PANEL_ID} .aoz-main { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
      #${PANEL_ID} .aoz-name { color: #171615; font-size: 14px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${PANEL_ID} .aoz-meta { color: #888; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${PANEL_ID} .aoz-price { flex: 0 0 auto; color: #ff6f15; font-size: 13px; font-weight: 900; white-space: nowrap; }
      @media (max-width: 380px) { #${PANEL_ID} .aoz-search { grid-template-columns: 1fr; } #${PANEL_ID} button { width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function navigateToFitment(id) {
    if (location.hostname.endsWith("github.io")) {
      window.open(`https://selector.coolify.aozoomusa.com/pages/product/detail?fitmentId=${encodeURIComponent(id)}`, "_blank");
      return;
    }
    window.location.href = `/pages/product/detail?fitmentId=${encodeURIComponent(id)}`;
  }

  function renderResults(panel, results, query) {
    const body = panel.querySelector("[data-aoz-results]");
    body.innerHTML = "";
    if (!query.trim()) {
      body.innerHTML = '<div class="aoz-status">输入车型、品牌、年款或产品型号即可查询</div>';
      return;
    }
    if (!results.length) {
      body.innerHTML = '<div class="aoz-status">没有找到适配产品，可以换成“品牌+车系”再试</div>';
      return;
    }

    for (const fitment of results.slice(0, 30)) {
      const item = resultSummary(fitment);
      const row = document.createElement("div");
      row.className = "aoz-result";
      row.innerHTML = `
        <div class="aoz-main">
          <div class="aoz-name"></div>
          <div class="aoz-meta"></div>
        </div>
        <div class="aoz-price"></div>
      `;
      row.querySelector(".aoz-name").textContent = `${item.title}（${item.sku}）`;
      row.querySelector(".aoz-meta").textContent = item.vehicle || "适配车型待确认";
      row.querySelector(".aoz-price").textContent = item.price;
      row.addEventListener("click", () => navigateToFitment(fitment.id));
      body.appendChild(row);
    }
  }

  async function runSearch(panel) {
    const input = panel.querySelector("input");
    const query = input.value.trim();
    const body = panel.querySelector("[data-aoz-results]");
    body.innerHTML = '<div class="aoz-status">正在查询适配产品...</div>';
    try {
      const fitments = await loadFitments();
      const results = fitments
        .map((fitment) => ({ fitment, score: scoreFitment(fitment, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || resultSummary(a.fitment).sku.localeCompare(resultSummary(b.fitment).sku, "zh-CN"))
        .map((item) => item.fitment);
      renderResults(panel, results, query);
    } catch (error) {
      body.innerHTML = `<div class="aoz-status">${error.message || "查询失败，请稍后再试"}</div>`;
    }
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="aoz-title">
        <strong>车型关键词查询</strong>
        <span>可输入：长城H6、哈弗H9、途乐、ALFP-13/01</span>
      </div>
      <div class="aoz-search">
        <input type="search" autocomplete="off" placeholder="输入车型 / 年款 / 产品型号" />
        <button type="button">查询</button>
      </div>
      <div class="aoz-tags"></div>
      <div data-aoz-results><div class="aoz-status">输入车型后即可看到适合安装的产品</div></div>
    `;
    const input = panel.querySelector("input");
    const button = panel.querySelector("button");
    const tags = panel.querySelector(".aoz-tags");
    button.addEventListener("click", () => runSearch(panel));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSearch(panel);
    });
    for (const query of QUICK_QUERIES) {
      const tag = document.createElement("span");
      tag.className = "aoz-tag";
      tag.textContent = query;
      tag.addEventListener("click", () => {
        input.value = query;
        runSearch(panel);
      });
      tags.appendChild(tag);
    }
    return panel;
  }

  function mountPanel() {
    const isFitmentPage = location.pathname === "/pages/fitment/index" || location.pathname.endsWith("/pages/fitment/index");
    const existing = document.getElementById(PANEL_ID);
    if (!isFitmentPage) {
      if (existing) existing.remove();
      return;
    }
    ensureStyle();
    if (existing) return;
    const queryCard = document.querySelector(".query-card");
    const brandCard = document.querySelector(".brand-card");
    if (!queryCard && !brandCard) return;
    const panel = createPanel();
    if (queryCard && queryCard.parentNode) queryCard.insertAdjacentElement("afterend", panel);
    else brandCard.parentNode.insertBefore(panel, brandCard);
  }

  function scheduleMount() {
    setTimeout(mountPanel, 80);
    setTimeout(mountPanel, 500);
    setTimeout(mountPanel, 1200);
  }

  window.addEventListener("DOMContentLoaded", scheduleMount);
  window.addEventListener("popstate", scheduleMount);
  const originalPushState = history.pushState;
  history.pushState = function () {
    const value = originalPushState.apply(this, arguments);
    scheduleMount();
    return value;
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    const value = originalReplaceState.apply(this, arguments);
    scheduleMount();
    return value;
  };
  scheduleMount();
})();

