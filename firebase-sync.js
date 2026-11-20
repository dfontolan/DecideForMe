/**
 * DecideForMe — Firebase Authentication & Cloud Firestore Sync
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  linkWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  reauthenticateWithPopup,
  deleteUser,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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
let lastSyncedJson = "";
let pendingPreSignInLocalState = null;
let isExplicitSignOut = false;

function notifyToast(msg) {
  if (window.DecideForMeApp && typeof window.DecideForMeApp.showToast === "function") {
    window.DecideForMeApp.showToast(msg);
  }
}

function sanitizeForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
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

  if (!user) {
    if (labelEl) labelEl.textContent = "Sign in";
    if (titleEl) titleEl.textContent = "Not signed in";
    if (subtitleEl) subtitleEl.textContent = "Local-only mode";
    if (googleBtn) googleBtn.classList.remove("hidden");
    if (usernameBtn) usernameBtn.classList.remove("hidden");
    if (signOutBtn) signOutBtn.classList.add("hidden");
    setSyncStatus("offline", "Local only");
    return;
  }

  if (accountType === "guest") {
    if (labelEl) labelEl.textContent = "Guest";
    if (titleEl) titleEl.textContent = "Guest Mode";
    if (subtitleEl) subtitleEl.textContent = "Sign in to sync across devices";
    if (googleBtn) googleBtn.classList.remove("hidden");
    if (usernameBtn) usernameBtn.classList.remove("hidden");
    if (signOutBtn) signOutBtn.classList.add("hidden");
  } else if (accountType === "username") {
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

function isUntouchedDefaultState(s) {
  if (!s || typeof s !== "object") return true;
  const hasLogs = Array.isArray(s.logs) && s.logs.length > 0;
  const hasScheduled = Array.isArray(s.scheduledTasks) && s.scheduledTasks.length > 0;
  const hasProc = Array.isArray(s.procrastinationTasks) && s.procrastinationTasks.length > 0;
  const hasStars = s.dailyStarsByDate && Object.keys(s.dailyStarsByDate).length > 0;
  const hasNotes = s.dailyNotesByDate && Object.keys(s.dailyNotesByDate).length > 0;
  const hasRerolls = s.rerollsByDate && Object.keys(s.rerollsByDate).length > 0;
  return !hasLogs && !hasScheduled && !hasProc && !hasStars && !hasNotes && !hasRerolls;
}

function mergeById(primary = [], secondary = []) {
  const map = new Map();
  primary.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  secondary.forEach((item) => {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function mergeLists(cloudLists = [], localLists = []) {
  const byId = new Map();
  cloudLists.forEach((l) => {
    if (l && l.id) byId.set(l.id, { ...l, items: Array.isArray(l.items) ? [...l.items] : [] });
  });
  localLists.forEach((l) => {
    if (!l || !l.id) return;
    if (!byId.has(l.id)) {
      byId.set(l.id, { ...l, items: Array.isArray(l.items) ? [...l.items] : [] });
    } else {
      const existing = byId.get(l.id);
      existing.items = mergeById(existing.items, Array.isArray(l.items) ? l.items : []);
    }
  });
  return Array.from(byId.values());
}

function mergeLocalAndCloudState(localState, cloudState) {
  if (!cloudState) return localState;
  if (!localState || isUntouchedDefaultState(localState)) return cloudState;

  return {
    ...cloudState,
    lists: mergeLists(cloudState.lists, localState.lists),
    dailyTasks: mergeById(cloudState.dailyTasks, localState.dailyTasks),
    scheduledTasks: mergeById(cloudState.scheduledTasks, localState.scheduledTasks),
    procrastinationTasks: mergeById(cloudState.procrastinationTasks, localState.procrastinationTasks),
    logs: mergeById(cloudState.logs, localState.logs).sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    ),
    dailyStarsByDate: { ...(localState.dailyStarsByDate || {}), ...(cloudState.dailyStarsByDate || {}) },
    dailyNotesByDate: { ...(localState.dailyNotesByDate || {}), ...(cloudState.dailyNotesByDate || {}) },
    rerollsByDate: { ...(localState.rerollsByDate || {}), ...(cloudState.rerollsByDate || {}) }
  };
}

async function writeStateToFirestore(user, stateObj, forceMetadataUpdate = false) {
  const sanitized = sanitizeForFirestore(stateObj);
  const json = JSON.stringify(sanitized);
  if (json === lastSyncedJson && !forceMetadataUpdate) {
    setSyncStatus("synced");
    return;
  }
  setSyncStatus("syncing");
  await setDoc(doc(db, "users", user.uid), {
    state: sanitized,
    accountType: getAccountType(user),
    updatedAt: serverTimestamp()
  });
  lastSyncedJson = json;
  setSyncStatus("synced");
}

function scheduleSave(stateObj) {
  if (!currentUser) return;
  pendingState = stateObj;
  setSyncStatus("syncing");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushSave();
  }, 400);
}

async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!currentUser || !pendingState) return;
  const toSave = pendingState;
  pendingState = null;
  try {
    await writeStateToFirestore(currentUser, toSave);
  } catch (err) {
    console.warn("Firestore save deferred/failed:", err);
    setSyncStatus("error");
  }
}

async function attachUserSync(user) {
  if (unsubscribeDoc) {
    unsubscribeDoc();
    unsubscribeDoc = null;
  }

  const userRef = doc(db, "users", user.uid);
  const localBefore = pendingPreSignInLocalState || window.DecideForMeApp?.getState();
  pendingPreSignInLocalState = null;

  try {
    setSyncStatus("syncing");
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      if (localBefore) {
        await writeStateToFirestore(user, localBefore, true);
      }
    } else {
      const cloudData = snap.data();
      const cloudState = cloudData?.state;
      const needsMetadataUpdate =
        cloudData?.accountType !== getAccountType(user);

      if (cloudState) {
        const merged = mergeLocalAndCloudState(localBefore, cloudState);
        const mergedJson = JSON.stringify(sanitizeForFirestore(merged));
        const cloudJson = JSON.stringify(sanitizeForFirestore(cloudState));

        lastSyncedJson = cloudJson;
        window.DecideForMeApp?.applyCloudState(merged);

        if (mergedJson !== cloudJson || needsMetadataUpdate) {
          await writeStateToFirestore(user, merged, needsMetadataUpdate);
          if (mergedJson !== cloudJson) {
            notifyToast("Local data merged with your cloud account!");
          }
        } else {
          setSyncStatus("synced");
        }
      }
    }
  } catch (err) {
    console.warn("Initial Firestore sync error:", err);
    setSyncStatus("error");
  }

  unsubscribeDoc = onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
      const remoteState = snapshot.data()?.state;
      if (!remoteState) return;
      const remoteJson = JSON.stringify(sanitizeForFirestore(remoteState));
      if (remoteJson === lastSyncedJson) return;

      lastSyncedJson = remoteJson;
      window.DecideForMeApp?.applyCloudState(remoteState);
      setSyncStatus("synced");
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

    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const cred = await linkWithPopup(auth.currentUser, googleProvider);
        updateAccountUI(cred.user);
        const currentState = window.DecideForMeApp?.getState();
        if (currentState) {
          await writeStateToFirestore(cred.user, currentState, true);
        }
        notifyToast("Signed in with Google! Your data is now backed up.");
        return;
      } catch (linkErr) {
        if (linkErr.code !== "auth/credential-already-in-use") {
          throw linkErr;
        }
      }
    }

    await signInWithPopup(auth, googleProvider);
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
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          const cred = EmailAuthProvider.credential(internalEmail, password);
          const result = await linkWithCredential(auth.currentUser, cred);
          updateAccountUI(result.user);
          const currentState = window.DecideForMeApp?.getState();
          if (currentState) {
            await writeStateToFirestore(result.user, currentState, true);
          }
          notifyToast(`Account "${username}" created! Your data is now backed up.`);
          return;
        } catch (linkErr) {
          if (linkErr.code === "auth/email-already-in-use" || linkErr.code === "auth/credential-already-in-use") {
            throw new Error("That username is already taken. Try signing in instead.");
          }
          throw linkErr;
        }
      }

      await createUserWithEmailAndPassword(auth, internalEmail, password);
      notifyToast(`Account "${username}" created!`);
      return;
    }

    await signInWithEmailAndPassword(auth, internalEmail, password);
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
          notifyToast("For security, please sign out and sign back in, then delete your account.");
          await attachUserSync(user);
          return;
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
  if (!user) {
    currentUser = null;
    updateAccountUI(null);
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Anonymous sign-in failed:", err);
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
  signInWithGoogle,
  signInWithUsername,
  signOut,
  deleteAccount
};
