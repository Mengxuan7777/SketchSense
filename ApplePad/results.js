// result.js
// Handles showing the result screen and feedback UI

(function () {
  // Global message function so imageApi.js, sketch.js can use it
  function setMessage(msg) {
    var messageEl = document.getElementById("message");
    if (messageEl) {
      messageEl.textContent = msg || "";
    }
  }
  window.setMessage = setMessage;

  // Global function to switch from sketch screen to result screen
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
  window.showResultScreen = showResultScreen;

  // (Optional future) feedback submit can go here
})();
