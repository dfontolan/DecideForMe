/**
 * DecideForMe — Local-First Activity Picker & Habit Logger
 */

const STORAGE_KEY = "decideForMe_state_v1";
const WEIGHT_STEPS = [1, 2, 4];
const DAILY_RESET_HOUR = 3; // 3:00 AM local time daily reset
const ROLL_DURATION_MS = 3000; // Total roll animation duration in milliseconds (change this single number to speed up or slow down)
const STREAK_FREEZE_INTERVAL = 3; // Consecutive active streak days required to earn +1 Streak Freeze
const MAX_STREAK_FREEZES = 3; // Maximum Streak Freezes a user can hold at once

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
    activeDecision: null,
    lastDailyResetDate: getLogicalTodayStr(),
    rerollsByDate: {}, // { "YYYY-MM-DD": number }
    dailyTasks: createDefaultDailyTasks(),
    dailyStarsByDate: {}, // { "YYYY-MM-DD": true }
    dailyNotesByDate: {}, // { "YYYY-MM-DD": string }
    lists: createDefaultLists(),
    logs: []
  };
}

// Application Runtime State
let state = loadState();
let selectedListModalColor = PALETTE[0];
let isRolling = false;
let completingDecisionSnapshot = null;
let completingDecisionTimers = [];
let winnerAuraTimer = null;
let modalMode = "create"; // "create" | "rename"
let draggedListId = null;
let draggedItemId = null;
let draggedDailyId = null;
let quickLogFilterListId = "ALL";
let pendingConfirmAction = null;
let pendingInputAction = null;
let isEditingActivities = false;
let isEditingDailyTasks = false;

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lists) || parsed.lists.length === 0) {
      return createDefaultState();
    }
    parsed.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
    parsed.theme = parsed.theme || "dark";
    parsed.calendarView = parsed.calendarView === "week" ? "week" : "month";
    parsed.rerollsByDate =
      parsed.rerollsByDate && typeof parsed.rerollsByDate === "object"
        ? parsed.rerollsByDate
        : {};
    parsed.dailyTasks = Array.isArray(parsed.dailyTasks)
      ? parsed.dailyTasks
      : createDefaultDailyTasks();
    parsed.dailyStarsByDate =
      parsed.dailyStarsByDate && typeof parsed.dailyStarsByDate === "object"
        ? parsed.dailyStarsByDate
        : {};
    parsed.dailyNotesByDate =
      parsed.dailyNotesByDate && typeof parsed.dailyNotesByDate === "object"
        ? parsed.dailyNotesByDate
        : {};

    if (parsed.templateVersion !== TEMPLATE_VERSION) {
      parsed.lists = createDefaultLists();
      parsed.templateVersion = TEMPLATE_VERSION;
      parsed.activeDecision = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    normalizeLists(parsed.lists);
    if (!parsed.lists.some((l) => l.id === parsed.activeListId)) {
      parsed.activeListId = parsed.lists[0].id;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to load state from localStorage:", err);
    return createDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save state:", err);
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
function computeStreakAndFreezes(nowObj = new Date()) {
  const requireDailyStar = state.dailyTasks.length > 0;
  const qualifyingDates = Array.from(
    new Set(
      state.logs
        .map((l) => l.date)
        .filter((dStr) => !requireDailyStar || Boolean(state.dailyStarsByDate[dStr]))
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

  if (allDailyTasksDone) {
    state.dailyStarsByDate[todayStr] = true;
    if (!hadDailyTasksDone && announceIfEarned) {
      if (hasActivityLoggedToday) {
        showToast("⭐ Gold Daily Star earned! All Daily Tasks + Activity completed today!");
      } else {
        showToast("★ Silver Star earned! Complete an activity today to upgrade to a Gold Star & streak!");
      }
    }
  } else {
    delete state.dailyStarsByDate[todayStr];
  }
}

function getActiveList() {
  return state.lists.find((l) => l.id === state.activeListId) || state.lists[0];
}

function getListColor(listId, fallback = PALETTE[0]) {
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

// Input / Rename Pop-up Modal
function openInputModal({
  title,
  label,
  initialValue = "",
  placeholder = "",
  showColorPicker = false,
  initialColor = PALETTE[0],
  onSave
}) {
  document.getElementById("modal-list-title").textContent = title;
  const labelEl = document.getElementById("modal-list-label");
  if (labelEl) labelEl.textContent = label;
  const inputEl = document.getElementById("input-list-name");
  inputEl.value = initialValue;
  inputEl.placeholder = placeholder;

  const colorSection = document.getElementById("modal-list-color-section");
  if (colorSection) {
    colorSection.classList.toggle("hidden", !showColorPicker);
    if (showColorPicker) {
      selectedListModalColor = PALETTE.includes(initialColor) ? initialColor : PALETTE[0];
      renderListModalColorPicker();
    }
  }

  pendingInputAction = onSave;
  document.getElementById("modal-list").classList.remove("hidden");
  inputEl.focus();
  inputEl.select();
}

function closeInputModal() {
  pendingInputAction = null;
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
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const nextIcon = state.theme === "dark" ? "☀️" : "🌙";
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.textContent = nextIcon;
  }
  const footerIcon = document.getElementById("theme-icon-footer");
  if (footerIcon) {
    footerIcon.textContent = nextIcon;
  }
  const metaThemeColor = document.getElementById("meta-theme-color");
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", state.theme === "dark" ? "#0f1117" : "#eaeef5");
  }
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
function renderHeroListSwitcherButtons(containerEl, activeList) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  state.lists.forEach((list) => {
    const isActive = list.id === activeList.id;
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
      ${isActive ? `<span class="hero-count-pill">${checkedCount}/${totalCount} ready</span>` : ""}
    `;
    btn.addEventListener("click", () => {
      if (isRolling) return;
      state.activeListId = list.id;
      saveState();
      renderAll();
    });
    containerEl.appendChild(btn);
  });
}

function renderDecisionCard() {
  const cardEl = document.getElementById("decision-card");
  const idleEl = document.getElementById("decision-idle");
  const rollingEl = document.getElementById("decision-rolling");
  const activeEl = document.getElementById("decision-active");

  const activeList = getActiveList();
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
          return `<span class="hero-candidate-chip" data-item-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.title)}</span>${weight > 1 ? `<span class="hero-chip-weight" data-weight="${weight}">${weight}x</span>` : ""}</span>`;
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
    cardEl.classList.remove("has-active-choice", "is-completing-win");
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
    idleEl.classList.add("hidden");
    rollingEl.classList.add("hidden");
    activeEl.classList.remove("hidden");

    const d = displayDecision;
    const chosenColor = getListColor(
      d.listId,
      d.color || PALETTE[0]
    );
    cardEl.style.setProperty("--hero-list-color", chosenColor);
    document.getElementById("chosen-color-dot").style.backgroundColor = chosenColor;
    activeEl.style.setProperty("--chosen-color", chosenColor);
    document.getElementById("chosen-title").textContent = d.title;
    document.getElementById("chosen-list-subtitle").textContent = `From list: ${d.listName}`;
    document.getElementById("chosen-probability-meta").textContent =
      `${d.weight}x weight • ${d.probabilityPct}% chance (${d.candidateCount} checked)`;

    if (completingDecisionSnapshot) {
      cardEl.classList.add("is-completing-win");
      activeEl.classList.add("is-win-hold");
      activeEl.classList.toggle("is-win-exit", completingDecisionSnapshot.phase === "exit");
      if (badgeChosenEl) {
        badgeChosenEl.textContent = "✓ Completed & Logged!";
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
        badgeChosenEl.textContent = "✨ Chosen Activity";
        badgeChosenEl.classList.remove("is-win-logged");
      }
      if (completeChosenBtn) {
        completeChosenBtn.classList.remove("is-win-hold");
        completeChosenBtn.innerHTML = `✓ Mark Complete &amp; Log`;
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
    cardEl.classList.remove("has-active-choice", "is-completing-win");
    activeEl.classList.remove("is-win-hold", "is-win-exit");
    if (badgeChosenEl) {
      badgeChosenEl.textContent = "✨ Chosen Activity";
      badgeChosenEl.classList.remove("is-win-logged");
    }
    if (completeChosenBtn) {
      completeChosenBtn.classList.remove("is-win-hold");
      completeChosenBtn.innerHTML = `✓ Mark Complete &amp; Log`;
    }
    idleEl.classList.remove("hidden");
    rollingEl.classList.add("hidden");
    activeEl.classList.add("hidden");
  }
}

// Render Activity Pool Items
function renderActivityPool() {
  const activeList = getActiveList();
  document.getElementById("current-list-title").textContent = activeList.name;
  const checkedCount = activeList.items.filter((i) => i.checked).length;
  const countBadge = document.getElementById("current-list-count-badge");
  if (countBadge) {
    countBadge.textContent = `${checkedCount}/${activeList.items.length}`;
  }
  const headerDot = document.getElementById("current-list-color-dot");
  if (headerDot) {
    headerDot.style.backgroundColor = activeList.color || PALETTE[0];
  }

  const listEl = document.getElementById("activity-list");
  listEl.style.setProperty("--active-list-color", activeList.color || PALETTE[0]);
  listEl.classList.toggle("is-editing", isEditingActivities);
  listEl.innerHTML = "";

  const editActivitiesBtn = document.getElementById("btn-edit-activities");
  const editActivitiesLabel = document.getElementById("btn-edit-activities-label");
  if (editActivitiesBtn) {
    editActivitiesBtn.classList.toggle("is-active", isEditingActivities);
    editActivitiesBtn.setAttribute("aria-pressed", isEditingActivities ? "true" : "false");
  }
  if (editActivitiesLabel) {
    editActivitiesLabel.textContent = isEditingActivities ? "Done" : "Edit";
  }

  if (activeList.items.length === 0) {
    listEl.innerHTML = `<li class="empty-state">No activities in this list yet. Add one above!</li>`;
    return;
  }

  const totalCheckedWeight = activeList.items
    .filter((i) => i.checked)
    .reduce((sum, i) => sum + normalizeWeight(i.weight), 0);

  const todayStr = getLogicalTodayStr();
  const completedTodayIds = new Set(
    state.logs.filter((l) => l.date === todayStr).map((l) => l.itemId)
  );

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
          ${doneToday ? `<span class="done-today-pill" title="Completed today" aria-label="Completed today">✓</span>` : ""}
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
          class="btn-icon log-direct-btn"
          title="Mark '${escapeHtml(item.title)}' as completed today"
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

    // Drag and Drop events for Task Reordering
    li.addEventListener("dragstart", (e) => {
      draggedItemId = item.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.id);
    });

    li.addEventListener("dragover", (e) => {
      if (!draggedItemId || draggedItemId === item.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (!draggedItemId || draggedItemId === item.id) return;

      const fromIdx = activeList.items.findIndex((i) => i.id === draggedItemId);
      const toIdx = activeList.items.findIndex((i) => i.id === item.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = activeList.items.splice(fromIdx, 1);
      activeList.items.splice(toIdx, 0, moved);
      draggedItemId = null;
      saveState();
      renderAll();
    });

    li.addEventListener("dragend", () => {
      draggedItemId = null;
      li.classList.remove("dragging");
      listEl.querySelectorAll(".activity-item").forEach((el) => el.classList.remove("drag-over"));
    });

    bindTouchReorder({
      gripEl: li.querySelector(".drag-grip"),
      itemEl: li,
      containerEl: listEl,
      itemSelector: ".activity-item",
      datasetKey: "itemId",
      sourceId: item.id,
      onReorder: (fromId, toId) => {
        const fromIdx = activeList.items.findIndex((i) => i.id === fromId);
        const toIdx = activeList.items.findIndex((i) => i.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = activeList.items.splice(fromIdx, 1);
        activeList.items.splice(toIdx, 0, moved);
        saveState();
        renderAll();
      }
    });

    // Checkbox toggle
    const checkbox = li.querySelector(".activity-checkbox");
    const titleSpan = li.querySelector(".activity-title");
    const toggleCheck = () => {
      item.checked = !item.checked;
      saveState();
      renderAll();
    };
    checkbox.addEventListener("change", toggleCheck);
    titleSpan.addEventListener("click", toggleCheck);

    // Cycle weight (1x -> 2x -> 4x -> 1x)
    li.querySelector(".weight-badge").addEventListener("click", () => {
      const currentIdx = WEIGHT_STEPS.indexOf(weight);
      item.weight = WEIGHT_STEPS[(currentIdx + 1) % WEIGHT_STEPS.length];
      saveState();
      renderAll();
    });

    // Direct log to today (also unchecks it for today)
    const logDirectBtn = li.querySelector(".log-direct-btn");
    logDirectBtn.addEventListener("click", () => {
      logActivityCompletion(item, activeList, getLogicalTodayStr(), logDirectBtn);
    });

    // Edit activity title with Pop-up Modal
    li.querySelector(".edit-item-btn").addEventListener("click", () => {
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
          renderAll();
          showToast(`Renamed activity to "${newTitle}"`);
        }
      });
    });

    // Delete item with Confirmation Pop-up
    li.querySelector(".delete-item-btn").addEventListener("click", () => {
      openConfirmModal(
        "Delete Activity",
        `Are you sure you want to delete "${item.title}" from "${activeList.name}"?`,
        () => {
          activeList.items = activeList.items.filter((i) => i.id !== item.id);
          if (state.activeDecision && state.activeDecision.itemId === item.id) {
            state.activeDecision = null;
          }
          saveState();
          renderAll();
          showToast(`Deleted "${item.title}"`);
        }
      );
    });

    listEl.appendChild(li);
  });
}

// Render Daily Tasks Card (Right Column)
function renderDailyTasks() {
  const cardEl = document.getElementById("daily-tasks-card");
  const progressBadgeEl = document.getElementById("daily-tasks-progress-badge");
  const listEl = document.getElementById("daily-tasks-list");
  listEl.classList.toggle("is-editing", isEditingDailyTasks);
  listEl.innerHTML = "";

  const editDailyBtn = document.getElementById("btn-edit-daily");
  const editDailyLabel = document.getElementById("btn-edit-daily-label");
  if (editDailyBtn) {
    editDailyBtn.classList.toggle("is-active", isEditingDailyTasks);
    editDailyBtn.setAttribute("aria-pressed", isEditingDailyTasks ? "true" : "false");
  }
  if (editDailyLabel) {
    editDailyLabel.textContent = isEditingDailyTasks ? "Done" : "Edit";
  }

  const total = state.dailyTasks.length;
  const doneCount = state.dailyTasks.filter((t) => t.doneToday).length;
  const allDone = total > 0 && doneCount === total;
  const todayStr = getLogicalTodayStr();
  const hasActivityToday = state.logs.some((l) => l.date === todayStr);
  const hasGoldStarToday = allDone && hasActivityToday;
  const hasSilverStarToday = allDone && !hasActivityToday;

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
          ${task.doneToday ? `<span class="done-today-pill" title="Completed today" aria-label="Completed today">✓</span>` : ""}
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

    // Toggle doneToday
    const toggleDone = (e) => {
      checkAndPerformDailyReset(false);
      const prevStats = getStatsSnapshot();
      task.doneToday = !task.doneToday;
      if (task.doneToday) {
        spawnConfettiBurst(e && e.currentTarget ? e.currentTarget : li, "#eab308");
      }
      evaluateTodayDailyStar(true);
      saveState();
      renderAll();
      animateStatBumps(prevStats);
      announceFreezeIfEarned(prevStats.availableFreezes);
    };
    li.querySelector(".log-daily-btn").addEventListener("click", toggleDone);
    li.querySelector(".daily-task-title").addEventListener("click", toggleDone);

    // Drag and Drop reordering for Daily Tasks
    li.addEventListener("dragstart", (e) => {
      draggedDailyId = task.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    });

    li.addEventListener("dragover", (e) => {
      if (!draggedDailyId || draggedDailyId === task.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (!draggedDailyId || draggedDailyId === task.id) return;

      const fromIdx = state.dailyTasks.findIndex((t) => t.id === draggedDailyId);
      const toIdx = state.dailyTasks.findIndex((t) => t.id === task.id);
      if (fromIdx === -1 || toIdx === -1) return;

      const [moved] = state.dailyTasks.splice(fromIdx, 1);
      state.dailyTasks.splice(toIdx, 0, moved);
      draggedDailyId = null;
      saveState();
      renderAll();
    });

    li.addEventListener("dragend", () => {
      draggedDailyId = null;
      li.classList.remove("dragging");
      listEl.querySelectorAll(".daily-task-item").forEach((el) => el.classList.remove("drag-over"));
    });

    bindTouchReorder({
      gripEl: li.querySelector(".drag-grip"),
      itemEl: li,
      containerEl: listEl,
      itemSelector: ".daily-task-item",
      datasetKey: "dailyId",
      sourceId: task.id,
      onReorder: (fromId, toId) => {
        const fromIdx = state.dailyTasks.findIndex((t) => t.id === fromId);
        const toIdx = state.dailyTasks.findIndex((t) => t.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = state.dailyTasks.splice(fromIdx, 1);
        state.dailyTasks.splice(toIdx, 0, moved);
        saveState();
        renderAll();
      }
    });

    // Rename daily task with Pop-up Modal
    li.querySelector(".edit-daily-btn").addEventListener("click", () => {
      openInputModal({
        title: "Rename Daily Task",
        label: "Daily Task Name",
        initialValue: task.title,
        placeholder: "Enter daily task name...",
        onSave: (newTitle) => {
          task.title = newTitle;
          saveState();
          renderAll();
          showToast(`Renamed daily task to "${newTitle}"`);
        }
      });
    });

    // Delete daily task with Confirmation Pop-up
    li.querySelector(".delete-daily-btn").addEventListener("click", () => {
      openConfirmModal(
        "Delete Daily Task",
        `Are you sure you want to delete daily task "${task.title}"?`,
        () => {
          state.dailyTasks = state.dailyTasks.filter((t) => t.id !== task.id);
          evaluateTodayDailyStar(false);
          saveState();
          renderAll();
          showToast(`Deleted daily task "${task.title}"`);
        }
      );
    });

    listEl.appendChild(li);
  });
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

  const colors = [
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
    const w = isCircle ? 7 : 6 + Math.round(Math.random() * 5);
    const h = isCircle ? 7 : 4 + Math.round(Math.random() * 4);
    const dur = 1050 + Math.round(Math.random() * 400);
    const delay = Math.round(Math.random() * 90);
    const color = colors[i % colors.length];

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

  const activeList = getActiveList();
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

  const { item: chosen } = pickWeightedItem(candidates);
  const chosenWeight = normalizeWeight(chosen.weight);
  const probabilityPct = Math.round((chosenWeight / totalWeightAllChecked) * 100);
  const chosenListColor = activeList.color || PALETTE[0];
  const decisionPayload = {
    itemId: chosen.id,
    listId: activeList.id,
    listName: activeList.name,
    title: chosen.title,
    color: chosenListColor,
    weight: chosenWeight,
    probabilityPct,
    candidateCount: allCheckedCount,
    rerolls: nextRerollCount
  };

  if (allCheckedCount === 1) {
    state.activeDecision = decisionPayload;
    saveState();
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
        renderAll();
        triggerWinnerAura(chosenListColor);
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

  const wasSilverToday =
    dateStr === todayStr &&
    Boolean(state.dailyStarsByDate[todayStr]) &&
    state.logs.filter((l) => l.date === todayStr).length === 1;

  if (dateStr === todayStr) {
    evaluateTodayDailyStar(false);
  }

  saveState();
  spawnConfettiBurst(originEl, resolvedColor);
  renderAll();
  animateStatBumps(prevStats);
  if (wasSilverToday) {
    showToast(`Completed "${item.title}"! ★ Upgraded to Gold Daily Star!`);
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
      const hasDailyTasksDone = Boolean(state.dailyStarsByDate[dateStr]);
      const hasGoldStar = hasDailyTasksDone && dayLogs.length > 0;
      const hasSilverStar = hasDailyTasksDone && dayLogs.length === 0;
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

      row.innerHTML = `
        <div class="week-day-left">
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
        <div class="week-day-right">
          ${isStreakDay && streakDayNum > 0 ? `<span class="cal-done-tag" title="Qualifying Streak Day #${streakDayNum}">🔥 Day ${streakDayNum}</span>` : ""}
          ${isFrozen ? `<span class="cal-freeze-tag" title="Streak Freeze automatically used on ${dateStr}">❄️ Freeze</span>` : ""}
          ${hasGoldStar ? `<span class="cal-star-tag" title="Gold Star: All Daily Tasks + Activity completed on ${dateStr}">★</span>` : ""}
          ${hasSilverStar ? `<span class="cal-star-tag is-silver" title="Silver Star: All Daily Tasks completed on ${dateStr} (no activities logged)">★</span>` : ""}
          ${dayRerolls > 0 ? `<span class="cal-reroll-tag" title="${dayRerolls} re-roll${dayRerolls === 1 ? "" : "s"}">🎲 ${dayRerolls}</span>` : ""}
        </div>
      `;

      row.addEventListener("click", () => {
        selectedDateStr = dateStr;
        calYear = cellDate.getFullYear();
        calMonth = cellDate.getMonth();
        renderAll();
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
      const hasDailyTasksDone = Boolean(state.dailyStarsByDate[dateStr]);
      const hasGoldStar = hasDailyTasksDone && dayLogs.length > 0;
      const hasSilverStar = hasDailyTasksDone && dayLogs.length === 0;
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
        ${dayNote ? `<span class="cal-note-inline" aria-label="Daily note">📝</span>` : ""}
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
    renderAll();
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
  const hasDailyTasksDone = Boolean(state.dailyStarsByDate[selectedDateStr]);
  const hasGoldStar = hasDailyTasksDone && dayLogs.length > 0;
  const hasSilverStar = hasDailyTasksDone && dayLogs.length === 0;

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
      starBadgeEl.title = "All Daily Tasks + at least 1 Activity were completed on this date!";
    } else if (hasSilverStar) {
      starBadgeEl.textContent = "★ Silver Star";
      starBadgeEl.title = "All Daily Tasks were completed on this date (no activities logged).";
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

function renderAll() {
  applyTheme();
  renderListTabs();
  renderDecisionCard();
  renderActivityPool();
  renderDailyTasks();
  renderCalendar();
  renderDayInspector();
  renderStatsAndInsights();
}

// Wire Up Event Listeners
function initEvents() {
  // Theme toggle
  const handleToggleTheme = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState();
    applyTheme();
  };
  document.getElementById("btn-theme-toggle").addEventListener("click", handleToggleTheme);
  const footerThemeBtn = document.getElementById("btn-theme-toggle-footer");
  if (footerThemeBtn) {
    footerThemeBtn.addEventListener("click", handleToggleTheme);
  }

  // Decide For Me & Active Choice Actions
  document.getElementById("btn-decide").addEventListener("click", () => triggerDecisionRoll(false));
  document.getElementById("btn-reroll").addEventListener("click", () => triggerDecisionRoll(true));

  document.getElementById("btn-complete-chosen").addEventListener("click", (e) => {
    if (!state.activeDecision || completingDecisionSnapshot) return;
    const d = state.activeDecision;
    const listColor = getListColor(d.listId, d.color || PALETTE[0]);
    logActivityCompletion(
      { id: d.itemId, title: d.title },
      { id: d.listId, name: d.listName, color: listColor },
      getLogicalTodayStr(),
      e.currentTarget
    );
  });

  // Confirmation Pop-up Modal Actions
  document.getElementById("btn-confirm-cancel").addEventListener("click", closeConfirmModal);
  document.getElementById("btn-confirm-accept").addEventListener("click", () => {
    if (typeof pendingConfirmAction === "function") {
      pendingConfirmAction();
    }
    closeConfirmModal();
  });

  // Check All / Uncheck All
  document.getElementById("btn-check-all").addEventListener("click", () => {
    const activeList = getActiveList();
    activeList.items.forEach((i) => (i.checked = true));
    saveState();
    renderAll();
  });

  document.getElementById("btn-uncheck-all").addEventListener("click", () => {
    const activeList = getActiveList();
    activeList.items.forEach((i) => (i.checked = false));
    saveState();
    renderAll();
  });

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

  // Add New Activity Form
  document.getElementById("form-add-item").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("input-new-item");
    const weightSelect = document.getElementById("select-new-weight");
    const title = input.value.trim();
    if (!title) return;

    const activeList = getActiveList();
    activeList.items.push({
      id: uid("item"),
      title,
      checked: true,
      weight: normalizeWeight(weightSelect.value)
    });

    input.value = "";
    saveState();
    renderAll();
  });

  // Add New Daily Task Form
  document.getElementById("form-add-daily").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("input-new-daily");
    const title = input.value.trim();
    if (!title) return;

    checkAndPerformDailyReset(false);
    state.dailyTasks.push({
      id: uid("daily"),
      title,
      doneToday: false
    });
    input.value = "";
    evaluateTodayDailyStar(false);
    saveState();
    renderAll();
  });

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
      renderAll();
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
        renderAll();
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

  document.getElementById("form-modal-list").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = listNameInput.value.trim();
    if (!name) return;

    if (typeof pendingInputAction === "function") {
      pendingInputAction(name, selectedListModalColor);
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
    renderAll();
  });

  document.getElementById("btn-view-week").addEventListener("click", () => {
    state.calendarView = "week";
    saveState();
    renderAll();
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
    renderAll();
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
    renderAll();
  });

  document.getElementById("btn-cal-today").addEventListener("click", () => {
    const logicalToday = getLogicalTodayDate();
    calYear = logicalToday.getFullYear();
    calMonth = logicalToday.getMonth();
    selectedDateStr = getLogicalTodayStr();
    renderAll();
  });

  // Export Backup JSON
  const handleExportBackup = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decide-for-me-backup-${getLogicalTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup JSON exported!");
  };
  document.getElementById("btn-export").addEventListener("click", handleExportBackup);
  const footerExportBtn = document.getElementById("btn-export-footer");
  if (footerExportBtn) {
    footerExportBtn.addEventListener("click", handleExportBackup);
  }

  // Import Backup JSON
  const fileInput = document.getElementById("file-import");
  document.getElementById("btn-import").addEventListener("click", () => {
    fileInput.click();
  });
  const footerImportBtn = document.getElementById("btn-import-footer");
  if (footerImportBtn) {
    footerImportBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported || !Array.isArray(imported.lists) || imported.lists.length === 0) {
          alert("Invalid backup file format.");
          return;
        }
        normalizeLists(imported.lists);
        state = {
          templateVersion: TEMPLATE_VERSION,
          theme: imported.theme || "dark",
          calendarView: imported.calendarView === "week" ? "week" : "month",
          activeListId: imported.activeListId || imported.lists[0].id,
          activeDecision: null,
          lastDailyResetDate: imported.lastDailyResetDate || getLogicalTodayStr(),
          rerollsByDate:
            imported.rerollsByDate && typeof imported.rerollsByDate === "object"
              ? imported.rerollsByDate
              : {},
          dailyTasks: Array.isArray(imported.dailyTasks)
            ? imported.dailyTasks
            : createDefaultDailyTasks(),
          dailyStarsByDate:
            imported.dailyStarsByDate && typeof imported.dailyStarsByDate === "object"
              ? imported.dailyStarsByDate
              : {},
          dailyNotesByDate:
            imported.dailyNotesByDate && typeof imported.dailyNotesByDate === "object"
              ? imported.dailyNotesByDate
              : {},
          lists: imported.lists,
          logs: Array.isArray(imported.logs) ? imported.logs : []
        };
        state.lists.forEach(syncListColorReferences);
        checkAndPerformDailyReset(false);
        saveState();
        renderAll();
        showToast("Backup restored successfully!");
      } catch (err) {
        alert("Could not parse JSON backup file.");
      } finally {
        fileInput.value = "";
      }
    };
    reader.readAsText(file);
  });

  // Delete Local Data & Reset to Defaults
  const handleResetData = () => {
    openConfirmModal(
      "Delete Local Data & Reset",
      "Are you sure you want to delete all local data (custom lists, calendar history, re-rolls, and daily stars) and restore default settings?",
      () => {
        localStorage.removeItem(STORAGE_KEY);
        state = createDefaultState();
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

function initPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration skipped or failed:", err);
      });
    });
  }

  const installBtn = document.getElementById("btn-install-pwa");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      installBtn.classList.add("hidden");
      showToast("Installing DecideForMe...");
    }
    deferredInstallPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
    showToast("DecideForMe installed! You can now launch it offline anytime.");
  });
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  checkAndPerformDailyReset(false);
  initEvents();
  initPwa();
  renderAll();
});
