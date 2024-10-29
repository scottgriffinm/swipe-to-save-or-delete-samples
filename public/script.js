// public/script.js

let currentSample = null;
let originalFile = null;

// Helper function to check if the user is authenticated
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

// Initialize the app by checking authentication and setting up the interface
async function init() {
    const isAuthenticated = await checkAuthentication();

    if (isAuthenticated) {
        document.getElementById("signInButton").style.display = "none";
        document.getElementById("audioContainer").style.display = "flex";
        
        await loadSample(); // Load sample but don't play it

        if (isMobileDevice()) {
            detectSwipe(); // Enable swipe detection on mobile
            document.getElementById("instructions").textContent = "Swipe left to get a new sample, swipe right to save the sample to Google Drive.";
        } else {
            setupDesktopControls(); // Enable arrow controls on desktop
            document.getElementById("instructions").textContent = "Click the arrows to navigate samples.";
        }
    } else {
        document.getElementById("signInButton").style.display = "block";
    }
}

// Function to get a random sample without playing it
async function loadSample() {
    try {
        const response = await fetch("/api/sample");
        const { file, originalFile: origFile } = await response.json();
        currentSample = file;
        originalFile = origFile;

        // Load audio source but don't play yet
        const audioPlayer = document.getElementById("audioPlayer");
        audioPlayer.src = `/api/sample/${file}`;
        
        // Show "Start Session" button
        const filenameDisplay = document.getElementById("filenameDisplay");
        filenameDisplay.textContent = ""; // Clear filename display
        document.getElementById("startButton").style.display = "inline-block";
    } catch (error) {
        console.error("Error fetching sample:", error);
    }
}

// Start session by playing the sample
function startSession() {
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.play();
    
    // Show filename and hide start button
    document.getElementById("filenameDisplay").textContent = `Playing: ${currentSample}`;
    document.getElementById("startButton").style.display = "none";
    
    // Show navigation arrows for desktop
    document.getElementById("leftArrow").style.display = "inline";
    document.getElementById("rightArrow").style.display = "inline";
}

// Function to save the sample to Google Drive
async function saveSample() {
    try {
        const res = await fetch("/api/add-to-drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: currentSample }),
        });
        const result = await res.json();
        alert(result.message);
    } catch (error) {
        console.error("Error adding file to Google Drive:", error);
    }
}

// Detect if the device is mobile
function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

// Detect swipe events for mobile devices
function detectSwipe() {
    let touchstartX = 0;
    let touchendX = 0;

    function handleGesture() {
        if (touchendX < touchstartX) {
            getSample();
        }
        if (touchendX > touchstartX) {
            saveSample();
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

// Set up arrow controls for desktop devices
function setupDesktopControls() {
    const leftArrow = document.getElementById("leftArrow");
    const rightArrow = document.getElementById("rightArrow");

    leftArrow.addEventListener("click", getSample); // Left arrow gets a new sample
    rightArrow.addEventListener("click", saveSample); // Right arrow saves the sample
}

// Function to fetch a new sample and play it in a loop
async function getSample() {
    await loadSample();
    startSession();
}

// Sign-in button click handler to redirect to Google sign-in
document.getElementById("signInButton").addEventListener("click", () => {
    window.location.href = "/auth/google";
});

// Start session button click handler
document.getElementById("startButton").addEventListener("click", startSession);

// Initialize the app on load
init();