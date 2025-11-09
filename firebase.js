// ===========================
// Firebase Configuration
// ===========================

const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===========================
// Firebase Helper Class
// ===========================
const FirebaseHelper = {
  // --- Timers ---
  async addTimer(timer) {
    timer.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("timers").add(timer);
  },

  subscribeToTimers(callback) {
    return db.collection("timers")
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
        const timers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(timers);
      });
  },

  async stopAllTimers(adminPhrase) {
    const adminValid = await this.validateAdmin(adminPhrase);
    if (!adminValid) throw new Error("Invalid admin phrase");

    const snapshot = await db.collection("timers").get();
    const batch = db.batch();
    snapshot.forEach(doc => batch.update(doc.ref, { isActive: false }));
    await batch.commit();
  },

  // --- Webhooks ---
  async addWebhook(webhook) {
    webhook.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("webhooks").add(webhook);
  },

  async getWebhooks(callback) {
    db.collection("webhooks").onSnapshot(snapshot => {
      const hooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(hooks);
    });
  },

  async removeWebhook(id) {
    await db.collection("webhooks").doc(id).delete();
  },

  // --- Admin ---
  async validateAdmin(phrase) {
    const doc = await db.collection("config").doc("admin").get();
    return doc.exists && doc.data().phrase === phrase;
  },

  // --- Notifications ---
  async sendDiscordNotification(webhookId, message) {
    const hookDoc = await db.collection("webhooks").doc(webhookId).get();
    if (!hookDoc.exists) throw new Error("Webhook not found");

    const webhookUrl = hookDoc.data().url;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
  }
};