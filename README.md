# 🕒 Boss Timer Web App

A mobile-friendly, Firebase-powered web app to track boss spawn timers — designed to work directly from your Android phone and deploy via Firebase Hosting.

## Features
- Firebase Firestore backend
- Guild-based timers and webhooks
- Manual and Scheduled boss timers
- 10-minute warning notifications (Discord embed style, sent once per cycle)
- Auto-restart for manual timers
- Admin panel (admin.html) with global controls
- Offline view-only mode
- Mobile & PWA-ready (installable as Android app)

## Quick Setup (Android-friendly)
1. Create a Firebase project and enable Firestore + Hosting.
2. Put your Firebase config in `firebase.js`.
3. Upload files to GitHub using the GitHub app.
4. Connect your repo to Firebase Hosting via Firebase Console.
5. Publish Firestore rules (use the rules you already added).
6. Access the site at `https://<project-id>.web.app` and Add to Home Screen.

## Admin
- Default admin phrase: `theworldo` (stored at `/config/admin`).
- Admin page: `/admin.html`.

## Notes
- Offline mode: view-only; actions require online.
- Webhooks: client-side sending (URLs visible in client). For privacy move sends to Cloud Functions later.