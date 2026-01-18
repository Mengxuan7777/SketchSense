# SketchSense

An interactive web application that infers interior design preferences through a drawing-based interface. Users manipulate sketch parameters to create personalized living room designs powered by AI.

## Overview

SketchSense translates artistic choices (stroke style, geometry, color) into interior design preferences. It uses:
- **GPT-5.2** for natural language design descriptions
- **Google Gemini Imagen** for image generation
- A sophisticated style library mapping 10 sketch parameters to 10 interior design styles

## Features

- 🎨 Interactive sketch-based preference capture (3 steps, 10 parameters)
- 🏠 10 interior design styles (Ultra Minimal, Scandinavian, Japandi, etc.)
- 🤖 AI-powered text-to-design generation
- 📊 Bias system for style-specific parameter interpretation
- 🎯 Real-time visual feedback

## Architecture

```
Frontend (ApplePad/)     Backend (backend/)
├─ index.html            ├─ app.py (Flask API)
├─ sketch.js             ├─ style_library.json
├─ promptUtils.js        ├─ requirements.txt
├─ imageApi.js           └─ .env (your API keys)
└─ style_library.json
```

## Prerequisites

- Python 3.8+
- Node.js (optional, for local server)
- OpenAI API Key (GPT-5.2)
- Google Gemini API Key (Imagen)

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/SketchSense.git
cd SketchSense
```

### 2. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy style library from frontend
cp ../ApplePad/style_library.json .

# Create .env file from template
cp .env.example .env

# Edit .env with your API keys
# OPENAI_API_KEY=sk-your-openai-key-here
# GEMINI_API_KEY=your-gemini-key-here
```

### 3. Get API Keys

**OpenAI (GPT-5.2):**
- Sign up at https://platform.openai.com/
- Create API key at https://platform.openai.com/api-keys

**Google Gemini (Imagen):**
- Sign up at https://ai.google.dev/
- Create API key in Google AI Studio

### 4. Start the Backend Server

```bash
python app.py
```

Server will run on `http://localhost:5000`

### 5. Start the Frontend

Open `ApplePad/index.html` in a browser, or use a local server:

```bash
# Using Python
cd ApplePad
python -m http.server 8000

# Or using VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

### 6. Update Frontend API Endpoint (if needed)

In `ApplePad/promptUtils.js`, verify the backend URL:

```javascript
return fetch("/api/generate", {  // Change to "http://localhost:5000/api/generate" if needed
```

## Usage

1. Fill in demographics (age, gender, education)
2. **Step 1:** Adjust stroke character (thickness, coarseness, wiggleness)
3. **Step 2:** Adjust geometry (bumpiness, rigidity, symmetry)
4. **Step 3:** Adjust color palette (tone, saturation, brightness, uniformity)
5. Click **Finish** to generate your personalized living room design

## Project Structure

### Frontend Parameters (10 total)

| Parameter | Range | Description |
|-----------|-------|-------------|
| Thickness | 0-100 | Stroke weight |
| Coarseness | 0-100 | Surface texture |
| Wiggleness | 0-1 | Organic variation |
| Bumpiness | 0-1 | Decorative layering |
| Rigidity | 0-1 | Spatial organization |
| Symmetry | 0-1 | Compositional balance |
| Tone | 0-1 | Warm (0) to Cool (1) |
| Saturation | 0-1 | Color intensity |
| Brightness | 0-1 | Light/dark values |
| Uniform | 0-1 | Color diversity |

### Style Selection (S-score based)

Parameters are averaged to compute S-score, which maps to style bands:

- **0.0-0.2:** Ultra Minimal / Scandinavian
- **0.2-0.4:** Japandi / Contemporary Calm
- **0.4-0.6:** Retro modern / Timeless Farmhouse
- **0.6-0.8:** Vintage Industrial / Cabin Chic
- **0.8-1.0:** Eclectic Boho / Modern Deco

### Backend API

**Endpoint:** `POST /api/generate`

**Request:**
```json
{
  "style": "Contemporary Calm",
  "params": {
    "thickness": 0.3,
    "coarseness": 0.2,
    "wiggleness": 0.1,
    "bumpiness": 0.25,
    "rigidity": 0.5,
    "symmetry": 0.4,
    "tone": 0.5,
    "saturation": 0.6,
    "brightness": 0.5,
    "uniform": 0.3
  },
  "scene": {
    "roomType": "living room"
  }
}
```

**Response:**
```json
{
  "style": "Contemporary Calm",
  "result": "A serene living room with warm oak flooring...",
  "image_base64": "iVBORw0KGgoAAAANS...",
  "resolved": {
    "thickness": "subtle surface texture...",
    ...
  }
}
```

## Configuration

### Environment Variables

Create `backend/.env`:

```bash
# Required
OPENAI_API_KEY=sk-your-key
GEMINI_API_KEY=your-key

# Optional (defaults set in app.py)
CHATGPT_MODEL=gpt-5.2
IMAGEN_MODEL=imagen-3.0-generate-001
IMAGE_SIZE=1024
```

### Customization

**Add a new style:**

Edit `ApplePad/style_library.json` and `backend/style_library.json`:

```json
"Your New Style": {
  "tags": ["tag1", "tag2"],
  "signature": {
    "materials": ["material1", "material2"],
    "forms": ["form1", "form2"],
    "lighting": ["lighting1", "lighting2"]
  },
  "bias": {
    "bumpiness": -0.1,
    "saturation": 0.2
  },
  "overrides": {
    "tone": {
      "high": "Custom description for high tone"
    }
  }
}
```

## Troubleshooting

**"Missing OPENAI_API_KEY":**
- Make sure `.env` file exists in `backend/` folder
- Check that API key starts with `sk-`

**"Missing style_library.json":**
- Copy from `ApplePad/style_library.json` to `backend/`

**CORS errors:**
- Backend runs on port 5000, frontend should match
- Check `CORS(app)` in `backend/app.py`

**Image generation fails:**
- Gemini Imagen may have content filtering
- Check console for error messages
- Text description will still be returned

## API Costs

Approximate costs per generation:
- **GPT-5.2:** $0.05-0.15 per request
- **Imagen 3.0:** $0.04-0.08 per image

Budget accordingly for testing and demos.

## Contributing

This is a research project. If you'd like to contribute:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

[Add your license here]

## Citation

If you use this in research, please cite:

```
[Your citation format]
```

## Contact

[Your contact information]

## Acknowledgments

- Uses OpenAI GPT-5.2 for natural language generation
- Uses Google Gemini Imagen for image synthesis
- Built with p5.js for interactive sketching
