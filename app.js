const STORAGE_KEY = "daymark-data-v1";
const today = new Date();
const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const addDays = (count) => {
  const date = new Date();
  date.setDate(date.getDate() + count);
  return localDate(date);
};
const initialData = {
  lists: [
    { id: "work", name: "Work", color: "#df5945" },
    { id: "personal", name: "Personal", color: "#4f9184" },
    { id: "ideas", name: "Ideas", color: "#d3a842" },
  ],
  tasks: [
    { id: "seed-1", title: "Review the Q3 project notes", date: localDate(today), priority: "high", listId: "work", completed: false, createdAt: 1 },
    { id: "seed-2", title: "Send the updated timeline to Maya", date: localDate(today), priority: "normal", listId: "work", completed: false, createdAt: 2 },
    { id: "seed-3", title: "Take a proper lunch break", date: localDate(today), priority: "low", listId: "personal", completed: false, createdAt: 3 },
    { id: "seed-4", title: "Pick up a few things for dinner", date: addDays(1), priority: "normal", listId: "personal", completed: false, createdAt: 4 },
    { id: "seed-5", title: "Sketch out the weekend idea", date: addDays(2), priority: "normal", listId: "ideas", completed: false, createdAt: 5 },
  ],
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.tasks) && Array.isArray(saved.lists)) return saved;
  } catch (error) {
    console.warn("Could not load saved tasks.", error);
  }
  return structuredClone(initialData);
}

let data = loadData();
let view = "today";
let activeListId = "";
let activeFilter = "all";
let searchTerm = "";
let sortNewestFirst = false;
let toastTimer;

const elements = {
  dateLabel: document.querySelector("#date-label"),
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  breadcrumb: document.querySelector("#breadcrumb-view"),
  taskList: document.querySelector("#task-list"),
  taskInput: document.querySelector("#task-input"),
  taskDate: document.querySelector("#task-date"),
  taskPriority: document.querySelector("#task-priority"),
  taskListSelect: document.querySelector("#task-list-select"),
  customLists: document.querySelector("#custom-lists"),
  agendaList: document.querySelector("#agenda-list"),
  searchInput: document.querySelector("#search-input"),
  toast: document.querySelector("#toast"),
};

elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(today);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2100);
}

function dayOffset(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((target - start) / 86400000);
}

function formatDueDate(dateString) {
  const offset = dayOffset(dateString);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${dateString}T00:00:00`));
}

function visibleTasks() {
  let tasks = [...data.tasks];
  if (view === "today") tasks = tasks.filter((task) => !task.completed && (!task.date || task.date <= localDate(today)));
  if (view === "upcoming") tasks = tasks.filter((task) => !task.completed && task.date && task.date > localDate(today));
  if (view === "completed") tasks = tasks.filter((task) => task.completed);
  if (view === "list") tasks = tasks.filter((task) => task.listId === activeListId && !task.completed);
  if (activeFilter === "open") tasks = tasks.filter((task) => !task.completed);
  if (activeFilter === "priority") tasks = tasks.filter((task) => task.priority === "high");
  if (searchTerm) tasks = tasks.filter((task) => task.title.toLowerCase().includes(searchTerm.toLowerCase()));
  tasks.sort((a, b) => {
    const dateOrder = (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
    const priorityOrder = (a.priority === "high" ? 0 : a.priority === "normal" ? 1 : 2) - (b.priority === "high" ? 0 : b.priority === "normal" ? 1 : 2);
    if (sortNewestFirst) return b.createdAt - a.createdAt;
    return dateOrder || priorityOrder || a.createdAt - b.createdAt;
  });
  return tasks;
}

function renderSidebar() {
  const openTasks = data.tasks.filter((task) => !task.completed);
  document.querySelector("#today-count").textContent = openTasks.filter((task) => !task.date || task.date <= localDate(today)).length;
  elements.customLists.innerHTML = data.lists.map((list) => {
    const count = openTasks.filter((task) => task.listId === list.id).length;
    return `<button class="custom-list-item ${view === "list" && activeListId === list.id ? "active" : ""}" data-list-id="${escapeHtml(list.id)}" type="button"><span class="list-color" style="--list-color:${escapeHtml(list.color)}"></span><span>${escapeHtml(list.name)}</span><span class="nav-count">${count}</span></button>`;
  }).join("");
  elements.taskListSelect.innerHTML = `<option value="">Inbox</option>${data.lists.map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name)}</option>`).join("")}`;
  const mobileListSelect = document.querySelector("#mobile-list-select");
  mobileListSelect.innerHTML = `<option value="">Personal lists</option>${data.lists.map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name)}</option>`).join("")}`;
  mobileListSelect.value = view === "list" ? activeListId : "";
}

function renderHeader() {
  const headings = {
    today: ["Today", "A fresh page. Make it count."],
    upcoming: ["Upcoming", "A little look at what’s ahead."],
    completed: ["Completed", "Look at everything you’ve moved forward."],
  };
  const list = data.lists.find((item) => item.id === activeListId);
  const [title, subtitle] = view === "list" ? [list?.name || "Your list", "A place for the things on your mind."] : headings[view];
  elements.pageTitle.innerHTML = `${escapeHtml(title)}<span class="title-period">.</span>`;
  elements.pageSubtitle.textContent = subtitle;
  elements.breadcrumb.textContent = title;
  document.querySelector("#jump-today").hidden = view === "today";
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".filter-tab").forEach((button) => button.classList.toggle("selected", button.dataset.filter === activeFilter));
}

function renderTasks() {
  const tasks = visibleTasks();
  const todayTasks = data.tasks.filter((task) => !task.date || task.date <= localDate(today));
  const completeCount = todayTasks.filter((task) => task.completed).length;
  const percentage = todayTasks.length ? Math.round((completeCount / todayTasks.length) * 100) : 0;
  document.querySelector("#progress-text").textContent = `${completeCount} of ${todayTasks.length} completed`;
  document.querySelector("#progress-percent").textContent = `${percentage}%`;
  document.querySelector("#progress-fill").style.width = `${percentage}%`;
  document.querySelector("#all-filter-count").textContent = tasks.length;

  if (!tasks.length) {
    const title = searchTerm ? "No matches just yet" : view === "completed" ? "Your slate is clean" : view === "upcoming" ? "Nothing on the horizon" : "A little breathing room";
    const message = searchTerm ? "Try another search, or add a new task." : view === "completed" ? "Finished tasks will find a home here." : view === "upcoming" ? "Tasks with a future date will show up here." : "Add a task when something comes to mind.";
    elements.taskList.innerHTML = `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">✳</div><strong>${title}</strong><p>${message}</p></div>`;
    return;
  }

  elements.taskList.innerHTML = tasks.map((task) => {
    const list = data.lists.find((item) => item.id === task.listId);
    const offset = dayOffset(task.date);
    const date = task.date ? `<span class="task-tag ${offset < 0 && !task.completed ? "overdue" : ""}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5 2v3M11 2v3M2.5 6.5h11"/></svg>${escapeHtml(formatDueDate(task.date))}</span>` : "";
    return `<article class="task-row ${task.completed ? "completed" : ""}" data-task-id="${escapeHtml(task.id)}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHtml(task.title)} ${task.completed ? "incomplete" : "complete"}" ${task.completed ? "checked" : ""} />
      <div class="task-copy"><span class="task-title">${escapeHtml(task.title)}</span><div class="task-meta"><span class="task-tag"><i class="task-priority ${escapeHtml(task.priority)}"></i>${task.priority === "high" ? "Important" : task.priority === "low" ? "Low" : "Normal"}</span>${date}${list ? `<span class="task-tag"><i class="list-color" style="--list-color:${escapeHtml(list.color)}"></i>${escapeHtml(list.name)}</span>` : ""}</div></div>
      <div class="task-actions"><button class="task-action edit-action" type="button" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></svg></button><button class="task-action delete-action" type="button" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button></div>
    </article>`;
  }).join("");
}

function renderAgenda() {
  const upcoming = data.tasks.filter((task) => !task.completed && task.date && task.date >= localDate(today)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  if (!upcoming.length) {
    elements.agendaList.innerHTML = '<div class="agenda-empty">No dates on the calendar.<br />Enjoy the open space.</div>';
    return;
  }
  const colors = ["#df5945", "#eab950", "#4f9184"];
  elements.agendaList.innerHTML = upcoming.map((task, index) => `<div class="agenda-item"><i class="agenda-marker" style="--agenda-color:${colors[index]}"></i><div class="agenda-text"><span class="agenda-name">${escapeHtml(task.title)}</span><span class="agenda-date">${escapeHtml(formatDueDate(task.date))}</span></div></div>`).join("");
}

function render() {
  renderSidebar();
  renderHeader();
  renderTasks();
  renderAgenda();
}

document.querySelector("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) return;
  data.tasks.push({ id: crypto.randomUUID(), title, date: elements.taskDate.value, priority: elements.taskPriority.value, listId: elements.taskListSelect.value, completed: false, createdAt: Date.now() });
  save();
  elements.taskInput.value = "";
  elements.taskDate.value = "";
  elements.taskPriority.value = "normal";
  activeFilter = "all";
  render();
  elements.taskInput.focus();
  notify("Task added");
});

document.querySelector(".main-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  view = button.dataset.view;
  activeListId = "";
  activeFilter = "all";
  render();
});

elements.customLists.addEventListener("click", (event) => {
  const button = event.target.closest("[data-list-id]");
  if (!button) return;
  activeListId = button.dataset.listId;
  view = "list";
  activeFilter = "all";
  render();
});

document.querySelector(".filter-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  render();
});

elements.taskList.addEventListener("change", (event) => {
  const row = event.target.closest("[data-task-id]");
  if (!row || !event.target.matches(".task-check")) return;
  const task = data.tasks.find((item) => item.id === row.dataset.taskId);
  if (!task) return;
  task.completed = event.target.checked;
  save();
  render();
  notify(task.completed ? "Nicely done" : "Back on your list");
});

elements.taskList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-task-id]");
  if (!row) return;
  const task = data.tasks.find((item) => item.id === row.dataset.taskId);
  if (event.target.closest(".delete-action")) {
    data.tasks = data.tasks.filter((item) => item.id !== row.dataset.taskId);
    save();
    render();
    notify("Task removed");
  }
  if (event.target.closest(".edit-action") && task) {
    const title = row.querySelector(".task-title");
    const input = document.createElement("input");
    input.className = "edit-task-input";
    input.value = task.title;
    input.setAttribute("aria-label", "Edit task name");
    title.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const updated = input.value.trim();
      if (updated) task.title = updated;
      save();
      render();
    };
    input.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key === "Enter") commit();
      if (keyEvent.key === "Escape") render();
    });
    input.addEventListener("blur", commit, { once: true });
  }
});

function addList() {
  const name = window.prompt("Name your new list:");
  if (!name?.trim()) return;
  const colors = ["#df5945", "#4f9184", "#d3a842", "#6d89ad", "#a2759c"];
  data.lists.push({ id: crypto.randomUUID(), name: name.trim(), color: colors[data.lists.length % colors.length] });
  save();
  render();
  notify("List created");
}

document.querySelector("#add-list").addEventListener("click", addList);
document.querySelector("#mobile-add-list").addEventListener("click", addList);

document.querySelector("#mobile-list-select").addEventListener("change", (event) => {
  activeListId = event.target.value;
  view = activeListId ? "list" : "today";
  activeFilter = "all";
  render();
});

elements.searchInput.addEventListener("input", () => {
  searchTerm = elements.searchInput.value.trim();
  renderTasks();
});

document.querySelector("#sort-button").addEventListener("click", () => {
  sortNewestFirst = !sortNewestFirst;
  renderTasks();
  notify(sortNewestFirst ? "Newest tasks first" : "Sorted by date and priority");
});

document.querySelector("#jump-today").addEventListener("click", () => {
  view = "today";
  activeListId = "";
  activeFilter = "all";
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.searchInput.focus();
  }
  if (event.key.toLowerCase() === "n" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.taskInput.focus();
  }
});

render();