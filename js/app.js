// /js/app.js

(function () {
  // ------- Utilities -------
  const NZ_DATE_FORMAT = { day: "numeric", month: "long", year: "numeric" };

  function formatNZDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString("en-NZ", NZ_DATE_FORMAT);
  }

  function escapeHTML(str = "") {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function preferredLink(links = {}) {
    return links.website || links.instagram || links.facebook || "";
  }

  // ------- Data -------
  const state = {
    reviews: Array.isArray(window.REVIEWS) ? [...window.REVIEWS] : []
  };

  // ------- Leaderboard logic -------
  // strategy: "latest" (default), "best", or "average"
  const LEADERBOARD_STRATEGY = "best";

  function computeLeaderboard(reviews, strategy = "latest") {
    // Group reviews by cafe
    const map = new Map();
    for (const r of reviews) {
      const key = r.cafe.trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }

    const rows = [];
    for (const [cafe, arr] of map.entries()) {
      let chosen;
      if (strategy === "best") {
        chosen = arr.slice().sort((a, b) => b.score - a.score)[0];
      } else if (strategy === "average") {
        const avg =
          arr.reduce((sum, x) => sum + Number(x.score || 0), 0) / arr.length;
        // Use most recent review for meta (location/link), but show avg score
        const recent = arr.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        chosen = { ...recent, score: avg };
      } else {
        // "latest"
        chosen = arr.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      }

      rows.push({
        cafe,
        location: chosen.location || "",
        link: preferredLink(chosen.links || {}),
        score: Number(chosen.score || 0),
        count: arr.length
      });
    }

    rows.sort((a, b) => b.score - a.score);
    return rows;
  }

  // ------- Rendering: Leaderboard -------
  function renderLeaderboard() {
    const container = document.querySelector(".leaderboard");
    if (!container) return;
    container.innerHTML = "";

    const rows = computeLeaderboard(state.reviews, LEADERBOARD_STRATEGY);

    rows.forEach((row, i) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";
      item.innerHTML = `
        <div class="rank">${i + 1}</div>
        <div class="cafe-info">
          <div class="cafe-name">${escapeHTML(row.cafe)}</div>
          <div class="cafe-location">${escapeHTML(row.location)}</div>
          ${
            row.link
              ? `<a href="${row.link}" target="_blank" class="cafe-website">Visit Website</a>`
              : ""
          }
        </div>
        <div class="score">${Number(row.score).toFixed(1)}</div>
      `;
      container.appendChild(item);
    });
  }

  // ------- Rendering: Blog -------
  function renderBlog() {
    const container = document.getElementById("blog");
    if (!container) return;
    container.innerHTML = "";

    const sorted = state.reviews
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach((r) => {
      const post = document.createElement("div");
      post.className = "blog-post";

      const fullText = escapeHTML(r.review).replace(/\n/g, "<br>");
      const previewLimit = 300;
      const isLong = fullText.length > previewLimit;
      const previewText = isLong ? fullText.slice(0, previewLimit) + "..." : fullText;

      const linksMarkup =
        r.links &&
        (r.links.website || r.links.instagram || r.links.facebook)
          ? `
            <div style="margin-top:0.75rem">
              ${r.links.website ? `<a href="${r.links.website}" target="_blank" class="cafe-website" style="margin-right:0.75rem">Website</a>` : ""}
              ${r.links.instagram ? `<a href="${r.links.instagram}" target="_blank" class="cafe-website" style="margin-right:0.75rem">Instagram</a>` : ""}
              ${r.links.facebook ? `<a href="${r.links.facebook}" target="_blank" class="cafe-website">Facebook</a>` : ""}
            </div>
          `
          : "";

      post.innerHTML = `
        <div class="blog-date">${formatNZDate(r.date)}</div>
        <div class="blog-title">New Review: ${escapeHTML(r.cafe)} — ${escapeHTML(r.location)}</div>
        <div class="blog-content">
          <p class="review-text">${previewText}</p>
          ${
            isLong
              ? `<button class="see-more-btn">See more</button>`
              : ""
          }
          <p style="margin-top:0.75rem"><strong>Score:</strong> ${Number(r.score).toFixed(1)}/10</p>
          ${linksMarkup}
        </div>
      `;

      container.appendChild(post);

      if (isLong) {
        const btn = post.querySelector(".see-more-btn");
        const textEl = post.querySelector(".review-text");
        btn.addEventListener("click", () => {
          if (btn.textContent === "See more") {
            textEl.innerHTML = fullText;
            btn.textContent = "See less";
          } else {
            textEl.innerHTML = previewText;
            btn.textContent = "See more";
          }
        });
      }
    });
  } 

  // ------- Smooth scrolling for in-page links -------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ------- Modal (session-only add for previewing) -------
  window.openModal = function () {
    const m = document.getElementById("reviewModal");
    if (m) m.style.display = "block";
  };

  window.closeModal = function () {
    const m = document.getElementById("reviewModal");
    const f = document.getElementById("reviewForm");
    if (m) m.style.display = "none";
    if (f) f.reset();
  };

  window.addEventListener("click", (ev) => {
    const m = document.getElementById("reviewModal");
    if (ev.target === m) window.closeModal();
  });

  const form = document.getElementById("reviewForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const newReview = {
        id: `local-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        cafe: fd.get("cafeName") || "",
        location: fd.get("location") || "",
        links: {
          website: fd.get("website") || ""
        },
        review: fd.get("review") || "",
        score: Number(fd.get("score"))
      };
      state.reviews.push(newReview);
      renderLeaderboard();
      renderBlog();
      window.closeModal();
      alert("Review added locally (preview). To make it permanent, add it to /data/reviews.js and push to GitHub.");
    });
  }

  // ------- Map Rendering -------
  function renderMap() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // Initialise map
    const map = L.map("map").setView([-41.2865, 174.7762], 5); // Center on NZ

    // Tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Loop through each review and place a marker
    state.reviews.forEach(r => {
      if (r.lat && r.lng) {
        L.marker([r.lat, r.lng])
          .addTo(map)
          .bindPopup(
            `<strong>${r.cafe}</strong><br>${r.location}<br>Score: ${r.score}/10`
          );
      }
    });

    // Fix for blank/blue map issue
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
  }


  // ------- Initial render -------
  renderLeaderboard();
  renderBlog();
  renderMap();



})();
