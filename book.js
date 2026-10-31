(() => {
  const sheets = Array.from(document.querySelectorAll(".sheet"));
  const total = sheets.length;
  if (total === 0) return;

  const titleEl = document.getElementById("page-title");
  const countEl = document.getElementById("page-count");
  const bar = document.getElementById("bar");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const stage = document.getElementById("stage");

  let index = 0;

  const render = (pushHash) => {
    sheets.forEach((sheet, i) => {
      const active = i === index;
      sheet.hidden = !active;
      sheet.classList.toggle("is-active", active);
    });

    titleEl.textContent = sheets[index].dataset.title || "";
    countEl.textContent = `${index + 1} / ${total}`;
    bar.style.width = `${((index + 1) / total) * 100}%`;
    prev.disabled = index === 0;
    next.disabled = index === total - 1;

    if (pushHash) history.replaceState(null, "", `#${index + 1}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const go = (nextIndex) => {
    index = Math.max(0, Math.min(total - 1, nextIndex));
    render(true);
  };

  prev.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      go(index + 1);
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      go(index - 1);
    }
  });

  let startX = null;
  stage.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0].clientX;
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchend",
    (event) => {
      if (startX === null) return;
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 50) go(index + (delta < 0 ? 1 : -1));
      startX = null;
    },
    { passive: true }
  );

  const fromHash = Number.parseInt(window.location.hash.replace("#", ""), 10);
  index = Number.isFinite(fromHash)
    ? Math.max(0, Math.min(total - 1, fromHash - 1))
    : 0;
  render(false);
})();
