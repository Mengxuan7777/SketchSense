// ==============================
// promptUtils.js
// Centralized style + prompt engine
// ==============================
(function () {
  // Path to your JSON library (adjust if needed)
  var STYLE_LIBRARY_URL = "interior_style_library.json";

  // 10 standardized parameters for the prompt engine
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

  // This will be filled once the JSON is loaded
  var STYLE_LIBRARY = null;
  var styleLibraryLoaded = false;
  var styleLibraryError = null;

  // ==============================
  // Load style library JSON
  // ==============================
  function loadStyleLibrary() {
    fetch(STYLE_LIBRARY_URL)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        STYLE_LIBRARY = data;
        styleLibraryLoaded = true;
        console.log("STYLE_LIBRARY loaded:", STYLE_LIBRARY);
      })
      .catch(function (err) {
        styleLibraryError = err;
        console.error("Error loading style library:", err);
      });
  }

  // Start loading as soon as this file loads
  loadStyleLibrary();

  // ==============================
  // Helper: map numeric 0–1 → range label
  // ==============================
  function valueToRange(value) {
    if (value <= 0.3) {
      return "0-0.3";
    }
    if (value <= 0.7) {
      return "0.4-0.7";
    }
    return "0.8-1";
  }

  // ==============================
  // Normalize raw sketch params → standard prompt params
  // rawParams is the object from sketch.js:
  // {
  //   strokeThickness, strokeCoarseness, strokeWiggle,
  //   appleMorph, appleRigidity, appleSymmetry,
  //   colorTone, colorSaturation, colorVariation, colorBrightness
  // }
  // ==============================
  function normalizeParameters(raw) {
    // Guard against missing object
    if (!raw) {
      raw = {};
    }

    // strokeThickness / strokeCoarseness: 0–100 sliders
    // strokeWiggle: already 0–1 in your code
    // apple*, color*: already 0–1

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

      // "uniform": 0 = uniform color, 1 = diverse color.
      // Using colorVariation slider as this dimension.
      uniform: typeof raw.colorVariation === "number" ? raw.colorVariation : 0
    };

    // Clamp to [0,1] just to be safe
    PARAM_KEYS.forEach(function (key) {
      var v = normalized[key];
      if (v < 0) {
        v = 0;
      }
      if (v > 1) {
        v = 1;
      }
      normalized[key] = v;
    });

    return normalized;
  }

  // ==============================
  // Compute S-score (average of all 10 parameters)
  // ==============================
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

    if (count === 0) {
      return 0.5;
    }
    return sum / count; // S in [0,1]
  }

  // ==============================
  // Select style from S-score
  // 5 bands, each with 2 styles (as we planned)
// 0.00–0.20 → Ultra Minimal + Scandinavian
// 0.20–0.40 → Japandi + Contemporary Soft-Neutral
// 0.40–0.60 → Mid-Century Modern + Modern Farmhouse
// 0.60–0.80 → Industrial Loft + Rustic Cabin
// 0.80–1.00 → Eclectic Boho + Art Deco Luxury
  // ==============================
  function selectStyleFromS(S) {
    var r = Math.random(); // for choosing between the two in each band

    if (S < 0.2) {
      return r < 0.5 ? "Ultra Minimal" : "Scandinavian";
    } else if (S < 0.4) {
      return r < 0.5 ? "Japandi" : "Contemporary Soft-Neutral";
    } else if (S < 0.6) {
      return r < 0.5 ? "Mid-Century Modern" : "Modern Farmhouse";
    } else if (S < 0.8) {
      return r < 0.5 ? "Industrial Loft" : "Rustic Cabin";
    } else {
      return r < 0.5 ? "Eclectic Boho" : "Art Deco Luxury";
    }
  }

  // ==============================
  // Build final English prompt from style + normalized params
  // ==============================
  function buildInteriorPrompt(styleName, params) {
    // If style library is not yet loaded, return a generic prompt
    if (!STYLE_LIBRARY || !STYLE_LIBRARY[styleName]) {
      console.warn("STYLE_LIBRARY not ready or style not found, using generic prompt:", styleName);

      return (
        "Generate an interior living room in the " +
        styleName +
        " style. Use materials, spatial organization, and colors that match the user's preferences " +
        "in texture, structure, and color mood. The design should be cohesive and clearly express the inferred style."
      );
    }

    var styleBlock = STYLE_LIBRARY[styleName];

    var materialDescriptions = [];
    var layoutDescriptions = [];
    var colorDescriptions = [];

    PARAM_KEYS.forEach(function (key) {
      var value = params[key];
      if (typeof value !== "number") {
        return;
      }

      var range = valueToRange(value);
      var paramBlock = styleBlock[key] || {};
      var desc = paramBlock[range];

      if (!desc) {
        desc =
          "In " +
          styleName +
          " style, the parameter '" +
          key +
          "' is interpreted in range " +
          range +
          ".";
      }

      if (
        key === "thickness" ||
        key === "coarseness" ||
        key === "wiggleness"
      ) {
        materialDescriptions.push(desc);
      } else if (
        key === "bumpiness" ||
        key === "rigidity" ||
        key === "symmetry"
      ) {
        layoutDescriptions.push(desc);
      } else {
        // tone, saturation, brightness, uniform
        colorDescriptions.push(desc);
      }
    });

    var materialText = materialDescriptions.join(" ");
    var layoutText = layoutDescriptions.join(" ");
    var colorText = colorDescriptions.join(" ");

    var prompt =
      "Generate an interior living room in the " +
      styleName +
      " style. " +
      "Materials: " +
      materialText +
      " " +
      "Spatial organization and décor: " +
      layoutText +
      " " +
      "Color palette and atmosphere: " +
      colorText +
      " " +
      "Make sure the design clearly reflects these material, layout, and color characteristics and stays coherent and livable.";

    return prompt;
  }

  // ==============================
  // Public API: given raw sketch params → full prompt info
  // ==============================
  function generatePromptFromRawParams(rawParams) {
    var normalized = normalizeParameters(rawParams);
    var S = computeS(normalized);
    var styleName = selectStyleFromS(S);
    var promptText = buildInteriorPrompt(styleName, normalized);

    return {
      normalizedParams: normalized,
      S_score: S,
      styleName: styleName,
      promptText: promptText
    };
  }

  // Expose to global scope so sketch.js can call it
  window.generatePromptFromRawParams = generatePromptFromRawParams;
})();
