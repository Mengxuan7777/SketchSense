import os
import json
import time
import base64
import requests
from typing import Dict, Any, Tuple

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from openai import OpenAI
import google.generativeai as genai

load_dotenv()

# -----------------------------
# Configuration
# -----------------------------
SYSTEM_PROMPT = """You are an interior design assistant.

You must strictly follow the provided style definition and parameter descriptions.

Rules:
1. Use the provided parameter descriptions exactly as given - they define specific design characteristics.
2. Use the selected style's tags and signature (materials, forms, lighting) to guide the overall aesthetic.
3. Do NOT invent materials, colors, or stylistic elements that contradict the selected style.
4. If parameter descriptions and style signature differ, the style signature takes priority.
5. Maintain a cohesive and realistic interior design language.
6. Create a detailed, vivid description suitable for visualization.

Your output should be a clear, natural-language interior scene description suitable for visualization.
"""

CHATGPT_MODEL = "gpt-4o"  # or gpt-4o-mini for faster/cheaper

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY in environment (.env).")

client = OpenAI(api_key=OPENAI_API_KEY)

# Google Gemini API for image generation
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in environment (.env).")

genai.configure(api_key=GEMINI_API_KEY)

# Imagen configuration
IMAGEN_MODEL = "imagen-3.0-generate-001"  # or imagen-2.0-generate-001
IMAGE_SIZE = 1024  # 256, 512, 1024

# Load style library once at startup
with open("style_library.json", "r", encoding="utf-8") as f:
    STYLE_LIB = json.load(f)

RANGES = STYLE_LIB["ranges"]
AXES = STYLE_LIB["axes"]
STYLES = STYLE_LIB["styles"]
REFINEMENT_TEMPLATES = STYLE_LIB["refinement_templates"]

# -----------------------------
# Simple in-memory rate limiting (basic)
# For production, use Redis or a gateway rate limiter.
# -----------------------------
REQUEST_LOG: Dict[str, list] = {}
MAX_REQ_PER_MIN = 30

def rate_limit_ok(client_id: str) -> bool:
    now = time.time()
    window_start = now - 60
    history = REQUEST_LOG.get(client_id, [])
    history = [t for t in history if t >= window_start]
    if len(history) >= MAX_REQ_PER_MIN:
        REQUEST_LOG[client_id] = history
        return False
    history.append(now)
    REQUEST_LOG[client_id] = history
    return True

# -----------------------------
# Helpers
# -----------------------------
def clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x

def bucketize(value: float) -> str:
    """Map a 0-1 value to low/mid/high using continuous ranges."""
    v = clamp01(value)
    # RANGES: {"low":[0,0.3], "mid":[0.3,0.7], "high":[0.7,1.0]}
    for bucket_name, (a, b) in RANGES.items():
        # include lower bound; include upper bound for high to catch 1.0
        if bucket_name == "high":
            if v >= a and v <= b:
                return bucket_name
        else:
            if v >= a and v < b:
                return bucket_name
    return "high"  # fallback

def resolve_axis_text(style_name: str, axis: str, bucket: str) -> str:
    """Get base axis text, then apply style override if provided."""
    base = AXES[axis][bucket]
    style = STYLES[style_name]
    overrides = style.get("overrides", {})
    if axis in overrides and bucket in overrides[axis]:
        return overrides[axis][bucket]
    return base

def apply_bias(style_name: str, params: Dict[str, float]) -> Dict[str, float]:
    """Apply optional style bias before bucketizing."""
    style = STYLES[style_name]
    bias = style.get("bias", {})
    out: Dict[str, float] = {}
    for k, v in params.items():
        if k in bias:
            out[k] = clamp01(float(v) + float(bias[k]))
        else:
            out[k] = clamp01(float(v))
    return out

def build_user_prompt(style_name: str,
                      resolved_param_lines: Dict[str, str],
                      scene: Dict[str, Any]) -> str:
    style = STYLES[style_name]
    tags = style.get("tags", [])
    sig = style.get("signature", {})
    materials = sig.get("materials", [])
    forms = sig.get("forms", [])
    lighting = sig.get("lighting", [])

    room_type = (scene or {}).get("roomType", "")
    constraints = (scene or {}).get("constraints", [])

    param_block = "\n".join([f"• {k}: {v}" for k, v in resolved_param_lines.items()])

    scene_lines = []
    if room_type:
        scene_lines.append(f"Room type: {room_type}")
    if constraints and isinstance(constraints, list):
        scene_lines.append("Constraints: " + "; ".join([str(c) for c in constraints]))
    scene_block = "\n".join(scene_lines) if scene_lines else "Room type: (not specified)"

    prompt = f"""STYLE: {style_name}
TAGS: {", ".join(tags)}

PARAMETERS (resolved descriptions):
{param_block}

STYLE SIGNATURE:
Materials: {", ".join(materials)}
Forms: {", ".join(forms)}
Lighting: {", ".join(lighting)}

SCENE:
{scene_block}

TASK:
Write a cohesive interior scene description suitable for visualization.
Keep it realistic and consistent with the style.
Do not mention numeric values or ranges.
"""
    return prompt

def validate_payload(payload: Dict[str, Any]) -> Tuple[bool, str]:
    if "style" not in payload:
        return False, "Missing 'style'."
    style_name = payload["style"]
    if style_name not in STYLES:
        return False, f"Unknown style '{style_name}'."

    params = payload.get("params", {})
    if not isinstance(params, dict) or len(params) == 0:
        return False, "Missing or empty 'params'."

    for k, v in params.items():
        if k not in AXES:
            return False, f"Unknown parameter axis '{k}'."
        try:
            fv = float(v)
        except Exception:
            return False, f"Parameter '{k}' must be a number."
        if fv < 0.0 or fv > 1.0:
            return False, f"Parameter '{k}' must be between 0 and 1."

    return True, ""

# -----------------------------
# Flask app
# -----------------------------
app = Flask(__name__, static_folder='../ApplePad', static_url_path='')
CORS(app)  # for local dev; lock down origins in production

@app.route('/')
def serve_frontend():
    return send_from_directory('../ApplePad', 'index.html')

@app.route('/static/<path:filename>')
def serve_static_images(filename):
    return send_from_directory('../static', filename)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../ApplePad', path)

@app.route("/api/styles", methods=["GET"])
def list_styles():
    return jsonify({
        "styles": list(STYLES.keys()),
        "axes": list(AXES.keys()),
        "ranges": RANGES
    })

@app.route("/api/generate", methods=["POST"])
def generate():
    client_id = request.remote_addr or "unknown"
    if not rate_limit_ok(client_id):
        return jsonify({"error": "Rate limit exceeded. Please try again soon."}), 429

    payload = request.get_json(silent=True) or {}
    ok, err = validate_payload(payload)
    if not ok:
        return jsonify({"error": err}), 400

    style_name = payload["style"]
    params = payload.get("params", {})
    scene = payload.get("scene", {})

    # Apply bias, bucketize, resolve text
    biased = apply_bias(style_name, params)
    resolved_lines: Dict[str, str] = {}
    for axis, val in biased.items():
        bucket = bucketize(val)
        text = resolve_axis_text(style_name, axis, bucket)
        resolved_lines[axis] = text

    user_prompt = build_user_prompt(style_name, resolved_lines, scene)

    # Print the full prompt to terminal for debugging
    print("\n" + "="*80)
    print("CHATGPT PROMPT")
    print("="*80)
    print("\n[SYSTEM PROMPT]")
    print(SYSTEM_PROMPT)
    print("\n[USER PROMPT]")
    print(user_prompt)
    print("="*80 + "\n")

    # Call ChatGPT for text description
    try:
        response = client.chat.completions.create(
            model=CHATGPT_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=450
        )
        text_description = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"ChatGPT call failed: {str(e)}"}), 500

    # Call DALL-E 3 for image generation
    image_b64 = None
    try:
        # Enhance prompt for residential realism
        dalle_prompt = f"""{text_description}

Style: Photorealistic interior photography, professional real estate photography style.
Requirements: Realistic residential living room with accurate scale and proportions. Livable and functional space with natural lighting. High-quality architectural photography, sharp focus, realistic materials and textures. No artistic abstraction or surreal elements."""
        
        dalle_response = client.images.generate(
            model="dall-e-3",
            prompt=dalle_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json"
        )
        
        image_b64 = dalle_response.data[0].b64_json
        
    except Exception as e:
        # Image generation is optional - don't fail if it doesn't work
        print(f"DALL-E 3 generation warning: {str(e)}")

    return jsonify({
        "style": style_name,
        "result": text_description,
        "image_base64": image_b64,
        "resolved": resolved_lines  # helpful for debugging; remove if you want
    })

@app.route("/api/refine", methods=["POST"])
def refine():
    client_id = request.remote_addr or "unknown"
    if not rate_limit_ok(client_id):
        return jsonify({"error": "Rate limit exceeded. Please try again soon."}), 429

    payload = request.get_json(silent=True) or {}
    
    # Validate required fields
    if "style" not in payload:
        return jsonify({"error": "Missing 'style'."}), 400
    if "p_0" not in payload or "p_1" not in payload:
        return jsonify({"error": "Missing 'p_0' or 'p_1'."}), 400
    if "img_0" not in payload:
        return jsonify({"error": "Missing 'img_0' (original image base64)."}), 400
    if "refinement_type" not in payload:
        return jsonify({"error": "Missing 'refinement_type'."}), 400
    
    style_name = payload["style"]
    p_0 = payload["p_0"]  # original normalized parameters
    p_1 = payload["p_1"]  # adjusted normalized parameters
    img_0_b64 = payload["img_0"]  # original image base64
    refinement_type = payload["refinement_type"]  # "material", "spatial", or "color"
    
    # Calculate delta
    delta = {}
    for key in p_0:
        if key in p_1:
            delta[key] = p_1[key] - p_0[key]
    
    # Log the parameters
    print("\n" + "="*80)
    print("REFINEMENT REQUEST")
    print("="*80)
    print(f"Style: {style_name}")
    print(f"Refinement Type: {refinement_type}")
    print(f"\nOriginal Parameters (p_0): {p_0}")
    print(f"Adjusted Parameters (p_1): {p_1}")
    print(f"Delta (|Δ|): {delta}")
    print("="*80 + "\n")
    
    # Build refinement prompt using templates
    refinement_prompt = build_refinement_prompt(refinement_type, delta)
    
    print("\n" + "="*80)
    print("REFINEMENT PROMPT")
    print("="*80)
    print(refinement_prompt)
    print("="*80 + "\n")
    
    # Call DALL-E 3 for image-to-image refinement (edit mode)
    # Note: DALL-E 3 doesn't support image editing, so we'll generate with the refinement prompt
    # For true image-to-image, you'd need DALL-E 2 edit endpoint or another service
    image_b64 = None
    try:
        # For now, we'll generate a new image with the refinement instructions
        # In production, use a service that supports image-to-image editing
        dalle_prompt = f"""{refinement_prompt}

Style: Photorealistic interior photography, professional real estate photography style.
Requirements: Realistic residential living room with accurate scale and proportions. Livable and functional space with natural lighting. High-quality architectural photography, sharp focus, realistic materials and textures. No artistic abstraction or surreal elements."""
        
        dalle_response = client.images.generate(
            model="dall-e-3",
            prompt=dalle_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json"
        )
        
        image_b64 = dalle_response.data[0].b64_json
        
    except Exception as e:
        print(f"DALL-E 3 generation error: {str(e)}")
        return jsonify({"error": f"Image generation failed: {str(e)}"}), 500
    
    return jsonify({
        "style": style_name,
        "refinement_type": refinement_type,
        "p_0": p_0,
        "p_1": p_1,
        "delta": delta,
        "refinement_prompt": refinement_prompt,
        "image_base64": image_b64
    })

def build_refinement_prompt(refinement_type: str, delta: Dict[str, float]) -> str:
    """Build a refinement prompt based on parameter changes."""
    config = REFINEMENT_TEMPLATES["config"]
    dimensions = REFINEMENT_TEMPLATES["dimensions"]
    assembly = REFINEMENT_TEMPLATES["assembly"]
    
    epsilon = config["epsilon"]
    max_phrases = config.get("max_phrases_per_refinement", 2)
    
    # Determine which dimension group to use
    dimension_group = dimensions.get(refinement_type, {})
    
    # Collect refinement phrases
    phrases = []
    for param, change in delta.items():
        abs_change = abs(change)
        
        # Ignore tiny changes
        if abs_change < epsilon:
            continue
        
        # Get the template for this parameter
        if param not in dimension_group:
            continue
        
        templates = dimension_group[param]
        
        # Determine direction
        if change > 0:
            direction = "increase"
        else:
            direction = "decrease"
        
        phrase = templates.get(direction, "")
        if phrase:
            phrases.append(phrase)
    
    # Limit number of phrases
    phrases = phrases[:max_phrases]
    
    # Assemble the prompt
    if not phrases:
        return "Please keep the existing living room image as is with minimal changes."
    
    formatted_phrases = "\n".join([assembly["format"].replace("{PHRASE}", p) for p in phrases])
    
    prompt = f"""{assembly["prefix"]}

{formatted_phrases}

{assembly["preserve"]}

{assembly["suffix"]}"""
    
    return prompt

if __name__ == "__main__":
    app.run(debug=True, port=5000)
