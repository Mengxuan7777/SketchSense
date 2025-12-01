# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import os

app = Flask(__name__)
CORS(app)

@app.route("/generate-image", methods=["POST"])
def generate_image():
    data = request.get_json(force=True, silent=True) or {}
    prompt = data.get("prompt", "").strip()
    print("Received prompt:\n", prompt)

    if not prompt:
        return jsonify({"error": "Missing 'prompt'"}), 400

    # Load a local placeholder image and return it as base64
    img_path = os.path.join(os.path.dirname(__file__), "static", "test_interior.png")
    try:
        with open(img_path, "rb") as f:
            image_bytes = f.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # This shape matches what imageApi.js already expects
        return jsonify({
            "image_base64": image_b64
        }), 200

    except Exception as e:
        print("Error reading local image:", e)
        return jsonify({"error": "Failed to load local image"}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=True)
