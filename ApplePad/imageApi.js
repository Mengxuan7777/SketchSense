// ==============================
// imageApi.js
// Handles calling the Nano Banana backend
// and updating the image in the page
// ==============================
(function () {
  // TODO: change this to your actual backend URL
  var NANO_BANANA_URL = "http://localhost:8001/generate-image";

  async function generateInteriorFromPrompt(promptText) {
    console.log("Generating interior with prompt:", promptText);

    var imgContainer = document.getElementById("generatedImageContainer");
    var imgEl = document.getElementById("generatedImage");

    if (imgContainer) {
      imgContainer.style.display = "block"; // show container
    }
    if (imgEl) {
      imgEl.src = ""; // clear any previous image
    }

    // While generating
    if (typeof setMessage === "function") {
      window.setMessage(
        "Thank you! Your responses have been recorded. Here is the living room design that fits your taste..."
      );
    }

    try {
      var response = await fetch(NANO_BANANA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // Add auth here if needed:
          // "Authorization": "Bearer YOUR_API_KEY"
        },
        body: JSON.stringify({
          prompt: promptText
          // Add extra options if your API expects them:
          // width: 768, height: 512, steps: 30, etc.
        })
      });

      if (!response.ok) {
        console.error("Nano Banana backend error:", response.status, response.statusText);
        if (typeof setMessage === "function") {
          window.setMessage(
            "Thank you! Your responses have been recorded, but there was an error generating the image."
          );
        }
        return;
      }

      var data = await response.json();
      console.log("Nano Banana backend response:", data);

      // Adjust these keys according to your backend response
      if (data.image_base64 && imgEl) {
        imgEl.src = "data:image/png;base64," + data.image_base64;

      } else if (data.image_url && imgEl) {
        imgEl.src = data.image_url;

        // REMOVED the second message — sketch.js already gave the "Thank you" text

      } else {
        if (typeof setMessage === "function") {
          window.setMessage(
            "Thank you! Your responses have been recorded, but no image was returned from the design server."
          );
        }
      }

    } catch (err) {
      console.error("Error calling Nano Banana backend:", err);
      if (typeof setMessage === "function") {
        window.setMessage(
          "Thank you! Your responses have been recorded, but there was an error generating the image."
        );
      }
    }
  }

  // Expose to global scope so sketch.js can call it
  window.generateInteriorFromPrompt = generateInteriorFromPrompt;
})();
