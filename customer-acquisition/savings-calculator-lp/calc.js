// ─── HomeDirectAI Savings Calculator ────────────────────────────────────────

(function () {
  'use strict';

  const RATES = {
    traditional: 0.054,
    redfin:      0.015,
    houzeo:      0.0125,
    hdai:        0.01,
  };

  // ── Formatting helpers ──────────────────────────────────────────────────

  function fmtDollar(n) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);
  }

  function fmtInt(n) {
    return new Intl.NumberFormat('en-US').format(Math.floor(n));
  }

  // ── Animated counter ────────────────────────────────────────────────────

  const running = new Map();

  function animateTo(el, target, isMoney) {
    const key = el;
    if (running.has(key)) cancelAnimationFrame(running.get(key));

    const rawStart = parseFloat((el.dataset.current || '0').replace(/[^0-9.-]/g, ''));
    el.dataset.current = target;

    const start = rawStart;
    const end = target;
    const duration = 500;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(start + (end - start) * eased);
      el.textContent = isMoney ? fmtDollar(value) : fmtInt(value);
      if (progress < 1) {
        running.set(key, requestAnimationFrame(step));
      } else {
        running.delete(key);
      }
    }

    running.set(key, requestAnimationFrame(step));
  }

  // ── Slider fill ─────────────────────────────────────────────────────────

  function updateSliderFill(input) {
    const min = +input.min;
    const max = +input.max;
    const val = +input.value;
    const pct = ((val - min) / (max - min)) * 100;
    input.style.backgroundSize = pct + '% 100%';
  }

  // ── Core update ─────────────────────────────────────────────────────────

  function update(homeValue) {
    const fees = {
      traditional: Math.round(homeValue * RATES.traditional),
      redfin:      Math.round(homeValue * RATES.redfin),
      houzeo:      Math.round(homeValue * RATES.houzeo),
      hdai:        Math.round(homeValue * RATES.hdai),
    };
    const savings = fees.traditional - fees.hdai;

    // home value display
    const hvDisplay = document.getElementById('homeValueDisplay');
    if (hvDisplay) hvDisplay.textContent = fmtDollar(homeValue);

    // savings hero
    const savingsAmount = document.getElementById('savingsAmount');
    const savingsSub    = document.getElementById('savingsSub');
    if (savingsAmount) animateTo(savingsAmount, savings, true);
    if (savingsSub) {
      savingsSub.textContent =
        `That's ${fmtDollar(fees.traditional)} in traditional fees vs. ${fmtDollar(fees.hdai)} with HomeDirectAI`;
    }

    // bar chart
    const maxFee = fees.traditional;
    const barConfig = [
      { key: 'traditional', minPct: 100 },
      { key: 'redfin',      minPct: 3 },
      { key: 'houzeo',      minPct: 3 },
      { key: 'hdai',        minPct: 3 },
    ];
    barConfig.forEach(({ key, minPct }) => {
      const feeEl  = document.getElementById('fee-' + key);
      const barEl  = document.getElementById('bar-' + key);
      const fee    = fees[key];
      const pct    = Math.max((fee / maxFee) * 100, minPct);
      if (feeEl) animateTo(feeEl, fee, true);
      if (barEl) barEl.style.width = pct + '%';
    });

    // breakdown grid
    const bdSavings     = document.getElementById('bd-savings');
    const bdHdai        = document.getElementById('bd-hdai');
    const bdTraditional = document.getElementById('bd-traditional');
    const bdTours       = document.getElementById('bd-tours');
    if (bdSavings)     animateTo(bdSavings, savings, true);
    if (bdHdai)        { bdHdai.dataset.current = fees.hdai; bdHdai.textContent = '−' + fmtDollar(fees.hdai); }
    if (bdTraditional) { bdTraditional.dataset.current = fees.traditional; bdTraditional.textContent = '−' + fmtDollar(fees.traditional); }
    if (bdTours)       animateTo(bdTours, Math.floor(savings / 20), false);

    // final CTA
    const ctaSavings = document.getElementById('cta-savings');
    if (ctaSavings) animateTo(ctaSavings, savings, true);

    // update CTA subtext
    const ctaSub = document.querySelector('.final-cta__sub');
    if (ctaSub) {
      ctaSub.innerHTML = `AI handles negotiations, documents, and closing — on a ${fmtDollar(homeValue)} Tampa Bay home,
        that's <strong>${fmtDollar(savings)}</strong> back in your pocket. Pay 1% only when the deal closes.`;
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    const slider  = document.getElementById('homeValue');
    const presets = document.querySelectorAll('.preset');

    if (!slider) return;

    // Set initial slider fill
    updateSliderFill(slider);

    // Slider input
    slider.addEventListener('input', function () {
      const val = +this.value;
      updateSliderFill(this);

      // Sync preset active state
      presets.forEach(p => {
        p.classList.toggle('preset--active', +p.dataset.value === val);
      });

      update(val);
    });

    // Preset buttons
    presets.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const val = +this.dataset.value;
        slider.value = val;
        updateSliderFill(slider);

        presets.forEach(p => p.classList.remove('preset--active'));
        this.classList.add('preset--active');

        update(val);
      });
    });

    // Initialize with default value
    update(+slider.value);
  });

})();
