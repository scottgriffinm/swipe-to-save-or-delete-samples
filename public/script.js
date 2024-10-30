let currentSample = null;
let originalFile = null;
let sessionStarted = false;
let loopCount = 0;
const maxLoops = 3;

// Detect if the device is mobile
function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

// Check if the user is authenticated
async function checkAuthentication() {
    try {
        const response = await fetch("/auth/status");
        const data = await response.json();
        return data.isAuthenticated;
    } catch (error) {
        console.error("Error checking authentication:", error);
        return false;
    }
}

// Initialize the app
async function init() {
    const isAuthenticated = await checkAuthentication();

    if (isAuthenticated) {
        document.getElementById("signInButton").style.display = "none";
        document.getElementById("audioContainer").style.display = "flex";
        
        await loadSample(false); // Load the first sample without autoplay or animations

        if (isMobileDevice()) {
            detectSwipe();
        } else {
            setupDesktopDragControls();
        }

        // Add click listener to restart the sample loop
        document.getElementById("audioContainer").addEventListener("click", restartLoop);
    } else {
        document.getElementById("signInButton").style.display = "block";
    }
}

// Function to load a sample and handle looping
async function loadSample(autoplay = true, swipeDirection = "left") {
    const filenameDisplay = document.getElementById("filenameDisplay");

    filenameDisplay.classList.remove("swipe-out-left", "swipe-out-right", "fade-in");

    if (sessionStarted && filenameDisplay.style.display === "block") {
        filenameDisplay.classList.add(swipeDirection === "left" ? "swipe-out-left" : "swipe-out-right");
    }

    setTimeout(async () => {
        try {
            const response = await fetch("/api/sample");
            const { file, originalFile: origFile } = await response.json();
            currentSample = file;
            originalFile = origFile;

            const audioPlayer = document.getElementById("audioPlayer");
            audioPlayer.src = `/api/sample/${file}`;
            loopCount = 0; // Reset loop count for new sample

            if (autoplay && sessionStarted) {
                audioPlayer.play().catch(error => {
                    console.error("Autoplay failed:", error);
                });
            }

            audioPlayer.removeEventListener("ended", handleLoopEnd);
            audioPlayer.addEventListener("ended", handleLoopEnd);

            filenameDisplay.classList.remove("swipe-out-left", "swipe-out-right");
            filenameDisplay.textContent = `${currentSample}`;
            
            if (sessionStarted) {
                filenameDisplay.style.display = "block";
                filenameDisplay.classList.add("fade-in");
            }

            setTimeout(() => filenameDisplay.classList.remove("fade-in"), 500);
        } catch (error) {
            console.error("Error fetching sample:", error);
        }
    }, sessionStarted ? 500 : 0);
}

// Function to handle audio loop ending
function handleLoopEnd() {
    loopCount += 1;
    if (loopCount < maxLoops) {
        document.getElementById("audioPlayer").play();
    } else {
        document.getElementById("audioPlayer").pause(); // Stop playback after three loops
    }
}

// Function to restart the loop on click
function restartLoop() {
    loopCount = 0; // Reset loop count
    document.getElementById("audioPlayer").play(); // Restart audio from the beginning
}

// Start session on "Start Session" button click
function startSession() {
    sessionStarted = true;
    
    const audioPlayer = document.getElementById("audioPlayer");
    document.getElementById("startButton").style.display = "none";

    const filenameDisplay = document.getElementById("filenameDisplay");
    filenameDisplay.style.display = "block";
    filenameDisplay.textContent = `${currentSample}`;
    filenameDisplay.classList.add("fade-in");

    audioPlayer.play().catch(error => {
        console.error("Autoplay blocked. User interaction required:", error);
    });
}

// Save the sample to Google Drive
async function saveSample() {
    const saveMessage = document.getElementById("saveMessage");
    try {
        const res = await fetch("/api/add-to-drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: currentSample }),
        });
        const result = await res.json();

        if (res.ok) {
            saveMessage.textContent = "File saved to Google Drive successfully!";
            saveMessage.classList.add("fade-in-out", "success");
        } else {
            throw new Error(result.error || "Unknown error");
        }
    } catch (error) {
        console.error("Error adding file to Google Drive:", error);
        saveMessage.textContent = "Failed to save to Google Drive.";
        saveMessage.classList.add("fade-in-out", "failure");
    }

    setTimeout(() => {
        saveMessage.classList.remove("fade-in-out", "success", "failure");
    }, 3000);
}

// Detect swipe gestures on mobile
function detectSwipe() {
    let touchstartX = 0;
    let touchendX = 0;

    function handleGesture() {
        if (touchendX < touchstartX - 50) { // Swipe left
            loadSample(true, "left");
        }
        if (touchendX > touchstartX + 50) { // Swipe right
            saveSample();
            loadSample(true, "right");
        }
    }

    document.addEventListener("touchstart", (e) => {
        touchstartX = e.changedTouches[0].screenX;
    });

    document.addEventListener("touchend", (e) => {
        touchendX = e.changedTouches[0].screenX;
        handleGesture();
    });
}

// Detect drag gestures on desktop for left/right navigation
function setupDesktopDragControls() {
    let dragStartX = 0;
    let dragEndX = 0;
    const audioContainer = document.getElementById("audioContainer");

    audioContainer.addEventListener("mousedown", (e) => {
        dragStartX = e.clientX;
    });

    document.addEventListener("mouseup", (e) => {
        dragEndX = e.clientX;
        handleDesktopDragGesture();
    });

    function handleDesktopDragGesture() {
        if (dragEndX < dragStartX - 50) { // Drag left
            loadSample(true, "left");
        }
        if (dragEndX > dragStartX + 50) { // Drag right
            saveSample();
            loadSample(true, "right");
        }
    }
}

// Sign-in button click handler
document.getElementById("signInButton").addEventListener("click", () => {
    window.location.href = "/auth/google";
});

// Start session button click handler
document.getElementById("startButton").addEventListener("click", startSession);

init(); // Initialize the app on load