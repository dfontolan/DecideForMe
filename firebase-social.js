/**
 * DecideForMe — Minimal Social Module (6-digit Friend Codes, Daily Stars & Nudges)
 * Available only to signed-in (non-guest) accounts.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const THEME_NUDGE_PRESETS = {
  dark: {
    none: [
      "{name} says: DON'T GIVE UP!! Keep swinging! 💪",
      "{name} yells: KEEP TRYING!! You've got this! 🔥",
      "{name} says: NO QUITTING ALLOWED!! Keep pushing! 🚀",
      "{name} says: YOU CAN DO THIS!! Keep going! ✨"
    ],
    bronze: [
      "{name} says: Bronze Star! ★ Don't stop now, keep going! 💪",
      "{name} yells: YOU CAN DO THIS!! Bronze is just warm-up! 🔥",
      "{name} says: Bronze Star! ★ No quitting — keep pushing! 🚀",
      "{name} says: Bronze Star! ★ Keep the engine running! 💥"
    ],
    silver: [
      "{name} says: Silver Star! ★ Don't give up now, keep pushing! 💪",
      "{name} yells: SILVER STAR!! ★ YOU CAN DO THIS — keep going! 🔥",
      "{name} says: Silver Star! ★ No coasting — stay locked in! 🚀",
      "{name} says: SILVER STAR?! ★ Keep grinding, don't quit! ⚡"
    ],
    gold: [
      "{name} says: LET'S FUCKING GO!! GOLD STAR!! ⭐ 🔥",
      "{name} is celebrating your Gold Star! ⭐ YOU DID THAT!! 💪",
      "{name} saw your Gold Star! ⭐ UNSTOPPABLE!! 🏆",
      "{name} says: GOLD STAR BABY!! ⭐ 🚀",
      "{name} says: GOLD STAR?! BEAST MODE!! ★ 💪"
    ]
  },
  astrology: {
    none: [
      "{name} says: Mercury's in Gatorade, NOT you — DON'T GIVE UP! 🔮",
      "{name} says: Your birth chart says KEEP TRYING!! ✨",
      "{name} yells: Blame the moon if you want, just DON'T QUIT! 🌙",
      "{name} says: The cosmos demands you KEEP PUSHING!! 🚀"
    ],
    bronze: [
      "{name} says: Bronze Star! ★ Rising sign energy — keep going! 🔮",
      "{name} yells: YOU CAN DO THIS!! Bronze is just the first house! ✨",
      "{name} says: Bronze Star! ★ No cosmic quitting now! 🌙",
      "{name} says: Bronze Star! ★ The stars say keep pushing! 💫"
    ],
    silver: [
      "{name} says: Silver Star! ★ Big Leo energy — don't stop now! 🦁",
      "{name} yells: SILVER STAR!! ★ Keep going, universe is watching! 🔮",
      "{name} says: Silver Star! ★ No retrograde excuses — keep pushing! 🚀",
      "{name} says: SILVER STAR?! ★ Stay aligned, don't quit! ⚡"
    ],
    gold: [
      "{name} says: LET'S FUCKING GO!! FULL MOON GOLD STAR!! ⭐ 🔮",
      "{name} saw your Gold Star! ⭐ COSMIC BEAST MODE!! ✨",
      "{name} says: GOLD STAR BABY!! ⭐ WRITTEN IN THE STARS!! 🚀",
      "{name} is celebrating your Gold Star! ⭐ PURE MAIN-CHARACTER ORBIT!! 🏆"
    ]
  },
  tarot: {
    none: [
      "{name} drew The Fool for you: KEEP TRYING anyway!! 🃏",
      "{name} says: Reversed Tower vibes? DON'T GIVE UP!! 💪",
      "{name} yells: Flip the next card — NO QUITTING ALLOWED!! 🔥",
      "{name} says: Fate says KEEP SWINGING!! You've got this! ✨"
    ],
    bronze: [
      "{name} says: Bronze Star! ★ Just card one — keep drawing! 🃏",
      "{name} yells: YOU CAN DO THIS!! Bronze is only the Minor Arcana! 🔥",
      "{name} says: Bronze Star! ★ Don't fold now, keep going! 💪",
      "{name} says: Bronze Star! ★ Keep pulling cards! ✨"
    ],
    silver: [
      "{name} says: Silver Star! ★ Major Arcana energy — keep pushing! 🃏",
      "{name} yells: SILVER STAR!! ★ YOU CAN DO THIS — don't quit! 🔥",
      "{name} says: Silver Star! ★ The Chariot says keep rolling! 🚀",
      "{name} says: SILVER STAR?! ★ Stay in the deck, keep going! ⚡"
    ],
    gold: [
      "{name} says: LET'S FUCKING GO!! THE SUN CARD!! GOLD STAR!! ⭐ 🃏",
      "{name} saw your Gold Star! ⭐ STRAIGHT MAJOR ARCANA BEAST MODE!! 💪",
      "{name} says: GOLD STAR BABY!! ⭐ DESTINY UNLOCKED!! 🏆",
      "{name} is celebrating your Gold Star! ⭐ UNSTOPPABLE!! 🔥"
    ]
  },
  win95: {
    none: [
      "{name} says: TaskManager.exe says DON'T GIVE UP!! 🖥️",
      "{name} yells: Not responding? KEEP TRYING!! 💾",
      "{name} says: Don't Ctrl+Alt+Del your day — KEEP PUSHING! 💪",
      "{name} says: Reboot and KEEP SWINGING!! You've got this! ⚡"
    ],
    bronze: [
      "{name} says: Bronze Star! ★ Dial-up speed, but keep going! 🖥️",
      "{name} yells: YOU CAN DO THIS!! Bronze is just booting up! 💾",
      "{name} says: Bronze Star! ★ Don't hit Cancel — keep pushing! 🚀",
      "{name} says: Bronze Star! ★ 25% loaded, don't quit now! ⏳"
    ],
    silver: [
      "{name} says: Silver Star! ★ Pentium II energy — keep pushing! 🖥️",
      "{name} yells: SILVER STAR!! ★ YOU CAN DO THIS — no blue screens! 💪",
      "{name} says: Silver Star! ★ Keep defragging, don't quit! ⚡",
      "{name} says: SILVER STAR?! ★ Stay plugged in and keep going! 🔥"
    ],
    gold: [
      "{name} says: LET'S FUCKING GO!! GOLD STAR.EXE!! ⭐ 🖥️",
      "{name} saw your Gold Star! ⭐ ZERO CRASHES, PURE BEAST MODE!! 💾",
      "{name} says: GOLD STAR BABY!! ⭐ MAX RAM ENERGY!! 🚀",
      "{name} is celebrating your Gold Star! ⭐ UNSTOPPABLE!! 🏆"
    ]
  },
  satc: {
    none: [
      "{name} says: Big would ghost, YOU DON'T GIVE UP!! 👠",
      "{name} yells: Put the Cosmo down and KEEP TRYING!! 🍸",
      "{name} says: And just like that... KEEP PUSHING!! ✨",
      "{name} says: Fabulous people DON'T QUIT!! Keep swinging! 💅"
    ],
    bronze: [
      "{name} says: Bronze Star! ★ Cute shoes, now keep walking! 👠",
      "{name} yells: YOU CAN DO THIS!! Bronze is just brunch! 🥂",
      "{name} says: Bronze Star! ★ Don't stop before the afterparty! 💅",
      "{name} says: Bronze Star! ★ Keep strutting, no quitting! ✨"
    ],
    silver: [
      "{name} says: Silver Star! ★ Serving main-character grit — keep going! 👠",
      "{name} yells: SILVER STAR!! ★ YOU CAN DO THIS — keep pushing! 🍸",
      "{name} says: Silver Star! ★ Don't settle now, stay locked in! 💅",
      "{name} says: SILVER STAR?! ★ Keep strutting, don't quit! ⚡"
    ],
    gold: [
      "{name} says: LET'S FUCKING GO!! GOLD STAR, DARLING!! ⭐ 👠",
      "{name} saw your Gold Star! ⭐ PURE MANOLO BEAST MODE!! 🍸",
      "{name} says: GOLD STAR BABY!! ⭐ ICONIC!! 🏆",
      "{name} is celebrating your Gold Star! ⭐ UNSTOPPABLE!! 💅"
    ]
  }
};

let db = null;
let currentUser = null;
let socialProfile = null; // { code, displayName }
let friendships = []; // [{ pairId, otherUid, otherName, status, requestedBy }]
const friendStatuses = new Map(); // uid -> { lastStarDate, lastStarTier, streak, streakDate }
const statusUnsubs = new Map(); // uid -> unsubscribe fn
let unsubFriendships = null;
let unsubNudges = null;
let latestLocalStarSummary = null;
let uiBound = false;
let isEditingNickname = false;
let isEditingFriends = false;
let confirmingRemovePairId = null;
let socialAttachGen = 0;
const handledNudgeIds = new Set();
const cheerQueue = [];
let activeCheerModal = null;

function handledNudgesKey(uid) {
  return `decideForMe_handledNudges_${uid}`;
}

function hasHandledNudge(uid, nudgeId) {
  if (handledNudgeIds.has(nudgeId)) return true;
  try {
    const raw = localStorage.getItem(handledNudgesKey(uid));
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(nudgeId);
  } catch {
    return false;
  }
}

function markNudgeHandled(uid, nudgeId) {
  handledNudgeIds.add(nudgeId);
  try {
    const raw = localStorage.getItem(handledNudgesKey(uid));
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    if (!list.includes(nudgeId)) {
      list.push(nudgeId);
      if (list.length > 50) list.splice(0, list.length - 50);
      localStorage.setItem(handledNudgesKey(uid), JSON.stringify(list));
    }
  } catch {
    // Ignore storage errors
  }
}

function getLogicalToday() {
  return window.DecideForMeApp?.getLogicalTodayStr?.() || new Date().toISOString().slice(0, 10);
}

function getYesterdayStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function showSocialToast(msg, durationMs = 3500) {
  if (typeof window.DecideForMeApp?.showToast === "function") {
    window.DecideForMeApp.showToast(msg, { durationMs });
  }
}

function isNonGuestUser(user) {
  return Boolean(user && !user.isAnonymous);
}

function pairIdFor(uidA, uidB) {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

function sentStorageKey(uid, dateStr) {
  return `decideForMe_nudgeSent_${uid}_${dateStr}`;
}

function getSentSetToday() {
  if (!currentUser) return new Set();
  try {
    const raw = localStorage.getItem(sentStorageKey(currentUser.uid, getLogicalToday()));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markSentToday(toUid) {
  if (!currentUser) return;
  try {
    const set = getSentSetToday();
    set.add(toUid);
    localStorage.setItem(
      sentStorageKey(currentUser.uid, getLogicalToday()),
      JSON.stringify([...set])
    );
  } catch {
    // Ignore storage errors
  }
}

function getCurrentTheme() {
  const t = document.documentElement?.dataset?.theme;
  return t && THEME_NUDGE_PRESETS[t] ? t : "dark";
}

function resolveNudgeText(tier, messageIndex, fromName, senderTheme) {
  const themeKey = senderTheme && THEME_NUDGE_PRESETS[senderTheme] ? senderTheme : "dark";
  const themePresets = THEME_NUDGE_PRESETS[themeKey];
  const list = themePresets[tier] || themePresets.none;
  const idx = Number.isInteger(messageIndex) && messageIndex >= 0 ? messageIndex % list.length : 0;
  return list[idx].replace("{name}", fromName || "A friend");
}

function resolveFriendStarDisplay(status) {
  const today = getLogicalToday();
  const yesterday = getYesterdayStr(today);

  let tier = "none";
  let isYesterday = false;

  if (status && status.lastStarTier && status.lastStarTier !== "none") {
    if (status.lastStarDate === today) {
      tier = status.lastStarTier;
    } else if (status.lastStarDate === yesterday) {
      tier = status.lastStarTier;
      isYesterday = true;
    }
  }

  let streak = 0;
  if (status && Number.isFinite(status.streak)) {
    if (status.streakDate === today || status.streakDate === yesterday) {
      streak = status.streak;
    }
  }

  return { tier, isYesterday, streak };
}

function updateHeaderBadge() {
  const dot = document.getElementById("friends-badge-dot");
  if (!dot) return;
  const hasPendingIncoming =
    isNonGuestUser(currentUser) &&
    friendships.some((f) => f.status === "pending" && f.requestedBy !== currentUser.uid);
  dot.classList.toggle("hidden", !hasPendingIncoming);
}

function clearSocialListeners() {
  if (unsubFriendships) {
    unsubFriendships();
    unsubFriendships = null;
  }
  if (unsubNudges) {
    unsubNudges();
    unsubNudges = null;
  }
  for (const unsub of statusUnsubs.values()) {
    unsub();
  }
  statusUnsubs.clear();
  friendStatuses.clear();
  friendships = [];
  socialProfile = null;
  isEditingNickname = false;
  cheerQueue.length = 0;
  activeCheerModal = null;
  document.getElementById("modal-cheer")?.classList.add("hidden");
  updateHeaderBadge();
}

function subscribeToFriendStatus(uid, attempt = 0) {
  if (!db || !isNonGuestUser(currentUser)) return;
  const stillAccepted = friendships.some(
    (f) => f.status === "accepted" && f.otherUid === uid
  );
  if (!stillAccepted) return;

  if (statusUnsubs.has(uid)) {
    statusUnsubs.get(uid)();
    statusUnsubs.delete(uid);
  }

  const unsub = onSnapshot(
    doc(db, "dailyStatus", uid),
    (snap) => {
      if (snap.exists()) {
        friendStatuses.set(uid, snap.data());
      } else {
        friendStatuses.delete(uid);
      }
      renderFriendsModal();
    },
    () => {
      // Firestore terminates the listener on transient permission-denied while
      // the accepted friendship propagates; clean up and retry with backoff.
      if (statusUnsubs.get(uid) === unsub) {
        statusUnsubs.delete(uid);
      }
      if (attempt < 5) {
        setTimeout(() => {
          if (!statusUnsubs.has(uid)) {
            subscribeToFriendStatus(uid, attempt + 1);
          }
        }, 600 * (attempt + 1));
      }
    }
  );
  statusUnsubs.set(uid, unsub);
}

function syncFriendStatusListeners() {
  if (!db || !isNonGuestUser(currentUser)) return;
  const acceptedUids = new Set(
    friendships.filter((f) => f.status === "accepted").map((f) => f.otherUid)
  );

  // Remove listeners for unfriended users
  for (const [uid, unsub] of statusUnsubs.entries()) {
    if (!acceptedUids.has(uid)) {
      unsub();
      statusUnsubs.delete(uid);
      friendStatuses.delete(uid);
    }
  }

  // Add listeners for newly accepted friends
  for (const uid of acceptedUids) {
    if (statusUnsubs.has(uid)) continue;
    subscribeToFriendStatus(uid, 0);
  }
}

function attachSocialListeners(user) {
  if (!db || !isNonGuestUser(user)) return;

  // Listen to friendships where user is a member
  const fsQuery = query(
    collection(db, "friendships"),
    where("users", "array-contains", user.uid)
  );
  unsubFriendships = onSnapshot(
    fsQuery,
    (snapshot) => {
      const next = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const otherUid = Array.isArray(data.users)
          ? data.users.find((u) => u !== user.uid)
          : null;
        if (!otherUid) return;
        const otherName = data.names?.[otherUid] || "Friend";
        next.push({
          pairId: docSnap.id,
          otherUid,
          otherName,
          status: data.status,
          requestedBy: data.requestedBy
        });
      });
      friendships = next;
      updateHeaderBadge();
      syncFriendStatusListeners();
      renderFriendsModal();
    },
    (err) => {
      console.warn("Friendships listener error:", err);
    }
  );

  // Listen to incoming nudges/congrats
  const nudgeQuery = query(
    collection(db, "nudges"),
    where("toUid", "==", user.uid)
  );
  unsubNudges = onSnapshot(
    nudgeQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const nudgeId = change.doc.id;
        if (hasHandledNudge(user.uid, nudgeId)) {
          deleteDoc(change.doc.ref).catch(() => {});
          return;
        }
        markNudgeHandled(user.uid, nudgeId);
        const data = change.doc.data();
        const text = resolveNudgeText(data.tier, data.messageIndex, data.fromName, data.senderTheme);
        enqueueCheerModal({ text, tier: data.tier });
        deleteDoc(change.doc.ref).catch(() => {});
      });
    },
    (err) => {
      console.warn("Nudges listener error:", err);
    }
  );
}

async function loadSocialProfile(user) {
  if (!db || !isNonGuestUser(user)) return null;
  try {
    const snap = await getDoc(doc(db, "socialProfiles", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      socialProfile = { code: data.code, displayName: data.displayName };
      return socialProfile;
    }
  } catch (err) {
    console.warn("Failed to load social profile:", err);
  }
  return null;
}

async function provisionSocialProfile(nickname) {
  if (!db || !isNonGuestUser(currentUser)) {
    throw new Error("Sign in with Google or Username to use Friends.");
  }
  const cleanName = nickname.trim().slice(0, 24);
  if (cleanName.length < 1) {
    throw new Error("Please enter a nickname.");
  }

  // If updating existing profile nickname
  if (socialProfile?.code) {
    await updateDoc(doc(db, "socialProfiles", currentUser.uid), {
      displayName: cleanName,
      updatedAt: serverTimestamp()
    });
    await updateDoc(doc(db, "friendCodes", socialProfile.code), {
      displayName: cleanName
    });
    // Also update own display name in existing friendships
    for (const f of friendships) {
      await updateDoc(doc(db, "friendships", f.pairId), {
        [`names.${currentUser.uid}`]: cleanName,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
    socialProfile = { ...socialProfile, displayName: cleanName };
    return socialProfile;
  }

  // Generate unique 6-digit code (100000 - 999999)
  let claimedCode = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const codeRef = doc(db, "friendCodes", candidate);
    const existing = await getDoc(codeRef);
    if (!existing.exists()) {
      try {
        await setDoc(codeRef, {
          uid: currentUser.uid,
          displayName: cleanName,
          createdAt: serverTimestamp()
        });
        claimedCode = candidate;
        break;
      } catch {
        // Retry if raced
      }
    }
  }

  if (!claimedCode) {
    throw new Error("Could not generate a unique code. Please try again.");
  }

  await setDoc(doc(db, "socialProfiles", currentUser.uid), {
    code: claimedCode,
    displayName: cleanName,
    updatedAt: serverTimestamp()
  });

  socialProfile = { code: claimedCode, displayName: cleanName };
  if (latestLocalStarSummary) {
    syncDailyStarStatus(latestLocalStarSummary).catch(() => {});
  }
  return socialProfile;
}

async function sendFriendRequestByCode(rawCode) {
  if (!db || !isNonGuestUser(currentUser) || !socialProfile) {
    throw new Error("Please set up your nickname first.");
  }
  const code = String(rawCode || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter a valid 6-digit friend code.");
  }
  if (code === socialProfile.code) {
    throw new Error("That's your own friend code!");
  }

  const codeSnap = await getDoc(doc(db, "friendCodes", code));
  if (!codeSnap.exists()) {
    throw new Error("No user found with that 6-digit code.");
  }

  const target = codeSnap.data();
  const targetUid = target.uid;
  const targetName = target.displayName || "Friend";

  if (targetUid === currentUser.uid) {
    throw new Error("That's your own friend code!");
  }

  const pairId = pairIdFor(currentUser.uid, targetUid);
  const pairRef = doc(db, "friendships", pairId);
  const existing = await getDoc(pairRef);
  if (existing.exists()) {
    const data = existing.data();
    if (data.status === "accepted") {
      throw new Error(`You are already friends with ${targetName}.`);
    }
    throw new Error("A friend request is already pending.");
  }

  const sortedUsers = [currentUser.uid, targetUid].sort();
  await setDoc(pairRef, {
    users: sortedUsers,
    status: "pending",
    requestedBy: currentUser.uid,
    names: {
      [currentUser.uid]: socialProfile.displayName,
      [targetUid]: targetName
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function acceptFriendRequest(pairId) {
  if (!db || !isNonGuestUser(currentUser)) return;
  await updateDoc(doc(db, "friendships", pairId), {
    status: "accepted",
    updatedAt: serverTimestamp()
  });
  const fs = friendships.find((f) => f.pairId === pairId);
  if (fs?.otherUid) {
    fs.status = "accepted";
    subscribeToFriendStatus(fs.otherUid, 0);
  }
}

async function removeFriendship(pairId) {
  if (!db || !isNonGuestUser(currentUser)) return;
  await deleteDoc(doc(db, "friendships", pairId));
}

async function sendCongratsNudge(friend) {
  if (!db || !isNonGuestUser(currentUser) || !socialProfile) return;
  const today = getLogicalToday();
  const status = friendStatuses.get(friend.otherUid);
  const { tier } = resolveFriendStarDisplay(status);
  const senderTheme = getCurrentTheme();
  const themePresets = THEME_NUDGE_PRESETS[senderTheme] || THEME_NUDGE_PRESETS.dark;
  const presets = themePresets[tier] || themePresets.none;
  const messageIndex = Math.floor(Math.random() * presets.length);
  const nudgeId = `${currentUser.uid}_${friend.otherUid}_${today}`;

  try {
    await setDoc(doc(db, "nudges", nudgeId), {
      fromUid: currentUser.uid,
      toUid: friend.otherUid,
      fromName: socialProfile.displayName,
      tier,
      senderTheme,
      messageIndex,
      date: today,
      createdAt: serverTimestamp()
    });
    markSentToday(friend.otherUid);
    showSocialToast(`Sent encouragement to ${friend.otherName}!`);
    renderFriendsModal();
  } catch (err) {
    if (err?.code === "permission-denied") {
      markSentToday(friend.otherUid);
      showSocialToast(`You already cheered ${friend.otherName} today!`);
      renderFriendsModal();
    } else {
      showSocialToast("Could not send message right now.");
    }
  }
}

export async function syncDailyStarStatus(summary) {
  latestLocalStarSummary = summary;
  if (!db || !isNonGuestUser(currentUser) || !socialProfile) return;

  const payload = {
    streak: Math.max(0, Number(summary.currentStreak) || 0),
    streakDate: summary.logicalTodayStr,
    updatedAt: serverTimestamp()
  };
  if (socialProfile.code) {
    payload.code = socialProfile.code;
  }

  if (summary.lastStarDate && summary.lastStarTier && summary.lastStarTier !== "none") {
    payload.lastStarDate = summary.lastStarDate;
    payload.lastStarTier = summary.lastStarTier;
  }

  try {
    await setDoc(doc(db, "dailyStatus", currentUser.uid), payload, { merge: true });
  } catch (err) {
    console.warn("Failed to sync daily star status:", err);
  }
}

export async function cleanupSocialAccountData(uid) {
  if (!db || !uid) return;
  try {
    const profileSnap = await getDoc(doc(db, "socialProfiles", uid));
    if (profileSnap.exists()) {
      const code = profileSnap.data()?.code;
      if (code) {
        await deleteDoc(doc(db, "friendCodes", code)).catch(() => {});
      }
    }
    await deleteDoc(doc(db, "socialProfiles", uid)).catch(() => {});
    await deleteDoc(doc(db, "dailyStatus", uid)).catch(() => {});

    const fsSnap = await getDocs(
      query(collection(db, "friendships"), where("users", "array-contains", uid))
    );
    await Promise.all(fsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch (err) {
    console.warn("Social cleanup error:", err);
  }
}

export async function onAuthUserChanged(user) {
  const gen = ++socialAttachGen;
  clearSocialListeners();
  currentUser = user || null;
  if (!isNonGuestUser(currentUser)) {
    renderFriendsModal();
    return;
  }

  await loadSocialProfile(currentUser);
  if (gen !== socialAttachGen || currentUser?.uid !== user.uid) return;
  attachSocialListeners(currentUser);
  if (socialProfile && latestLocalStarSummary) {
    syncDailyStarStatus(latestLocalStarSummary).catch(() => {});
  }
  renderFriendsModal();
}

function renderStarBadge(tier, isYesterday) {
  const span = document.createElement("span");
  span.className = `friend-star-pill star-tier-${tier}`;
  const labels = {
    gold: "⭐ Gold Star",
    silver: "★ Silver Star",
    bronze: "★ Bronze Star",
    none: "☆ No star yet"
  };
  span.textContent = (labels[tier] || labels.none) + (isYesterday && tier !== "none" ? " (yesterday)" : "");
  return span;
}

function renderFriendsModal() {
  const modal = document.getElementById("modal-friends");
  if (!modal || modal.classList.contains("hidden")) return;

  const guestView = document.getElementById("friends-guest-view");
  const setupView = document.getElementById("friends-setup-view");
  const mainView = document.getElementById("friends-main-view");
  const errorEl = document.getElementById("friends-error");
  if (errorEl) errorEl.classList.add("hidden");

  if (!isNonGuestUser(currentUser)) {
    guestView?.classList.remove("hidden");
    setupView?.classList.add("hidden");
    mainView?.classList.add("hidden");
    return;
  }

  guestView?.classList.add("hidden");

  if (!socialProfile || isEditingNickname) {
    setupView?.classList.remove("hidden");
    mainView?.classList.add("hidden");
    const nickInput = document.getElementById("input-friends-nickname");
    const setupTitle = document.getElementById("friends-setup-prompt");
    const cancelEditBtn = document.getElementById("btn-friends-cancel-edit");
    if (nickInput && !nickInput.value && socialProfile?.displayName) {
      nickInput.value = socialProfile.displayName;
    }
    if (setupTitle) {
      setupTitle.textContent = socialProfile
        ? "Update your friend-facing nickname:"
        : "Pick a nickname so your friends know who's cheering them on:";
    }
    if (cancelEditBtn) {
      cancelEditBtn.classList.toggle("hidden", !socialProfile);
    }
    return;
  }

  setupView?.classList.add("hidden");
  mainView?.classList.remove("hidden");

  const codeEl = document.getElementById("friends-my-code");
  const nameEl = document.getElementById("friends-my-name");
  if (codeEl) codeEl.textContent = socialProfile.code;
  if (nameEl) nameEl.textContent = socialProfile.displayName;

  // Pending incoming & outgoing requests
  const pendingWrap = document.getElementById("friends-pending-section");
  const pendingList = document.getElementById("friends-pending-list");
  const pendingIncoming = friendships.filter(
    (f) => f.status === "pending" && f.requestedBy !== currentUser.uid
  );
  const pendingOutgoing = friendships.filter(
    (f) => f.status === "pending" && f.requestedBy === currentUser.uid
  );

  if (pendingWrap && pendingList) {
    pendingList.innerHTML = "";
    const hasPending = pendingIncoming.length > 0 || pendingOutgoing.length > 0;
    pendingWrap.classList.toggle("hidden", !hasPending);

    pendingIncoming.forEach((req) => {
      const li = document.createElement("li");
      li.className = "friend-row friend-row-pending";

      const info = document.createElement("div");
      info.className = "friend-row-info";
      const nameSpan = document.createElement("strong");
      nameSpan.textContent = req.otherName;
      const subSpan = document.createElement("span");
      subSpan.className = "text-muted small";
      subSpan.textContent = "wants to be friends";
      info.append(nameSpan, subSpan);

      const actions = document.createElement("div");
      actions.className = "friend-row-actions";
      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "btn btn-primary btn-xs";
      acceptBtn.textContent = "Accept";
      acceptBtn.addEventListener("click", () => acceptFriendRequest(req.pairId));

      const declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className = "btn btn-ghost btn-xs";
      declineBtn.textContent = "Decline";
      declineBtn.addEventListener("click", () => removeFriendship(req.pairId));

      actions.append(acceptBtn, declineBtn);
      li.append(info, actions);
      pendingList.appendChild(li);
    });

    pendingOutgoing.forEach((req) => {
      const li = document.createElement("li");
      li.className = "friend-row friend-row-pending";

      const info = document.createElement("div");
      info.className = "friend-row-info";
      const nameSpan = document.createElement("strong");
      nameSpan.textContent = req.otherName;
      const subSpan = document.createElement("span");
      subSpan.className = "text-muted small";
      subSpan.textContent = "Request sent";
      info.append(nameSpan, subSpan);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-ghost btn-xs";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => removeFriendship(req.pairId));

      li.append(info, cancelBtn);
      pendingList.appendChild(li);
    });
  }

  // Accepted friends list
  const friendsListEl = document.getElementById("friends-accepted-list");
  const emptyEl = document.getElementById("friends-empty-state");
  const editFriendsBtn = document.getElementById("btn-friends-edit");
  const accepted = friendships.filter((f) => f.status === "accepted");
  const sentToday = getSentSetToday();

  if (accepted.length === 0) {
    isEditingFriends = false;
    confirmingRemovePairId = null;
  }

  if (editFriendsBtn) {
    editFriendsBtn.classList.toggle("hidden", accepted.length === 0);
    editFriendsBtn.textContent = isEditingFriends ? "Done" : "Edit";
    editFriendsBtn.setAttribute("aria-pressed", String(isEditingFriends));
  }

  if (friendsListEl && emptyEl) {
    friendsListEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", accepted.length > 0);

    accepted.forEach((friend) => {
      const li = document.createElement("li");
      li.className = "friend-row";

      const status = friendStatuses.get(friend.otherUid);
      const { tier, isYesterday, streak } = resolveFriendStarDisplay(status);

      const info = document.createElement("div");
      info.className = "friend-row-info";

      const topLine = document.createElement("div");
      topLine.className = "friend-row-top";
      const nameSpan = document.createElement("strong");
      nameSpan.textContent = friend.otherName;
      topLine.append(nameSpan);
      if (status?.code) {
        const codeSpan = document.createElement("span");
        codeSpan.className = "friend-code-tag";
        codeSpan.textContent = `#${status.code}`;
        topLine.append(codeSpan);
      }
      const streakSpan = document.createElement("span");
      streakSpan.className = "friend-streak-pill";
      streakSpan.textContent = `🔥 ${streak}d`;
      topLine.append(streakSpan);

      const starBadge = renderStarBadge(tier, isYesterday);
      info.append(topLine, starBadge);

      const actions = document.createElement("div");
      actions.className = "friend-row-actions";

      if (isEditingFriends) {
        if (confirmingRemovePairId === friend.pairId) {
          const confirmBtn = document.createElement("button");
          confirmBtn.type = "button";
          confirmBtn.className = "btn btn-danger btn-xs";
          confirmBtn.textContent = "Confirm";
          confirmBtn.addEventListener("click", async () => {
            confirmBtn.disabled = true;
            confirmingRemovePairId = null;
            await removeFriendship(friend.pairId);
          });

          const cancelBtn = document.createElement("button");
          cancelBtn.type = "button";
          cancelBtn.className = "btn btn-ghost btn-xs";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", () => {
            confirmingRemovePairId = null;
            renderFriendsModal();
          });

          actions.append(confirmBtn, cancelBtn);
        } else {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn-danger btn-xs";
          removeBtn.textContent = "Remove";
          removeBtn.setAttribute("aria-label", `Remove ${friend.otherName}`);
          removeBtn.addEventListener("click", () => {
            confirmingRemovePairId = friend.pairId;
            renderFriendsModal();
          });

          actions.append(removeBtn);
        }
      } else {
        const cheerBtn = document.createElement("button");
        cheerBtn.type = "button";
        const alreadySent = sentToday.has(friend.otherUid);
        cheerBtn.className = alreadySent ? "btn btn-secondary btn-xs" : "btn btn-primary btn-xs";
        cheerBtn.disabled = alreadySent;
        cheerBtn.textContent = alreadySent
          ? "Cheer sent"
          : tier === "none"
            ? "Cheer"
            : "Congrats";
        cheerBtn.addEventListener("click", () => sendCongratsNudge(friend));

        actions.append(cheerBtn);
      }
      li.append(info, actions);
      friendsListEl.appendChild(li);
    });
  }
}

function getCheerModalMeta(tier) {
  if (tier === "gold") return { emoji: "⭐", title: "Gold Star Hype!" };
  if (tier === "silver") return { emoji: "⚡", title: "Keep Pushing!" };
  if (tier === "bronze") return { emoji: "💪", title: "Keep Going!" };
  return { emoji: "🔥", title: "Don't Give Up!" };
}

function showNextCheerModal() {
  const modal = document.getElementById("modal-cheer");
  const emojiEl = document.getElementById("cheer-modal-emoji");
  const titleEl = document.getElementById("modal-cheer-title");
  const msgEl = document.getElementById("cheer-modal-message");
  if (!modal || !msgEl) return;

  if (cheerQueue.length === 0) {
    activeCheerModal = null;
    modal.classList.add("hidden");
    return;
  }

  activeCheerModal = cheerQueue.shift();
  const meta = getCheerModalMeta(activeCheerModal.tier);
  if (emojiEl) emojiEl.textContent = meta.emoji;
  if (titleEl) titleEl.textContent = meta.title;
  msgEl.textContent = activeCheerModal.text;
  modal.classList.remove("hidden");
}

function enqueueCheerModal(cheer) {
  cheerQueue.push(cheer);
  if (!activeCheerModal) {
    showNextCheerModal();
  }
}

function closeCheerModal() {
  showNextCheerModal();
}

function openFriendsModal() {
  const modal = document.getElementById("modal-friends");
  if (!modal) return;
  isEditingNickname = false;
  modal.classList.remove("hidden");
  renderFriendsModal();
}

function closeFriendsModal() {
  const modal = document.getElementById("modal-friends");
  if (!modal) return;
  modal.classList.add("hidden");
  isEditingNickname = false;
}

function showModalError(msg) {
  const errorEl = document.getElementById("friends-error");
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function bindFriendsUI() {
  if (uiBound) return;
  uiBound = true;

  const modal = document.getElementById("modal-friends");
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeFriendsModal();
  });

  const cheerModal = document.getElementById("modal-cheer");
  cheerModal?.addEventListener("click", (e) => {
    if (e.target === cheerModal) closeCheerModal();
  });
  document.getElementById("btn-cheer-close")?.addEventListener("click", closeCheerModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeCheerModal) {
      closeCheerModal();
    }
  });

  document.getElementById("btn-friends-guest-google")?.addEventListener("click", () => {
    closeFriendsModal();
    window.DecideForMeCloud?.signInWithGoogle?.();
  });

  document.getElementById("btn-friends-guest-username")?.addEventListener("click", () => {
    closeFriendsModal();
    window.DecideForMeCloud?.signInWithUsername?.();
  });

  document.getElementById("btn-friends-edit")?.addEventListener("click", () => {
    isEditingFriends = !isEditingFriends;
    confirmingRemovePairId = null;
    renderFriendsModal();
  });

  document.getElementById("btn-friends-edit-name")?.addEventListener("click", () => {
    isEditingNickname = true;
    const nickInput = document.getElementById("input-friends-nickname");
    if (nickInput && socialProfile?.displayName) {
      nickInput.value = socialProfile.displayName;
    }
    renderFriendsModal();
  });

  document.getElementById("btn-friends-cancel-edit")?.addEventListener("click", () => {
    isEditingNickname = false;
    renderFriendsModal();
  });

  document.getElementById("form-friends-nickname")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("input-friends-nickname");
    const submitBtn = document.getElementById("btn-friends-save-nickname");
    if (!input || !submitBtn) return;
    submitBtn.disabled = true;
    try {
      await provisionSocialProfile(input.value);
      isEditingNickname = false;
      renderFriendsModal();
    } catch (err) {
      showModalError(err.message || "Could not save nickname.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("btn-friends-copy-code")?.addEventListener("click", async () => {
    if (!socialProfile?.code) return;
    try {
      await navigator.clipboard.writeText(socialProfile.code);
      showSocialToast(`Copied friend code ${socialProfile.code}!`);
    } catch {
      showSocialToast(`Your friend code is ${socialProfile.code}`);
    }
  });

  document.getElementById("form-friends-add")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("input-friends-code");
    const submitBtn = document.getElementById("btn-friends-add-submit");
    if (!input || !submitBtn) return;
    submitBtn.disabled = true;
    try {
      await sendFriendRequestByCode(input.value);
      input.value = "";
      showSocialToast("Friend request sent!");
    } catch (err) {
      showModalError(err.message || "Could not send friend request.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

export function initSocial({ firestore }) {
  db = firestore;
  bindFriendsUI();
}

window.DecideForMeSocial = {
  syncDailyStarStatus,
  openFriendsModal
};
