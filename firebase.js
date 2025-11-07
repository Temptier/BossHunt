// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence().catch(err => {
  console.log("Offline persistence failed:", err);
});

// Collection references
const timersRef = db.collection('timers');
const webhooksRef = db.collection('webhooks');
const logsRef = db.collection('logs');
const configRef = db.collection('config').doc('admin');

// Helper Functions
const FirebaseHelper = {
  // Get all timers in real-time
  subscribeToTimers: (callback) => {
    return timersRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
      const timers = [];
      snapshot.forEach(doc => {
        timers.push({ id: doc.id, ...doc.data() });
      });
      callback(timers);
    }, error => {
      console.error("Error fetching timers:", error);
      callback([]);
    });
  },

  // Add a manual timer
  addManualTimer: async (bossName, respawnHours, autoRestartMinutes) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot create timer");
    
    const timerData = {
      type: 'manual',
      bossName,
      respawnHours: parseFloat(respawnHours),
      autoRestartMinutes: autoRestartMinutes ? parseFloat(autoRestartMinutes) : null,
      lastKilledAt: firebase.firestore.FieldValue.serverTimestamp(),
      nextSpawnAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: localStorage.getItem('playerName') || 'Anonymous'
    };
    
    const docRef = await timersRef.add(timerData);
    await FirebaseHelper.logActivity('manual_timer_created', { bossName, timerId: docRef.id });
    return docRef.id;
  },

  // Add a scheduled timer
  addScheduledTimer: async (bossName, dayOfWeek, time) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot create timer");
    
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const daysUntil = (dayOfWeek - now.getDay() + 7) % 7;
    
    const nextSpawn = new Date(now);
    nextSpawn.setDate(now.getDate() + daysUntil);
    nextSpawn.setHours(hours, minutes, 0, 0);
    
    if (nextSpawn <= now) {
      nextSpawn.setDate(nextSpawn.getDate() + 7);
    }

    // Check for existing timer with same boss name
    const existingSnapshot = await timersRef.where('bossName', '==', bossName).where('type', '==', 'scheduled').get();
    
    if (!existingSnapshot.empty) {
      // Update existing
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.update({
        dayOfWeek,
        time,
        nextSpawnAt: firebase.firestore.Timestamp.fromDate(nextSpawn),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await FirebaseHelper.logActivity('scheduled_timer_updated', { bossName, timerId: existingDoc.id });
      return existingDoc.id;
    } else {
      // Create new
      const timerData = {
        type: 'scheduled',
        bossName,
        dayOfWeek,
        time,
        nextSpawnAt: firebase.firestore.Timestamp.fromDate(nextSpawn),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: localStorage.getItem('playerName') || 'Anonymous'
      };
      
      const docRef = await timersRef.add(timerData);
      await FirebaseHelper.logActivity('scheduled_timer_created', { bossName, timerId: docRef.id });
      return docRef.id;
    }
  },

  // Restart a manual timer
  restartTimer: async (timerId) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot restart timer");
    
    await timersRef.doc(timerId).update({
      lastKilledAt: firebase.firestore.FieldValue.serverTimestamp(),
      restartedAt: firebase.firestore.FieldValue.serverTimestamp(),
      restartedBy: localStorage.getItem('playerName') || 'Anonymous'
    });
    await FirebaseHelper.logActivity('timer_restarted', { timerId });
  },

  // Stop all timers (admin only)
  stopAllTimers: async (adminPhrase) => {
    const config = await configRef.get();
    if (!config.exists || config.data().adminPhrase !== adminPhrase) {
      throw new Error("Invalid admin phrase");
    }

    const batch = db.batch();
    const timersSnapshot = await timersRef.get();
    
    timersSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        stoppedAt: firebase.firestore.FieldValue.serverTimestamp(),
        stoppedBy: 'admin'
      });
    });
    
    await batch.commit();
    await FirebaseHelper.logActivity('all_timers_stopped', { admin: true });
  },

  // Webhook management
  addWebhook: async (name, url) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot add webhook");
    
    // Check for duplicates
    const existing = await webhooksRef.where('url', '==', url).get();
    if (!existing.empty) throw new Error("Webhook already exists");
    
    const webhookData = {
      name,
      url,
      createdBy: localStorage.getItem('playerName') || 'Anonymous',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastUsed: null
    };
    
    const docRef = await webhooksRef.add(webhookData);
    await FirebaseHelper.logActivity('webhook_added', { webhookName: name });
    return docRef.id;
  },

  getWebhooks: (callback) => {
    return webhooksRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
      const webhooks = [];
      snapshot.forEach(doc => {
        webhooks.push({ id: doc.id, ...doc.data() });
      });
      callback(webhooks);
    });
  },

  removeWebhook: async (webhookId) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot remove webhook");
    await webhooksRef.doc(webhookId).delete();
    await FirebaseHelper.logActivity('webhook_removed', { webhookId });
  },

  // Logging
  logActivity: async (action, data = {}) => {
    if (!navigator.onLine) return; // Don't log when offline
    
    await logsRef.add({
      action,
      data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      user: localStorage.getItem('playerName') || 'Anonymous'
    });
  },

  // Send Discord notification
  sendDiscordNotification: async (webhookId, message) => {
    if (!navigator.onLine) throw new Error("Offline mode - cannot send notifications");
    
    const webhook = await webhooksRef.doc(webhookId).get();
    if (!webhook.exists) throw new Error("Webhook not found");
    
    const webhookUrl = webhook.data().url;
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          username: "Boss Chronos Arena",
          avatar_url: "https://static.photos/technology/1200x630/42"
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      await webhooksRef.doc(webhookId).update({
        lastUsed: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error("Failed to send Discord notification:", error);
      throw error;
    }
  },

  // Admin validation
  validateAdmin: async (phrase) => {
    const config = await configRef.get();
    return config.exists && config.data().adminPhrase === phrase;
  }
};