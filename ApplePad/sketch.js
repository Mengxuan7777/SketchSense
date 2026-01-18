let participantInfo = null;

let trialStarted = false;     // hide steps until form is filled
let isRefinementMode = false; // track if in refinement mode

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
  // Handle launch screen "OK" button
  const launchBtn = document.getElementById("btnLaunchOk");
  if (launchBtn) {
    launchBtn.addEventListener("click", function () {
      document.getElementById("launchScreen").style.display = "none";
      document.getElementById("demoScreen").style.display = "block";
    });
  }

  const startBtn = document.getElementById("btnDemoStart");
  if (!startBtn) return;

  startBtn.addEventListener("click", function () {
    console.log("Start button clicked");
    const username = document.getElementById("username").value;
    const age    = document.getElementById("ageRange").value;
    const gender = document.getElementById("gender").value;
    const edu    = document.getElementById("eduBackground").value;

    if (!username || !age || !gender || !edu) {
      alert("Please complete all fields before starting.");
      return;
    }

    participantInfo = {
      username: username,
      ageRange: age,
      gender: gender,
      eduBackground: edu,
      startedAt: new Date().toISOString()
    };

    console.log("Participant info:", participantInfo);

    // Hide demographic screen, show tag selection screen
    document.getElementById("demoScreen").style.display  = "none";
    document.getElementById("tagScreen").style.display = "block";
  });

  // Handle tag selection "Continue" button
  const tagContinueBtn = document.getElementById("btnTagContinue");
  if (tagContinueBtn) {
    tagContinueBtn.addEventListener("click", function () {
      const checkboxes = document.querySelectorAll(".preference-tag:checked");
      const selectedTags = Array.from(checkboxes).map(cb => cb.value);
      const styleUnclear = document.getElementById("styleUnclear").checked;

      if (!styleUnclear && selectedTags.length !== 2) {
        alert("Please select exactly 2 styles before continuing, or check the option if the styles are unclear.");
        return;
      }

      // Add selected tags to participant info
      participantInfo.selectedTags = selectedTags;
      participantInfo.styleUnclear = styleUnclear;
      console.log("Selected tags:", selectedTags);
      console.log("Style unclear:", styleUnclear);

      trialStarted = true;
      currentStep = 1;

      // Hide tag screen, show trial screen
      document.getElementById("tagScreen").style.display = "none";
      document.getElementById("trialScreen").style.display = "block";

      // Make sure the canvas is visible
      redraw();
    });
  }
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

function updateStepUI() {
  const btnBack = document.getElementById("btnBack");
  const btnNext = document.getElementById("btnNext");
  const stepIndicator = document.getElementById("stepIndicator");
  
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
    if (isRefinementMode) return; // Don't process in refinement mode

    if (currentStep < 3) {
      currentStep += 1;
      updateStepUI();
    } else {
      // Finalize & show style choice screen
      const params = readCurrentParameters();
      console.log("Final parameters:", params);
      console.log("User participantInfo:", participantInfo);

      // Calculate S-score and get style pair
      const normalized = normalizeParameters(params);
      const S = computeS(normalized);
      const stylePair = getStylePairFromS(S);

      // Store params for later use
      window.currentSketchParams = params;
      window.currentNormalized = normalized;
      window.currentSScore = S;
      window.currentStylePair = stylePair;

      // Hide trial screen, show style choice screen
      document.getElementById("trialScreen").style.display = "none";
      document.getElementById("styleChoiceScreen").style.display = "block";

      // Populate style options
      document.getElementById("styleName1").textContent = stylePair[0];
      document.getElementById("styleName2").textContent = stylePair[1];
      
      // Set example images from static folder
      const styleImageMap = {
        "Ultra Minimal": "/static/ultra minimal.png",
        "Scandinavian": "/static/Scandinavian.png",
        "Japandi": "/static/japandi.png",
        "Contemporary Calm": "/static/Contemporary Calm.png",
        "Retro modern": "/static/Retro Modern.png",
        "Timeless Farmhouse": "/static/Timeless Farmhouse.png",
        "Vintage Industrial": "/static/Vintage Industrial.png",
        "Cabin Chic": "/static/Cabin Chic.png",
        "Eclectic Boho": "/static/Eclectic Boho.png",
        "Modern Deco": "/static/Modern Deco.png"
      };
      
      document.getElementById("styleImage1").src = styleImageMap[stylePair[0]];
      document.getElementById("styleImage2").src = styleImageMap[stylePair[1]];
      
      // Add simple descriptions (you can enhance these)
      const styleDescriptions = {
        "Ultra Minimal": "Gallery-like calm with precise detailing and high negative space",
        "Scandinavian": "Nordic simplicity with light woods and functional comfort",
        "Japandi": "Calm minimalism with natural materials and quiet elegance",
        "Contemporary Calm": "Clean modern comfort with warm neutrals and relaxed sophistication",
        "Retro modern": "Retro modern with organic geometry and graphic accents",
        "Timeless Farmhouse": "Cozy rustic-modern with shiplap warmth and family-friendly comfort",
        "Vintage Industrial": "Urban raw with exposed structure and warehouse aesthetic",
        "Cabin Chic": "Cozy lodge with natural wood and warm grounded feel",
        "Eclectic Boho": "Collected and layered with artisan textiles and global influences",
        "Modern Deco": "Glamorous with geometric elegance and high contrast"
      };
      
      document.getElementById("styleDesc1").textContent = styleDescriptions[stylePair[0]] || "";
      document.getElementById("styleDesc2").textContent = styleDescriptions[stylePair[1]] || "";

      // Add click handlers for style selection
      setupStyleChoiceHandlers();
    }
  });

  function setupStyleChoiceHandlers() {
    const option1 = document.getElementById("styleOption1");
    const option2 = document.getElementById("styleOption2");

    option1.onclick = function() {
      selectStyleAndGenerate(window.currentStylePair[0]);
    };

    option2.onclick = function() {
      selectStyleAndGenerate(window.currentStylePair[1]);
    };
  }

  function selectStyleAndGenerate(chosenStyle) {
    console.log("User chose style:", chosenStyle);
    
    // Add chosen style to participant info
    participantInfo.chosenStyle = chosenStyle;
    participantInfo.S_score = window.currentSScore;
    participantInfo.stylePair = window.currentStylePair;

    // Show result screen and start generation
    document.getElementById("styleChoiceScreen").style.display = "none";
    showResultScreen();

    setMessage(
      "Thank you! Generating your personalized " + chosenStyle + " living room design..."
    );

    // Log to Google Sheets
    logTrial(participantInfo, window.currentSketchParams, chosenStyle);
  }

  updateStepUI();
}


// Store trial data globally for final submission
let trialData = null;

function logTrial(meta, params, chosenStyle) {
  // Normalize params
  const normalized = normalizeParameters(params);
  const S = computeS(normalized);

  // Store data for later submission with evaluation
  trialData = {
    participantInfo: meta,
    parameters: params,
    normalizedParams: normalized,
    S_score: S,
    stylePair: window.currentStylePair,
    chosenStyle: chosenStyle,
    styleChoiceTimestamp: new Date().toISOString(),
    generatedText: null,
    generatedImageSuccess: false,
    evaluation: null,
    evaluationTimestamp: null
  };

  console.log("Trial data prepared (will submit after evaluation):", trialData);

  // Now call backend to generate image with chosen style
  generateWithBackend(chosenStyle, normalized, { roomType: "living room" })
    .then(function(data) {
      console.log("Generation response:", data);
      
      // Store in trial data
      if (trialData) {
        trialData.generatedText = data.result || null;
        trialData.generatedImageSuccess = !!data.image_base64;
        trialData.generationTimestamp = new Date().toISOString();
      }
      
      // Display the text description
      var descContainer = document.getElementById("generatedDescriptionContainer");
      var descEl = document.getElementById("generatedDescription");
      var btnReadMore = document.getElementById("btnReadMore");
      
      if (data.result && descEl) {
        descEl.textContent = data.result;
        if (descContainer) {
          descContainer.style.display = "block";
        }
        
        // Show read more button if text is long enough
        if (btnReadMore) {
          // Check if text is truncated (more than ~2 lines worth of text)
          if (data.result.length > 150) {
            btnReadMore.style.display = "inline-block";
            var isExpanded = false;
            
            btnReadMore.onclick = function() {
              if (isExpanded) {
                descEl.style.display = "-webkit-box";
                descEl.style.webkitLineClamp = "2";
                btnReadMore.textContent = "Read More";
              } else {
                descEl.style.display = "block";
                descEl.style.webkitLineClamp = "unset";
                btnReadMore.textContent = "Read Less";
              }
              isExpanded = !isExpanded;
            };
          }
        }
      }
      
      // Display the tags/resolved parameters with sliders
      var tagsContainer = document.getElementById("generatedTagsContainer");
      var tagsEl = document.getElementById("generatedTags");
      
      if (data.resolved && tagsEl && trialData) {
        var tagsHTML = "";
        var params = trialData.normalizedParams;
        
        // Define parameter order: stroke → geometry → color
        var paramOrder = [
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
        
        // Map parameter keys to display names (interior design terms)
        var paramLabels = {
          thickness: "Material Grain",
          coarseness: "Surface Finish",
          wiggleness: "Material Variation",
          bumpiness: "Decorative Intensity",
          rigidity: "Compositional Balance",
          symmetry: "Spatial Symetry",
          tone: "Color Temperature",
          saturation: "Color Intensity",
          brightness: "Luminosity Level",
          uniform: "Color Diversity"
        };
        
        // Iterate in the specified order
        for (var i = 0; i < paramOrder.length; i++) {
          var axis = paramOrder[i];
          if (data.resolved[axis]) {
            var label = paramLabels[axis] || (axis.charAt(0).toUpperCase() + axis.slice(1));
            var value = params[axis] || 0;
            var percentage = Math.round(value * 100);
            
            tagsHTML += "<div style='margin-bottom: 12px;'>";
            tagsHTML += "<div style='display: flex; justify-content: space-between; margin-bottom: 4px;'>";
            tagsHTML += "<strong style='color: #fff;'>" + label + "</strong>";
            tagsHTML += "<span style='color: #aaa;'>" + percentage + "%</span>";
            tagsHTML += "</div>";
            tagsHTML += "<div style='background: #333; height: 8px; border-radius: 4px; overflow: hidden;'>";
            tagsHTML += "<div style='background: linear-gradient(90deg, #4a9eff, #64b5f6); height: 100%; width: " + percentage + "%; transition: width 0.3s;'></div>";
            tagsHTML += "</div>";
            tagsHTML += "<div style='color: #bbb; font-size: 12px; margin-top: 4px;'>" + data.resolved[axis] + "</div>";
            tagsHTML += "</div>";
          }
        }
        tagsEl.innerHTML = tagsHTML;
        if (tagsContainer) {
          tagsContainer.style.display = "block";
        }
      }
      
      // Display the image
      var imgContainer = document.getElementById("generatedImageContainer");
      var imgEl = document.getElementById("generatedImage");
      
      if (data.image_base64 && imgEl) {
        imgEl.src = "data:image/png;base64," + data.image_base64;
        if (imgContainer) {
          imgContainer.style.display = "block";
        }
        setMessage("Here is your personalized " + chosenStyle + " living room design!");
        
        // Show the "Rate the Design" button
        var btnShowEval = document.getElementById("btnShowEvaluation");
        if (btnShowEval) {
          btnShowEval.style.display = "block";
          btnShowEval.onclick = function() {
            // Hide the description container
            var descContainer = document.getElementById("generatedDescriptionContainer");
            if (descContainer) {
              descContainer.style.display = "none";
            }
            // Hide the design highlights container
            var tagsContainer = document.getElementById("generatedTagsContainer");
            if (tagsContainer) {
              tagsContainer.style.display = "none";
            }
            // Show evaluation in the right panel
            document.getElementById("resultEvaluationContainer").style.display = "block";
            btnShowEval.style.display = "none";
          };
        }
      } else {
        setMessage("Design description generated" + (data.result ? ", but image could not be loaded." : "."));
      }
      
      // Set up evaluation submission handler
      setupEvaluationHandler();
    })
    .catch(function(err) {
      console.error("Generation error:", err);
      setMessage("There was an error generating your design. Please try again.");
      
      // Still allow evaluation
      setupEvaluationHandler();
    });
}

function setupEvaluationHandler() {
  const btnSubmit = document.getElementById("btnSubmitEvaluation");
  if (!btnSubmit) return;
  
  // Remove any existing handler to prevent duplicates
  btnSubmit.onclick = null;
  
  btnSubmit.onclick = function() {
    // Collect evaluation responses
    const materialsEl = document.getElementById("q_materials");
    const spatialEl = document.getElementById("q_spatial");
    const colorEl = document.getElementById("q_color");
    const overallEl = document.getElementById("q_overall");
    const methodEl = document.getElementById("q_method");
    
    console.log("Elements found:", {
      materials: materialsEl,
      spatial: spatialEl,
      color: colorEl,
      overall: overallEl,
      method: methodEl
    });
    
    if (!materialsEl || !spatialEl || !colorEl || !overallEl || !methodEl) {
      alert("Error: Could not find evaluation form elements.");
      return;
    }
    
    const q_materials = materialsEl.value;
    const q_spatial = spatialEl.value;
    const q_color = colorEl.value;
    const q_overall = overallEl.value;
    const q_method = methodEl.value;
    
    console.log("Evaluation values:", { q_materials, q_spatial, q_color, q_overall, q_method });
    
    // Validate all questions answered (check for empty string specifically)
    if (q_materials === "" || q_spatial === "" || q_color === "" || q_overall === "" || q_method === "") {
      console.log("Validation failed - empty values found");
      alert("Please answer all evaluation questions before submitting.");
      return;
    }
    
    console.log("Validation passed!");
    
    // Add evaluation to trial data
    if (trialData) {
      trialData.evaluation = {
        materials: parseInt(q_materials),
        spatial: parseInt(q_spatial),
        color: parseInt(q_color),
        overall: parseInt(q_overall),
        method: parseInt(q_method)
      };
      trialData.evaluationTimestamp = new Date().toISOString();
    }
    
    // Submit complete data to Google Sheets
    submitCompleteData(trialData);
    
    // Hide evaluation and show refinement options
    document.getElementById("resultEvaluationContainer").style.display = "none";
    document.getElementById("refinementContainer").style.display = "block";
    
    // Set up refinement option handlers
    setupRefinementHandlers();
  };
}

function setupRefinementHandlers() {
  const refinementButtons = document.querySelectorAll(".refinement-option");
  
  refinementButtons.forEach(function(button) {
    button.onmouseover = function() {
      this.style.background = "#3a3a3a";
      this.style.borderColor = "#4a9eff";
    };
    button.onmouseout = function() {
      this.style.background = "#2a2a2a";
      this.style.borderColor = "#444";
    };
    
    button.onclick = function() {
      const refinementChoice = this.getAttribute("data-refinement");
      console.log("User selected refinement:", refinementChoice);
      
      // Store the refinement choice
      if (trialData) {
        trialData.refinementChoice = refinementChoice;
        trialData.refinementTimestamp = new Date().toISOString();
      }
      
      // If user chooses not to refine, show thank you
      if (refinementChoice === "none") {
        var refinementContainer = document.getElementById("refinementContainer");
        var refinementContent = refinementContainer.querySelector("div:first-of-type");
        var heading = refinementContainer.querySelector("h3");
        var description = refinementContainer.querySelector("p");
        
        // Hide the refinement options
        if (heading) heading.style.display = "none";
        if (description) description.style.display = "none";
        if (refinementContent) refinementContent.style.display = "none";
        
        // Show thank you message inside the refinement container
        document.getElementById("thankYouMessage").style.display = "block";
        return;
      }
      
      // Otherwise, show the appropriate refinement step
      showRefinementStep(refinementChoice);
    };
  });
}

function disableAllSliders() {
  // Disable all step sliders
  var sliderIds = [
    "strokeThickness", "strokeCoarseness", "strokeWiggle",
    "appleMorph", "appleRigidity", "appleSymmetry",
    "colorTone", "colorSaturation", "colorBrightness", "colorVariation"
  ];
  
  sliderIds.forEach(function(id) {
    var slider = document.getElementById(id);
    if (slider) {
      slider.disabled = true;
      slider.style.opacity = "0.5";
      slider.style.cursor = "not-allowed";
    }
  });
}

function enableSlider(sliderId) {
  var slider = document.getElementById(sliderId);
  if (slider) {
    slider.disabled = false;
    slider.style.opacity = "1";
    slider.style.cursor = "pointer";
  }
}

function showRefinementStep(refinementChoice) {
  // Set refinement mode flag
  isRefinementMode = true;
  
  // Hide result screen and show trial screen
  document.getElementById("resultScreen").style.display = "none";
  document.getElementById("trialScreen").style.display = "block";
  
  // Map refinement choice to step number
  var stepMap = {
    "material": 1,    // Step 1: Stroke Character (thickness, coarseness, wiggleness)
    "spatial": 2,     // Step 2: Apple Geometry (morph, rigidity, symmetry)
    "color": 3        // Step 3: Color Palette (tone, saturation, brightness, variation)
  };
  
  currentStep = stepMap[refinementChoice] || 1;
  
  // Disable all sliders first
  disableAllSliders();
  
  // Enable only the sliders for the selected refinement aspect
  if (refinementChoice === "material") {
    enableSlider("strokeThickness");
    enableSlider("strokeCoarseness");
    enableSlider("strokeWiggle");
  } else if (refinementChoice === "spatial") {
    enableSlider("appleMorph");
    enableSlider("appleRigidity");
    enableSlider("appleSymmetry");
  } else if (refinementChoice === "color") {
    enableSlider("colorTone");
    enableSlider("colorSaturation");
    enableSlider("colorBrightness");
    enableSlider("colorVariation");
  }
  
  // Update the UI to show the appropriate step
  updateStepUI();
  
  // Update step indicator to show "Refine" instead of step number
  var stepIndicator = document.getElementById("stepIndicator");
  if (stepIndicator) {
    if (currentStep === 1) {
      stepIndicator.textContent = "Refine: Stroke Character";
    } else if (currentStep === 2) {
      stepIndicator.textContent = "Refine: Apple Geometry";
    } else {
      stepIndicator.textContent = "Refine: Color Palette";
    }
  }
  
  // Hide back/next buttons and show iterate button
  var btnBack = document.getElementById("btnBack");
  var btnNext = document.getElementById("btnNext");
  var btnIterate = document.getElementById("btnIterate");
  
  if (btnBack) btnBack.style.display = "none";
  if (btnNext) btnNext.style.display = "none";
  if (btnIterate) btnIterate.style.display = "block";
  
  // Set up iterate button handler
  if (btnIterate) {
    btnIterate.onclick = function() {
      // Get current parameters (p_1)
      var params = readCurrentParameters();
      var p_1 = normalizeParameters(params);
      
      // Get original parameters (p_0) from trialData
      var p_0 = trialData.normalizedParams;
      
      // Get original image (img_0)
      var imgEl = document.getElementById("generatedImage");
      var img_0_base64 = null;
      if (imgEl && imgEl.src && imgEl.src.startsWith("data:image/png;base64,")) {
        img_0_base64 = imgEl.src.replace("data:image/png;base64,", "");
      }
      
      if (!img_0_base64) {
        alert("Original image not found. Please try again.");
        return;
      }
      
      // Store iteration data
      if (trialData) {
        if (!trialData.iterations) {
          trialData.iterations = [];
        }
        trialData.iterations.push({
          refinementType: refinementChoice,
          parameters: params,
          p_0: p_0,
          p_1: p_1,
          timestamp: new Date().toISOString()
        });
      }
      
      // Clear refinement mode and hide trial screen
      isRefinementMode = false;
      document.getElementById("trialScreen").style.display = "none";
      document.getElementById("resultScreen").style.display = "block";
      
      // Generate refined design using the refinement endpoint
      var chosenStyle = trialData.chosenStyle;
      setMessage("Generating refined " + chosenStyle + " design with your adjustments...");
      
      generateRefinedImage(chosenStyle, p_0, p_1, img_0_base64, refinementChoice)
        .then(function(data) {
          console.log("Refinement generation response:", data);
          
          // Display images side by side
          displayComparisonImages(img_0_base64, data.image_base64, data.refinement_prompt, data.delta);
          
          setMessage("Here is your refined " + chosenStyle + " living room design!");
          
          // Show refinement options again for another iteration
          var btnShowEval = document.getElementById("btnShowEvaluation");
          if (btnShowEval) {
            btnShowEval.style.display = "block";
            btnShowEval.onclick = function() {
              // Show refinement options again
              document.getElementById("refinementContainer").style.display = "block";
              btnShowEval.style.display = "none";
              
              // Reset refinement container to show options
              var refinementContainer = document.getElementById("refinementContainer");
              var heading = refinementContainer.querySelector("h3");
              var description = refinementContainer.querySelector("p");
              var refinementContent = refinementContainer.querySelector("div:first-of-type");
              
              if (heading) heading.style.display = "block";
              if (description) description.style.display = "block";
              if (refinementContent) refinementContent.style.display = "flex";
              document.getElementById("thankYouMessage").style.display = "none";
              
              // Re-setup handlers
              setupRefinementHandlers();
            };
          }
        })
        .catch(function(err) {
          console.error("Iteration generation error:", err);
          setMessage("There was an error generating your refined design. Please try again.");
        });
    };
  }
  
  // Redraw canvas to show the current sketch state
  redraw();
}

function generateRefinedImage(styleName, p_0, p_1, img_0_base64, refinementType) {
  var payload = {
    style: styleName,
    p_0: p_0,
    p_1: p_1,
    img_0: img_0_base64,
    refinement_type: refinementType
  };

  return fetch("/api/refine", {
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

function displayComparisonImages(img_0_base64, img_1_base64, refinementPrompt, delta) {
  // Update the image container to show side-by-side comparison
  var imgContainer = document.getElementById("generatedImageContainer");
  
  // Clear existing content and set up side-by-side layout
  imgContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #fff;">Original</div>
          <img src="data:image/png;base64,${img_0_base64}" style="width: 100%; border: 1px solid #444; border-radius: 4px;" />
        </div>
        <div style="text-align: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #4a9eff;">Refined</div>
          <img src="data:image/png;base64,${img_1_base64}" style="width: 100%; border: 1px solid #4a9eff; border-radius: 4px;" />
        </div>
      </div>
      <div style="padding: 12px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #fff;">Applied Changes:</div>
        <div style="font-size: 12px; color: #ddd; white-space: pre-line;">${refinementPrompt || "No changes applied"}</div>
      </div>
      <div style="padding: 12px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #fff;">Parameter Changes (Δ):</div>
        <div style="font-size: 12px; color: #ddd;">
          ${Object.entries(delta || {}).map(([key, value]) => {
            if (Math.abs(value) < 0.05) return '';
            const direction = value > 0 ? '↑' : '↓';
            const color = value > 0 ? '#4a9eff' : '#ff9a4a';
            return `<div style="margin-bottom: 4px;"><span style="color: ${color};">${direction}</span> ${key}: ${(value > 0 ? '+' : '')}${value.toFixed(3)}</div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  imgContainer.style.display = "block";
  
  // Update trialData with the new refined image
  if (trialData && img_1_base64) {
    // Update the current image to the refined one for next iteration
    var singleImgEl = document.createElement("img");
    singleImgEl.id = "generatedImage";
    singleImgEl.src = "data:image/png;base64," + img_1_base64;
    singleImgEl.style.display = "none";
    imgContainer.appendChild(singleImgEl);
  }
}

function submitCompleteData(data) {
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbwLATZT4UPrNADe5y6Kh9yiTx3fFB6Gur86xW6cShQDfGMFpS4B9lyB9zX2hDTQpxTi0Q/exec";

  console.log("Submitting complete trial data:", data);

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
    .then(function () {
      console.log("Complete data submitted successfully.");
    })
    .catch(function (err) {
      console.error("Submission error:", err);
    });
}











