let participantInfo = null;

let trialStarted = false;     // hide steps until form is filled

// ===== State =====
let currentStep = 1;

// Apple shape control points (local coordinates, roughly centered)
let geometricPoints = [];

// For symmetry mapping (pairs of left/right indices)
const symmetryPairs = [
  [0, 6],  // left upper side ↔ right upper side
  [1, 5],  // upper-left lobe ↔ upper-right lobe
  [2, 4],  // left top lobe ↔ right top lobe
  [11, 7], // left lower side ↔ right lower side
  [10, 8]  // bottom-left bulge ↔ bottom-right bulge
];
// center-line points are indices 3 (top notch) and 9 (bottom center)

// Graphics buffers for color masking in Step 3
let appleMaskG = null;
let appleColorG = null;

// ===== Global helpers for messages + screen switching =====
function setMessage(msg) {
  var messageEl = document.getElementById("message");
  if (messageEl) {
    messageEl.textContent = msg || "";
  }
}

function showResultScreen() {
  console.log("showResultScreen called");

  var trialScreen  = document.getElementById("trialScreen");
  var resultScreen = document.getElementById("resultScreen");
  var generatedImageContainer = document.getElementById("generatedImageContainer");

  if (trialScreen) {
    trialScreen.style.display = "none";
    console.log("trialScreen hidden");
  }
  if (resultScreen) {
    resultScreen.style.display = "block";
    console.log("resultScreen shown");
  }

  // hide image container until imageApi.js finishes
  if (generatedImageContainer) {
    generatedImageContainer.style.display = "none";
  }

  // optional: clear old message
  setMessage("");
}

// Make them available to imageApi.js if it uses window.*
window.setMessage = setMessage;
window.showResultScreen = showResultScreen;


function setup() {
  const container = document.getElementById("canvasContainer");
  const canvas = createCanvas(700, 500);
  canvas.parent(container);
  pixelDensity(1);
  angleMode(RADIANS);
  noLoop(); // no continuous animation

  // Base outline for the apple – local coords
  geometricPoints = [
    { x: -125, y:  20 },  // left upper side
    { x: -100, y: -50 },  // upper-left lobe
    { x:  -45, y: -75 },  // left top lobe
    { x:    0, y: -60 },  // top notch / dip
    { x:   45, y: -75 },  // right top lobe
    { x:  100, y: -50 },  // upper-right lobe
    { x:  125, y:  20 },  // right upper side
    { x:   95, y:  90 },  // right lower side
    { x:   40, y: 135 },  // bottom-right bulge
    { x:    0, y: 120 },  // bottom center
    { x:  -40, y: 135 },  // bottom-left bulge
    { x:  -95, y:  90 }   // left lower side
  ];

  setupStepNavigation();
  setupDemographicUI(); 
  setupSliderRedraw();
  redraw();
}


function setupDemographicUI() {
  const startBtn = document.getElementById("btnDemoStart");
  if (!startBtn) return;

  startBtn.addEventListener("click", function () {
    console.log("Start button clicked");
    const age    = document.getElementById("ageRange").value;
    const gender = document.getElementById("gender").value;
    const edu    = document.getElementById("eduBackground").value;

    if (!age || !gender || !edu) {
      alert("Please complete all fields before starting.");
      return;
    }

    participantInfo = {
      ageRange: age,
      gender: gender,
      eduBackground: edu,
      startedAt: new Date().toISOString()
    };

    console.log("Participant info:", participantInfo);

    trialStarted = true;
    currentStep = 1; 

    // Hide demographic screen, show trial screen
    document.getElementById("demoScreen").style.display  = "none";
    document.getElementById("trialScreen").style.display = "block";

    // Make sure the canvas is visible (it was already created in setup)
    redraw();
  });
}


function draw() {
  background(17);

  const params = readCurrentParameters();
  updateValueLabels(params);

  if (currentStep === 1) {
    drawStrokePreview(params);
  } else if (currentStep === 2) {
    drawApple(params, false); // neutral fill
  } else if (currentStep === 3) {
    drawApple(params, true);  // colored strips
  }
}

// =====================
// Parameter handling
// =====================

function readCurrentParameters() {
  // Step 1 – stroke
  const strokeThickness  = getSliderValue("strokeThickness");
  const strokeCoarseness = getSliderValue("strokeCoarseness");      // 0–100
  const strokeWiggle     = getSliderValue("strokeWiggle") / 100.0;  // 0–1

  // Step 2 – geometry
  const appleMorph    = getSliderValue("appleMorph") / 100.0;       // bumpiness
  const appleRigidity = getSliderValue("appleRigidity") / 100.0;    // 0 soft, 1 rigid
  const appleSymmetry = getSliderValue("appleSymmetry") / 100.0;    // 0 asym, 1 sym

  // Step 3 – color palette
  const colorTone       = getSliderValue("colorTone") / 100.0;       // 0 warm (red), 1 cold (blue)
  const colorSaturation = getSliderValue("colorSaturation") / 100.0; // 0–1
  const colorVariation  = getSliderValue("colorVariation") / 100.0;  // 0–1
  const colorBrightness = getSliderValue("colorBrightness") / 100.0; // 0–1

  return {
    strokeThickness,
    strokeCoarseness,
    strokeWiggle,

    appleMorph,
    appleRigidity,
    appleSymmetry,

    colorTone,
    colorSaturation,
    colorVariation,
    colorBrightness
  };
}

function getSliderValue(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value);
}

function updateValueLabels(p) {
  // Step 1
  setText("val_strokeThickness", p.strokeThickness.toFixed(1));
  setText("val_strokeCoarseness", p.strokeCoarseness.toFixed(1));
  setText("val_strokeWiggle", p.strokeWiggle.toFixed(2));

  // Step 2
  setText("val_appleMorph", p.appleMorph.toFixed(2));
  setText("val_appleRigidity", p.appleRigidity.toFixed(2));
  setText("val_appleSymmetry", p.appleSymmetry.toFixed(2));

  // Step 3
  setText("val_colorTone", (p.colorTone * 100).toFixed(0));
  setText("val_colorSaturation", (p.colorSaturation * 100).toFixed(0));
  setText("val_colorVariation", (p.colorVariation * 100).toFixed(0));
  setText("val_colorBrightness", (p.colorBrightness * 100).toFixed(0));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setupSliderRedraw() {
  const sliderIds = [
    "strokeThickness",
    "strokeCoarseness",
    "strokeWiggle",
    "appleMorph",
    "appleRigidity",
    "appleSymmetry",
    "colorTone",
    "colorSaturation",
    "colorVariation",
    "colorBrightness"
  ];
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", function() {
        redraw();
      });
    }
  });
}

// =====================
// Shared stroke renderer
// =====================
function drawStyledStroke(pathPts, params, isClosed) {
  const coarse01 = constrain(params.strokeCoarseness / 100.0, 0, 1);
  const thickness = params.strokeThickness;
  const radius = thickness / 2;

  const nPts = pathPts.length;
  if (nPts < 2) return;

  noStroke();
  fill(245);

  const densityPerPixel = 1.0 - coarse01;
  const segCount = isClosed ? nPts : nPts - 1;

  for (let i = 0; i < segCount; i++) {
    const p1 = pathPts[i];
    const p2 = pathPts[(i + 1) % nPts];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    let nDots = Math.floor(20 * len * densityPerPixel);
    if (nDots < 1) nDots = 1;

    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;

    for (let k = 0; k < nDots; k++) {
      const s = random();
      const cx = p1.x + dx * s;
      const cy = p1.y + dy * s;

      const normalOffset = (random() - 0.5) * 2 * radius;
      const alongJitter = (random() - 0.5) * radius * 0.9;

      const px = cx + nx * normalOffset + tx * alongJitter;
      const py = cy + ny * normalOffset + ty * alongJitter;

      const dotSize = max(1, radius * 0.15 + random() * radius * 0.15);
      ellipse(px, py, dotSize, dotSize);
    }
  }
}

// =====================
// Stroke preview (Step 1)
// =====================
function drawStrokePreview(params) {
  const segments = 200;
  const marginX = width * 0.15;
  const x0 = marginX;
  const x1 = width - marginX;
  const yBase = height / 2;

  const pathPts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = lerp(x0, x1, t);
    let y = yBase;

    if (params.strokeWiggle > 0) {
      const freq = 1 + params.strokeWiggle * 30;
      y += sin(t * PI * freq) * params.strokeWiggle * 2;
    }

    pathPts.push({ x, y });
  }

  drawStyledStroke(pathPts, params, false);
}

// =====================
// Apple geometry (Step 2 & 3)
// =====================
function drawApple(params, useColor) {
  // 1) base points in LOCAL space
  let ptsLocal = geometricPoints.map(p => ({ x: p.x, y: p.y }));

  // 2) bumpiness, symmetry, rigidity (still in local space)
  ptsLocal = applyBumpiness(ptsLocal, params.appleMorph);
  ptsLocal = applySymmetry(ptsLocal, params.appleSymmetry);
  ptsLocal = applyRigidity(ptsLocal, params.appleRigidity);

  // 3) recenter local shape to (0,0)
  let cx = 0, cy = 0;
  for (let i = 0; i < ptsLocal.length; i++) {
    cx += ptsLocal[i].x;
    cy += ptsLocal[i].y;
  }
  cx /= ptsLocal.length;
  cy /= ptsLocal.length;
  for (let i = 0; i < ptsLocal.length; i++) {
    ptsLocal[i].x -= cx;
    ptsLocal[i].y -= cy;
  }

  // 4) convert to CANVAS coordinates (center at width/2, height/2)
  const ptsCanvas = ptsLocal.map(p => ({
    x: p.x + width / 2,
    y: p.y + height / 2
  }));

  // ---- FILL ----
  if (useColor) {
    drawStripedFill(ptsCanvas, params);   // 5 colored strips
  } else {
    drawNeutralFill(ptsCanvas);          // neutral transparent fill
  }

  // ---- OUTLINE (pencil stroke) ----
  const pathPts = [];
  for (let i = 0; i < ptsCanvas.length; i++) {
    const p = ptsCanvas[i];
    let x = p.x;
    let y = p.y;

    if (params.strokeWiggle > 0) {
      const angle = map(i, 0, ptsCanvas.length, 0, TWO_PI * (2 + params.strokeWiggle * 5));
      x += sin(angle) * params.strokeWiggle * 10;
      y += cos(angle) * params.strokeWiggle * 10;
    }
    pathPts.push({ x, y });
  }
  drawStyledStroke(pathPts, params, true);

  // ---- Stem: find top center in LOCAL space, then map to canvas ----
  const stemBaseLocal = findTopCenterOnOutline(ptsLocal);
  const stemBaseCanvas = {
    x: stemBaseLocal.x + width / 2,
    y: stemBaseLocal.y + height / 2
  };
  const stemLength = 40;
  const stemPath = [
    { x: stemBaseCanvas.x, y: stemBaseCanvas.y },
    { x: stemBaseCanvas.x, y: stemBaseCanvas.y - stemLength }
  ];
  drawStyledStroke(stemPath, params, false);
}

// ---- Fill helpers ----

// Neutral fill (same coords as outline)
function drawNeutralFill(ptsCanvas) {
  const fillCol = color(255, 255, 255, 0);
  noStroke();
  fill(fillCol);

  beginShape();
  for (let i = 0; i < ptsCanvas.length; i++) {
    const p = ptsCanvas[i];
    curveVertex(p.x, p.y);
  }
  const first = ptsCanvas[0];
  curveVertex(first.x, first.y);
  endShape(CLOSE);
}

// Colored fill with 5 horizontal strips, masked to the apple
function drawStripedFill(ptsCanvas, params) {
  if (!appleMaskG) {
    appleMaskG  = createGraphics(width, height);
    appleColorG = createGraphics(width, height);
  }

  // ---- Mask from apple outline ----
  appleMaskG.clear();
  appleMaskG.noStroke();
  appleMaskG.fill(255);

  appleMaskG.beginShape();
  for (let i = 0; i < ptsCanvas.length; i++) {
    const p = ptsCanvas[i];
    appleMaskG.curveVertex(p.x, p.y);
  }
  const f = ptsCanvas[0];
  appleMaskG.curveVertex(f.x, f.y);
  appleMaskG.endShape(CLOSE);

  // ---- Compute 5 strip colors from sliders ----
  const tone      = params.colorTone;        // warm → cold
  const satSlider = params.colorSaturation;  // 0–1
  const vari      = params.colorVariation;   // 0–1
  const briSlider = params.colorBrightness;  // 0–1

  const baseHue = lerp(0, 220, tone);
  const baseSat = lerp(10, 100, satSlider);
  const baseBri = lerp(20, 100, briSlider);

  const hueSpread = vari * 80;
  const briSpread = vari * 25;

  // ---- Vertical bounds of apple (in canvas coords) ----
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ptsCanvas.length; i++) {
    if (ptsCanvas[i].y < minY) minY = ptsCanvas[i].y;
    if (ptsCanvas[i].y > maxY) maxY = ptsCanvas[i].y;
  }
  const totalH = maxY - minY;

  // ---- Draw 5 strips ----
  appleColorG.clear();
  appleColorG.noStroke();
  appleColorG.colorMode(HSB, 360, 100, 100, 255);

  const nStrips = 5;
  for (let s = 0; s < nStrips; s++) {
    const offset = (s - (nStrips - 1) / 2) / ((nStrips - 1) / 2);

    let hue = baseHue + offset * hueSpread;
    hue = (hue % 360 + 360) % 360;

    let bri = baseBri - offset * briSpread;

    appleColorG.fill(hue, baseSat, bri, 255);

    const y0 = minY + (s / nStrips) * totalH;
    const y1 = minY + ((s + 1) / nStrips) * totalH;
    const stripH = y1 - y0;

    appleColorG.rect(0, y0, width, stripH);
  }

  appleColorG.colorMode(RGB);

  // ---- Mask color image with apple silhouette ----
  const img = appleColorG.get();
  const maskImg = appleMaskG.get();
  img.mask(maskImg);

  image(img, 0, 0);
}

// ---- Geometry modifiers ----

function applyBumpiness(pts, bumpiness) {
  if (bumpiness <= 0) {
    return pts.map(p => ({ x: p.x, y: p.y }));
  }

  const out = pts.map(p => ({ x: p.x, y: p.y }));
  const amp = bumpiness * 20;
  randomSeed(1000 + floor(bumpiness * 999));

  for (let i = 0; i < out.length; i++) {
    out[i].x += random(-amp, amp);
    out[i].y += random(-amp, amp);
  }
  return out;
}

function applySymmetry(pts, symmetry) {
  if (!symmetry || symmetry <= 0) {
    return pts.map(p => ({ x: p.x, y: p.y }));
  }

  const out = pts.map(p => ({ x: p.x, y: p.y }));

  for (let k = 0; k < symmetryPairs.length; k++) {
    const iL = symmetryPairs[k][0];
    const iR = symmetryPairs[k][1];

    const pL0 = pts[iL];
    const pR0 = pts[iR];

    const mag = (Math.abs(pL0.x) + Math.abs(pR0.x)) / 2;
    const yAvg = (pL0.y + pR0.y) / 2;

    const pL_sym = { x: -mag, y: yAvg };
    const pR_sym = { x:  mag, y: yAvg };

    out[iL].x = lerp(pL0.x, pL_sym.x, symmetry);
    out[iL].y = lerp(pL0.y, pL_sym.y, symmetry);

    out[iR].x = lerp(pR0.x, pR_sym.x, symmetry);
    out[iR].y = lerp(pR0.y, pR_sym.y, symmetry);
  }

  const centerIndices = [3, 9];
  for (let ci = 0; ci < centerIndices.length; ci++) {
    const idx = centerIndices[ci];
    if (idx < 0 || idx >= out.length) continue;

    const p0 = pts[idx];
    out[idx].x = lerp(p0.x, 0, symmetry);
    out[idx].y = p0.y;
  }

  return out;
}

function applyRigidity(pts, rigidity) {
  if (!rigidity || rigidity <= 0) {
    return pts.map(p => ({ x: p.x, y: p.y }));
  }

  const n = pts.length;
  const out = [];
  const maxRadius = 40;
  const globalD = rigidity * maxRadius;

  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const p = pts[i];
    const pNext = pts[(i + 1) % n];

    let vPrev = { x: pPrev.x - p.x, y: pPrev.y - p.y };
    let vNext = { x: pNext.x - p.x, y: pNext.y - p.y };

    const lenPrev = Math.sqrt(vPrev.x * vPrev.x + vPrev.y * vPrev.y);
    const lenNext = Math.sqrt(vNext.x * vNext.x + vNext.y * vNext.y);

    if (lenPrev < 1 || lenNext < 1) {
      out.push({ x: p.x, y: p.y });
      continue;
    }

    vPrev.x /= lenPrev; vPrev.y /= lenPrev;
    vNext.x /= lenNext; vNext.y /= lenNext;

    const localMax = Math.min(lenPrev, lenNext) / 3;
    const d = Math.min(globalD, localMax);

    if (d <= 0.0001) {
      out.push({ x: p.x, y: p.y });
      continue;
    }

    const pIn  = { x: p.x + vPrev.x * d, y: p.y + vPrev.y * d };
    const pOut = { x: p.x + vNext.x * d, y: p.y + vNext.y * d };

    out.push(pIn);
    out.push(pOut);
  }

  return out;
}

// Find topmost crossing of x=0 in LOCAL coordinates
function findTopCenterOnOutline(pts) {
  const n = pts.length;
  let bestPoint = null;
  let bestY = Infinity;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];

    if (p1.x === 0 && p2.x === 0) {
      const yTop = Math.min(p1.y, p2.y);
      if (yTop < bestY) {
        bestY = yTop;
        bestPoint = { x: 0, y: yTop };
      }
      continue;
    }

    if ((p1.x <= 0 && p2.x >= 0) || (p1.x >= 0 && p2.x <= 0)) {
      const t = (0 - p1.x) / (p2.x - p1.x);
      const y = p1.y + t * (p2.y - p1.y);
      if (y < bestY) {
        bestY = y;
        bestPoint = { x: 0, y };
      }
    }
  }

  if (!bestPoint) {
    bestPoint = { x: pts[0].x, y: pts[0].y };
    bestY = pts[0].y;
    for (let i = 1; i < n; i++) {
      if (pts[i].y < bestY) {
        bestY = pts[i].y;
        bestPoint = { x: pts[i].x, y: pts[i].y };
      }
    }
  }

  return bestPoint;
}

// =====================
// Step navigation
// =====================

function setupStepNavigation() {
  const btnBack = document.getElementById("btnBack");
  const btnNext = document.getElementById("btnNext");
  const stepIndicator = document.getElementById("stepIndicator");

  btnBack.addEventListener("click", function() {
    if (!trialStarted) return;
    if (currentStep > 1) {
      currentStep -= 1;
      updateStepUI();
    }
  });

  btnNext.addEventListener("click", function() {
    if (!trialStarted) return;

    if (currentStep < 3) {
      currentStep += 1;
      updateStepUI();
    } else {
      // Finalize & log AND trigger image generation
      const params = readCurrentParameters();
      console.log("Final parameters:", params);
      console.log("User participantInfo:", participantInfo);

      // Show a status message (this writes into the result screen's message element)
      setMessage(
          "Thank you! Your responses have been recorded. Here is the living room design that fits your taste..."
        );

      // 🔹 Switch from the sketch pad to the result screen
      showResultScreen();

      logTrial(participantInfo, params);
    }
  });

  function updateStepUI() {
    document.getElementById("step1Controls").style.display =
      currentStep === 1 ? "block" : "none";
    document.getElementById("step2Controls").style.display =
      currentStep === 2 ? "block" : "none";
    const s3 = document.getElementById("step3Controls");
    if (s3) s3.style.display = currentStep === 3 ? "block" : "none";

    btnBack.disabled = currentStep === 1;
    btnNext.textContent = currentStep === 3 ? "Finish" : "Next";

    if (stepIndicator) {
      if (currentStep === 1) {
        stepIndicator.textContent = "Step 1 / 3: Stroke Character";
      } else if (currentStep === 2) {
        stepIndicator.textContent = "Step 2 / 3: Apple Geometry";
      } else {
        stepIndicator.textContent = "Step 3 / 3: Color Palette";
      }
    }

    redraw();
  }

  updateStepUI();
}


function logTrial(meta, params) {
  // params = { strokeThickness, strokeCoarseness, strokeWiggle, ... }
  var promptInfo = generatePromptFromRawParams(params);
  // promptInfo = { normalizedParams, S_score, styleName, promptText }

  var payload = {
    participantInfo: meta,
    parameters: params,
    S_score: promptInfo.S_score,
    style: promptInfo.styleName,
    prompt: promptInfo.promptText,
    timestamp: new Date().toISOString()
  };

  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbwLATZT4UPrNADe5y6Kh9yiTx3fFB6Gur86xW6cShQDfGMFpS4B9lyB9zX2hDTQpxTi0Q/exec";

  console.log("Posting to Google Script:", payload);

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(function () {
      console.log("Logging request sent (no-cors).");
    })
    .catch(function (err) {
      console.error("Logging error:", err);
    });

  // Now call the global function from imageApi.js
  generateInteriorFromPrompt(promptInfo.promptText);
}











