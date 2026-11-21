/**
 * DecideForMe — Local-First Activity Picker & Habit Logger
 */

const STORAGE_KEY = "decideForMe_state_v1";
const WEIGHT_STEPS = [1, 2, 4];
const DAILY_RESET_HOUR = 3; // 3:00 AM local time daily reset
const ROLL_DURATION_MS = 3000; // Total roll animation duration in milliseconds (change this single number to speed up or slow down)
const STREAK_FREEZE_INTERVAL = 3; // Consecutive active streak days required to earn +1 Streak Freeze
const MAX_STREAK_FREEZES = 3; // Maximum Streak Freezes a user can hold at once
const PROCRASTINATION_LIST_ID = "__procrastination__";
const PROCRASTINATION_LIST_COLOR = "#f97316";

const ICON_EDIT_SVG = `<svg class="icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
const ICON_TRASH_SVG = `<svg class="icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`;

const PALETTE = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899"  // Pink
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

// Helper: Normalize any weight to valid 1, 2, or 4
function normalizeWeight(w) {
  const num = Number(w) || 1;
  if (num >= 4) return 4;
  if (num >= 2) return 2;
  return 1;
}

// Helper: Format exact Date object as YYYY-MM-DD
function toLocalDateStr(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Logical "Today" string using a 3:00 AM daily rollover boundary.
 * E.g. at 1:30 AM on Nov 18, logical today is still Nov 17 until 3:00 AM.
 */
function getLogicalTodayDate(nowObj = new Date()) {
  const shifted = new Date(nowObj.getTime() - DAILY_RESET_HOUR * 60 * 60 * 1000);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

function getLogicalTodayStr(nowObj = new Date()) {
  return toLocalDateStr(getLogicalTodayDate(nowObj));
}

function parseLocalDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultDailyTasks() {
  return [
    { id: "daily_1", title: "Make bed", doneToday: false },
    { id: "daily_2", title: "Drink 2L water", doneToday: false },
    { id: "daily_3", title: "Take vitamins", doneToday: false }
  ];
}

const TEMPLATE_VERSION = 5;

function createDefaultLists() {
  return [
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
  ];
}

// Default starter state
function createDefaultState() {
  return {
    templateVersion: TEMPLATE_VERSION,
    theme: "dark",
    calendarView: "month", // "month" | "week"
    activeListId: "list_30m",
    heroListIds: ["list_30m"],
    activeDecision: null,
    lastDailyResetDate: getLogicalTodayStr(),
    rerollsByDate: {}, // { "YYYY-MM-DD": number }
    dailyTasks: createDefaultDailyTasks(),
    scheduledTasks: [], // One-time & repeating To-Do / Schedule tasks
    procrastinationTasks: [], // One-time procrastination tasks (vanish next day after completion)
    dailyStarsByDate: {}, // { "YYYY-MM-DD": true }
    dailyNotesByDate: {}, // { "YYYY-MM-DD": string }
    collapsedCards: {
      activityLists: false,
      dailyTasks: false,
      scheduledTasks: false,
      procrastination: false,
      insights: true
    },
    lists: createDefaultLists(),
    logs: [],
    deletedIds: {},
    resetAt: 0
  };
}

const TOMBSTONE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function pruneDeletedIds(deletedIds) {
  if (!deletedIds || typeof deletedIds !== "object") return {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const pruned = {};
  Object.entries(deletedIds).forEach(([id, ts]) => {
    if (typeof ts === "number" && ts >= cutoff) {
      pruned[id] = ts;
    }
  });
  return pruned;
}

function recordDeletedIds(...ids) {
  if (!state.deletedIds || typeof state.deletedIds !== "object") {
    state.deletedIds = {};
  }
  const now = Date.now();
  ids.forEach((id) => {
    if (id) state.deletedIds[id] = now;
  });
}

// Application Runtime State
let state = loadState();
let selectedListModalColor = PALETTE[0];
let selectedModalWeight = 1;
let isRolling = false;
let completingDecisionSnapshot = null;
let completingDecisionTimers = [];
let winnerAuraTimer = null;
let modalMode = "create"; // "create" | "rename"
let draggedListId = null;
let quickLogFilterListId = "ALL";
let pendingConfirmAction = null;
let pendingInputAction = null;
let isEditingActivities = false;
let isEditingDailyTasks = false;
let isEditingScheduledTasks = false;
let isEditingProcrastination = false;
let scheduledViewMode = "today"; // "today" | "upcoming"
let editingScheduledTaskId = null;

// Calendar navigation state (initialized to logical today)
const initialLogicalToday = getLogicalTodayDate();
let calYear = initialLogicalToday.getFullYear();
let calMonth = initialLogicalToday.getMonth(); // 0-indexed
let selectedDateStr = getLogicalTodayStr();

function normalizeLists(lists) {
  lists.forEach((list, idx) => {
    if (!list.color) {
      list.color = PALETTE[idx % PALETTE.length];
    }
    if (Array.isArray(list.items)) {
      list.items.forEach((item) => {
        item.weight = normalizeWeight(item.weight);
        delete item.color;
      });
    } else {
      list.items = [];
    }
  });
}

function normalizeLoadedState(parsed) {
  if (!parsed || !Array.isArray(parsed.lists) || parsed.lists.length === 0) {
    return createDefaultState();
  }
  parsed.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
  parsed.theme = normalizeTheme(parsed.theme);
  parsed.calendarView = parsed.calendarView === "week" ? "week" : "month";
  parsed.rerollsByDate =
    parsed.rerollsByDate && typeof parsed.rerollsByDate === "object"
      ? parsed.rerollsByDate
      : {};
  parsed.dailyTasks = Array.isArray(parsed.dailyTasks)
    ? parsed.dailyTasks
    : createDefaultDailyTasks();
  parsed.scheduledTasks = Array.isArray(parsed.scheduledTasks)
    ? parsed.scheduledTasks
    : [];
  parsed.procrastinationTasks = Array.isArray(parsed.procrastinationTasks)
    ? parsed.procrastinationTasks
    : [];
  parsed.dailyStarsByDate =
    parsed.dailyStarsByDate && typeof parsed.dailyStarsByDate === "object"
      ? parsed.dailyStarsByDate
      : {};
  parsed.dailyNotesByDate =
    parsed.dailyNotesByDate && typeof parsed.dailyNotesByDate === "object"
      ? parsed.dailyNotesByDate
      : {};
  parsed.collapsedCards = {
    activityLists: Boolean(parsed.collapsedCards && parsed.collapsedCards.activityLists),
    dailyTasks: Boolean(parsed.collapsedCards && parsed.collapsedCards.dailyTasks),
    scheduledTasks: Boolean(parsed.collapsedCards && parsed.collapsedCards.scheduledTasks),
    procrastination: Boolean(parsed.collapsedCards && parsed.collapsedCards.procrastination),
    insights:
      parsed.collapsedCards && "insights" in parsed.collapsedCards
        ? Boolean(parsed.collapsedCards.insights)
        : true
  };

  if (parsed.templateVersion !== TEMPLATE_VERSION) {
    parsed.lists = createDefaultLists();
    parsed.templateVersion = TEMPLATE_VERSION;
    parsed.activeDecision = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  }

  parsed.deletedIds = pruneDeletedIds(parsed.deletedIds);
  parsed.resetAt = typeof parsed.resetAt === "number" ? parsed.resetAt : 0;

  if (Object.keys(parsed.deletedIds).length > 0) {
    const isDeleted = (id) => Boolean(id && parsed.deletedIds[id]);
    parsed.lists = parsed.lists.filter((l) => !isDeleted(l.id));
    parsed.lists.forEach((l) => {
      if (Array.isArray(l.items)) {
        l.items = l.items.filter((i) => !isDeleted(i.id));
      }
    });
    parsed.dailyTasks = parsed.dailyTasks.filter((t) => !isDeleted(t.id));
    parsed.scheduledTasks = parsed.scheduledTasks.filter((t) => !isDeleted(t.id));
    parsed.procrastinationTasks = parsed.procrastinationTasks.filter((t) => !isDeleted(t.id));
    parsed.logs = parsed.logs.filter((l) => !isDeleted(l.id));
    if (parsed.lists.length === 0) {
      parsed.lists = createDefaultLists();
    }
  }

  normalizeLists(parsed.lists);
  if (!parsed.lists.some((l) => l.id === parsed.activeListId)) {
    parsed.activeListId = parsed.lists[0].id;
  }
  if (!Array.isArray(parsed.heroListIds) || parsed.heroListIds.length === 0) {
    if (parsed.heroListId === PROCRASTINATION_LIST_ID) {
      parsed.heroListIds = [PROCRASTINATION_LIST_ID];
    } else if (parsed.lists.some((l) => l.id === parsed.heroListId)) {
      parsed.heroListIds = [parsed.heroListId];
    } else {
      parsed.heroListIds = [parsed.activeListId];
    }
  } else if (parsed.heroListIds.includes(PROCRASTINATION_LIST_ID)) {
    parsed.heroListIds = [PROCRASTINATION_LIST_ID];
  } else {
    parsed.heroListIds = parsed.heroListIds.filter((id) =>
      parsed.lists.some((l) => l.id === id)
    );
    if (parsed.heroListIds.length === 0) {
      parsed.heroListIds = [parsed.activeListId];
    }
  }
  return parsed;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeLoadedState(JSON.parse(raw));
  } catch (err) {
    console.error("Failed to load state from localStorage:", err);
    return createDefaultState();
  }
}

function saveState(skipCloud = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!skipCloud && window.DecideForMeCloud && typeof window.DecideForMeCloud.scheduleSave === "function") {
      window.DecideForMeCloud.scheduleSave(state);
    }
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

function trackAnalyticsEvent(eventName, params = {}) {
  if (window.DecideForMeCloud && typeof window.DecideForMeCloud.trackEvent === "function") {
    window.DecideForMeCloud.trackEvent(eventName, params);
  }
}

/**
 * Checks if the 3:00 AM daily boundary has passed since lastDailyResetDate.
 * When a new logical day begins, re-checks all activity options across all lists
 * and resets Daily Tasks checkboxes for the new day.
 */
function checkAndPerformDailyReset(shouldRender = false) {
  const currentLogicalToday = getLogicalTodayStr();

  if (!state.lastDailyResetDate) {
    state.lastDailyResetDate = currentLogicalToday;
    saveState();
    return;
  }

  if (state.lastDailyResetDate !== currentLogicalToday) {
    // Re-check all activities across all lists
    state.lists.forEach((list) => {
      list.items.forEach((item) => {
        item.checked = true;
      });
    });
    // Reset Daily Tasks for the new day
    state.dailyTasks.forEach((task) => {
      task.doneToday = false;
    });

    // Clean up completed one-time scheduled tasks from prior days
    const expiredScheduledIds = [];
    state.scheduledTasks = (state.scheduledTasks || []).filter((task) => {
      if (task.type !== "once") return true;
      const completedKeys = task.completedDates
        ? Object.keys(task.completedDates).filter((k) => task.completedDates[k])
        : [];
      if (completedKeys.length === 0) return true;
      const keep = completedKeys.some((k) => k >= currentLogicalToday);
      if (!keep && task.id) expiredScheduledIds.push(task.id);
      return keep;
    });
    if (expiredScheduledIds.length > 0) {
      recordDeletedIds(...expiredScheduledIds);
    }

    // Completed procrastination tasks vanish on the next logical day
    const completedProcrastIds = (state.procrastinationTasks || [])
      .filter((t) => t.doneToday && t.id)
      .map((t) => t.id);
    if (completedProcrastIds.length > 0) {
      recordDeletedIds(...completedProcrastIds);
    }
    state.procrastinationTasks = (state.procrastinationTasks || []).filter((t) => !t.doneToday);

    state.activeDecision = null;
    state.lastDailyResetDate = currentLogicalToday;

    const logicalObj = getLogicalTodayDate();
    selectedDateStr = currentLogicalToday;
    calYear = logicalObj.getFullYear();
    calMonth = logicalObj.getMonth();

    saveState();
    if (shouldRender) {
      renderAll();
      const { frozenDates, availableFreezes } = computeStreakAndFreezes();
      const yesterdayObj = getLogicalTodayDate();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterdayStr = toLocalDateStr(yesterdayObj);
      if (frozenDates.has(yesterdayStr)) {
        showToast(
          `❄️ Streak Freeze used for yesterday! Your streak is safe (${availableFreezes}/${MAX_STREAK_FREEZES} freezes left).`
        );
      } else {
        showToast("New day (3:00 AM reset) — all activities & daily tasks reset!");
      }
    }
  }
}

/**
 * Computes current streak, best streak, available Streak Freezes (0..3),
 * consecutive active days toward the next freeze (0..2), and the set of dates
 * where a Streak Freeze was automatically consumed to protect the streak.
 *
 * Rules:
 * - A day is an active streak day when at least 1 activity is logged AND
 *   all Daily Tasks are completed (if any exist).
 * - Every 3 consecutive active streak days awards +1 Streak Freeze (up to 3 max).
 * - Missing a past day while currentStreak > 0 automatically consumes 1 available
 *   Streak Freeze to bridge/preserve the streak without adding +1 to the day count,
 *   and resets the 3-day consecutive active counter toward the next freeze.
 * - While logical today is still in progress (not yet completed), it does not
 *   consume a freeze or break the streak.
 */
function isTaskDueOnDate(task, dateStr) {
  if (!task) return false;
  if (task.type === "once") {
    return task.dueDate === dateStr;
  }
  if (task.type === "repeat") {
    if (task.createdAt && dateStr < task.createdAt) {
      return false;
    }
    const d = parseLocalDateStr(dateStr);
    const rule = task.repeatRule || {};
    if (rule.freq === "monthly") {
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(Math.max(1, Number(rule.monthDay) || 1), daysInMonth);
      return d.getDate() === targetDay;
    }
    const weekday = (d.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const weekdays = Array.isArray(rule.weekdays) ? rule.weekdays : [];
    return weekdays.includes(weekday);
  }
  return false;
}

function isScheduledTaskDoneOnDate(task, dateStr) {
  return Boolean(task && task.completedDates && task.completedDates[dateStr]);
}

function getScheduledTaskTargetDate(task, todayStr) {
  if (!task) return todayStr;
  if (task.type === "once") {
    return task.dueDate && task.dueDate > todayStr ? task.dueDate : todayStr;
  }
  if (isTaskDueOnDate(task, todayStr)) {
    return todayStr;
  }
  const cursor = parseLocalDateStr(todayStr);
  for (let i = 1; i <= 35; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const dStr = toLocalDateStr(cursor);
    if (isTaskDueOnDate(task, dStr)) return dStr;
  }
  return todayStr;
}

function isScheduledTaskOverdue(task, todayStr) {
  return (
    task &&
    task.type === "once" &&
    Boolean(task.dueDate) &&
    task.dueDate < todayStr &&
    !isScheduledTaskDoneOnDate(task, task.dueDate) &&
    !isScheduledTaskDoneOnDate(task, todayStr)
  );
}

function areAllScheduledTasksDoneForDate(dateStr) {
  const tasks = Array.isArray(state.scheduledTasks) ? state.scheduledTasks : [];
  const dueTasks = tasks.filter((t) => isTaskDueOnDate(t, dateStr));
  return dueTasks.length === 0 || dueTasks.every((t) => isScheduledTaskDoneOnDate(t, dateStr));
}

function getStarStatusForDate(dateStr, hasActivity) {
  const hasDailyTasksDone = Boolean(state.dailyStarsByDate[dateStr]);
  const scheduledDone = areAllScheduledTasksDoneForDate(dateStr);
  const hasGoldStar = hasDailyTasksDone && hasActivity && scheduledDone;
  const hasSilverStar = hasDailyTasksDone && !hasGoldStar;
  return { hasDailyTasksDone, scheduledDone, hasGoldStar, hasSilverStar };
}

function computeStreakAndFreezes(nowObj = new Date()) {
  const requireDailyStar = state.dailyTasks.length > 0;
  const qualifyingDates = Array.from(
    new Set(
      state.logs
        .map((l) => l.date)
        .filter((dStr) => {
          const dailyOk = !requireDailyStar || Boolean(state.dailyStarsByDate[dStr]);
          return dailyOk && areAllScheduledTasksDoneForDate(dStr);
        })
    )
  ).sort();
  const qualifyingSet = new Set(qualifyingDates);
  const frozenDates = new Set();
  const streakDayNumByDate = new Map();

  if (qualifyingDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      availableFreezes: 0,
      consecutiveActive: 0,
      frozenDates,
      qualifyingSet,
      streakChainSet: new Set(),
      streakDayNumByDate
    };
  }

  const todayObj = getLogicalTodayDate(nowObj);
  const todayStr = toLocalDateStr(todayObj);
  const firstDateObj = parseLocalDateStr(qualifyingDates[0]);
  const lastQualifyingObj = parseLocalDateStr(qualifyingDates[qualifyingDates.length - 1]);
  const endDateObj = lastQualifyingObj > todayObj ? lastQualifyingObj : todayObj;

  let currentStreak = 0;
  let bestStreak = 0;
  let availableFreezes = 0;
  let consecutiveActive = 0;

  const cursor = new Date(
    firstDateObj.getFullYear(),
    firstDateObj.getMonth(),
    firstDateObj.getDate()
  );

  while (cursor <= endDateObj) {
    const dStr = toLocalDateStr(cursor);

    if (qualifyingSet.has(dStr)) {
      currentStreak++;
      consecutiveActive++;
      streakDayNumByDate.set(dStr, currentStreak);
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
      if (consecutiveActive >= STREAK_FREEZE_INTERVAL) {
        if (availableFreezes < MAX_STREAK_FREEZES) {
          availableFreezes++;
        }
        consecutiveActive = 0;
      }
    } else if (dStr < todayStr) {
      // Missed past day
      consecutiveActive = 0;
      if (currentStreak > 0) {
        if (availableFreezes > 0) {
          availableFreezes--;
          frozenDates.add(dStr);
          streakDayNumByDate.set(dStr, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const streakChainSet = new Set([...qualifyingSet, ...frozenDates]);

  return {
    currentStreak,
    bestStreak,
    availableFreezes,
    consecutiveActive,
    frozenDates,
    qualifyingSet,
    streakChainSet,
    streakDayNumByDate
  };
}

function announceFreezeIfEarned(prevFreezes) {
  const { availableFreezes, currentStreak } = computeStreakAndFreezes();
  if (availableFreezes > prevFreezes) {
    showToast(
      `❄️ ${currentStreak}-day streak! You earned +1 Streak Freeze (${availableFreezes}/${MAX_STREAK_FREEZES})!`
    );
  }
}

/**
 * Evaluates whether all Daily Tasks are done for today.
 * - All Daily Tasks done (0 activities) -> Silver Star on calendar (does not count towards streak)
 * - All Daily Tasks done + 1+ Activity logged -> Gold Star on calendar (counts towards streak)
 */
function evaluateTodayDailyStar(announceIfEarned = false) {
  const todayStr = getLogicalTodayStr();
  const hadDailyTasksDone = Boolean(state.dailyStarsByDate[todayStr]);
  const allDailyTasksDone =
    state.dailyTasks.length > 0 && state.dailyTasks.every((t) => Boolean(t.doneToday));
  const hasActivityLoggedToday = state.logs.some((l) => l.date === todayStr);
  const scheduledDoneToday = areAllScheduledTasksDoneForDate(todayStr);

  if (allDailyTasksDone) {
    state.dailyStarsByDate[todayStr] = true;
    if (!hadDailyTasksDone && announceIfEarned) {
      const earnedGold = hasActivityLoggedToday && scheduledDoneToday;
      trackAnalyticsEvent("daily_star_earned", {
        star_type: earnedGold ? "gold" : "silver"
      });
      if (earnedGold) {
        showToast("⭐ Gold Daily Star earned! All Daily Tasks, Scheduled Tasks + Activity completed today!");
      } else if (!hasActivityLoggedToday && !scheduledDoneToday) {
        showToast("★ Silver Star earned! Complete an activity & today's scheduled tasks to upgrade to Gold!");
      } else if (!hasActivityLoggedToday) {
        showToast("★ Silver Star earned! Complete an activity today to upgrade to a Gold Star & streak!");
      } else {
        showToast("★ Silver Star earned! Finish today's To-Do & Schedule tasks to upgrade to Gold!");
      }
    }
  } else {
    delete state.dailyStarsByDate[todayStr];
  }
}

function getActiveList() {
  return state.lists.find((l) => l.id === state.activeListId) || state.lists[0];
}

function getHeroSelectedIds() {
  const raw = Array.isArray(state.heroListIds) ? state.heroListIds : [];
  if (raw.includes(PROCRASTINATION_LIST_ID)) {
    return [PROCRASTINATION_LIST_ID];
  }
  const validIds = raw.filter((id) => state.lists.some((l) => l.id === id));
  if (validIds.length > 0) return validIds;
  return [getActiveList().id];
}

function getNextProcrastinationTarget(task) {
  const subtasks = Array.isArray(task && task.subtasks) ? task.subtasks : [];
  const firstIncompleteIndex = subtasks.findIndex((s) => !s.done);
  if (firstIncompleteIndex !== -1) {
    const firstIncomplete = subtasks[firstIncompleteIndex];
    return {
      title: firstIncomplete.title,
      subtaskId: firstIncomplete.id,
      parentTitle: task.title,
      subtaskIndex: firstIncompleteIndex + 1,
      subtaskTotal: subtasks.length
    };
  }
  return {
    title: task.title,
    subtaskId: null,
    parentTitle: null,
    subtaskIndex: 0,
    subtaskTotal: 0
  };
}

function getActiveHeroPool() {
  const selectedIds = getHeroSelectedIds();
  if (selectedIds[0] === PROCRASTINATION_LIST_ID) {
    const tasks = Array.isArray(state.procrastinationTasks) ? state.procrastinationTasks : [];
    return {
      id: PROCRASTINATION_LIST_ID,
      name: "Procrastination List",
      color: PROCRASTINATION_LIST_COLOR,
      isProcrastination: true,
      isMultiList: false,
      selectedIds,
      items: tasks
        .filter((t) => !t.doneToday)
        .map((t) => {
          const target = getNextProcrastinationTarget(t);
          return {
            id: t.id,
            title: target.title,
            subtaskId: target.subtaskId,
            parentTitle: target.parentTitle,
            subtaskIndex: target.subtaskIndex,
            subtaskTotal: target.subtaskTotal,
            checked: true,
            weight: 1,
            listId: PROCRASTINATION_LIST_ID,
            listName: "Procrastination List",
            listColor: PROCRASTINATION_LIST_COLOR
          };
        })
    };
  }

  const selectedLists = selectedIds
    .map((id) => state.lists.find((l) => l.id === id))
    .filter(Boolean);
  const primary = selectedLists[0] || getActiveList();
  const isMultiList = selectedLists.length > 1;
  const combinedItems = [];

  selectedLists.forEach((list) => {
    const listColor = list.color || PALETTE[0];
    list.items.forEach((item) => {
      combinedItems.push({
        ...item,
        listId: list.id,
        listName: list.name,
        listColor
      });
    });
  });

  return {
    id: primary.id,
    name: isMultiList ? `${selectedLists.length} Lists` : primary.name,
    color: primary.color || PALETTE[0],
    isProcrastination: false,
    isMultiList,
    selectedIds,
    items: combinedItems
  };
}

function getListColor(listId, fallback = PALETTE[0]) {
  if (listId === PROCRASTINATION_LIST_ID) return PROCRASTINATION_LIST_COLOR;
  const list = state.lists.find((l) => l.id === listId);
  return (list && list.color) || fallback;
}

function syncListColorReferences(list) {
  const listColor = list.color || PALETTE[0];
  state.logs.forEach((log) => {
    if (log.listId === list.id) {
      log.color = listColor;
    }
  });
  if (state.activeDecision && state.activeDecision.listId === list.id) {
    state.activeDecision.color = listColor;
  }
}

// Instant Floating Hover Tooltip for Monthly Calendar Pills, "+N more", and Star Badges
function showCalendarTooltip(htmlContent, mouseEvent) {
  const tooltip = document.getElementById("cal-hover-tooltip");
  if (!tooltip) return;
  tooltip.innerHTML = htmlContent;
  tooltip.classList.remove("hidden");
  positionCalendarTooltip(mouseEvent);
}

function positionCalendarTooltip(mouseEvent) {
  const tooltip = document.getElementById("cal-hover-tooltip");
  if (!tooltip || tooltip.classList.contains("hidden")) return;

  const offset = 12;
  const rect = tooltip.getBoundingClientRect();
  let left = mouseEvent.clientX + offset;
  let top = mouseEvent.clientY + offset;

  if (left + rect.width > window.innerWidth - 12) {
    left = mouseEvent.clientX - rect.width - offset;
  }
  if (top + rect.height > window.innerHeight - 12) {
    top = mouseEvent.clientY - rect.height - offset;
  }

  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideCalendarTooltip() {
  const tooltip = document.getElementById("cal-hover-tooltip");
  if (tooltip) {
    tooltip.classList.add("hidden");
  }
}

function setModalWeight(weight) {
  selectedModalWeight = normalizeWeight(weight);
  const weightBtns = document.querySelectorAll("#modal-list-weights .weight-pill-btn");
  weightBtns.forEach((btn) => {
    const isMatch = Number(btn.dataset.weight) === selectedModalWeight;
    btn.classList.toggle("is-selected", isMatch);
    btn.setAttribute("aria-checked", isMatch ? "true" : "false");
  });
}

let pendingModalSubtasks = [];

function renderModalSubtasksList() {
  const listEl = document.getElementById("modal-subtasks-list");
  if (!listEl) return;
  if (pendingModalSubtasks.length === 0) {
    listEl.innerHTML = "";
    listEl.classList.add("hidden");
    return;
  }
  listEl.classList.remove("hidden");
  listEl.innerHTML = pendingModalSubtasks
    .map(
      (subTitle, idx) => `
      <li class="modal-subtask-chip">
        <span class="modal-subtask-num">${idx + 1}.</span>
        <span class="modal-subtask-text">${escapeHtml(subTitle)}</span>
        <button type="button" class="btn-icon danger modal-subtask-remove" data-subtask-index="${idx}" title="Remove subtask" aria-label="Remove subtask">×</button>
      </li>
    `
    )
    .join("");
}

function addPendingModalSubtask() {
  const subInput = document.getElementById("input-modal-subtask");
  if (!subInput) return;
  const val = subInput.value.trim();
  if (!val) return;
  pendingModalSubtasks.push(val);
  subInput.value = "";
  renderModalSubtasksList();
  subInput.focus();
}

function collectPendingModalSubtasks() {
  const subInput = document.getElementById("input-modal-subtask");
  if (subInput) {
    const trailing = subInput.value.trim();
    if (trailing) {
      pendingModalSubtasks.push(trailing);
      subInput.value = "";
    }
  }
  return pendingModalSubtasks.slice();
}

// Input / Rename Pop-up Modal
function openInputModal({
  title,
  label,
  initialValue = "",
  placeholder = "",
  maxLength = 80,
  saveLabel = "Save",
  showColorPicker = false,
  initialColor = PALETTE[0],
  showWeightPicker = false,
  initialWeight = 1,
  showSubtasksEditor = false,
  showAddAnother = false,
  onSave
}) {
  document.getElementById("modal-list-title").textContent = title;
  const labelEl = document.getElementById("modal-list-label");
  if (labelEl) labelEl.textContent = label;
  const inputEl = document.getElementById("input-list-name");
  inputEl.value = initialValue;
  inputEl.placeholder = placeholder;
  inputEl.maxLength = maxLength;

  const colorSection = document.getElementById("modal-list-color-section");
  if (colorSection) {
    colorSection.classList.toggle("hidden", !showColorPicker);
    if (showColorPicker) {
      selectedListModalColor = PALETTE.includes(initialColor) ? initialColor : PALETTE[0];
      renderListModalColorPicker();
    }
  }

  const weightSection = document.getElementById("modal-list-weight-section");
  if (weightSection) {
    weightSection.classList.toggle("hidden", !showWeightPicker);
    if (showWeightPicker) {
      setModalWeight(initialWeight);
    }
  }

  const subtasksSection = document.getElementById("modal-list-subtasks-section");
  pendingModalSubtasks = [];
  if (subtasksSection) {
    subtasksSection.classList.toggle("hidden", !showSubtasksEditor);
    const subInput = document.getElementById("input-modal-subtask");
    if (subInput) subInput.value = "";
    renderModalSubtasksList();
  }

  const saveBtn = document.getElementById("btn-modal-save");
  if (saveBtn) saveBtn.textContent = saveLabel;

  const addAnotherBtn = document.getElementById("btn-modal-add-another");
  if (addAnotherBtn) addAnotherBtn.classList.toggle("hidden", !showAddAnother);

  pendingInputAction = onSave;
  document.getElementById("modal-list").classList.remove("hidden");
  inputEl.focus();
  inputEl.select();
}

function closeInputModal() {
  pendingInputAction = null;
  pendingModalSubtasks = [];
  const subInput = document.getElementById("input-modal-subtask");
  if (subInput) subInput.value = "";
  renderModalSubtasksList();
  document.getElementById("modal-list").classList.add("hidden");
}

// Confirmation Pop-up Modal
function openConfirmModal(title, message, onConfirm) {
  document.getElementById("modal-confirm-title").textContent = title;
  document.getElementById("modal-confirm-message").textContent = message;
  pendingConfirmAction = onConfirm;
  document.getElementById("modal-confirm").classList.remove("hidden");
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  document.getElementById("modal-confirm").classList.add("hidden");
}

function openAboutModal() {
  const modal = document.getElementById("modal-about");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function closeAboutModal() {
  const modal = document.getElementById("modal-about");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Toast Notification
function showToast(message) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Theme Handling
const ASTROLOGY_DAY_PROMPTS = [
  // 0: Sunday (Sun)
  [
    "What is the Sun calling me to do?",
    "What does the Sun call for?",
    "What would the Sun have me pursue?"
  ],
  // 1: Monday (Moon)
  [
    "What is the Moon guiding me to do?",
    "What does the Moon ask?",
    "What would the Moon have me tend to?"
  ],
  // 2: Tuesday (Mars)
  [
    "What is Mars daring me to do?",
    "What does Mars demand?",
    "What would Mars have me tackle?"
  ],
  // 3: Wednesday (Mercury)
  [
    "What is Mercury nudging me to do?",
    "What does Mercury propose?",
    "What would Mercury have me explore?"
  ],
  // 4: Thursday (Jupiter)
  [
    "What is Jupiter inviting me to do?",
    "What does Jupiter encourage?",
    "What would Jupiter have me embrace?"
  ],
  // 5: Friday (Venus)
  [
    "What is Venus tempting me to do?",
    "What does Venus wish for?",
    "What would Venus have me indulge in?"
  ],
  // 6: Saturday (Saturn)
  [
    "What is Saturn expecting me to do?",
    "What does Saturn assign?",
    "What would Saturn have me complete?"
  ]
];

let astrologyHeroPromptIndex = Math.floor(Math.random() * 3);

function getAstrologyHeroTitle() {
  const dayIdx = getLogicalTodayDate().getDay();
  const options = ASTROLOGY_DAY_PROMPTS[dayIdx] || ASTROLOGY_DAY_PROMPTS[0];
  return options[astrologyHeroPromptIndex % options.length];
}

const TAROT_HERO_PROMPTS = [
  "What card does fate turn over next?",
  "The deck is shuffled. What will you draw?",
  "Which Arcana guides your next move?",
  "Cut the deck and see what awaits.",
  "What omen lies face-down on the table?",
  "The Major Arcana are watching. Draw a card.",
  "What destiny sits at the top of the deck?",
  "Pull a card from the spread of today.",
  "What does the next card reveal?",
  "A card waits to be turned. What is it?"
];

let tarotHeroPromptIndex = Math.floor(Math.random() * TAROT_HERO_PROMPTS.length);

function getTarotHeroTitle() {
  return TAROT_HERO_PROMPTS[tarotHeroPromptIndex % TAROT_HERO_PROMPTS.length];
}

const ASTROLOGY_QUIPS = [
  "Mercury is in microwave, so you must do this.",
  "Venus demands it. Do not argue with a planet.",
  "Saturn looked at your to-do list and sighed. Proceed.",
  "Your aura is 73% chaotic today — this will balance your vibes.",
  "Moon in Sagittarius says: no excuses, bestie.",
  "Jupiter aligned with your snack drawer. Destiny calls.",
  "The cosmos checked your birth chart and said 'just do the thing.'",
  "A mysterious comet whispered that this is your main-character arc."
];

const TAROT_QUIPS = [
  "The Fool says: leap first, overthink never.",
  "The Magician reminds you: you already have the tools. Now start.",
  "The Hermit approves of this quiet quest.",
  "The Chariot demands momentum — no stalling.",
  "Wheel of Fortune spun in your favor. Take the hint.",
  "Strength isn't brute force — it's finally doing this task.",
  "The Tower wouldn't collapse if you just knocked this out.",
  "The Star says: good vibes ahead once this is logged.",
  "Justice has weighed your excuses and found them lacking.",
  "The World awaits on the other side of completing this."
];

const WIN95_HERO_PROMPTS = [
  "DecideForMe.exe is ready. Run an activity?",
  "No illegal operations detected. What's next?",
  "Select a task to execute in your free time:",
  "C:\\Users\\You> What should we run next?",
  "Task Manager recommends doing something fun.",
  "Click 'Run Decide.exe' to roll the dice."
];

let win95HeroPromptIndex = Math.floor(Math.random() * WIN95_HERO_PROMPTS.length);

function getWin95HeroTitle() {
  return WIN95_HERO_PROMPTS[win95HeroPromptIndex % WIN95_HERO_PROMPTS.length];
}

const WIN95_QUIPS = [
  "DecideForMe.exe has performed a valid operation.",
  "It is now safe to complete this activity.",
  "Clippy says: Looks like you're trying to be productive!",
  "0 errors, 0 warnings. Proceed with this task.",
  "Plug and Play detected: high-priority fun ahead.",
  "Saved to C:\\HABITS\\TODAY.LOG — go knock it out!",
  "System resources are 98% ready for this activity.",
  "Press OK to acknowledge your fate."
];

const DARK_PROCRASTINATION_JACKPOT_QUIPS = [
  "🎰 JACKPOT! You beat 99-to-1 odds! Congratulations on your incredible luck—your grand prize is doing the thing you've been avoiding.",
  "🎉 1% LOTTERY WINNER! Out of all the fun things you could've rolled, you hit the rarest ticket in the house. Time to tackle what you didn't want to do!",
  "🏆 Against 100-to-1 odds, you won the grand prize! Lucky you—now go knock out the task you've been putting off.",
  "🎲 1% Critical Hit! Congratulations, lucky roller—fate says your reward is finally doing the thing you've been dodging."
];

const ASTROLOGY_PROCRASTINATION_JACKPOT_QUIPS = [
  "🔮 1% COSMIC JACKPOT! A once-in-a-century planetary alignment just chose you—congratulations on your absurdly lucky stars! Now you must face the task you banished to the Void.",
  "✨ THE STARS HIT THE LOTTERY FOR YOU! 1% cosmic odds, and somehow you pulled it. How lucky! The universe insists you finally do what you've been avoiding.",
  "🌠 1% ASTRAL MIRACLE! Saturn and Jupiter both gasped at your luck. Congrats—your celestial prize is doing the one thing you really didn't want to do!",
  "🌙 FORTUNE'S FAVORITE (1% ODDS)! Congratulations on this rare celestial blessing. Now channel that lucky energy into conquering the Void!"
];

const TAROT_PROCRASTINATION_JACKPOT_QUIPS = [
  "🃏 1% ARCANA JACKPOT! The Wheel of Fortune spun a 1-in-100 miracle just for you—how lucky! Now turn over that reversed card and do what you've been avoiding.",
  "🕯️ FATE'S RAREST DRAW (1% ODDS)! Congratulations, fortunate soul—you beat the whole deck! Your destiny is to finally face the task you didn't want to pull.",
  "✦ THE DECK HAS SPOKEN (1% CHANCE)! What astonishing luck! The Major Arcana congratulate you—and demand you complete the shadow task you've been dodging.",
  "🌑 1% LUCKY OMEN! Out of every card on the table, you drew the rarest twist of fate. Congrats—time to conquer the task you kept face-down!"
];

const WIN95_PROCRASTINATION_JACKPOT_QUIPS = [
  "🎰 C:\\LUCK\\JACKPOT.EXE! You just hit a 1% system lottery! Congratulations, User #1,000,000—your prize is emptying this task from the Recycle Bin!",
  "🖥️ 1% RARE SYSTEM EVENT! What unbelievable luck! DecideForMe.exe congratulates you—now please execute the task you've been minimizing all day.",
  "💾 CONGRATULATIONS! YOU WON THE 1% LOTTERY! No, this isn't a pop-up ad—you really rolled the Recycle Bin. Time to do what you didn't want to do!",
  "🏆 0x000001% CRITICAL LUCKY OPERATION! Clippy is throwing confetti! Your reward for beating 99-to-1 odds is doing the task you've been putting off."
];

function normalizeTheme(theme) {
  if (theme === "astrology" || theme === "tarot" || theme === "win95") return theme;
  return "dark";
}

function isAstrologyTheme() {
  return state.theme === "astrology";
}

function isTarotTheme() {
  return state.theme === "tarot";
}

function isWin95Theme() {
  return state.theme === "win95";
}

function pickSeededQuip(decision, quips) {
  if (!decision) return quips[0];
  const seedStr = `${decision.itemId || ""}|${decision.title || ""}|${decision.rerolls || 0}|${getLogicalTodayStr()}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return quips[hash % quips.length];
}

function getProcrastinationJackpotQuip(decision) {
  if (isAstrologyTheme()) return pickSeededQuip(decision, ASTROLOGY_PROCRASTINATION_JACKPOT_QUIPS);
  if (isTarotTheme()) return pickSeededQuip(decision, TAROT_PROCRASTINATION_JACKPOT_QUIPS);
  if (isWin95Theme()) return pickSeededQuip(decision, WIN95_PROCRASTINATION_JACKPOT_QUIPS);
  return pickSeededQuip(decision, DARK_PROCRASTINATION_JACKPOT_QUIPS);
}

function getThemeQuip(decision) {
  if (decision && decision.isProcrastinationJackpot) {
    return getProcrastinationJackpotQuip(decision);
  }
  if (isAstrologyTheme()) return pickSeededQuip(decision, ASTROLOGY_QUIPS);
  if (isTarotTheme()) return pickSeededQuip(decision, TAROT_QUIPS);
  if (isWin95Theme()) return pickSeededQuip(decision, WIN95_QUIPS);
  return "";
}

function applyThemeCopy() {
  const astro = isAstrologyTheme();
  const tarot = isTarotTheme();
  const win95 = isWin95Theme();

  const brandSubtitle = document.querySelector(".brand-subtitle");
  if (brandSubtitle) {
    brandSubtitle.textContent = astro
      ? "The stars have opinions. Let the cosmos decide."
      : tarot
        ? "Shuffle the deck. Let the cards decide."
        : win95
          ? "DecideForMe.exe — Check what you're up for, and click Run."
          : "Check what you're up for, and roll the dice.";
  }

  const heroIdleTitle = document.getElementById("hero-idle-title");
  if (heroIdleTitle) {
    heroIdleTitle.textContent = astro
      ? getAstrologyHeroTitle()
      : tarot
        ? getTarotHeroTitle()
        : win95
          ? getWin95HeroTitle()
          : "What should we do next?";
  }

  const decideDiceIcon = document.getElementById("decide-dice-icon");
  if (decideDiceIcon) {
    decideDiceIcon.textContent = astro ? "🔮" : tarot ? "🃏" : win95 ? "💾" : "🎲";
  }

  const decideLabel = document.getElementById("btn-decide-label");
  if (decideLabel) {
    decideLabel.textContent = astro
      ? "Consult the Stars!"
      : tarot
        ? "Draw a Card!"
        : win95
          ? "Run Decide.exe"
          : "Decide For Me!";
  }

  const rollingDiceIcon = document.getElementById("rolling-dice-icon");
  if (rollingDiceIcon) {
    rollingDiceIcon.textContent = astro ? "🔮" : tarot ? "🃏" : win95 ? "⌛" : "🎲";
  }

  const rollingLabelText = document.getElementById("rolling-label-text");
  if (rollingLabelText) {
    rollingLabelText.textContent = astro
      ? "Aligning your chakras & blaming Mercury..."
      : tarot
        ? "Shuffling the Major Arcana..."
        : win95
          ? "Searching C:\\ACTIVITIES\\POOL..."
          : "Rolling your checked pool...";
  }

  const rerollLabel = document.getElementById("btn-reroll-label");
  if (rerollLabel) {
    rerollLabel.textContent = astro
      ? "🌙 Defy Fate (Re-roll)"
      : tarot
        ? "🃏 Draw Another (Re-roll)"
        : win95
          ? "🎲 Retry (Re-roll)"
          : "🎲 Re-roll";
  }

  const sectionLabels = [
    ["section-label-activity-lists", "✨ Sacred Scrolls", "🃏 The Deck", "📁 Activity Lists", "Activity Lists"],
    ["section-label-daily-tasks", "🕯️ Daily Rituals", "🕯️ Daily Spread", "📋 Daily Checklist", "Daily Checklist"],
    ["section-label-scheduled-tasks", "📜 To-Do & Schedule", "📜 To-Do & Schedule", "🗓️ To-Do & Schedule", "To-Do & Schedule"],
    ["section-label-procrastination", "🕳️ The Void (Procrastination)", "🌑 Reversed Cards (Procrastination)", "🗑️ Recycle Bin (Procrastination)", "Procrastination List"]
  ];
  sectionLabels.forEach(([id, astroText, tarotText, win95Text, darkText]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = astro ? astroText : tarot ? tarotText : win95 ? win95Text : darkText;
    }
  });
}

function applyTheme() {
  state.theme = normalizeTheme(state.theme);
  document.documentElement.setAttribute("data-theme", state.theme);
  const currentThemeMeta =
    state.theme === "astrology"
      ? { icon: "🔮", label: "Astrology Theme", metaColor: "#0c071b" }
      : state.theme === "tarot"
        ? { icon: "🃏", label: "Tarot Theme", metaColor: "#12090d" }
        : state.theme === "win95"
          ? { icon: "🖥️", label: "Windows 95", metaColor: "#008080" }
          : { icon: "🌙", label: "Dark Theme", metaColor: "#0f1117" };
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.textContent = currentThemeMeta.icon;
  }
  const label = document.getElementById("theme-label");
  if (label) {
    label.textContent = currentThemeMeta.label;
  }
  const footerIcon = document.getElementById("theme-icon-footer");
  if (footerIcon) {
    footerIcon.textContent = currentThemeMeta.icon;
  }
  const footerLabel = document.getElementById("theme-label-footer");
  if (footerLabel) {
    footerLabel.textContent = currentThemeMeta.label;
  }
  document.querySelectorAll(".theme-option").forEach((opt) => {
    const isActive = opt.dataset.themeValue === state.theme;
    opt.classList.toggle("is-active", isActive);
    opt.setAttribute("aria-checked", isActive ? "true" : "false");
  });
  const metaThemeColor = document.getElementById("meta-theme-color");
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", currentThemeMeta.metaColor);
  }
  applyThemeCopy();
}

/**
 * Mobile Touch Drag-and-Drop Helper for `.drag-grip` handles.
 * Keeps desktop HTML5 drag-and-drop untouched while allowing phone users
 * to drag the `⠿` grip handle to reorder lists, activities, and daily tasks.
 */
function bindTouchReorder({
  gripEl,
  itemEl,
  containerEl,
  itemSelector,
  datasetKey,
  sourceId,
  onReorder
}) {
  if (!gripEl) return;
  let targetId = null;
  let isTouchDragging = false;

  gripEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      isTouchDragging = true;
      targetId = null;
      itemEl.classList.add("dragging");
    },
    { passive: true }
  );

  gripEl.addEventListener(
    "touchmove",
    (e) => {
      if (!isTouchDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const hitEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const overItem = hitEl ? hitEl.closest(itemSelector) : null;

      containerEl.querySelectorAll(itemSelector).forEach((el) => {
        el.classList.remove("drag-over");
      });

      if (overItem && containerEl.contains(overItem)) {
        const candidateId = overItem.dataset[datasetKey];
        if (candidateId && candidateId !== sourceId) {
          overItem.classList.add("drag-over");
          targetId = candidateId;
          return;
        }
      }
      targetId = null;
    },
    { passive: false }
  );

  const finishTouchDrag = () => {
    if (!isTouchDragging) return;
    isTouchDragging = false;
    itemEl.classList.remove("dragging");
    containerEl.querySelectorAll(itemSelector).forEach((el) => {
      el.classList.remove("drag-over");
    });
    if (targetId && targetId !== sourceId) {
      const finalTargetId = targetId;
      targetId = null;
      onReorder(sourceId, finalTargetId);
    }
  };

  gripEl.addEventListener("touchend", finishTouchDrag);
  gripEl.addEventListener("touchcancel", () => {
    isTouchDragging = false;
    targetId = null;
    itemEl.classList.remove("dragging");
    containerEl.querySelectorAll(itemSelector).forEach((el) => {
      el.classList.remove("drag-over");
    });
  });
}

function syncEditModeButton(btnId, labelId, isEditing) {
  const btn = document.getElementById(btnId);
  const label = document.getElementById(labelId);
  if (btn) {
    btn.classList.toggle("is-active", isEditing);
    btn.setAttribute("aria-pressed", isEditing ? "true" : "false");
  }
  if (label) {
    label.textContent = isEditing ? "Done" : "Edit";
  }
}

function reorderArrayById(arr, fromId, toId) {
  if (!Array.isArray(arr)) return false;
  const fromIdx = arr.findIndex((item) => item.id === fromId);
  const toIdx = arr.findIndex((item) => item.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return false;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  return true;
}

/**
 * Delegated HTML5 drag-and-drop + touch-grip reorder for a list container.
 * Bound once in initEvents() so individual <li> renders don't attach drag closures.
 */
function bindListDragReorder({
  containerEl,
  itemSelector,
  datasetKey,
  onReorder
}) {
  if (!containerEl) return;
  let draggedId = null;
  let touchSourceEl = null;
  let touchSourceId = null;
  let touchTargetId = null;

  const clearDragOver = () => {
    containerEl.querySelectorAll(itemSelector).forEach((el) => el.classList.remove("drag-over"));
  };

  containerEl.addEventListener("dragstart", (e) => {
    const itemEl = e.target.closest(itemSelector);
    if (!itemEl || !itemEl.draggable || !containerEl.contains(itemEl)) return;
    draggedId = itemEl.dataset[datasetKey] || null;
    if (!draggedId) return;
    itemEl.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedId);
    }
  });

  containerEl.addEventListener("dragover", (e) => {
    if (!draggedId) return;
    const itemEl = e.target.closest(itemSelector);
    if (!itemEl || !containerEl.contains(itemEl)) return;
    const targetId = itemEl.dataset[datasetKey];
    if (!targetId || targetId === draggedId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    clearDragOver();
    itemEl.classList.add("drag-over");
  });

  containerEl.addEventListener("dragleave", (e) => {
    const itemEl = e.target.closest(itemSelector);
    if (itemEl && !itemEl.contains(e.relatedTarget)) {
      itemEl.classList.remove("drag-over");
    }
  });

  containerEl.addEventListener("drop", (e) => {
    const itemEl = e.target.closest(itemSelector);
    if (!itemEl || !containerEl.contains(itemEl)) return;
    e.preventDefault();
    clearDragOver();
    const targetId = itemEl.dataset[datasetKey];
    if (!draggedId || !targetId || draggedId === targetId) return;
    const fromId = draggedId;
    draggedId = null;
    onReorder(fromId, targetId);
  });

  containerEl.addEventListener("dragend", (e) => {
    draggedId = null;
    const itemEl = e.target.closest(itemSelector);
    if (itemEl) itemEl.classList.remove("dragging");
    clearDragOver();
  });

  containerEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const grip = e.target.closest(".drag-grip");
      if (!grip) return;
      const itemEl = grip.closest(itemSelector);
      if (!itemEl || !containerEl.contains(itemEl)) return;
      touchSourceEl = itemEl;
      touchSourceId = itemEl.dataset[datasetKey] || null;
      touchTargetId = null;
      itemEl.classList.add("dragging");
    },
    { passive: true }
  );

  containerEl.addEventListener(
    "touchmove",
    (e) => {
      if (!touchSourceId || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const hitEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const overItem = hitEl ? hitEl.closest(itemSelector) : null;
      clearDragOver();
      if (overItem && containerEl.contains(overItem)) {
        const candidateId = overItem.dataset[datasetKey];
        if (candidateId && candidateId !== touchSourceId) {
          overItem.classList.add("drag-over");
          touchTargetId = candidateId;
          return;
        }
      }
      touchTargetId = null;
    },
    { passive: false }
  );

  const finishTouchDrag = () => {
    if (!touchSourceId) return;
    const fromId = touchSourceId;
    const toId = touchTargetId;
    if (touchSourceEl) touchSourceEl.classList.remove("dragging");
    touchSourceEl = null;
    touchSourceId = null;
    touchTargetId = null;
    clearDragOver();
    if (toId && toId !== fromId) {
      onReorder(fromId, toId);
    }
  };

  containerEl.addEventListener("touchend", finishTouchDrag);
  containerEl.addEventListener("touchcancel", () => {
    if (touchSourceEl) touchSourceEl.classList.remove("dragging");
    touchSourceEl = null;
    touchSourceId = null;
    touchTargetId = null;
    clearDragOver();
  });
}

// Render Color Swatches for List Modal
function renderListModalColorPicker() {
  const container = document.getElementById("modal-list-colors");
  if (!container) return;
  container.innerHTML = "";
  PALETTE.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `color-swatch-btn ${color === selectedListModalColor ? "selected" : ""}`;
    btn.style.backgroundColor = color;
    btn.title = "Pick list color";
    btn.setAttribute("aria-label", `Pick color ${color}`);
    btn.addEventListener("click", () => {
      selectedListModalColor = color;
      renderListModalColorPicker();
    });
    container.appendChild(btn);
  });
}

// Render Draggable List Tabs
function renderListTabs() {
  const tabsEl = document.getElementById("list-tabs");
  tabsEl.innerHTML = "";

  state.lists.forEach((list) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "tab";
    btn.draggable = true;
    btn.dataset.listId = list.id;
    btn.ariaSelected = list.id === state.activeListId ? "true" : "false";
    btn.className = `list-tab ${list.id === state.activeListId ? "active" : ""}`;
    const listColor = list.color || PALETTE[0];
    btn.style.setProperty("--tab-list-color", listColor);
    btn.innerHTML = `
      <span class="drag-grip" title="Drag to reorder list" aria-hidden="true">⠿</span>
      <span class="color-dot list-tab-dot" style="background-color: ${listColor}"></span>
      <span>${escapeHtml(list.name)}</span>
    `;

    btn.addEventListener("click", () => {
      if (isRolling) return;
      state.activeListId = list.id;
      saveState();
      renderAll();
    });

    btn.addEventListener("dragstart", (e) => {
      draggedListId = list.id;
      btn.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", list.id);
    });

    btn.addEventListener("dragover", (e) => {
      if (!draggedListId || draggedListId === list.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      btn.classList.add("drag-over");
    });

    btn.addEventListener("dragleave", () => {
      btn.classList.remove("drag-over");
    });

    btn.addEventListener("drop", (e) => {
      e.preventDefault();
      btn.classList.remove("drag-over");
      if (!draggedListId || draggedListId === list.id) return;

      const fromIdx = state.lists.findIndex((l) => l.id === draggedListId);
      const toIdx = state.lists.findIndex((l) => l.id === list.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = state.lists.splice(fromIdx, 1);
      state.lists.splice(toIdx, 0, moved);
      draggedListId = null;
      saveState();
      renderAll();
    });

    btn.addEventListener("dragend", () => {
      draggedListId = null;
      btn.classList.remove("dragging");
      tabsEl.querySelectorAll(".list-tab").forEach((el) => el.classList.remove("drag-over"));
    });

    bindTouchReorder({
      gripEl: btn.querySelector(".drag-grip"),
      itemEl: btn,
      containerEl: tabsEl,
      itemSelector: ".list-tab",
      datasetKey: "listId",
      sourceId: list.id,
      onReorder: (fromId, toId) => {
        const fromIdx = state.lists.findIndex((l) => l.id === fromId);
        const toIdx = state.lists.findIndex((l) => l.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = state.lists.splice(fromIdx, 1);
        state.lists.splice(toIdx, 0, moved);
        saveState();
        renderAll();
      }
    });

    tabsEl.appendChild(btn);
  });

  const deleteBtn = document.getElementById("btn-delete-list");
  if (deleteBtn) {
    deleteBtn.disabled = state.lists.length <= 1;
  }
}

// Render Decision Engine Card
function renderHeroListSwitcherButtons(containerEl, activePool) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  const selectedIds = activePool.selectedIds || getHeroSelectedIds();
  const isProcrastActive = selectedIds.includes(PROCRASTINATION_LIST_ID);

  state.lists.forEach((list) => {
    const isActive = !isProcrastActive && selectedIds.includes(list.id);
    const listColor = list.color || PALETTE[0];
    const totalCount = list.items.length;
    const checkedCount = list.items.filter((i) => i.checked).length;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "tab";
    btn.ariaSelected = isActive ? "true" : "false";
    btn.className = `hero-list-btn ${isActive ? "active" : ""}`;
    btn.style.setProperty("--pill-list-color", listColor);
    btn.innerHTML = `
      <span class="color-dot hero-list-dot" style="background-color: ${listColor}"></span>
      <span>${escapeHtml(list.name)}</span>
      <span class="hero-count-pill">${checkedCount}/${totalCount} ready</span>
    `;
    btn.addEventListener("click", () => {
      if (isRolling) return;
      const current = getHeroSelectedIds();
      if (current.includes(PROCRASTINATION_LIST_ID)) {
        state.heroListIds = [list.id];
        state.activeListId = list.id;
      } else if (current.includes(list.id)) {
        if (current.length > 1) {
          const nextIds = current.filter((id) => id !== list.id);
          state.heroListIds = nextIds;
          if (!nextIds.includes(state.activeListId)) {
            state.activeListId = nextIds[nextIds.length - 1];
          }
        } else {
          state.activeListId = list.id;
        }
      } else {
        state.heroListIds = [...current, list.id];
        state.activeListId = list.id;
      }
      saveState();
      renderAll();
    });
    containerEl.appendChild(btn);
  });

  // Visual divider separating multi-select Activity Lists from exclusive Procrastination List
  const dividerEl = document.createElement("span");
  dividerEl.className = "hero-list-divider";
  dividerEl.setAttribute("aria-hidden", "true");
  containerEl.appendChild(dividerEl);

  // Procrastination List switcher pill (exclusive)
  const procrastTasks = Array.isArray(state.procrastinationTasks) ? state.procrastinationTasks : [];
  const pendingCount = procrastTasks.filter((t) => !t.doneToday).length;
  const pBtn = document.createElement("button");
  pBtn.type = "button";
  pBtn.role = "tab";
  pBtn.ariaSelected = isProcrastActive ? "true" : "false";
  pBtn.className = `hero-list-btn is-procrastination ${isProcrastActive ? "active" : ""}`;
  pBtn.style.setProperty("--pill-list-color", PROCRASTINATION_LIST_COLOR);
  pBtn.innerHTML = `
    <span class="color-dot hero-list-dot" style="background-color: ${PROCRASTINATION_LIST_COLOR}"></span>
    <span>Procrastination List</span>
    <span class="hero-count-pill">${pendingCount} pending</span>
  `;
  pBtn.addEventListener("click", () => {
    if (isRolling) return;
    state.heroListIds = [PROCRASTINATION_LIST_ID];
    saveState();
    renderAll();
  });
  containerEl.appendChild(pBtn);
}

function renderDecisionCard() {
  const cardEl = document.getElementById("decision-card");
  const idleEl = document.getElementById("decision-idle");
  const rollingEl = document.getElementById("decision-rolling");
  const activeEl = document.getElementById("decision-active");

  const activeList = getActiveHeroPool();
  const activeListColor = activeList.color || PALETTE[0];
  const checkedItems = activeList.items.filter((i) => i.checked);

  cardEl.style.setProperty("--hero-list-color", activeListColor);

  renderHeroListSwitcherButtons(document.getElementById("hero-list-switcher"), activeList);
  renderHeroListSwitcherButtons(document.getElementById("active-reroll-list-switcher"), activeList);

  const candidatePillsEl = document.getElementById("hero-candidate-pills");
  if (candidatePillsEl) {
    if (checkedItems.length === 0) {
      candidatePillsEl.innerHTML = `<span class="hero-empty-hint">No activities checked in this list yet — check some below to roll!</span>`;
    } else {
      candidatePillsEl.innerHTML = checkedItems
        .map((item) => {
          const weight = normalizeWeight(item.weight);
          const dotHtml = activeList.isMultiList
            ? `<span class="color-dot" style="background-color: ${item.listColor || activeListColor}"></span>`
            : "";
          return `<span class="hero-candidate-chip" data-item-id="${escapeHtml(item.id)}">${dotHtml}<span>${escapeHtml(item.title)}</span>${weight > 1 ? `<span class="hero-chip-weight" data-weight="${weight}">${weight}x</span>` : ""}</span>`;
        })
        .join("");
    }
  }

  const decideBtn = document.getElementById("btn-decide");
  decideBtn.disabled = checkedItems.length === 0;

  const rerollBtn = document.getElementById("btn-reroll");
  if (rerollBtn) {
    rerollBtn.disabled = checkedItems.length === 0 || Boolean(completingDecisionSnapshot);
  }

  const badgeChosenEl = activeEl.querySelector(".badge-chosen");
  const completeChosenBtn = document.getElementById("btn-complete-chosen");

  if (isRolling) {
    cardEl.classList.add("is-rolling");
    cardEl.classList.remove("has-active-choice", "is-completing-win", "is-jackpot-active");
    activeEl.classList.remove("is-win-hold", "is-win-exit");
    idleEl.classList.add("hidden");
    rollingEl.classList.remove("hidden");
    activeEl.classList.add("hidden");
    return;
  }

  cardEl.classList.remove("is-rolling");

  const displayDecision = state.activeDecision || completingDecisionSnapshot;

  if (displayDecision) {
    cardEl.classList.add("has-active-choice");
    cardEl.classList.toggle("is-jackpot-active", Boolean(displayDecision.isProcrastinationJackpot));
    idleEl.classList.add("hidden");
    rollingEl.classList.add("hidden");
    activeEl.classList.remove("hidden");

    const d = displayDecision;
    const isJackpot = Boolean(d.isProcrastinationJackpot);
    const chosenColor = getListColor(
      d.listId,
      d.color || PALETTE[0]
    );
    cardEl.style.setProperty("--hero-list-color", chosenColor);
    document.getElementById("chosen-color-dot").style.backgroundColor = chosenColor;
    activeEl.style.setProperty("--chosen-color", chosenColor);
    document.getElementById("chosen-title").textContent = d.title;
    document.getElementById("chosen-list-subtitle").textContent = d.parentTitle
      ? `From: ${d.parentTitle} (Step ${d.subtaskIndex}/${d.subtaskTotal}) • ${d.listName}`
      : `From list: ${d.listName}`;
    const quipEl = document.getElementById("chosen-theme-quip");
    if (quipEl) {
      const quipText = getThemeQuip(d);
      quipEl.classList.toggle("is-jackpot-quip", isJackpot);
      if (quipText) {
        quipEl.textContent = isJackpot
          ? quipText
          : isTarotTheme()
            ? `🃏 ${quipText}`
            : isWin95Theme()
              ? `💾 ${quipText}`
              : `✨ ${quipText}`;
        quipEl.classList.remove("hidden");
      } else {
        quipEl.textContent = "";
        quipEl.classList.add("hidden");
      }
    }
    document.getElementById("chosen-probability-meta").textContent = isJackpot
      ? `1% hidden odds • Lucky draw!`
      : `${d.weight}x weight • ${d.probabilityPct}% chance (${d.candidateCount} checked)`;

    if (completingDecisionSnapshot) {
      cardEl.classList.add("is-completing-win");
      activeEl.classList.add("is-win-hold");
      activeEl.classList.toggle("is-win-exit", completingDecisionSnapshot.phase === "exit");
      if (badgeChosenEl) {
        badgeChosenEl.textContent = isAstrologyTheme()
          ? "🌟 Prophecy Fulfilled!"
          : isTarotTheme()
            ? "🃏 Card Fulfilled!"
            : isWin95Theme()
              ? "💾 Task Logged!"
              : "✓ Completed & Logged!";
        badgeChosenEl.classList.add("is-win-logged");
      }
      if (completeChosenBtn) {
        completeChosenBtn.classList.add("is-win-hold");
        if (!completeChosenBtn.querySelector(".win-check-svg")) {
          completeChosenBtn.innerHTML = `<svg class="win-check-svg" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg> Logged!`;
        }
      }
    } else {
      cardEl.classList.remove("is-completing-win");
      activeEl.classList.remove("is-win-hold", "is-win-exit");
      if (badgeChosenEl) {
        if (isJackpot) {
          badgeChosenEl.textContent = isAstrologyTheme()
            ? "🔮 1% Cosmic Jackpot!"
            : isTarotTheme()
              ? "🃏 1% Fated Jackpot!"
              : isWin95Theme()
                ? "🎰 1% System Jackpot!"
                : "🎰 1% Lottery Jackpot!";
        } else {
          badgeChosenEl.textContent = isAstrologyTheme()
            ? "🌟 Cosmic Decree"
            : isTarotTheme()
              ? "🃏 Drawn Card"
              : isWin95Theme()
                ? "💾 Selected.exe"
                : "✨ Chosen Activity";
        }
        badgeChosenEl.classList.remove("is-win-logged");
      }
      if (completeChosenBtn) {
        completeChosenBtn.classList.remove("is-win-hold");
        if (d.listId === PROCRASTINATION_LIST_ID) {
          completeChosenBtn.innerHTML = isAstrologyTheme()
            ? `🎉 Banish from the Void!`
            : isTarotTheme()
              ? `🎉 Banish the Shadow!`
              : isWin95Theme()
                ? `🗑️ Empty from Recycle Bin!`
                : `🎉 Mark Done!`;
        } else {
          completeChosenBtn.innerHTML = isAstrologyTheme()
            ? `✨ Fulfill Prophecy &amp; Log`
            : isTarotTheme()
              ? `✨ Honor the Card &amp; Log`
              : isWin95Theme()
                ? `✓ OK — Complete &amp; Log`
                : `✓ Mark Complete &amp; Log`;
        }
      }
    }

    const rerollBadge = document.getElementById("active-reroll-badge");
    const sessionRerolls = Number(d.rerolls) || 0;
    if (sessionRerolls > 0) {
      rerollBadge.textContent = String(sessionRerolls);
      rerollBadge.classList.remove("hidden");
    } else {
      rerollBadge.classList.add("hidden");
    }
  } else {
    cardEl.classList.remove("has-active-choice", "is-completing-win", "is-jackpot-active");
    activeEl.classList.remove("is-win-hold", "is-win-exit");
    const quipEl = document.getElementById("chosen-theme-quip");
    if (quipEl) {
      quipEl.textContent = "";
      quipEl.classList.remove("is-jackpot-quip");
      quipEl.classList.add("hidden");
    }
    if (badgeChosenEl) {
      badgeChosenEl.textContent = isAstrologyTheme()
        ? "🌟 Cosmic Decree"
        : isTarotTheme()
          ? "🃏 Drawn Card"
          : isWin95Theme()
            ? "💾 Selected.exe"
            : "✨ Chosen Activity";
      badgeChosenEl.classList.remove("is-win-logged");
    }
    if (completeChosenBtn) {
      completeChosenBtn.classList.remove("is-win-hold");
      completeChosenBtn.innerHTML = isAstrologyTheme()
        ? `✨ Fulfill Prophecy &amp; Log`
        : isTarotTheme()
          ? `✨ Honor the Card &amp; Log`
          : isWin95Theme()
            ? `✓ OK — Complete &amp; Log`
            : `✓ Mark Complete &amp; Log`;
    }
    idleEl.classList.remove("hidden");
    rollingEl.classList.add("hidden");
    activeEl.classList.add("hidden");
  }
}

// Render Activity Pool Items
function renderActivityPool() {
  const activeList = getActiveList();
  const checkedCount = activeList.items.filter((i) => i.checked).length;
  const countBadge = document.getElementById("current-list-count-badge");
  if (countBadge) {
    countBadge.textContent = `${checkedCount}/${activeList.items.length}`;
  }

  const toggleCheckAllBtn = document.getElementById("btn-toggle-check-all");
  if (toggleCheckAllBtn) {
    const hasItems = activeList.items.length > 0;
    toggleCheckAllBtn.disabled = !hasItems;
    toggleCheckAllBtn.textContent = checkedCount > 0 ? "Uncheck All" : "Check All";
  }

  const listEl = document.getElementById("activity-list");
  listEl.style.setProperty("--active-list-color", activeList.color || PALETTE[0]);
  listEl.classList.toggle("is-editing", isEditingActivities);
  listEl.innerHTML = "";

  const editActivitiesBtn = document.getElementById("btn-edit-activities");
  syncEditModeButton("btn-edit-activities", "btn-edit-activities-label", isEditingActivities);

  const listManageActions = document.getElementById("list-manage-actions");
  if (listManageActions) {
    listManageActions.classList.toggle("hidden", !isEditingActivities);
  }

  if (activeList.items.length === 0) {
    listEl.innerHTML = `<li class="empty-state">No activities in this list yet. Click + Add New to add one!</li>`;
    return;
  }

  const totalCheckedWeight = activeList.items
    .filter((i) => i.checked)
    .reduce((sum, i) => sum + normalizeWeight(i.weight), 0);

  const todayStr = getLogicalTodayStr();
  const completedTodayIds = new Set(
    state.logs.filter((l) => l.date === todayStr).map((l) => l.itemId)
  );

  const frag = document.createDocumentFragment();

  activeList.items.forEach((item) => {
    const li = document.createElement("li");
    li.draggable = isEditingActivities;
    li.dataset.itemId = item.id;
    const isChosen = state.activeDecision && state.activeDecision.itemId === item.id;
    li.className = `activity-item ${item.checked ? "" : "unchecked"} ${isChosen ? "is-chosen" : ""}`;

    const weight = normalizeWeight(item.weight);
    const probPct =
      item.checked && totalCheckedWeight > 0
        ? Math.round((weight / totalCheckedWeight) * 100)
        : 0;

    const doneToday = completedTodayIds.has(item.id);

    li.innerHTML = `
      <div class="activity-left">
        <span class="drag-grip" title="Drag to reorder task" aria-hidden="true">⠿</span>
        <input
          type="checkbox"
          class="activity-checkbox"
          ${item.checked ? "checked" : ""}
          aria-label="Include ${escapeHtml(item.title)} in roll"
        />
        <div class="activity-title-group">
          <span class="activity-title" title="Click to toggle">${escapeHtml(item.title)}</span>
        </div>
      </div>
      <div class="activity-right">
        <span class="prob-label" title="Probability of being picked in next roll">
          ${item.checked ? `${probPct}%` : "—"}
        </span>
        <button
          type="button"
          class="weight-badge"
          data-weight="${weight}"
          title="Priority weight (${weight}x). Click to cycle 1x → 2x → 4x"
        >
          ${weight}x
        </button>
        <button
          type="button"
          class="btn-icon log-direct-btn ${doneToday ? "is-done" : ""}"
          title="${doneToday ? `Completed today — click to log '${escapeHtml(item.title)}' again` : `Mark '${escapeHtml(item.title)}' as completed today`}"
        >
          ✓
        </button>
        <button
          type="button"
          class="btn-icon edit-item-btn"
          title="Rename activity"
        >
          ${ICON_EDIT_SVG}
        </button>
        <button
          type="button"
          class="btn-icon danger delete-item-btn"
          title="Delete activity"
        >
          ${ICON_TRASH_SVG}
        </button>
      </div>
    `;

    frag.appendChild(li);
  });

  listEl.replaceChildren(frag);
}

// Render Daily Tasks Card (Right Column)
function renderDailyTasks() {
  const cardEl = document.getElementById("daily-tasks-card");
  const progressBadgeEl = document.getElementById("daily-tasks-progress-badge");
  const listEl = document.getElementById("daily-tasks-list");
  listEl.classList.toggle("is-editing", isEditingDailyTasks);
  listEl.innerHTML = "";

  syncEditModeButton("btn-edit-daily", "btn-edit-daily-label", isEditingDailyTasks);

  const total = state.dailyTasks.length;
  const doneCount = state.dailyTasks.filter((t) => t.doneToday).length;
  const allDone = total > 0 && doneCount === total;
  const todayStr = getLogicalTodayStr();
  const hasActivityToday = state.logs.some((l) => l.date === todayStr);
  const scheduledDoneToday = areAllScheduledTasksDoneForDate(todayStr);
  const hasGoldStarToday = allDone && hasActivityToday && scheduledDoneToday;
  const hasSilverStarToday = allDone && !hasGoldStarToday;

  cardEl.classList.toggle("all-done", hasGoldStarToday);
  cardEl.classList.toggle("silver-done", hasSilverStarToday);
  progressBadgeEl.textContent = hasGoldStarToday
    ? `★ ${doneCount}/${total} done`
    : hasSilverStarToday
      ? `★ ${doneCount}/${total} done`
      : `${doneCount}/${total} done`;
  progressBadgeEl.classList.toggle("badge-star", hasGoldStarToday);
  progressBadgeEl.classList.toggle("badge-star-silver", hasSilverStarToday);
  progressBadgeEl.classList.remove("badge-success");

  if (total === 0) {
    listEl.innerHTML = `<li class="empty-state">Add your daily habits above to start earning ⭐ Star Badges!</li>`;
    return;
  }

  const frag = document.createDocumentFragment();

  state.dailyTasks.forEach((task) => {
    const li = document.createElement("li");
    li.draggable = isEditingDailyTasks;
    li.dataset.dailyId = task.id;
    li.className = `daily-task-item ${task.doneToday ? "done" : ""}`;

    li.innerHTML = `
      <div class="daily-task-left">
        <span class="drag-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
        <div class="activity-title-group">
          <span class="daily-task-title" title="Click to toggle">${escapeHtml(task.title)}</span>
        </div>
      </div>
      <div class="daily-task-actions">
        <button
          type="button"
          class="btn-icon log-daily-btn ${task.doneToday ? "is-done" : ""}"
          title="${task.doneToday ? `Unmark '${escapeHtml(task.title)}' as done today` : `Mark '${escapeHtml(task.title)}' as completed today`}"
          aria-pressed="${task.doneToday ? "true" : "false"}"
        >
          ✓
        </button>
        <button type="button" class="btn-icon edit-daily-btn" title="Rename daily task">${ICON_EDIT_SVG}</button>
        <button type="button" class="btn-icon danger delete-daily-btn" title="Delete daily task">${ICON_TRASH_SVG}</button>
      </div>
    `;

    frag.appendChild(li);
  });

  listEl.replaceChildren(frag);
}

function formatScheduledTaskMeta(task, todayStr) {
  if (task.type === "repeat") {
    const rule = task.repeatRule || {};
    if (rule.freq === "monthly") {
      const dayNum = Math.min(Math.max(1, Number(rule.monthDay) || 1), 31);
      const suffix =
        dayNum % 10 === 1 && dayNum !== 11
          ? "st"
          : dayNum % 10 === 2 && dayNum !== 12
            ? "nd"
            : dayNum % 10 === 3 && dayNum !== 13
              ? "rd"
              : "th";
      return { label: `Monthly · ${dayNum}${suffix}`, isRepeat: true, isOverdue: false };
    }
    const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const days = Array.isArray(rule.weekdays) ? [...rule.weekdays].sort((a, b) => a - b) : [];
    const label =
      days.length === 7
        ? "Every day"
        : days.length > 0
          ? days.map((d) => shortDays[d]).filter(Boolean).join(", ")
          : "Weekly";
    return { label, isRepeat: true, isOverdue: false };
  }

  if (!task.dueDate || task.dueDate === todayStr) {
    return { label: "Today", isRepeat: false, isOverdue: false };
  }

  const overdue = isScheduledTaskOverdue(task, todayStr);
  const d = parseLocalDateStr(task.dueDate);
  const dateLabel = `${SHORT_MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  if (overdue) {
    return { label: `Overdue · ${dateLabel}`, isRepeat: false, isOverdue: true };
  }
  return { label: dateLabel, isRepeat: false, isOverdue: false };
}

function renderScheduledTasks() {
  const cardEl = document.getElementById("scheduled-tasks-card");
  const progressBadgeEl = document.getElementById("scheduled-tasks-progress-badge");
  const listEl = document.getElementById("scheduled-tasks-list");
  if (!cardEl || !progressBadgeEl || !listEl) return;

  listEl.classList.toggle("is-editing", isEditingScheduledTasks);
  listEl.innerHTML = "";

  syncEditModeButton("btn-edit-scheduled", "btn-edit-scheduled-label", isEditingScheduledTasks);

  const todayBtn = document.getElementById("btn-sched-view-today");
  const upcomingBtn = document.getElementById("btn-sched-view-upcoming");
  if (todayBtn) {
    todayBtn.classList.toggle("active", scheduledViewMode === "today");
    todayBtn.setAttribute("aria-selected", scheduledViewMode === "today" ? "true" : "false");
  }
  if (upcomingBtn) {
    upcomingBtn.classList.toggle("active", scheduledViewMode === "upcoming");
    upcomingBtn.setAttribute("aria-selected", scheduledViewMode === "upcoming" ? "true" : "false");
  }

  const todayStr = getLogicalTodayStr();
  const tasks = Array.isArray(state.scheduledTasks) ? state.scheduledTasks : [];
  const dueTodayTasks = tasks.filter((t) => isTaskDueOnDate(t, todayStr));
  const doneTodayCount = dueTodayTasks.filter((t) => isScheduledTaskDoneOnDate(t, todayStr)).length;
  const allDueDone = dueTodayTasks.length > 0 && doneTodayCount === dueTodayTasks.length;

  cardEl.classList.toggle("all-done", allDueDone);
  progressBadgeEl.textContent =
    dueTodayTasks.length === 0
      ? "0 due today"
      : `${doneTodayCount}/${dueTodayTasks.length} done`;
  progressBadgeEl.classList.toggle("badge-star", allDueDone);
  progressBadgeEl.classList.toggle("badge-success", false);

  const visibleTasks =
    scheduledViewMode === "upcoming"
      ? tasks
          .filter((t) => getScheduledTaskTargetDate(t, todayStr) > todayStr)
          .sort((a, b) => {
            const da = getScheduledTaskTargetDate(a, todayStr);
            const db = getScheduledTaskTargetDate(b, todayStr);
            return da < db ? -1 : da > db ? 1 : 0;
          })
      : tasks.filter((t) => isTaskDueOnDate(t, todayStr) || isScheduledTaskOverdue(t, todayStr));

  if (visibleTasks.length === 0) {
    const emptyMsg =
      scheduledViewMode === "upcoming"
        ? "No upcoming tasks scheduled. Click + Add Task to create one!"
        : "Nothing scheduled for today. Click + Add Task or check Upcoming!";
    listEl.innerHTML = `<li class="empty-state">${emptyMsg}</li>`;
    return;
  }

  const frag = document.createDocumentFragment();

  visibleTasks.forEach((task) => {
    const targetDate = getScheduledTaskTargetDate(task, todayStr);
    const isAhead = targetDate > todayStr;
    const isDoneForTarget = isScheduledTaskDoneOnDate(task, targetDate);
    const meta = formatScheduledTaskMeta(task, todayStr);

    const targetDateObj = parseLocalDateStr(targetDate);
    const targetDateLabel = `${SHORT_MONTH_NAMES[targetDateObj.getMonth()]} ${targetDateObj.getDate()}`;

    const li = document.createElement("li");
    li.draggable = isEditingScheduledTasks;
    li.dataset.schedId = task.id;
    li.className = [
      "scheduled-task-item",
      isDoneForTarget ? "done" : "",
      meta.isOverdue ? "is-overdue" : ""
    ]
      .filter(Boolean)
      .join(" ");

    const showMetaPill = !(scheduledViewMode === "today" && meta.label === "Today");

    li.innerHTML = `
      <div class="daily-task-left">
        <span class="drag-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
        <div class="scheduled-task-content">
          <div class="activity-title-group">
            <span class="daily-task-title" title="Click to toggle">${escapeHtml(task.title)}</span>
          </div>
          ${showMetaPill ? `
          <div class="scheduled-task-meta-row">
            <span class="sched-meta-pill ${meta.isRepeat ? "is-repeat" : ""} ${meta.isOverdue ? "is-overdue" : ""}">${escapeHtml(meta.label)}</span>
          </div>` : ""}
        </div>
      </div>
      <div class="daily-task-actions">
        <button
          type="button"
          class="btn-icon log-sched-btn ${isDoneForTarget ? "is-done" : ""}"
          title="${isDoneForTarget ? `Unmark '${escapeHtml(task.title)}'` : isAhead ? `Mark '${escapeHtml(task.title)}' complete ahead for ${targetDateLabel}` : `Mark '${escapeHtml(task.title)}' as completed today`}"
          aria-pressed="${isDoneForTarget ? "true" : "false"}"
        >✓</button>
        <button type="button" class="btn-icon edit-sched-btn" title="Edit scheduled task">${ICON_EDIT_SVG}</button>
        <button type="button" class="btn-icon danger delete-sched-btn" title="Delete scheduled task">${ICON_TRASH_SVG}</button>
      </div>
    `;

    frag.appendChild(li);
  });

  listEl.replaceChildren(frag);
}

function setScheduledModalType(type) {
  const isRepeat = type === "repeat";
  document.querySelectorAll("#sched-type-group .weight-pill-btn").forEach((btn) => {
    const selected = btn.dataset.schedType === type;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-checked", selected ? "true" : "false");
  });
  const onceOpts = document.getElementById("sched-once-options");
  const repeatOpts = document.getElementById("sched-repeat-options");
  const dateInput = document.getElementById("input-scheduled-date");
  if (onceOpts) onceOpts.classList.toggle("hidden", isRepeat);
  if (repeatOpts) repeatOpts.classList.toggle("hidden", !isRepeat);
  if (dateInput) dateInput.required = !isRepeat;
}

function setScheduledModalFreq(freq) {
  const isMonthly = freq === "monthly";
  document.querySelectorAll("#sched-freq-group .weight-pill-btn").forEach((btn) => {
    const selected = btn.dataset.schedFreq === freq;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-checked", selected ? "true" : "false");
  });
  const weeklyEl = document.getElementById("sched-weekly-picker");
  const monthlyEl = document.getElementById("sched-monthly-picker");
  if (weeklyEl) weeklyEl.classList.toggle("hidden", isMonthly);
  if (monthlyEl) monthlyEl.classList.toggle("hidden", !isMonthly);
}

function openScheduledTaskModal(existingTask = null) {
  const modal = document.getElementById("modal-scheduled-task");
  const titleHeading = document.getElementById("modal-scheduled-title");
  const titleInput = document.getElementById("input-scheduled-title");
  const dateInput = document.getElementById("input-scheduled-date");
  const monthdayInput = document.getElementById("input-scheduled-monthday");
  const addAnotherBtn = document.getElementById("btn-sched-modal-add-another");
  const saveBtn = document.getElementById("btn-sched-modal-save");
  if (!modal) return;

  const todayStr = getLogicalTodayStr();
  const todayObj = getLogicalTodayDate();
  const todayWeekday = (todayObj.getDay() + 6) % 7;

  editingScheduledTaskId = existingTask ? existingTask.id : null;
  if (titleHeading) titleHeading.textContent = existingTask ? "Edit Scheduled Task" : "Add Scheduled Task";
  if (addAnotherBtn) addAnotherBtn.classList.toggle("hidden", Boolean(existingTask));
  if (saveBtn) saveBtn.textContent = existingTask ? "Save Changes" : "Add Task";
  if (titleInput) titleInput.value = existingTask ? existingTask.title : "";

  const type = existingTask ? existingTask.type : "once";
  setScheduledModalType(type);

  if (dateInput) {
    dateInput.value = (existingTask && existingTask.dueDate) || todayStr;
  }

  const rule = (existingTask && existingTask.repeatRule) || {};
  const freq = rule.freq || "weekly";
  setScheduledModalFreq(freq);

  const selectedWeekdays = new Set(
    Array.isArray(rule.weekdays) && rule.weekdays.length > 0 ? rule.weekdays : [todayWeekday]
  );
  document.querySelectorAll("#sched-weekday-pills .weekday-pill-btn").forEach((btn) => {
    const dayIdx = Number(btn.dataset.weekday);
    const active = selectedWeekdays.has(dayIdx);
    btn.classList.toggle("is-selected", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (monthdayInput) {
    monthdayInput.value = String(rule.monthDay || todayObj.getDate());
  }

  modal.classList.remove("hidden");
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function closeScheduledTaskModal() {
  editingScheduledTaskId = null;
  const modal = document.getElementById("modal-scheduled-task");
  if (modal) modal.classList.add("hidden");
}

function renderProcrastinationList() {
  const cardEl = document.getElementById("procrastination-card");
  const badgeEl = document.getElementById("procrastination-count-badge");
  const listEl = document.getElementById("procrastination-list");
  if (!cardEl || !badgeEl || !listEl) return;

  listEl.classList.toggle("is-editing", isEditingProcrastination);
  listEl.innerHTML = "";

  syncEditModeButton("btn-edit-procrastination", "btn-edit-procrastination-label", isEditingProcrastination);

  const tasks = Array.isArray(state.procrastinationTasks) ? state.procrastinationTasks : [];
  const pendingCount = tasks.filter((t) => !t.doneToday).length;
  badgeEl.textContent = tasks.length === 0 ? "0 pending" : `${pendingCount} pending`;

  if (tasks.length === 0) {
    listEl.innerHTML = `<li class="empty-state">Add one-time tasks you've been putting off — complete them to celebrate and clear them tomorrow!</li>`;
    return;
  }

  const frag = document.createDocumentFragment();

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.draggable = isEditingProcrastination;
    li.dataset.procrastId = task.id;
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const doneSubCount = subtasks.filter((s) => s.done).length;
    li.className = `procrastination-item ${task.doneToday ? "done" : ""} ${subtasks.length > 0 ? "has-subtasks" : ""}`;

    const subtaskProgressHtml =
      subtasks.length > 0
        ? `<span class="procrast-subtask-progress" title="${doneSubCount} of ${subtasks.length} subtasks done">${doneSubCount}/${subtasks.length}</span>`
        : "";

    const subtasksHtml =
      subtasks.length > 0
        ? `<ul class="procrastination-subtasks">
            ${subtasks
              .map(
                (sub) => `
              <li class="procrastination-subtask-item ${sub.done ? "done" : ""}" data-subtask-id="${escapeHtml(sub.id)}">
                <div class="procrastination-subtask-left">
                  <button
                    type="button"
                    class="btn-icon toggle-procrast-subtask-btn ${sub.done ? "is-done" : ""}"
                    title="${sub.done ? `Unmark '${escapeHtml(sub.title)}'` : `Complete '${escapeHtml(sub.title)}'`}"
                    aria-pressed="${sub.done ? "true" : "false"}"
                  >✓</button>
                  <span class="procrastination-subtask-title" title="Click to toggle">${escapeHtml(sub.title)}</span>
                </div>
                <div class="procrastination-subtask-actions">
                  <button type="button" class="btn-icon edit-procrast-subtask-btn" title="Rename subtask">${ICON_EDIT_SVG}</button>
                  <button type="button" class="btn-icon danger delete-procrast-subtask-btn" title="Delete subtask">${ICON_TRASH_SVG}</button>
                </div>
              </li>
            `
              )
              .join("")}
          </ul>`
        : "";

    li.innerHTML = `
      <div class="procrastination-main-row">
        <div class="daily-task-left">
          <span class="drag-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
          <div class="activity-title-group">
            <span class="daily-task-title" title="Click to toggle">${escapeHtml(task.title)}</span>
            ${subtaskProgressHtml}
          </div>
        </div>
        <div class="daily-task-actions">
          <button
            type="button"
            class="btn btn-outline btn-xs add-procrast-subtask-btn"
            title="Add subtask"
            aria-label="Add subtask to ${escapeHtml(task.title)}"
          >+ Subtask</button>
          <button
            type="button"
            class="btn-icon log-procrast-btn ${task.doneToday ? "is-done" : ""}"
            title="${task.doneToday ? `Unmark '${escapeHtml(task.title)}'` : `Complete '${escapeHtml(task.title)}'`}"
            aria-pressed="${task.doneToday ? "true" : "false"}"
          >✓</button>
          <button type="button" class="btn-icon edit-procrast-btn" title="Rename task">${ICON_EDIT_SVG}</button>
          <button type="button" class="btn-icon danger delete-procrast-btn" title="Delete task">${ICON_TRASH_SVG}</button>
        </div>
      </div>
      ${subtasksHtml}
    `;

    frag.appendChild(li);
  });

  listEl.replaceChildren(frag);
}

// Weighted Random Pick Engine
function pickWeightedItem(candidates) {
  const totalWeight = candidates.reduce((sum, item) => sum + normalizeWeight(item.weight), 0);
  let randomVal = Math.random() * totalWeight;
  for (const item of candidates) {
    randomVal -= normalizeWeight(item.weight);
    if (randomVal <= 0) {
      return { item, totalWeight };
    }
  }
  return { item: candidates[candidates.length - 1], totalWeight };
}

/**
 * Builds a dynamic deceleration delay schedule whose total matches ROLL_DURATION_MS.
 * Keeps individual ticks snappy regardless of duration and finishes with a brief lock-in hold.
 */
function getRollDelaysMs() {
  const totalMs = Math.max(150, ROLL_DURATION_MS);
  const lockHoldMs = Math.min(240, Math.max(80, Math.round(totalMs * 0.1)));
  const spinBudgetMs = totalMs - lockHoldMs;

  const MIN_TICK_MS = 55;
  const MAX_TICK_MS = 250;
  const DECEL_EXPONENT = 2.4;
  const spinTicks = Math.max(3, Math.round(spinBudgetMs / 112));

  const rawWeights = [];
  for (let i = 0; i < spinTicks; i++) {
    const t = i / (spinTicks - 1);
    rawWeights.push(MIN_TICK_MS + (MAX_TICK_MS - MIN_TICK_MS) * Math.pow(t, DECEL_EXPONENT));
  }

  const rawSum = rawWeights.reduce((sum, w) => sum + w, 0);
  const scale = spinBudgetMs / rawSum;
  const delays = rawWeights.map((w) => Math.round(w * scale));

  const roundedSum = delays.reduce((sum, d) => sum + d, 0);
  delays[delays.length - 1] += spinBudgetMs - roundedSum;
  delays.push(lockHoldMs);

  return delays;
}

function clearSweepingHighlight() {
  document
    .querySelectorAll("#hero-candidate-pills .hero-candidate-chip.is-sweeping")
    .forEach((el) => el.classList.remove("is-sweeping"));
}

function applySweepingHighlight(itemId) {
  clearSweepingHighlight();
  const escapedId = CSS.escape(itemId);
  const heroChip = document.querySelector(
    `#hero-candidate-pills .hero-candidate-chip[data-item-id="${escapedId}"]`
  );
  if (heroChip) {
    heroChip.classList.add("is-sweeping");
  }
}

function buildRollTickSequence(pool, chosen, totalTicks) {
  const sequence = new Array(totalTicks);
  sequence[totalTicks - 1] = chosen;
  let nextItem = chosen;
  for (let i = totalTicks - 2; i >= 0; i--) {
    const filtered = pool.filter((item) => item.id !== nextItem.id);
    const pickFrom = filtered.length > 0 ? filtered : pool;
    const picked = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    sequence[i] = picked;
    nextItem = picked;
  }
  return sequence;
}

function clearCompletingDecisionHold() {
  if (completingDecisionTimers.length > 0) {
    completingDecisionTimers.forEach((t) => clearTimeout(t));
    completingDecisionTimers = [];
  }
  completingDecisionSnapshot = null;
}

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Pulses the Hero Decision Card with the chosen list's color when a winner is locked in.
 */
function triggerWinnerAura(listColor) {
  if (prefersReducedMotion()) return;
  const cardEl = document.getElementById("decision-card");
  if (!cardEl) return;

  if (winnerAuraTimer) {
    clearTimeout(winnerAuraTimer);
    winnerAuraTimer = null;
  }

  if (listColor) {
    cardEl.style.setProperty("--hero-list-color", listColor);
  }
  cardEl.classList.remove("winner-aura-pulse");
  void cardEl.offsetWidth;
  cardEl.classList.add("winner-aura-pulse");

  winnerAuraTimer = setTimeout(() => {
    cardEl.classList.remove("winner-aura-pulse");
    winnerAuraTimer = null;
  }, 1650);
}

/**
 * Spawns a lightweight DOM confetti / particle burst from the given trigger element.
 */
function spawnConfettiBurst(originEl, listColor) {
  if (prefersReducedMotion()) return;

  const targetEl = originEl || document.getElementById("btn-complete-chosen") || document.getElementById("decision-card");
  let cx = window.innerWidth / 2;
  let cy = window.innerHeight / 3;
  if (targetEl && typeof targetEl.getBoundingClientRect === "function") {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }
  }

  const astro = isAstrologyTheme();
  const tarot = isTarotTheme();
  const win95 = isWin95Theme();
  const colors = astro
    ? [
        "#f5c451", // Celestial gold
        "#c084fc", // Nebula violet
        "#e879f9", // Astral magenta
        "#67e8f9", // Starlight cyan
        "#fde047", // Sunburst yellow
        listColor || PALETTE[0]
      ]
    : tarot
      ? [
          "#d4a24c", // Antique tarot gold
          "#e11d48", // Velvet crimson
          "#f9f1e6", // Parchment ivory
          "#b8862d", // Burnished bronze
          "#1a8f6a", // Deep emerald
          listColor || PALETTE[0]
        ]
      : win95
        ? [
            "#000080", // Win95 Navy
            "#008080", // Win95 Teal
            "#ff0000", // VGA Red
            "#ffff00", // VGA Yellow
            "#00ff00", // VGA Lime
            listColor || PALETTE[0]
          ]
        : [
          listColor || PALETTE[0],
          "#10b981", // --success
          "#eab308", // --star-gold
          "#6366f1", // --accent-primary
          "#38bdf8", // --freeze-cyan
          "#f43f5e"
        ];

  const layer = document.createElement("div");
  layer.className = "confetti-burst-layer";
  layer.setAttribute("aria-hidden", "true");

  const particleCount = 24;
  for (let i = 0; i < particleCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";

    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.35;
    const distance = 48 + Math.random() * 78;
    const dx = Math.round(Math.cos(angle) * distance);
    const dy = Math.round(Math.sin(angle) * distance - 18);
    const rot = Math.round((Math.random() - 0.5) * 520);
    const isCircle = i % 3 === 0;
    const isStarGlyph = (astro || tarot) && i % 2 === 0;
    const w = isCircle ? 7 : 6 + Math.round(Math.random() * 5);
    const h = isCircle ? 7 : 4 + Math.round(Math.random() * 4);
    const dur = 1050 + Math.round(Math.random() * 400);
    const delay = Math.round(Math.random() * 90);
    const color = colors[i % colors.length];

    if (isStarGlyph) {
      piece.classList.add("is-star-glyph");
      if (tarot) {
        const tarotGlyphs = ["♦", "♠", "✦"];
        piece.textContent = tarotGlyphs[(i / 2) % tarotGlyphs.length];
      } else {
        piece.textContent = i % 4 === 0 ? "✦" : "★";
      }
      piece.style.setProperty("--glyph-size", `${11 + (i % 5)}px`);
    }

    piece.style.setProperty("--x", `${cx}px`);
    piece.style.setProperty("--y", `${cy}px`);
    piece.style.setProperty("--dx", `${dx}px`);
    piece.style.setProperty("--dy", `${dy}px`);
    piece.style.setProperty("--rot", `${rot}deg`);
    piece.style.setProperty("--w", `${w}px`);
    piece.style.setProperty("--h", `${h}px`);
    piece.style.setProperty("--r", isCircle ? "50%" : "2px");
    piece.style.setProperty("--c", color);
    piece.style.setProperty("--dur", `${dur}ms`);
    piece.style.setProperty("--delay", `${delay}ms`);

    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  setTimeout(() => {
    layer.remove();
  }, 1600);
}

function triggerBigProcrastinationCelebration(originEl) {
  if (prefersReducedMotion()) return;

  const procrastCard = document.getElementById("procrastination-card");
  const decisionCard = document.getElementById("decision-card");
  [procrastCard, decisionCard].forEach((el) => {
    if (!el) return;
    el.classList.remove("is-big-celebration");
    void el.offsetWidth;
    el.classList.add("is-big-celebration");
    setTimeout(() => el.classList.remove("is-big-celebration"), 1250);
  });

  // Multi-wave high-count confetti bursts across origin & center screen
  const waveOffsets = [
    { delay: 0, count: 52, spread: 190, el: originEl },
    { delay: 160, count: 44, spread: 230, el: procrastCard || originEl },
    { delay: 320, count: 40, spread: 210, el: decisionCard || originEl }
  ];

  const colors = [
    PROCRASTINATION_LIST_COLOR,
    "#eab308",
    "#10b981",
    "#6366f1",
    "#ec4899",
    "#38bdf8"
  ];

  waveOffsets.forEach(({ delay, count, spread, el }) => {
    setTimeout(() => {
      let cx = window.innerWidth / 2;
      let cy = window.innerHeight / 2.4;
      if (el && typeof el.getBoundingClientRect === "function") {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          cx = rect.left + rect.width / 2;
          cy = rect.top + rect.height / 2;
        }
      }

      const layer = document.createElement("div");
      layer.className = "confetti-burst-layer";
      layer.setAttribute("aria-hidden", "true");

      for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
        const distance = 70 + Math.random() * spread;
        const dx = Math.round(Math.cos(angle) * distance);
        const dy = Math.round(Math.sin(angle) * distance - 30);
        const rot = Math.round((Math.random() - 0.5) * 760);
        const isCircle = i % 3 === 0;
        const w = isCircle ? 9 : 8 + Math.round(Math.random() * 6);
        const h = isCircle ? 9 : 5 + Math.round(Math.random() * 5);
        const dur = 1250 + Math.round(Math.random() * 500);
        const pDelay = Math.round(Math.random() * 100);

        piece.style.setProperty("--x", `${cx}px`);
        piece.style.setProperty("--y", `${cy}px`);
        piece.style.setProperty("--dx", `${dx}px`);
        piece.style.setProperty("--dy", `${dy}px`);
        piece.style.setProperty("--rot", `${rot}deg`);
        piece.style.setProperty("--w", `${w}px`);
        piece.style.setProperty("--h", `${h}px`);
        piece.style.setProperty("--r", isCircle ? "50%" : "2px");
        piece.style.setProperty("--c", colors[i % colors.length]);
        piece.style.setProperty("--dur", `${dur}ms`);
        piece.style.setProperty("--delay", `${pDelay}ms`);
        layer.appendChild(piece);
      }

      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 1900);
    }, delay);
  });
}

let lotteryJackpotTimer = null;

/**
 * Big lottery-style celebration when the hidden 1% procrastination draw hits.
 */
function triggerLotteryJackpotCelebration() {
  if (prefersReducedMotion()) return;

  const decisionCard = document.getElementById("decision-card");
  if (decisionCard) {
    if (lotteryJackpotTimer) {
      clearTimeout(lotteryJackpotTimer);
      lotteryJackpotTimer = null;
    }
    decisionCard.classList.remove("is-lottery-jackpot");
    void decisionCard.offsetWidth;
    decisionCard.classList.add("is-lottery-jackpot");
    lotteryJackpotTimer = setTimeout(() => {
      decisionCard.classList.remove("is-lottery-jackpot");
      lotteryJackpotTimer = null;
    }, 2600);
  }

  const astro = isAstrologyTheme();
  const tarot = isTarotTheme();
  const win95 = isWin95Theme();

  const colors = astro
    ? ["#f5c451", "#c084fc", "#e879f9", "#67e8f9", "#fde047", PROCRASTINATION_LIST_COLOR]
    : tarot
      ? ["#d4a24c", "#e11d48", "#f9f1e6", "#b8862d", "#fde047", PROCRASTINATION_LIST_COLOR]
      : win95
        ? ["#ffff00", "#00ff00", "#ff0000", "#000080", "#008080", PROCRASTINATION_LIST_COLOR]
        : ["#f5c451", "#fde047", PROCRASTINATION_LIST_COLOR, "#ec4899", "#10b981", "#38bdf8"];

  const glyphs = astro
    ? ["🔮", "✨", "★", "✦", "🌠"]
    : tarot
      ? ["🃏", "✦", "♦", "♠", "✨"]
      : win95
        ? ["🎰", "💾", "★", "🏆", "✨"]
        : ["🎰", "🪙", "✨", "★", "🎉"];

  const waves = [
    { delay: 0, count: 64, spread: 240, xRatio: 0.5, yRatio: 0.35, useCard: true },
    { delay: 140, count: 48, spread: 260, xRatio: 0.25, yRatio: 0.38, useCard: false },
    { delay: 280, count: 48, spread: 260, xRatio: 0.75, yRatio: 0.38, useCard: false },
    { delay: 460, count: 56, spread: 300, xRatio: 0.5, yRatio: 0.32, useCard: true }
  ];

  waves.forEach(({ delay, count, spread, xRatio, yRatio, useCard }) => {
    setTimeout(() => {
      let cx = window.innerWidth * xRatio;
      let cy = window.innerHeight * yRatio;
      if (useCard && decisionCard && typeof decisionCard.getBoundingClientRect === "function") {
        const rect = decisionCard.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          cx = rect.left + rect.width / 2;
          cy = rect.top + rect.height / 2;
        }
      }

      const layer = document.createElement("div");
      layer.className = "confetti-burst-layer";
      layer.setAttribute("aria-hidden", "true");

      for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const distance = 85 + Math.random() * spread;
        const dx = Math.round(Math.cos(angle) * distance);
        const dy = Math.round(Math.sin(angle) * distance - 40);
        const rot = Math.round((Math.random() - 0.5) * 900);
        const isCircle = i % 4 === 0;
        const isGlyph = i % 3 === 0;
        const w = isCircle ? 9 : 8 + Math.round(Math.random() * 7);
        const h = isCircle ? 9 : 5 + Math.round(Math.random() * 6);
        const dur = 1450 + Math.round(Math.random() * 600);
        const pDelay = Math.round(Math.random() * 120);

        if (isGlyph) {
          piece.classList.add("is-star-glyph");
          piece.textContent = glyphs[(i / 3) % glyphs.length];
          piece.style.setProperty("--glyph-size", `${13 + (i % 6)}px`);
        }

        piece.style.setProperty("--x", `${cx}px`);
        piece.style.setProperty("--y", `${cy}px`);
        piece.style.setProperty("--dx", `${dx}px`);
        piece.style.setProperty("--dy", `${dy}px`);
        piece.style.setProperty("--rot", `${rot}deg`);
        piece.style.setProperty("--w", `${w}px`);
        piece.style.setProperty("--h", `${h}px`);
        piece.style.setProperty("--r", isCircle ? "50%" : "2px");
        piece.style.setProperty("--c", colors[i % colors.length]);
        piece.style.setProperty("--dur", `${dur}ms`);
        piece.style.setProperty("--delay", `${pDelay}ms`);
        layer.appendChild(piece);
      }

      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 2200);
    }, delay);
  });
}

/**
 * Snapshot current header stats so we can pop whichever pills increased.
 */
function getStatsSnapshot() {
  const { currentStreak, availableFreezes } = computeStreakAndFreezes();
  const todayStr = getLogicalTodayStr();
  const sevenDaysAgo = getLogicalTodayDate();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = toLocalDateStr(sevenDaysAgo);
  const weekCount = state.logs.filter((l) => l.date >= sevenDaysAgoStr && l.date <= todayStr).length;

  const viewedMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const monthCount = state.logs.filter((l) => l.date.startsWith(viewedMonthPrefix)).length;

  return { currentStreak, availableFreezes, weekCount, monthCount };
}

function triggerStatPillBump(valueElId, bumpClass) {
  if (prefersReducedMotion()) return;
  const el = document.getElementById(valueElId);
  if (!el) return;
  const pillEl = el.closest(".stat-pill") || el;
  pillEl.classList.remove("stat-bump-success", "stat-bump-streak", "stat-bump-freeze");
  void pillEl.offsetWidth;
  pillEl.classList.add(bumpClass);
  setTimeout(() => {
    pillEl.classList.remove(bumpClass);
  }, 1300);
}

function animateStatBumps(prevStats) {
  if (!prevStats || prefersReducedMotion()) return;
  const nextStats = getStatsSnapshot();

  if (nextStats.currentStreak > prevStats.currentStreak) {
    triggerStatPillBump("stat-current-streak", "stat-bump-streak");
  }
  if (nextStats.availableFreezes > prevStats.availableFreezes) {
    triggerStatPillBump("stat-pill-freezes", "stat-bump-freeze");
  }
  if (nextStats.weekCount > prevStats.weekCount) {
    triggerStatPillBump("stat-week-count", "stat-bump-success");
  }
  if (nextStats.monthCount > prevStats.monthCount) {
    triggerStatPillBump("stat-month-count", "stat-bump-success");
  }
}

function triggerDecisionRoll(isReroll = false) {
  if (isRolling) return;
  clearCompletingDecisionHold();
  checkAndPerformDailyReset(false);

  const activeList = getActiveHeroPool();
  const checkedPool = activeList.items.filter((i) => i.checked);
  let candidates = checkedPool;

  if (candidates.length === 0) {
    showToast("Please check at least one activity first!");
    return;
  }

  const todayStr = getLogicalTodayStr();
  let nextRerollCount = 0;

  if (isReroll) {
    state.rerollsByDate[todayStr] = (Number(state.rerollsByDate[todayStr]) || 0) + 1;
    nextRerollCount = (state.activeDecision ? Number(state.activeDecision.rerolls) || 0 : 0) + 1;
  }

  const allCheckedCount = candidates.length;
  const totalWeightAllChecked = candidates.reduce((s, i) => s + normalizeWeight(i.weight), 0);

  if (isReroll && state.activeDecision && candidates.length > 1) {
    candidates = candidates.filter((i) => i.id !== state.activeDecision.itemId);
  }

  const availableProcrastinationTasks = (state.procrastinationTasks || []).filter(
    (t) => !t.doneToday
  );
  const hitHiddenProcrastination =
    !activeList.isProcrastination &&
    availableProcrastinationTasks.length > 0 &&
    Math.random() < 0.01;

  let chosen;
  let decisionPayload;
  let chosenListColor;

  if (hitHiddenProcrastination) {
    const rawProcrastTask =
      availableProcrastinationTasks[
        Math.floor(Math.random() * availableProcrastinationTasks.length)
      ];
    const target = getNextProcrastinationTarget(rawProcrastTask);
    chosen = {
      id: rawProcrastTask.id,
      title: target.title
    };
    chosenListColor = PROCRASTINATION_LIST_COLOR;
    decisionPayload = {
      itemId: rawProcrastTask.id,
      subtaskId: target.subtaskId,
      parentTitle: target.parentTitle,
      subtaskIndex: target.subtaskIndex,
      subtaskTotal: target.subtaskTotal,
      listId: PROCRASTINATION_LIST_ID,
      listName: "Procrastination List",
      title: target.title,
      color: chosenListColor,
      weight: 1,
      probabilityPct: 1,
      candidateCount: allCheckedCount,
      rerolls: nextRerollCount,
      isProcrastinationJackpot: true
    };
  } else {
    const picked = pickWeightedItem(candidates);
    chosen = picked.item;
    const chosenWeight = normalizeWeight(chosen.weight);
    const probabilityPct = Math.round((chosenWeight / totalWeightAllChecked) * 100);
    const chosenListId = chosen.listId || activeList.id;
    const chosenListName = chosen.listName || activeList.name;
    chosenListColor = chosen.listColor || activeList.color || PALETTE[0];
    decisionPayload = {
      itemId: chosen.id,
      subtaskId: chosen.subtaskId || null,
      parentTitle: chosen.parentTitle || null,
      subtaskIndex: chosen.subtaskIndex || 0,
      subtaskTotal: chosen.subtaskTotal || 0,
      listId: chosenListId,
      listName: chosenListName,
      title: chosen.title,
      color: chosenListColor,
      weight: chosenWeight,
      probabilityPct,
      candidateCount: allCheckedCount,
      rerolls: nextRerollCount,
      isProcrastinationJackpot: false
    };
  }

  const heroPoolMode = activeList.isProcrastination
    ? "procrastination"
    : activeList.isMultiList
      ? "multi_list"
      : "single_list";

  if (allCheckedCount === 1 && !hitHiddenProcrastination) {
    state.activeDecision = decisionPayload;
    saveState();
    trackAnalyticsEvent("decide_spin", {
      is_reroll: nextRerollCount > 0,
      candidate_count: allCheckedCount,
      pool_mode: heroPoolMode
    });
    renderAll();
    triggerWinnerAura(chosenListColor);
    return;
  }

  // Animate Decelerating Slot Reel + Synchronized List Highlight Sweep
  isRolling = true;
  renderDecisionCard();

  const slotText = document.getElementById("rolling-slot-text");
  const rollDelays = getRollDelaysMs();
  const tickSequence = buildRollTickSequence(checkedPool, chosen, rollDelays.length);

  const runTick = (stepIndex) => {
    const tickItem = tickSequence[stepIndex];
    slotText.textContent = tickItem.title;
    slotText.classList.remove("slot-locked", "slot-tick");
    void slotText.offsetWidth;
    slotText.classList.add("slot-tick");

    applySweepingHighlight(tickItem.id);

    if (stepIndex >= rollDelays.length - 1) {
      slotText.classList.add("slot-locked");

      setTimeout(() => {
        clearSweepingHighlight();
        slotText.classList.remove("slot-locked", "slot-tick");
        isRolling = false;
        state.activeDecision = decisionPayload;
        saveState();
        trackAnalyticsEvent("decide_spin", {
          is_reroll: nextRerollCount > 0,
          candidate_count: allCheckedCount,
          pool_mode: heroPoolMode,
          procrastination_jackpot: hitHiddenProcrastination
        });
        renderAll();
        if (hitHiddenProcrastination) {
          triggerLotteryJackpotCelebration();
        } else {
          triggerWinnerAura(chosenListColor);
        }
      }, Math.max(rollDelays[stepIndex], 480));
      return;
    }

    setTimeout(() => runTick(stepIndex + 1), rollDelays[stepIndex]);
  };

  runTick(0);
}

/**
 * Log Activity Completion to Calendar.
 * When marked as completed today (logical today), automatically unchecks the activity for the day.
 */
function logActivityCompletion(item, list, dateStr = getLogicalTodayStr(), originEl = null) {
  checkAndPerformDailyReset(false);
  const todayStr = getLogicalTodayStr();
  const prevStats = getStatsSnapshot();
  const resolvedColor = list.color || PALETTE[0];

  const newLog = {
    id: uid("log"),
    date: dateStr,
    timestamp: new Date().toISOString(),
    itemId: item.id,
    itemTitle: item.title,
    listId: list.id,
    listName: list.name,
    color: resolvedColor
  };

  state.logs.push(newLog);

  const isCompletingActiveHero =
    dateStr === todayStr &&
    state.activeDecision &&
    state.activeDecision.itemId === item.id;

  // If completed for today, automatically uncheck it for the rest of the day (until 3am reset)
  if (dateStr === todayStr) {
    state.lists.forEach((l) => {
      l.items.forEach((it) => {
        if (it.id === item.id) {
          it.checked = false;
        }
      });
    });

    if (isCompletingActiveHero) {
      if (!prefersReducedMotion()) {
        clearCompletingDecisionHold();
        completingDecisionSnapshot = {
          ...state.activeDecision,
          phase: "hold"
        };
        const exitTimer = setTimeout(() => {
          if (completingDecisionSnapshot) {
            completingDecisionSnapshot.phase = "exit";
            renderDecisionCard();
          }
        }, 750);
        const doneTimer = setTimeout(() => {
          completingDecisionSnapshot = null;
          completingDecisionTimers = [];
          renderDecisionCard();
        }, 1200);
        completingDecisionTimers.push(exitTimer, doneTimer);
      }
      state.activeDecision = null;
    }
  }

  selectedDateStr = dateStr;

  const [y, m] = dateStr.split("-").map(Number);
  calYear = y;
  calMonth = m - 1;

  const wasGoldToday =
    dateStr === todayStr &&
    getStarStatusForDate(todayStr, state.logs.filter((l) => l.date === todayStr).length > 1).hasGoldStar;

  if (dateStr === todayStr) {
    evaluateTodayDailyStar(false);
  }

  const todayStarAfter =
    dateStr === todayStr ? getStarStatusForDate(todayStr, true) : null;

  saveState();
  trackAnalyticsEvent("activity_completed", {
    from_active_decision: isCompletingActiveHero
  });
  spawnConfettiBurst(originEl, resolvedColor);
  renderAll();
  animateStatBumps(prevStats);
  if (dateStr === todayStr && !wasGoldToday && todayStarAfter && todayStarAfter.hasGoldStar) {
    trackAnalyticsEvent("daily_star_earned", { star_type: "gold" });
    showToast(`Completed "${item.title}"! ★ Upgraded to Gold Daily Star!`);
  } else if (
    dateStr === todayStr &&
    todayStarAfter &&
    todayStarAfter.hasSilverStar &&
    !todayStarAfter.scheduledDone
  ) {
    showToast(`Completed "${item.title}"! Finish today's To-Do & Schedule tasks for a Gold Star!`);
  } else {
    showToast(`Completed "${item.title}"! 🎉`);
  }
  announceFreezeIfEarned(prevStats.availableFreezes);
}

// Helper: Get Monday of the week containing dateObj
function getMondayOfWeek(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const dayOffset = (d.getDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  d.setDate(d.getDate() - dayOffset);
  return d;
}

// Helper: Get adjacent YYYY-MM-DD date string (-1 for yesterday, +1 for tomorrow)
function getAdjacentDateStr(dateStr, offsetDays) {
  const d = parseLocalDateStr(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateStr(d);
}

// Helper: Select a date and immediately open the Quick-Log Drawer for it
function openQuickLogForDate(dateStr, cellYear, cellMonth) {
  selectedDateStr = dateStr;
  if (typeof cellYear === "number" && typeof cellMonth === "number") {
    calYear = cellYear;
    calMonth = cellMonth;
  } else {
    const d = parseLocalDateStr(dateStr);
    calYear = d.getFullYear();
    calMonth = d.getMonth();
  }
  renderAll();
  const quickLogDrawer = document.getElementById("quick-log-drawer");
  if (quickLogDrawer) {
    quickLogDrawer.classList.remove("hidden");
    quickLogDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Render Calendar (Supports Monthly Grid, 7-Row Weekly Agenda, Streak Chain, Quick-Log & Daily Notes)
function renderCalendar() {
  hideCalendarTooltip();

  const isWeekView = state.calendarView === "week";
  document.getElementById("btn-view-month").classList.toggle("active", !isWeekView);
  document.getElementById("btn-view-week").classList.toggle("active", isWeekView);

  const weekdaysHeaderEl = document.querySelector(".calendar-weekdays");
  if (weekdaysHeaderEl) {
    weekdaysHeaderEl.classList.toggle("hidden", isWeekView);
  }

  const gridEl = document.getElementById("calendar-grid");
  gridEl.classList.toggle("week-view", isWeekView);
  gridEl.innerHTML = "";

  const logsByDate = new Map();
  state.logs.forEach((log) => {
    if (!logsByDate.has(log.date)) logsByDate.set(log.date, []);
    logsByDate.get(log.date).push(log);
  });

  const todayStr = getLogicalTodayStr();
  const titleEl = document.getElementById("calendar-period-title");
  const rerollSummaryEl = document.getElementById("calendar-reroll-summary");
  const {
    frozenDates,
    qualifyingSet,
    streakChainSet,
    streakDayNumByDate
  } = computeStreakAndFreezes();

  if (isWeekView) {
    const selectedObj = parseLocalDateStr(selectedDateStr);
    const mondayObj = getMondayOfWeek(selectedObj);
    const sundayObj = new Date(mondayObj.getFullYear(), mondayObj.getMonth(), mondayObj.getDate() + 6);

    const startLabel = `${SHORT_MONTH_NAMES[mondayObj.getMonth()]} ${mondayObj.getDate()}`;
    const endLabel =
      mondayObj.getMonth() === sundayObj.getMonth()
        ? `${sundayObj.getDate()}, ${sundayObj.getFullYear()}`
        : `${SHORT_MONTH_NAMES[sundayObj.getMonth()]} ${sundayObj.getDate()}, ${sundayObj.getFullYear()}`;
    titleEl.textContent = `${startLabel} – ${endLabel}`;

    let weekRerollTotal = 0;

    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(mondayObj.getFullYear(), mondayObj.getMonth(), mondayObj.getDate() + i);
      const dateStr = toLocalDateStr(cellDate);
      const dayLogs = logsByDate.get(dateStr) || [];
      const dayRerolls = Number(state.rerollsByDate[dateStr]) || 0;
      const { hasGoldStar, hasSilverStar } = getStarStatusForDate(dateStr, dayLogs.length > 0);
      const isFrozen = frozenDates.has(dateStr);
      const isStreakDay = qualifyingSet.has(dateStr);
      const isChainNode = streakChainSet.has(dateStr);
      const chainPrev = isChainNode && i > 0 && streakChainSet.has(getAdjacentDateStr(dateStr, -1));
      const chainNext = isChainNode && i < 6 && streakChainSet.has(getAdjacentDateStr(dateStr, 1));
      const dayNote = (state.dailyNotesByDate && state.dailyNotesByDate[dateStr]) || "";
      const streakDayNum = streakDayNumByDate.get(dateStr) || 0;
      weekRerollTotal += dayRerolls;

      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDateStr;

      const row = document.createElement("div");
      row.className = [
        "week-day-row",
        dayLogs.length > 0 ? "has-logs" : "",
        isStreakDay ? "is-streak-day" : "",
        isFrozen ? "is-frozen" : "",
        chainPrev ? "chain-prev" : "",
        chainNext ? "chain-next" : "",
        isToday ? "is-today" : "",
        isSelected ? "is-selected" : ""
      ]
        .filter(Boolean)
        .join(" ");

      const formattedShortDate = `${SHORT_MONTH_NAMES[cellDate.getMonth()]} ${cellDate.getDate()}`;

      const badgesHtml = [
        isStreakDay && streakDayNum > 0 ? `<span class="cal-done-tag" title="Qualifying Streak Day #${streakDayNum}">🔥 Day ${streakDayNum}</span>` : "",
        isFrozen ? `<span class="cal-freeze-tag" title="Streak Freeze automatically used on ${dateStr}">❄️ Freeze</span>` : "",
        hasGoldStar ? `<span class="cal-star-tag" title="Gold Star: All Daily Tasks + Activity completed on ${dateStr}">★</span>` : "",
        hasSilverStar ? `<span class="cal-star-tag is-silver" title="Silver Star: All Daily Tasks completed on ${dateStr} (no activities logged)">★</span>` : "",
        dayRerolls > 0 ? `<span class="cal-reroll-tag" title="${dayRerolls} re-roll${dayRerolls === 1 ? "" : "s"}">🎲 ${dayRerolls}</span>` : ""
      ]
        .filter(Boolean)
        .join("");

      row.innerHTML = `
        <div class="week-day-main">
          <div class="week-day-left">
            ${badgesHtml ? `<div class="week-day-badges">${badgesHtml}</div>` : ""}
            <div class="week-day-name">
              <span>${WEEKDAY_NAMES[i]}</span>
              ${isToday ? `<span class="week-today-pill">Today</span>` : ""}
            </div>
            <div class="week-day-date">${formattedShortDate}</div>
          </div>
          <div class="week-day-middle">
            ${
              dayLogs.length > 0
                ? dayLogs
                    .map(
                      (l) =>
                        `<span class="week-activity-chip" style="border-left-color: ${getListColor(l.listId, l.color || PALETTE[0])}">${escapeHtml(l.itemTitle)}</span>`
                    )
                    .join("")
                : isFrozen
                  ? `<span class="week-empty-label">❄️ Streak protected by Streak Freeze</span>`
                  : `<span class="week-empty-label">No completed activities</span>`
            }
            ${dayNote ? `<div class="week-day-note"><span aria-hidden="true">📝</span> <span>${escapeHtml(dayNote)}</span></div>` : ""}
          </div>
        </div>
      `;

      row.addEventListener("click", () => {
        selectedDateStr = dateStr;
        calYear = cellDate.getFullYear();
        calMonth = cellDate.getMonth();
        renderCalendar();
        renderDayInspector();
      });

      row.addEventListener("dblclick", () => {
        openQuickLogForDate(dateStr, cellDate.getFullYear(), cellDate.getMonth());
      });

      gridEl.appendChild(row);
    }

    rerollSummaryEl.textContent = `🎲 ${weekRerollTotal} re-roll${weekRerollTotal === 1 ? "" : "s"} this week`;
    rerollSummaryEl.classList.toggle("badge-reroll", weekRerollTotal > 0);
  } else {
    titleEl.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

    const firstDayObj = new Date(calYear, calMonth, 1);
    const startOffset = (firstDayObj.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    let monthRerollTotal = 0;
    const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    Object.entries(state.rerollsByDate).forEach(([dStr, count]) => {
      if (dStr.startsWith(monthPrefix)) {
        monthRerollTotal += Number(count) || 0;
      }
    });

    for (let i = 0; i < totalCells; i++) {
      let cellYear = calYear;
      let cellMonth = calMonth;
      let dayNum = i - startOffset + 1;
      let isOtherMonth = false;

      if (dayNum < 1) {
        isOtherMonth = true;
        cellMonth = calMonth - 1;
        if (cellMonth < 0) {
          cellMonth = 11;
          cellYear--;
        }
        dayNum = daysInPrevMonth + dayNum;
      } else if (dayNum > daysInMonth) {
        isOtherMonth = true;
        cellMonth = calMonth + 1;
        if (cellMonth > 11) {
          cellMonth = 0;
          cellYear++;
        }
        dayNum = dayNum - daysInMonth;
      }

      const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dayLogs = logsByDate.get(dateStr) || [];
      const dayRerolls = Number(state.rerollsByDate[dateStr]) || 0;
      const { hasGoldStar, hasSilverStar } = getStarStatusForDate(dateStr, dayLogs.length > 0);
      const isFrozen = frozenDates.has(dateStr);
      const isStreakDay = qualifyingSet.has(dateStr);
      const isChainNode = streakChainSet.has(dateStr);
      const colIndex = i % 7;
      const prevDateStr = getAdjacentDateStr(dateStr, -1);
      const nextDateStr = getAdjacentDateStr(dateStr, 1);
      const chainLeft = isChainNode && colIndex > 0 && streakChainSet.has(prevDateStr);
      const chainRight = isChainNode && colIndex < 6 && streakChainSet.has(nextDateStr);
      const chainLeftIsFrozen = chainLeft && (isFrozen || frozenDates.has(prevDateStr));
      const chainRightIsFrozen = chainRight && (isFrozen || frozenDates.has(nextDateStr));
      const dayNote = (state.dailyNotesByDate && state.dailyNotesByDate[dateStr]) || "";
      const streakDayNum = streakDayNumByDate.get(dateStr) || 0;

      const cell = createMonthlyDayCell({
        dayNum,
        dateStr,
        dayLogs,
        dayRerolls,
        hasGoldStar,
        hasSilverStar,
        isFrozen,
        isStreakDay,
        chainLeft,
        chainRight,
        chainLeftIsFrozen,
        chainRightIsFrozen,
        dayNote,
        streakDayNum,
        isOtherMonth,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        maxPills: 2,
        cellYear,
        cellMonth
      });
      gridEl.appendChild(cell);
    }

    rerollSummaryEl.textContent = `🎲 ${monthRerollTotal} re-roll${monthRerollTotal === 1 ? "" : "s"} this month`;
    rerollSummaryEl.classList.toggle("badge-reroll", monthRerollTotal > 0);
  }
}

function createMonthlyDayCell({
  dayNum,
  dateStr,
  dayLogs,
  dayRerolls,
  hasGoldStar,
  hasSilverStar,
  isFrozen,
  isStreakDay,
  chainLeft,
  chainRight,
  chainLeftIsFrozen,
  chainRightIsFrozen,
  dayNote,
  streakDayNum,
  isOtherMonth,
  isToday,
  isSelected,
  maxPills = 2,
  cellYear,
  cellMonth
}) {
  const cell = document.createElement("div");
  cell.className = [
    "cal-day",
    dayLogs.length > 0 ? "has-logs" : "",
    isStreakDay ? "is-streak-day" : "",
    isFrozen ? "is-frozen" : "",
    chainLeft ? "chain-left" : "",
    chainRight ? "chain-right" : "",
    chainLeftIsFrozen ? "chain-left-frozen" : "",
    chainRightIsFrozen ? "chain-right-frozen" : "",
    isOtherMonth ? "other-month" : "",
    isToday ? "is-today" : "",
    isSelected ? "is-selected" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const visiblePills = dayLogs.slice(0, maxPills);
  const hiddenPills = dayLogs.slice(maxPills);
  const extraCount = hiddenPills.length;

  cell.innerHTML = `
    <div class="cal-day-header">
      <span class="cal-day-num">${dayNum}</span>
      <span class="cal-day-badges">
        ${dayNote ? `<span class="cal-note-inline" aria-label="Daily note"><svg class="ui-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>` : ""}
        ${isFrozen ? `<span class="cal-freeze-inline" aria-label="Streak Freeze used">❄️</span>` : ""}
        ${hasGoldStar ? `<span class="cal-star-inline" aria-label="Gold Star: Daily Tasks and activity completed">★</span>` : ""}
        ${hasSilverStar ? `<span class="cal-star-inline is-silver" aria-label="Silver Star: Daily Tasks completed">★</span>` : ""}
        ${dayRerolls > 0 ? `<span class="cal-reroll-inline">🎲${dayRerolls}</span>` : ""}
      </span>
    </div>
    <div class="cal-pills"></div>
  `;

  // Hover tooltip for the Daily Note indicator
  const noteEl = cell.querySelector(".cal-note-inline");
  if (noteEl && dayNote) {
    const noteTooltipHtml = `
      <div class="tooltip-header">Daily Note (${escapeHtml(dateStr)})</div>
      <div class="tooltip-item"><span>📝</span><span>${escapeHtml(dayNote)}</span></div>
    `;
    noteEl.addEventListener("mouseenter", (e) => showCalendarTooltip(noteTooltipHtml, e));
    noteEl.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    noteEl.addEventListener("mouseleave", hideCalendarTooltip);
  }

  // Hover tooltip for the Streak Freeze indicator
  const freezeEl = cell.querySelector(".cal-freeze-inline");
  if (freezeEl) {
    const freezeTooltipHtml = `<div class="tooltip-item"><span>❄️</span><span>Streak Freeze used — streak protected on ${escapeHtml(dateStr)}!</span></div>`;
    freezeEl.addEventListener("mouseenter", (e) => showCalendarTooltip(freezeTooltipHtml, e));
    freezeEl.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    freezeEl.addEventListener("mouseleave", hideCalendarTooltip);
  }

  // Hover tooltip for the Star indicator (Gold vs Silver)
  const starEl = cell.querySelector(".cal-star-inline");
  if (starEl) {
    let starTooltipHtml = "";
    if (hasGoldStar) {
      const streakSuffix =
        isStreakDay && streakDayNum > 0 ? ` (🔥 Streak Day ${streakDayNum})` : "";
      starTooltipHtml = `<div class="tooltip-item"><span style="color: var(--star-gold)">★</span><span>Gold Star: All Daily Tasks + Activity completed on ${escapeHtml(dateStr)}${escapeHtml(streakSuffix)}!</span></div>`;
    } else {
      starTooltipHtml = `<div class="tooltip-item"><span style="color: var(--star-silver)">★</span><span>Silver Star: All Daily Tasks completed on ${escapeHtml(dateStr)} (no activity logged)</span></div>`;
    }
    starEl.addEventListener("mouseenter", (e) => showCalendarTooltip(starTooltipHtml, e));
    starEl.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    starEl.addEventListener("mouseleave", hideCalendarTooltip);
  }

  // Hover tooltip for the Re-roll indicator
  const rerollEl = cell.querySelector(".cal-reroll-inline");
  if (rerollEl) {
    const rerollTooltipHtml = `<div class="tooltip-item"><span>🎲</span><span>${dayRerolls} re-roll${dayRerolls === 1 ? "" : "s"} on ${escapeHtml(dateStr)}</span></div>`;
    rerollEl.addEventListener("mouseenter", (e) => showCalendarTooltip(rerollTooltipHtml, e));
    rerollEl.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    rerollEl.addEventListener("mouseleave", hideCalendarTooltip);
  }

  const pillsContainer = cell.querySelector(".cal-pills");

  // Render visible colored activity text pills with instant full-text hover tooltip
  visiblePills.forEach((l) => {
    const pillColor = getListColor(l.listId, l.color || PALETTE[0]);
    const pill = document.createElement("div");
    pill.className = "cal-pill";
    pill.style.borderLeftColor = pillColor;
    pill.textContent = l.itemTitle;

    const tooltipHtml = `
      <div class="tooltip-item">
        <span class="color-dot" style="background-color: ${pillColor}"></span>
        <div>
          <div>${escapeHtml(l.itemTitle)}</div>
          ${l.listName ? `<div class="tooltip-item-sub">${escapeHtml(l.listName)}</div>` : ""}
        </div>
      </div>
    `;

    pill.addEventListener("mouseenter", (e) => showCalendarTooltip(tooltipHtml, e));
    pill.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    pill.addEventListener("mouseleave", hideCalendarTooltip);

    pillsContainer.appendChild(pill);
  });

  // Render "+N more" with instant hover tooltip showing the hidden activities
  if (extraCount > 0) {
    const moreEl = document.createElement("div");
    moreEl.className = "cal-more";
    moreEl.textContent = `+${extraCount} more`;

    const moreTooltipHtml = `
      <div class="tooltip-header">${extraCount} more on ${escapeHtml(dateStr)}</div>
      <ul class="tooltip-list">
        ${hiddenPills
          .map(
            (l) => `
          <li class="tooltip-item">
            <span class="color-dot" style="background-color: ${getListColor(l.listId, l.color || PALETTE[0])}"></span>
            <div>
              <div>${escapeHtml(l.itemTitle)}</div>
              ${l.listName ? `<div class="tooltip-item-sub">${escapeHtml(l.listName)}</div>` : ""}
            </div>
          </li>
        `
          )
          .join("")}
      </ul>
    `;

    moreEl.addEventListener("mouseenter", (e) => showCalendarTooltip(moreTooltipHtml, e));
    moreEl.addEventListener("mousemove", (e) => positionCalendarTooltip(e));
    moreEl.addEventListener("mouseleave", hideCalendarTooltip);

    pillsContainer.appendChild(moreEl);
  }

  cell.addEventListener("click", () => {
    selectedDateStr = dateStr;
    calYear = cellYear;
    calMonth = cellMonth;
    renderCalendar();
    renderDayInspector();
  });

  cell.addEventListener("dblclick", () => {
    openQuickLogForDate(dateStr, cellYear, cellMonth);
  });

  return cell;
}

// Render Selected Date Inspector & Interactive Quick-Log Drawer
function renderDayInspector() {
  const todayStr = getLogicalTodayStr();
  const dateTitleEl = document.getElementById("inspector-date-title");
  const dateLabelReadable = selectedDateStr === todayStr ? `Today (${selectedDateStr})` : selectedDateStr;
  dateTitleEl.textContent = dateLabelReadable;

  const quickLogDateLabel = document.getElementById("quick-log-date-label");
  if (quickLogDateLabel) {
    quickLogDateLabel.textContent = selectedDateStr === todayStr ? "Today" : selectedDateStr;
  }

  const dayLogs = state.logs.filter((l) => l.date === selectedDateStr);
  const dayRerolls = Number(state.rerollsByDate[selectedDateStr]) || 0;
  const { scheduledDone, hasGoldStar, hasSilverStar } = getStarStatusForDate(
    selectedDateStr,
    dayLogs.length > 0
  );

  // Completed badge: green when > 0, neutral when 0
  const countBadgeEl = document.getElementById("inspector-count-badge");
  countBadgeEl.textContent =
    dayLogs.length > 0 ? `✓ ${dayLogs.length} completed` : "0 completed";
  countBadgeEl.classList.toggle("badge-success", dayLogs.length > 0);

  // Re-roll badge: amber when > 0, neutral when 0
  const rerollBadgeEl = document.getElementById("inspector-reroll-badge");
  rerollBadgeEl.textContent = `🎲 ${dayRerolls} re-roll${dayRerolls === 1 ? "" : "s"}`;
  rerollBadgeEl.classList.toggle("badge-reroll", dayRerolls > 0);

  // Star badge (Gold if Daily Tasks + Activity, Silver if only Daily Tasks)
  const starBadgeEl = document.getElementById("inspector-star-badge");
  if (starBadgeEl) {
    starBadgeEl.classList.toggle("hidden", !hasGoldStar && !hasSilverStar);
    starBadgeEl.classList.toggle("badge-star", hasGoldStar);
    starBadgeEl.classList.toggle("badge-star-silver", hasSilverStar);
    if (hasGoldStar) {
      starBadgeEl.textContent = "★ Gold Star";
      starBadgeEl.title = "All Daily Tasks, Scheduled Tasks + at least 1 Activity were completed on this date!";
    } else if (hasSilverStar) {
      starBadgeEl.textContent = "★ Silver Star";
      starBadgeEl.title =
        dayLogs.length > 0 && !scheduledDone
          ? "All Daily Tasks were completed, but To-Do & Schedule tasks for this date were incomplete."
          : "All Daily Tasks were completed on this date (no activities logged).";
    }
  }

  // Freeze badge if a Streak Freeze was automatically consumed on this date
  const { frozenDates } = computeStreakAndFreezes();
  const isFrozen = frozenDates.has(selectedDateStr);
  const freezeBadgeEl = document.getElementById("inspector-freeze-badge");
  if (freezeBadgeEl) {
    freezeBadgeEl.classList.toggle("hidden", !isFrozen);
  }

  // Daily Note / Highlight input for the selected date
  if (!state.dailyNotesByDate || typeof state.dailyNotesByDate !== "object") {
    state.dailyNotesByDate = {};
  }
  const currentNote = state.dailyNotesByDate[selectedDateStr] || "";
  const noteInputEl = document.getElementById("input-daily-note");
  const clearNoteBtnEl = document.getElementById("btn-clear-daily-note");
  if (noteInputEl && document.activeElement !== noteInputEl) {
    noteInputEl.value = currentNote;
  }
  if (clearNoteBtnEl) {
    clearNoteBtnEl.classList.toggle("hidden", !currentNote);
  }

  const listEl = document.getElementById("day-log-list");
  listEl.innerHTML = "";

  if (dayLogs.length === 0) {
    listEl.innerHTML = `<li class="empty-state">No completed activities logged on this date yet. Click <strong>+ Log Activity</strong> above to add one!</li>`;
  } else {
    dayLogs.forEach((log) => {
      const li = document.createElement("li");
      li.className = "day-log-item";
      const timeLabel = log.timestamp
        ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

      li.innerHTML = `
        <div class="day-log-left">
          <span class="color-dot" style="background-color: ${getListColor(log.listId, log.color || PALETTE[0])}"></span>
          <div>
            <div><strong>${escapeHtml(log.itemTitle)}</strong></div>
            <div class="day-log-meta">${escapeHtml(log.listName || "Custom")} ${timeLabel ? `• ${timeLabel}` : ""}</div>
          </div>
        </div>
        <button type="button" class="btn-icon danger" title="Remove log entry">${ICON_TRASH_SVG}</button>
      `;

      li.querySelector("button").addEventListener("click", () => {
        recordDeletedIds(log.id);
        state.logs = state.logs.filter((l) => l.id !== log.id);
        if (log.date === todayStr) {
          evaluateTodayDailyStar(false);
        }
        saveState();
        renderAll();
      });

      listEl.appendChild(li);
    });
  }

  // Render Quick-Log Drawer Filter Tabs & One-Click Activity Chips
  const filterTabsEl = document.getElementById("quick-log-filter-tabs");
  const chipsEl = document.getElementById("quick-log-chips");
  filterTabsEl.innerHTML = "";
  chipsEl.innerHTML = "";

  if (
    quickLogFilterListId !== "ALL" &&
    !state.lists.some((l) => l.id === quickLogFilterListId)
  ) {
    quickLogFilterListId = "ALL";
  }

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `quick-log-filter-btn ${quickLogFilterListId === "ALL" ? "active" : ""}`;
  allBtn.textContent = "All Lists";
  allBtn.addEventListener("click", () => {
    quickLogFilterListId = "ALL";
    renderDayInspector();
  });
  filterTabsEl.appendChild(allBtn);

  state.lists.forEach((list) => {
    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.className = `quick-log-filter-btn ${quickLogFilterListId === list.id ? "active" : ""}`;
    tabBtn.textContent = list.name;
    tabBtn.addEventListener("click", () => {
      quickLogFilterListId = list.id;
      renderDayInspector();
    });
    filterTabsEl.appendChild(tabBtn);
  });

  const targetLists =
    quickLogFilterListId === "ALL"
      ? state.lists
      : state.lists.filter((l) => l.id === quickLogFilterListId);

  let chipCount = 0;
  targetLists.forEach((list) => {
    const listColor = list.color || PALETTE[0];
    list.items.forEach((item) => {
      chipCount++;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quick-log-chip";
      chip.title = `Log "${item.title}" (${list.name}) to ${selectedDateStr}`;
      chip.innerHTML = `
        <span class="color-dot" style="background-color: ${listColor}"></span>
        <span>${escapeHtml(item.title)}</span>
        <span class="quick-log-chip-plus">+</span>
      `;
      chip.addEventListener("click", () => {
        logActivityCompletion(item, list, selectedDateStr, chip);
      });
      chipsEl.appendChild(chip);
    });
  });

  if (chipCount === 0) {
    chipsEl.innerHTML = `<span class="text-muted small">No activities in this list.</span>`;
  }
}

// Compute Streaks, Streak Freezes, Weekly/Monthly Stats & Top Activities
function renderStatsAndInsights() {
  const {
    currentStreak,
    bestStreak,
    availableFreezes,
    consecutiveActive
  } = computeStreakAndFreezes();

  const todayStr = getLogicalTodayStr();
  const sevenDaysAgo = getLogicalTodayDate();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = toLocalDateStr(sevenDaysAgo);
  const weekCount = state.logs.filter((l) => l.date >= sevenDaysAgoStr && l.date <= todayStr).length;

  const viewedMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const monthCount = state.logs.filter((l) => l.date.startsWith(viewedMonthPrefix)).length;

  document.getElementById("stat-current-streak").textContent = `${currentStreak}d`;
  document.getElementById("stat-best-streak").textContent = `(Best: ${bestStreak}d)`;

  const freezeCountEl = document.getElementById("stat-freeze-count");
  const freezeSubEl = document.getElementById("stat-freeze-sub");
  if (freezeCountEl) {
    freezeCountEl.textContent = `${availableFreezes}/${MAX_STREAK_FREEZES}`;
  }
  if (freezeSubEl) {
    freezeSubEl.textContent =
      availableFreezes >= MAX_STREAK_FREEZES
        ? "(Maxed!)"
        : `(${consecutiveActive}/${STREAK_FREEZE_INTERVAL}d to +1)`;
  }

  document.getElementById("stat-week-count").textContent = String(weekCount);
  document.getElementById("stat-month-count").textContent = String(monthCount);
  document.getElementById("total-alltime-count").textContent = `${state.logs.length} total`;

  const countsMap = new Map();
  state.logs.forEach((l) => {
    const key = l.itemTitle;
    const resolvedColor = getListColor(l.listId, l.color || PALETTE[0]);
    const existing = countsMap.get(key) || { title: l.itemTitle, count: 0, color: resolvedColor };
    existing.count++;
    existing.color = resolvedColor;
    countsMap.set(key, existing);
  });

  const sortedTop = Array.from(countsMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topContainer = document.getElementById("top-activities-list");
  topContainer.innerHTML = "";

  if (sortedTop.length === 0) {
    topContainer.innerHTML = `<div class="empty-state">Complete your first activity to see your breakdown!</div>`;
    return;
  }

  const maxCount = sortedTop[0].count;
  sortedTop.forEach((entry) => {
    const pct = Math.max(8, Math.round((entry.count / maxCount) * 100));
    const row = document.createElement("div");
    row.className = "top-activity-row";
    row.innerHTML = `
      <div class="top-activity-labels">
        <span>${escapeHtml(entry.title)}</span>
        <span class="text-muted">${entry.count}×</span>
      </div>
      <div class="top-bar-track">
        <div class="top-bar-fill" style="width: ${pct}%; background-color: ${entry.color}"></div>
      </div>
    `;
    topContainer.appendChild(row);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCollapsibleCards() {
  const configs = [
    {
      key: "activityLists",
      cardId: "pool-card",
      bodyId: "pool-card-body",
      btnId: "btn-toggle-activity-lists",
      label: "Activity Lists"
    },
    {
      key: "dailyTasks",
      cardId: "daily-tasks-card",
      bodyId: "daily-tasks-card-body",
      btnId: "btn-toggle-daily-tasks",
      label: "Daily Tasks"
    },
    {
      key: "scheduledTasks",
      cardId: "scheduled-tasks-card",
      bodyId: "scheduled-tasks-card-body",
      btnId: "btn-toggle-scheduled-tasks",
      label: "To-Do & Schedule"
    },
    {
      key: "procrastination",
      cardId: "procrastination-card",
      bodyId: "procrastination-card-body",
      btnId: "btn-toggle-procrastination",
      label: "Procrastination List"
    },
    {
      key: "insights",
      cardId: "insights-card",
      bodyId: "insights-card-body",
      btnId: "btn-toggle-insights",
      label: "All-Time Breakdown"
    }
  ];

  configs.forEach(({ key, cardId, bodyId, btnId, label }) => {
    const isCollapsed = Boolean(state.collapsedCards && state.collapsedCards[key]);
    const cardEl = document.getElementById(cardId);
    const bodyEl = document.getElementById(bodyId);
    const btnEl = document.getElementById(btnId);

    if (cardEl) {
      cardEl.classList.toggle("is-collapsed", isCollapsed);
    }
    if (bodyEl) {
      bodyEl.inert = isCollapsed;
    }
    if (btnEl) {
      const actionLabel = `${isCollapsed ? "Expand" : "Collapse"} ${label}`;
      btnEl.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      btnEl.setAttribute("title", actionLabel);
      btnEl.setAttribute("aria-label", actionLabel);
    }
  });
}

function setMobileView(viewName) {
  const validViews = ["decide", "tasks", "calendar"];
  const nextView = validViews.includes(viewName) ? viewName : "decide";
  const shell = document.getElementById("app-shell");
  if (shell) {
    shell.setAttribute("data-mobile-view", nextView);
  }
  document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    const isActive = btn.dataset.mobileView === nextView;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function renderAll() {
  applyTheme();
  renderCollapsibleCards();
  renderListTabs();
  renderDecisionCard();
  renderActivityPool();
  renderDailyTasks();
  renderScheduledTasks();
  renderProcrastinationList();
  renderCalendar();
  renderDayInspector();
  renderStatsAndInsights();
}

function bindDelegatedListContainers() {
  // 1. Activity Pool List
  const activityListEl = document.getElementById("activity-list");
  if (activityListEl) {
    activityListEl.addEventListener("change", (e) => {
      if (!e.target.classList.contains("activity-checkbox")) return;
      const li = e.target.closest(".activity-item");
      const activeList = getActiveList();
      const item = li && activeList.items.find((i) => i.id === li.dataset.itemId);
      if (!item) return;
      item.checked = !item.checked;
      saveState();
      renderListTabs();
      renderActivityPool();
      renderDecisionCard();
    });

    activityListEl.addEventListener("click", (e) => {
      const li = e.target.closest(".activity-item");
      if (!li) return;
      const activeList = getActiveList();
      const item = activeList.items.find((i) => i.id === li.dataset.itemId);
      if (!item) return;

      if (e.target.closest(".activity-title")) {
        item.checked = !item.checked;
        saveState();
        renderListTabs();
        renderActivityPool();
        renderDecisionCard();
      } else if (e.target.closest(".weight-badge")) {
        const currentIdx = WEIGHT_STEPS.indexOf(normalizeWeight(item.weight));
        item.weight = WEIGHT_STEPS[(currentIdx + 1) % WEIGHT_STEPS.length];
        saveState();
        renderActivityPool();
        renderDecisionCard();
      } else if (e.target.closest(".log-direct-btn")) {
        const logBtn = e.target.closest(".log-direct-btn");
        logActivityCompletion(item, activeList, getLogicalTodayStr(), logBtn);
      } else if (e.target.closest(".edit-item-btn")) {
        openInputModal({
          title: "Rename Activity",
          label: "Activity Name",
          initialValue: item.title,
          placeholder: "Enter activity name...",
          onSave: (newTitle) => {
            item.title = newTitle;
            if (state.activeDecision && state.activeDecision.itemId === item.id) {
              state.activeDecision.title = newTitle;
            }
            saveState();
            renderActivityPool();
            renderDecisionCard();
            showToast(`Renamed activity to "${newTitle}"`);
          }
        });
      } else if (e.target.closest(".delete-item-btn")) {
        openConfirmModal(
          "Delete Activity",
          `Are you sure you want to delete "${item.title}" from "${activeList.name}"?`,
          () => {
            recordDeletedIds(item.id);
            activeList.items = activeList.items.filter((i) => i.id !== item.id);
            if (state.activeDecision && state.activeDecision.itemId === item.id) {
              state.activeDecision = null;
            }
            saveState();
            renderListTabs();
            renderActivityPool();
            renderDecisionCard();
            showToast(`Deleted "${item.title}"`);
          }
        );
      }
    });

    bindListDragReorder({
      containerEl: activityListEl,
      itemSelector: ".activity-item",
      datasetKey: "itemId",
      onReorder: (fromId, toId) => {
        const activeList = getActiveList();
        if (reorderArrayById(activeList.items, fromId, toId)) {
          saveState();
          renderActivityPool();
        }
      }
    });
  }

  // 2. Daily Tasks List
  const dailyListEl = document.getElementById("daily-tasks-list");
  if (dailyListEl) {
    dailyListEl.addEventListener("click", (e) => {
      const li = e.target.closest(".daily-task-item");
      if (!li) return;
      const task = state.dailyTasks.find((t) => t.id === li.dataset.dailyId);
      if (!task) return;

      if (e.target.closest(".log-daily-btn") || e.target.closest(".daily-task-title")) {
        checkAndPerformDailyReset(false);
        const prevStats = getStatsSnapshot();
        task.doneToday = !task.doneToday;
        if (task.doneToday) {
          const targetEl = e.target.closest(".log-daily-btn") || li;
          spawnConfettiBurst(targetEl, "#eab308");
        }
        evaluateTodayDailyStar(true);
        saveState();
        if (task.doneToday) {
          trackAnalyticsEvent("daily_completed");
        }
        renderDailyTasks();
        renderCalendar();
        renderDayInspector();
        renderStatsAndInsights();
        animateStatBumps(prevStats);
        announceFreezeIfEarned(prevStats.availableFreezes);
      } else if (e.target.closest(".edit-daily-btn")) {
        openInputModal({
          title: "Rename Daily Task",
          label: "Daily Task Name",
          initialValue: task.title,
          placeholder: "Enter daily task name...",
          onSave: (newTitle) => {
            task.title = newTitle;
            saveState();
            renderDailyTasks();
            showToast(`Renamed daily task to "${newTitle}"`);
          }
        });
      } else if (e.target.closest(".delete-daily-btn")) {
        openConfirmModal(
          "Delete Daily Task",
          `Are you sure you want to delete daily task "${task.title}"?`,
          () => {
            recordDeletedIds(task.id);
            state.dailyTasks = state.dailyTasks.filter((t) => t.id !== task.id);
            evaluateTodayDailyStar(false);
            saveState();
            renderDailyTasks();
            renderCalendar();
            renderDayInspector();
            renderStatsAndInsights();
            showToast(`Deleted daily task "${task.title}"`);
          }
        );
      }
    });

    bindListDragReorder({
      containerEl: dailyListEl,
      itemSelector: ".daily-task-item",
      datasetKey: "dailyId",
      onReorder: (fromId, toId) => {
        if (reorderArrayById(state.dailyTasks, fromId, toId)) {
          saveState();
          renderDailyTasks();
        }
      }
    });
  }

  // 3. Scheduled Tasks List
  const schedListEl = document.getElementById("scheduled-tasks-list");
  if (schedListEl) {
    schedListEl.addEventListener("click", (e) => {
      const li = e.target.closest(".scheduled-task-item");
      if (!li) return;
      const tasks = Array.isArray(state.scheduledTasks) ? state.scheduledTasks : [];
      const task = tasks.find((t) => t.id === li.dataset.schedId);
      if (!task) return;

      if (e.target.closest(".log-sched-btn") || e.target.closest(".daily-task-title")) {
        if (isEditingScheduledTasks) return;
        checkAndPerformDailyReset(false);
        const currentToday = getLogicalTodayStr();
        const activeTargetDate = getScheduledTaskTargetDate(task, currentToday);
        const activeIsAhead = activeTargetDate > currentToday;
        const prevStats = getStatsSnapshot();
        const wasGold = getStarStatusForDate(
          currentToday,
          state.logs.some((l) => l.date === currentToday)
        ).hasGoldStar;

        if (!task.completedDates || typeof task.completedDates !== "object") {
          task.completedDates = {};
        }
        let markedDoneNow = false;
        if (task.completedDates[activeTargetDate]) {
          delete task.completedDates[activeTargetDate];
        } else {
          task.completedDates[activeTargetDate] = true;
          markedDoneNow = true;
          const targetEl = e.target.closest(".log-sched-btn") || li;
          spawnConfettiBurst(targetEl, "#eab308");
        }

        evaluateTodayDailyStar(false);
        const nowGold = getStarStatusForDate(
          currentToday,
          state.logs.some((l) => l.date === currentToday)
        ).hasGoldStar;

        saveState();
        if (markedDoneNow) {
          trackAnalyticsEvent("todo_completed", {
            is_scheduled_ahead: activeIsAhead
          });
        }
        renderScheduledTasks();
        renderDailyTasks();
        renderCalendar();
        renderDayInspector();
        renderStatsAndInsights();
        animateStatBumps(prevStats);

        if (markedDoneNow && activeIsAhead) {
          const dObj = parseLocalDateStr(activeTargetDate);
          const dLabel = `${SHORT_MONTH_NAMES[dObj.getMonth()]} ${dObj.getDate()}`;
          showToast(`Completed "${task.title}" ahead of schedule (for ${dLabel})!`);
        } else if (!wasGold && nowGold) {
          trackAnalyticsEvent("daily_star_earned", { star_type: "gold" });
          showToast(`Completed "${task.title}"! ⭐ Gold Daily Star earned!`);
        }
        announceFreezeIfEarned(prevStats.availableFreezes);
      } else if (e.target.closest(".edit-sched-btn")) {
        openScheduledTaskModal(task);
      } else if (e.target.closest(".delete-sched-btn")) {
        openConfirmModal(
          "Delete Scheduled Task",
          `Are you sure you want to delete "${task.title}"?`,
          () => {
            recordDeletedIds(task.id);
            state.scheduledTasks = state.scheduledTasks.filter((t) => t.id !== task.id);
            evaluateTodayDailyStar(false);
            saveState();
            renderScheduledTasks();
            renderDailyTasks();
            renderCalendar();
            renderDayInspector();
            renderStatsAndInsights();
            showToast(`Deleted task "${task.title}"`);
          }
        );
      }
    });

    bindListDragReorder({
      containerEl: schedListEl,
      itemSelector: ".scheduled-task-item",
      datasetKey: "schedId",
      onReorder: (fromId, toId) => {
        if (reorderArrayById(state.scheduledTasks, fromId, toId)) {
          saveState();
          renderScheduledTasks();
        }
      }
    });
  }

  // 4. Procrastination List
  const procrastListEl = document.getElementById("procrastination-list");
  if (procrastListEl) {
    procrastListEl.addEventListener("click", (e) => {
      const li = e.target.closest(".procrastination-item");
      if (!li) return;
      const tasks = Array.isArray(state.procrastinationTasks) ? state.procrastinationTasks : [];
      const task = tasks.find((t) => t.id === li.dataset.procrastId);
      if (!task) return;

      const subtaskEl = e.target.closest(".procrastination-subtask-item");
      if (subtaskEl) {
        if (!Array.isArray(task.subtasks)) task.subtasks = [];
        const sub = task.subtasks.find((s) => s.id === subtaskEl.dataset.subtaskId);
        if (!sub) return;

        if (e.target.closest(".toggle-procrast-subtask-btn") || e.target.closest(".procrastination-subtask-title")) {
          if (isEditingProcrastination) return;
          checkAndPerformDailyReset(false);
          sub.done = !sub.done;
          const allSubtasksDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.done);
          task.doneToday = allSubtasksDone;

          if (
            sub.done &&
            state.activeDecision &&
            state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
            state.activeDecision.itemId === task.id &&
            state.activeDecision.subtaskId === sub.id
          ) {
            state.activeDecision = null;
          }

          saveState();
          if (allSubtasksDone) {
            trackAnalyticsEvent("procrastination_completed", {
              from_active_decision: false
            });
          }
          renderProcrastinationList();
          renderDecisionCard();
          if (allSubtasksDone) {
            triggerBigProcrastinationCelebration(e.target.closest(".toggle-procrast-subtask-btn") || subtaskEl);
            showToast(`🎉 Finally tackled "${task.title}"! It'll vanish tomorrow!`);
          } else if (sub.done) {
            spawnConfettiBurst(e.target.closest(".toggle-procrast-subtask-btn") || subtaskEl, PROCRASTINATION_LIST_COLOR);
            const doneCount = task.subtasks.filter((s) => s.done).length;
            showToast(`✓ Step done (${doneCount}/${task.subtasks.length}) for "${task.title}"`);
          }
          return;
        } else if (e.target.closest(".edit-procrast-subtask-btn")) {
          openInputModal({
            title: "Rename Subtask",
            label: "Subtask Name",
            initialValue: sub.title,
            placeholder: "Enter subtask name...",
            onSave: (newTitle) => {
              sub.title = newTitle;
              if (
                state.activeDecision &&
                state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
                state.activeDecision.itemId === task.id &&
                state.activeDecision.subtaskId === sub.id
              ) {
                state.activeDecision.title = newTitle;
              }
              saveState();
              renderProcrastinationList();
              renderDecisionCard();
              showToast(`Renamed subtask to "${newTitle}"`);
            }
          });
          return;
        } else if (e.target.closest(".delete-procrast-subtask-btn")) {
          openConfirmModal(
            "Delete Subtask",
            `Are you sure you want to delete "${sub.title}"?`,
            () => {
              task.subtasks = task.subtasks.filter((s) => s.id !== sub.id);
              if (task.subtasks.length > 0 && task.subtasks.every((s) => s.done)) {
                task.doneToday = true;
              }
              if (
                state.activeDecision &&
                state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
                state.activeDecision.itemId === task.id &&
                state.activeDecision.subtaskId === sub.id
              ) {
                state.activeDecision = null;
              }
              saveState();
              renderProcrastinationList();
              renderDecisionCard();
              showToast(`Deleted subtask "${sub.title}"`);
            }
          );
          return;
        }
      }

      if (e.target.closest(".add-procrast-subtask-btn")) {
        openInputModal({
          title: `Add Subtask to "${task.title}"`,
          label: "Subtask Name",
          initialValue: "",
          placeholder: "e.g., Gather documents...",
          onSave: (subTitle) => {
            if (!Array.isArray(task.subtasks)) task.subtasks = [];
            task.subtasks.push({
              id: uid("sub"),
              title: subTitle,
              done: false
            });
            task.doneToday = false;
            saveState();
            renderProcrastinationList();
            renderDecisionCard();
            showToast(`Added subtask "${subTitle}"`);
          }
        });
      } else if (e.target.closest(".log-procrast-btn") || e.target.closest(".daily-task-title")) {
        if (isEditingProcrastination) return;
        checkAndPerformDailyReset(false);
        task.doneToday = !task.doneToday;
        if (
          task.doneToday &&
          state.activeDecision &&
          state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
          state.activeDecision.itemId === task.id
        ) {
          state.activeDecision = null;
        }
        saveState();
        if (task.doneToday) {
          trackAnalyticsEvent("procrastination_completed", {
            from_active_decision: false
          });
        }
        renderProcrastinationList();
        renderDecisionCard();
        if (task.doneToday) {
          const targetEl = e.target.closest(".log-procrast-btn") || li;
          triggerBigProcrastinationCelebration(targetEl);
          showToast(`🎉 Finally tackled "${task.title}"! It'll vanish tomorrow!`);
        }
      } else if (e.target.closest(".edit-procrast-btn")) {
        openInputModal({
          title: "Rename Procrastination Task",
          label: "Task Name",
          initialValue: task.title,
          placeholder: "Enter task name...",
          onSave: (newTitle) => {
            task.title = newTitle;
            if (
              state.activeDecision &&
              state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
              state.activeDecision.itemId === task.id
            ) {
              state.activeDecision.title = newTitle;
            }
            saveState();
            renderProcrastinationList();
            renderDecisionCard();
            showToast(`Renamed task to "${newTitle}"`);
          }
        });
      } else if (e.target.closest(".delete-procrast-btn")) {
        openConfirmModal(
          "Delete Procrastination Task",
          `Are you sure you want to delete "${task.title}"?`,
          () => {
            recordDeletedIds(task.id);
            state.procrastinationTasks = state.procrastinationTasks.filter((t) => t.id !== task.id);
            if (
              state.activeDecision &&
              state.activeDecision.listId === PROCRASTINATION_LIST_ID &&
              state.activeDecision.itemId === task.id
            ) {
              state.activeDecision = null;
            }
            saveState();
            renderProcrastinationList();
            renderDecisionCard();
            showToast(`Deleted task "${task.title}"`);
          }
        );
      }
    });

    bindListDragReorder({
      containerEl: procrastListEl,
      itemSelector: ".procrastination-item",
      datasetKey: "procrastId",
      onReorder: (fromId, toId) => {
        if (reorderArrayById(state.procrastinationTasks, fromId, toId)) {
          saveState();
          renderProcrastinationList();
        }
      }
    });
  }
}

// Wire Up Event Listeners
function initEvents() {
  bindDelegatedListContainers();
  // Theme & Settings dropdowns
  const closeThemeDropdowns = () => {
    document.querySelectorAll(".theme-dropdown").forEach((dd) => dd.classList.add("hidden"));
    document.querySelectorAll(".theme-picker-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  };

  const closeSettingsDropdown = () => {
    document.querySelectorAll(".settings-dropdown").forEach((dd) => dd.classList.add("hidden"));
    document.querySelectorAll(".btn-settings-toggle").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  };

  const closeAccountDropdown = () => {
    const dd = document.getElementById("account-dropdown");
    const btn = document.getElementById("btn-account-toggle");
    if (dd) dd.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  };

  const bindThemePicker = (pickerId, btnId, dropdownId) => {
    const picker = document.getElementById(pickerId);
    const btn = document.getElementById(btnId);
    const dropdown = document.getElementById(dropdownId);
    if (!picker || !btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = dropdown.classList.contains("hidden");
      closeThemeDropdowns();
      closeSettingsDropdown();
      closeAccountDropdown();
      if (willOpen) {
        dropdown.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    dropdown.querySelectorAll(".theme-option").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextTheme = normalizeTheme(opt.dataset.themeValue);
        if (nextTheme !== state.theme) {
          state.theme = nextTheme;
          if (state.theme === "astrology") {
            astrologyHeroPromptIndex = Math.floor(Math.random() * 3);
          } else if (state.theme === "tarot") {
            tarotHeroPromptIndex = Math.floor(Math.random() * TAROT_HERO_PROMPTS.length);
          } else if (state.theme === "win95") {
            win95HeroPromptIndex = Math.floor(Math.random() * WIN95_HERO_PROMPTS.length);
          }
          saveState();
          applyTheme();
          renderDecisionCard();
        }
        closeThemeDropdowns();
      });
    });
  };

  bindThemePicker("theme-picker-header", "btn-theme-toggle", "theme-dropdown-header");
  bindThemePicker("theme-picker-footer", "btn-theme-toggle-footer", "theme-dropdown-footer");

  const bindSettingsMenu = (btnId, dropdownId) => {
    const toggleBtn = document.getElementById(btnId);
    const dropdown = document.getElementById(dropdownId);
    if (!toggleBtn || !dropdown) return;
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = dropdown.classList.contains("hidden");
      closeThemeDropdowns();
      closeSettingsDropdown();
      closeAccountDropdown();
      if (willOpen) {
        dropdown.classList.remove("hidden");
        toggleBtn.setAttribute("aria-expanded", "true");
      }
    });
    dropdown.addEventListener("click", () => {
      closeSettingsDropdown();
    });
  };

  bindSettingsMenu("btn-settings-toggle", "settings-dropdown");
  bindSettingsMenu("btn-settings-toggle-footer", "settings-dropdown-footer");

  const accountToggleBtn = document.getElementById("btn-account-toggle");
  const accountDropdown = document.getElementById("account-dropdown");
  if (accountToggleBtn && accountDropdown) {
    accountToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = accountDropdown.classList.contains("hidden");
      closeThemeDropdowns();
      closeSettingsDropdown();
      closeAccountDropdown();
      if (willOpen) {
        accountDropdown.classList.remove("hidden");
        accountToggleBtn.setAttribute("aria-expanded", "true");
      }
    });
    accountDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  const googleSignInBtn = document.getElementById("btn-google-signin");
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", () => {
      closeAccountDropdown();
      window.DecideForMeCloud?.signInWithGoogle();
    });
  }

  // Username + Password Auth Modal
  const usernameModal = document.getElementById("modal-username-auth");
  const usernameForm = document.getElementById("form-username-auth");
  const usernameInput = document.getElementById("input-auth-username");
  const passwordInput = document.getElementById("input-auth-password");
  const tabSignIn = document.getElementById("tab-username-signin");
  const tabSignUp = document.getElementById("tab-username-signup");
  const authNote = document.getElementById("username-auth-note");
  const authError = document.getElementById("username-auth-error");
  const authSubmitBtn = document.getElementById("btn-username-auth-submit");
  const authCancelBtn = document.getElementById("btn-username-auth-cancel");
  let usernameAuthMode = "signin";

  const setUsernameAuthMode = (mode) => {
    usernameAuthMode = mode === "signup" ? "signup" : "signin";
    const isSignUp = usernameAuthMode === "signup";
    if (tabSignIn) {
      tabSignIn.classList.toggle("is-active", !isSignUp);
      tabSignIn.setAttribute("aria-selected", String(!isSignUp));
    }
    if (tabSignUp) {
      tabSignUp.classList.toggle("is-active", isSignUp);
      tabSignUp.setAttribute("aria-selected", String(isSignUp));
    }
    if (passwordInput) {
      passwordInput.autocomplete = isSignUp ? "new-password" : "current-password";
    }
    if (authNote) {
      authNote.textContent = isSignUp
        ? "No email required — keep your username & password safe (there is no email reset)."
        : "Sign in with your username and password to sync across devices.";
    }
    if (authSubmitBtn) {
      authSubmitBtn.textContent = isSignUp ? "Create Account" : "Sign In";
    }
    if (authError) {
      authError.textContent = "";
      authError.classList.add("hidden");
    }
  };

  const closeUsernameAuthModal = () => {
    if (usernameModal) usernameModal.classList.add("hidden");
  };

  const openUsernameAuthModal = () => {
    if (!usernameModal) return;
    setUsernameAuthMode("signin");
    if (usernameForm) usernameForm.reset();
    usernameModal.classList.remove("hidden");
    if (usernameInput) usernameInput.focus();
  };

  const usernameSignInBtn = document.getElementById("btn-username-signin");
  if (usernameSignInBtn) {
    usernameSignInBtn.addEventListener("click", () => {
      closeAccountDropdown();
      openUsernameAuthModal();
    });
  }

  if (tabSignIn) tabSignIn.addEventListener("click", () => setUsernameAuthMode("signin"));
  if (tabSignUp) tabSignUp.addEventListener("click", () => setUsernameAuthMode("signup"));
  if (authCancelBtn) authCancelBtn.addEventListener("click", closeUsernameAuthModal);
  if (usernameModal) {
    usernameModal.addEventListener("click", (e) => {
      if (e.target === usernameModal) closeUsernameAuthModal();
    });
  }

  if (usernameForm) {
    usernameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!window.DecideForMeCloud?.signInWithUsername) return;
      if (authError) {
        authError.textContent = "";
        authError.classList.add("hidden");
      }
      if (authSubmitBtn) authSubmitBtn.disabled = true;
      try {
        await window.DecideForMeCloud.signInWithUsername(
          usernameInput?.value || "",
          passwordInput?.value || "",
          usernameAuthMode === "signup"
        );
        closeUsernameAuthModal();
      } catch (err) {
        if (authError) {
          authError.textContent = err?.message || "Could not sign in. Please try again.";
          authError.classList.remove("hidden");
        }
      } finally {
        if (authSubmitBtn) authSubmitBtn.disabled = false;
      }
    });
  }

  const googleSignOutBtn = document.getElementById("btn-google-signout");
  if (googleSignOutBtn) {
    googleSignOutBtn.addEventListener("click", () => {
      closeAccountDropdown();
      window.DecideForMeCloud?.signOut();
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".theme-picker")) {
      closeThemeDropdowns();
    }
    if (!e.target.closest(".settings-menu-wrap")) {
      closeSettingsDropdown();
    }
    if (!e.target.closest(".account-menu-wrap")) {
      closeAccountDropdown();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeThemeDropdowns();
      closeSettingsDropdown();
      closeAccountDropdown();
      closeAboutModal();
      return;
    }
    if (e.code === "Space" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const hasOpenModal = Boolean(document.querySelector(".modal-backdrop:not(.hidden)"));
      const isInteractiveTarget = Boolean(
        e.target && e.target.closest("input, textarea, select, button, a, [role='button'], [role='tab'], [contenteditable]")
      );
      if (!hasOpenModal && !isInteractiveTarget && !isRolling) {
        e.preventDefault();
        const isReRoll = Boolean(state.activeDecision);
        triggerDecisionRoll(isReRoll);
      }
    }
  });

  // Sticky Mobile Bottom Navigation
  document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMobileView(btn.dataset.mobileView);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Mobile Stat Pill Tap Explanations (desktop uses native hover title tooltips)
  document.querySelectorAll(".stats-bar .stat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      if (
        !window.matchMedia("(max-width: 640px)").matches &&
        !window.matchMedia("(hover: none)").matches
      ) {
        return;
      }
      const explanation = pill.getAttribute("title");
      if (explanation) {
        showToast(explanation);
      }
    });
  });

  // Decide For Me & Active Choice Actions
  document.getElementById("btn-decide").addEventListener("click", () => triggerDecisionRoll(false));
  document.getElementById("btn-reroll").addEventListener("click", () => triggerDecisionRoll(true));

  document.getElementById("btn-complete-chosen").addEventListener("click", (e) => {
    if (!state.activeDecision || completingDecisionSnapshot) return;
    const d = state.activeDecision;
    if (d.listId === PROCRASTINATION_LIST_ID) {
      checkAndPerformDailyReset(false);
      const task = (state.procrastinationTasks || []).find((t) => t.id === d.itemId);
      let completedWholeTask = true;
      let doneSubCount = 0;
      let totalSubCount = 0;

      if (task) {
        if (d.subtaskId && Array.isArray(task.subtasks)) {
          const sub = task.subtasks.find((s) => s.id === d.subtaskId);
          if (sub) {
            sub.done = true;
          }
          totalSubCount = task.subtasks.length;
          doneSubCount = task.subtasks.filter((s) => s.done).length;
          completedWholeTask = totalSubCount === 0 || doneSubCount >= totalSubCount;
          if (completedWholeTask) {
            task.doneToday = true;
          }
        } else {
          task.doneToday = true;
        }
      }

      state.activeDecision = null;
      saveState();

      if (completedWholeTask) {
        trackAnalyticsEvent("procrastination_completed", {
          from_active_decision: true
        });
        renderAll();
        triggerBigProcrastinationCelebration(e.currentTarget);
        showToast(`🎉 Finally tackled "${(task && task.title) || d.title}"! It'll vanish tomorrow!`);
      } else {
        renderAll();
        spawnConfettiBurst(e.currentTarget, PROCRASTINATION_LIST_COLOR);
        showToast(`✓ Completed step "${d.title}"! (${doneSubCount}/${totalSubCount} done)`);
      }
      return;
    }
    const listColor = getListColor(d.listId, d.color || PALETTE[0]);
    logActivityCompletion(
      { id: d.itemId, title: d.title },
      { id: d.listId, name: d.listName, color: listColor },
      getLogicalTodayStr(),
      e.currentTarget
    );
  });

  // About Modal Actions
  const aboutBtn = document.getElementById("btn-about");
  const aboutFooterBtn = document.getElementById("btn-about-footer");
  const aboutCloseBtn = document.getElementById("btn-about-close");
  const aboutModalEl = document.getElementById("modal-about");
  if (aboutBtn) aboutBtn.addEventListener("click", openAboutModal);
  if (aboutFooterBtn) aboutFooterBtn.addEventListener("click", openAboutModal);
  if (aboutCloseBtn) aboutCloseBtn.addEventListener("click", closeAboutModal);

  const checkUpdatesBtn = document.getElementById("btn-check-updates");
  const checkUpdatesFooterBtn = document.getElementById("btn-check-updates-footer");
  if (checkUpdatesBtn) checkUpdatesBtn.addEventListener("click", checkForAppUpdates);
  if (checkUpdatesFooterBtn) checkUpdatesFooterBtn.addEventListener("click", checkForAppUpdates);
  if (aboutModalEl) {
    aboutModalEl.addEventListener("click", (e) => {
      if (e.target === aboutModalEl) closeAboutModal();
    });
  }

  // Confirmation Pop-up Modal Actions
  document.getElementById("btn-confirm-cancel").addEventListener("click", closeConfirmModal);
  document.getElementById("btn-confirm-accept").addEventListener("click", () => {
    if (typeof pendingConfirmAction === "function") {
      pendingConfirmAction();
    }
    closeConfirmModal();
  });

  // Smart Check All / Uncheck All Toggle
  const toggleCheckAllBtn = document.getElementById("btn-toggle-check-all");
  if (toggleCheckAllBtn) {
    toggleCheckAllBtn.addEventListener("click", () => {
      const activeList = getActiveList();
      const anyChecked = activeList.items.some((i) => i.checked);
      activeList.items.forEach((i) => (i.checked = !anyChecked));
      saveState();
      renderAll();
    });
  }

  // Edit Mode Toggles for Activity List & Daily Tasks
  const editActivitiesBtn = document.getElementById("btn-edit-activities");
  if (editActivitiesBtn) {
    editActivitiesBtn.addEventListener("click", () => {
      isEditingActivities = !isEditingActivities;
      renderActivityPool();
    });
  }

  const editDailyBtn = document.getElementById("btn-edit-daily");
  if (editDailyBtn) {
    editDailyBtn.addEventListener("click", () => {
      isEditingDailyTasks = !isEditingDailyTasks;
      renderDailyTasks();
    });
  }

  // Collapsible Card Toggles (entire card header is clickable)
  const bindCollapsibleHeader = (cardId, stateKey) => {
    const cardEl = document.getElementById(cardId);
    if (!cardEl) return;
    const headerEl = cardEl.querySelector(":scope > .section-header, :scope > .inspector-header");
    if (!headerEl) return;
    headerEl.classList.add("is-collapsible-header");
    headerEl.addEventListener("click", (e) => {
      if (e.target.closest("button:not(.btn-collapse-toggle), a, input")) return;
      state.collapsedCards[stateKey] = !state.collapsedCards[stateKey];
      saveState();
      renderCollapsibleCards();
    });
  };

  bindCollapsibleHeader("pool-card", "activityLists");
  bindCollapsibleHeader("daily-tasks-card", "dailyTasks");
  bindCollapsibleHeader("scheduled-tasks-card", "scheduledTasks");
  bindCollapsibleHeader("procrastination-card", "procrastination");
  bindCollapsibleHeader("insights-card", "insights");

  const editProcrastinationBtn = document.getElementById("btn-edit-procrastination");
  if (editProcrastinationBtn) {
    editProcrastinationBtn.addEventListener("click", () => {
      isEditingProcrastination = !isEditingProcrastination;
      renderProcrastinationList();
    });
  }

  const addProcrastinationBtn = document.getElementById("btn-add-procrastination");
  if (addProcrastinationBtn) {
    addProcrastinationBtn.addEventListener("click", () => {
      openInputModal({
        title: "Add Procrastination Task",
        label: "Task Name",
        initialValue: "",
        placeholder: "e.g., Clean out garage, File taxes, Fix squeaky door...",
        saveLabel: "Add Task",
        showSubtasksEditor: true,
        showAddAnother: true,
        onSave: (title, _color, _weight, subtasks = []) => {
          checkAndPerformDailyReset(false);
          if (!Array.isArray(state.procrastinationTasks)) state.procrastinationTasks = [];
          const newTask = {
            id: uid("procrast"),
            title,
            doneToday: false
          };
          if (Array.isArray(subtasks) && subtasks.length > 0) {
            newTask.subtasks = subtasks.map((subTitle) => ({
              id: uid("sub"),
              title: subTitle,
              done: false
            }));
          }
          state.procrastinationTasks.push(newTask);
          saveState();
          trackAnalyticsEvent("procrastination_added");
          renderAll();
          showToast(`Added "${title}" to Procrastination List`);
        }
      });
    });
  }

  // To-Do & Schedule: View Switcher, Edit Mode, and Add/Edit Modal Events
  const schedViewTodayBtn = document.getElementById("btn-sched-view-today");
  if (schedViewTodayBtn) {
    schedViewTodayBtn.addEventListener("click", () => {
      scheduledViewMode = "today";
      renderScheduledTasks();
    });
  }

  const schedViewUpcomingBtn = document.getElementById("btn-sched-view-upcoming");
  if (schedViewUpcomingBtn) {
    schedViewUpcomingBtn.addEventListener("click", () => {
      scheduledViewMode = "upcoming";
      renderScheduledTasks();
    });
  }

  const editScheduledBtn = document.getElementById("btn-edit-scheduled");
  if (editScheduledBtn) {
    editScheduledBtn.addEventListener("click", () => {
      isEditingScheduledTasks = !isEditingScheduledTasks;
      renderScheduledTasks();
    });
  }

  const addScheduledBtn = document.getElementById("btn-add-scheduled");
  if (addScheduledBtn) {
    addScheduledBtn.addEventListener("click", () => {
      openScheduledTaskModal(null);
    });
  }

  const schedTypeGroup = document.getElementById("sched-type-group");
  if (schedTypeGroup) {
    schedTypeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sched-type]");
      if (btn) setScheduledModalType(btn.dataset.schedType);
    });
  }

  const schedFreqGroup = document.getElementById("sched-freq-group");
  if (schedFreqGroup) {
    schedFreqGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sched-freq]");
      if (btn) setScheduledModalFreq(btn.dataset.schedFreq);
    });
  }

  const schedWeekdayPills = document.getElementById("sched-weekday-pills");
  if (schedWeekdayPills) {
    schedWeekdayPills.addEventListener("click", (e) => {
      const btn = e.target.closest(".weekday-pill-btn");
      if (!btn) return;
      const next = !btn.classList.contains("is-selected");
      btn.classList.toggle("is-selected", next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
    });
  }

  const schedTodayBtn = document.getElementById("btn-sched-today");
  if (schedTodayBtn) {
    schedTodayBtn.addEventListener("click", () => {
      const dateInput = document.getElementById("input-scheduled-date");
      if (dateInput) dateInput.value = getLogicalTodayStr();
    });
  }

  const schedTomorrowBtn = document.getElementById("btn-sched-tomorrow");
  if (schedTomorrowBtn) {
    schedTomorrowBtn.addEventListener("click", () => {
      const dateInput = document.getElementById("input-scheduled-date");
      if (dateInput) dateInput.value = getAdjacentDateStr(getLogicalTodayStr(), 1);
    });
  }

  const schedCancelBtn = document.getElementById("btn-sched-modal-cancel");
  if (schedCancelBtn) {
    schedCancelBtn.addEventListener("click", closeScheduledTaskModal);
  }

  const schedModalBackdrop = document.getElementById("modal-scheduled-task");
  if (schedModalBackdrop) {
    schedModalBackdrop.addEventListener("click", (e) => {
      if (e.target === schedModalBackdrop) closeScheduledTaskModal();
    });
  }

  const saveScheduledTaskFromModal = ({ closeAfter = true } = {}) => {
    const titleInput = document.getElementById("input-scheduled-title");
    const title = titleInput ? titleInput.value.trim() : "";
    if (!title) {
      if (titleInput) {
        titleInput.reportValidity();
        titleInput.focus();
      }
      return false;
    }

    const selectedTypeBtn = document.querySelector("#sched-type-group .weight-pill-btn.is-selected");
    const type = selectedTypeBtn ? selectedTypeBtn.dataset.schedType : "once";
    const todayStr = getLogicalTodayStr();

    let dueDate = todayStr;
    let repeatRule = null;

    if (type === "once") {
      const dateInput = document.getElementById("input-scheduled-date");
      dueDate = (dateInput && dateInput.value) || todayStr;
    } else {
      const selectedFreqBtn = document.querySelector("#sched-freq-group .weight-pill-btn.is-selected");
      const freq = selectedFreqBtn ? selectedFreqBtn.dataset.schedFreq : "weekly";
      if (freq === "monthly") {
        const monthdayInput = document.getElementById("input-scheduled-monthday");
        const monthDay = Math.min(31, Math.max(1, Number(monthdayInput && monthdayInput.value) || 1));
        repeatRule = { freq: "monthly", weekdays: [], monthDay };
      } else {
        const weekdays = Array.from(
          document.querySelectorAll("#sched-weekday-pills .weekday-pill-btn.is-selected")
        ).map((btn) => Number(btn.dataset.weekday));
        if (weekdays.length === 0) {
          showToast("Please select at least one day of the week.");
          return false;
        }
        repeatRule = { freq: "weekly", weekdays, monthDay: 1 };
      }
    }

    checkAndPerformDailyReset(false);
    if (!Array.isArray(state.scheduledTasks)) state.scheduledTasks = [];

    if (editingScheduledTaskId) {
      const existing = state.scheduledTasks.find((t) => t.id === editingScheduledTaskId);
      if (existing) {
        existing.title = title;
        existing.type = type;
        if (type === "once") {
          existing.dueDate = dueDate;
          delete existing.repeatRule;
        } else {
          existing.repeatRule = repeatRule;
          delete existing.dueDate;
          if (!existing.createdAt) existing.createdAt = todayStr;
        }
      }
      showToast(`Updated task "${title}"`);
    } else {
      const newTask = {
        id: uid("sched"),
        title,
        type,
        completedDates: {},
        createdAt: todayStr
      };
      if (type === "once") {
        newTask.dueDate = dueDate;
      } else {
        newTask.repeatRule = repeatRule;
      }
      state.scheduledTasks.push(newTask);
      trackAnalyticsEvent("todo_added", { task_type: type });
      showToast(`Added task "${title}"`);
    }

    evaluateTodayDailyStar(false);
    saveState();
    if (closeAfter) {
      closeScheduledTaskModal();
    } else if (titleInput) {
      titleInput.value = "";
      titleInput.focus();
    }
    renderScheduledTasks();
    renderDailyTasks();
    renderCalendar();
    renderDayInspector();
    renderStatsAndInsights();
    return true;
  };

  const schedAddAnotherBtn = document.getElementById("btn-sched-modal-add-another");
  if (schedAddAnotherBtn) {
    schedAddAnotherBtn.addEventListener("click", () => {
      saveScheduledTaskFromModal({ closeAfter: false });
    });
  }

  const schedForm = document.getElementById("form-modal-scheduled");
  if (schedForm) {
    schedForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveScheduledTaskFromModal({ closeAfter: true });
    });
  }

  // Add New Activity Modal Trigger
  const addActivityBtn = document.getElementById("btn-add-activity");
  if (addActivityBtn) {
    addActivityBtn.addEventListener("click", () => {
      const activeList = getActiveList();
      openInputModal({
        title: `Add to ${activeList.name}`,
        label: "Activity Name",
        placeholder: "e.g. Read 20 pages",
        maxLength: 80,
        saveLabel: "Add",
        showWeightPicker: true,
        initialWeight: 1,
        showAddAnother: true,
        onSave: (title, _color, weight) => {
          const currentList = getActiveList();
          currentList.items.push({
            id: uid("item"),
            title,
            checked: true,
            weight: normalizeWeight(weight)
          });
          saveState();
          trackAnalyticsEvent("activity_added");
          renderListTabs();
          renderActivityPool();
          renderDecisionCard();
          showToast(`Added "${title}"`);
        }
      });
    });
  }

  // Add New Daily Task Modal Trigger
  const addDailyBtn = document.getElementById("btn-add-daily");
  if (addDailyBtn) {
    addDailyBtn.addEventListener("click", () => {
      openInputModal({
        title: "Add Daily Task",
        label: "Task Name",
        placeholder: "e.g. Drink 2L water",
        maxLength: 60,
        saveLabel: "Add",
        showAddAnother: true,
        onSave: (title) => {
          checkAndPerformDailyReset(false);
          state.dailyTasks.push({
            id: uid("daily"),
            title,
            doneToday: false
          });
          evaluateTodayDailyStar(false);
          saveState();
          trackAnalyticsEvent("daily_added");
          renderDailyTasks();
          renderCalendar();
          renderDayInspector();
          renderStatsAndInsights();
          showToast(`Added daily task "${title}"`);
        }
      });
    });
  }

  // Quick-Log Drawer Toggle in Selected Date Inspector
  const quickLogDrawer = document.getElementById("quick-log-drawer");
  const toggleQuickLogBtn = document.getElementById("btn-toggle-quick-log");
  const closeQuickLogBtn = document.getElementById("btn-close-quick-log");

  toggleQuickLogBtn.addEventListener("click", () => {
    quickLogDrawer.classList.toggle("hidden");
  });

  closeQuickLogBtn.addEventListener("click", () => {
    quickLogDrawer.classList.add("hidden");
  });

  // Daily Note / Highlight Form & Clear button
  const dailyNoteForm = document.getElementById("form-daily-note");
  const dailyNoteInput = document.getElementById("input-daily-note");
  const clearDailyNoteBtn = document.getElementById("btn-clear-daily-note");

  const saveDailyNoteForSelectedDate = (showNotification = true) => {
    if (!dailyNoteInput) return;
    if (!state.dailyNotesByDate || typeof state.dailyNotesByDate !== "object") {
      state.dailyNotesByDate = {};
    }
    const trimmed = dailyNoteInput.value.trim();
    const prev = state.dailyNotesByDate[selectedDateStr] || "";
    if (trimmed) {
      state.dailyNotesByDate[selectedDateStr] = trimmed;
      saveState();
      renderCalendar();
      renderDayInspector();
      if (showNotification && trimmed !== prev) {
        showToast(`📝 Saved note for ${selectedDateStr}`);
      }
    } else if (prev) {
      delete state.dailyNotesByDate[selectedDateStr];
      saveState();
      renderAll();
      if (showNotification) {
        showToast(`Removed note for ${selectedDateStr}`);
      }
    }
  };

  if (dailyNoteForm) {
    dailyNoteForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveDailyNoteForSelectedDate(true);
      if (dailyNoteInput) dailyNoteInput.blur();
    });
  }

  if (clearDailyNoteBtn) {
    clearDailyNoteBtn.addEventListener("click", () => {
      if (dailyNoteInput) dailyNoteInput.value = "";
      if (state.dailyNotesByDate && state.dailyNotesByDate[selectedDateStr]) {
        delete state.dailyNotesByDate[selectedDateStr];
        saveState();
        renderCalendar();
        renderDayInspector();
        showToast(`Cleared note for ${selectedDateStr}`);
      }
    });
  }

  // Input / Rename Pop-up Modal (Create List, Rename List, Rename Activity, Rename Daily Task)
  const listNameInput = document.getElementById("input-list-name");

  document.getElementById("btn-new-list").addEventListener("click", () => {
    const defaultColor = PALETTE[state.lists.length % PALETTE.length];
    openInputModal({
      title: "Create New List",
      label: "List Name",
      initialValue: "",
      placeholder: "e.g., 15 Min Quick Wins, Weekend Deep Dive...",
      showColorPicker: true,
      initialColor: defaultColor,
      onSave: (name, color) => {
        const newList = { id: uid("list"), name, color, items: [] };
        state.lists.push(newList);
        state.activeListId = newList.id;
        saveState();
        trackAnalyticsEvent("list_created");
        renderAll();
        showToast(`Created list "${name}"`);
      }
    });
  });

  document.getElementById("btn-rename-list").addEventListener("click", () => {
    const activeList = getActiveList();
    openInputModal({
      title: "Rename List",
      label: "List Name",
      initialValue: activeList.name,
      placeholder: "Enter list name...",
      showColorPicker: true,
      initialColor: activeList.color || PALETTE[0],
      onSave: (name, color) => {
        activeList.name = name;
        activeList.color = color;
        if (state.activeDecision && state.activeDecision.listId === activeList.id) {
          state.activeDecision.listName = name;
        }
        syncListColorReferences(activeList);
        saveState();
        renderAll();
        showToast(`Updated list "${name}"`);
      }
    });
  });

  document.getElementById("btn-modal-cancel").addEventListener("click", closeInputModal);

  const modalWeightsGroup = document.getElementById("modal-list-weights");
  if (modalWeightsGroup) {
    modalWeightsGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".weight-pill-btn");
      if (!btn) return;
      setModalWeight(btn.dataset.weight);
    });
  }

  const modalSubtaskInput = document.getElementById("input-modal-subtask");
  const modalAddSubtaskBtn = document.getElementById("btn-modal-add-subtask");
  const modalSubtasksListEl = document.getElementById("modal-subtasks-list");

  if (modalAddSubtaskBtn) {
    modalAddSubtaskBtn.addEventListener("click", addPendingModalSubtask);
  }
  if (modalSubtaskInput) {
    modalSubtaskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPendingModalSubtask();
      }
    });
  }
  if (modalSubtasksListEl) {
    modalSubtasksListEl.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".modal-subtask-remove");
      if (!removeBtn) return;
      const idx = Number(removeBtn.dataset.subtaskIndex);
      if (Number.isInteger(idx) && idx >= 0 && idx < pendingModalSubtasks.length) {
        pendingModalSubtasks.splice(idx, 1);
        renderModalSubtasksList();
      }
    });
  }

  const addAnotherBtn = document.getElementById("btn-modal-add-another");
  if (addAnotherBtn) {
    addAnotherBtn.addEventListener("click", () => {
      const name = listNameInput.value.trim();
      if (!name) {
        listNameInput.reportValidity();
        listNameInput.focus();
        return;
      }
      const subtasks = collectPendingModalSubtasks();
      if (typeof pendingInputAction === "function") {
        pendingInputAction(name, selectedListModalColor, selectedModalWeight, subtasks);
      }
      listNameInput.value = "";
      pendingModalSubtasks = [];
      renderModalSubtasksList();
      listNameInput.focus();
    });
  }

  document.getElementById("form-modal-list").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = listNameInput.value.trim();
    if (!name) return;

    const subtasks = collectPendingModalSubtasks();
    if (typeof pendingInputAction === "function") {
      pendingInputAction(name, selectedListModalColor, selectedModalWeight, subtasks);
    }
    closeInputModal();
  });

  document.getElementById("btn-delete-list").addEventListener("click", () => {
    if (state.lists.length <= 1) return;
    const activeList = getActiveList();
    openConfirmModal(
      "Delete List",
      `Are you sure you want to delete list "${activeList.name}" and its items? (Past calendar logs will be kept)`,
      () => {
        recordDeletedIds(
          activeList.id,
          ...(activeList.items || []).map((i) => i.id)
        );
        state.lists = state.lists.filter((l) => l.id !== activeList.id);
        state.activeListId = state.lists[0].id;
        if (state.activeDecision && state.activeDecision.listId === activeList.id) {
          state.activeDecision = null;
        }
        saveState();
        renderAll();
        showToast(`Deleted list "${activeList.name}"`);
      }
    );
  });

  // Calendar View Switcher (Month vs Week)
  document.getElementById("btn-view-month").addEventListener("click", () => {
    state.calendarView = "month";
    const selObj = parseLocalDateStr(selectedDateStr);
    calYear = selObj.getFullYear();
    calMonth = selObj.getMonth();
    saveState();
    renderCalendar();
    renderDayInspector();
  });

  document.getElementById("btn-view-week").addEventListener("click", () => {
    state.calendarView = "week";
    saveState();
    renderCalendar();
    renderDayInspector();
  });

  // Calendar Navigation
  document.getElementById("btn-cal-prev").addEventListener("click", () => {
    if (state.calendarView === "week") {
      const d = parseLocalDateStr(selectedDateStr);
      d.setDate(d.getDate() - 7);
      selectedDateStr = toLocalDateStr(d);
      calYear = d.getFullYear();
      calMonth = d.getMonth();
    } else {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
    }
    renderCalendar();
    renderDayInspector();
  });

  document.getElementById("btn-cal-next").addEventListener("click", () => {
    if (state.calendarView === "week") {
      const d = parseLocalDateStr(selectedDateStr);
      d.setDate(d.getDate() + 7);
      selectedDateStr = toLocalDateStr(d);
      calYear = d.getFullYear();
      calMonth = d.getMonth();
    } else {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
    }
    renderCalendar();
    renderDayInspector();
  });

  document.getElementById("btn-cal-today").addEventListener("click", () => {
    const logicalToday = getLogicalTodayDate();
    calYear = logicalToday.getFullYear();
    calMonth = logicalToday.getMonth();
    selectedDateStr = getLogicalTodayStr();
    renderCalendar();
    renderDayInspector();
  });

  // Delete Local Data & Reset to Defaults
  const handleResetData = () => {
    openConfirmModal(
      "Delete Local Data & Reset",
      "Are you sure you want to delete all local data (custom lists, calendar history, re-rolls, and daily stars) and restore default settings?",
      () => {
        localStorage.removeItem(STORAGE_KEY);
        state = createDefaultState();
        state.resetAt = Date.now();
        const logicalToday = getLogicalTodayDate();
        calYear = logicalToday.getFullYear();
        calMonth = logicalToday.getMonth();
        selectedDateStr = getLogicalTodayStr();
        saveState();
        renderAll();
        showToast("Local data deleted — all settings and defaults refreshed!");
      }
    );
  };

  document.getElementById("btn-reset-data").addEventListener("click", handleResetData);
  const footerResetBtn = document.getElementById("btn-reset-data-footer");
  if (footerResetBtn) {
    footerResetBtn.addEventListener("click", handleResetData);
  }

  // Delete Logged-In Account & Cloud Data
  const handleDeleteAccount = () => {
    openConfirmModal(
      "Delete Account & Cloud Data",
      "Are you sure you want to permanently delete your account, all cloud-synced data, and local data? This cannot be undone.",
      () => {
        window.DecideForMeCloud?.deleteAccount();
      }
    );
  };

  const deleteAccountBtn = document.getElementById("btn-delete-account");
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", handleDeleteAccount);
  }
  const footerDeleteAccountBtn = document.getElementById("btn-delete-account-footer");
  if (footerDeleteAccountBtn) {
    footerDeleteAccountBtn.addEventListener("click", handleDeleteAccount);
  }

  // Watch for 3:00 AM daily rollover while tab is open or refocused
  window.addEventListener("focus", () => checkAndPerformDailyReset(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkAndPerformDailyReset(true);
    }
  });
  setInterval(() => checkAndPerformDailyReset(true), 30000);
}

// PWA Service Worker & Install App Prompt
let deferredInstallPrompt = null;
let isCheckingForUpdates = false;

async function checkForAppUpdates() {
  if (isCheckingForUpdates) return;

  if (!("serviceWorker" in navigator)) {
    showToast("Updates are not supported in this browser.");
    return;
  }

  if (!navigator.onLine) {
    showToast("You're offline — connect to the internet to check for updates.");
    return;
  }

  isCheckingForUpdates = true;
  showToast("Checking for updates...");

  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register("./sw.js", {
        updateViaCache: "none",
      });
    }

    const triggerReload = () => {
      showToast("Update found! Reloading...");
      setTimeout(() => window.location.reload(), 800);
    };

    if (registration.waiting) {
      triggerReload();
      return;
    }

    let updateFound = false;
    const onUpdateFound = () => {
      updateFound = true;
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated") {
          triggerReload();
        } else if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          triggerReload();
        } else if (newWorker.state === "redundant") {
          showToast("Update check failed. Please try again.");
        }
      });
    };

    registration.addEventListener("updatefound", onUpdateFound, { once: true });
    await registration.update();

    if (!updateFound && !registration.installing && !registration.waiting) {
      registration.removeEventListener("updatefound", onUpdateFound);

      if (!("caches" in window)) {
        showToast("You're on the latest version!");
        return;
      }

      const coreAssets = [
        "./index.html",
        "./styles.css",
        "./app.js",
        "./firebase-sync.js",
        "./manifest.json"
      ];

      const fetched = await Promise.all(
        coreAssets.map(async (url) => {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.status}`);
          }
          const text = await res.clone().text();
          return { url, res, text };
        })
      );

      let hasAssetChanges = false;
      for (const { url, text } of fetched) {
        const cached = await caches.match(url);
        if (!cached || (await cached.text()) !== text) {
          hasAssetChanges = true;
          break;
        }
      }

      if (!hasAssetChanges) {
        showToast("You're on the latest version!");
        return;
      }

      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            await Promise.all(
              fetched.map(async ({ url, res }) => {
                await cache.put(url, res.clone());
                if (url === "./index.html") {
                  await cache.put("./", res.clone());
                }
              })
            );
          })
        );
      }

      triggerReload();
    }
  } catch (err) {
    console.warn("Update check failed:", err);
    showToast("Update server is offline. Please ask me about it.");
  } finally {
    isCheckingForUpdates = false;
  }
}

function initPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js", { updateViaCache: "none" })
        .catch((err) => {
          console.warn("Service worker registration skipped or failed:", err);
        });
    });
  }

  const installBtn = document.getElementById("btn-install-pwa");
  if (!installBtn) return;

  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobileOrTablet =
    isIos ||
    /Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia("(pointer: coarse)").matches);
  const isStandalone =
    Boolean(window.navigator.standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;

  const iosInstallModal = document.getElementById("modal-ios-install");
  const iosInstallCloseBtn = document.getElementById("btn-ios-install-close");

  if (isIos && !isStandalone) {
    installBtn.classList.remove("hidden");
  }

  if (iosInstallModal && iosInstallCloseBtn) {
    iosInstallCloseBtn.addEventListener("click", () => {
      iosInstallModal.classList.add("hidden");
    });
    iosInstallModal.addEventListener("click", (e) => {
      if (e.target === iosInstallModal) {
        iosInstallModal.classList.add("hidden");
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    if (!isMobileOrTablet) return;
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") {
        installBtn.classList.add("hidden");
        showToast("Installing DecideForMe...");
      }
      deferredInstallPrompt = null;
      return;
    }

    if (isIos && !isStandalone && iosInstallModal) {
      iosInstallModal.classList.remove("hidden");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
    trackAnalyticsEvent("pwa_installed");
    showToast("DecideForMe installed! You can now launch it offline anytime.");
  });
}

// Expose state hooks for Firebase cloud sync
window.DecideForMeApp = {
  getState: () => state,
  applyCloudState: (nextState) => {
    const prevLocal = state;
    const mergedNext = {
      ...JSON.parse(JSON.stringify(nextState)),
      collapsedCards: prevLocal?.collapsedCards,
      activeDecision: prevLocal?.activeDecision,
      activeListId: prevLocal?.activeListId,
      calendarView: prevLocal?.calendarView
    };
    state = normalizeLoadedState(mergedNext);
    state.lists.forEach(syncListColorReferences);
    checkAndPerformDailyReset(false);
    saveState(true);
    applyTheme();
    renderAll();
  },
  resetToDefaultState: () => {
    localStorage.removeItem(STORAGE_KEY);
    state = createDefaultState();
    const logicalToday = getLogicalTodayDate();
    calYear = logicalToday.getFullYear();
    calMonth = logicalToday.getMonth();
    selectedDateStr = getLogicalTodayStr();
    saveState(true);
    applyTheme();
    renderAll();
  },
  showToast
};

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  checkAndPerformDailyReset(false);
  initEvents();
  initPwa();
  renderAll();
});
