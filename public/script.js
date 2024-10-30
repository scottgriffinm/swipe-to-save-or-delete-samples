let currentSample = null;
let originalFile = null;
let sessionStarted = false;
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let playbackTimeoutId = null; // Store the timeout ID globally

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

        // Add click listener to restart the sample
        document.getElementById("audioContainer").addEventListener("click", startPlayback);
    } else {
        document.getElementById("signInButton").style.display = "block";
    }
}

// Function to load a sample
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

            await loadAudioBuffer(`/api/sample/${file}`);

            if (autoplay && sessionStarted) {
                startPlayback();
            }

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

// Load the audio buffer
async function loadAudioBuffer(url) {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Log the duration of the loaded audio file
    console.log(`Loaded audio file length: ${audioBuffer.duration.toFixed(2)} seconds`);
}

// Start playback with seamless looping
function startPlayback() {
    // Clear any existing audio source and timeout
    if (audioSource) {
        audioSource.stop(); // Stop any previous source before starting new playback
    }
    if (playbackTimeoutId) {
        clearTimeout(playbackTimeoutId); // Clear any previous timeout
    }

    // Create and configure the new audio source
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.loop = true; // Enable looping, which we will manually control

    // Connect the source to the output
    audioSource.connect(audioContext.destination);

    // Start the audio source
    audioSource.start();

    // Calculate the stop time as three times the duration
    const playbackDuration = audioBuffer.duration * 3 * 1000; // Convert seconds to milliseconds

    // Set a new timeout to stop playback after three times the duration
    playbackTimeoutId = setTimeout(() => {
        if (audioSource) {
            audioSource.stop(); // Stop playback after the specified duration
            audioSource = null; // Clear the source to allow restarting
        }
    }, playbackDuration);
}

// Stop playback
function stopPlayback() {
    if (audioSource) {
        audioSource.stop();
        audioSource = null;
    }
}

// Start session on "Start Session" button click
function startSession() {
    sessionStarted = true;
    
    const filenameDisplay = document.getElementById("filenameDisplay");
    document.getElementById("startButton").style.display = "none";

    filenameDisplay.style.display = "block";
    filenameDisplay.textContent = `${currentSample}`;
    filenameDisplay.classList.add("fade-in");

    startPlayback(); // Start audio playback
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
            saveMessage.textContent = "Saved to /producer_session";
            saveMessage.classList.add("fade-in-out", "success");
        } else {
            throw new Error(result.error || "Unknown error");
        }
    } catch (error) {
        console.error("Error adding file to Google Drive:", error);
        saveMessage.textContent = "Failed to save.";
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