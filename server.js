// server.js
const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const passport = require("passport");
const { google } = require("googleapis");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const config = require("./config");

const app = express();
const PORT = 3000;

// JSON parsing middleware
app.use(express.json());

// Session management
app.use(
    session({
        secret: "asdgawtwgawtwteetetw",
        resave: false,
        saveUninitialized: true,
    })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: config.googleClientID,
            clientSecret: config.googleClientSecret,
            callbackURL: "http://localhost:3000/auth/google/callback",
        },
        (accessToken, refreshToken, profile, done) => {
            profile.accessToken = accessToken;
            return done(null, profile);
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Authentication routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email", "https://www.googleapis.com/auth/drive.file"] }));
app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
    res.redirect("/");
});

// Authentication status route
app.get("/auth/status", (req, res) => {
    res.json({ isAuthenticated: req.isAuthenticated() });
});

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect("/auth/google");
};

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Endpoint to get one random .wav file with "#" replaced by "sharp" in the URL
app.get("/api/sample", isAuthenticated, (req, res) => {
    const samplesDir = path.join(__dirname, "samples");

    fs.readdir(samplesDir, (err, files) => {
        if (err) {
            console.error("Error reading samples directory:", err);
            return res.status(500).json({ error: "Failed to load samples." });
        }

        // Filter for .wav files and select one random file
        const wavFiles = files.filter(file => file.endsWith(".wav"));
        const randomIndex = Math.floor(Math.random() * wavFiles.length);
        const originalFile = wavFiles[randomIndex];
        const modifiedFile = originalFile.replace(/#/g, "sharp");

        res.json({
            file: modifiedFile, // Send the modified filename
            originalFile,       // Send the original filename for Drive saving
        });
    });
});

// Endpoint to serve the actual files, using the original filename
app.get("/api/sample/:filename", isAuthenticated, (req, res) => {
    const filename = req.params.filename.replace(/sharp/g, "#"); // Replace "sharp" with "#"
    const filePath = path.join(__dirname, "samples", filename);

    console.log("Requested file path:", filePath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    res.sendFile(filePath);
});

// Endpoint to add a file to Google Drive, using the original filename
app.post("/api/add-to-drive", isAuthenticated, async (req, res) => {
    const { fileName } = req.body; // Receive filename directly
    const originalFileName = fileName.replace(/sharp/g, "#");
    const filePath = path.join(__dirname, "samples", originalFileName);

    console.log("Adding file to Google Drive:", filePath);

    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return res.status(404).json({ error: "File not found" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: req.user.accessToken });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
        const folderResponse = await drive.files.list({
            q: "name = 'sample saves' and mimeType = 'application/vnd.google-apps.folder'",
            fields: "files(id, name)",
        });

        let folderId;
        if (folderResponse.data.files.length) {
            folderId = folderResponse.data.files[0].id;
        } else {
            const folder = await drive.files.create({
                resource: { name: "sample saves", mimeType: "application/vnd.google-apps.folder" },
                fields: "id",
            });
            folderId = folder.data.id;
        }

        await drive.files.create({
            requestBody: { name: originalFileName, parents: [folderId] },
            media: { mimeType: "audio/wav", body: fs.createReadStream(filePath) },
            fields: "id",
        });

        res.status(200).json({ message: "File added to Google Drive successfully!" });
    } catch (error) {
        console.error("Error adding file to Google Drive:", error);
        res.status(500).json({ error: "Failed to add file to Google Drive." });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});