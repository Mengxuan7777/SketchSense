// ==============================
// promptUtils.js
// Frontend param normalization + style selection + backend call
// ==============================
(function () {
  var PARAM_KEYS = [
    "thickness",
    "coarseness",
    "wiggleness",
    "bumpiness",
    "rigidity",
    "symmetry",
    "tone",
    "saturation",
    "brightness",
    "uniform"
  ];

  function normalizeParameters(raw) {
    if (!raw) raw = {};

    var normalized = {
      thickness: (raw.strokeThickness || 0) / 100.0,
      coarseness: (raw.strokeCoarseness || 0) / 100.0,
      wiggleness: typeof raw.strokeWiggle === "number" ? raw.strokeWiggle : 0,

      bumpiness: typeof raw.appleMorph === "number" ? raw.appleMorph : 0,
      rigidity: typeof raw.appleRigidity === "number" ? raw.appleRigidity : 0,
      symmetry: typeof raw.appleSymmetry === "number" ? raw.appleSymmetry : 0,

      tone: typeof raw.colorTone === "number" ? raw.colorTone : 0,
      saturation: typeof raw.colorSaturation === "number" ? raw.colorSaturation : 0,
      brightness: typeof raw.colorBrightness === "number" ? raw.colorBrightness : 0,

      uniform: typeof raw.colorVariation === "number" ? raw.colorVariation : 0
    };

    PARAM_KEYS.forEach(function (key) {
      var v = normalized[key];
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      normalized[key] = v;
    });

    return normalized;
  }

  function computeS(params) {
    var sum = 0;
    var count = 0;

    PARAM_KEYS.forEach(function (key) {
      var v = params[key];
      if (typeof v === "number") {
        sum += v;
        count += 1;
      }
    });

    if (count === 0) return 0.5;
    return sum / count;
  }

  function getStylePairFromS(S) {
    // Return both styles for the S-score band
    if (S < 0.2) return ["Ultra Minimal", "Scandinavian"];
    if (S < 0.4) return ["Japandi", "Contemporary Calm"];
    if (S < 0.6) return ["Retro modern", "Timeless Farmhouse"];
    if (S < 0.8) return ["Vintage Industrial", "Cabin Chic"];
    return ["Eclectic Boho", "Modern Deco"];
  }

  // Call Flask endpoint to generate image with user's chosen style
  function generateWithBackend(styleName, normalizedParams, scene) {
    var payload = {
      style: styleName,
      params: normalizedParams,
      scene: scene || {}
    };

    return fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = data && data.error ? data.error : "Request failed.";
          throw new Error(msg);
        }
        return data;
      });
    });
  }

  // Export public API
  window.getStylePairFromS = getStylePairFromS;
  window.computeS = computeS;
  window.normalizeParameters = normalizeParameters;
  window.generateWithBackend = generateWithBackend;
})();
