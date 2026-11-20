/**
 * DecideForMe — Firebase Authentication & Cloud Firestore Sync
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  deleteUser,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";

const firebaseConfig = {
  projectId: "decideforme-55674",
  appId: "1:1042936516436:web:c516f128335377314f82c1",
  storageBucket: "decideforme-55674.firebasestorage.app",
  apiKey: "AIzaSyAgPplLXWk7aYVPedG2WLpGtQcDa0ksiXQ",
  authDomain: "decideforme-55674.firebaseapp.com",
  messagingSenderId: "1042936516436",
  measurementId: "G-CM5VFFWF7S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let analytics = null;
isAnalyticsSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {});

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (err) {
  db = getFirestore(app);
}

let currentUser = null;
let unsubscribeDoc = null;
let saveTimer = null;
let pendingState = null;
let activeFlushPromise = null;
let lastSyncedJson = "";
let pendingPreSignInLocalState = null;
let isExplicitSignOut = false;

function notifyToast(msg) {
  if (window.DecideForMeApp && typeof window.DecideForMeApp.showToast === "function") {
    window.DecideForMeApp.showToast(msg);
  }
}

function trackEvent(eventName, params = {}) {
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, {
      account_type: getAccountType(currentUser),
      ...params
    });
  } catch {
    // Ignore analytics errors
  }
}

function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const LOCAL_ONLY_STATE_KEYS = [
  "collapsedCards",
  "activeDecision",
  "activeListId",
  "calendarView"
];

function sanitizeCloudState(obj) {
  const cloned = sanitizeForFirestore(obj);
  if (cloned && typeof cloned === "object") {
    for (const key of LOCAL_ONLY_STATE_KEYS) {
      delete cloned[key];
    }
  }
  return cloned;
}

const CRYPTO_PEPPER = "DecideForMe-Sync-v1-2026";
const CRYPTO_VERSION = 1;
const cryptoKeyCache = new Map();

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getUserCryptoKey(uid) {
  if (cryptoKeyCache.has(uid)) {
    return cryptoKeyCache.get(uid);
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${CRYPTO_PEPPER}:${uid}`),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`dfm-salt:${uid}`),
      iterations: 10000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  cryptoKeyCache.set(uid, key);
  return key;
}

async function encryptStatePayload(uid, stateObj) {
  const key = await getUserCryptoKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(stateObj));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    payload: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
    v: CRYPTO_VERSION
  };
}

async function decryptCloudData(uid, cloudData) {
  if (!cloudData || typeof cloudData !== "object") return null;
  if (typeof cloudData.payload === "string" && typeof cloudData.iv === "string") {
    const key = await getUserCryptoKey(uid);
    const iv = base64ToBytes(cloudData.iv);
    const cipherBytes = base64ToBytes(cloudData.payload);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
    return JSON.parse(new TextDecoder().decode(plainBuffer));
  }
  if (cloudData.state && typeof cloudData.state === "object") {
    return cloudData.state;
  }
  return null;
}

function setSyncStatus(status, detail = "") {
  const dot = document.getElementById("account-sync-dot");
  const statusEl = document.getElementById("account-sync-status");
  if (dot) {
    dot.dataset.status = status;
  }
  if (statusEl) {
    statusEl.textContent = detail || (
      status === "synced" ? "Cloud synced" :
      status === "syncing" ? "Syncing..." :
      status === "error" ? "Sync paused (offline)" :
      "Connecting..."
    );
  }
}

const INTERNAL_EMAIL_DOMAIN = "users.decideforme.app";

function getAccountType(user) {
  if (!user || user.isAnonymous) return "guest";
  if (user.email && user.email.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)) {
    return "username";
  }
  return "google";
}

function usernameToInternalEmail(rawUsername) {
  const normalized = String(rawUsername || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{5,24}$/.test(normalized)) {
    throw new Error("Username must be 5–24 characters (letters, numbers, ., _, -).");
  }
  return {
    username: normalized,
    internalEmail: `${normalized}@${INTERNAL_EMAIL_DOMAIN}`
  };
}

function updateAccountUI(user) {
  const labelEl = document.getElementById("account-btn-label");
  const titleEl = document.getElementById("account-user-title");
  const subtitleEl = document.getElementById("account-user-subtitle");
  const googleBtn = document.getElementById("btn-google-signin");
  const usernameBtn = document.getElementById("btn-username-signin");
  const signOutBtn = document.getElementById("btn-google-signout");
  const deleteAccountBtns = [
    document.getElementById("btn-delete-account"),
    document.getElementById("btn-delete-account-footer")
  ];

  const accountType = getAccountType(user);
  const isSignedInAccount = accountType === "google" || accountType === "username";
  deleteAccountBtns.forEach((btn) => {
    if (btn) btn.classList.toggle("hidden", !isSignedInAccount);
  });

  if (!user || accountType === "guest") {
    if (labelEl) labelEl.textContent = "Guest";
    if (titleEl) titleEl.textContent = "Guest Mode";
    if (subtitleEl) subtitleEl.textContent = "Sign in to sync across devices";
    if (googleBtn) googleBtn.classList.remove("hidden");
    if (usernameBtn) usernameBtn.classList.remove("hidden");
    if (signOutBtn) signOutBtn.classList.add("hidden");
    setSyncStatus("offline", "Local only");
    return;
  }

  if (accountType === "username") {
    const username = (user.email || "user").split("@")[0];
    if (labelEl) labelEl.textContent = username;
    if (titleEl) titleEl.textContent = username;
    if (subtitleEl) subtitleEl.textContent = "Private account (no email)";
    if (googleBtn) googleBtn.classList.add("hidden");
    if (usernameBtn) usernameBtn.classList.add("hidden");
    if (signOutBtn) signOutBtn.classList.remove("hidden");
  } else {
    const firstName = (user.displayName || user.email || "Account").split(" ")[0];
    if (labelEl) labelEl.textContent = firstName;
    if (titleEl) titleEl.textContent = user.displayName || "Google Account";
    if (subtitleEl) subtitleEl.textContent = user.email || "Synced";
    if (googleBtn) googleBtn.classList.add("hidden");
    if (usernameBtn) usernameBtn.classList.add("hidden");
    if (signOutBtn) signOutBtn.classList.remove("hidden");
  }
}

const DEFAULT_DAILY_TASKS_SIGNATURE = JSON.stringify([
  { id: "daily_1", title: "Make bed", doneToday: false },
  { id: "daily_2", title: "Drink 2L water", doneToday: false },
  { id: "daily_3", title: "Take vitamins", doneToday: false }
]);

const DEFAULT_LISTS_SIGNATURE = JSON.stringify([
  {
    id: "list_chill",
    name: "Low Energy / Chill",
    color: "#3b82f6",
    items: [
      { id: "item_ch_1", title: "Light 10-min stretch", checked: true, weight: 1 },
      { id: "item_ch_2", title: "Make tea & look outside", checked: true, weight: 1 },
      { id: "item_ch_3", title: "Guided breathing or 10-min meditation", checked: true, weight: 1 }
    ]
  },
  {
    id: "list_30m",
    name: "30 Min Tasks",
    color: "#f59e0b",
    items: [
      { id: "item_30_1", title: "Read a book", checked: true, weight: 1 },
      { id: "item_30_2", title: "Exercise at home", checked: true, weight: 1 },
      { id: "item_30_3", title: "Mobility & full-body stretching", checked: true, weight: 1 },
      { id: "item_30_4", title: "Outdoor walk", checked: true, weight: 1 },
      { id: "item_30_5", title: "Tidy space & quick reset", checked: true, weight: 1 }
    ]
  },
  {
    id: "list_60m",
    name: "60+ Min Tasks",
    color: "#ef4444",
    items: [
      { id: "item_60_1", title: "Go to the gym", checked: true, weight: 1 },
      { id: "item_60_2", title: "Full home workout", checked: true, weight: 1 },
      { id: "item_60_3", title: "Cook a proper meal from scratch", checked: true, weight: 1 },
      { id: "item_60_4", title: "Long walk or run", checked: true, weight: 1 }
    ]
  }
]);

function isUntouchedDefaultState(s) {
  if (!s || typeof s !== "object") return true;
  const hasLogs = Array.isArray(s.logs) && s.logs.length > 0;
  const hasScheduled = Array.isArray(s.scheduledTasks) && s.scheduledTasks.length > 0;
  const hasProc = Array.isArray(s.procrastinationTasks) && s.procrastinationTasks.length > 0;
  const hasStars = s.dailyStarsByDate && Object.keys(s.dailyStarsByDate).length > 0;
  const hasNotes = s.dailyNotesByDate && Object.keys(s.dailyNotesByDate).length > 0;
  const hasRerolls = s.rerollsByDate && Object.keys(s.rerollsByDate).length > 0;
  const hasActiveDecision = Boolean(s.activeDecision);
  const hasDeletedIds = s.deletedIds && Object.keys(s.deletedIds).length > 0;
  const hasResetAt = typeof s.resetAt === "number" && s.resetAt > 0;
  if (
    hasLogs ||
    hasScheduled ||
    hasProc ||
    hasStars ||
    hasNotes ||
    hasRerolls ||
    hasActiveDecision ||
    hasDeletedIds ||
    hasResetAt
  ) {
    return false;
  }

  if (Array.isArray(s.dailyTasks)) {
    const dailySig = JSON.stringify(
      s.dailyTasks.map((t) => ({ id: t?.id, title: t?.title, doneToday: Boolean(t?.doneToday) }))
    );
    if (dailySig !== DEFAULT_DAILY_TASKS_SIGNATURE) return false;
  }

  if (Array.isArray(s.lists)) {
    const listsSig = JSON.stringify(
      s.lists.map((l) => ({
        id: l?.id,
        name: l?.name,
        color: l?.color,
        items: Array.isArray(l?.items)
          ? l.items.map((i) => ({
              id: i?.id,
              title: i?.title,
              checked: Boolean(i?.checked),
              weight: i?.weight ?? 1
            }))
          : []
      }))
    );
    if (listsSig !== DEFAULT_LISTS_SIGNATURE) return false;
  }

  return true;
}

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function mergeDeletedIds(cloudDeleted = {}, localDeleted = {}) {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const merged = {};
  [cloudDeleted, localDeleted].forEach((source) => {
    if (!source || typeof source !== "object") return;
    Object.entries(source).forEach(([id, ts]) => {
      if (typeof ts === "number" && ts >= cutoff) {
        if (!merged[id] || ts > merged[id]) {
          merged[id] = ts;
        }
      }
    });
  });
  return merged;
}

function mergeById(primary = [], secondary = [], deletedIds = {}) {
  const map = new Map();
  primary.forEach((item) => {
    if (item && item.id && !deletedIds[item.id]) map.set(item.id, item);
  });
  secondary.forEach((item) => {
    if (item && item.id && !deletedIds[item.id] && !map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function mergeLists(cloudLists = [], localLists = [], deletedIds = {}) {
  const byId = new Map();
  cloudLists.forEach((l) => {
    if (l && l.id && !deletedIds[l.id]) {
      const items = Array.isArray(l.items)
        ? l.items.filter((i) => i && i.id && !deletedIds[i.id])
        : [];
      byId.set(l.id, { ...l, items });
    }
  });
  localLists.forEach((l) => {
    if (!l || !l.id || deletedIds[l.id]) return;
    const localItems = Array.isArray(l.items)
      ? l.items.filter((i) => i && i.id && !deletedIds[i.id])
      : [];
    if (!byId.has(l.id)) {
      byId.set(l.id, { ...l, items: localItems });
    } else {
      const existing = byId.get(l.id);
      existing.items = mergeById(existing.items, localItems, deletedIds);
    }
  });
  return Array.from(byId.values());
}

function mergeLocalAndCloudState(localState, cloudState, preferLocal = false) {
  const cleanCloud = cloudState ? sanitizeCloudState(cloudState) : null;
  const cleanLocal = localState ? sanitizeCloudState(localState) : null;
  if (!cleanCloud) return cleanLocal;
  if (!cleanLocal || (!preferLocal && isUntouchedDefaultState(cleanLocal))) return cleanCloud;

  const cloudResetAt = typeof cleanCloud.resetAt === "number" ? cleanCloud.resetAt : 0;
  const localResetAt = typeof cleanLocal.resetAt === "number" ? cleanLocal.resetAt : 0;
  if (cloudResetAt > localResetAt) return cleanCloud;
  if (localResetAt > cloudResetAt) return cleanLocal;

  const deletedIds = mergeDeletedIds(cleanCloud.deletedIds, cleanLocal.deletedIds);
  const primary = preferLocal ? cleanLocal : cleanCloud;
  const secondary = preferLocal ? cleanCloud : cleanLocal;

  return {
    ...primary,
    deletedIds,
    resetAt: cloudResetAt,
    lists: mergeLists(primary.lists, secondary.lists, deletedIds),
    dailyTasks: mergeById(primary.dailyTasks, secondary.dailyTasks, deletedIds),
    scheduledTasks: mergeById(primary.scheduledTasks, secondary.scheduledTasks, deletedIds),
    procrastinationTasks: mergeById(
      primary.procrastinationTasks,
      secondary.procrastinationTasks,
      deletedIds
    ),
    logs: mergeById(primary.logs, secondary.logs, deletedIds).sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    ),
    dailyStarsByDate: { ...(secondary.dailyStarsByDate || {}), ...(primary.dailyStarsByDate || {}) },
    dailyNotesByDate: { ...(secondary.dailyNotesByDate || {}), ...(primary.dailyNotesByDate || {}) },
    rerollsByDate: { ...(secondary.rerollsByDate || {}), ...(primary.rerollsByDate || {}) }
  };
}

async function writeStateToFirestore(user, stateObj, forceMetadataUpdate = false) {
  if (!user || user.isAnonymous) return;
  const sanitized = sanitizeCloudState(stateObj);
  const json = JSON.stringify(sanitized);
  if (json === lastSyncedJson && !forceMetadataUpdate) {
    setSyncStatus("synced");
    return;
  }
  const prevSyncedJson = lastSyncedJson;
  lastSyncedJson = json;
  setSyncStatus("syncing");
  try {
    const encrypted = await encryptStatePayload(user.uid, sanitized);
    await setDoc(doc(db, "users", user.uid), {
      ...encrypted,
      accountType: getAccountType(user),
      updatedAt: serverTimestamp()
    });
    setSyncStatus("synced");
  } catch (err) {
    if (lastSyncedJson === json) {
      lastSyncedJson = prevSyncedJson;
    }
    throw err;
  }
}

function scheduleSave(stateObj) {
  if (!currentUser || currentUser.isAnonymous) return;
  const sanitized = sanitizeCloudState(stateObj);
  if (JSON.stringify(sanitized) === lastSyncedJson && !pendingState) {
    return;
  }
  pendingState = sanitized;
  setSyncStatus("syncing");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSave();
  }, 400);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (activeFlushPromise) {
    return activeFlushPromise;
  }
  if (!currentUser || currentUser.isAnonymous || !pendingState) {
    return Promise.resolve();
  }

  activeFlushPromise = (async () => {
    try {
      while (currentUser && !currentUser.isAnonymous && pendingState) {
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        const toSave = pendingState;
        pendingState = null;
        await writeStateToFirestore(currentUser, toSave);
      }
    } catch (err) {
      console.warn("Firestore save deferred/failed:", err);
      setSyncStatus("error");
    } finally {
      activeFlushPromise = null;
    }
  })();

  return activeFlushPromise;
}

async function attachUserSync(user) {
  if (unsubscribeDoc) {
    unsubscribeDoc();
    unsubscribeDoc = null;
  }

  if (!user || user.isAnonymous) {
    setSyncStatus("offline", "Local only");
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const preSignInState = pendingPreSignInLocalState;
  pendingPreSignInLocalState = null;

  setSyncStatus("syncing");
  let hasHandledInitialSnapshot = false;
  let isProcessingInitialSnapshot = false;

  unsubscribeDoc = onSnapshot(
    userRef,
    async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      if (!hasHandledInitialSnapshot) {
        if (isProcessingInitialSnapshot) return;
        isProcessingInitialSnapshot = true;
        hasHandledInitialSnapshot = true;
        try {
          const hasPendingLocal = Boolean(saveTimer || pendingState || activeFlushPromise);
          const localLatest = preSignInState || window.DecideForMeApp?.getState();

          if (!snapshot.exists()) {
            if (localLatest) {
              if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
              }
              pendingState = null;
              await writeStateToFirestore(user, localLatest, true);
            } else {
              setSyncStatus("synced");
            }
          } else {
            const cloudData = snapshot.data();
            const cloudState = await decryptCloudData(user.uid, cloudData);
            const needsEncryptionUpgrade = Boolean(cloudData && !cloudData.payload && cloudData.state);
            const needsMetadataUpdate =
              cloudData?.accountType !== getAccountType(user) || needsEncryptionUpgrade;

            if (cloudState) {
              const cleanCloud = sanitizeCloudState(cloudState);
              const cleanLocal = localLatest ? sanitizeCloudState(localLatest) : null;
              const merged = mergeLocalAndCloudState(cleanLocal, cleanCloud, hasPendingLocal);
              const mergedJson = JSON.stringify(merged);
              const cloudJson = JSON.stringify(cleanCloud);
              const localJson = cleanLocal ? JSON.stringify(cleanLocal) : "";

              lastSyncedJson = cloudJson;
              if (mergedJson !== localJson) {
                window.DecideForMeApp?.applyCloudState(merged);
              }

              if (mergedJson !== cloudJson || needsMetadataUpdate) {
                if (saveTimer) {
                  clearTimeout(saveTimer);
                  saveTimer = null;
                }
                pendingState = null;
                await writeStateToFirestore(user, merged, needsMetadataUpdate);
                if (mergedJson !== cloudJson && !hasPendingLocal) {
                  notifyToast("Local data merged with your cloud account!");
                }
              } else {
                setSyncStatus("synced");
              }
            } else {
              setSyncStatus("synced");
            }
          }
        } catch (err) {
          console.warn("Initial Firestore sync error:", err);
          setSyncStatus("error");
        } finally {
          isProcessingInitialSnapshot = false;
        }
        return;
      }

      if (saveTimer !== null || pendingState !== null || activeFlushPromise !== null) return;
      if (!snapshot.exists()) return;
      try {
        const remoteState = await decryptCloudData(user.uid, snapshot.data());
        if (!remoteState) return;
        const cleanRemote = sanitizeCloudState(remoteState);
        const remoteJson = JSON.stringify(cleanRemote);
        if (remoteJson === lastSyncedJson) return;

        lastSyncedJson = remoteJson;
        window.DecideForMeApp?.applyCloudState(cleanRemote);
        setSyncStatus("synced");
      } catch (decryptErr) {
        console.warn("Firestore snapshot decrypt error:", decryptErr);
        setSyncStatus("error");
      }
    },
    (err) => {
      console.warn("Firestore snapshot listener error:", err);
      setSyncStatus("error");
    }
  );
}

async function signInWithGoogle() {
  try {
    const localSnapshot = window.DecideForMeApp?.getState();
    pendingPreSignInLocalState = localSnapshot ? sanitizeForFirestore(localSnapshot) : null;

    await signInWithPopup(auth, googleProvider);
    trackEvent("login", { method: "google" });
    notifyToast("Signed in with Google!");
  } catch (err) {
    pendingPreSignInLocalState = null;
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      return;
    }
    if (err.code === "auth/unauthorized-domain") {
      notifyToast("Add this domain to Firebase Console → Auth → Authorized domains.");
    } else {
      notifyToast("Google sign-in failed. Please try again.");
    }
    console.error("Google sign-in error:", err);
  }
}

async function signInWithUsername(rawUsername, password, isSignUp) {
  const { username, internalEmail } = usernameToInternalEmail(rawUsername);
  if (!password || password.length < 8) {
    throw new Error(
      isSignUp
        ? "please make me proud, use a better password"
        : "Password must be at least 8 characters."
    );
  }

  const localSnapshot = window.DecideForMeApp?.getState();
  pendingPreSignInLocalState = localSnapshot ? sanitizeForFirestore(localSnapshot) : null;

  try {
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, internalEmail, password);
      trackEvent("sign_up", { method: "username" });
      notifyToast(`Account "${username}" created!`);
      return;
    }

    await signInWithEmailAndPassword(auth, internalEmail, password);
    trackEvent("login", { method: "username" });
    notifyToast(`Signed in as ${username}!`);
  } catch (err) {
    pendingPreSignInLocalState = null;
    if (err.code === "auth/email-already-in-use") {
      throw new Error("That username is already taken. Try signing in instead.");
    }
    if (
      err.code === "auth/wrong-password" ||
      err.code === "auth/user-not-found" ||
      err.code === "auth/invalid-credential"
    ) {
      throw new Error("Incorrect username or password.");
    }
    if (err.code === "auth/weak-password") {
      throw new Error("Password must be at least 6 characters.");
    }
    if (err.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait a moment and try again.");
    }
    throw err;
  }
}

async function signOut() {
  try {
    await flushSave();
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
    isExplicitSignOut = true;
    lastSyncedJson = "";
    await firebaseSignOut(auth);
    window.DecideForMeApp?.resetToDefaultState();
    notifyToast("Signed out. Switched to a fresh Guest session.");
  } catch (err) {
    isExplicitSignOut = false;
    console.error("Sign out error:", err);
    notifyToast("Could not sign out. Please try again.");
  }
}

function reauthenticateUsernameWithModal(user) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-reauth-password");
    const form = document.getElementById("form-reauth-password");
    const input = document.getElementById("input-reauth-password");
    const errorEl = document.getElementById("reauth-password-error");
    const cancelBtn = document.getElementById("btn-reauth-cancel");
    const submitBtn = document.getElementById("btn-reauth-submit");

    if (!modal || !form || !input || !cancelBtn || !submitBtn) {
      resolve(false);
      return;
    }

    input.value = "";
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Delete Account";
    modal.classList.remove("hidden");
    setTimeout(() => input.focus(), 30);

    const cleanup = () => {
      modal.classList.add("hidden");
      form.removeEventListener("submit", onSubmit);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdrop = (e) => {
      if (e.target === modal) onCancel();
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") onCancel();
    };

    const onSubmit = async (e) => {
      e.preventDefault();
      const password = input.value;
      if (!password) {
        if (errorEl) {
          errorEl.textContent = "Please enter your password.";
          errorEl.classList.remove("hidden");
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying...";
      if (errorEl) errorEl.classList.add("hidden");

      try {
        const cred = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, cred);
        cleanup();
        resolve(true);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Delete Account";
        if (errorEl) {
          if (
            err.code === "auth/wrong-password" ||
            err.code === "auth/invalid-credential"
          ) {
            errorEl.textContent = "Incorrect password. Please try again.";
          } else if (err.code === "auth/too-many-requests") {
            errorEl.textContent = "Too many attempts. Please wait a moment and try again.";
          } else {
            errorEl.textContent = err.message || "Could not verify password.";
          }
          errorEl.classList.remove("hidden");
        }
      }
    };

    form.addEventListener("submit", onSubmit);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}

async function deleteAccount() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingState = null;

  if (unsubscribeDoc) {
    unsubscribeDoc();
    unsubscribeDoc = null;
  }

  try {
    try {
      await deleteDoc(doc(db, "users", user.uid));
    } catch (docErr) {
      console.warn("Could not delete Firestore doc before auth deletion:", docErr);
    }

    try {
      await deleteUser(user);
    } catch (authErr) {
      if (authErr.code === "auth/requires-recent-login") {
        if (getAccountType(user) === "google") {
          await reauthenticateWithPopup(user, googleProvider);
          await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
          await deleteUser(user);
        } else {
          const verified = await reauthenticateUsernameWithModal(user);
          if (!verified) {
            notifyToast("Account deletion cancelled.");
            await attachUserSync(user);
            return;
          }
          await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
          await deleteUser(user);
        }
      } else {
        throw authErr;
      }
    }

    lastSyncedJson = "";
    window.DecideForMeApp?.resetToDefaultState();
    notifyToast("Your account and cloud data have been permanently deleted.");
  } catch (err) {
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      notifyToast("Account deletion cancelled.");
      await attachUserSync(user);
      return;
    }
    console.error("Delete account error:", err);
    notifyToast("Could not delete account. Please try again.");
    await attachUserSync(user);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user || user.isAnonymous) {
    currentUser = null;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingState = null;
    updateAccountUI(null);
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
    if (user && user.isAnonymous) {
      firebaseSignOut(auth).catch(() => {});
    }
    return;
  }

  isExplicitSignOut = false;
  currentUser = user;
  updateAccountUI(user);
  await attachUserSync(user);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushSave();
  }
});
window.addEventListener("beforeunload", () => {
  flushSave();
});

window.DecideForMeCloud = {
  scheduleSave,
  flushSave,
  trackEvent,
  signInWithGoogle,
  signInWithUsername,
  signOut,
  deleteAccount
};
