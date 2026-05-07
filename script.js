const form = document.getElementById("responseForm");
const formStatus = document.getElementById("formStatus");
const responsesContainer = document.getElementById("responses");
const responseCount = document.getElementById("responseCount");
const countrySelect = document.getElementById("countrySelect");
const qrInput = document.getElementById("qrInput");
const qrImage = document.getElementById("qrImage");
const generateQrBtn = document.getElementById("generateQrBtn");
const apiBaseInput = document.getElementById("apiBaseInput");
const saveApiBaseBtn = document.getElementById("saveApiBaseBtn");
const apiBaseStatus = document.getElementById("apiBaseStatus");

const defaultApiBase = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "";
const storedApiBase = localStorage.getItem("apiBaseUrl") || "";
let apiBaseUrl = (storedApiBase || defaultApiBase || "").replace(/\/$/, "");

function apiUrl(path) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${safePath}` : safePath;
}

const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 7,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let markers = [];

function clearMarkers() {
  for (const marker of markers) {
    map.removeLayer(marker);
  }
  markers = [];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderResponses(submissions) {
  responseCount.textContent = String(submissions.length);
  clearMarkers();

  responsesContainer.innerHTML = "";
  const latest = submissions.slice(0, 12);

  const groupedByLocation = new Map();
  for (const item of submissions) {
    const key = `${item.latitude},${item.longitude}`;
    if (!groupedByLocation.has(key)) groupedByLocation.set(key, []);
    groupedByLocation.get(key).push(item);
  }

  for (const [, items] of groupedByLocation) {
    const first = items[0];
    const names = items
      .map((entry) => entry.name || "Anonymous")
      .filter(Boolean)
      .slice(0, 10);
    const namesList = names.map((name) => `<li>${escapeHtml(name)}</li>`).join("");

    const marker = L.marker([first.latitude, first.longitude]).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(first.country)}</strong><br/>Total responses: ${items.length}<br/><br/><strong>Names:</strong><ul>${namesList}</ul>`
    );
    markers.push(marker);
  }

  for (const item of latest) {
    const div = document.createElement("div");
    div.className = "response-card";
    div.innerHTML = `
      <h3>${escapeHtml(item.name || "Anonymous")} - ${escapeHtml(item.country)}</h3>
      <p><strong>Institution:</strong> ${escapeHtml(item.institution)}</p>
      <p><strong>Challenge:</strong> ${escapeHtml(item.challenge)}</p>
      <p><strong>Youth role:</strong> ${escapeHtml(item.youthRole)}</p>
      <p><strong>Solution:</strong> ${escapeHtml(item.youthSolution)}</p>
      <p><strong>Support needed:</strong> ${escapeHtml(item.supportNeeded)}</p>
      <p><strong>One word:</strong> ${escapeHtml(item.oneWord)}</p>
    `;
    responsesContainer.appendChild(div);
  }
}

async function fetchSubmissions() {
  const res = await fetch(apiUrl("/api/submissions"));
  const data = await res.json();
  renderResponses(data.submissions || []);
}

async function fetchCountries() {
  if (!countrySelect) return;
  try {
    const res = await fetch(apiUrl("/api/countries"));
    const data = await res.json();
    const countries = Array.isArray(data.countries) ? data.countries : [];

    countrySelect.innerHTML = `<option value="">Select your country</option>`;
    for (const country of countries) {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      countrySelect.appendChild(option);
    }
  } catch (_error) {
    formStatus.textContent =
      "Could not load country list. Refresh and try again.";
    formStatus.className = "error";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "Submitting...";
  formStatus.className = "";

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(apiUrl("/api/submissions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit.");
    }

    form.reset();
    formStatus.textContent = "Thank you. Your response is now on the map.";
    formStatus.className = "success";
    await fetchSubmissions();
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.className = "error";
  }
});

generateQrBtn.addEventListener("click", () => {
  const targetUrl = qrInput.value.trim();
  if (!targetUrl) return;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(targetUrl)}`;
  qrImage.src = qrUrl;
  qrImage.style.display = "block";
});

if (apiBaseInput && saveApiBaseBtn && apiBaseStatus) {
  apiBaseInput.value = apiBaseUrl;
  saveApiBaseBtn.addEventListener("click", async () => {
    const next = apiBaseInput.value.trim().replace(/\/$/, "");
    apiBaseUrl = next;
    localStorage.setItem("apiBaseUrl", next);
    apiBaseStatus.textContent = next
      ? `API set to ${next}`
      : "API reset to same-origin.";
    try {
      await fetchSubmissions();
    } catch (_error) {
      apiBaseStatus.textContent =
        "Saved, but API check failed. Verify Render URL and CORS.";
    }
  });
}

fetchSubmissions();
fetchCountries();
setInterval(fetchSubmissions, 15000);
