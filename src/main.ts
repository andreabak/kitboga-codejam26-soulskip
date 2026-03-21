// This is how you tell the parent window that the ad was successfully skipped.
function adSuccess() {
    window.top!.postMessage({type: "success"}, "*")
}

const skipButton = document.getElementById("skip") as HTMLButtonElement | null

// Listen for messages from the game shell
window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return

    if (event.data.type === "adStarted") {
        // Show the skip button when the ad starts
        skipButton?.style.setProperty("display", "block", "")
    }

    // By default, if the user doesn't "skip" the ad before the video ends,
    // we call fail to restart. You're welcome to replace this with a survey
    // or other interaction instead (see examples/survey).
    if (event.data.type === "adFinished") {
        skipButton?.style.setProperty("display", "none", "")
        window.top!.postMessage({type: "fail"}, "*")
    }
})

// Your ad overlay code goes here, we've added a simple example below:
skipButton?.addEventListener("click", () => {
    skipButton.style.setProperty("display", "none", "")
    adSuccess()
})
