/**
 * DecideForMe — Guest-Only Cleanup Script (Firestore + Firebase Auth)
 *
 * Deletes ONLY guest (anonymous) accounts and their `users/{uid}` Firestore docs when:
 *   1. The guest hasn't signed in for >= INACTIVE_DAYS (default: 30 days), OR
 *   2. Their Firestore `state` is still the untouched starter template (after TEMPLATE_GRACE_HOURS, default: 24h).
 *
 * Non-guest accounts (Google Sign-In, username/password) are never touched.
 *
 * Usage:
 *   cd scripts && npm install
 *   # Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   # (or FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}')
 *   node cleanup-guests.mjs --dry-run
 *   node cleanup-guests.mjs
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const INCLUDE_FRESH_TEMPLATES = args.has("--include-fresh-templates");

const INACTIVE_DAYS = Number(process.env.INACTIVE_DAYS ?? 30);
const TEMPLATE_GRACE_HOURS = INCLUDE_FRESH_TEMPLATES
  ? 0
  : Number(process.env.TEMPLATE_GRACE_HOURS ?? 24);

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

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

function initAdmin() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return initializeApp({ credential: cert(JSON.parse(rawJson)) });
  }
  return initializeApp({ credential: applicationDefault() });
}

function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function listAllAnonymousUsers(auth) {
  const guests = new Map();
  let nextPageToken;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (user.providerData.length === 0) {
        guests.set(user.uid, user);
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return guests;
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  const now = Date.now();
  const inactiveCutoff = now - INACTIVE_DAYS * MS_PER_DAY;
  const templateCutoff = now - TEMPLATE_GRACE_HOURS * MS_PER_HOUR;

  console.log(
    `[cleanup-guests] mode=${DRY_RUN ? "DRY_RUN" : "LIVE"} inactiveDays=${INACTIVE_DAYS} templateGraceHours=${TEMPLATE_GRACE_HOURS}`
  );

  const anonUsers = await listAllAnonymousUsers(auth);
  const guestDocsSnap = await db.collection("users").where("accountType", "==", "guest").get();

  const docsByUid = new Map();
  for (const docSnap of guestDocsSnap.docs) {
    docsByUid.set(docSnap.id, docSnap);
  }

  const candidateUids = new Set([...anonUsers.keys(), ...docsByUid.keys()]);
  const toDelete = [];

  for (const uid of candidateUids) {
    const authUser = anonUsers.get(uid) || null;
    const docSnap = docsByUid.get(uid) || null;
    const docData = docSnap ? docSnap.data() : null;

    // Safety check: if a Firestore doc exists with a non-guest accountType, skip it.
    if (docData && docData.accountType && docData.accountType !== "guest") {
      continue;
    }

    // Safety check: if Auth user exists and has linked providers, it is not a guest.
    if (!authUser) {
      try {
        const existing = await auth.getUser(uid);
        if (existing.providerData.length > 0) {
          continue;
        }
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }
    }

    const lastSignInMs = authUser
      ? getTimestampMs(authUser.metadata.lastSignInTime) ||
        getTimestampMs(authUser.metadata.creationTime)
      : 0;
    const docUpdatedMs = docData ? getTimestampMs(docData.updatedAt) : 0;
    const lastActiveMs = Math.max(lastSignInMs, docUpdatedMs);

    let reason = null;
    if (lastActiveMs > 0 && lastActiveMs < inactiveCutoff) {
      reason = `inactive_${INACTIVE_DAYS}d`;
    } else if (docData && isUntouchedDefaultState(docData.state)) {
      if (lastActiveMs === 0 || lastActiveMs < templateCutoff) {
        reason = "template_only";
      }
    }

    if (reason) {
      toDelete.push({
        uid,
        reason,
        hasAuth: Boolean(authUser),
        hasDoc: Boolean(docSnap),
        lastActiveIso: lastActiveMs ? new Date(lastActiveMs).toISOString() : "unknown"
      });
    }
  }

  console.log(
    `[cleanup-guests] scanned anonAuth=${anonUsers.size} guestDocs=${docsByUid.size} matched=${toDelete.length}`
  );

  let deletedDocs = 0;
  let deletedAuth = 0;
  let errors = 0;

  for (const item of toDelete) {
    if (DRY_RUN) {
      console.log(
        `[DRY RUN] Would delete uid=${item.uid} reason=${item.reason} hasDoc=${item.hasDoc} hasAuth=${item.hasAuth} lastActive=${item.lastActiveIso}`
      );
      continue;
    }

    try {
      if (item.hasDoc) {
        await db.collection("users").doc(item.uid).delete();
        deletedDocs++;
      }
      if (item.hasAuth) {
        try {
          await auth.deleteUser(item.uid);
          deletedAuth++;
        } catch (err) {
          if (err.code !== "auth/user-not-found") throw err;
        }
      }
      console.log(
        `[DELETED] uid=${item.uid} reason=${item.reason} lastActive=${item.lastActiveIso}`
      );
    } catch (err) {
      errors++;
      console.error(`[ERROR] uid=${item.uid}:`, err);
    }
  }

  if (!DRY_RUN) {
    console.log(
      `[cleanup-guests] done deletedDocs=${deletedDocs} deletedAuth=${deletedAuth} errors=${errors}`
    );
  }
}

main().catch((err) => {
  console.error("[cleanup-guests] fatal:", err);
  process.exit(1);
});
