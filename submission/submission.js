function adSuccess() {
  window.top.postMessage({ type: "success" }, "*");
}
const skipButton = document.getElementById("skip");
window.addEventListener("message", (event) => {
  if (!event.data || !event.data.type) return;
  if (event.data.type === "adStarted") {
    skipButton == null ? void 0 : skipButton.style.setProperty("display", "block", "");
  }
  if (event.data.type === "adFinished") {
    skipButton == null ? void 0 : skipButton.style.setProperty("display", "none", "");
    window.top.postMessage({ type: "fail" }, "*");
  }
});
skipButton == null ? void 0 : skipButton.addEventListener("click", () => {
  skipButton.style.setProperty("display", "none", "");
  adSuccess();
});
