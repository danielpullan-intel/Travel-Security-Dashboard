const width = window.innerWidth - 320;
const height = window.innerHeight - 60;
const svg = d3.select("#globe-container").append("svg").attr("width", width).attr("height", height);
const projection = d3.geoOrthographic().scale(Math.min(width, height) / 2.2).translate([width / 2, height / 2]).clipAngle(90);
const path = d3.geoPath().projection(projection);
svg.append("circle").attr("cx", width / 2).attr("cy", height / 2).attr("r", projection.scale()).attr("fill", "#0a1a3a");
const globeGroup = svg.append("g");
const tooltip = d3.select("#tooltip");
let countryData = {};
let isDragging = false;
let startPos = null;
let startRotation = null;
const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

function splitOverseasTerritories(features) {
  const result = [];
  features.forEach(d => {
    if (parseInt(d.id) === 250 && d.geometry.type === "MultiPolygon") {
      const mainland = [];
      const overseas = [];
      d.geometry.coordinates.forEach(poly => {
        const cx = d3.geoCentroid({type:"Feature", geometry:{type:"Polygon", coordinates: poly}});
        if (cx[0] < -30) overseas.push(poly);
        else mainland.push(poly);
      });
      if (mainland.length) result.push({ ...d, geometry: { ...d.geometry, coordinates: mainland } });
      if (overseas.length) result.push({ ...d, id: "FGU", geometry: { ...d.geometry, coordinates: overseas } });
    } else {
      result.push(d);
    }
  });
  return result;
}

fetch("/api/countries").then(r => r.json()).then(data => { data.forEach(d => { countryData[d.country] = { current: d.current, planned: d.planned }; }); loadGlobe(); });

function loadGlobe() {
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json()).then(world => {
    const countries = topojson.feature(world, world.objects.countries);
    fetch("https://restcountries.com/v3.1/all?fields=name,ccn3").then(r => r.json()).then(nations => {
      const countryNames = {};
      nations.forEach(n => { countryNames[parseInt(n.ccn3)] = n.name.common; });
      countryNames["FGU"] = "French Guiana";
      drawCountries(countries, countryNames);
    }).catch(() => drawCountries(countries, {}));
  });
}

function getColorClass(name) {
  const d = countryData[name];
  if (!d || d.current === 0) return "country-0";
  if (d.current === 1) return "country-1";
  if (d.current === 2) return "country-2";
  if (d.current === 3) return "country-3";
  if (d.current === 4) return "country-4";
  return "country-5plus";
}

function getTravelStatus(start, end, approved) {
  if (!approved) return { label: "● Travel Denied", cls: "status-denied" };
  if (start <= today && end >= today) return { label: "● In Country", cls: "status-incountry" };
  if (start > today) return { label: "● Upcoming", cls: "status-upcoming" };
  return { label: "● Returned", cls: "status-returned" };
}

function rotateTo(feature) {
  const centroid = d3.geoCentroid(feature);
  const targetRotation = [-centroid[0], -centroid[1]];
  const currentRotation = projection.rotate();
  const interp = d3.interpolate(currentRotation, targetRotation);
  d3.transition()
    .duration(800)
    .ease(d3.easeCubicInOut)
    .tween("rotate", () => t => {
      projection.rotate(interp(t));
      globeGroup.selectAll(".country").attr("d", path);
    });
}

function drawCountries(countries, countryNames) {
  const features = splitOverseasTerritories(countries.features);
  globeGroup.selectAll(".country")
    .data(features)
    .enter().append("path")
    .attr("class", d => `country ${getColorClass(countryNames[d.id] || countryNames[parseInt(d.id)] || "")}`)
    .attr("d", path)
    .on("mousemove", function(event, d) {
      const name = countryNames[d.id] || countryNames[parseInt(d.id)] || "Unknown";
      const data = countryData[name] || { current: 0, planned: 0 };
      tooltip.classed("hidden", false).style("left", (event.clientX + 14) + "px").style("top", (event.clientY - 10) + "px")
        .html(`<div class="tip-country">${name}</div><div>Current: <strong>${data.current}</strong></div><div>Planned: <strong>${data.planned}</strong></div>`);
    })
    .on("mouseleave", () => tooltip.classed("hidden", true))
    .on("click", function(event, d) {
      if (!isDragging) {
        const name = countryNames[d.id] || countryNames[parseInt(d.id)] || "Unknown";
        rotateTo(d);
        openPanel(name);
      }
    });

  svg.on("mousedown", function(event) { isDragging = false; startPos = [event.clientX, event.clientY]; startRotation = [...projection.rotate()]; });
  svg.on("mousemove", function(event) {
    if (!startPos) return;
    const dx = event.clientX - startPos[0];
    const dy = event.clientY - startPos[1];
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
    if (!isDragging) return;
    projection.rotate([startRotation[0] + dx * 0.3, startRotation[1] - dy * 0.3]);
    globeGroup.selectAll(".country").attr("d", path);
  });
  svg.on("mouseup", () => { startPos = null; setTimeout(() => { isDragging = false; }, 50); });
}

function travelerCard(t) {
  const status = getTravelStatus(t.travel_start, t.travel_end, t.travel_approved);
  return `
    <div class="traveler-card">
      <div class="traveler-name-row">
        <span class="traveler-name">${t.first_name} ${t.last_name}</span>
        <span class="travel-status ${status.cls}">${status.label}</span>
      </div>
      <div class="traveler-dates">${t.travel_start} → ${t.travel_end}</div>
      <div class="contact-section">
        <strong>Passport:</strong> ${t.passport_number}<br>
        <strong>Primary Contact (${t.contacts.primary.label}):</strong> ${t.contacts.primary.value}<br>
        <strong>In-Country Contact:</strong> ${t.contacts.secondary.name} (${t.contacts.secondary.relationship}) — ${t.contacts.secondary.phone}<br>
        <strong>Emergency Contact:</strong> ${t.contacts.emergency.name} (${t.contacts.emergency.relationship}) — ${t.contacts.emergency.phone}
      </div>
      <a href="${t.itinerary_link}" target="_blank">View Itinerary →</a>
    </div>`;
}

function openPanel(countryName) {
  document.getElementById("panel").classList.remove("hidden");
  document.getElementById("panel-country").textContent = countryName;
  const data = countryData[countryName] || { current: 0, planned: 0 };
  document.getElementById("panel-current").textContent = `Current: ${data.current}`;
  document.getElementById("panel-planned").textContent = `Planned: ${data.planned}`;
  const travelersDiv = document.getElementById("panel-travelers");
  travelersDiv.innerHTML = "<p style='color:#7eb8f7;font-size:0.85rem'>Loading...</p>";

  fetch(`/api/travelers/${encodeURIComponent(countryName)}`).then(r => r.json()).then(travelers => {
    if (travelers.length === 0) {
      travelersDiv.innerHTML = "<p style='color:#a0b0c8;font-size:0.85rem'>No traveler records.</p>";
      return;
    }

    const current = travelers.filter(t => t.travel_start <= today && t.travel_end >= today && t.travel_approved);
    const denied = travelers.filter(t => !t.travel_approved);
    const upcoming = travelers.filter(t => t.travel_start > today && t.travel_approved);

    let html = "";

    // Current travelers as full cards
    current.forEach(t => { html += travelerCard(t); });

    // Upcoming as collapsible dropdown
    if (upcoming.length > 0) {
      html += `
        <div class="upcoming-dropdown">
          <div class="upcoming-header" onclick="toggleUpcoming(this)">
            <span>Upcoming Travel (${upcoming.length})</span>
            <span class="upcoming-arrow">▼</span>
          </div>
          <div class="upcoming-body" style="display:none">
            ${upcoming.map(t => travelerCard(t)).join("")}
          </div>
        </div>`;
    }

    // Denied as collapsible dropdown
    if (denied.length > 0) {
      html += `
        <div class="denied-dropdown">
          <div class="denied-header" onclick="toggleUpcoming(this)">
            <span>Travel Denied (${denied.length})</span>
            <span class="upcoming-arrow">▼</span>
          </div>
          <div class="upcoming-body" style="display:none">
            ${denied.map(t => travelerCard(t)).join("")}
          </div>
        </div>`;
    }

    if (html === "") {
      travelersDiv.innerHTML = "<p style='color:#a0b0c8;font-size:0.85rem'>No traveler records.</p>";
    } else {
      travelersDiv.innerHTML = html;
    }
  });
}

function toggleUpcoming(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector(".upcoming-arrow");
  if (body.style.display === "none") {
    body.style.display = "block";
    arrow.textContent = "▲";
  } else {
    body.style.display = "none";
    arrow.textContent = "▼";
  }
}

function closePanel() { document.getElementById("panel").classList.add("hidden"); }
