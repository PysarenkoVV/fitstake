/* Repact — веб-версия приложения для AI-подсчёта тренировок.
   Чистый JS без сборки. Состояние в памяти + профиль в localStorage. */

"use strict";

// Версия оболочки — держать в синхроне с CACHE в sw.js; уходит в баг-репорты.
const APP_VERSION = "v134";
// Последняя JS-ошибка — прикладываем к баг-репорту, чтобы сразу видеть причину.
let lastError = "";
window.addEventListener("error", (e) => {
  lastError = ((e && e.message) || "") + " @ " + (((e && e.filename) || "").split("/").pop() || "") + ":" + ((e && e.lineno) || "");
});
window.addEventListener("unhandledrejection", (e) => {
  lastError = "promise: " + (((e && e.reason && e.reason.message) || (e && e.reason)) || "");
});

// ==========================================================================
// Иконки (упрощённые SVG под SF Symbols из приложения)
// ==========================================================================
const PATHS = {
  flame: '<path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c0-1 0-2-1-3 3 2 4 5 4 8a7 7 0 11-14 0c0-4 4-6 4-9 0-2 2-2 3-3z"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 20h6M12 14v6"/>',
  chartBar: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  xmark: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>',
  seal: '<path d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3 16.3l.9-2.9L3 10.5l2.6-1.5 1-2.8 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-4.5" stroke="#07110b"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  camera: '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.5"/>',
  cameraFlip: '<path d="M8.6 7l1.1-2.1h4.6l1.1 2.1H19a2 2 0 012 2v7.6a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"/><path d="M8.74 11.68A3.6 3.6 0 0115.26 11.68"/><path d="M13.83 10.75L15.26 11.68 15.47 9.99"/><path d="M15.26 14.72A3.6 3.6 0 018.74 14.72"/><path d="M10.17 15.65L8.74 14.72 8.53 16.41"/>',
  photo: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="8" cy="9" r="1.4"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" class="rec-dot"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="8" y="8" width="8" height="8" rx="1.5" stroke="#07110b"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  lockOpen: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017-2.5"/>',
  faceid: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><path d="M9 10v1M15 10v1M12 9v4l-1 1M9 15s1 1.5 3 1.5S15 15 15 15"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  share: '<path d="M12 3v13M8 7l4-4 4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"/>',
  personXmark: '<circle cx="9" cy="8" r="3.5"/><path d="M3 21c0-3.5 3-5.5 6-5.5M16 9l5 5M21 9l-5 5"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/>',
  plusCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8" stroke="#07110b"/>',
  plusCircleLine: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>', // контурный: круг и плюс currentColor (для кнопок)
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  home: '<path d="M4 11.2 12 5l8 6.2"/><path d="M6.5 10.2V19h11v-8.8"/>',
  ruler: '<rect x="2" y="9" width="20" height="7" rx="1.5"/><path d="M6.5 9v3M11 9v4M15.5 9v3M20 9v4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.8 10.2a4.5 4.5 0 016.4 0M12 12l2-2.5"/>',
  dollar: '<circle cx="12" cy="12" r="10"/><path d="M12 7v10M14.5 9.2c-.4-1-1.4-1.4-2.5-1.4-1.4 0-2.5.7-2.5 1.9 0 2.7 5 1.3 5 4 0 1.3-1.2 2-2.5 2-1.2 0-2.2-.5-2.6-1.5" stroke="#07110b"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  bug: '<ellipse cx="12" cy="13" rx="4.5" ry="6"/><circle cx="12" cy="6" r="2"/><path d="M12 8v10M7.6 11H4M7.6 14H4M8 17l-3 2M16.4 11H20M16.4 14H20M16 17l3 2M10.6 4.4L9.4 2.6M13.4 4.4l1.2-1.8"/>',
  bell: '<path d="M5 17h14l-1.5-2.5V10a5.5 5.5 0 00-11 0v4.5L5 17z"/><path d="M10 20h4"/>',
  // Упражнения (силуэты сбоку): отжимания у пола, присед, вис на турнике, брусья.
  exPushups: '<circle cx="5" cy="9.5" r="1.8"/><path d="M6.8 10 L19 14.5"/><path d="M8.5 10.6 L8.5 17"/><path d="M3 17.5 H21"/>',
  exSquats: '<circle cx="12" cy="5" r="1.8"/><path d="M12 6.8 L11 12 L16.5 12.5 L16 19"/><path d="M11.5 8.6 L16 8"/>',
  exPullups: '<path d="M3 4 H21"/><path d="M9 4 L10 9 M15 4 L14 9"/><circle cx="12" cy="7.6" r="1.8"/><path d="M12 9.4 L12 16 M12 16 L10.5 20 M12 16 L13.5 20"/>',
  exDips: '<path d="M2 8 H9 M15 8 H22"/><circle cx="12" cy="6" r="1.8"/><path d="M12 7.8 L12 15"/><path d="M12 9 L9 8 M12 9 L15 8"/><path d="M12 15 L10.5 19 M12 15 L13.5 19"/>',
};
const EXERCISE_ICON = { pushups: "exPushups", squats: "exSquats", pullups: "exPullups", dips: "exDips" };
function exIcon(ex, cls = "") { return icon(EXERCISE_ICON[ex] || "flame", cls); }

function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}
// Заливкой рисуем только сплошные силуэты; штриховые иконки при stroke:none пропадали,
// поэтому все прочие рендерим контурными.
const FILLED_ICONS = new Set(["flame", "play", "seal"]);
function iconF(name, cls = "") {
  if (!FILLED_ICONS.has(name)) return icon(name, cls);
  return `<svg class="icon filled ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}

// ==========================================================================
// i18n — точный словарь EN→RU из Localizable.xcstrings
// ==========================================================================
const RU = {
  "Choose language": "Выберите язык",
  "%lld cm": "%lld см", "%lld days — finished": "%lld дней — пройдено",
  "%lld in one set × %lld sets": "%lld за подход × %lld подхода", "%lld kg": "%lld кг",
  "%lld of %lld already did it today": "Сегодня уже сделали: %lld из %lld",
  "%lld reps today. Day %lld of %lld in the bag.": "%lld повторов сегодня. День %lld из %lld позади.",
  "%lld reps/day": "%lld повторов в день", "%lld years": "%lld лет", "+%lld more": "и ещё %lld",
  "1 per 2 weeks": "1 в 2 недели", "1 per challenge": "1 за весь челлендж",
  "A few times a week": "Пару раз в неделю", "Active challenges: %lld": "Активных: %lld",
  "After": "После", "Age": "Возраст", "All-time": "За всё время", "All-time reps": "Повторов за всё время", "Earlier reps": "Прежние повторы",
  "Almost every day": "Почти каждый день", "Athlete": "Атлет", "Balance": "Баланс", "Before": "До",
  "Before / After": "До / После", "Before / After photos": "Фото До / После", "Before you start": "Перед стартом",
  "Beginner": "Новичок", "Both arms must be fully in frame": "В кадре должны быть обе руки целиком",
  "Both legs must be fully in frame": "В кадре должны быть обе ноги целиком", "Buy-in": "Взнос",
  "Buy-in: %@": "Взнос: %@",
  "Buy-in: %lld. Drop out — it stays in the pot for the finishers.": "Взнос: %lld. Вылетел — он остаётся в банке для дошедших.",
  "Camera access is needed for the photo.": "Для фото нужен доступ к камере.",
  "Camera access is needed to count your reps.": "Для подсчёта повторов нужен доступ к камере.",
  "Switch camera": "Сменить камеру", "Ultra-wide 0.5×": "Ультраширокий 0.5×",
  "Try a demo workout": "Попробовать демо-тренировку",
  "AI Workout": "AI-тренировка",
  "Your camera counts every rep and helps you keep honest form.": "Камера считает каждый повтор и помогает следить за техникой.",
  "Try 5 reps": "Попробовать 5 повторений",
  "Camera tracking": "Слежение камерой",
  "Workout saved": "Тренировка сохранена",
  "Daily goal": "Дневная цель",
  "Best set": "Лучший подход",
  "Done": "Готово",
  "Story": "История",
  "Fill the frame": "Заполни весь кадр",
  "Prove it": "Докажи",
  "No equipment": "Без оборудования",
  "Quick challenge": "Быстрый челлендж",
  "7-day Push-up Challenge": "Отжимания: 7 дней",
  "7 days · 20 push-ups a day": "7 дней · 20 отжиманий в день",
  "Start challenge": "Начать челлендж",
  "Popular challenges": "Популярные челленджи",
  "Open challenges": "Открытые челленджи",
  "See all": "Смотреть все",
  "How it works": "Как это работает",
  "Choose a goal": "Выбери цель",
  "Train with camera": "Тренируйся с камерой",
  "Keep your streak": "Держи серию",
  "Today in Repact": "Сегодня в Repact",
  "No activity yet — be the first to train today.": "Пока тихо — стань первым, кто потренируется сегодня.",
  "Challenge a friend": "Бросить вызов другу",
  "Create a shared goal and send one link.": "Создай общую цель и отправь одну ссылку.",
  "Camera setup": "Подготовка камеры",
  "Set your phone down": "Поставь телефон устойчиво",
  "Keep the camera still so every rep can be verified.": "Зафиксируй камеру, чтобы каждый повтор можно было проверить.",
  "Fit your whole body in frame": "Помести всё тело в кадр",
  "Step back until your arms and legs are clearly visible.": "Отойди так, чтобы руки и ноги были полностью видны.",
  "Use good lighting": "Добавь света",
  "Face the light and avoid a bright window behind you.": "Встань лицом к свету и не ставь яркое окно за спиной.",
  "Your video stays on this device and is not uploaded.": "Видео остаётся на устройстве и никуда не загружается.",
  "Open camera": "Открыть камеру",
  "Not now": "Не сейчас",
  "Demo complete — join a challenge to save progress.": "Демо завершено — вступи в челлендж, чтобы сохранять прогресс.",
  "Step into frame": "Встань в кадр",
  "Too dark — add more light": "Слишком темно — добавь света",
  "Step back from the camera": "Отойди дальше от камеры",
  "Show both arms": "Покажи обе руки",
  "Show both legs": "Покажи обе ноги",
  "Position found": "Позиция найдена",
  "Reconnecting camera…": "Переподключаем камеру…",
  "Body found — hold still": "Тело найдено — не двигайся",
  "Ready — start moving": "Готово — начинай движение",
  "Lower your chest": "Опусти грудь ниже",
  "Squat lower": "Присядь ниже",
  "Pull yourself higher": "Подтянись выше",
  "Lower your body": "Опустись ниже",
  "Go a little deeper": "Ещё немного глубже",
  "Good depth — straighten fully": "Хорошая глубина — полностью выпрямись",
  "Go!": "Поехали!",
  "Camera check complete": "Камера работает",
  "Your reps were recognized correctly. Join a challenge to start saving progress.": "Повторы распознаны правильно. Вступи в челлендж, чтобы сохранять прогресс.",
  "Try again": "Повторить демо",
  "Continue as guest": "Продолжить как гость",
  "You’ll get 50 test coins. Guest progress stays only on this device.": "Ты получишь 50 тестовых коинов. Прогресс гостя хранится только на этом устройстве.",
  "Guest": "Гость",
  "Progress is stored only on this device": "Прогресс хранится только на этом устройстве",
  "Create an account to sync progress and use social challenges.": "Создай аккаунт, чтобы синхронизировать прогресс и участвовать в общих челленджах.",
  "Create account": "Создать аккаунт",
  "Account required": "Нужен аккаунт",
  "To join this challenge, create an account so your progress is saved and visible to other participants.": "Чтобы вступить, создай аккаунт — так прогресс сохранится и будет виден другим участникам.",
  "To publish or share a challenge, create an account so participants and progress can sync.": "Чтобы опубликовать или отправить челлендж друзьям, создай аккаунт — участники и прогресс будут синхронизироваться.",
  "Your private challenge works on this device without an account.": "Приватный челлендж работает на этом устройстве без аккаунта.",
  "Maybe later": "Не сейчас",
  "Customize preset": "Настрой пресет",
  "Daily goal": "Дневная норма",
  "1 month": "1 месяц",
  "2 months": "2 месяца",
  "Create challenge": "Создать челлендж",
  "Private on this device": "Приватный · на этом устройстве",
  "20 Dips Daily": "20 на брусьях ежедневно",
  "30 days · 20 a day": "30 дней · 20 в день",
  "Preparing workout…": "Готовим тренировку…", "Workout sounds": "Звуки тренировки", "Interface sounds": "Звуки интерфейса",
  "%@ completed": "%@ — готово", "Recording started": "Запись началась",
  "Overall time": "Общее время", "Finish set": "Закончить сет", "Rest": "Отдых",
  "Set %lld completed": "Сет %lld завершён", "%lld reps": "%lld повторов", "Total %@": "Всего %@",
  "+30 sec": "+30 сек", "Start next set": "Начать новый сет", "Rest finished": "Отдых закончен",
  "Finish workout": "Закончить", "Extra set": "Ещё сет", "Day complete": "День закрыт",
  "Time": "Время", "Sets": "Сеты", "Average set": "Средний сет", "Best set": "Лучший сет",
  "%lld sets": "%lld сетов", "avg %lld": "в среднем %lld", "%lld sec faster": "на %lld сек быстрее",
  "Finish workout?": "Завершить тренировку?", "Save completed reps?": "Сохранить выполненные повторы?",
  "Save workout": "Сохранить тренировку", "Exit without saving": "Выйти без сохранения",
  "Couldn't save. Try again.": "Не удалось сохранить. Попробуй ещё раз.",
  "Camera permission denied": "Доступ к камере запрещён",
  "Allow camera access in your browser settings, then retry.": "Разреши доступ к камере в настройках браузера и повтори.",
  "Camera not found": "Камера не найдена", "Couldn't load pose recognition": "Не удалось загрузить распознавание позы",
  "Internet connection required": "Нужно интернет-соединение", "Retry": "Повторить",
  "Challenge complete!": "Челлендж пройден!", "Challenge total": "Всего за челлендж", "Challenges": "Челленджи",
  "Back": "Назад", "Voice guidance": "Голосовые подсказки", "Record video": "Записать видео",
  "Close": "Закрыть", "cm": "см", "Combo": "Комбо", "Continue": "Дальше", "Create": "Создать",
  "Create Challenge": "Создать челлендж", "Currency": "Валюта", "Daily activity — 30 days": "Дневная активность за 30 дней",
  "Which exercises?": "Какие упражнения?", "Pick one or several — a combo counts them all.": "Выбери одно или несколько — комбо считает все.",
  "How many per day?": "Сколько в день?", "Daily goal for each exercise.": "Дневная норма для каждого.",
  "Conditions": "Условия", "Name your challenge": "Название челленджа", "Pick at least one exercise": "Выбери хотя бы одно упражнение",
  "Save & share": "Сохранить и поделиться", "New challenge": "Новый челлендж", "%lld / day": "%lld / день", "%lld days": "%lld дней",
  "Duration": "Длительность", "Progression": "Прогрессия", "Yes": "Да", "No": "Нет", "%lld-day challenge": "Челлендж на %lld дней", "Buy-in": "Взнос",
  "Next exercise": "Следующее упражнение", "Where to start?": "С чего начать?",
  "Day %lld of %lld": "День %lld из %lld", "Day 1: %lld → Day %lld: %lld": "День 1: %lld → День %lld: %lld",
  "Day done!": "День закрыт!", "Do today's combo": "Комбо за сегодня", "Do today's push-ups": "Отжимания за сегодня",
  "Do today's squats": "Приседания за сегодня", "Done": "Готово", "Done today": "Сегодня выполнено",
  "Done today: %lld/%lld": "Сегодня: %lld/%lld", "Duration (days)": "Длительность (дней)",
  "Each bar is one day.": "Каждый столбик — один день.", "Eliminated: %lld": "Выбыло: %lld", "Every": "Каждые",
  "Every day: ": "Каждый день: ", "Every rep is verified by the camera in real time.": "Каждый повтор проверяет камера в реальном времени.",
  "Every rep is verified by the camera. Coins on the line. Miss too many days and you're out.": "Каждый повтор проверяет камера. Коины на кону. Пропустил лишний день — вылетел.",
  "Exercise": "Упражнение", "Exercise journal": "Дневной журнал", "Extra reps": "Экстра-повторы", "Female": "Женский",
  "Find a challenge": "Найти челлендж", "Finish": "Завершить", "Finish: day %lld": "Финиш: день %lld",
  "Finished: %lld": "Пройдено: %lld", "Fitness level": "Физуха", "Gender": "Пол", "Get started": "Начать",
  "Goal reached!": "Цель выполнена!", "Height": "Рост",
  "How many push-ups can you do in one set?": "Сколько отжиманий делаешь за один подход?",
  "I barely train": "Почти не тренируюсь", "Increase by: %lld reps": "Прирост: %lld повторов",
  "Join for": "Вступить за", "kg": "кг", "Leaderboard": "Таблица итогов", "Let's go": "Погнали",
  "Test coins · no cash value": "Тест-монеты · без денежной стоимости",
  "Leave challenge": "Выйти из челленджа", "Leave challenge?": "Выйти из челленджа?", "Leave": "Выйти", "Cancel": "Отмена",
  "Keep going": "Продолжить", "Challenge restarted — keep going!": "Пропуски прощены — продолжай!",
  "Your buy-in won't be refunded and you won't be able to see the results.": "Взнос не вернётся, и результаты ты больше не сможешь посмотреть.",
  "Male": "Мужской", "Max reps": "Максимум за подход", "Max reps in one set": "Максимум за подход",
  "Max reps in one set: %lld": "Максимум за подход: %lld", "Measurements": "Замеры", "Members: %lld": "Участников: %lld",
  "Missed days": "Пропуски дней", "New measurement": "Новый замер",
  "No measurements yet. They're added after each challenge.": "Замеров пока нет. Они добавляются после каждого челленджа.",
  "No missed days: skip one and you're out. The pot is split between everyone who finishes.": "Пропускать нельзя: пропустил день — выбыл. Банк делится между всеми, кто дошёл до конца.",
  "None": "Нельзя", "Not enough coins": "Не хватает коинов", "Off": "Выкл", "Open Settings": "Открыть настройки",
  "Opens at the finish": "Откроется на финише", "Other": "Другой", "per day": "в день", "per week": "в неделю",
  "Photo BEFORE": "Фото ДО", "Photos appear here once you join a challenge with a BEFORE photo.": "Фото появятся, когда вступишь в челлендж с фото ДО.",
  "Point the camera at yourself": "Наведи камеру на себя", "Practice": "Тренировка", "Private": "Приватный",
  "Prize pool": "Призовой фонд", "Profile": "Профиль", "Progression": "Прогрессия",
  "Progressive overload": "Режим прогрессивной нагрузки", "Public": "Публичный", "Public challenge": "Публичный челлендж",
  "Push-ups": "Отжимания", "Push-ups per day": "Отжиманий в день", "Regular": "Занимаюсь", "Reps": "Повторы",
  "Reps can be split into any number of sets during the day.": "Норму можно набирать любым числом подходов в течение дня.",
  "reps per day": "повторов в день", "Reps per day": "Повторов в день", "Retake": "Переснять", "Rules": "Правила",
  "Save": "Сохранить", "Save to profile": "Сохранить в профиль", "Schedule": "Расписание", "Share": "Поделиться",
  "Share result": "Поделиться результатом", "Show result": "Показать результат", "Squats": "Приседания",
  "Squats per day": "Приседаний в день", "Stake amount": "Сумма ставки", "Start today's workout": "Начать тренировку дня",
  "Starting balance": "Стартовый баланс", "Statistics": "Статистика", "Stats": "Статистика", "Take a photo": "Сделать фото",
  "Take photo": "Снять фото", "Upload": "Загрузить",
  "Test currency — no real money.": "Тестовая валюта — настоящие деньги не участвуют.",
  "The buy-in is deducted from your balance right away. Test currency — no real money.": "Взнос сразу списывается с баланса. Валюта тестовая — настоящие деньги не участвуют.",
  "The challenge runs %lld days.": "Челлендж идёт %lld дней.", "The daily goal grows as the challenge goes on.": "Дневная норма растёт по ходу челленджа.",
  "The goal grows by %lld reps every day — by day %lld it's %lld.": "Норма растёт на %lld повторов каждый день — к дню %lld это %lld.",
  "The goal grows by %lld reps every week — by day %lld it's %lld.": "Норма растёт на %lld повторов каждую неделю — к дню %lld это %lld.",
  "The photo stays hidden until the finish — then it appears next to your AFTER photo.": "Фото скрыто до финиша — там оно встанет рядом с фото ПОСЛЕ.",
  "Title": "Название", "Today": "Сегодня", "Total reps": "Всего повторов", "Total reps over the last 4 weeks.": "Сумма повторов за последние 4 недели.",
  "Show photos": "Показать фото", "Upload from library": "Загрузить из галереи", "Week %lld": "Неделя %lld",
  "Share your day": "Поделиться днём", "Choose a background": "Выбери фон", "Repact gradient": "Градиент Repact",
  "Photo library": "Фото из галереи", "Open camera": "Открыть камеру", "Share story": "Поделиться сторис",
  "Share today's result": "Поделиться результатом",
  "Template": "Шаблон", "Minimal": "Минимал", "Challenge": "Вызов", "Photo scale": "Масштаб фото",
  "Background dimming": "Затемнение", "Drag the photo to position it": "Двигай фото пальцем",
  "I did mine": "Я своё сделал", "Now it's your turn": "Теперь твоя очередь",
  "Potential reward": "Возможная награда",
  "Above goal": "Сверх нормы", "Best day": "Лучший день", "Today's place": "Место сегодня", "Streak": "Серия",
  "This week": "На этой неделе", "Last 30 days": "Последние 30 дней", "Active days": "Активных дней",
  "Best streak": "Лучшая серия", "Current streak": "Текущая серия", "Personal records": "Личные рекорды",
  "Recent workouts": "Последние тренировки", "Daily best": "Лучший день", "No reps yet": "Пока нет повторов",
  "Reps · 30 days": "Повторы · 30 дней", "Completion": "Выполнено", "All": "Все",
  "%lld of %lld": "%lld из %lld",
  "reps": "повторов", "Exercises": "Упражнения",
  "AI verified": "Проверено ИИ", "Avg / set": "Ср. за сет", "Day": "День",
  "faster than last time": "быстрее прошлого раза",
  "Body & measurements": "Тело и замеры", "Wallet": "Кошелёк", "Privacy & data": "Приватность и данные",
  "Video is processed on your device by the camera — not recorded and not sent to any server.": "Видео обрабатывается на твоём устройстве камерой — не записывается и не отправляется на сервер.",
  "Before / After photos are stored on your device — the app doesn't upload them to our servers.": "Фото до/после хранятся на твоём устройстве — приложение не загружает их на наши серверы.",
  "Weight and measurements stay on this device.": "Вес и замеры остаются на этом устройстве.",
  "Nothing is used to train any models.": "Ничего не используется для обучения моделей.",
  "Weekly volume": "Недельный объём", "Weight": "Вес", "Weight: %lld kg": "Вес: %lld кг",
  "Yesterday %lld dropped out": "Вчера выбыло: %lld", "You": "Ты",
  "You can miss 1 day during the whole challenge, more and you're out. The pot is split between everyone who finishes.": "Можно пропустить 1 день за весь челлендж, больше — выбываешь. Банк делится между всеми, кто дошёл до конца.",
  "You can miss 1 day every 2 weeks, more and you're out. The pot is split between everyone who finishes.": "Можно пропускать 1 день раз в 2 недели, больше — выбываешь. Банк делится между всеми, кто дошёл до конца.",
  "You take home": "Забираешь", "You'd win": "Заберёшь",
  "You're not in any challenge yet. Join one and put some coins on the line.": "Ты пока не в игре. Вступи в челлендж и поставь коины на кон.",
  "Your age": "Твой возраст", "Your Challenges": "Твои челленджи", "Your daily goal": "Твоя дневная норма",
  "Your data": "Твои данные", "Your fitness level": "Твоя физуха", "Your gender": "Твой пол", "Your height": "Твой рост",
  "Your physical profile": "Твои параметры", "yrs": "лет",
  "Your exercises": "Твои упражнения", "Pick what you train and set your one-set max.": "Отметь, что тренируешь, и укажи максимум за подход.",
  "%@ level → %lld working sets per exercise.": "Уровень %@ → %lld рабочих сета на упражнение.",
  "This information is used to personalize your first week workout program. You can edit it later from your profile page.": "Эти данные помогут собрать программу первой недели под тебя. Их можно изменить позже в профиле.",
  "Your starting point — at the finish you'll see how far you've come.": "Твоя точка отсчёта — на финише увидишь, как далеко ушёл.",
  "Your weight": "Твой вес", "Your whole body must be in frame": "В кадре должно быть всё тело целиком", "Yours": "Твои",
  "Language": "Язык", "Edit": "Изменить", "Increase by": "Прирост",
  "Progress": "Прогресс", "Settings": "Настройки", "Continue workout": "Продолжить тренировку",
  "Choose a workout": "Выбери тренировку", "Pick what you want to complete today.": "Выбери, что хочешь закрыть сегодня.",
  "Home": "Главная", "Friends feed": "Лента друзей", "When friends complete their day — it shows up here.": "Когда друзья закрывают день — это появится здесь.",
  "All done for today": "На сегодня всё", "%lld left": "осталось %lld", "%lldh %lldm": "%lldч %lldм",
  "Insights": "Выводы", "This week +%lld% more reps": "На этой неделе на %lld% больше повторов",
  "This week %lld% fewer reps": "На этой неделе на %lld% меньше повторов",
  "On track %lld days in a row": "Норма %lld дней подряд",
  "%lld reps to your daily record": "До рекорда дня осталось %lld повторов",
  "Most active day — %@": "Самый активный день — %@",
  "Complete your first workout and your weekly trend will appear here.": "Заверши первую тренировку — здесь появится недельная динамика.",
  "Invite friends": "Пригласить друзей", "Link copied": "Ссылка скопирована",
  "Your name": "Твоё имя", "Friends will see it in the leaderboard.": "Друзья увидят его в таблице лидеров.",
  "Join my challenge — 150 push-ups + 50 squats a day!": "Залетай в мой челлендж — 150 отжиманий и 50 приседаний в день!",
  "In the app: %lld": "В приложении: %lld", "today": "сегодня", "yesterday": "вчера", "tomorrow": "завтра",
  "Ready!": "Готов!", "Start today": "Начать сегодня", "Start tomorrow": "Начать завтра", "Start solo!": "Начать соло!",
  "%lld players": "Игроков: %lld", "Gathered %lld / %lld · %lld ready": "Собрано %lld / %lld · готовы %lld",
  "Waiting for everyone to gather and get ready…": "Ждём, пока соберутся все и нажмут «Готов!»…",
  "Waiting for the creator to start…": "Ждём, пока создатель запустит челлендж…",
  "Couldn't start challenge": "Не удалось запустить челлендж", "Couldn't mark ready": "Не удалось отметить готовность",
  "“%@” starts %@": "«%@» стартует %@",
  "Pull-ups": "Подтягивания", "Dips": "Брусья",
  "Do today's pull-ups": "Подтягивания за сегодня", "Do today's dips": "Брусья за сегодня",
  "You didn't finish this one.": "В этот раз ты не дошёл.", "Finishers": "Дошли",
  "A new season starts soon.": "Скоро новый сезон.", "Completed": "Завершён",
  "Day streak": "Дней подряд", "%lld-day streak": "%lld дней подряд",
  "Closed": "Закрыт", "Missed": "Пропущен", "Upcoming": "Впереди", "Out": "Выбыл",
  "Failed": "Провален", "Challenge failed": "Челлендж провален",
  "You missed more days than the protection allows.": "Пропущено больше дней, чем разрешает защита.",
  "It will move to Completed in a couple of days.": "Через пару дней он переедет в «Завершённые».",
  "Account": "Аккаунт", "Email": "Почта", "Password": "Пароль", "Log out": "Выйти",
  "Log in": "Войти", "Sign up": "Зарегистрироваться", "Signed in": "Вход выполнен", "Signing in…": "Вход…", "Skip for now": "Пропустить пока",
  "Sign in to sync progress across your devices": "Войди, чтобы прогресс сохранялся на всех устройствах",
  "Synced across your devices": "Прогресс синхронизируется на всех устройствах",
  "Enter email and password": "Введи почту и пароль", "Wrong password": "Неверный пароль",
  "Password too short (min 6)": "Пароль слишком короткий (мин. 6)", "Invalid email": "Неверная почта",
  "Network error": "Ошибка сети", "Couldn't sign in": "Не удалось войти",
  "Email already registered — log in": "Почта уже занята — войди", "No account yet — sign up": "Аккаунта нет — зарегистрируйся",
  "Create your account": "Создай аккаунт", "Step %lld of %lld": "Шаг %lld из %lld",
  "Which exercise do you want to start with?": "С какого упражнения начнёшь?",
  "%lld in Repact": "%lld в Repact", "Create from scratch": "Создать с нуля",
  "Review challenge": "Проверь челлендж", "Tap any card to make changes before creating.": "Нажми на карточку, чтобы изменить её перед созданием.",
  "Exercise & daily goal": "Упражнения и цель", "Pick exercises and set a goal for each.": "Выбери упражнения и цель для каждого.",
  "How long?": "Как долго?", "Choose how long the challenge will run.": "Выбери длительность челленджа.",
  "2 weeks": "2 недели", "Good for a quick start": "Подходит для быстрого старта",
  "1 month": "1 месяц", "Balanced challenge": "Оптимальная длительность",
  "2 months": "2 месяца", "Long-term progress": "Долгосрочный прогресс",
  "Custom duration": "Своя длительность",
  "Rules & stake": "Правила и ставка", "Set the final details before review.": "Настрой последние детали перед проверкой.",
  "Rules": "Правила", "Challenge name": "Название челленджа", "Save changes": "Сохранить изменения", "Private challenge": "Приватный челлендж",
  "Missed days decide how many unfinished days you can have before you leave the challenge and lose your stake.": "Пропущенные дни — сколько раз можно не выполнить дневную цель, прежде чем ты выбываешь из челленджа и теряешь ставку.",
  "No protection": "Без защиты", "Miss one day and you're out.": "Один пропуск — и ты выбываешь.",
  "One safety day": "Один запасной день", "You can miss once during the whole challenge.": "Можно один раз пропустить за весь челлендж.",
  "Recurring protection": "Регулярная защита", "You can miss once in every 14 days.": "Можно пропустить один раз в каждые 14 дней.",
  "Increase your daily target gradually as you get stronger.": "Дневная цель будет постепенно расти вместе с твоей формой.",
  "Final daily target": "Цель в последний день", "No increase — the daily target stays the same.": "Без повышения — дневная цель останется прежней.",
  "Authentication service is still loading — try again": "Сервис входа ещё загружается — попробуй ещё раз",
  "Email registration is temporarily unavailable. Try Google.": "Регистрация по email временно недоступна. Попробуй Google.",
  "Open the app at http://localhost:8000 to sign in": "Открой приложение через http://localhost:8000 для входа",
  "30-day Push-up Challenge": "Отжимания: 30 дней", "50 push-ups a day for a month": "50 отжиманий в день месяц",
  "100 Squats Daily": "100 приседаний в день", "30 days · 100 a day": "30 дней · 100 в день",
  "Pull-up Progression": "Подтягивания: прогрессия", "Grows a bit every week": "Растёт каждую неделю",
  "Easier": "Легче", "Recommended": "Рекомендовано", "Harder": "Интенсивнее",
  "So your progress is saved and syncs across your devices": "Чтобы прогресс сохранялся и синхронизировался между устройствами",
  "Continue with Google": "Продолжить с Google", "or": "или",
  "Allow popups and try again": "Разреши всплывающие окна и попробуй снова",
  "Enable Google in Firebase (Sign-in method)": "Включи Google в Firebase (Sign-in method)",
  "Add domain in Firebase (Authorized domains)": "Добавь домен в Firebase (Authorized domains)",
  "Google sign-in unavailable here — use email": "Google-вход тут недоступен — войди по почте",
  "Add to Home Screen: Share → Add to Home Screen": "На экран «Домой»: Поделиться → «На экран Домой»",
  "Report a problem": "Сообщить о проблеме",
  "Pick what's wrong — one tap is enough. Details optional.": "Выбери, что не так — хватит одного тапа. Детали по желанию.",
  "Details (optional)": "Детали (по желанию)", "Send report": "Отправить",
  "Thanks! Report sent.": "Спасибо! Отчёт отправлен.", "Couldn't send — check connection": "Не отправилось — проверь связь",
  "Counting & camera": "Счёт и камера", "Money & stakes": "Деньги и ставки",
  "Design & layout": "Дизайн и вёрстка", "App behavior": "Работа приложения",
  "Counts extra reps": "Считает лишние повторы", "Doesn't count reps": "Не засчитывает повторы",
  "Counts when body isn't visible": "Считает, когда тела не видно", "Camera is slow or laggy": "Камера тормозит или лагает",
  "Skeleton doesn't appear": "Скелет не появляется", "Can't create a challenge": "Не создаётся челлендж",
  "Can't join or leave": "Не могу вступить или выйти", "Challenge disappeared": "Челлендж пропал сам",
  "Progress or results are wrong": "Прогресс или результаты неверные", "Wrong balance or buy-in": "Неверный баланс или взнос",
  "Payout problem": "Проблема с выплатой", "Spacing or elements are off": "Съехали отступы или элементы",
  "Text cut off or overlapping": "Текст обрезан или налезает", "Hard to see in dark or light theme": "Плохо видно в тёмной или светлой теме",
  "Froze or crashed": "Зависло или вылетело", "Laggy": "Тормозит", "Something won't load": "Что-то не грузится",
  "Buy coins": "Купить коины", "coins": "коинов", "Coins purchased": "Пополнение баланса", "+%lld coins": "+%lld коинов",
  "Follow": "Подписаться", "Following": "Вы подписаны", "Unfollow": "Отписаться",
  "Challenges joined": "Участвует в челленджах", "No active challenges": "Нет активных челленджей",
  "Active": "Активные", "Pending": "Ожидание", "Browse": "Обзор",
  "No public challenges yet": "Пока нет публичных", "Public challenges you can join show up here.": "Здесь появляются публичные челленджи, к которым можно присоединиться.",
  "Challenge type": "Тип челленджа", "Daily minimum reps": "Минимум в день", "Goal": "Цель",
  "Hit a total rep target": "Набрать цель повторов", "Custom": "Свой", "Who can join": "Кто участвует",
  "Solo": "Соло", "Just you": "Только ты", "Invite by link": "Вход по ссылке", "Anyone joins": "Все могут войти",
  "Players to gather": "Сколько собрать", "Stake & rules": "Ставка и правила", "Days": "Дней", "d": "д",
  "Create a new challenge to get started!": "Создай челлендж, чтобы начать!",
  "Nothing pending": "Нет ожидающих",
  "Private and public challenges waiting to start show up here.": "Здесь появляются приватные и публичные челленджи, ждущие старта.",
  "No finished challenges yet": "Пока нет завершённых",
  "Completed challenges will show up here.": "Здесь появятся завершённые челленджи.",
  "Total reps": "Всего повторений", "Following %lld": "Подписок: %lld", "Followers %lld": "Подписчиков: %lld",
  "Notifications": "Уведомления", "No notifications yet": "Уведомлений пока нет",
  "%@ completed %@ in %@": "%@ закрыл упражнение «%@» в «%@»",
  "%@ completed today's challenge in %@": "%@ выполнил дневную цель в «%@»",
  "just now": "только что", "%lld min ago": "%lld мин назад", "%lld h ago": "%lld ч назад",
  "Couldn't update subscription": "Не удалось изменить подписку",
  "Couldn't publish challenge": "Не удалось опубликовать челлендж",
  "Couldn't leave challenge": "Не удалось выйти из челленджа", "Couldn't join challenge": "Не удалось вступить в челлендж", "Joining…": "Вступаем…",
  "Creator": "Создатель", "Joined": "Участвует", "Loading public challenges…": "Загружаем публичные челленджи…",
  "Couldn't load public challenges. Check connection.": "Не удалось загрузить публичные челленджи. Проверьте соединение.",
  "In progress": "В процессе", "So your progress is saved and syncs across your devices.": "Чтобы прогресс сохранялся и синхронизировался между устройствами.",
  "Challenge created": "Челлендж создан", "Invite people now or share it later from the challenge page.": "Пригласите людей сейчас или поделитесь позже со страницы челленджа.",
  "Share invite": "Поделиться приглашением", "Copy link": "Скопировать ссылку", "Open challenge": "Открыть челлендж",
  "Join my challenge": "Присоединяйся к моему челленджу",
  "Publishing challenge…": "Публикуем челлендж…", "Couldn't publish challenge. Check your connection and try again.": "Не удалось опубликовать челлендж. Проверьте соединение и попробуйте снова.",
  "Reset test data": "Сбросить тестовые данные", "Reset all test data?": "Сбросить все тестовые данные?",
  "This removes your local profile, workouts, photos and test coins from this device. This cannot be undone.": "С устройства будут удалены локальный профиль, тренировки, фото и тестовые коины. Это действие нельзя отменить.",
  "Cancel": "Отмена", "Reset and start over": "Сбросить и начать заново",
  "Camera frames are processed on this device and are not uploaded to our servers.": "Кадры камеры обрабатываются на этом устройстве и не загружаются на наши серверы.",
  "Video is recorded only when you tap Record and stays on your device unless you choose to share it.": "Видео записывается только после нажатия кнопки записи и остаётся на устройстве, пока вы сами им не поделитесь.",
  "We use PostHog and Firebase Analytics to understand product usage and improve the test app.": "Мы используем PostHog и Firebase Analytics, чтобы понимать использование продукта и улучшать тестовое приложение.",
  "Shared!": "Готово!", "Your result has been shared.": "Результат опубликован.",
  "Back to result": "Вернуться к результату", "Go to Home": "На главную",
  "Coins": "Монеты", "Test coins for joining challenges. They have no cash value.": "Тестовые монеты для участия в челленджах. Они не имеют денежной ценности.",
  "Restore test balance": "Восстановить тестовый баланс", "Test balance restored": "Тестовый баланс восстановлен",
};

// Перевод + подстановка %lld / %@ по порядку аргументов.
function t(key, ...args) {
  const dict = store.lang === "ru" ? RU : store.lang === "ua" ? (window.UA_TRANSLATIONS || {}) : null;
  let s = dict && dict[key] != null ? dict[key] : key;
  let i = 0;
  s = s.replace(/%lld|%@/g, () => (i < args.length ? String(args[i++]) : ""));
  return s;
}

function localeCode() {
  return store.lang === "ru" ? "ru-RU" : store.lang === "ua" ? "uk-UA" : "en-US";
}

// ==========================================================================
// Персистентность (аналог @AppStorage)
// ==========================================================================
const DEFAULTS = {
  onboarded: false, "profile.name": "", "profile.gender": "male", "profile.age": 25, "profile.heightCm": 178,
  "profile.weightKg": 75, "profile.level": "regular", "profile.maxReps": 15, "profile.startExercise": "pushups", dailyGoal: 50,
  // Мульти-выбор упражнений онбординга + максимум за подход на каждое.
  "profile.sel_pushups": true, "profile.sel_squats": false, "profile.sel_pullups": false, "profile.sel_dips": false,
  "profile.reps.pushups": 15, "profile.reps.squats": 15, "profile.reps.pullups": 15, "profile.reps.dips": 15,
  workoutSounds: true, interfaceSounds: true, lang: (navigator.language || "en").startsWith("ru") ? "ru" : (navigator.language || "en").startsWith("uk") ? "ua" : "en",
};
const store = new Proxy({}, {
  get(_, k) {
    const raw = localStorage.getItem("fs." + k);
    if (raw == null) return DEFAULTS[k];
    try { return JSON.parse(raw); } catch { return raw; }
  },
  set(_, k, v) { localStorage.setItem("fs." + k, JSON.stringify(v)); return true; },
});

// ==========================================================================
// Валюта: тестовые коины как $ или локальная валюта устройства
// ==========================================================================

const fmt = (n) => Number(n).toLocaleString("en-US");
// Игровая валюта: не реальные деньги. Единый символ вместо валютных знаков ($/€/₴).
const COIN_SYM = "🔥";
function coin(value) {
  return `<span class="money">${COIN_SYM}${fmt(value)}</span>`;
}
// Число «крутится» вверх до значения при появлении экрана победы (запуск — в afterRender).
// data-countup держит целевое число; текст-фолбэк = финальное значение (если анимация не сыграет).
function coinCountUp(value, key, fromZero) {
  return `<span class="money" data-countup="${value}">${COIN_SYM}${fmt(value)}</span>`;
}
function animateCountUp(el) {
  const to = parseFloat(el.dataset.countup);
  if (!isFinite(to)) return;
  if (REDUCE_MOTION() || to <= 0) { el.textContent = `${COIN_SYM}${fmt(to)}`; return; }
  const dur = 850, t0 = performance.now();
  const ease = (p) => 1 - Math.pow(1 - p, 3); // easeOutCubic
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = `${COIN_SYM}${fmt(Math.round(to * ease(p)))}`;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ==========================================================================
// Модели и вычисляемые свойства (порт Models.swift)
// ==========================================================================
// Случайный суффикс — чтобы id новых объектов не совпадали с восстановленными из localStorage.
const uid = (() => { let n = 0; const salt = Math.random().toString(36).slice(2, 6); return () => "id" + ++n + salt; })();

const Exercise = {
  displayName: (e) => ({ pushups: t("Push-ups"), squats: t("Squats"), pullups: t("Pull-ups"), dips: t("Dips") }[e] || e),
  actionText: (e) => ({ pushups: t("Do today's push-ups"), squats: t("Do today's squats"), pullups: t("Do today's pull-ups"), dips: t("Do today's dips") }[e] || e),
};

const MissPolicy = {
  displayName: (p) => ({ never: t("None"), oneTotal: t("1 per challenge"), onePerTwoWeeks: t("1 per 2 weeks") }[p]),
  rulesText: (p) => ({
    never: t("No missed days: skip one and you're out. The pot is split between everyone who finishes."),
    oneTotal: t("You can miss 1 day during the whole challenge, more and you're out. The pot is split between everyone who finishes."),
    onePerTwoWeeks: t("You can miss 1 day every 2 weeks, more and you're out. The pot is split between everyone who finishes."),
  }[p]),
  all: ["never", "oneTotal", "onePerTwoWeeks"],
};

function progIncrements(prog, day) {
  if (!prog.step || prog.step <= 0 || day <= 1) return 0;
  return prog.period === "day" ? day - 1 : Math.floor((day - 1) / 7);
}

const C = {
  pot: (c) => c.buyIn * c.participants.length,
  active: (c) => c.participants.filter((p) => p.state === "active"),
  eliminated: (c) => c.participants.length - C.active(c).length,
  payout: (c) => Math.floor(C.pot(c) / Math.max(C.active(c).length, 1)),
  me: (c) => c.participants.find((p) => p.isMe),
  isJoined: (c) => !!C.me(c),
  doneTodayCount: (c) => C.active(c).filter((p) => p.doneToday).length,
  myToday: (c, ex) => c.myTodayReps[ex] || 0,
  myTodayTotal: (c) => c.goals.reduce((s, g) => s + C.myToday(c, g.exercise), 0),
  isGoal: (c) => c.type === "goal",
  // norm — целевое значение упражнения: goal — общая цель на челлендж; streak — дневная норма (+ прогрессия).
  norm: (c, g, day) => c.type === "goal" ? (g.target || 0) : (g.repsPerDay + c.progression.step * progIncrements(c.progression, day ?? c.currentDay)),
  // Прогресс упражнения к его цели: goal — всего за челлендж; streak — сегодня.
  exProgress: (c, g) => c.type === "goal" ? ((c.myTotalByExercise || {})[g.exercise] || 0) : C.myToday(c, g.exercise),
  repsNorm: (c, day) => c.goals.reduce((s, g) => s + C.norm(c, g, day), 0),
  // «Готово»: streak — сегодняшняя норма закрыта; goal — общая цель достигнута.
  isTodayDone: (c) => c.goals.every((g) => C.exProgress(c, g) >= C.norm(c, g)),
  // Финиш: goal — как только цель достигнута (в любой день); streak — дожил до конца, закрыв последний день.
  isFinished: (c) => c.type === "goal" ? C.isTodayDone(c) : (c.currentDay >= c.durationDays && C.isTodayDone(c)),
  // pending — ещё не стартовал (startAt пуст или в будущем); completed — прожиты все дни;
  // иначе active. Используется вкладками Challenges (Active/Pending/Completed).
  status: (c) => {
    const s = challengeStartEpoch(c);
    if (s == null || startOfDay(Date.now()) < s) return "pending";
    if (failLingerOver(c)) return "completed"; // провал отвисел «серым» — в архив
    // goal завершается достижением цели (в любой день); streak — по календарю.
    return (c.isCompleted || challengeEnded(c) || (C.isGoal(c) && C.isFinished(c))) ? "completed" : "active";
  },
  actionText: (c) => (c.goals.length > 1 ? t("Do today's combo") : Exercise.actionText(c.goals[0].exercise)),
  exerciseNames: (c) => c.goals.map((g) => Exercise.displayName(g.exercise)).join(" + "),
  goalsText: (c) => c.goals.map((g) => `${Exercise.displayName(g.exercise)} ${C.norm(c, g)}`).join(" + "),
};

// ==========================================================================
// Мок-данные (до появления бэкенда) — порт AppState.swift
// ==========================================================================
const MOCK_NAMES = ["Vova", "Alex", "Dima", "Masha", "Egor", "Kate", "Leo", "Nastya", "Max", "Ira", "Tim", "Olya", "Den", "Sveta", "Roma"];

function mockParticipants(total, eliminated, othersDoneToday, includeMe, repsPerDay) {
  const result = [];
  if (includeMe) result.push({ id: uid(), name: "", isMe: true, state: "active", doneToday: false, todayReps: 0 });
  const othersCount = total - result.length;
  for (let i = 0; i < othersCount; i++) {
    const base = MOCK_NAMES[i % MOCK_NAMES.length];
    const name = i < MOCK_NAMES.length ? base : `${base} ${Math.floor(i / MOCK_NAMES.length) + 1}`;
    result.push({ id: uid(), name, isMe: false, state: "active", doneToday: false, todayReps: 0 });
  }
  let toEliminate = eliminated, index = result.length - 1;
  while (toEliminate > 0 && index >= 0) {
    if (!result[index].isMe) { result[index].state = "eliminated"; toEliminate--; }
    index--;
  }
  let toMark = othersDoneToday;
  for (const p of result) {
    if (toMark <= 0) break;
    if (!p.isMe && p.state === "active") { p.doneToday = true; toMark--; }
  }
  const extra = [0, 35, 10, 20];
  let doneIndex = 0;
  result.forEach((p, i) => {
    if (p.isMe || p.state !== "active") return;
    if (p.doneToday) { p.todayReps = repsPerDay + Math.floor(repsPerDay * extra[doneIndex % extra.length] / 100); doneIndex++; }
    else p.todayReps = (i * 37 + 11) % repsPerDay;
  });
  return result;
}

function newChallenge(o) {
  return Object.assign({
    id: uid(), type: "streak", access: "solo", minPlayers: 0, startAt: null,
    missPolicy: "oneTotal", progression: { step: 0, period: "day" },
    myTodayReps: {}, myTotalReps: 0, myTotalByExercise: {}, workoutStatsByDay: {}, startWeight: null, startMaxReps: null,
    beforePhoto: null, afterPhoto: null, isCompleted: false,
  }, o);
}

// Единственный общий челлендж: 150 отжиманий + 50 приседаний в день.
// С включённым Sync участники настоящие; без него — мок-соперники.
const Sync = window.Sync || { enabled: false, uid: null, state: {}, init: async () => false, registerUser() {}, join() {}, report() {}, restart() {}, restartChallenge() {} };
const SHARED_START = "2026-07-11";

// PostHog: продуктовая аналитика. Обёрнуто — не падаем, если скрипт заблокирован/не загружен.
function track(event, props) { try { if (window.posthog) window.posthog.capture(event, props || {}); } catch {} }
function phIdentify() { try { if (window.posthog && Sync.uid) window.posthog.identify(Sync.uid, { name: store["profile.name"] || undefined }); } catch {} }

function currentDayFromStart(days) {
  const s = new Date(SHARED_START + "T00:00:00").getTime();
  return Math.min(Math.max(Math.floor((startOfDay(Date.now()) - s) / DAY) + 1, 1), days);
}
function dateKey(ts) {
  const d = new Date(ts || Date.now());
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function workoutClock(ms) {
  const seconds = Math.max(0, Math.floor((+ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
function workoutSummary(c, key = dateKey()) {
  const raw = c && c.workoutStatsByDay && c.workoutStatsByDay[key];
  if (!raw) return { elapsedMs: 0, time: "00:00", sets: 0, average: 0, best: 0, reps: 0, improvementMs: 0 };
  const setReps = Array.isArray(raw.setReps) ? raw.setReps.filter((n) => +n > 0).map(Number) : [];
  const reps = raw.reps != null ? +raw.reps : setReps.reduce((sum, n) => sum + n, 0);
  const keys = Object.keys(c.workoutStatsByDay || {}).filter((day) => day < key && c.workoutStatsByDay[day] && c.workoutStatsByDay[day].completedAt).sort();
  const previous = keys.length ? c.workoutStatsByDay[keys[keys.length - 1]] : null;
  const improvementMs = previous && previous.elapsedMs > raw.elapsedMs ? previous.elapsedMs - raw.elapsedMs : 0;
  return {
    elapsedMs: +raw.elapsedMs || 0,
    time: workoutClock(raw.elapsedMs),
    sets: setReps.length,
    average: setReps.length ? Math.round(reps / setReps.length) : 0,
    best: setReps.length ? Math.max(...setReps) : 0,
    reps,
    improvementMs,
  };
}

function mockChallenges() {
  return [
    newChallenge({
      id: "main",
      title: "150 Push-ups + 50 Squats",
      goals: [{ exercise: "pushups", repsPerDay: 150 }, { exercise: "squats", repsPerDay: 50 }],
      durationDays: 30, buyIn: 100, isPublic: true, access: "public",
      currentDay: Sync.enabled ? currentDayFromStart(30) : 12,
      yesterdayDropouts: Sync.enabled ? 0 : 1,
      participants: Sync.enabled ? [] : mockParticipants(15, 1, 6, true, 200),
      myTotalReps: Sync.enabled ? 0 : 1760,
    }),
  ];
}

const DAY = 86400000;
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

// ==========================================================================
// Прогресс по дням: закрытие / пропуски / выбывание / стрик / финиш.
// Считается из participants/{uid}/days (синк-режим); детерминировано и тестируемо.
// ==========================================================================
function challengeStartKey(c) {
  if (c.id === "main") return SHARED_START;
  // startAt == null → челлендж ещё не стартовал (pending): private ждёт создателя,
  // public — набора участников. startedAt читаем как легаси-фолбэк на время миграции.
  if (c.startAt != null) return dateKey(c.startAt);
  return c.startedAt != null ? dateKey(c.startedAt) : null;
}
function challengeStartEpoch(c) {
  const key = challengeStartKey(c);
  return key ? new Date(key + "T00:00:00").getTime() : null;
}
// Номер текущего дня от старта; pending-челлендж (ещё не стартовал) остаётся на дне 1.
function computeCurrentDay(c) {
  if (c.id === "main" && Sync.enabled) return currentDayFromStart(c.durationDays);
  const s = challengeStartEpoch(c);
  if (s == null) return 1;
  return Math.min(Math.max(Math.floor((startOfDay(Date.now()) - s) / DAY) + 1, 1), c.durationDays);
}
function dayEpoch(startKey, day) { return new Date(startKey + "T00:00:00").getTime() + (day - 1) * DAY; }
function dayClosed(c, day, dayData) {
  return c.goals.every((g) => (dayData[g.exercise] || 0) >= C.norm(c, g, day));
}
// Прошедшие (не сегодняшние) дни, где дневная норма не закрыта.
// restartFrom (dateKey) — «рестарт после провала»: пропуски до этой даты прощены и не считаются.
function missedDays(c, days, restartFrom) {
  const startKey = challengeStartKey(c);
  if (!startKey) return 0;
  let missed = 0;
  for (let day = 1; day < c.currentDay; day++) {
    const key = dateKey(dayEpoch(startKey, day));
    if (restartFrom && key < restartFrom) continue;
    if (!dayClosed(c, day, days[key] || {})) missed++;
  }
  return missed;
}
function allowedMisses(policy, throughDays) {
  if (policy === "never") return 0;
  if (policy === "onePerTwoWeeks") return Math.floor(Math.max(throughDays - 1, 0) / 14) + 1;
  return 1; // oneTotal и дефолт
}
function eliminatedByMisses(c, days, restartFrom) {
  if (c.type === "goal") return false; // у goal нет дневной нормы и выбывания
  return missedDays(c, days, restartFrom) > allowedMisses(c.missPolicy, c.currentDay - 1);
}
// Серия закрытых дней подряд от сегодня назад; незакрытое «сегодня» серию не рвёт.
function streakOf(c, days) {
  if (c.type === "goal") return 0; // у goal нет дневной серии
  const startKey = challengeStartKey(c);
  if (!startKey) return 0;
  let streak = 0;
  for (let day = c.currentDay; day >= 1; day--) {
    const closed = dayClosed(c, day, days[dateKey(dayEpoch(startKey, day))] || {});
    if (closed) streak++;
    else if (day === c.currentDay) continue; // сегодня ещё в процессе
    else break;
  }
  return streak;
}
// ---- Провал: пропущено больше дней, чем разрешает защита от пропусков ----
const FAIL_LINGER_MS = 2 * DAY; // столько провал висит «серым» в Active, потом — в Completed
// Провалил ли я streak-челлендж. Синк-челленджи считает applySync из Firebase
// (state="eliminated"); локальные — по workoutStatsByDay (completedAt = день закрыт).
function myFailed(c) {
  if (c.type === "goal") return false; // у goal нет дневной нормы и выбывания
  if (c.id === "main" && !Sync.enabled) return false; // демо-мок с фейковой историей не проваливаем
  const me = C.me(c);
  if (!me) return false;
  if (me.state === "eliminated") return true;
  if (Sync.enabled && c.isPublic) return false; // синк: по данным сервера я не выбыл
  const startKey = challengeStartKey(c);
  if (!startKey) return false; // ещё не стартовал
  let missed = 0;
  for (let day = 1; day < c.currentDay; day++) {
    const key = dateKey(dayEpoch(startKey, day));
    if (c.myRestartFrom && key < c.myRestartFrom) continue; // прощено рестартом
    const stats = (c.workoutStatsByDay || {})[key];
    if (!stats || !stats.completedAt) missed++;
  }
  return missed > allowedMisses(c.missPolicy, c.currentDay - 1);
}
// «Провалил, но хочу продолжать»: прощаем пропуски до сегодня и возвращаем в Active.
// Тотал/историю повторов не трогает — только точку отсчёта для будущих пропусков.
function restartFailed(id) {
  const c = app.challenges.find((x) => x.id === id);
  if (!c) return;
  const today = dateKey();
  const me = C.me(c);
  if (me) me.state = "active"; // оптимистично: мгновенный отклик, пока не долетел синк
  delete app.failedAt[id];
  if (c.id === "main") Sync.restart(today);
  else if (c.isPublic && Sync.enabled) Sync.restartChallenge(id, today);
  else c.myRestartFrom = today; // локальный (solo/private) — прощаем сами, без сервера
  saveApp();
  toast(t("Challenge restarted — keep going!"));
  render();
}
// Фиксируем момент провала (от него считаются «серые» два дня) и переводим себя
// в выбывшие — лидерборд и банк дальше считаются как для выбывшего.
function markFailures() {
  let changed = false;
  for (const c of app.challenges) {
    if (!myFailed(c)) continue;
    const me = C.me(c);
    if (me.state !== "eliminated") { me.state = "eliminated"; changed = true; }
    if (!app.failedAt[c.id]) { app.failedAt[c.id] = Date.now(); changed = true; }
  }
  if (changed) saveApp();
}
function failLingerOver(c) {
  const ts = app.failedAt[c.id];
  return ts != null && Date.now() - ts >= FAIL_LINGER_MS;
}
// Челлендж завершён по календарю: прожиты все дни от старта.
function challengeEnded(c) {
  const startKey = challengeStartKey(c);
  if (!startKey) return false;
  return startOfDay(Date.now()) >= dayEpoch(startKey, c.durationDays) + DAY;
}
function myStreak(c) {
  const me = C.me(c);
  return me && me._streak ? me._streak : 0;
}

function mockHistory(joined) {
  const today = startOfDay(Date.now());
  const out = [];
  for (let back = 29; back >= 1; back--) {
    const date = today - back * DAY;
    if (back % 9 === 0) { out.push({ id: uid(), date, entries: [] }); continue; }
    const entries = joined.map((ch, offset) => {
      const seed = back * 7 + offset * 3, norm = C.repsNorm(ch);
      let reps;
      switch (seed % 6) {
        case 0: reps = Math.floor(norm * 7 / 10); break;
        case 1: case 2: reps = norm + Math.floor(norm / 5); break;
        default: reps = norm;
      }
      // Разбивка по упражнениям пропорционально дневным нормам (для фильтра Weekly volume).
      const byEx = {}; let acc = 0;
      ch.goals.forEach((g, gi) => {
        const share = gi === ch.goals.length - 1 ? reps - acc : Math.round(reps * C.norm(ch, g) / (norm || 1));
        byEx[g.exercise] = Math.max(0, share); acc += byEx[g.exercise];
      });
      return { id: uid(), title: ch.title, norm, reps, byEx };
    });
    out.push({ id: uid(), date, entries });
  }
  return out;
}

// ==========================================================================
// AppState
// ==========================================================================
const TEST_COIN_GRANT = 1000;
const TEST_COIN_REFILL_THRESHOLD = 100;
const app = {
  balance: TEST_COIN_GRANT,
  transactions: [{ id: uid(), kind: "start", amount: TEST_COIN_GRANT, date: Date.now() }],
  challenges: mockChallenges(),
  history: [],
  measurements: [],
  totalReps: Sync.enabled ? 0 : 1760,
  repsByExercise: {}, // сумма повторов за всё время по типам упражнений
  leftMain: false,
  failedAt: {}, // challengeId → когда обнаружен провал (отсчёт «серых» дней до архива)
};
// Фиксированный порядок упражнений; новые типы появляются после существующих.
const EX_ORDER = ["pushups", "squats", "pullups", "dips"];
// Разбивка all-time повторов по упражнениям. Легаси/синхронизированные повторы, не
// привязанные к типу, показываем отдельной строкой «Прежние повторы» — не приписываем
// их к отжиманиям, чтобы не искажать статистику. Сумма всех строк = totalReps.
function exerciseBreakdown() {
  const by = {};
  for (const ex of EX_ORDER) by[ex] = 0;
  for (const [ex, n] of Object.entries(app.repsByExercise || {})) by[ex] = (by[ex] || 0) + n;
  const known = Object.values(by).reduce((a, b) => a + b, 0);
  const gap = (app.totalReps || 0) - known;
  if (gap > 0) by.other = gap;
  return by;
}
app.history = Sync.enabled ? [] : mockHistory(app.challenges.filter(C.isJoined));

// Применяет живые данные Firebase к общему челленджу: участники, мой прогресс, история.
function applySync() {
  const ch = app.challenges.find((c) => c.id === "main");
  const parts = Sync.state.participants;
  const today = dateKey();
  if (ch && parts) {
    ch.currentDay = currentDayFromStart(ch.durationDays); // свежий день для расчёта пропусков/стрика
    ch.participants = Object.entries(parts).map(([id, p]) => {
    const pdays = p.days || {};
    const day = pdays[today] || {};
    const todayReps = Object.values(day).reduce((a, b) => a + b, 0);
    const doneToday = ch.goals.every((g) => (day[g.exercise] || 0) >= C.norm(ch, g));
    const eliminated = eliminatedByMisses(ch, pdays, p.restartFrom);
    return { id, name: p.name || "?", isMe: id === Sync.uid, state: eliminated ? "eliminated" : "active",
      doneToday, todayReps, _days: pdays, _total: p.total || 0, _streak: streakOf(ch, pdays) };
    });
    const me = ch.participants.find((p) => p.isMe);
    if (me) {
    // Не затираем локальные повторы серверными: незасинканная офлайн-тренировка
    // (report повис в памяти SDK и не долетел) иначе пропала бы. Берём max, а если
    // локальное впереди сервера — досылаем, чтобы сервер догнал (по кругу не зациклит).
    const serverToday = me._days[today] || {};
    const localToday = ch.myTodayReps || {};
    const mergedToday = {};
    for (const ex of new Set([...Object.keys(localToday), ...Object.keys(serverToday)])) {
      mergedToday[ex] = Math.max(+localToday[ex] || 0, +serverToday[ex] || 0);
    }
    ch.myTodayReps = mergedToday;
    ch.myTotalReps = Math.max(+ch.myTotalReps || 0, me._total);
    ch.myTotalByExercise = totalsByExercise(me._days);
    app.totalReps = Math.max(+app.totalReps || 0, me._total);
    app.history = Object.entries(me._days).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, per]) => ({
      id: date, date: new Date(date + "T00:00:00").getTime(),
      entries: [{ id: date + "e", title: ch.title, norm: C.repsNorm(ch), reps: Object.values(per).reduce((a, b) => a + b, 0), byEx: per }],
    }));
    const ahead = ch.myTotalReps > me._total || Object.keys(mergedToday).some((ex) => (mergedToday[ex] || 0) > (+serverToday[ex] || 0));
    if (ahead && Sync.enabled) Sync.report(today, ch.myTodayReps, ch.myTotalReps);
    }
  }
  applyPublicChallenges(today);
  markFailures(); // сервер мог насчитать выбывание — фиксируем момент провала
}

// Старт remote-челленджа: private задаёт создатель (узел startAt); public стартует
// автоматически на следующий день после того, как собралось ≥ minPlayers и все нажали
// «Готов!». null = ещё Pending (стартовать нельзя).
function remoteStartAt(rec, m) {
  if (m.access === "private") return typeof rec.startAt === "number" ? rec.startAt : null;
  if (m.access === "public") {
    const parts = Object.values(rec.participants || {}), minP = m.minPlayers || 0;
    if (minP >= 2 && parts.length >= minP && parts.every((p) => typeof p.ready === "number")) {
      return startOfDay(Math.max(...parts.map((p) => p.ready))) + DAY;
    }
    return null;
  }
  return startOfDay(m.createdAt);
}
function applyPublicChallenges(today) {
  const remote = Sync.state.challenges;
  if (!remote) return;
  // Firebase is the source of truth for synced challenges. Remove stale copies left in
  // localStorage after an admin cleanup or a remote deletion; keep built-in and solo data.
  const remoteIds = new Set(Object.keys(remote));
  app.challenges = app.challenges.filter((c) => !String(c.id).startsWith("ch_") || remoteIds.has(c.id));
  for (const [id, rec] of Object.entries(remote)) {
    if (!rec.meta) continue;
    let c = app.challenges.find((x) => x.id === id);
    const m = rec.meta;
    // Приватные показываем только участникам и пришедшим по инвайт-ссылке — не всем подряд.
    const amMember = !!(rec.participants && Sync.uid && rec.participants[Sync.uid]);
    if (!c && m.access === "private" && !amMember && id !== JOIN_ID) continue;
    const start = remoteStartAt(rec, m); // null = ещё Pending
    if (!c) {
      c = newChallenge({ id, title: m.title, goals: Object.values(m.goals || {}), durationDays: m.durationDays,
        buyIn: m.buyIn, isPublic: true, type: m.type || "streak", access: m.access || "public", minPlayers: m.minPlayers || 0,
        ownerId: m.ownerId, missPolicy: m.missPolicy, progression: { step: m.progressionStep || 0, period: m.progressionPeriod || "day" },
        startAt: start, currentDay: 1, yesterdayDropouts: 0, participants: [], myTodayReps: {}, myTotalReps: 0 });
      app.challenges.push(c);
    } else if (start != null) {
      c.startAt = start; // старт мог измениться: создатель нажал «Начать» / собрались участники
    } else if (!(c.access === "private" && c.ownerId === Sync.uid && c.startAt != null)) {
      // Не сбрасываем в Pending старт, который владелец только что выставил локально
      // (Firebase ещё не подтвердил запись startAt).
      c.startAt = null;
    }
    c.currentDay = computeCurrentDay(c);
    c.participants = Object.entries(rec.participants || {}).map(([pid, p]) => {
      const days = p.days || {}, day = days[today] || {}, totals = totalsByExercise(days);
      // goal — «готово» по общей сумме к цели; streak — по сегодняшней норме.
      const done = c.goals.every((g) => (C.isGoal(c) ? (totals[g.exercise] || 0) : (day[g.exercise] || 0)) >= C.norm(c, g));
      return { id: pid, name: p.name || "?", isMe: pid === Sync.uid, state: eliminatedByMisses(c, days, p.restartFrom) ? "eliminated" : "active",
        doneToday: done, todayReps: Object.values(day).reduce((a, b) => a + b, 0), _days: days, _total: p.total || 0, _streak: streakOf(c, days),
        _ready: typeof p.ready === "number" ? p.ready : null };
    });
    const me = C.me(c);
    if (me) { c.myTodayReps = Object.assign({}, me._days[today] || {}); c.myTotalReps = me._total; c.myTotalByExercise = totalsByExercise(me._days); }
  }
  if (JOIN_ID && app.challenges.some((c) => c.id === JOIN_ID) && !ui.full && !ui.sheet) { ui.tab = "challenges"; ui.detailId = JOIN_ID; }
}
function totalsByExercise(days) {
  const totals = {};
  for (const per of Object.values(days || {})) for (const [exercise, reps] of Object.entries(per || {})) totals[exercise] = (totals[exercise] || 0) + (+reps || 0);
  return totals;
}
// ---- Персистентность: баланс, челленджи, история и замеры живут в localStorage ----
const LEGACY_SAVE_KEY = "fs.state";
let appStorageOwner = "guest";
let saveKey = "fs.state.guest";
function storageOwner() { return Sync.email && Sync.uid ? "user." + Sync.uid : "guest"; }
function storageKey(owner) { return "fs.state." + owner; }
function snapshotApp() {
  return { balance: app.balance, transactions: app.transactions, challenges: app.challenges,
    history: app.history, measurements: app.measurements, totalReps: app.totalReps, repsByExercise: app.repsByExercise, dayKey: app.dayKey, leftMain: app.leftMain, failedAt: app.failedAt };
}
let saveTimer = null;
let lastSavedState = null;
try {
  if (!localStorage.getItem(saveKey) && localStorage.getItem(LEGACY_SAVE_KEY)) localStorage.setItem(saveKey, localStorage.getItem(LEGACY_SAVE_KEY));
  lastSavedState = localStorage.getItem(saveKey);
} catch {}
function saveApp() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const serialized = JSON.stringify(snapshotApp());
    if (serialized === lastSavedState) return;
    try { localStorage.setItem(saveKey, serialized); lastSavedState = serialized; }
    catch {
      // квота переполнена — сохраняем без фото
      const slim = snapshotApp();
      slim.challenges = slim.challenges.map((c) => Object.assign({}, c, { beforePhoto: null, afterPhoto: null }));
      const slimSerialized = JSON.stringify(slim);
      if (slimSerialized === lastSavedState) return;
      try { localStorage.setItem(saveKey, slimSerialized); lastSavedState = slimSerialized; } catch {}
    }
  }, 250);
}
function restoreAppState(saved) {
  app.dayKey = dateKey();
  if (!saved || !Array.isArray(saved.challenges) || !saved.challenges.length) return;
  app.balance = saved.balance != null ? saved.balance : app.balance;
  app.transactions = saved.transactions || app.transactions;
  app.challenges = saved.challenges;
  app.challenges.forEach((c) => {
    if (!c.myTotalByExercise) c.myTotalByExercise = {};
    if (!c.workoutStatsByDay) c.workoutStatsByDay = {};
    // Миграция полей типа/доступа/старта: старые сейвы их не знают, но все они уже стартовали.
    if (c.type == null) c.type = "streak";
    if (c.minPlayers == null) c.minPlayers = 0;
    if (c.access == null) c.access = c.id === "main" ? "public" : (c.isPublic ? "private" : "solo");
    if (c.startAt === undefined) c.startAt = c.id === "main" ? null : (c.startedAt != null ? startOfDay(c.startedAt) : startOfDay(Date.now()));
  });
  app.history = saved.history || [];
  app.measurements = saved.measurements || [];
  app.totalReps = saved.totalReps != null ? saved.totalReps : (saved.totalPushups || 0); // миграция старого ключа
  app.repsByExercise = saved.repsByExercise || {};
  app.dayKey = saved.dayKey || dateKey();
  app.leftMain = saved.leftMain || false;
  app.failedAt = saved.failedAt || {};
  // Конфигурация общего челленджа всегда из кода — старое сохранение не должно блокировать обновления.
  const tpl = mockChallenges()[0];
  const main = app.challenges.find((c) => c.id === "main");
  if (!main) { if (!app.leftMain) app.challenges.unshift(tpl); }
  else {
    Object.assign(main, { title: tpl.title, goals: tpl.goals, durationDays: tpl.durationDays, buyIn: tpl.buyIn, isPublic: tpl.isPublic });
    if (Sync.enabled) main.currentDay = currentDayFromStart(main.durationDays);
  }
}
try { restoreAppState(JSON.parse(localStorage.getItem(saveKey))); } catch {}

function switchAppStorageOwner() {
  const owner = storageOwner();
  if (owner === appStorageOwner) return;
  clearTimeout(saveTimer);
  try { localStorage.setItem(saveKey, JSON.stringify(snapshotApp())); } catch {}
  appStorageOwner = owner;
  saveKey = storageKey(owner);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(saveKey)); } catch {}
  app.balance = TEST_COIN_GRANT;
  app.transactions = [{ id: uid(), kind: "start", amount: TEST_COIN_GRANT, date: Date.now() }];
  app.challenges = mockChallenges();
  app.history = [];
  app.measurements = [];
  app.totalReps = 0;
  app.repsByExercise = {};
  app.dayKey = dateKey();
  app.leftMain = false;
  app.failedAt = {};
  restoreAppState(saved);
  lastSavedState = saved ? JSON.stringify(snapshotApp()) : null;
}
markFailures(); // пропуски могли накопиться, пока приложение было закрыто
{
  const w = store["profile.weightKg"], m = store["profile.maxReps"];
  if (store.onboarded && w > 0 && m > 0 && !app.measurements.length) app.measurements = [{ id: uid(), date: Date.now(), weight: w, maxReps: m }];
}

// ---- Смена дня: приложение может жить открытым сутками — сбрасываем «сегодня» и двигаем номер дня ----
function rolloverIfNeeded() {
  const now = dateKey();
  if (app.dayKey === now) return false;
  app.dayKey = now;
  for (const c of app.challenges) {
    c.myTodayReps = {};
    for (const p of c.participants) { p.doneToday = false; p.todayReps = 0; }
    c.currentDay = computeCurrentDay(c);
  }
  applySync(); // с Firebase «сегодня» пересоберётся из данных нового дня
  markFailures(); // новый день мог добавить пропуск сверх защиты
  saveApp();
  return true;
}

function spend(amount, title) {
  if (amount <= 0) return true; // бесплатный челлендж (нулевой взнос) — без списания и записи
  if (app.balance < amount) return false;
  app.balance -= amount;
  app.transactions.unshift({ id: uid(), kind: "buyIn", challenge: title, amount: -amount, date: Date.now() });
  return true;
}

function restoreTestCoins() {
  if (app.balance >= TEST_COIN_REFILL_THRESHOLD) return;
  const amount = TEST_COIN_GRANT - app.balance;
  app.balance = TEST_COIN_GRANT;
  app.transactions.unshift({ id: uid(), kind: "refill", amount, date: Date.now() });
  saveApp();
  track("test_balance_restored", { amount });
  render();
  toast(t("+%lld coins", amount));
}

function logEntry(title, norm, reps, byEx) {
  const today = startOfDay(Date.now());
  let last = app.history[app.history.length - 1];
  if (!last || startOfDay(last.date) !== today) { last = { id: uid(), date: today, entries: [] }; app.history.push(last); }
  const e = last.entries.find((x) => x.title === title);
  if (e) {
    e.reps += reps; if (norm != null) e.norm = norm;
    if (byEx) { e.byEx = e.byEx || {}; for (const [ex, n] of Object.entries(byEx)) e.byEx[ex] = (e.byEx[ex] || 0) + n; }
  } else last.entries.push({ id: uid(), title, norm, reps, byEx: byEx ? Object.assign({}, byEx) : undefined });
}

function paidStorageKey(challengeId) {
  return "fs.paid." + (Sync.uid || "guest") + "." + challengeId;
}

async function joinChallenge(ch, weight, maxReps, beforePhoto) {
  if (C.isJoined(ch)) return false;
  const paidKey = paidStorageKey(ch.id);
  const alreadyPaid = !!localStorage.getItem(paidKey);
  if (!alreadyPaid && app.balance < ch.buyIn) return false;
  if (ch.isPublic && Sync.enabled && !(await Sync.joinChallenge(ch.id, store["profile.name"]))) return null;
  if (!alreadyPaid && !spend(ch.buyIn, ch.title)) return false;
  localStorage.setItem(paidKey, "1");
  ch.participants.unshift({ id: Sync.uid || uid(), name: "", isMe: true, state: "active", doneToday: false, todayReps: 0, _days: {}, _total: 0 });
  ch.startWeight = weight; ch.startMaxReps = maxReps; ch.beforePhoto = beforePhoto || null;
  if (ch.id === "main") Sync.join(store["profile.name"]);
  track("challenge_joined", { challenge_id: ch.id, buy_in: ch.buyIn, exercises: ch.goals.map((g) => g.exercise).join(",") });
  return true;
}

async function createChallenge(o) {
  if (app.balance < o.buyIn) return false;
  const id = o.id || ("ch_" + (Sync.uid || "local") + "_" + Date.now().toString(36));
  if (o.isPublic && Sync.enabled) {
    const published = await Sync.createChallenge(id, { title: o.title, goals: o.goals, durationDays: o.durationDays, buyIn: o.buyIn,
      type: o.type || "streak", access: o.access || "public", minPlayers: o.minPlayers || 0,
      missPolicy: o.missPolicy, progressionStep: o.progression.step, progressionPeriod: o.progression.period }, store["profile.name"]);
    if (!published) return "publish-failed";
  }
  spend(o.buyIn, o.title);
  app.challenges.unshift(newChallenge(Object.assign({ id, ownerId: o.isPublic ? Sync.uid : null, currentDay: 1, yesterdayDropouts: 0, startAt: startOfDay(Date.now()), participants: [{ id: Sync.uid || uid(), name: store["profile.name"] || "", isMe: true, state: "active", doneToday: false, todayReps: 0 }] }, o)));
  localStorage.setItem("fs.paid." + id, "1");
  ui.createdChallengeId = id;
  return true;
}

// Выход из челленджа: взнос НЕ возвращается, прогресс/результаты пропадают. Челлендж
// убираем из списка; общий "main" помечаем leftMain, чтобы он не вернулся при перезапуске.
function leaveChallenge(id) {
  const leaving = app.challenges.find((c) => c.id === id);
  app.challenges = app.challenges.filter((c) => c.id !== id);
  if (id === "main") app.leftMain = true;
  else if (leaving && leaving.isPublic) Sync.leaveChallenge(id).then((ok) => { if (!ok) toast(t("Couldn't leave challenge")); });
  localStorage.removeItem(paidStorageKey(id));
  saveApp();
  track("challenge_left", { challenge_id: id });
}

// Создатель private-челленджа запускает его (сегодня/завтра/соло). Пишем дату старта в Firebase
// (владелец), обновляем локально и уведомляем участников. Челлендж уходит из Pending.
function startChallengeNow(id, ts) {
  const c = app.challenges.find((x) => x.id === id);
  if (!c || c.ownerId == null || c.ownerId !== Sync.uid) return;
  c.startAt = ts;
  c.currentDay = computeCurrentDay(c);
  if (Sync.enabled) Sync.setStartAt(id, ts).then((ok) => { if (!ok) toast(t("Couldn't start challenge")); });
  publishStartActivity(c, ts);
  ui.challengeTab = ts <= startOfDay(Date.now()) ? "active" : "pending";
  saveApp();
  render();
  track("challenge_started", { challenge_id: id, when: ts <= startOfDay(Date.now()) ? "today" : "tomorrow" });
}

// Участник public-челленджа нажал «Готов!». Если моим действием сбор завершился
// (собрано ≥ minPlayers и все готовы) — я публикую уведомление о старте.
function markReady(id) {
  const c = app.challenges.find((x) => x.id === id);
  if (!c) return;
  const me = C.me(c);
  if (me) me._ready = Date.now();
  if (Sync.enabled) Sync.setReady(id).then((ok) => { if (!ok) toast(t("Couldn't mark ready")); });
  const readyCount = c.participants.filter((p) => p._ready).length;
  if (c.access === "public" && c.participants.length >= c.minPlayers && readyCount >= c.participants.length) {
    publishStartActivity(c, startOfDay(Date.now()) + DAY);
  }
  render();
}

// Уведомление участникам, что челлендж стартует. dateKey старта → «сегодня/завтра» при показе.
function publishStartActivity(c, ts) {
  if (!Sync.enabled) return;
  Sync.publishActivity({ challengeId: c.id, challengeTitle: c.title, type: "start",
    actorName: store["profile.name"] || "Player", dateKey: dateKey(ts) });
}

// Плюсует подход; возвращает true, если дневная норма закрылась впервые.
function addReps(ch, counts, sessionStats, sessionDayKey = dateKey()) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return false;
  const me = C.me(ch);
  if (!me) return false;
  const wasDone = C.isTodayDone(ch);
  const completedBefore = new Set(ch.goals.filter((g) => C.exProgress(ch, g) >= C.norm(ch, g)).map((g) => g.exercise));
  app.totalReps += total;
  logEntry(ch.title, C.repsNorm(ch), total, counts);
  for (const [ex, reps] of Object.entries(counts)) if (reps > 0) {
    ch.myTodayReps[ex] = (ch.myTodayReps[ex] || 0) + reps;
    ch.myTotalByExercise = ch.myTotalByExercise || {};
    ch.myTotalByExercise[ex] = (ch.myTotalByExercise[ex] || 0) + reps;
    app.repsByExercise[ex] = (app.repsByExercise[ex] || 0) + reps;
  }
  ch.myTotalReps += total;
  me.todayReps = C.myTodayTotal(ch);
  if (C.isTodayDone(ch)) me.doneToday = true;
  if (C.isGoal(ch) && C.isFinished(ch)) ch.isCompleted = true; // цель достигнута → челлендж завершён
  const closed = !wasDone && C.isTodayDone(ch);
  if (sessionStats && sessionStats.elapsedMs > 0) {
    ch.workoutStatsByDay = ch.workoutStatsByDay || {};
    const key = sessionDayKey;
    const day = ch.workoutStatsByDay[key] || { elapsedMs: 0, restMs: 0, setReps: [], reps: 0, completedAt: null };
    day.elapsedMs += Math.max(0, Math.round(sessionStats.elapsedMs));
    day.restMs += Math.max(0, Math.round(sessionStats.restMs || 0));
    day.setReps.push(...(sessionStats.setReps || []).filter((n) => +n > 0).map(Number));
    day.reps += total;
    if (closed) day.completedAt = Date.now();
    ch.workoutStatsByDay[key] = day;
  }
  if (ch.id === "main") Sync.report(sessionDayKey, ch.myTodayReps, ch.myTotalReps);
  else if (ch.isPublic) Sync.reportChallenge(ch.id, sessionDayKey, ch.myTodayReps, ch.myTotalReps);
  if (Sync.enabled && ch.participants.length > 1) {
    const base = { actorName: store["profile.name"] || "Player", challengeId: ch.id, challengeTitle: ch.title, dateKey: sessionDayKey };
    if (closed) Sync.publishActivity(Object.assign({}, base, { type: "day" }));
    else {
      for (const g of ch.goals) {
        if (!completedBefore.has(g.exercise) && (ch.myTodayReps[g.exercise] || 0) >= C.norm(ch, g)) {
          Sync.publishActivity(Object.assign({}, base, { type: "exercise", exercise: g.exercise }));
        }
      }
    }
  }
  track("reps_added", { challenge_id: ch.id, total, exercises: Object.keys(counts).filter((k) => counts[k] > 0).join(",") });
  if (closed) track("workout_completed", { challenge_id: ch.id, day: ch.currentDay });
  return closed;
}

function completeChallenge(ch, afterPhoto, weight, maxReps) {
  ch.afterPhoto = afterPhoto || null; ch.isCompleted = true;
  addMeasurement(weight, maxReps);
}
function addMeasurement(weight, maxReps) { app.measurements.push({ id: uid(), date: Date.now(), weight, maxReps }); }

// ==========================================================================
// Онбординг: уровни и расчёт нормы
// ==========================================================================
const Gender = { all: ["male", "female", "other"], name: (g) => ({ male: t("Male"), female: t("Female"), other: t("Other") }[g]) };
const Level = {
  all: ["beginner", "regular", "athlete"],
  name: (l) => ({ beginner: t("Beginner"), regular: t("Regular"), athlete: t("Athlete") }[l]),
  subtitle: (l) => ({ beginner: t("I barely train"), regular: t("A few times a week"), athlete: t("Almost every day") }[l]),
  sets: (l) => ({ beginner: 2, regular: 3, athlete: 4 }[l]),
};
function recommendedDailyReps(level, maxReps) {
  const rounded = Math.floor((maxReps * Level.sets(level) + 5) / 10) * 10;
  return Math.min(Math.max(rounded, 10), 300);
}
// Три варианта дневной нормы от базовой рекомендации: легче / рекомендовано / интенсивнее.
function goalForChoice(level, maxReps, choice) {
  const base = recommendedDailyReps(level, maxReps);
  const f = choice === "easier" ? 0.7 : choice === "harder" ? 1.3 : 1;
  return Math.min(Math.max(Math.round(base * f / 10) * 10, 10), 300);
}
// ==========================================================================
// UI-состояние и рендер (см. app-ui.js — экраны ниже в этом же файле)
// ==========================================================================
const ui = { screen: "onboarding", tab: "yours", detailId: null, sheet: null, full: null, onbStep: 0, form: null, profileSection: null, workoutResult: null };

function isGuest() { return !Sync.enabled || Sync.isAnonymous || !Sync.email; }

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const root = document.getElementById("app");

// Высота формы остаётся стабильной при открытии клавиатуры: клавиатура перекрывает
// нижнюю CTA, но не поднимает её. Новую высоту принимаем только без клавиатуры.
let stableAppHeight = window.innerHeight;
function syncAppHeight(force) {
  const viewport = window.visualViewport;
  const height = Math.max(window.innerHeight, viewport ? viewport.height : 0);
  if (force || height >= stableAppHeight - 100) stableAppHeight = height;
  if (stableAppHeight > 0) document.documentElement.style.setProperty("--app-height", `${Math.round(stableAppHeight)}px`);
}
syncAppHeight();
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => syncAppHeight(false), { passive: true });
  window.visualViewport.addEventListener("scroll", () => syncAppHeight(false), { passive: true });
}
window.addEventListener("orientationchange", () => { stableAppHeight = 0; syncAppHeight(true); }, { passive: true });
window.addEventListener("pageshow", () => syncAppHeight(false), { passive: true });
let scrollMemo = {};
// Системная настройка «уменьшить движение» — гасим необязательный моушн.
const REDUCE_MOTION = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Тактильный отклик. Работает на Android/поддерживающих браузерах; на iOS Safari вибро
// недоступно — тихо игнорируется. При «уменьшить движение» не срабатывает.
function haptic(pattern) { if (!REDUCE_MOTION() && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }
// Короткие синтезированные звуки (без файлов): "tap" — нажатие кнопки, "tick" — прокрутка колеса.
// AudioContext создаётся/возобновляется внутри пользовательского жеста (тап/скролл) — iOS это требует.
let _audioCtx = null;
// Палитра звуков: у каждого действия свой тембр. f2 (если есть) — глиссандо частоты.
const SFX = {
  tap:       { wave: "triangle", f1: 620,  dur: 0.05,  peak: 0.08 }, // обычная кнопка
  soft:      { wave: "sine",     f1: 380,  dur: 0.055, peak: 0.06 }, // назад/закрыть
  toggle:    { wave: "square",   f1: 480,  f2: 640,  dur: 0.04,  peak: 0.045 }, // тумблер/сегмент
  tick:      { wave: "sine",     f1: 1150, dur: 0.022, peak: 0.045 }, // прокрутка колеса
  input:     { wave: "sine",     f1: 300,  dur: 0.045, peak: 0.05 }, // фокус на поле ввода
  challenge: { wave: "triangle", f1: 660,  f2: 990,  dur: 0.11,  peak: 0.09 }, // челленджи
  coin:      { wave: "triangle", f1: 880,  f2: 1400, dur: 0.13,  peak: 0.09 }, // монеты/покупка
  start:     { wave: "sine",     f1: 300,  f2: 200,  dur: 0.16,  peak: 0.05 }, // старт тренировки (низкий, тихий, мягкий)
};
// Один осциллятор с огибающей. Общий низкоуровневый примитив для всех звуков.
function _tone(p, at) {
  const ctx = _audioCtx, s = (at != null ? at : ctx.currentTime) + (p.delay || 0), dur = p.dur;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = p.wave;
  o.frequency.setValueAtTime(p.f1, s);
  if (p.f2) o.frequency.exponentialRampToValueAtTime(p.f2, s + dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(p.peak, s + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(s); o.stop(s + dur + 0.02);
}
function _ensureCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
}
// Звуки интерфейса (кнопки/переключатели/формы/покупки). Гасятся настройкой Interface sounds.
function sfx(type) {
  if (!store.interfaceSounds) return;
  const p = SFX[type] || SFX.tap;
  try { _ensureCtx(); _tone(p); } catch (e) {}
}
// ==========================================================================
// Звуки тренировки (повтор/юбилей/завершение/переход/предупреждение/запись).
// Гасятся настройкой Workout sounds. Приоритет главных событий — см. wsfxMain().
// ==========================================================================
const WSFX = {
  rep:        [{ wave: "sine",     f1: 880,  dur: 0.06, peak: 0.06 }], // обычный повтор — мягкий короткий
  milestone:  [{ wave: "triangle", f1: 784, dur: 0.28, peak: 0.07 }, { wave: "triangle", f1: 988, dur: 0.28, peak: 0.07, delay: 0.05 }, { wave: "triangle", f1: 1319, dur: 0.28, peak: 0.07, delay: 0.1 }], // юбилей — аккорд G5·B5·E6
  exercise:   [{ wave: "triangle", f1: 660, f2: 990, dur: 0.16, peak: 0.08 }, { wave: "triangle", f1: 1319, dur: 0.26, peak: 0.08, delay: 0.14 }], // упражнение закрыто
  workout:    [{ wave: "triangle", f1: 523, dur: 0.16, peak: 0.09 }, { wave: "triangle", f1: 659, dur: 0.16, peak: 0.09, delay: 0.14 }, { wave: "triangle", f1: 784, dur: 0.16, peak: 0.09, delay: 0.28 }, { wave: "triangle", f1: 1047, dur: 0.42, peak: 0.1, delay: 0.42 }], // вся тренировка — восходящая фанфара C·E·G·C
  transition: [{ wave: "sine",     f1: 500, f2: 760, dur: 0.12, peak: 0.06 }], // переход к следующему упражнению
  warning:    [{ wave: "square",   f1: 200, dur: 0.14, peak: 0.05 }], // пользователь вышел из кадра
  recStart:   [{ wave: "sine",     f1: 660, dur: 0.06, peak: 0.06 }], // старт записи
  recStop:    [{ wave: "sine",     f1: 660, dur: 0.05, peak: 0.06 }, { wave: "sine", f1: 660, dur: 0.05, peak: 0.06, delay: 0.1 }], // стоп записи — двойной
  recError:   [{ wave: "sawtooth", f1: 400, f2: 200, dur: 0.22, peak: 0.06 }], // ошибка записи
  countdown:  [{ wave: "sine",     f1: 440, dur: 0.11, peak: 0.06 }], // отсчёт 3·2·1 — мягкий ровный бип, три одинаковых
  go:         [{ wave: "triangle", f1: 523, f2: 784, dur: 0.16, peak: 0.09 }, { wave: "triangle", f1: 1047, dur: 0.26, peak: 0.1, delay: 0.13 }], // старт счёта — короткое восходящее «поехали» (C5→G5, затем C6)
};
function wsfx(name) {
  if (!store.workoutSounds) return;
  const seq = WSFX[name];
  if (!seq) return;
  try { _ensureCtx(); const t0 = _audioCtx.currentTime; seq.forEach((p) => _tone(p, t0)); } catch (e) {}
}
// Главное событие повтора — только один звук за раз по приоритету:
// workout > exercise > milestone > rep. Нельзя проиграть rep+milestone одновременно.
function wsfxMain(event) {
  if (event === "workout") wsfx("workout");
  else if (event === "exercise") wsfx("exercise");
  else if (event === "milestone") wsfx("milestone");
  else if (event === "rep") wsfx("rep");
}
// Какой звук проиграть на команду. Вся навигация — один глухой «пуп» (soft).
const NAV_CMDS = ["tab", "open", "back", "closeSheet", "closeFull", "closeSheetBg", "onbBack", "onbNext",
  "participant", "findChallenge", "startPick", "showResult", "join", "create", "addMeasure", "openBug", "askLeave"];
function sfxFor(cmd, arg) {
  if (cmd === "toggle" || cmd === "seg") return "toggle";
  if (cmd === "restoreTestCoins") return "coin";
  if (cmd === "play") return "start";
  if (NAV_CMDS.includes(cmd)) return "soft";
  return "tap";
}
function render() {
  rolloverIfNeeded();
  document.documentElement.lang = store.lang === "ua" ? "uk" : store.lang;
  if (ui.screen === "onboarding") { root.innerHTML = Onboarding() + (ui.sheet ? ui.sheet() : "") + (ui.full ? ui.full() : ""); afterRender(); return; }
  let html = "";
  if (ui.detailId) html = DetailScreen(ui.detailId);
  else {
    html = `<div class="screen" id="scroller">${{ yours: YoursTab, challenges: ChallengesTab, stats: StatsTab, profile: ProfileTab }[ui.tab]()}</div>`;
  }
  html += TabBar();
  // FAB «Новый челлендж» — фиксирован над таб-баром, только на списке челленджей (не под шитами/деталью).
  if (ui.tab === "challenges" && !ui.detailId && !ui.sheet && !ui.full) html += `<button class="fab" data-act="create">${icon("plus")}<span>${t("New challenge")}</span></button>`;
  if (!ui.detailId && !ui.sheet && !ui.full) html += pwaHint();
  if (ui.sheet) html += ui.sheet();
  if (ui.full) html += ui.full();
  root.innerHTML = html;
  afterRender();
}

// Навигация — через нативный View Transitions API: браузер атомарно кроссфейдит
// старый DOM в новый. Никаких клонов/призраков поверх body → слои не наложатся.
// Фолбэк (нет поддержки / reduced motion) — обычный мгновенный render.
// before() выполняется ВНУТРИ перехода (после снятия старого кадра, перед render):
// туда уносим сброс скролла, иначе старый кадр снимется уже прокрученным наверх.
function navRender(before) {
  if (REDUCE_MOTION() || typeof document.startViewTransition !== "function") { if (before) before(); render(); return; }
  // На время перехода стекло непрозрачно: в VT-снимках backdrop-filter не работает,
  // иначе контент просвечивает и блюр «догоняет» после анимации (правило .vt в styles.css).
  document.documentElement.classList.add("vt");
  const vt = document.startViewTransition(() => { if (before) before(); render(); });
  const cleanup = () => document.documentElement.classList.remove("vt");
  const guard = setTimeout(() => { try { vt.skipTransition(); } catch {} cleanup(); }, 900);
  vt.ready.catch(() => {}); // быстрая повторная навигация прерывает переход → AbortError, глушим
  vt.finished.catch(() => {}).finally(() => { clearTimeout(guard); cleanup(); });
}

// Подсказка «на экран Домой» — только iOS Safari вне standalone; закрывается навсегда.
function pwaHint() {
  if (localStorage.getItem("fs.pwahint")) return "";
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (!isIOS || standalone) return "";
  return `<div class="pwa-hint">
    <span style="display:flex;color:var(--accent)">${icon("share")}</span>
    <span style="flex:1;font-size:13px;font-weight:500">${t("Add to Home Screen: Share → Add to Home Screen")}</span>
    <button data-act="dismissPwa" style="display:flex;color:var(--text-secondary);padding:4px">${icon("xmark")}</button>
  </div>`;
}

function go(tab) { ui.tab = tab; ui.detailId = null; ui.profileSection = null; navRender(() => window.scrollTo(0, 0)); }
function openDetail(id) { ui.detailId = id; navRender(() => window.scrollTo(0, 0)); }
function back() { ui.detailId = null; navRender(() => window.scrollTo(0, 0)); }
function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.className = "toast"; // внешний вид (стекло) — в styles.css
  el.style.cssText = "position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom));transform:translateX(-50%);padding:12px 18px;z-index:200;font-weight:600";
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add("toast--out"); setTimeout(() => el.remove(), 220); }, 1700);
}

// Индикация «в процессе» для сетевых кнопок: подпись + aria-busy + блокировка
// от повторного нажатия. Восстановление нужно только при ошибке — успех перерисует UI.
function setBtnLoading(el, on, text) {
  if (!el) return;
  if (on) {
    if (el._label == null) el._label = el.innerHTML;
    el.disabled = true;
    el.setAttribute("aria-busy", "true");
    el.textContent = text;
  } else {
    el.disabled = false;
    el.removeAttribute("aria-busy");
    if (el._label != null) { el.innerHTML = el._label; el._label = null; }
  }
}

// ==========================================================================
// Мелкие компоненты
// ==========================================================================
function bar(frac, money) {
  const f = Math.max(0, Math.min(1, frac || 0)) * 100;
  return `<div class="progress ${money ? "money" : ""}"><span style="width:${f}%"></span></div>`;
}
// Кольцо прогресса упражнения в комбо-карточке: тап → запуск именно этого упражнения.
function progressRing(id, g, reps, norm, done) {
  const circ = 2 * Math.PI * 30;
  const off = circ * (1 - Math.max(0, Math.min(1, norm ? reps / norm : 0)));
  const col = done ? "var(--money)" : "var(--accent)";
  return `<button data-act="play:${id}:${g.exercise}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px">
    <span style="position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center">
      <svg width="72" height="72" viewBox="0 0 72 72" style="position:absolute;inset:0;transform:rotate(-90deg)">
        <circle cx="36" cy="36" r="30" fill="none" stroke="var(--white-08)" stroke-width="6"/>
        <circle cx="36" cy="36" r="30" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <span style="display:flex;color:${col}">${exIcon(g.exercise, "ring-ic")}</span>
    </span>
    <span class="money ${done ? "c-money" : "c-white"}" style="font-size:13px;line-height:1">${reps}/${norm}</span>
    <span class="secondary" style="font-size:10px;line-height:1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(Exercise.displayName(g.exercise))}</span>
  </button>`;
}
function badge(text, color) { return `<span class="badge" style="color:${color}">${esc(text)}</span>`; }
function streakPill(n) { return n >= 2 ? `<span class="streak-pill">🔥 ${n}</span>` : ""; }
function lbl(text, extra = "") { return `<span class="label secondary ${extra}" style="font-size:13px">${esc(text)}</span>`; }

// Язык всегда доступен справа от заголовка основных экранов.
function screenHeader(title) {
  const unread = unreadActivityCount();
  return `<div class="screen-head">
    <div class="between" style="gap:12px"><h1 class="screen-title">${esc(title)}</h1><div class="row gap8">
      <button class="header-icon-btn" data-act="openBug" aria-label="${t("Report a problem")}">${icon("bug")}</button>
      <button class="header-icon-btn" data-act="openNotifications" aria-label="${t("Notifications")}">${icon("bell")}${unread ? `<span class="notification-count">${Math.min(unread, 9)}${unread > 9 ? "+" : ""}</span>` : ""}</button>
      ${langToggle()}</div></div>
  </div>`;
}
function langToggle() {
  const code = store.lang === "ua" ? "UA" : store.lang.toUpperCase();
  return `<button class="badge language-trigger" data-act="openLanguage" aria-label="${esc(t("Choose language"))}">${code}</button>`;
}

function TabBar() {
  const tabs = [["yours", t("Home"), "home"], ["challenges", t("Challenges"), "flame"], ["stats", t("Progress"), "chartBar"], ["profile", t("Profile"), "person"]];
  return `<nav class="tabbar">${tabs.map(([k, name, ic]) =>
    `<button data-act="tab:${k}" class="${ui.tab === k && !ui.detailId ? "active" : ""}">${icon(ic)}<span>${esc(name)}</span></button>`).join("")}</nav>`;
}

// ==========================================================================
// Карточка челленджа
// ==========================================================================
function ChallengeCard(c, withPlay) {
  const joined = C.isJoined(c);
  const failed = joined && myFailed(c);
  const doneBorder = joined && C.isTodayDone(c) ? "done" : "";
  const todayRows = c.goals.map((g) => {
    // goal — прогресс к общей цели; streak — к дневной норме.
    const reps = C.exProgress(c, g), norm = C.norm(c, g), done = reps >= norm;
    return `<div style="display:flex;flex-direction:column;gap:5px">
      <div class="between" style="align-items:baseline">
        ${lbl(Exercise.displayName(g.exercise), "tracking-1")}
        <span class="money ${done ? "c-money" : "c-white"}" style="font-size:28px">${reps} / ${norm}</span>
      </div>${bar(reps / norm, done)}</div>`;
  }).join("");

  const joinedFooter = `
    ${todayRows}
    <div class="between" style="align-items:baseline">
      <div><div>${lbl(t("Challenge total"), "tracking-1")}</div><div class="money" style="font-size:20px">${c.myTotalReps}</div></div>
      <div style="text-align:right"><div>${lbl(t("You'd win"), "tracking-1")}</div><div class="c-money" style="font-size:20px">${coin(C.payout(c))}</div></div>
    </div>`;
  const openFooter = `
    <div class="between" style="align-items:baseline">
      <div><div>${lbl(t("Prize pool"), "tracking-1")}</div><div class="c-money" style="font-size:26px">${coin(C.pot(c))}</div></div>
      <div style="text-align:right"><div>${lbl(t("You'd win"), "tracking-1")}</div><div class="money" style="font-size:20px">${coin(C.payout(c))}</div></div>
    </div>`;

  const canPlay = joined && !failed && !C.isTodayDone(c) && !challengeEnded(c);
  const playBtn = canPlay ? (withPlay
    ? `<button class="card-play" data-act="play:${c.id}" style="width:44px;height:44px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center">${iconF("play")}</button>`
    : `<span style="width:44px;height:44px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center">${iconF("play")}</span>`) : "";

  return `<div class="card challenge-card ${doneBorder}${failed ? " failed" : ""}"><button class="challenge-card-main" data-act="open:${c.id}">
    <div class="between" style="align-items:flex-start">
      <div style="font-size:20px;font-weight:700">${esc(c.title)}</div>
      <div class="row gap6">${failed ? "" : `${c.ownerId === Sync.uid ? badge(t("Creator"), "var(--accent)") : joined && c.isPublic ? badge(t("Joined"), "var(--money)") : ""}${joined ? streakPill(myStreak(c)) : ""}${challengeEnded(c) ? badge(t("Completed"), "var(--money)") : badge(c.isPublic ? t("Public") : t("Private"), c.isPublic ? "var(--text-secondary)" : "var(--purple)")}`}</div>
    </div>
    ${!joined ? `<div class="between">${lbl(C.goalsText(c))}${lbl(t("Day %lld of %lld", c.currentDay, c.durationDays))}</div>` : ""}
    ${joined ? joinedFooter : openFooter}
  </button>${failed ? `<span class="challenge-fail-mark" aria-label="${t("Failed")}">${iconF("xCircle")}</span>` : ""}${playBtn ? `<div class="challenge-card-action">${playBtn}</div>` : ""}</div>`;
}

// Карточка ещё не стартовавшего челленджа (Pending): private ждёт создателя,
// public — набора участников. Кнопки зависят от роли и типа доступа.
function PendingCard(c) {
  const isOwner = c.ownerId != null && c.ownerId === Sync.uid;
  const players = c.participants.length;
  const me = C.me(c);
  const readyCount = c.participants.filter((p) => p._ready).length;
  let statusLine, actions;
  if (c.access === "public") {
    statusLine = t("Gathered %lld / %lld · %lld ready", players, c.minPlayers, readyCount);
    actions = me && !me._ready
      ? `<button class="action-btn" data-act="setReady:${c.id}">${iconF("checkCircle")}${t("Ready!")}</button>`
      : `<div class="secondary center" style="font-size:13px">${t("Waiting for everyone to gather and get ready…")}</div>`;
  } else {
    statusLine = t("%lld players", players);
    if (isOwner && players > 1) {
      actions = `<div class="row gap8"><button class="action-btn" data-act="startToday:${c.id}" style="flex:1">${t("Start today")}</button><button class="action-btn plain" data-act="startTomorrow:${c.id}" style="flex:1">${t("Start tomorrow")}</button></div>`;
    } else if (isOwner) {
      actions = `<button class="action-btn" data-act="startSolo:${c.id}">${iconF("flame")}${t("Start solo!")}</button>`;
    } else {
      actions = `<div class="secondary center" style="font-size:13px">${t("Waiting for the creator to start…")}</div>`;
    }
  }
  return `<div class="card challenge-card">
    <button class="challenge-card-main" data-act="open:${c.id}">
      <div class="between" style="align-items:flex-start">
        <div style="font-size:20px;font-weight:700">${esc(c.title)}</div>
        <div class="row gap6">${badge(c.access === "public" ? t("Public") : t("Private"), c.access === "public" ? "var(--text-secondary)" : "var(--purple)")}</div>
      </div>
      <div class="between"><span class="secondary">${esc(C.goalsText(c))}</span><span class="secondary">${t("%lld days", c.durationDays)}</span></div>
      <div class="secondary" style="font-size:13px">${esc(statusLine)}</div>
    </button>
    <div class="challenge-pending-actions">
      <button class="action-btn plain" data-act="invitePending:${c.id}">${icon("share")}${t("Invite friends")}</button>
      ${actions}
    </div>
  </div>`;
}

// ==========================================================================
// Вкладка «Твои»
// ==========================================================================
function YoursTab() {
  const mine = app.challenges.filter(C.isJoined);
  const active = mine.filter((c) => !challengeEnded(c) && !c.isCompleted && !myFailed(c));
  const availableToday = active.filter((c) => !C.isTodayDone(c));

  // Блок «Сегодня» — дневная норма только у streak-челленджей; goal-цели (общий счёт) в сумму не входят.
  const streakActive = active.filter((c) => !C.isGoal(c));
  const todayReps = streakActive.reduce((s, c) => s + C.myTodayTotal(c), 0);
  const todayNorm = streakActive.reduce((s, c) => s + C.repsNorm(c), 0);
  const remaining = Math.max(0, todayNorm - todayReps);
  const streak = mine.length ? Math.max(0, ...mine.map((c) => myStreak(c))) : 0;
  const msLeft = startOfDay(Date.now()) + DAY - Date.now();
  const hh = Math.floor(msLeft / 3600000), mm = Math.floor((msLeft % 3600000) / 60000);
  const allDone = active.length > 0 && !availableToday.length;

  const meta = [`<span>${t("%lld left", remaining)}</span>`];
  if (streak >= 2) meta.push(`<span>🔥 ${t("%lld-day streak", streak)}</span>`);
  if (!allDone) meta.push(`<span>⏳ ${t("%lldh %lldm", hh, mm)}</span>`);

  const todayHero = active.length ? `<div class="card card-hero" style="padding:22px 20px;display:flex;flex-direction:column;gap:10px">
    ${lbl(t("Today"), "tracking-15")}
    <div class="row" style="align-items:baseline;gap:10px">
      <span class="money ${todayReps >= todayNorm ? "c-money" : "c-white"}" style="font-size:52px;line-height:1">${todayReps}</span>
      <span class="secondary" style="font-size:24px;font-weight:800">/ ${todayNorm}</span>
    </div>
    ${bar(todayNorm ? todayReps / todayNorm : 0, todayReps >= todayNorm)}
    <div class="row label secondary" style="gap:14px;font-size:12px;flex-wrap:wrap;margin-top:2px">${meta.join("")}</div>
    ${allDone
      ? `<div class="action-btn plain" style="color:var(--money);pointer-events:none;margin-top:4px">${iconF("checkCircle")}${t("All done for today")}</div>`
      : `<button class="action-btn" data-act="chooseWorkout" style="margin-top:4px">${iconF("play")}${t("Continue workout")}</button>`}
  </div>` : "";

  const browse = app.challenges.filter((c) => !C.isJoined(c) && c.access === "public" && C.status(c) !== "completed").slice(0, 2);
  const popularTitle = browse.some((c) => c.participants.length > 1) ? t("Popular challenges") : t("Open challenges");
  const popular = browse.length ? `<section class="home-section">
    <div class="home-section-head"><span>${popularTitle}</span><button data-act="findChallenge">${t("See all")}</button></div>
    <div class="home-challenge-strip">${browse.map((c) => `<button class="card home-challenge" data-act="open:${c.id}">
      <span class="home-challenge-icon">${iconF("flame")}</span>
      <strong>${esc(c.title)}</strong>
      <span>${esc(C.goalsText(c))}</span>
      <small>${c.participants.length ? t("%lld players", c.participants.length) : t("Public")} · ${t("%lld days", c.durationDays)}</small>
    </button>`).join("")}</div>
  </section>` : "";

  const discovery = `<div class="home-discovery">
    <section class="card home-ai-hero">
      <div class="home-ai-orbit"><span>${iconF("person")}</span><i></i><i></i></div>
      <div class="home-eyebrow">${t("AI Workout")}</div>
      <h2>${t("Try 5 reps")}</h2>
      <p>${t("Your camera counts every rep and helps you keep honest form.")}</p>
      <button class="action-btn home-demo-cta" data-act="demo">${iconF("camera")}${t("Try 5 reps")}</button>
      <div class="home-proof"><span>${icon("camera")}${t("Camera tracking")}</span><span>${icon("seal")}${t("AI verified")}</span><span>${icon("bolt")}${t("No equipment")}</span></div>
    </section>

    <section class="home-section">
      <div class="home-section-head"><span>${t("Quick challenge")}</span></div>
      <button class="card home-quick" data-act="useTemplate:quick7">
        <span class="home-quick-icon">${iconF("flame")}</span>
        <span class="home-quick-copy"><strong>${t("Push-ups")}</strong><small>${t("7 days · 20 push-ups a day")}</small></span>
        <span class="home-quick-action">${t("Start challenge")}${icon("chevronRight")}</span>
      </button>
    </section>

    ${popular}

    <section class="home-section">
      <div class="home-section-head"><span>${t("How it works")}</span></div>
      <div class="home-steps"><span><b>1</b>${t("Choose a goal")}</span><i></i><span><b>2</b>${t("Train with camera")}</span><i></i><span><b>3</b>${t("Keep your streak")}</span></div>
    </section>
  </div>`;

  // Лента друзей: пульс активности по общим челленджам (сам список челленджей — во вкладке Challenges).
  const feedEvents = Sync.enabled ? sharedActivity().slice(0, 8) : [];
  const feed = feedEvents.length
    ? `<section class="home-section"><div class="home-section-head"><span>${t("Today in Repact")}</span></div><div class="stack" style="gap:6px">${activityFeedRows(feedEvents)}</div></section>`
    : mine.length ? `<div class="card card-soft center secondary" style="padding:20px;font-weight:500">${t("When friends complete their day — it shows up here.")}</div>`
    : `<section class="home-section"><div class="home-section-head"><span>${t("Today in Repact")}</span></div><div class="card card-soft home-quiet">${icon("bolt")}<span>${t("No activity yet — be the first to train today.")}</span></div></section>`;

  return screenHeader(t("Home")) + `<div class="stack">
    ${active.length ? todayHero : (mine.length ? "" : discovery)}
    ${feed}
    <button class="card home-invite" data-act="invite"><span>${icon("share")}</span><span><strong>${t("Challenge a friend")}</strong><small>${t("Create a shared goal and send one link.")}</small></span>${icon("chevronRight")}</button>
    ${friendsSummary()}
  </div>`;
}

// Список всех, кто прошёл онбординг (из Firebase), новые сверху.
function friendsList() {
  const users = Sync.state && Sync.state.users;
  if (!Sync.enabled || !users) return [];
  return Object.entries(users).sort((a, b) => (b[1].joinedAt || 0) - (a[1].joinedAt || 0));
}
function isFollowing(id) {
  return !!(Sync.state.follows && Sync.state.follows[Sync.uid] && Sync.state.follows[Sync.uid][id]);
}
function userChallenges(id) {
  return app.challenges.filter((c) => c.participants.some((p) => p.id === id));
}
function followerCount(id) {
  return Object.values(Sync.state.follows || {}).filter((list) => list && list[id]).length;
}
function followingCount(id) {
  return Object.keys((Sync.state.follows && Sync.state.follows[id]) || {}).length;
}
// Компактная сводка на главном — полный список открывается отдельным листом.
function friendsSummary() {
  const list = friendsList();
  if (!list.length) return "";
  return `<button class="card card-soft" data-act="openFriends" style="padding:16px 18px;width:100%;display:flex;align-items:center;gap:12px;text-align:left">
    <span style="flex:1;font-weight:600;font-size:15px">${t("%lld in Repact", list.length)}</span>
    <span class="secondary" style="display:flex">${icon("chevronRight")}</span></button>`;
}
function FriendsSheet() {
  const list = friendsList();
  const relDate = (ts) => {
    if (!ts) return "";
    const diff = startOfDay(Date.now()) - startOfDay(ts);
    if (diff <= 0) return t("today");
    if (diff === DAY) return t("yesterday");
    return new Date(ts).toLocaleDateString(localeCode(), { day: "numeric", month: "short" });
  };
  const rows = list.map(([id, u]) => {
    const isNew = Date.now() - (u.joinedAt || 0) < 48 * 3600 * 1000;
    return `<button class="entry-row" data-act="participant:${id}" style="width:100%;text-align:left">
      <div class="avatar">${id === Sync.uid ? icon("person") : esc((u.name || "?").slice(0, 1))}</div>
      <span style="flex:1;font-weight:500;font-size:15px">${id === Sync.uid ? t("You") : esc(u.name || "?")}</span>
      ${id !== Sync.uid && isFollowing(id) ? `<span class="badge" style="color:var(--money)">${t("Following")}</span>` : ""}
      ${isNew ? `<span class="badge" style="color:var(--money)">NEW</span>` : ""}
      <span class="secondary" style="font-size:13px">${relDate(u.joinedAt)}</span>
    </button>`;
  }).join("");
  return sheetShell(t("In the app: %lld", list.length), `<div style="display:flex;flex-direction:column;gap:6px">${rows}</div>`, true);
}

const ACTIVITY_SEEN_KEY = "fs.activity.seen";
function sharedActivity() {
  const joined = new Set(app.challenges.filter(C.isJoined).map((c) => c.id));
  return Object.entries(Sync.state.activity || {}).map(([id, e]) => Object.assign({ id }, e))
    .filter((e) => e.actorId !== Sync.uid && joined.has(e.challengeId))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 50);
}
function unreadActivityCount() {
  const seen = +(localStorage.getItem(ACTIVITY_SEEN_KEY) || 0);
  return sharedActivity().filter((e) => (e.ts || 0) > seen).length;
}
function relativeActivityTime(ts) {
  const mins = Math.floor((Date.now() - (ts || 0)) / 60000);
  if (mins < 1) return t("just now");
  if (mins < 60) return t("%lld min ago", mins);
  if (mins < 24 * 60) return t("%lld h ago", Math.floor(mins / 60));
  return new Date(ts).toLocaleDateString(localeCode(), { day: "numeric", month: "short" });
}
// Строки ленты активности друзей — общий рендер для Хоума и листа уведомлений.
function activityFeedRows(events) {
  return events.map((e) => {
    const message = e.type === "day"
      ? t("%@ completed today's challenge in %@", e.actorName || "?", e.challengeTitle || "?")
      : e.type === "start"
      ? t("“%@” starts %@", e.challengeTitle || "?", e.dateKey === dateKey() ? t("today") : t("tomorrow"))
      : t("%@ completed %@ in %@", e.actorName || "?", Exercise.displayName(e.exercise), e.challengeTitle || "?");
    const reactions = (Sync.state.reactions && Sync.state.reactions[e.id]) || {};
    const reactionButtons = ["🔥", "💪", "👏"].map((emoji) => {
      const count = Object.values(reactions).filter((x) => x === emoji).length;
      const mine = reactions[Sync.uid] === emoji;
      return `<button class="reaction-chip ${mine ? "selected" : ""}" data-act="react:${e.id}:${emoji}" aria-label="${emoji}${count ? ` ${count}` : ""}">${emoji}${count ? `<span>${count}</span>` : ""}</button>`;
    }).join("");
    return `<div class="activity-row">
      <button class="entry-row activity-main" data-act="notification:${e.challengeId}">
        <div class="avatar" style="background:rgba(69,212,131,.14);color:var(--money)">${icon(e.type === "day" ? "check" : e.type === "start" ? "flame" : "bolt")}</div>
        <span style="flex:1"><span style="display:block;font-size:14px;line-height:1.35">${esc(message)}</span><span class="secondary" style="display:block;font-size:12px;margin-top:4px">${relativeActivityTime(e.ts)}</span></span>
      </button><div class="reaction-row">${reactionButtons}</div>
    </div>`;
  }).join("");
}
function NotificationsSheet() {
  const rows = activityFeedRows(sharedActivity());
  return sheetShell(t("Notifications"), rows || `<div class="card card-soft center secondary" style="padding:24px">${t("No notifications yet")}</div>`, true);
}

// ==========================================================================
// Вкладка «Челленджи»
// ==========================================================================
function ChallengesTab() {
  const syncState = Sync.enabled && !Sync.state.ready ? `<div class="card card-soft center" style="padding:14px"><span class="secondary">${t("Loading public challenges…")}</span></div>`
    : Sync.state.error ? `<div class="card center" style="padding:14px;border-color:var(--red)"><span>${t("Couldn't load public challenges. Check connection.")}</span></div>` : "";

  // Раскладываем по членству: принятые мной — по статусу (Active/Pending/Completed),
  // а публичные, где меня нет и можно вступить — в Browse (дискавери).
  const buckets = { active: [], pending: [], completed: [], browse: [] };
  for (const c of app.challenges) {
    if (C.isJoined(c)) buckets[C.status(c)].push(c);
    else if (c.access === "public" && C.status(c) !== "completed") buckets.browse.push(c);
  }
  const tabKey = buckets[ui.challengeTab] ? ui.challengeTab : "active";
  const tabs = [["active", t("Active")], ["pending", t("Pending")], ["browse", t("Browse")], ["completed", t("Completed")]];
  const tabsUI = `<div class="challenge-tabs">${tabs.map(([k, name]) => {
    const n = buckets[k].length, showCount = k !== "active" && n > 0;
    return `<button data-act="challengeTab:${k}" class="${tabKey === k ? "active" : ""}">${esc(name)}${showCount ? `<span class="challenge-tab-count">${n}</span>` : ""}</button>`;
  }).join("")}</div>`;

  const list = buckets[tabKey];
  const card = tabKey === "pending" ? PendingCard : (c) => ChallengeCard(c, tabKey === "active");
  const body = list.length ? list.map(card).join("") : challengeEmpty(tabKey);
  return screenHeader(t("Challenges")) + `<div class="stack">${syncState}${tabsUI}${body}</div>`;
}
function challengeEmpty(tabKey) {
  const copy = {
    active: [t("No active challenges"), t("Create a new challenge to get started!")],
    pending: [t("Nothing pending"), t("Private and public challenges waiting to start show up here.")],
    completed: [t("No finished challenges yet"), t("Completed challenges will show up here.")],
    browse: [t("No public challenges yet"), t("Public challenges you can join show up here.")],
  }[tabKey];
  return `<div class="card center challenge-empty">
    <div class="challenge-empty-emoji">🏋️</div>
    <div class="challenge-empty-title">${esc(copy[0])}</div>
    <div class="secondary">${esc(copy[1])}</div>
  </div>`;
}

// ==========================================================================
// Детали челленджа
// ==========================================================================
function DetailScreen(id) {
  const c = app.challenges.find((x) => x.id === id);
  if (!c) { ui.detailId = null; return ChallengesTab(); }
  const joined = C.isJoined(c);
  const nav = `<div class="navbar"><button class="icon-btn" data-act="back" aria-label="${t("Back")}">${icon("chevronLeft")}</button><div class="title">${esc(c.title)}</div><button class="icon-btn" data-act="invite" aria-label="${t("Share")}">${icon("share")}</button></div>`;
  let body;
  if (joined) {
    const ended = challengeEnded(c);
    const inviteBtn = `<button class="action-btn plain" data-act="invite">${icon("share")}${t("Invite friends")}</button>`;
    const shareDayBtn = C.isTodayDone(c) ? `<button class="action-btn share-result-btn" data-act="shareDay:${c.id}">${iconF("share")}${t("Share today's result")}</button>` : "";
    const leaveBtn = `<button class="action-btn" data-act="askLeave:${c.id}" style="background:transparent;color:var(--red);box-shadow:none">${t("Leave challenge")}</button>`;
    const restartBtn = `<button class="action-btn money" data-act="restartFailed:${c.id}">${iconF("flame")}${t("Keep going")}</button>`;
    body = !ended && myFailed(c) ? [
      failedCard(c), restartBtn, totalCard(c), potCard(c), rulesCard(c),
      c.beforePhoto ? beforeAfterCard(c) : "", participantsCard(c), leaveBtn,
    ].join("") : ended ? [
      finaleCard(c), totalCard(c), participantsCard(c), potCard(c), rulesCard(c),
      c.beforePhoto ? beforeAfterCard(c) : "", inviteBtn, leaveBtn,
    ].join("") : [
      totalCard(c), todayCard(c),
      C.isFinished(c) ? `<button class="action-btn money" data-act="showResult:${c.id}">${iconF("trophy")}${t("Show result")}</button>` : "",
      callToAction(c), shareDayBtn, inviteBtn,
      potCard(c), socialCard(c), rulesCard(c),
      c.beforePhoto ? beforeAfterCard(c) : "", participantsCard(c), callToAction(c), leaveBtn,
    ].join("");
  } else {
    body = [potCard(c), callToAction(c), rulesCard(c), participantsCard(c)].join("");
  }
  return `<div class="fullscreen" id="detail-scroll" style="z-index:1">${nav}<div class="screen stack" style="padding-top:24px">${body}</div></div>`;
}

function potCard(c) {
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="between" style="align-items:baseline">
      <div>${lbl(t("Prize pool"), "tracking-1")}<div class="c-money" style="font-size:38px">${coin(C.pot(c))}</div></div>
      <div style="text-align:right">${lbl(t("You'd win"), "tracking-1")}<div class="money" style="font-size:24px">${coin(C.payout(c))}</div></div>
    </div>
    <div class="form-footer" style="font-size:11px">🔥 ${t("Test coins · no cash value")}</div>
    ${bar(c.currentDay / c.durationDays)}
    <div class="wrap label secondary" style="font-size:10px">
      <span>${esc(C.exerciseNames(c))}</span><span>${t("Day %lld of %lld", c.currentDay, c.durationDays)}</span>
      <span>${t("Members: %lld", c.participants.length)}</span>
      ${C.eliminated(c) > 0 ? `<span style="color:var(--red)">${t("Eliminated: %lld", C.eliminated(c))}</span>` : ""}
    </div>
  </div>`;
}
function totalCard(c) {
  const s = myStreak(c);
  return `<div class="card center" style="padding:24px 16px">
    ${lbl(t("Challenge total"), "tracking-15")}
    <div class="money" style="font-size:56px;margin:6px 0">${c.myTotalReps}</div>
    ${s >= 2 ? `<div class="row gap6" style="justify-content:center">${streakPill(s)}${lbl(t("Day streak"), "tracking-1")}</div>` : `<div class="secondary" style="font-size:13px;font-weight:600">${esc(C.exerciseNames(c))}</div>`}
  </div>`;
}
// Статус-карточка проваленного челленджа: причина и что с ним будет дальше.
function failedCard(c) {
  return `<div class="card center" style="padding:24px 16px">
    <span style="display:flex;justify-content:center;color:var(--red)">${iconF("xCircle")}</span>
    <div style="font-size:22px;font-weight:750;margin:8px 0 4px">${t("Challenge failed")}</div>
    <div class="secondary" style="font-size:14px;line-height:1.4">${t("You missed more days than the protection allows.")}<br>${t("It will move to Completed in a couple of days.")}</div>
  </div>`;
}
// Экран итогов завершённого челленджа: банк, кто дошёл, что забираешь.
function finaleCard(c) {
  const finishers = C.active(c);
  const iFinished = !!C.me(c) && C.me(c).state === "active";
  return `<div class="card done" style="padding:22px 16px;display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center">
    <div class="c-money" style="font-size:52px;display:flex">${iconF("trophy")}</div>
    <div class="display" style="font-size:28px">${t("Challenge complete!")}</div>
    ${iFinished
      ? `<div class="row gap6" style="align-items:baseline">${lbl(t("You take home"))}<span class="c-money money" style="font-size:26px">${coin(C.payout(c))}</span></div>`
      : `<div class="secondary" style="font-weight:600">${t("You didn't finish this one.")}</div>`}
    <div class="between" style="width:100%;align-items:baseline">
      <div>${lbl(t("Finishers"), "tracking-1")}<div class="money" style="font-size:20px">${finishers.length} / ${c.participants.length}</div></div>
      <div style="text-align:right">${lbl(t("Prize pool"), "tracking-1")}<div class="c-money money" style="font-size:20px">${coin(C.pot(c))}</div></div>
    </div>
    ${lbl(t("A new season starts soon."))}
  </div>`;
}
function todayCard(c) {
  const done = C.isTodayDone(c);
  const heading = C.isGoal(c) ? t("Progress") : t("Today"); // goal — общий прогресс к цели
  let inner;
  if (c.goals.length === 1) {
    const g = c.goals[0], reps = C.exProgress(c, g), norm = C.norm(c, g), d = reps >= norm;
    inner = `<div class="between" style="align-items:baseline">${lbl(heading, "tracking-1")}<span class="money ${d ? "c-money" : "c-white"}" style="font-size:24px">${reps} / ${norm}</span></div>${bar(reps / norm, d)}`;
  } else {
    const rings = c.goals.map((g) => {
      const reps = C.exProgress(c, g), norm = C.norm(c, g), d = reps >= norm;
      return progressRing(c.id, g, reps, norm, d);
    }).join("");
    inner = lbl(heading, "tracking-1") + `<div style="display:flex;gap:8px;align-items:flex-start;padding-top:4px">${rings}</div>`;
  }
  return `<div class="card ${done ? "done" : ""}" style="padding:16px;display:flex;flex-direction:column;gap:10px">${inner}</div>`;
}
function socialCard(c) {
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="row gap8" style="font-weight:700;font-size:15px">${icon("flame", "")}<span>${t("%lld of %lld already did it today", C.doneTodayCount(c), C.active(c).length)}</span></div>
    ${c.yesterdayDropouts > 0 ? `<div class="row gap8" style="font-weight:700;font-size:15px"><span style="color:var(--red);display:flex">${icon("personXmark")}</span><span>${t("Yesterday %lld dropped out", c.yesterdayDropouts)}</span></div>` : ""}
  </div>`;
}
function callToAction(c) {
  if (C.isJoined(c)) {
    const done = C.isTodayDone(c);
    // Комбо — большая кнопка открывает выбор, с какого упражнения начать; одиночное — сразу старт.
    const act = c.goals.length > 1 ? `startPick:${c.id}` : `play:${c.id}`;
    return `<button class="action-btn ${done ? "money" : ""}" data-act="${act}">${done ? icon("plusCircleLine") : iconF("flame")}${done ? t("Extra reps") : C.actionText(c)}</button>`;
  }
  return `<button class="action-btn" data-act="join:${c.id}">${t("Join for")} ${coin(c.buyIn)}</button>`;
}
// Лист выбора «с чего начать» для комбо: строки-упражнения, тап → запуск именно его.
function StartPicker() {
  const c = app.challenges.find((x) => x.id === ui.form.challengeId);
  if (!c) return "";
  const rows = c.goals.map((g) => {
    const reps = C.exProgress(c, g), norm = C.norm(c, g), done = reps >= norm;
    return `<button class="picker-row" data-act="play:${c.id}:${g.exercise}">
      <span class="row gap12"><span style="display:flex;color:var(--accent)">${exIcon(g.exercise)}</span><span style="font-weight:600;font-size:16px">${esc(Exercise.displayName(g.exercise))}</span></span>
      <span class="row gap12"><span class="money ${done ? "c-money" : "secondary"}" style="font-size:15px">${reps} / ${norm}</span><span style="color:var(--accent);display:flex">${iconF("play")}</span></span>
    </button>`;
  }).join("");
  return sheetShell(t("Where to start?"), `<div class="picker-list">${rows}</div>`, true);
}

function availableWorkoutsToday() {
  return app.challenges.filter((c) => C.isJoined(c) && !challengeEnded(c) && !c.isCompleted && !myFailed(c) && !C.isTodayDone(c));
}

function WorkoutPickerSheet() {
  const rows = availableWorkoutsToday().map((c) => {
    const remaining = C.isGoal(c)
      ? Math.max(0, c.goals.reduce((sum, g) => sum + C.norm(c, g), 0) - (c.myTotalReps || 0))
      : Math.max(0, C.repsNorm(c) - C.myTodayTotal(c));
    return `<button class="workout-choice" data-act="play:${c.id}">
      <span class="workout-choice-icon">${iconF("flame")}</span>
      <span class="workout-choice-copy"><strong>${esc(c.title)}</strong><small>${esc(C.goalsText(c))}</small></span>
      <span class="workout-choice-left">${t("%lld left", remaining)}</span>
      ${icon("chevronRight")}
    </button>`;
  }).join("");
  return sheetShell(t("Choose a workout"), `<div class="form-footer workout-choice-hint">${t("Pick what you want to complete today.")}</div><div class="workout-choice-list">${rows}</div>`, true);
}
// Подтверждение выхода из челленджа: явный warning про невозврат взноса и потерю результатов.
function LeaveSheet() {
  const c = app.challenges.find((x) => x.id === ui.form.challengeId);
  if (!c) return "";
  const body = `
    <div class="form-section" style="align-items:center;text-align:center;gap:12px;padding:8px 0">
      <span style="width:56px;height:56px;border-radius:50%;background:rgba(255,69,58,.14);color:var(--red);display:flex;align-items:center;justify-content:center">${icon("personXmark")}</span>
      <div style="font-weight:700;font-size:17px">${esc(c.title)}</div>
      <div class="secondary" style="font-size:14px;line-height:1.45">${t("Your buy-in won't be refunded and you won't be able to see the results.")}</div>
    </div>
    <button class="action-btn danger" data-act="confirmLeave:${c.id}">${t("Leave")}</button>
    <button class="action-btn plain" data-act="closeSheet">${t("Cancel")}</button>`;
  return sheetShell(t("Leave challenge?"), body, true);
}

// Разделы и типовые проблемы для отчёта тестера — под реальные экраны Repact.
// Канонические строки английские (стабильны для агента-триажа), в UI переводятся t().
const BUG_CATS = [
  ["🎯", "Counting & camera", ["Counts extra reps", "Doesn't count reps", "Counts when body isn't visible", "Camera is slow or laggy", "Skeleton doesn't appear"]],
  ["🏆", "Challenges", ["Can't create a challenge", "Can't join or leave", "Challenge disappeared", "Progress or results are wrong"]],
  ["💰", "Money & stakes", ["Wrong balance or buy-in", "Payout problem"]],
  ["🎨", "Design & layout", ["Spacing or elements are off", "Text cut off or overlapping", "Hard to see in dark or light theme"]],
  ["⚙️", "App behavior", ["Froze or crashed", "Laggy", "Something won't load"]],
];

// Лист «Сообщить о проблеме»: выбор проблемы в один тап (чипсы) + необязательный текст.
function BugSheet() {
  const groups = BUG_CATS.map(([emoji, cat, problems], ci) => {
    const chips = problems.map((p, pi) => {
      const on = ui.bug && ui.bug.pick === ci + "-" + pi;
      return `<button class="bug-chip ${on ? "sel" : ""}" data-act="bugPick:${ci}-${pi}">${esc(t(p))}</button>`;
    }).join("");
    return `<div class="bug-group"><div class="bug-cat">${emoji} ${esc(t(cat))}</div><div class="bug-chips">${chips}</div></div>`;
  }).join("");
  const canSend = !!(ui.bug && ui.bug.pick);
  const body = `
    <p class="secondary" style="font-size:13px;margin:-2px 0 2px">${t("Pick what's wrong — one tap is enough. Details optional.")}</p>
    ${groups}
    <textarea id="bug-note" class="bug-note" placeholder="${t("Details (optional)")}">${esc((ui.bug && ui.bug.note) || "")}</textarea>
    <button class="action-btn" data-act="sendBug" ${canSend ? "" : "disabled"}>${t("Send report")}</button>`;
  return sheetShell(t("Report a problem"), body, true);
}

// Имя текущего экрана для контекста баг-репорта.
function currentScreenName() {
  if (liveSession) return "camera";
  if (ui.screen === "onboarding") return "onboarding";
  if (ui.full) return "fullscreen";
  if (ui.detailId) return "challenge-detail";
  return "tab-" + ui.tab;
}

function openBug() { ui.bug = { pick: null, note: "" }; ui.sheet = BugSheet; render(); }

function ruleRow(ic, html) { return `<div class="rule-row">${icon(ic)}<div>${html}</div></div>`; }
function rulesCard(c) {
  const rows = [ruleRow("flame", `<b>${t("Every day: ")}${esc(C.goalsText(c))}</b>`)];
  if (c.progression.step > 0) {
    const step = c.progression.step, fin = C.repsNorm(c, c.durationDays);
    rows.push(ruleRow("trend", c.progression.period === "day"
      ? t("The goal grows by %lld reps every day — by day %lld it's %lld.", step, c.durationDays, fin)
      : t("The goal grows by %lld reps every week — by day %lld it's %lld.", step, c.durationDays, fin)));
  }
  rows.push(ruleRow("chartBar", t("Reps can be split into any number of sets during the day.")));
  rows.push(ruleRow("camera", t("Every rep is verified by the camera in real time.")));
  rows.push(ruleRow("calendar", t("The challenge runs %lld days.", c.durationDays)));
  rows.push(ruleRow("personXmark", MissPolicy.rulesText(c.missPolicy)));
  rows.push(ruleRow("dollar", t("Buy-in: %lld. Drop out — it stays in the pot for the finishers.", c.buyIn)));
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${lbl(t("Rules"), "tracking-1")}${rows.join("")}</div>`;
}
function beforeAfterCard(c) {
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${lbl(t("Before / After"), "tracking-1")}
    <div class="grid2">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="photo-slot locked">${c.beforePhoto ? `<img src="${c.beforePhoto}" alt="${t("Before")}">` : ""}<div class="lock-overlay">${iconF("lock")}<span class="label" style="font-size:9px">${t("Opens at the finish")}</span></div></div>
        ${lbl(t("Before"))}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="photo-slot">${icon("camera")}<span class="label" style="font-size:9px">${t("Finish: day %lld", c.durationDays)}</span></div>
        ${lbl(t("After"))}
      </div>
    </div></div>`;
}
function participantsCard(c) {
  const ranked = c.participants.slice().sort((a, b) => {
    if ((a.state === "eliminated") !== (b.state === "eliminated")) return a.state === "eliminated" ? 1 : -1;
    if (a.todayReps !== b.todayReps) return b.todayReps - a.todayReps;
    return a.isMe ? -1 : 1;
  });
  const norm = C.repsNorm(c);
  const top = ranked.slice(0, 10);
  const myRank = ranked.findIndex((p) => p.isMe) + 1;
  const myBelow = myRank > top.length && myRank > 0;
  const hidden = ranked.length - top.length - (myBelow ? 1 : 0);
  const rankBadge = (r) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `<span class="rank">${r}.</span>`);
  const tappable = Sync.enabled;
  const row = (p, rank) => {
    const done = p.todayReps >= norm;
    return `<div ${tappable ? `data-act="participant:${p.id}" ` : ""}class="row gap12${tappable ? " lb-row" : ""}" style="opacity:${p.state === "eliminated" ? 0.45 : 1}${tappable ? ";cursor:pointer" : ""}">
      <div class="rank" style="width:28px">${rankBadge(rank)}</div>
      <div class="avatar">${p.isMe ? icon("person") : esc(p.name.slice(0, 1))}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <span style="${p.isMe ? "font-weight:700" : ""}">${p.isMe ? t("You") : esc(p.name)}</span>
        ${p.state === "active" ? bar(p.todayReps / norm, done) : ""}
      </div>
      ${p.state === "eliminated" ? `<span style="color:var(--red);display:flex">${iconF("xCircle")}</span>` : `<span class="money ${done ? "c-money" : ""}" style="font-size:14px;color:${done ? "" : "rgba(255,255,255,.85)"}">${p.todayReps} / ${norm}</span>`}
    </div>`;
  };
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">${lbl(t("Leaderboard"), "tracking-1")}
    ${top.map((p, i) => row(p, i + 1)).join("")}
    ${hidden > 0 ? `<span class="label secondary">${t("+%lld more", hidden)}</span>` : ""}
    ${myBelow ? `<hr class="hr">${row(C.me(c), myRank)}` : ""}
  </div>`;
}

// ==========================================================================
// Статистика
// ==========================================================================
let statExFilter = "all"; // фильтр Weekly volume: "all" | код упражнения
function StatsTab() {
  const joined = app.challenges.filter(C.isJoined);
  const dot = (color, title) => `<div class="row gap8"><span class="chart-dot" style="background:${color}"></span><span class="label" style="font-size:11px;letter-spacing:1px">${esc(title)}</span></div>`;

  // All-time: всего повторов + разбивка по упражнениям (переехало с бывшей вкладки «Today»).
  // Не зависит от истории графиков — показываем всегда, даже до первой тренировки.
  const by = exerciseBreakdown();
  const exKeys = EX_ORDER.concat(Object.keys(by).filter((k) => !EX_ORDER.includes(k)));
  const exLabel = (ex) => ex === "other" ? t("Earlier reps") : Exercise.displayName(ex);
  const exRow = (ex) => { const n = by[ex] || 0; return `<div class="between" style="align-items:baseline">
    <span style="font-size:15px;${n ? "" : "color:var(--text-secondary)"}">${esc(exLabel(ex))}</span>
    <span class="money" style="font-size:15px;${n ? "font-weight:700" : "color:var(--text-secondary)"}">${n}</span></div>`; };
  const allTimeCard = `<div class="card" style="padding:24px 16px 18px;display:flex;flex-direction:column;gap:6px">
    <div style="text-align:center;display:flex;flex-direction:column;gap:4px">
      ${lbl(t("All-time"), "tracking-15")}
      <div class="money" style="font-size:44px">${app.totalReps}</div>
      ${lbl(t("Total reps"))}
    </div>
    <hr class="hr">
    <div style="display:flex;flex-direction:column;gap:12px">${exKeys.map(exRow).join("")}</div>
  </div>`;

  // Пустое состояние: пока нет ни одной завершённой тренировки — объясняем, как получить данные.
  const hasData = app.history.some((d) => d.entries && d.entries.length);
  if (!hasData) return screenHeader(t("Progress")) + `<div class="stack">
    ${allTimeCard}
    <div class="card center" style="padding:36px 22px;display:flex;flex-direction:column;align-items:center;gap:14px">
      <span style="color:var(--accent);display:flex">${icon("trend")}</span>
      <div class="secondary" style="font-weight:500;text-align:center;max-width:280px;font-size:15px">${t("Complete your first workout and your weekly trend will appear here.")}</div>
    </div></div>`;

  // Суммы по календарным дням: в истории бывают пропуски, слайс «по записям» сдвигал графики
  const byDay = new Map(app.history.map((d) => [startOfDay(d.date), d.entries.reduce((s, e) => s + e.reps, 0)]));
  // Дневная норма — сумма норм назначенных на день челленджей (entries с norm).
  // Нужна, чтобы красить столбик по выполнению и считать долю закрытых дней.
  const byDayNorm = new Map(app.history.map((d) => [startOfDay(d.date), d.entries.reduce((s, e) => s + (e.norm || 0), 0)]));
  // Разбивка reps по упражнениям за день — для фильтра Weekly volume.
  const byDayEx = new Map();
  for (const d of app.history) {
    const key = startOfDay(d.date), acc = byDayEx.get(key) || {};
    for (const e of d.entries) for (const [ex, n] of Object.entries(e.byEx || {})) acc[ex] = (acc[ex] || 0) + n;
    byDayEx.set(key, acc);
  }
  const today0 = startOfDay(Date.now());
  const series = (n) => { const out = []; for (let back = n - 1; back >= 0; back--) out.push(byDay.get(today0 - back * DAY) || 0); return out; };

  // Упражнения за 30 дней — опции фильтра (показываем, только если их больше одного).
  const exSet = new Set();
  for (let back = 29; back >= 0; back--) { const acc = byDayEx.get(today0 - back * DAY); if (acc) for (const ex of Object.keys(acc)) if (acc[ex] > 0) exSet.add(ex); }
  const exList = [...exSet].sort((a, b) => EX_ORDER.indexOf(a) - EX_ORDER.indexOf(b));
  const filterEx = exList.includes(statExFilter) ? statExFilter : "all";

  // Недельный объём: инсайты считаем по всему объёму, график — по выбранному фильтру.
  const paddedAll = series(28);
  const weeksAll = [0, 1, 2, 3].map((w) => paddedAll.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0));
  const repsForDay = (date) => filterEx === "all" ? (byDay.get(date) || 0) : ((byDayEx.get(date) || {})[filterEx] || 0);
  const weekWindow = []; for (let back = 27; back >= 0; back--) weekWindow.push(repsForDay(today0 - back * DAY));
  const weeks = [0, 1, 2, 3].map((w) => weekWindow.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0));

  // Активность по дням: reps, дневная норма и флаг «день закрыт» (норма выполнена).
  const days = [];
  for (let back = 29; back >= 0; back--) {
    const date = today0 - back * DAY;
    const reps = byDay.get(date) || 0, norm = byDayNorm.get(date) || 0;
    days.push({ date, reps, norm, done: norm > 0 && reps >= norm });
  }

  // Выводы: превращаем цифры в мотивацию вместо голых графиков.
  const loc = localeCode();
  const thisWeek = weeksAll[3], lastWeek = weeksAll[2];
  const allTotals = [...byDay.values()];
  const bestDay = allTotals.length ? Math.max(...allTotals) : 0;
  const todayTotal = byDay.get(today0) || 0;
  const streak = joined.length ? Math.max(0, ...joined.map((c) => myStreak(c))) : 0;
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  days.forEach((d) => { weekdayTotals[new Date(d.date).getDay()] += d.reps; });
  const bestWd = weekdayTotals.indexOf(Math.max(...weekdayTotals));

  const insights = [];
  if (lastWeek > 0 && thisWeek !== lastWeek) {
    const pct = Math.round((thisWeek - lastWeek) / lastWeek * 100);
    insights.push(pct > 0 ? t("This week +%lld% more reps", pct) : t("This week %lld% fewer reps", -pct));
  }
  if (streak >= 2) insights.push(t("On track %lld days in a row", streak));
  if (bestDay > 0 && todayTotal > 0 && todayTotal < bestDay) insights.push(t("%lld reps to your daily record", bestDay - todayTotal));
  if (Math.max(...weekdayTotals) > 0) {
    const sample = days.find((d) => new Date(d.date).getDay() === bestWd);
    if (sample) insights.push(t("Most active day — %@", new Date(sample.date).toLocaleDateString(loc, { weekday: "long" })));
  }
  const insightsCard = insights.length ? `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    ${lbl(t("Insights"), "tracking-1")}
    ${insights.map((s) => `<div class="row gap8" style="align-items:flex-start"><span style="color:var(--accent);font-weight:800">•</span><span style="font-size:14px;font-weight:500">${esc(s)}</span></div>`).join("")}
  </div>` : "";

  // Быстрые метрики: суммарный объём за 30 дней, доля закрытых дней, серия.
  const monthReps = days.reduce((s, d) => s + d.reps, 0);
  const activeDays = days.filter((d) => d.norm > 0);
  const completion = activeDays.length ? Math.round(activeDays.filter((d) => d.done).length / activeDays.length * 100) : null;
  let running = 0, bestStreak = 0;
  days.forEach((d) => { running = d.done ? running + 1 : 0; bestStreak = Math.max(bestStreak, running); });
  const weekDelta = lastWeek > 0 ? Math.round((thisWeek - lastWeek) / lastWeek * 100) : null;
  const heroCard = `<section class="progress-hero card">
    <div class="progress-hero-head"><span>${t("This week")}</span>${weekDelta == null ? "" : `<b class="${weekDelta >= 0 ? "up" : "down"}">${weekDelta >= 0 ? "+" : ""}${weekDelta}%</b>`}</div>
    <div class="progress-week-value">${fmt(thisWeek)}</div>
    <div class="progress-week-label">${t("reps")}</div>
    <div class="progress-hero-stats">
      <div><strong>${streak}</strong><span>${t("Current streak")}</span></div>
      <div><strong>${bestDay}</strong><span>${t("Best day")}</span></div>
      <div><strong>${days.filter((d) => d.reps > 0).length}</strong><span>${t("Active days")}</span></div>
    </div>
  </section>`;

  const disciplineCells = days.map((d) => {
    const cls = d.done ? "done" : d.reps > 0 ? "partial" : "empty";
    const label = `${new Date(d.date).toLocaleDateString(loc, { day: "numeric", month: "short" })}: ${d.reps} ${t("reps")}`;
    return `<span class="discipline-day ${cls} ${d.date === today0 ? "today" : ""}" title="${esc(label)}" aria-label="${esc(label)}"><i style="--load:${Math.min(1, d.reps / Math.max(d.norm || bestDay || 1, 1))}"></i></span>`;
  }).join("");
  const disciplineCard = `<section class="progress-section card">
    <div class="progress-section-head"><div><span>${t("Last 30 days")}</span><small>${fmt(monthReps)} ${t("reps")}</small></div><strong>${completion != null ? completion + "%" : "—"}</strong></div>
    <div class="discipline-grid" role="img" aria-label="${t("Daily activity — 30 days")}">${disciplineCells}</div>
    <div class="discipline-legend"><span><i class="done"></i>${t("Completed")}</span><span><i class="partial"></i>${t("In progress")}</span></div>
  </section>`;

  const dailyRecords = {};
  for (const d of app.history) for (const e of d.entries || []) for (const [ex, reps] of Object.entries(e.byEx || {})) dailyRecords[ex] = Math.max(dailyRecords[ex] || 0, +reps || 0);
  const recordKeys = Object.keys(dailyRecords).sort((a, b) => EX_ORDER.indexOf(a) - EX_ORDER.indexOf(b));
  const recordsCard = recordKeys.length ? `<section class="progress-section card">
    <div class="progress-section-title">${t("Personal records")}</div>
    <div class="record-list">${recordKeys.map((ex) => `<div class="record-row"><span class="record-icon">${exIcon(ex)}</span><span><strong>${esc(Exercise.displayName(ex))}</strong><small>${t("Daily best")}</small></span><b>${dailyRecords[ex]}</b></div>`).join("")}</div>
    <div class="record-streak"><span>${iconF("flame")}${t("Best streak")}</span><strong>${Math.max(bestStreak, streak)}</strong></div>
  </section>` : "";

  const exShort = (ex) => ex === "all" ? t("All") : Exercise.displayName(ex);
  const filterUI = exList.length > 1 ? `<div class="stat-filter">${["all", ...exList].map((ex) => `<button data-act="statEx" data-ex="${ex}" class="${filterEx === ex ? "active" : ""}">${esc(exShort(ex))}</button>`).join("")}</div>` : "";
  const weeklyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:4px">
    <div class="between" style="gap:10px">${dot("var(--money)", t("Weekly volume"))}${filterUI}</div>
    <div class="form-footer">${t("Total reps over the last 4 weeks.")}</div>
    ${weeklyChart(weeks)}</div>`;
  // Журнал
  const today = startOfDay(Date.now());
  const past = app.history.filter((d) => startOfDay(d.date) !== today && d.entries.length).slice(-7).reverse();
  const last = app.history[app.history.length - 1];
  const todayPractice = last && startOfDay(last.date) === today ? last.entries.filter((e) => e.title == null) : [];
  const entryRow = (title, reps, norm, done) => `<div class="entry-row">
    <span style="color:${done ? "var(--money)" : "var(--text-secondary)"};display:flex">${iconF(done ? "checkCircle" : "flame")}</span>
    <span style="flex:1;font-weight:500;font-size:15px">${esc(title)}</span>
    <span class="money ${done ? "c-money" : ""}" style="font-size:14px;color:${done ? "" : "rgba(255,255,255,.85)"}">${norm != null ? `${reps} / ${norm}` : `+${reps}`}</span></div>`;
  const dayChip = (txt) => `<span class="day-chip">${esc(txt)}</span>`;
  let journal = `<div class="progress-section-title">${t("Recent workouts")}</div>` + dayChip(t("Today"));
  journal += joined.map((c) => entryRow(c.title, C.myTodayTotal(c), C.repsNorm(c), C.isTodayDone(c))).join("");
  journal += todayPractice.map((e) => entryRow(t("Practice"), e.reps, null, false)).join("");
  for (const d of past) {
    journal += dayChip(new Date(d.date).toLocaleDateString(localeCode(), { day: "numeric", month: "short" }));
    journal += d.entries.map((e) => entryRow(e.title || t("Practice"), e.reps, e.norm, e.norm != null && e.reps >= e.norm)).join("");
  }
  const journalCard = `<section class="progress-section card progress-journal">${journal}</section>`;

  return screenHeader(t("Progress")) + `<div class="stack progress-stack">${heroCard}${disciplineCard}${recordsCard}${weeklyCard}${allTimeCard}${insightsCard}${journalCard}</div>`;
}
// Округление верхней отметки оси Y до «круглого» значения (1/2/5 × 10ⁿ),
// чтобы подписи сетки читались как 0 / 400 / 800, а не 0 / 417 / 835.
function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow, step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
function weeklyChart(weeks) {
  const W = 320, H = 184, padL = 34, padR = 18, padT = 24, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceCeil(Math.max(...weeks, 1));
  const xs = weeks.map((_, i) => padL + i * (plotW / 3));
  const yFor = (v) => padT + plotH * (1 - v / max);
  const ys = weeks.map(yFor);
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${(padT + plotH).toFixed(1)} L${xs[0].toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const grid = [0, max / 2, max].map((v) => {
    const y = yFor(v);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y + 3).toFixed(1)}" fill="rgba(255,255,255,.4)" font-size="9" font-family="ui-monospace,monospace" text-anchor="end">${fmt(Math.round(v))}</text>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45d483" stop-opacity="0.32"/><stop offset="1" stop-color="#45d483" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#wg)"/>
    <path d="${line}" fill="none" stroke="#45d483" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3.4" fill="#45d483" stroke="#141414" stroke-width="2"/>`).join("")}
    ${xs.map((x, i) => weeks[i] > 0 ? `<text x="${x.toFixed(1)}" y="${(ys[i] - 9).toFixed(1)}" fill="#fff" font-size="10" font-weight="700" font-family="ui-monospace,monospace" text-anchor="middle">${fmt(weeks[i])}</text>` : "").join("")}
    ${xs.map((x, i) => `<text x="${x.toFixed(1)}" y="${(H - 6).toFixed(1)}" fill="rgba(255,255,255,.55)" font-size="10" font-family="ui-monospace,monospace" text-anchor="middle">${t("Week %lld", i + 1)}</text>`).join("")}
  </svg>`;
}
// ==========================================================================
// Профиль
// ==========================================================================
let photosUnlocked = false;
let profileEditing = false;
let profileNameDraft = null; // черновик имени — переживает перерисовки от степперов
function ProfileTab() {
  const level = store["profile.level"], gender = store["profile.gender"];
  const withPhotos = app.challenges.filter((c) => c.beforePhoto);
  const finished = app.challenges.filter((c) => c.isCompleted).length;
  const activeCount = app.challenges.filter(C.isJoined).length;

  const summary = `<div class="card center" style="padding:24px 16px">
    ${lbl(t("All-time reps"), "tracking-15")}
    <div class="money" style="font-size:52px;margin:6px 0">${app.totalReps}</div>
    <div class="row label" style="justify-content:center;gap:18px;font-size:10px">
      <span class="secondary">${t("Active challenges: %lld", activeCount)}</span><span class="secondary">${t("Finished: %lld", finished)}</span></div>
  </div>`;
  const guestNotice = isGuest() ? `<div class="card card-hero" style="padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="between">${lbl(t("Account"), "tracking-1")}<span class="badge" style="color:var(--accent)">${t("Guest")}</span></div>
    <div style="font-weight:700">${t("Progress is stored only on this device")}</div>
    <div class="form-footer">${t("Create an account to sync progress and use social challenges.")}</div>
    <button class="action-btn" data-act="openAccountGate">${t("Create account")}</button>
  </div>` : "";

  const editing = profileEditing;
  const seg = (key, opts, cur) => `<div class="segmented">${opts.map(([v, n]) => `<button data-act="seg" data-store="${key}" data-val="${v}" class="${cur === v ? "active" : ""}">${esc(n)}</button>`).join("")}</div>`;
  const numStore = (label, key, min, max, unit) => `<div class="settings-row"><span id="lbl-store-${key}">${esc(label)}</span>
    <div class="stepper"><button data-act="dec" data-store="${key}" data-min="${min}" data-max="${max}">−</button>
      <input class="mono" type="number" data-store="${key}" value="${store[key]}" aria-labelledby="lbl-store-${key}"><span class="mono secondary" style="font-size:13px;min-width:20px">${unit || ""}</span>
      <button data-act="inc" data-store="${key}" data-min="${min}" data-max="${max}">+</button></div></div>`;
  const roRow = (label, value, unit) => `<div class="settings-row"><span>${esc(label)}</span><span class="mono" style="font-weight:700;font-size:15px">${esc(value)}${unit ? ` <span class="secondary" style="font-size:13px">${esc(unit)}</span>` : ""}</span></div>`;

  const editControls = `
    <input class="field" id="profile-name" value="${esc(profileNameDraft != null ? profileNameDraft : (store["profile.name"] || ""))}" placeholder="${esc(t("Your name"))}" aria-label="${esc(t("Your name"))}" maxlength="20">
    ${seg("profile.gender", Gender.all.map((g) => [g, Gender.name(g)]), gender)}
    ${numStore(t("Age"), "profile.age", 14, 80)}
    ${numStore(t("Height"), "profile.heightCm", 120, 220, t("cm"))}
    ${numStore(t("Weight"), "profile.weightKg", 35, 180, t("kg"))}
    ${numStore(t("Max reps in one set"), "profile.maxReps", 1, 120)}
    ${seg("profile.level", Level.all.map((l) => [l, Level.name(l)]), level)}`;
  const readControls = `
    ${store["profile.name"] ? roRow(t("Your name"), store["profile.name"]) : ""}
    ${roRow(t("Gender"), Gender.name(gender))}
    ${roRow(t("Age"), store["profile.age"])}
    ${roRow(t("Height"), store["profile.heightCm"], t("cm"))}
    ${roRow(t("Weight"), store["profile.weightKg"], t("kg"))}
    ${roRow(t("Max reps in one set"), store["profile.maxReps"])}
    ${roRow(t("Fitness level"), Level.name(level))}`;

  const bodyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="between">${lbl(t("Your data"), "tracking-1")}
      ${editing ? "" : `<button class="badge" data-act="editProfile" style="color:var(--accent)">${t("Edit")}</button>`}</div>
    ${editing ? editControls : readControls}
    <hr class="hr">
    <div class="between">${lbl(t("Your daily goal"))}<span class="money" style="font-size:18px">${recommendedDailyReps(level, store["profile.maxReps"])}</span></div>
    ${editing ? `<button class="action-btn money" data-act="saveProfile">${t("Save")}</button>` : ""}
  </div>`;

  const measurements = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    <div class="between">${lbl(t("Measurements"), "tracking-1")}<button data-act="addMeasure" style="color:var(--accent);display:flex">${iconF("plusCircle")}</button></div>
    ${app.measurements.length === 0 ? `<div class="form-footer">${t("No measurements yet. They're added after each challenge.")}</div>` :
      app.measurements.slice().reverse().map((m) => `<div class="between" style="padding:4px 0">
        <span style="font-size:15px">${new Date(m.date).toLocaleDateString(localeCode(), { day: "numeric", month: "short", year: "numeric" })}</span>
        <span class="row gap6"><span class="money secondary" style="font-size:14px">${t("%lld kg", m.weight)}</span><span class="secondary">·</span><span class="money" style="font-size:14px">${m.maxReps}</span></span></div>`).join("")}
  </div>`;

  let photosInner;
  if (withPhotos.length === 0) photosInner = `<div class="form-footer">${t("Photos appear here once you join a challenge with a BEFORE photo.")}</div>`;
  else if (photosUnlocked) photosInner = withPhotos.map((c) => `<div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-weight:600;font-size:15px">${esc(c.title)}</div>
    <div class="grid2">${photoSlot(c.beforePhoto, t("Before"))}${photoSlot(c.afterPhoto, t("After"))}</div></div>`).join("");
  else photosInner = `<button class="action-btn plain" data-act="unlockPhotos">${t("Show photos")}</button>`;
  const photosCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    ${lbl(t("Before / After photos"), "tracking-1")}
    ${photosInner}</div>`;

  const txLabel = (tx) => tx.kind === "start" ? t("Starting balance") : (tx.kind === "topup" || tx.kind === "refill") ? t("Test balance restored") : t("Buy-in: %@", esc(tx.challenge));
  const wallet = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="between">${lbl(t("Balance"), "tracking-1")}<span class="c-money" style="font-size:24px">${coinCountUp(app.balance, "balance")}</span></div>
    <div class="form-footer">${t("Test coins for joining challenges. They have no cash value.")}</div>
    ${app.balance < TEST_COIN_REFILL_THRESHOLD ? `<button class="action-btn" data-act="restoreTestCoins">${iconF("plusCircle")}${t("Restore test balance")}</button>` : ""}
    <hr class="hr">
    ${app.transactions.map((tx) => `<div class="between" style="padding:6px 0">
      <span style="font-size:15px">${txLabel(tx)}</span>
      <span class="money" style="font-size:15px;color:${tx.amount > 0 ? "var(--money)" : "var(--red)"}">${tx.amount > 0 ? "+" + tx.amount : tx.amount}</span></div>`).join("")}
  </div>`;

  const soundToggle = (key, label) => `<div class="settings-row"><span id="lbl-${key}">${esc(label)}</span><button data-act="toggleStore" data-key="${key}" role="switch" aria-checked="${!!store[key]}" aria-labelledby="lbl-${key}" class="toggle ${store[key] ? "on" : ""}"></button></div>`;
  const settingsCard = `<div class="card card-soft" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    ${lbl(t("Settings"), "tracking-1")}
    ${soundToggle("workoutSounds", t("Workout sounds"))}
    ${soundToggle("interfaceSounds", t("Interface sounds"))}
    <button class="action-btn plain" data-act="openBug">${icon("bug")}${t("Report a problem")}</button>
    <button class="action-btn" data-act="askResetData" style="background:transparent;color:var(--red);box-shadow:inset 0 0 0 1px rgba(255,87,87,.35)">${t("Reset test data")}</button>
  </div>`;

  // Приватность и данные — честный текст о том, что происходит с видео/фото/замерами.
  const privacyRow = (txt) => `<div class="row gap8" style="align-items:flex-start"><span style="color:var(--money);font-weight:800">✓</span><span style="font-size:14px;line-height:1.45">${esc(txt)}</span></div>`;
  const privacyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    ${lbl(t("Privacy & data"), "tracking-1")}
    ${privacyRow(t("Camera frames are processed on this device and are not uploaded to our servers."))}
    ${privacyRow(t("Video is recorded only when you tap Record and stays on your device unless you choose to share it."))}
    ${privacyRow(t("Before / After photos are stored on your device — the app doesn't upload them to our servers."))}
    ${privacyRow(t("Weight and measurements stay on this device."))}
    ${privacyRow(t("We use PostHog and Firebase Analytics to understand product usage and improve the test app."))}
    ${privacyRow(t("Nothing is used to train any models."))}
    <div class="form-footer">${t("Test currency — no real money.")}</div>
  </div>`;

  // Профиль разбит на разделы: меню → раздел. Крупный экран не смешивает разные сущности.
  const sections = {
    body: [t("Body & measurements"), bodyCard + measurements + photosCard],
    wallet: [t("Coins"), wallet],
    account: [t("Account"), accountCard()],
    privacy: [t("Privacy & data"), privacyCard],
    settings: [t("Settings"), settingsCard],
  };
  const cur = ui.profileSection;
  if (cur && sections[cur]) {
    return `<div class="screen-head row gap8" style="align-items:center">
      <button data-act="profileHome" aria-label="${t("Back")}" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:#fff;margin-left:-8px">${icon("chevronLeft")}</button>
      <h1 class="screen-title" style="font-size:28px">${esc(sections[cur][0])}</h1>
    </div><div class="stack">${sections[cur][1]}</div>`;
  }
  const row = (key, label) => `<button class="card" data-act="profileSection:${key}" style="padding:16px 18px;width:100%;display:flex;align-items:center;gap:12px;text-align:left">
    <span style="flex:1;font-weight:600;font-size:16px">${esc(label)}</span>
    <span style="color:var(--text-secondary);display:flex">${icon("chevronRight")}</span></button>`;
  return screenHeader(t("Profile")) + `<div class="stack">${guestNotice}${summary}
    ${row("body", t("Body & measurements"))}
    ${row("wallet", t("Coins"))}
    ${Sync.enabled ? row("account", t("Account")) : ""}
    ${row("privacy", t("Privacy & data"))}
    ${row("settings", t("Settings"))}
  </div>`;
}
function photoSlot(dataURL, caption) {
  return `<div style="display:flex;flex-direction:column;gap:5px"><div class="photo-slot" style="height:150px">${dataURL ? `<img src="${dataURL}" alt="${esc(caption || "")}">` : icon("camera")}</div>${lbl(caption)}</div>`;
}
// Форма входа (Google + email/пароль) — общая для профиля и онбординга.
function authForm() {
  return `<button class="action-btn" data-act="googleAuth" style="background:#fff;color:#1f1f1f;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none">${t("Continue with Google")}</button>
    <div class="form-footer" style="text-align:center;opacity:.5">${t("or")}</div>
    <label class="form-label" for="auth-email">${t("Email")}</label>
    <input class="field" id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t("Email"))}">
    <label class="form-label" for="auth-pass">${t("Password")}</label>
    <input class="field" id="auth-pass" type="password" autocomplete="current-password" placeholder="${esc(t("Password"))}">
    <div style="display:flex;gap:8px">
      <button class="action-btn" data-act="submitAuth" data-mode="signin" style="flex:1;background:var(--white-08);color:#fff">${t("Log in")}</button>
      <button class="action-btn" data-act="submitAuth" data-mode="signup" style="flex:1">${t("Sign up")}</button>
    </div>`;
}
// Аккаунт в профиле: у вошедшего — email + выход; у анонима — форма входа.
function accountCard() {
  if (!Sync.enabled) return "";
  const email = Sync.email;
  const header = `<div class="between">${lbl(t("Account"), "tracking-1")}${email ? `<span class="badge" style="color:var(--money)">${esc(email)}</span>` : ""}</div>`;
  const inner = email
    ? `<div class="form-footer">${t("Synced across your devices")}</div>
       <button class="action-btn" data-act="signOut" style="background:var(--white-08);color:#fff">${t("Log out")}</button>`
    : `<div class="form-footer">${t("Sign in to sync progress across your devices")}</div>${authForm()}`;
  return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${header}${inner}</div>`;
}

function ResetDataSheet() {
  return sheetShell(t("Reset all test data?"), `<div class="stack">
    <div class="form-footer" style="font-size:15px;line-height:1.5">${t("This removes your local profile, workouts, photos and test coins from this device. This cannot be undone.")}</div>
    <button class="action-btn" data-act="confirmResetData" style="background:var(--red);color:#fff">${t("Reset and start over")}</button>
    <button class="text-btn" data-act="closeSheet">${t("Cancel")}</button>
  </div>`, true);
}

function AuthGateFull() {
  const intent = ui.authIntent || {};
  const reason = intent.kind === "join"
    ? t("To join this challenge, create an account so your progress is saved and visible to other participants.")
    : intent.kind === "account"
      ? t("Create an account to sync progress and use social challenges.")
      : t("To publish or share a challenge, create an account so participants and progress can sync.");
  return `<div class="fullscreen"><div class="screen" style="min-height:100dvh;padding-top:max(18px,env(safe-area-inset-top));display:flex;flex-direction:column;gap:14px">
    <button class="cam-btn" data-act="closeAuthGate" aria-label="${t("Close")}">${icon("xmark")}</button>
    <div class="display" style="font-size:34px">${t("Account required")}</div>
    <div class="form-footer" style="font-size:15px;line-height:1.45">${reason}</div>
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">${authForm()}</div>
    <button class="text-btn" data-act="closeAuthGate">${t("Maybe later")}</button>
  </div></div>`;
}
function openAuthGate(kind, id) {
  ui.authIntent = { kind, id: id || null, returnFull: ui.full };
  ui.full = AuthGateFull;
  render();
}
function closeAuthGate() {
  const intent = ui.authIntent;
  ui.full = intent && intent.returnFull ? intent.returnFull : null;
  ui.authIntent = null;
  render();
}
function resumeAuthIntent() {
  const intent = ui.authIntent;
  ui.authIntent = null;
  if (!intent) { ui.full = null; render(); return; }
  if (intent.kind === "join") { ui.full = null; render(); openJoin(intent.id); return; }
  if (intent.kind === "publicCreate") { ui.form.isPublic = true; ui.full = intent.returnFull || CreateWizard; render(); return; }
  if (intent.kind === "shareCreate") { ui.full = intent.returnFull || CreateWizard; render(); return; }
  ui.full = null;
  render();
}

// ==========================================================================
// Онбординг
// ==========================================================================
// Короткий онбординг: имя → параметры тела → упражнения+максимумы → уровень → норма → вход.
const SYNC_ON = !!(window.Sync && window.Sync.enabled);
const LAST_STEP = SYNC_ON ? 6 : 5;
const STEP = {
  name: 1, physical: 2, exercises: 3, fitness: 4, goal: 5,
  auth: SYNC_ON ? 6 : -1,
};
// Шаг «Твои параметры»: пол карточками, возраст/рост/вес ползунками с кнопками −/+.
// Драг обновляет значение и заливку без render() (ветка data-slider в input-слушателе).
function OnbPhysical() {
  const gender = store["profile.gender"];
  const genderCard = (g) => `<button class="card gender-card ${gender === g ? "selected" : ""}" data-act="onbSet:profile.gender:${g}">
    <span style="color:${gender === g ? "var(--accent)" : "var(--text-secondary)"};display:flex">${icon("person")}</span>
    <span class="gender-card-name">${esc(Gender.name(g))}</span></button>`;
  const row = (ic, label, key, unit) => {
    const [min, max] = RANGES[key], v = store[key];
    const pct = (((v - min) / (max - min)) * 100).toFixed(1);
    return `<div class="physio-row">
      <div class="between">
        <span class="row gap8" style="color:var(--text-secondary)">${icon(ic)}${lbl(label, "tracking-1")}</span>
        <span><span class="physio-num" data-val-for="${key}">${v}</span>${unit ? ` <span class="physio-unit">${esc(unit)}</span>` : ""}</span>
      </div>
      <div class="physio-ctrl">
        <button data-act="dec" data-store="${key}" data-min="${min}" data-max="${max}" aria-label="−">−</button>
        <input type="range" class="physio-slider" data-slider="${key}" min="${min}" max="${max}" step="1" value="${v}" style="--fill:${pct}%" aria-label="${esc(label)}">
        <button data-act="inc" data-store="${key}" data-min="${min}" data-max="${max}" aria-label="+">+</button>
      </div></div>`;
  };
  return `<div class="gender-row">${Gender.all.map(genderCard).join("")}</div>
    ${row("calendar", t("Age"), "profile.age", t("yrs"))}
    ${row("ruler", t("Height"), "profile.heightCm", t("cm"))}
    ${row("scale", t("Weight"), "profile.weightKg", t("kg"))}
    <div class="form-footer">${t("This information is used to personalize your first week workout program. You can edit it later from your profile page.")}</div>`;
}

// Основное упражнение = первое выбранное (по порядку EX_ORDER); от него зависят
// profile.maxReps/startExercise и стартовый замер.
function primaryExercise() { return EX_ORDER.find((ex) => store["profile.sel_" + ex]) || "pushups"; }
const REP_RANGE = [1, 120];
// Дневная цель по одному упражнению: максимум × рабочие сета, с коэффициентом нагрузки.
function exerciseTarget(level, reps, choice) {
  const factor = choice === "easier" ? 0.7 : choice === "harder" ? 1.3 : 1;
  return Math.max(10, Math.round((recommendedDailyReps(level, reps) * factor) / 10) * 10);
}

// Экран «Твои упражнения»: мульти-выбор до 4 упражнений; у каждого выбранного —
// ползунок максимума за подход. Ползунок — сиблинг кнопки-тумблера (иначе тап по
// нему переключал бы выбор).
function OnbExercises() {
  const [min, max] = REP_RANGE;
  return EX_ORDER.map((ex) => {
    const on = store["profile.sel_" + ex], key = "profile.reps." + ex, v = store[key];
    const pct = (((v - min) / (max - min)) * 100).toFixed(1);
    const head = `<button class="onb-ex-head" data-act="toggleStore" data-key="profile.sel_${ex}" aria-pressed="${on}">
      <span class="onb-ex-icon">${exIcon(ex)}</span>
      <span class="onb-ex-name">${esc(Exercise.displayName(ex))}</span>
      <span class="onb-ex-check" style="color:${on ? "var(--accent)" : "var(--text-secondary)"}">${on ? iconF("checkCircle") : icon("plusCircleLine")}</span></button>`;
    const slider = on ? `<div class="onb-ex-slider">
      <div class="between"><span class="label secondary" style="font-size:13px">${t("Max reps in one set")}</span>
        <span><span class="physio-num" data-val-for="${key}">${v}</span> <span class="physio-unit">${t("reps")}</span></span></div>
      <div class="physio-ctrl">
        <button data-act="dec" data-store="${key}" data-min="${min}" data-max="${max}" aria-label="−">−</button>
        <input type="range" class="physio-slider" data-slider="${key}" min="${min}" max="${max}" step="1" value="${v}" style="--fill:${pct}%" aria-label="${esc(Exercise.displayName(ex))}">
        <button data-act="inc" data-store="${key}" data-min="${min}" data-max="${max}" aria-label="+">+</button></div></div>` : "";
    return `<div class="onb-ex card ${on ? "selected" : ""}">${head}${slider}</div>`;
  }).join("");
}

function Onboarding() {
  const step = ui.onbStep, level = store["profile.level"];

  const optionCard = (title, subtitle, selected, act) =>
    `<button class="card ${selected ? "selected" : ""}" data-act="${act}" style="padding:16px;width:100%;display:flex;align-items:center;gap:10px;text-align:left">
      <div style="flex:1"><div class="display" style="font-size:20px">${esc(title)}</div>${subtitle ? `<div class="form-footer" style="margin-top:2px">${esc(subtitle)}</div>` : ""}</div>
      <span style="color:${selected ? "var(--accent)" : "var(--text-secondary)"};display:flex">${selected ? iconF("checkCircle") : icon("plusCircle").replace("M12 8v8M8 12h8", "")}</span>
    </button>`;
  const question = (title, subtitle, content) => `<div class="create-question">
    <div class="display" style="font-size:30px">${esc(title)}</div>${subtitle ? `<div class="form-footer">${esc(subtitle)}</div>` : ""}
    <div class="create-question-content">${content}</div></div>`;

  let content;
  if (step === 0) content = `<div class="center" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
    <div style="color:var(--accent);width:76px;height:76px;display:flex">${iconF("flame")}</div>
    <div class="display" style="font-size:46px">Repact</div>
    <div class="form-footer" style="max-width:320px;font-weight:500">${t("Every rep is verified by the camera. Coins on the line. Miss too many days and you're out.")}</div></div>`;
  // Вход — последний шаг, перед сохранением прогресса (только с Firebase).
  else if (step === STEP.auth) content = question(t("Create your account"), t("So your progress is saved and syncs across your devices."), authForm());
  else if (step === STEP.name) content = question(t("Your name"), t("Friends will see it in the leaderboard."),
    `<input class="field" id="onb-name" value="${esc(store["profile.name"] || "")}" placeholder="${esc(t("Your name"))}" aria-label="${esc(t("Your name"))}" maxlength="20" autocomplete="name">`);
  else if (step === STEP.physical) content = question(t("Your physical profile"), null, OnbPhysical());
  else if (step === STEP.exercises) content = question(t("Your exercises"), t("Pick what you train and set your one-set max."), OnbExercises());
  else if (step === STEP.fitness) content = question(t("Your fitness level"), null, Level.all.map((l) => optionCard(Level.name(l), Level.subtitle(l), level === l, `onbSet:profile.level:${l}`)).join(""));
  // Итоговый шаг: дневная норма = сумма по выбранным упражнениям (каждое на 3–4 сета).
  else {
    const choice = store.goalChoice || "recommended";
    const sel = EX_ORDER.filter((ex) => store["profile.sel_" + ex]);
    const targetFor = (ex) => exerciseTarget(level, store["profile.reps." + ex], choice);
    const total = sel.reduce((s, ex) => s + targetFor(ex), 0);
    const segBtn = (val, label) => `<button data-act="goalChoice:${val}" class="${choice === val ? "active" : ""}">${esc(label)}</button>`;
    content = `<div class="center" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
    ${lbl(t("Your daily goal"), "tracking-15")}
    <div class="money" style="font-size:72px">${total}</div>
    ${lbl(t("reps per day"), "tracking-1")}
    <div class="segmented" style="margin-top:14px;width:100%">${segBtn("easier", t("Easier"))}${segBtn("recommended", t("Recommended"))}${segBtn("harder", t("Harder"))}</div>
    <div class="form-footer" style="margin-top:12px;text-align:center;max-width:320px">${t("%@ level → %lld working sets per exercise.", Level.name(level), Level.sets(level))}</div>
    <div class="card" style="padding:16px;width:100%;display:flex;flex-direction:column;gap:10px;margin-top:16px">
      ${sel.map((ex) => `<div class="between"><span class="row gap8" style="align-items:center"><span style="color:var(--text-secondary);display:flex">${exIcon(ex)}</span>${lbl(Exercise.displayName(ex))}</span><span style="font-weight:600;font-size:15px">${targetFor(ex)}</span></div>`).join("")}
      <div class="between">${lbl(t("Fitness level"))}<span style="font-weight:600;font-size:15px">${esc(Level.name(level))}</span></div>
    </div></div>`;
  }

  // На шаге входа CTA — сами кнопки формы, отдельной кнопки «дальше» нет.
  const authStep = Sync.enabled && step === STEP.auth;
  const footerLabel = step === 0 ? t("Get started") : step === LAST_STEP ? t("Let's go") : t("Continue");
  const footer = authStep
    ? `<div style="padding:0 20px 8px;padding-bottom:calc(8px + env(safe-area-inset-bottom));text-align:center"><div class="form-footer" style="margin-bottom:4px">${t("You’ll get 50 test coins. Guest progress stays only on this device.")}</div><button class="text-btn" data-act="skipAuth" style="width:100%">${t("Continue as guest")}</button></div>`
    : `<div style="padding:0 20px 8px;padding-bottom:calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:4px"><button class="action-btn" data-act="onbNext">${footerLabel}</button>${step === 0 ? `<button class="text-btn" data-act="demo">${t("Try a demo workout")}</button>` : ""}</div>`;
  return `<div style="min-height:100dvh;display:flex;flex-direction:column">
    <div class="row gap12" style="padding:max(10px,env(safe-area-inset-top)) 20px 0;align-items:center">
      ${step > 0 ? `<button data-act="onbBack" aria-label="${t("Back")}" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#fff">${icon("chevronLeft")}</button>` : `<span style="width:32px;height:32px"></span>`}
      <div style="flex:1">${bar(step / LAST_STEP)}</div>
      ${step > 0 ? `<span class="label secondary" style="font-size:12px;white-space:nowrap">${t("Step %lld of %lld", step, LAST_STEP)}</span>` : langToggle()}
    </div>
    <div style="flex:1;padding:0 24px;overflow-y:auto">${content}</div>
    ${footer}
  </div>`;
}

// Завершение онбординга: с Firebase вызывается после успешного входа, без — по кнопке на итоге.
function finishOnboarding() {
  store.dailyGoal = goalForChoice(store["profile.level"], store["profile.maxReps"], store.goalChoice || "recommended");
  store.onboarded = true;
  Sync.registerUser(store["profile.name"]);
  phIdentify();
  track("onboarding_completed", { level: store["profile.level"], daily_goal: store.dailyGoal });
  ui.screen = "tabs";
  // Пришёл по ссылке-приглашению — сразу открываем нужный публичный челлендж.
  if (JOIN_INTENT) {
    ui.tab = "challenges";
    render();
    if (isGuest()) openAuthGate("join", JOIN_ID); else if (app.challenges.some((c) => c.id === JOIN_ID)) openJoin(JOIN_ID);
    return;
  }
  render();
}

// ==========================================================================
// Листы снизу: создать / вступить / замер
// ==========================================================================
function sheetShell(title, body, leftIcon) {
  return `<div class="sheet-backdrop" data-act="closeSheetBg"><div class="sheet" data-stop role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
    <div class="navbar">${leftIcon ? `<button class="icon-btn" data-act="closeSheet" aria-label="${t("Close")}">${icon("xmark")}</button>` : "<div style='width:32px'></div>"}<div class="title">${esc(title)}</div><div style="width:32px"></div></div>
    <div class="sheet-body">${body}</div></div></div>`;
}

function LanguageSheet() {
  const langs = [["en", "EN", "English"], ["ua", "UA", "Українська"], ["ru", "RU", "Русский"]];
  const body = `<div class="language-list">${langs.map(([value, code, name]) => {
    const active = store.lang === value;
    return `<button class="language-option ${active ? "active" : ""}" data-act="setLanguage:${value}" aria-pressed="${active}">
      <span class="language-code">${code}</span><span>${name}</span><span class="language-check">${active ? "✓" : ""}</span>
    </button>`;
  }).join("")}</div>`;
  return sheetShell(t("Choose language"), body, true);
}
function fieldStepper(label, key, min, max, by) {
  const labelId = `lbl-model-${key}`;
  return `<div class="settings-row"><span id="${labelId}">${esc(label)}</span>
    <div class="stepper"><button data-act="dec" data-key="${key}" data-min="${min}" data-max="${max}" data-by="${by || 1}">−</button>
      <input class="mono" type="number" data-model="${key}" value="${ui.form[key]}" aria-labelledby="${labelId}">
      <button data-act="inc" data-key="${key}" data-min="${min}" data-max="${max}" data-by="${by || 1}">+</button></div></div>`;
}

// Создание челленджа: короткий мастер из трёх шагов → карточки итогового ревью.
// Из ревью каждый раздел открывается отдельно и после сохранения возвращает прямо в ревью.
const CREATE_EX = ["pushups", "squats", "pullups", "dips"];
const CREATE_LAST = 3;
function selectedExercises(f) { return CREATE_EX.filter((e) => f["sel_" + e]); }
function defaultTitle(f) {
  const sel = selectedExercises(f);
  if (!sel.length) return t("New challenge");
  return sel.map((e) => `${f[e]} ${Exercise.displayName(e)}`).join(" + ");
}

function createSummary(f) {
  const sel = selectedExercises(f);
  const buyIn = COIN_SYM + fmt(f.buyIn);
  const card = (step, iconName, title, value) => `<button class="card create-review-card" data-act="editCreate:${step}">
    <span class="create-review-icon">${icon(iconName)}</span><span class="create-review-copy"><span class="create-review-label">${esc(title)}</span><span class="create-review-value">${esc(value)}</span></span><span class="secondary">${icon("chevronRight")}</span>
  </button>`;
  const exerciseValue = sel.map((e) => `${Exercise.displayName(e)} · ${t("%lld / day", f[e])}`).join(" + ");
  const rules = [MissPolicy.displayName(f.miss), f.isPublic ? t("Public challenge") : t("Private challenge")];
  if (f.progOn) rules.push(`+${f.progStep} ${f.progPeriod === "day" ? t("per day") : t("per week")}`);
  return `<div class="create-review">
    <div><div class="display create-review-title">${t("Review challenge")}</div><div class="form-footer">${t("Tap any card to make changes before creating.")}</div></div>
    <div class="create-review-name">${esc(f.title.trim() || defaultTitle(f))}</div>
    <div class="create-review-list">
      ${card(0, "flame", t("Exercise & daily goal"), exerciseValue)}
      ${card(1, "calendar", t("Duration"), t("%lld days", f.duration))}
      ${card(2, "checkCircle", t("Rules"), rules.join(" · "))}
      ${card(2, "dollar", t("Stake amount"), buyIn)}
    </div>
  </div>`;
}

function progressionEndText(f) {
  const increments = f.progOn ? progIncrements({ step: f.progStep, period: f.progPeriod }, f.duration) : 0;
  return selectedExercises(f).map((e) => `${Exercise.displayName(e)} ${f[e] + f.progStep * increments}`).join(" · ");
}

function refreshCreateDerived() {
  if (!ui.form || ui.full !== CreateScreen) return;
  const title = document.getElementById("create-title");
  if (title) title.placeholder = defaultTitle(ui.form);
  const finalTarget = document.querySelector(".progression-result strong");
  if (finalTarget) finalTarget.textContent = progressionEndText(ui.form);
}

function CreateWizard() {
  const f = ui.form, step = f.step, sel = selectedExercises(f);
  const seg = (opts, key, cur) => `<div class="segmented">${opts.map(([v, n]) => `<button data-act="seg" data-key="${key}" data-val="${v}" class="${String(cur) === String(v) ? "active" : ""}">${esc(n)}</button>`).join("")}</div>`;
  const question = (title, subtitle, content) => `<div style="padding-top:24px;display:flex;flex-direction:column;gap:8px;height:100%">
    <div class="display" style="font-size:30px">${esc(title)}</div>${subtitle ? `<div class="form-footer">${esc(subtitle)}</div>` : ""}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px">${content}</div></div>`;
  const emptyCircle = icon("plusCircle").replace("M12 8v8M8 12h8", "");
  const checkCard = (ex) => {
    const on = f["sel_" + ex];
    return `<button class="card ${on ? "selected" : ""}" data-act="toggle" data-key="sel_${ex}" style="padding:16px;width:100%;display:flex;align-items:center;gap:12px;text-align:left">
      <span style="display:flex;color:${on ? "var(--accent)" : "var(--text-secondary)"}">${exIcon(ex)}</span>
      <div style="flex:1"><div class="display" style="font-size:20px">${esc(Exercise.displayName(ex))}</div></div>
      <span style="color:${on ? "var(--accent)" : "var(--text-secondary)"};display:flex">${on ? iconF("checkCircle") : emptyCircle}</span>
    </button>`;
  };

  let content, label = t("Continue");
  if (step === 0) content = question(t("Exercise & daily goal"), t("Pick exercises and set a goal for each."), `${CREATE_EX.map(checkCard).join("")}
    <div class="create-goals">${sel.map((e) => fieldStepper(Exercise.displayName(e), e, 5, 500, 5)).join("")}</div>`);
  else if (step === 1) content = question(t("How long?"), t("Choose how long the challenge will run."),
    `<div class="duration-options">${[[14, t("2 weeks"), t("Good for a quick start")], [30, t("1 month"), t("Balanced challenge")], [60, t("2 months"), t("Long-term progress")]].map(([days, title, sub]) => `<button class="duration-option ${+f.duration === days ? "selected" : ""}" data-act="seg" data-key="duration" data-val="${days}"><span><strong>${esc(title)}</strong><small>${esc(sub)} · ${t("%lld days", days)}</small></span>${+f.duration === days ? iconF("checkCircle") : icon("chevronRight")}</button>`).join("")}</div>
    <div class="custom-duration"><div class="form-label">${t("Custom duration")}</div>${fieldStepper(t("Duration (days)"), "duration", 1, 365, 1)}</div>`);
  else if (step === 2) content = question(t("Rules & stake"), t("Set the final details before review."), `
      <section class="create-rule-block"><div class="create-rule-heading"><div class="create-rule-title">${t("Missed days")}</div><div class="form-footer">${t("Missed days decide how many unfinished days you can have before you leave the challenge and lose your stake.")}</div></div>
      <div class="miss-options">${[
        ["never", t("No protection"), t("Miss one day and you're out.")],
        ["oneTotal", t("One safety day"), t("You can miss once during the whole challenge.")],
        ["onePerTwoWeeks", t("Recurring protection"), t("You can miss once in every 14 days.")],
      ].map(([v, title, sub]) => `<button class="miss-option ${f.miss === v ? "selected" : ""}" data-act="seg" data-key="miss" data-val="${v}"><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>${f.miss === v ? iconF("checkCircle") : icon("plusCircle")}</button>`).join("")}</div></section>
      <div class="settings-row"><span id="lbl-isPublic">${t("Public challenge")}</span><button data-act="toggle" data-key="isPublic" role="switch" aria-checked="${f.isPublic}" aria-labelledby="lbl-isPublic" class="toggle ${f.isPublic ? "on" : ""}"></button></div>
      <section class="create-rule-block"><div class="settings-row create-rule-toggle"><span id="lbl-progOn"><strong>${t("Progressive overload")}</strong><small>${t("Increase your daily target gradually as you get stronger.")}</small></span><button data-act="toggle" data-key="progOn" role="switch" aria-checked="${f.progOn}" aria-labelledby="lbl-progOn" class="toggle ${f.progOn ? "on" : ""}"></button></div>
      ${f.progOn ? fieldStepper(t("Increase by"), "progStep", 1, 50, 1) + seg([["day", t("per day")], ["week", t("per week")]], "progPeriod", f.progPeriod) + `<div class="progression-result"><span>${t("Final daily target")}</span><strong>${esc(progressionEndText(f))}</strong></div>` : `<div class="form-footer">${t("No increase — the daily target stays the same.")}</div>`}</section>
      <div class="form-section"><div class="form-label">${t("Stake amount")}</div><div class="row gap8"><span class="secondary money" style="font-size:24px">${COIN_SYM}</span><input class="field money" type="number" inputmode="numeric" data-model="buyIn" value="${f.buyIn}" style="font-size:24px"></div></div>
      <div class="form-section"><label class="form-label" for="create-title">${t("Challenge name")}</label><input id="create-title" class="field" data-model="title" value="${esc(f.title)}" placeholder="${esc(defaultTitle(f))}" maxlength="40"></div>`);
  else content = createSummary(f);

  const footer = step === CREATE_LAST
    ? `<div class="create-wizard-footer"><button class="action-btn" data-act="saveChallenge">${t("Create challenge")}</button></div>`
    : `<div class="create-wizard-footer"><button class="action-btn" data-act="createNext">${f.editingFromReview ? t("Save changes") : label}</button></div>`;

  return `<div class="fullscreen"><div class="create-wizard">
    <div class="row gap12 create-wizard-topbar">
      <button data-act="createBack" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#fff">${icon(step > 0 ? "chevronLeft" : "xmark")}</button>
      <div style="flex:1">${bar(step / CREATE_LAST)}</div>
    </div>
    <div class="create-wizard-body">${content}</div>
    ${footer}
  </div></div>`;
}

// Одностраничная форма создания (референс Repito): все секции на одном прокручиваемом экране.
const CREATE_DUR_CHIPS = [3, 7, 14, 30];
const CREATE_REP_CHIPS = [50, 100, 200, 500];
function CreateScreen() {
  const f = ui.form, sel = selectedExercises(f);
  const section = (label, content, cls) => `<section class="create-section${cls ? " " + cls : ""}"><div class="create-section-label">${esc(label)}</div>${content}</section>`;
  const pick = (act, on, emoji, title, sub, ic) => `<button class="create-pick ${on ? "selected" : ""}" data-act="${act}">
    ${emoji ? `<span class="create-pick-emoji">${emoji}</span>` : ""}${ic ? `<span class="create-pick-ic">${exIcon(ic)}</span>` : ""}
    <span class="create-pick-title">${esc(title)}</span>${sub ? `<span class="create-pick-sub">${esc(sub)}</span>` : ""}</button>`;
  // Чипы значений: активный — если совпал. «Custom»-чип по тапу сам превращается
  // в поле ручного ввода прямо на своём месте (числовая клавиатура), без отдельной секции.
  const chips = (key, values, current, suffix, min, max, label) => {
    const custom = !!f["custom_" + key];
    const customChip = custom
      ? `<input class="create-chip create-chip-input selected" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"
          data-model="${key}" data-num data-min="${min}" data-max="${max}" value="${esc(String(current))}" aria-label="${esc(label || t("Custom"))}">`
      : `<button class="create-chip" data-act="createCustom:${key}" data-min="${min}" data-max="${max}" data-label="${esc(label || t("Custom"))}">${t("Custom")}</button>`;
    return `<div class="create-chips">
      ${values.map((v) => `<button class="create-chip ${!custom && +current === v ? "selected" : ""}" data-act="createChip:${key}:${v}">${v}${suffix || ""}</button>`).join("")}
      ${customChip}</div>`;
  };

  const typeSection = section(t("Challenge type"), `<div class="create-grid-2">
    ${pick(`seg" data-key="type" data-val="streak`, f.type === "streak", "🔥", t("Streak"), t("Daily minimum reps"))}
    ${pick(`seg" data-key="type" data-val="goal`, f.type === "goal", "🎯", t("Goal"), t("Hit a total rep target"))}</div>`);

  const exSection = section(t("Exercise"), `<div class="create-grid-2">
    ${CREATE_EX.map((ex) => pick(`toggle" data-key="sel_${ex}`, f["sel_" + ex], null, Exercise.displayName(ex), null, ex)).join("")}</div>`);

  const durSection = section(t("Duration"), chips("duration", CREATE_DUR_CHIPS, f.duration, t("d"), 1, 365, t("Days")));

  const repLabel = f.type === "goal" ? t("Total reps") : t("Daily minimum reps");
  const repSection = sel.length ? section(repLabel, sel.map((ex) => `<div class="create-rep-row">
    ${sel.length > 1 ? `<div class="create-rep-name">${esc(Exercise.displayName(ex))}</div>` : ""}
    ${chips(ex, CREATE_REP_CHIPS, f[ex], "", 5, 5000, Exercise.displayName(ex))}</div>`).join("")) : "";

  const accessSection = section(t("Who can join"), `<div class="create-grid-3">
    ${pick(`seg" data-key="access" data-val="private`, f.access === "private", "🔗", t("Private"), t("Invite by link"))}
    ${pick(`seg" data-key="access" data-val="public`, f.access === "public", "🌐", t("Public"), t("Anyone joins"))}
    ${pick(`seg" data-key="access" data-val="solo`, f.access === "solo", "🧍", t("Solo"), t("Just you"))}</div>
    ${f.access === "public" ? `<div class="create-subfield">${fieldStepper(t("Players to gather"), "minPlayers", 2, 50, 1)}</div>` : ""}`);

  const missBlock = `<section class="create-rule-block"><div class="create-rule-heading"><div class="create-rule-title">${t("Missed days")}</div><div class="form-footer">${t("Missed days decide how many unfinished days you can have before you leave the challenge and lose your stake.")}</div></div>
    <div class="miss-options">${[
      ["never", t("No protection"), t("Miss one day and you're out.")],
      ["oneTotal", t("One safety day"), t("You can miss once during the whole challenge.")],
      ["onePerTwoWeeks", t("Recurring protection"), t("You can miss once in every 14 days.")],
    ].map(([v, title, sub]) => `<button class="miss-option ${f.miss === v ? "selected" : ""}" data-act="seg" data-key="miss" data-val="${v}"><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>${f.miss === v ? iconF("checkCircle") : icon("plusCircle")}</button>`).join("")}</div></section>`;
  const progBlock = `<section class="create-rule-block"><div class="settings-row create-rule-toggle"><span id="lbl-progOn"><strong>${t("Progressive overload")}</strong><small>${t("Increase your daily target gradually as you get stronger.")}</small></span><button data-act="toggle" data-key="progOn" role="switch" aria-checked="${f.progOn}" aria-labelledby="lbl-progOn" class="toggle ${f.progOn ? "on" : ""}"></button></div>
    ${f.progOn ? fieldStepper(t("Increase by"), "progStep", 1, 50, 1) + `<div class="segmented">${[["day", t("per day")], ["week", t("per week")]].map(([v, n]) => `<button data-act="seg" data-key="progPeriod" data-val="${v}" class="${f.progPeriod === v ? "active" : ""}">${esc(n)}</button>`).join("")}</div><div class="progression-result"><span>${t("Final daily target")}</span><strong>${esc(progressionEndText(f))}</strong></div>` : `<div class="form-footer">${t("No increase — the daily target stays the same.")}</div>`}</section>`;

  const stakeSection = section(t("Stake & rules"), `
    <div class="form-section"><div class="form-label">${t("Stake amount")}</div><div class="row gap8"><span class="secondary money" style="font-size:24px">${COIN_SYM}</span><input class="field money" type="number" inputmode="numeric" data-model="buyIn" value="${f.buyIn}" style="font-size:24px"></div></div>
    <div class="form-section"><label class="form-label" for="create-title">${t("Challenge name")}</label><input id="create-title" class="field" data-model="title" value="${esc(f.title)}" placeholder="${esc(defaultTitle(f))}" maxlength="40"></div>
    ${f.type === "streak" ? missBlock + progBlock : ""}`, "create-section-major");

  return `<div class="fullscreen"><div class="create-wizard">
    <div class="row gap12 create-wizard-topbar">
      <button class="create-close" data-act="closeFull" aria-label="${t("Close")}">${icon("xmark")}</button>
      <div class="create-wizard-heading">${t("New challenge")}</div>
    </div>
    <div class="create-wizard-body create-form">${typeSection}${exSection}${durSection}${repSection}${accessSection}${stakeSection}</div>
    <div class="create-wizard-footer"><button class="action-btn" data-act="saveChallenge">${iconF("checkCircle")}${t("Create challenge")}</button></div>
  </div></div>`;
}

// Собрать goals из выбранных упражнений и создать челлендж. false — если нечем оплатить/ничего не выбрано.
async function saveChallengeForm() {
  if (!ui.form) return false; // второй тап после того как первый уже создал челлендж и обнулил форму
  const f = ui.form, sel = selectedExercises(f);
  if (!sel.length) { toast(t("Pick at least one exercise")); return false; }
  const clampV = (n) => Math.min(Math.max(+n || 0, 1), 5000);
  // streak — дневная норма (≤500); goal — цель повторов всего (≤5000).
  const goals = sel.map((e) => f.type === "goal" ? { exercise: e, target: clampV(f[e]) } : { exercise: e, repsPerDay: Math.min(clampV(f[e]), 500) });
  const access = f.access || "solo";
  const isPublic = access !== "solo";
  // solo стартует сразу; private ждёт кнопки создателя, public — набора участников (startAt=null → Pending).
  const ok = await createChallenge({
    title: f.title.trim() || defaultTitle(f), goals, type: f.type || "streak", access,
    minPlayers: access === "public" ? Math.min(Math.max(f.minPlayers, 2), 50) : 0,
    startAt: access === "solo" ? startOfDay(Date.now()) : null,
    durationDays: Math.min(Math.max(f.duration, 1), 365), buyIn: Math.max(f.buyIn, 0), isPublic, missPolicy: f.miss,
    progression: f.type === "streak" && f.progOn ? { step: f.progStep, period: f.progPeriod } : { step: 0, period: "day" },
  });
  if (ok === "publish-failed") { toast(t("Couldn't publish challenge. Check your connection and try again.")); return false; }
  if (!ok) { toast(t("Not enough coins")); return false; }
  return true;
}
function ChallengeCreatedFull() {
  const c = app.challenges.find((x) => x.id === ui.createdChallengeId);
  if (!c) return "";
  // Состав — из созданного челленджа (а не формы); при дефолтном названии не дублируем.
  const composition = c.goals.map((g) => `${g.repsPerDay || g.target} ${Exercise.displayName(g.exercise)}`).join(" + ");
  return `<div class="fullscreen"><div class="celebrate created">
    <div class="created-hero">
      <div class="prep-hero">${iconF("checkCircle")}</div>
      <div class="display" style="font-size:34px">${t("Challenge created")}</div>
      <div class="created-name">${esc(c.title)}</div>
      ${composition !== c.title ? `<div class="created-goals">${esc(composition)}</div>` : ""}
      <div class="created-sub">${t("Invite people now or share it later from the challenge page.")}</div>
    </div>
    <div class="created-actions">
      <button class="action-btn" data-act="shareCreated">${icon("share")}${t("Share invite")}</button>
      <button class="action-btn plain" data-act="copyCreated">${t("Copy link")}</button>
      <button class="text-btn" data-act="openCreated">${t("Open challenge")}</button>
    </div>
  </div></div>`;
}
// Карточка условий картинкой — тот же генератор, что и для результатов (Web Share API → инста и т.п.).
function shareChallengeCard(f) {
  const sel = selectedExercises(f);
  shareChallengePoster({
    duration: f.duration,
    exercises: sel.map((e) => ({ ex: e, name: Exercise.displayName(e), reps: f[e] })),
    stake: COIN_SYM + fmt(f.buyIn),
    miss: MissPolicy.displayName(f.miss),
  });
}

function JoinSheet() {
  const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
  const body = `
    <div class="form-section">${lbl(t("Before you start"))}
      ${fieldStepper(t("Weight"), "weight", 35, 180, 1)}
      ${fieldStepper(t("Max reps in one set"), "maxReps", 1, 120, 1)}
      <div class="form-footer">${t("Your starting point — at the finish you'll see how far you've come.")}</div>
    </div>
    <div class="form-section">${lbl(t("Photo BEFORE"))}
      ${f.photo ? `<div class="photo-slot" style="height:220px"><img src="${f.photo}" alt="${t("Photo BEFORE")}"></div>` : ""}
      <button class="action-btn" data-act="pickPhoto:camera" style="background:var(--white-08);color:#fff">${iconF("camera")}${f.photo ? t("Retake") : t("Take a photo")}</button>
      <button class="action-btn" data-act="pickPhoto:library" style="background:var(--white-08);color:#fff">${iconF("photo")}${t("Upload from library")}</button>
      <div class="form-footer">${t("The photo stays hidden until the finish — then it appears next to your AFTER photo.")}</div>
    </div>
    <button class="action-btn" data-act="submitJoin">${t("Join for")} ${coin(c.buyIn)}</button>
    <div class="form-footer" style="text-align:center;font-size:11px">🔥 ${t("Test coins · no cash value")}</div>`;
  return sheetShell(c.title, body, false);
}

function MeasureSheet() {
  const body = `${fieldStepper(t("Weight"), "weight", 35, 180, 1)}${fieldStepper(t("Max reps in one set"), "maxReps", 1, 120, 1)}
    <button class="action-btn" data-act="submitMeasure">${t("Save")}</button>`;
  return sheetShell(t("New measurement"), body, true);
}

// Календарь дней участника: тап по строке лидерборда (данные из Firebase).
function ParticipantSheet() {
  const id = ui.form.participantId;
  const challenges = userChallenges(id);
  const c = app.challenges.find((x) => x.id === ui.form.challengeId) || challenges[0];
  const p = c && c.participants.find((x) => x.id === id);
  const user = (Sync.state.users && Sync.state.users[id]) || {};
  if (!p && !user.name) return sheetShell(t("Leaderboard"), "", true);
  const startKey = c && challengeStartKey(c);
  const cells = [];
  for (let day = 1; c && day <= c.durationDays; day++) {
    let cls = "future";
    if (startKey && day <= c.currentDay) {
      const dd = (p._days || {})[dateKey(dayEpoch(startKey, day))] || {};
      const sum = Object.values(dd).reduce((a, b) => a + b, 0);
      if (dayClosed(c, day, dd)) cls = "closed";
      else if (day === c.currentDay) cls = "current";
      else cls = sum > 0 ? "partial" : "missed";
    }
    cells.push(`<div class="cal-cell ${cls}">${day}</div>`);
  }
  const legend = (cls, txt) => `<span class="row gap6" style="font-size:12px"><span class="cal-dot ${cls}"></span><span class="secondary">${esc(txt)}</span></span>`;
  const isMe = id === Sync.uid;
  const name = isMe ? t("You") : (user.name || (p && p.name) || "?");
  const total = challenges.reduce((sum, challenge) => {
    const member = challenge.participants.find((x) => x.id === id);
    return sum + (member ? member._total || member.todayReps || 0 : 0);
  }, 0);
  const challengeRows = challenges.map((challenge) => {
    const member = challenge.participants.find((x) => x.id === id);
    return `<button class="card card-soft" data-act="notification:${challenge.id}" style="padding:14px 16px;width:100%;display:flex;align-items:center;gap:12px;text-align:left">
      <span style="flex:1"><strong style="display:block;font-size:15px">${esc(challenge.title)}</strong><span class="secondary" style="font-size:12px">${member && member.doneToday ? t("Completed") : `${member ? member.todayReps : 0} / ${C.repsNorm(challenge)}`}</span></span>${icon("chevronRight")}
    </button>`;
  }).join("");
  const follow = !isMe ? `<button class="action-btn ${isFollowing(id) ? "money" : ""}" data-act="follow:${id}" style="${isFollowing(id) ? "" : "background:var(--white-08);color:#fff"}">${icon(isFollowing(id) ? "check" : "plus")}${t(isFollowing(id) ? "Unfollow" : "Follow")}</button>` : "";
  const calendar = c ? `<div class="form-section">${lbl(c.title, "tracking-1")}<div class="cal-grid">${cells.join("")}</div>
    <div class="wrap" style="gap:8px 14px">${legend("closed", t("Closed"))}${legend("current", t("Today"))}${legend("missed", t("Missed"))}${legend("future", t("Upcoming"))}</div></div>` : "";
  const body = `
    <div class="social-profile-head">
      <div class="avatar social-profile-avatar">${isMe ? icon("person") : esc(name.slice(0, 1))}</div>
      <div class="display" style="font-size:26px">${esc(name)}</div>
      <div class="secondary" style="font-size:13px">${t("Following %lld", followingCount(id))} · ${t("Followers %lld", followerCount(id))}</div>
    </div>
    <div class="card social-stat"><span class="secondary">${t("Total reps")}</span><strong class="money">${total}</strong></div>
    ${follow}
    <div class="form-section">${lbl(t("Challenges joined"), "tracking-1")}${challengeRows || `<div class="secondary">${t("No active challenges")}</div>`}</div>
    ${calendar}`;
  return sheetShell(name, body, true);
}

// ==========================================================================
// Поздравления
// ==========================================================================
function confetti() {
  const colors = ["#c8ff21", "#45d483", "#ffd60a", "#fff", "#a855f7"];
  let s = "";
  for (let i = 0; i < 44; i++) {
    const x = (i * 37) % 100, delay = ((i * 13) % 9) / 10, dur = 1.6 + ((i * 7) % 12) / 10;
    s += `<i style="left:${x}%;background:${colors[i % colors.length]};animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
  }
  return `<div class="confetti">${s}</div>`;
}
function DayCompleteFull() {
  const c = app.challenges.find((x) => x.id === ui.fullId);
  const today = C.myTodayTotal(c), extra = Math.max(0, today - C.repsNorm(c));
  const workout = workoutSummary(c);
  const days = app.history.flatMap((d) => d.entries.filter((e) => e.title === c.title).map((e) => e.reps));
  const best = Math.max(today, ...days, 0);
  const ranked = C.active(c).slice().sort((a, b) => b.todayReps - a.todayReps);
  const rank = Math.max(1, ranked.findIndex((p) => p.isMe) + 1);
  return `<div class="fullscreen">${confetti()}<div class="celebrate">
    <div class="c-money pop-in" style="font-size:84px;display:flex">${iconF("seal")}</div>
    <div class="display" style="font-size:42px">${t("Day done!")}</div>
    <div class="form-footer" style="max-width:360px">${t("%lld reps today. Day %lld of %lld in the bag.", C.myTodayTotal(c), c.currentDay, c.durationDays)}</div>
    ${workout.sets ? `<div class="day-workout-summary">
      <div><span>${t("Time")}</span><strong>${workout.time}</strong></div>
      <div><span>${t("Sets")}</span><strong>${workout.sets}</strong></div>
      <div><span>${t("Average set")}</span><strong>${workout.average}</strong></div>
    </div>${workout.improvementMs ? `<div class="day-improvement">${icon("trend")}${t("%lld sec faster", Math.round(workout.improvementMs / 1000))}</div>` : ""}` : ""}
    <div class="day-win-stats">
      <div><span>${t("Above goal")}</span><strong>+${extra}</strong></div>
      <div><span>${t("Best day")}</span><strong>${best}</strong></div>
      <div><span>${t("Today's place")}</span><strong>${t("%lld of %lld", rank, ranked.length)}</strong></div>
      <div><span>${t("Streak")}</span><strong>${myStreak(c)}</strong></div>
    </div>
    <button class="action-btn" data-act="shareDay:${c.id}" style="max-width:320px">${iconF("share")}${t("Share")}</button>
    <button class="text-btn" data-act="closeFull">${t("Close")}</button>
  </div></div>`;
}
function WorkoutResultFull() {
  const r = ui.workoutResult;
  const c = r && app.challenges.find((x) => x.id === r.challengeId);
  if (!r || !c) return "";
  const reps = Object.values(r.counts).reduce((sum, n) => sum + n, 0);
  const today = C.myTodayTotal(c), norm = C.repsNorm(c);
  const pct = Math.min(100, Math.round(today / Math.max(norm, 1) * 100));
  const sets = r.stats.setReps.filter((n) => n > 0);
  const best = sets.length ? Math.max(...sets) : reps;
  const breakdown = c.goals.map((g) => {
    const n = r.counts[g.exercise] || 0;
    return n ? `<span>${esc(Exercise.displayName(g.exercise))}<strong>${n}</strong></span>` : "";
  }).join("");
  return `<div class="fullscreen workout-result">${r.dayClosed ? confetti() : ""}<div class="workout-result-shell">
    <div class="workout-result-verified">${iconF("seal")}<span>${t("AI verified")}</span></div>
    <div class="workout-result-title">${r.dayClosed ? t("Day done!") : t("Workout saved")}</div>
    <div class="workout-result-hero"><strong>${reps}</strong><span>${t("reps")}</span></div>
    ${breakdown ? `<div class="workout-result-breakdown">${breakdown}</div>` : ""}
    <div class="workout-result-progress">
      <div><span>${t("Daily goal")}</span><strong>${today} / ${norm}</strong></div>
      <div class="progress ${today >= norm ? "money" : ""}"><span style="width:${pct}%"></span></div>
      <small>${today >= norm ? t("Goal reached!") : t("%lld left", Math.max(0, norm - today))}</small>
    </div>
    <div class="workout-result-metrics">
      <div><span>${t("Time")}</span><strong>${workoutClock(r.stats.elapsedMs)}</strong></div>
      <div><span>${t("Sets")}</span><strong>${sets.length || 1}</strong></div>
      <div><span>${t("Best set")}</span><strong>${best}</strong></div>
    </div>
    <div class="workout-result-actions">
      <button class="action-btn" data-act="shareDay:${c.id}">${iconF("share")}${t("Share")}</button>
      <button class="text-btn" data-act="closeFull">${t("Done")}</button>
    </div>
  </div></div>`;
}
function ShareDayEditorFull() {
  const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
  if (!c) return "";
  const photo = f.background === "photo" && f.photo;
  return `<div class="fullscreen share-editor"><div class="share-editor-shell">
    <div class="navbar"><button class="icon-btn" data-act="closeShareDay" aria-label="${t("Back")}">${icon("chevronLeft")}</button><div class="title">${t("Share your day")}</div><span style="width:40px"></span></div>
    <div class="share-story-preview ${photo ? "has-photo" : "is-gradient"} template-${f.template}" style="--photo-scale:${f.photoZoom};--photo-x:${f.photoX}%;--photo-y:${f.photoY}%;--story-dim:${f.dim / 100}">
      ${photo ? `<img src="${photo}" alt="" draggable="false">` : `<div class="share-gradient"></div>`}
      <div class="share-story-shade"></div>
      <div class="share-story-copy">${shareStoryCopy(c, f)}</div>
    </div>
    <div class="share-editor-controls">
      <div class="form-label">${t("Template")}</div>
      <div class="segmented share-template-picker">
        <button data-act="shareTemplate:minimal" class="${f.template === "minimal" ? "active" : ""}">${t("Minimal")}</button>
        <button data-act="shareTemplate:challenge" class="${f.template === "challenge" ? "active" : ""}">${t("Challenge")}</button>
      </div>
      <div class="form-label">${t("Choose a background")}</div>
      <div class="share-bg-options">
        <button class="share-bg-option ${f.background === "gradient" ? "selected" : ""}" data-act="shareBg:gradient"><span class="share-bg-swatch gradient"></span><span>${t("Repact gradient")}</span></button>
        <button class="share-bg-option ${photo ? "selected" : ""}" data-act="pickSharePhoto:library"><span class="share-bg-swatch">${iconF("photo")}</span><span>${t("Photo library")}</span></button>
        <button class="share-bg-option" data-act="pickSharePhoto:camera"><span class="share-bg-swatch">${iconF("camera")}</span><span>${t("Open camera")}</span></button>
      </div>
      ${photo ? sharePhotoControls(f) : ""}
      <button class="action-btn" data-act="publishDay:${c.id}">${iconF("share")}${t("Share story")}</button>
    </div>
  </div></div>`;
}

function ShareCompleteFull() {
  return `<div class="fullscreen share-complete"><div class="celebrate">
    <div class="share-complete-hero">
      <div class="share-complete-mark pop-in">${iconF("checkCircle")}</div>
      <div class="display share-complete-title">${t("Shared!")}</div>
      <div class="form-footer share-complete-copy">${t("Your result has been shared.")}</div>
    </div>
    <div class="share-complete-actions">
      <button class="action-btn" data-act="shareDoneHome">${iconF("home")}${t("Go to Home")}</button>
      <button class="text-btn" data-act="shareDoneBack">${t("Back to result")}</button>
    </div>
  </div></div>`;
}

function openShareComplete(returnState) {
  ui.shareReturnState = returnState || null;
  ui.full = ShareCompleteFull;
  ui.form = null;
  render();
}

// Длительность для сторис: до часа — MM:SS, от часа — H:MM:SS.
function shareDuration(ms) {
  const s = Math.max(0, Math.round((+ms || 0) / 1000));
  if (s < 3600) return workoutClock(ms);
  return Math.floor(s / 3600) + ":" + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
// Базовый размер hero-числа minimal-оверлея (в cqw = % ширины канваса 1080px).
// Подстраховка от переполнения safe-area на редких 5+-значных суммах — до 4 цифр
// (реалистичный потолок при 4 упражнениях по ≤500/день) базовый размер помещается впритык.
const SHARE_HERO_CQW = 32;
const REPACT_SLOGAN = "DON’T JUST SAY IT. PROVE IT.";
function shareSloganCopy() {
  return store.lang === "ua"
    ? { lead: "НЕ ПРОСТО КАЖИ.", proof: "ДОВЕДИ ЦЕ!" }
    : { lead: "DON’T JUST SAY IT.", proof: "PROVE IT." };
}
function shareHeroCqw(total) { return String(total).length >= 5 ? 24 : SHARE_HERO_CQW; }
// Три метрики minimal-оверлея: тренировка (время/сеты/среднее) или, без сетов, — день/повторы/процент цели.
function shareDayStats(c, workout) {
  if (workout.sets) return [
    [workout.time, t("Time")],
    [String(workout.sets), t("Sets")],
    [String(workout.average), t("Avg / set")],
  ];
  const pct = Math.round(C.myTodayTotal(c) / Math.max(C.repsNorm(c), 1) * 100);
  return [
    [`${c.currentDay}/${c.durationDays}`, t("Day")],
    [String(C.myTodayTotal(c)), t("Reps")],
    [pct + "%", t("Goal")],
  ];
}
function shareStoryCopy(c, f) {
  const workout = workoutSummary(c);
  const slogan = shareSloganCopy();
  if (f.template === "challenge") {
    const exercises = c.goals.map((g) => `${C.myToday(c, g.exercise)} ${Exercise.displayName(g.exercise).toLowerCase()}`).join(" · ");
    const workoutLine = workout.sets ? `<div class="share-session-line"><strong>${workout.time}</strong><span>${t("%lld sets", workout.sets)}</span><span>${t("avg %lld", workout.average)}</span></div>${workout.improvementMs ? `<div class="share-improvement">${t("%lld sec faster", Math.round(workout.improvementMs / 1000))}</div>` : ""}` : "";
    return `
    <div class="share-challenge-axis"></div>
    <div class="share-challenge-kicker">${t("AI verified")} · ${t("Day")} ${c.currentDay}</div>
    <div class="share-dare"><span>${t("I did mine")}</span><strong>${C.myTodayTotal(c)}</strong><small>${t("reps")}</small></div>
    <div class="share-dare-exercises">${esc(exercises)}</div>
    ${workoutLine}
    <div class="share-reward"><span>${t("Potential reward")}</span><strong>${COIN_SYM}${fmt(C.payout(c))}</strong></div>
    <div class="share-challenge-cta"><span>${slogan.lead}</span><strong>${slogan.proof}</strong></div>
    <div class="share-brand"><div class="share-brand-lockup"><img src="icons/icon-1024.png" alt=""><b>REP<span>ACT</span></b></div><small>${t("Day")} ${c.currentDay} / ${c.durationDays}</small></div>`;
  }
  // Minimal: Strava-style оверлей — статистика прямо на фото, без плашек.
  const exercisesCaps = c.goals.map((g) => `${C.myToday(c, g.exercise)} ${Exercise.displayName(g.exercise)}`).join(" · ");
  const stats = shareDayStats(c, workout);
  return `
    <div class="share-verified"><span class="share-verified-star">✦</span>${t("AI verified")}</div>
    <div class="share-hero">
      <div class="share-hero-value" style="font-size:${shareHeroCqw(C.myTodayTotal(c))}cqw">${C.myTodayTotal(c)}</div>
      <div class="share-hero-label">${t("Reps")}</div>
    </div>
    <div class="share-exercise-summary">${esc(exercisesCaps)}</div>
    <div class="share-minimal-progress"><span style="width:${Math.min(100, Math.round(C.myTodayTotal(c) / Math.max(C.repsNorm(c), 1) * 100))}%"></span></div>
    <div class="share-stats">${stats.map(([v, l]) => `<div class="share-stat"><span class="share-stat-value">${esc(v)}</span><span class="share-stat-label">${esc(l)}</span></div>`).join(`<span class="share-stat-divider"></span>`)}</div>
    ${workout.improvementMs > 0 ? `<div class="share-insight">${shareDuration(workout.improvementMs)} ${t("faster than last time")}</div>` : ""}
    <div class="share-slogan">${slogan.lead} <strong>${slogan.proof}</strong></div>
    <div class="share-footer">
      <div class="share-wordmark"><img src="icons/icon-1024.png" alt="">REP<span>ACT</span></div>
      <div class="share-day">${t("Day")} ${c.currentDay} / ${c.durationDays}</div>
    </div>`;
}

function sharePhotoControls(f) {
  return `<div class="share-photo-controls">
    <label><span>${t("Photo scale")}</span><input type="range" min="1" max="2" step="0.05" value="${f.photoZoom}" data-model="photoZoom"></label>
    <label><span>${t("Background dimming")}</span><input type="range" min="10" max="85" step="5" value="${f.dim}" data-model="dim"></label>
    <div class="form-footer">${t("Drag the photo to position it")}</div>
  </div>`;
}
function repactPrize() {
  return `<svg class="repact-prize-mark" viewBox="0 0 96 96" aria-hidden="true">
    <defs>
      <linearGradient id="repactPrizeGradient" x1="18" y1="12" x2="78" y2="84" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F2FF5B"/><stop offset=".42" stop-color="#C8FF21"/><stop offset="1" stop-color="#45D483"/>
      </linearGradient>
      <filter id="repactPrizeGlow" x="-35%" y="-35%" width="170%" height="170%">
        <feGaussianBlur stdDeviation="4" result="blur"/><feFlood flood-color="#C8FF21" flood-opacity=".34"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path class="repact-prize-ring" d="M48 7 78 24v35L48 89 18 59V24L48 7Z"/>
    <g fill="url(#repactPrizeGradient)" filter="url(#repactPrizeGlow)">
      <path d="M28 27h25c11 0 19 8 19 19 0 8-4 14-11 17l-8-8c5-1 8-4 8-9 0-5-4-9-9-9H39v8L25 34l14-12v5H28Z"/>
      <path d="M68 69H43c-11 0-19-8-19-19 0-8 4-14 11-17l8 8c-5 1-8 4-8 9 0 5 4 9 9 9h13v-8l14 11-14 12v-5h11Z"/>
    </g>
  </svg>`;
}
function ChallengeCompleteFull() {
  const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
  const weightChange = c.startWeight != null ? `${c.startWeight} → ${f.weight} ${t("kg")} (${f.weight - c.startWeight > 0 ? "+" : ""}${f.weight - c.startWeight})` : t("%lld kg", f.weight);
  const maxChange = c.startMaxReps != null ? `${c.startMaxReps} → ${f.maxReps} (${f.maxReps - c.startMaxReps > 0 ? "+" : ""}${f.maxReps - c.startMaxReps})` : String(f.maxReps);
  return `<div class="fullscreen challenge-complete">${confetti()}<div class="screen challenge-complete-content">
    <header class="challenge-complete-hero">
      <div class="challenge-complete-trophy pop-in">${repactPrize()}</div>
      <div class="display challenge-complete-title">${t("Challenge complete!")}</div>
      <div class="row gap6">${lbl(t("You take home"))}<span class="c-money money" style="font-size:22px">${coinCountUp(C.payout(c), "winPayout", true)}</span></div>
    </header>

    <div class="card" style="padding:16px;width:100%;display:flex;flex-direction:column;gap:12px;text-align:left">
      ${lbl(t("Before / After"), "tracking-1")}
      <div class="grid2">
        <div style="display:flex;flex-direction:column;gap:6px"><div class="photo-slot" style="height:190px">${c.beforePhoto ? `<img src="${c.beforePhoto}" alt="${t("Before")}">` : icon("camera")}</div>${lbl(t("Before"))}</div>
        <div style="display:flex;flex-direction:column;gap:6px"><div class="photo-slot accent" style="height:190px">${f.photo ? `<img src="${f.photo}" alt="${t("After")}">` : iconF("camera")}</div>${lbl(t("After"))}</div>
      </div>
      <div class="challenge-photo-actions">
        <button class="action-btn" data-act="pickPhoto:camera">${iconF("camera")}${f.photo ? t("Retake") : t("Take photo")}</button>
        <button class="action-btn" data-act="pickPhoto:library">${iconF("photo")}${t("Upload")}</button>
      </div>
    </div>

    <div class="card" style="padding:16px;width:100%;display:flex;flex-direction:column;gap:12px">
      ${fieldStepper(t("Weight"), "weight", 35, 180, 1)}${fieldStepper(t("Max reps in one set"), "maxReps", 1, 120, 1)}
    </div>

    <button class="action-btn" data-act="shareResult:${c.id}" style="width:100%">${iconF("share")}${t("Share result")}</button>
    <button class="action-btn money" data-act="saveResult:${c.id}" style="width:100%">${t("Save to profile")}</button>
    <button class="text-btn" data-act="closeFull">${t("Close")}</button>
  </div></div>`;
}

function DemoCompleteFull() {
  const reps = (ui.form && ui.form.demoReps) || 5;
  const onboarding = ui.screen === "onboarding";
  return `<div class="fullscreen">${confetti()}<div class="celebrate">
    <div class="c-money pop-in" style="font-size:84px;display:flex">${iconF("checkCircle")}</div>
    <div class="display" style="font-size:38px">${t("Camera check complete")}</div>
    <div class="money" style="font-size:64px">${reps}</div>
    <div class="form-footer" style="max-width:340px;font-size:15px">${t("Your reps were recognized correctly. Join a challenge to start saving progress.")}</div>
    <div class="spacer"></div>
    <button class="action-btn" data-act="${onboarding ? "onbFromDemo" : "findChallengeDemo"}" style="max-width:340px">${icon(onboarding ? "flame" : "search")}${t(onboarding ? "Get started" : "Find a challenge")}</button>
    <button class="text-btn" data-act="demoAgain">${t("Try again")}</button>
  </div></div>`;
}
function openDemoComplete(reps) {
  ui.form = { demoReps: reps };
  ui.full = DemoCompleteFull;
  render();
}

// ==========================================================================
// Шеринг результата (рендер карточки на canvas → Web Share / скачивание)
// ==========================================================================
function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
// Перенос текста по словам (до maxLines строк, последняя — с многоточием).
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxW) last = last.replace(/\s*\S$/, "");
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

async function shareCard(data) {
  const W = 1080, H = 1920, pad = 88;
  const before = await loadImg(data.beforePhoto), after = await loadImg(data.afterPhoto);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (after) {
    const scale = Math.max(W / after.width, H / after.height);
    const drawW = after.width * scale, drawH = after.height * scale;
    g.drawImage(after, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
  } else {
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#080808"); base.addColorStop(.55, "#1d100b"); base.addColorStop(1, "#070907");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * .9, H * .14, 0, W * .9, H * .14, 760);
    glow.addColorStop(0, "rgba(200,255,33,.72)"); glow.addColorStop(1, "rgba(200,255,33,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,.82)"); shade.addColorStop(.42, "rgba(0,0,0,.36)"); shade.addColorStop(1, "rgba(0,0,0,.94)");
  g.fillStyle = shade; g.fillRect(0, 0, W, H);

  const sans = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif';
  const label = (text, y) => { g.fillStyle = "rgba(255,255,255,.68)"; g.font = `650 30px ${sans}`; g.fillText(String(text).toUpperCase(), pad, y); };
  const value = (text, y, size = 56, color = "#fff") => { g.fillStyle = color; g.font = `850 ${size}px ${sans}`; g.fillText(String(text), pad, y); };
  g.textAlign = "left"; g.textBaseline = "alphabetic";

  g.font = `900 54px ${sans}`; g.fillStyle = "#fff"; g.fillText("REP", pad, 116);
  const repWidth = g.measureText("REP").width; g.fillStyle = "#c8ff21"; g.fillText("ACT", pad + repWidth, 116);
  g.fillStyle = "#45d483"; g.font = `750 30px ${sans}`; g.fillText(t("Challenge complete!").toUpperCase(), pad, 184);

  g.font = `850 66px ${sans}`;
  const titleLines = wrapLines(g, data.title, W - pad * 2, 2);
  titleLines.forEach((line, index) => value(line, 290 + index * 76, 66));
  const heroY = 290 + titleLines.length * 76 + 58;
  label(t("Total reps"), heroY);
  value(fmt(data.totalReps), heroY + 160, 172);

  let y = heroY + 250;
  if (data.exerciseSummary) {
    label(t("Exercises"), y);
    g.font = `800 44px ${sans}`;
    const exerciseLines = wrapLines(g, data.exerciseSummary, W - pad * 2, 3);
    exerciseLines.forEach((line, index) => value(line, y + 62 + index * 54, 44));
    y += 86 + exerciseLines.length * 54;
  }

  g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 2; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke();
  y += 72;
  const metrics = [[t("Duration"), t("%lld days", data.duration)], [t("Weight"), data.weight], [t("Max reps"), data.maxReps]];
  metrics.forEach(([name, metric]) => {
    g.textAlign = "left"; g.fillStyle = "rgba(255,255,255,.64)"; g.font = `650 27px ${sans}`; g.fillText(String(name).toUpperCase(), pad, y);
    g.textAlign = "right"; g.fillStyle = "#fff"; g.font = `800 42px ${sans}`; g.fillText(String(metric), W - pad, y + 6);
    y += 94;
  });
  g.textAlign = "left";

  if (before) {
    const pw = 250, ph = 320, px = W - pad - pw, py = H - 610;
    g.save(); roundRectPath(g, px, py, pw, ph, 28); g.clip();
    const scale = Math.max(pw / before.width, ph / before.height), dw = before.width * scale, dh = before.height * scale;
    g.drawImage(before, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh); g.restore();
    g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(px + 16, py + ph - 54, 118, 38);
    g.fillStyle = "#fff"; g.font = `750 22px ${sans}`; g.fillText(t("Before").toUpperCase(), px + 28, py + ph - 27);
  }

  const rewardY = H - 390;
  label(t("You take home"), rewardY);
  value(COIN_SYM + fmt(data.payout), rewardY + 102, 92, "#45d483");
  g.fillStyle = "rgba(255,255,255,.72)"; g.font = `750 30px ${sans}`; g.fillText("DON’T JUST SAY IT.", pad, H - 174);
  g.fillStyle = "#c8ff21"; g.font = `900 42px ${sans}`; g.fillText("PROVE IT.", pad, H - 120);

  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", .92));
  const file = new File([blob], "repact-challenge.jpg", { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Repact" }); return true; }
    catch (err) { return !(err && err.name === "AbortError"); }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "repact-challenge.jpg"; a.click();
  return true;
}

async function shareDayStory(c, options) {
  const photo = options && options.photo;
  const W = 1080, H = 1920, pad = 92;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const [bg, brandLogo] = await Promise.all([
    loadImg(photo),
    loadImg("icons/icon-1024.png"),
  ]);
  if (bg) {
    const scale = Math.max(W / bg.width, H / bg.height) * (options.photoZoom || 1);
    const drawW = bg.width * scale, drawH = bg.height * scale;
    const x = (W - drawW) / 2 + ((options.photoX || 0) / 100) * W * .42;
    const y = (H - drawH) / 2 + ((options.photoY || 0) / 100) * H * .42;
    g.drawImage(bg, x, y, drawW, drawH);
  } else {
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#080808"); base.addColorStop(.52, "#111a14"); base.addColorStop(1, "#07110b");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    let glow = g.createRadialGradient(W * .9, H * .18, 0, W * .9, H * .18, 760);
    glow.addColorStop(0, "rgba(200,255,33,.72)"); glow.addColorStop(1, "rgba(200,255,33,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    glow = g.createRadialGradient(W * .08, H * .84, 0, W * .08, H * .84, 620);
    glow.addColorStop(0, "rgba(69,212,131,.34)"); glow.addColorStop(1, "rgba(69,212,131,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  }
  const dim = Math.max(.1, Math.min(.85, ((options && options.dim) || 45) / 100));
  if (options.template === "challenge") {
    // Точное зеркало .template-challenge .share-story-shade:
    // плотная диагональная маска + усиление только внизу под CTA и брендом.
    const diagonal = g.createLinearGradient(-280, 486, 1360, 1434);
    diagonal.addColorStop(0, "rgba(0,0,0,.94)");
    diagonal.addColorStop(.47, "rgba(0,0,0,.74)");
    diagonal.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = diagonal; g.fillRect(0, 0, W, H);
    const footerShade = g.createLinearGradient(0, 0, 0, H);
    footerShade.addColorStop(0, "rgba(0,0,0,0)");
    footerShade.addColorStop(.55, "rgba(0,0,0,0)");
    footerShade.addColorStop(1, "rgba(0,0,0,.9)");
    g.fillStyle = footerShade; g.fillRect(0, 0, W, H);
  } else {
    // Minimal: мягкий shade — фото остаётся видимым, центр почти прозрачный.
    // Формулы = .template-minimal .share-story-shade в styles.css.
    const v = g.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, `rgba(0,0,0,${Math.min(.65, dim + .1)})`);
    v.addColorStop(.34, `rgba(0,0,0,${dim * .15})`);
    v.addColorStop(.58, `rgba(0,0,0,${dim * .15})`);
    v.addColorStop(1, `rgba(0,0,0,${Math.min(.82, dim * .75 + .35)})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const hz = g.createLinearGradient(0, 0, W * .55, 0);
    hz.addColorStop(0, `rgba(0,0,0,${dim * .55})`); hz.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = hz; g.fillRect(0, 0, W, H);
  }

  const label = (text, y) => { g.fillStyle = "rgba(255,255,255,.82)"; g.font = "500 31px -apple-system,system-ui,sans-serif"; g.fillText(text, pad, y); };
  const value = (text, y, size = 66) => { g.fillStyle = "#fff"; g.font = `800 ${size}px -apple-system,system-ui,sans-serif`; g.fillText(text, pad, y); };
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  const exercises = c.goals.map((goal) => `${C.myToday(c, goal.exercise)} ${Exercise.displayName(goal.exercise).toLowerCase()}`).join(" · ");
  const workout = workoutSummary(c);
  if (options.template === "challenge") {
    // Challenge: координаты и размеры равны CSS-превью (1cqw = 10.8px).
    const lime = "#c8ff21", ink = "#fff", sub = "rgba(255,255,255,.7)";
    const padX = 80, slogan = shareSloganCopy();
    const sans = (w, s) => `${w} ${s}px -apple-system,system-ui,sans-serif`;
    g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 16; g.shadowOffsetY = 2;
    g.fillStyle = lime; g.fillRect(0, 0, 24, H);

    g.fillStyle = lime; g.font = sans(850, 29);
    try { g.letterSpacing = "5px"; } catch {}
    g.fillText(`${t("AI verified").toUpperCase()} · ${t("Day").toUpperCase()} ${c.currentDay}`, padX, 122);
    try { g.letterSpacing = "0px"; } catch {}

    g.fillStyle = ink; g.font = sans(950, 86); g.fillText(t("I did mine").toUpperCase(), padX, 250);
    const total = String(C.myTodayTotal(c));
    const totalSize = total.length >= 4 ? 410 : 497;
    g.font = sans(950, totalSize);
    try { g.letterSpacing = "-" + Math.round(totalSize * .05) + "px"; } catch {}
    g.fillText(total, padX, 690);
    try { g.letterSpacing = "0px"; } catch {}

    g.fillStyle = sub; g.font = sans(850, 32);
    try { g.letterSpacing = "7px"; } catch {}
    g.fillText(t("reps").toUpperCase(), padX, 780);
    try { g.letterSpacing = "0px"; } catch {}

    g.fillStyle = ink; g.font = sans(850, 52);
    const lines = wrapLines(g, exercises.toUpperCase(), W - padX * 2, 2);
    lines.forEach((line, i) => g.fillText(line, padX, 900 + i * 56));
    let rewardY = 900 + (lines.length - 1) * 56;
    if (workout.sets) {
      rewardY += 132;
      g.fillStyle = ink; g.font = sans(900, 76); g.fillText(workout.time, padX, rewardY);
      g.fillStyle = sub; g.font = sans(750, 31);
      g.fillText(`${workout.sets} ${t("Sets").toLowerCase()} · ${t("avg %lld", workout.average)}`, padX + 270, rewardY);
      if (workout.improvementMs) {
        rewardY += 54;
        g.fillStyle = lime; g.font = sans(800, 29);
        g.fillText(t("%lld sec faster", Math.round(workout.improvementMs / 1000)).toUpperCase(), padX, rewardY);
      }
    }

    const rewardTop = rewardY + 58, rewardW = 680, rewardH = 94;
    g.save(); g.shadowColor = "rgba(0,0,0,.75)"; g.shadowBlur = 12;
    roundRectPath(g, padX, rewardTop, rewardW, rewardH, 28);
    g.fillStyle = "rgba(0,0,0,.48)"; g.fill();
    g.strokeStyle = "rgba(200,255,33,.62)"; g.lineWidth = 2; g.stroke();
    g.restore();
    g.fillStyle = sub; g.font = sans(700, 27);
    g.fillText(t("Potential reward").toUpperCase(), padX + 32, rewardTop + 58);
    g.fillStyle = "#45d483"; g.font = sans(900, 54);
    g.fillText(COIN_SYM + fmt(C.payout(c)), padX + 466, rewardTop + 65);

    const ctaTop = H - 510;
    g.fillStyle = "rgba(200,255,33,.72)"; g.fillRect(padX, ctaTop, W - padX * 2, 2); g.fillRect(padX, ctaTop + 210, W - padX * 2, 2);
    g.fillStyle = sub; g.font = sans(750, 32);
    try { g.letterSpacing = "3px"; } catch {}
    g.fillText(slogan.lead, padX, ctaTop + 62);
    try { g.letterSpacing = "0px"; } catch {}
    g.fillStyle = lime; g.font = sans(950, store.lang === "ua" ? 91 : 108);
    g.fillText(slogan.proof, padX, ctaTop + 168);

    const footerY = H - 88, logoSize = 58;
    if (brandLogo) {
      g.save(); roundRectPath(g, padX, footerY - 51, logoSize, logoSize, 13); g.clip();
      g.drawImage(brandLogo, padX, footerY - 51, logoSize, logoSize); g.restore();
    }
    const wordX = brandLogo ? padX + logoSize + 14 : padX;
    g.fillStyle = ink; g.font = sans(950, 58); g.fillText("REP", wordX, footerY);
    const repW = g.measureText("REP").width; g.fillStyle = lime; g.fillText("ACT", wordX + repW, footerY);
    g.textAlign = "right"; g.fillStyle = "rgba(255,255,255,.65)"; g.font = sans(700, 32);
    g.fillText(`${t("Day").toUpperCase()} ${c.currentDay} / ${c.durationDays}`, W - padX, footerY); g.textAlign = "left";
    g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
  } else {
    // Minimal (Strava-style) — зеркало HTML-превью: sans без плашек, лайм-акцент.
    const ink = "#F4F2EC", sub = "rgba(244,242,236,.72)", lime = "#B8FF3D";
    const slogan = shareSloganCopy();
    const padX = 80, padTop = 120, padBottom = 90;
    const sans = (w, s) => `${w} ${s}px -apple-system,system-ui,sans-serif`;
    g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = 18; g.shadowOffsetY = 2;

    // AI VERIFIED со звёздочкой
    let y = padTop + 30;
    g.fillStyle = lime; g.font = sans(600, 34); g.fillText("✦", padX, y + 2);
    g.fillStyle = sub; g.font = sans(650, 30);
    try { g.letterSpacing = "5px"; } catch {}
    g.fillText(t("AI verified").toUpperCase(), padX + 46, y);
    try { g.letterSpacing = "0px"; } catch {}

    // Главный результат — крупный hero-номер (Strava-style), размер синхронен
    // с shareHeroCqw()/.share-hero-value в превью (px на канвасе = cqw × W/100).
    const heroPx = Math.round(shareHeroCqw(C.myTodayTotal(c)) * W / 100);
    y += Math.round(246 * heroPx / 230); // базлайн числа: масштабируем от базового 230px
    g.fillStyle = ink; g.font = sans(600, heroPx);
    try { g.letterSpacing = "-" + Math.round(heroPx * 0.028) + "px"; } catch {}
    g.fillText(String(C.myTodayTotal(c)), padX - 6, y);
    try { g.letterSpacing = "0px"; } catch {}
    y += Math.round(62 * heroPx / 230);
    g.fillStyle = sub; g.font = sans(650, 34);
    try { g.letterSpacing = "6px"; } catch {}
    g.fillText(t("Reps").toUpperCase(), padX, y);
    try { g.letterSpacing = "0px"; } catch {}

    // Упражнения (до двух строк)
    y += Math.round(92 * heroPx / 230);
    g.fillStyle = ink; g.font = sans(700, 40);
    const exLines = wrapLines(g, exercises.toUpperCase(), W - padX * 2, 2);
    exLines.forEach((line, i) => g.fillText(line, padX, y + i * 54));
    y += (exLines.length - 1) * 54;

    // Тонкая линия дневной цели связывает результат с челленджем, не превращаясь в карточку.
    y += 62;
    g.save(); g.shadowColor = "transparent";
    g.fillStyle = "rgba(255,255,255,.22)"; roundRectPath(g, padX, y, W - padX * 2, 12, 6); g.fill();
    g.fillStyle = lime; roundRectPath(g, padX, y, (W - padX * 2) * Math.min(1, C.myTodayTotal(c) / Math.max(C.repsNorm(c), 1)), 12, 6); g.fill();
    g.restore();

    // Три метрики: значения сверху, подписи снизу, тонкие разделители
    y += Math.round(108 * heroPx / 230);
    const stats = shareDayStats(c, workout);
    const colW = (W - padX * 2) / 3;
    stats.forEach(([v, l], i) => {
      const x = padX + i * colW;
      g.fillStyle = ink; g.font = sans(650, 58); g.fillText(v, x, y);
      g.fillStyle = sub; g.font = sans(600, 27); g.fillText(l.toUpperCase(), x, y + 44);
    });
    g.save(); g.shadowColor = "transparent";
    g.fillStyle = "rgba(255,255,255,.22)";
    for (let i = 1; i < 3; i++) g.fillRect(padX + i * colW - 34, y - 52, 2, 102);
    g.restore();

    // Улучшение против прошлого раза
    if (workout.improvementMs > 0) {
      y += Math.round(118 * heroPx / 230);
      g.fillStyle = lime; g.font = sans(700, 31);
      g.fillText(`${shareDuration(workout.improvementMs)} ${t("faster than last time")}`.toUpperCase(), padX, y);
    }

    // Низ: слоган, затем слева REPACT и справа день челленджа
    const fy = H - padBottom;
    g.fillStyle = sub; g.font = sans(700, 28);
    try { g.letterSpacing = "2px"; } catch {}
    g.fillText(slogan.lead, padX, fy - 92);
    g.fillStyle = lime; g.font = sans(850, 32); g.fillText(slogan.proof, padX, fy - 50);
    try { g.letterSpacing = "0px"; } catch {}
    const logoSize = 52;
    if (brandLogo) {
      g.save(); roundRectPath(g, padX, fy - 47, logoSize, logoSize, 12); g.clip();
      g.drawImage(brandLogo, padX, fy - 47, logoSize, logoSize); g.restore();
    }
    const wordX = brandLogo ? padX + logoSize + 13 : padX;
    g.fillStyle = ink; g.font = sans(900, 56); g.fillText("REP", wordX, fy);
    const repW = g.measureText("REP").width;
    g.fillStyle = lime; g.fillText("ACT", wordX + repW, fy);
    g.textAlign = "right";
    g.fillStyle = sub; g.font = sans(600, 34);
    g.fillText(`${t("Day").toUpperCase()} ${c.currentDay} / ${c.durationDays}`, W - padX, fy);
    g.textAlign = "left";
    g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
  }

  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", .92));
  const file = new File([blob], "repact-story.jpg", { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Repact" }); return true; }
    catch (err) { return !(err && err.name === "AbortError"); }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "repact-story.jpg"; a.click();
  return true;
}

// SVG-иконку → data-URI, чтобы нарисовать её на canvas через drawImage с нужным цветом.
function posterIconURI(markup, { stroke = "#c8ff21", fill = "none", sw = 2 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function hexPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 90); const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}

// Промо-карточка челленджа для шеринга (сторис-формат, тёмный full-bleed постер под инсту).
async function shareChallengePoster(data) {
  const ru = store.lang === "ru";
  const ua = store.lang === "ua";
  const LIME = "#c8ff21";
  const single = data.exercises.length === 1;
  const ex0 = data.exercises[0];
  const L = ru ? {
    badge: `ЧЕЛЛЕНДЖ · ${data.duration} ДН.`, aDay: "В ДЕНЬ",
    combo: "КОМБО", exCount: `${data.exercises.length} УПРАЖНЕНИЯ`,
    stakeT: "СТАВКА", stakeS: "Деньги на кону.",
    missT: "ПРОПУСКИ", missS: "Держи ритм каждый день.",
    camT: "КАМЕРА СЧИТАЕТ", camS: "Каждый повтор проверяется.",
    keep: "СЛАБО ПОВТОРИТЬ?", cta: "ПРИНЯТЬ ВЫЗОВ",
    fOpen: "Открой ", fEnd: " и прими вызов.",
    micro: "СОРЕВНУЙСЯ · НЕ СЛИВАЙСЯ · ПОБЕЖДАЙ",
    sub: single ? `Мой челлендж: ${ex0.reps} ${ex0.name.toLowerCase()} каждый день, ${data.duration} дн.` : `Мой челлендж: это комбо каждый день, ${data.duration} дн.`,
  } : ua ? {
    badge: `ЧЕЛЕНДЖ · ${data.duration} ДН.`, aDay: "НА ДЕНЬ",
    combo: "КОМБО", exCount: `${data.exercises.length} ВПРАВИ`,
    stakeT: "СТАВКА", stakeS: "Монети на кону.",
    missT: "ДОЗВОЛЕНІ ПРОПУСКИ", missS: "Тримай ритм щодня.",
    camT: "ПЕРЕВІРЕНО КАМЕРОЮ", camS: "Кожен повтор перевіряється.",
    keep: "ЗМОЖЕШ ПОВТОРИТИ?", cta: "ПРИЙНЯТИ ВИКЛИК",
    fOpen: "Відкрий ", fEnd: " і прийми виклик.",
    micro: "ЗМАГАЙСЯ · НЕ ЗДАВАЙСЯ · ПЕРЕМАГАЙ",
    sub: single ? `Мій челендж: ${ex0.reps} ${ex0.name.toLowerCase()} щодня, ${data.duration} дн.` : `Мій челендж: це комбо щодня, ${data.duration} дн.`,
  } : {
    badge: `${data.duration}-DAY CHALLENGE`, aDay: "A DAY",
    combo: "COMBO", exCount: `${data.exercises.length} EXERCISES`,
    stakeT: "STAKE", stakeS: "Money on the line.",
    missT: "MISSES ALLOWED", missS: "Stay consistent.",
    camT: "CAMERA VERIFIED", camS: "Every rep is checked.",
    keep: "THINK YOU CAN KEEP UP?", cta: "JOIN MY CHALLENGE",
    fOpen: "Open ", fEnd: " and accept the challenge.",
    micro: "COMPETE · STAY ACCOUNTABLE · WIN",
    sub: single ? `Join me: ${ex0.reps} ${ex0.name.toLowerCase()} every day for ${data.duration} days.` : `Join me: this combo every day for ${data.duration} days.`,
  };

  // Иконки грузим один раз как картинки нужного цвета.
  const icons = {
    flame: posterIconURI(PATHS.flame, { fill: LIME, stroke: "none" }),
    bolt: posterIconURI(PATHS.bolt, { fill: LIME, stroke: "none" }),
    dollar: posterIconURI('<line x1="12" y1="2.5" x2="12" y2="21.5"/><path d="M16.5 6.5H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H6.5"/>', { stroke: LIME }),
    calendar: posterIconURI(PATHS.calendar, { stroke: LIME }),
    shield: posterIconURI('<path d="M12 3l7 3v5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>', { stroke: LIME }),
    phone: posterIconURI('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', { stroke: "rgba(255,255,255,.6)" }),
  };
  data.exercises.forEach((e) => { icons["ex_" + e.ex] = posterIconURI(PATHS[EXERCISE_ICON[e.ex]] || PATHS.flame, { stroke: LIME }); });
  const loaded = {};
  await Promise.all(Object.entries(icons).map(([k, uri]) => loadImg(uri).then((im) => { loaded[k] = im; })));

  const scale = 3, W = 540, pad = 34, cx = W / 2, Wu = W - pad * 2;
  const cv = document.createElement("canvas");
  const g = cv.getContext("2d");
  const drawIcon = (k, ix, iy, s) => { const im = loaded[k]; if (im) g.drawImage(im, ix - s / 2, iy - s / 2, s, s); };
  const setLS = (v) => { if ("letterSpacing" in g) g.letterSpacing = v; };
  const fitSize = (txt, start, weight, maxW, ls) => {
    let s = start;
    for (; s > 18; s -= 2) { g.font = `${weight} ${s}px -apple-system,system-ui,sans-serif`; setLS(ls || "0px"); if (g.measureText(txt).width <= maxW) break; }
    setLS("0px"); return s;
  };
  // Центрированная строка: визуальный верх ~ yTop, продвигаем на lh.
  const ctext = (txt, yTop, size, weight, color, ls, lh) => {
    g.font = `${weight} ${size}px -apple-system,system-ui,sans-serif`;
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "alphabetic"; setLS(ls || "0px");
    g.fillText(txt, cx, yTop + size * 0.8); setLS("0px");
    return yTop + (lh || size);
  };

  // --- замеры до установки размеров холста ---
  const nameUpper = single ? ex0.name.toUpperCase() : "";
  const nameSize = single ? fitSize(nameUpper, 58, 900, Wu, "1px") : 0;
  const nameLh = Math.round(nameSize * 1.06);
  g.font = "500 17px -apple-system,system-ui,sans-serif"; setLS("0px");
  const subLines = wrapLines(g, L.sub, Wu, 3);

  const cards = [];
  if (!single) data.exercises.forEach((e) => cards.push({ icon: "ex_" + e.ex, title: e.name.toUpperCase(), sub: ru ? `${e.reps} / день` : `${e.reps} / day` }));
  cards.push({ icon: "dollar", title: `${L.stakeT}: ${data.stake}`, sub: L.stakeS });
  cards.push({ icon: "calendar", title: `${L.missT}: ${data.miss}`, sub: L.missS });
  cards.push({ icon: "shield", title: L.camT, sub: L.camS });

  const LOGO_H = 28, GAP1 = 20, BADGE_H = 32, GAP2 = 32, GAP_HERO = 24;
  const SUB_LH = 25, GAP3 = 30, CARD_H = 74, CARD_GAP = 12, GAP4 = 28;
  const TAG_H = 22, GAP5 = 20, CTA_H = 60, GAP6 = 22, FOOT_H = 20, GAP7 = 14, MICRO_H = 16;
  const heroH = single ? 128 + nameLh + 50 : 74 + 40;
  const subH = subLines.length * SUB_LH;
  const cardsH = cards.length * CARD_H + (cards.length - 1) * CARD_GAP;
  const contentH = LOGO_H + GAP1 + BADGE_H + GAP2 + heroH + GAP_HERO + subH + GAP3
    + cardsH + GAP4 + TAG_H + GAP5 + CTA_H + GAP6 + FOOT_H + GAP7 + MICRO_H;
  const H = Math.max(Math.ceil(contentH) + 72, 960);
  cv.width = W * scale; cv.height = H * scale; g.scale(scale, scale);

  // --- фон: тёплый near-black + свечения + искры ---
  g.fillStyle = "#0a0806"; g.fillRect(0, 0, W, H);
  let rg = g.createRadialGradient(W / 2, H * 0.9, 30, W / 2, H * 0.9, H * 0.62);
  rg.addColorStop(0, "rgba(200,255,33,.20)"); rg.addColorStop(1, "rgba(200,255,33,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  rg = g.createRadialGradient(W * 0.85, H * 0.1, 20, W * 0.85, H * 0.1, 280);
  rg.addColorStop(0, "rgba(255,120,40,.12)"); rg.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * W, yy = Math.random() * H, r = Math.random() * 1.5 + 0.4;
    g.fillStyle = `rgba(255,${(140 + Math.random() * 70) | 0},60,${(Math.random() * 0.5 + 0.1).toFixed(2)})`;
    g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(200,255,33,.09)"; g.lineWidth = 3; g.lineCap = "round";
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const bx = cx + side * (Wu / 2 + 16 + k * 12), by = H * 0.45;
    g.beginPath(); g.moveTo(bx - side * 6, by - 9); g.lineTo(bx, by); g.lineTo(bx - side * 6, by + 9); g.stroke();
  }

  let y = (H - contentH) / 2;

  // Логотип
  setLS("3px"); g.font = "800 20px -apple-system,system-ui,sans-serif";
  const brand = "REPACT", bw = g.measureText(brand).width, fl = 22, gapL = 9, lw = fl + gapL + bw, lsx = cx - lw / 2;
  drawIcon("flame", lsx + fl / 2, y + 11, fl);
  g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(brand, lsx + fl + gapL, y + 12);
  setLS("0px"); y += LOGO_H + GAP1;

  // Бейдж
  setLS("2px"); g.font = "700 12px -apple-system,system-ui,sans-serif";
  const btw = g.measureText(L.badge).width, bpad = 18, bwd = btw + bpad * 2, bh = 32, bx0 = cx - bwd / 2;
  roundRectPath(g, bx0, y, bwd, bh, 16); g.fillStyle = "rgba(200,255,33,.10)"; g.fill();
  roundRectPath(g, bx0, y, bwd, bh, 16); g.strokeStyle = "rgba(200,255,33,.6)"; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = LIME; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L.badge, cx, y + bh / 2 + 1);
  setLS("0px"); y += BADGE_H + GAP2;

  // Герой
  if (single) {
    g.save(); g.shadowColor = "rgba(255,255,255,.18)"; g.shadowBlur = 22;
    y = ctext(String(ex0.reps), y, 150, 900, "#fff", "0px", 128);
    g.restore();
    y = ctext(nameUpper, y, nameSize, 900, "#fff", "1px", nameLh);
    y = ctext(L.aDay, y, 40, 900, LIME, "4px", 50);
  } else {
    y = ctext(L.combo, y, 76, 900, "#fff", "3px", 74);
    y = ctext(L.exCount, y, 28, 800, LIME, "2px", 40);
  }
  y += GAP_HERO;

  // Подзаголовок
  for (const line of subLines) y = ctext(line, y, 17, 500, "rgba(255,255,255,.72)", "0px", SUB_LH);
  y += GAP3;

  // Карточки-условия
  cards.forEach((c, i) => {
    roundRectPath(g, pad, y, Wu, CARD_H, 16); g.fillStyle = "rgba(255,255,255,.045)"; g.fill();
    roundRectPath(g, pad, y, Wu, CARD_H, 16); g.strokeStyle = "rgba(255,255,255,.09)"; g.lineWidth = 1; g.stroke();
    const midY = y + CARD_H / 2, hcx = pad + 44;
    hexPath(g, hcx, midY, 23); g.fillStyle = "rgba(200,255,33,.12)"; g.fill();
    hexPath(g, hcx, midY, 23); g.strokeStyle = "rgba(200,255,33,.55)"; g.lineWidth = 1.6; g.stroke();
    drawIcon(c.icon, hcx, midY, 24);
    g.strokeStyle = "rgba(255,255,255,.1)"; g.lineWidth = 1; g.beginPath(); g.moveTo(pad + 82, y + 16); g.lineTo(pad + 82, y + CARD_H - 16); g.stroke();
    const tx = pad + 98, ts = fitSize(c.title, 18, 800, Wu - 98 - 18, "0px");
    g.fillStyle = "#fff"; g.font = `800 ${ts}px -apple-system,system-ui,sans-serif`; g.textAlign = "left"; g.textBaseline = "alphabetic"; setLS("0px");
    g.fillText(c.title, tx, midY - 4);
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = "500 12px -apple-system,system-ui,sans-serif";
    g.fillText(c.sub, tx, midY + 16);
    y += CARD_H + (i < cards.length - 1 ? CARD_GAP : 0);
  });
  y += GAP4;

  // Слоган с молниями
  g.font = "800 15px -apple-system,system-ui,sans-serif"; setLS("1px");
  const ttw = g.measureText(L.keep).width, bsz = 16, tg = 10, tgW = bsz + tg + ttw + tg + bsz, tgx = cx - tgW / 2;
  drawIcon("bolt", tgx + bsz / 2, y + 9, bsz);
  g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(L.keep, tgx + bsz + tg, y + 10);
  drawIcon("bolt", tgx + bsz + tg + ttw + tg + bsz / 2, y + 9, bsz);
  setLS("0px"); y += TAG_H + GAP5;

  // CTA
  g.save(); g.shadowColor = "rgba(200,255,33,.5)"; g.shadowBlur = 28; g.shadowOffsetY = 6;
  roundRectPath(g, pad, y, Wu, CTA_H, 16);
  const lg = g.createLinearGradient(0, y, 0, y + CTA_H); lg.addColorStop(0, "#e8ff75"); lg.addColorStop(1, LIME);
  g.fillStyle = lg; g.fill(); g.restore();
  g.font = "900 20px -apple-system,system-ui,sans-serif"; setLS("1px");
  const cw = g.measureText(L.cta).width, asz = 20, ag = 12, cgW = cw + ag + asz, cgx = cx - cgW / 2, cmy = y + CTA_H / 2;
  g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(L.cta, cgx, cmy + 1);
  setLS("0px");
  const ax = cgx + cw + ag + asz / 2;
  g.strokeStyle = "#fff"; g.lineWidth = 2.6; g.lineJoin = "round";
  g.beginPath(); g.moveTo(ax - 9, cmy); g.lineTo(ax + 9, cmy); g.moveTo(ax + 2, cmy - 7); g.lineTo(ax + 9, cmy); g.lineTo(ax + 2, cmy + 7); g.stroke();
  y += CTA_H + GAP6;

  // Футер
  g.font = "600 13px -apple-system,system-ui,sans-serif"; setLS("0px");
  const w1 = g.measureText(L.fOpen).width, w2 = g.measureText("Repact").width, w3 = g.measureText(L.fEnd).width;
  const pIc = 14, pg = 8, fgW = pIc + pg + w1 + w2 + w3, fx = cx - fgW / 2;
  drawIcon("phone", fx + pIc / 2, y + 8, pIc);
  g.textAlign = "left"; g.textBaseline = "middle";
  g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(L.fOpen, fx + pIc + pg, y + 9);
  g.fillStyle = LIME; g.fillText("Repact", fx + pIc + pg + w1, y + 9);
  g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(L.fEnd, fx + pIc + pg + w1 + w2, y + 9);
  y += FOOT_H + GAP7;

  // Микро-футер
  ctext(L.micro, y, 11, 700, "rgba(255,255,255,.3)", "2px", MICRO_H);

  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  const file = new File([blob], "repact-challenge.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Repact" }); return; } catch {}
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "repact-challenge.png"; a.click();
}

// ==========================================================================
// Открытие/закрытие модалок и поздравлений
// ==========================================================================
function newCreateForm(over) {
  return Object.assign({ step: 0, type: "streak", access: "private", minPlayers: 5,
    title: "", sel_pushups: true, sel_squats: false, sel_pullups: false, sel_dips: false,
    pushups: store.dailyGoal || 50, squats: store.dailyGoal || 50, pullups: 20, dips: 30,
    duration: 30, buyIn: 0, isPublic: !isGuest(), miss: "oneTotal", progOn: false, progStep: 5, progPeriod: "day" }, over || {});
}
// Быстрые шаблоны перед мастером — сокращают путь создания. over — предзаполнение формы.
const CREATE_TEMPLATES = [
  { id: "quick7", exercise: "pushups", step: 5, titleKey: "7-day Push-up Challenge", subKey: "7 days · 20 push-ups a day", over: { sel_pushups: true, pushups: 20, duration: 7 } },
  { id: "pushup30", exercise: "pushups", step: 50, titleKey: "30-day Push-up Challenge", subKey: "50 push-ups a day for a month", over: { sel_pushups: true, pushups: 50, duration: 30 } },
  { id: "squats100", exercise: "squats", step: 50, titleKey: "100 Squats Daily", subKey: "30 days · 100 a day", over: { sel_squats: true, squats: 100, duration: 30 } },
  { id: "pullupProg", exercise: "pullups", step: 5, titleKey: "Pull-up Progression", subKey: "Grows a bit every week", over: { sel_pullups: true, pullups: 10, duration: 30, progOn: true, progStep: 5, progPeriod: "week" } },
  { id: "dips20", exercise: "dips", step: 5, titleKey: "20 Dips Daily", subKey: "30 days · 20 a day", over: { sel_dips: true, dips: 20, duration: 30 } },
];
function TemplatesSheet() {
  const row = (id, title, sub) => `<button class="card" data-act="useTemplate:${id}" style="padding:16px 18px;width:100%;display:flex;align-items:center;gap:12px;text-align:left">
    <div style="flex:1"><div style="font-weight:700;font-size:16px">${esc(title)}</div><div class="form-footer" style="margin-top:2px">${esc(sub)}</div></div>
    <span class="secondary" style="display:flex">${icon("chevronRight")}</span></button>`;
  const rows = CREATE_TEMPLATES.map((x) => row(x.id, t(x.titleKey), t(x.subKey))).join("");
  const scratch = `<button class="action-btn" data-act="useTemplate:scratch" style="background:var(--white-08);color:#fff">${t("Create from scratch")}</button>`;
  return sheetShell(t("New challenge"), `<div class="stack">${rows}${scratch}</div>`, true);
}
function PresetQuickSetup() {
  const f = ui.form, ex = f.presetExercise;
  const min = f.presetStep, max = ex === "pushups" || ex === "squats" ? 500 : 100;
  const progression = ex === "pullups" ? `<div class="card card-soft preset-option">
    <div><div class="preset-option-title">${t("Progressive overload")}</div><div class="form-footer">+${f.progStep} ${t("per week")}</div></div>
    <button data-act="toggle" data-key="progOn" role="switch" aria-checked="${f.progOn}" class="toggle ${f.progOn ? "on" : ""}"></button>
  </div>` : "";
  return `<div class="fullscreen"><div class="preset-setup">
    <div class="navbar"><button class="icon-btn" data-act="closeFull" aria-label="${t("Close")}">${icon("xmark")}</button><div class="title">${t("Customize preset")}</div><div style="width:40px"></div></div>
    <div class="preset-body">
      <div class="preset-exercise-icon">${exIcon(ex)}</div>
      <div class="display preset-exercise-name">${esc(Exercise.displayName(ex))}</div>
      <div class="card preset-goal-card">
        ${lbl(t("Daily goal"), "tracking-1")}
        <div class="preset-stepper">
          <button data-act="dec" data-key="${ex}" data-min="${min}" data-max="${max}" data-by="${f.presetStep}" aria-label="−${f.presetStep}">−</button>
          <span class="money">${f[ex]}</span>
          <button data-act="inc" data-key="${ex}" data-min="${min}" data-max="${max}" data-by="${f.presetStep}" aria-label="+${f.presetStep}">+</button>
        </div>
        <div class="form-footer">${esc(Exercise.displayName(ex))} · ${t("per day")}</div>
      </div>
      <div class="form-section">
        <div class="form-label">${t("Duration")}</div>
        <div class="segmented preset-duration">
          <button data-act="presetDuration:30" class="${f.duration === 30 ? "active" : ""}">${t("1 month")}</button>
          <button data-act="presetDuration:60" class="${f.duration === 60 ? "active" : ""}">${t("2 months")}</button>
        </div>
      </div>
      ${progression}
      <div class="form-footer preset-local-note">${isGuest() ? t("Private on this device") : t("Public challenge")}</div>
      <div class="spacer"></div>
      <button class="action-btn" data-act="savePreset" style="background:var(--money)">${t("Create challenge")}</button>
    </div>
  </div></div>`;
}
function openCreate() { ui.form = newCreateForm(); ui.full = CreateScreen; render(); window.scrollTo(0, 0); }
function openJoin(id) { ui.form = { challengeId: id, weight: store["profile.weightKg"], maxReps: store["profile.maxReps"], photo: null }; ui.sheet = JoinSheet; render(); }
function openMeasure() { ui.form = { weight: store["profile.weightKg"], maxReps: store["profile.maxReps"] }; ui.sheet = MeasureSheet; render(); }
function openStartPicker(id) { ui.form = { challengeId: id }; ui.sheet = StartPicker; render(); }
function openLeave(id) { ui.form = { challengeId: id }; ui.sheet = LeaveSheet; render(); }
function openParticipant(id) {
  const challengeId = ui.detailId || (userChallenges(id)[0] && userChallenges(id)[0].id) || null;
  ui.form = { participantId: id, challengeId };
  ui.sheet = ParticipantSheet;
  render();
}
// Закрытие — через View Transitions: браузер плавно уводит лист/фон, атомарно, без «застрявшего» DOM.
function closeSheet() { ui.sheet = null; ui.form = null; navRender(); }
function openDayComplete(c) { ui.fullId = c.id; ui.full = DayCompleteFull; render(); }
function openWorkoutResult(c, counts, stats, dayClosed) {
  ui.fullId = c.id;
  ui.workoutResult = { challengeId: c.id, counts: Object.assign({}, counts), stats: Object.assign({}, stats, { setReps: stats.setReps.slice() }), dayClosed: !!dayClosed };
  ui.full = WorkoutResultFull;
  render();
}
function openShareDay(c) {
  const shareReturn = ui.full === WorkoutResultFull ? "workoutResult" : ui.full === DayCompleteFull ? "dayComplete" : "close";
  ui.form = { challengeId: c.id, background: "gradient", photo: null, template: "minimal", photoZoom: 1, photoX: 0, photoY: 0, dim: 45, shareReturn };
  ui.full = ShareDayEditorFull;
  render();
}
function openChallengeComplete(c) { ui.form = { challengeId: c.id, weight: store["profile.weightKg"], maxReps: store["profile.maxReps"], photo: null }; ui.full = ChallengeCompleteFull; ui.resetFullScroll = true; render(); }
function closeFull() { ui.full = null; ui.form = null; ui.workoutResult = null; navRender(); }

function CameraPrepFull() {
  const rows = [
    ["camera", t("Set your phone down"), t("Keep the camera still so every rep can be verified.")],
    ["person", t("Fit your whole body in frame"), t("Step back until your arms and legs are clearly visible.")],
    ["flame", t("Use good lighting"), t("Face the light and avoid a bright window behind you.")],
  ].map(([ic, title, text]) => `<div class="prep-row"><span class="prep-icon">${icon(ic)}</span><div><div class="prep-title">${esc(title)}</div><div class="form-footer">${esc(text)}</div></div></div>`).join("");
  return `<div class="fullscreen camera-prep"><div class="prep-content">
    <button class="cam-btn prep-close" data-act="closeFull" aria-label="${t("Close")}">${icon("xmark")}</button>
    <div class="prep-hero">${iconF("camera")}</div>
    <div class="display prep-heading">${t("Camera setup")}</div>
    <div class="prep-list">${rows}</div>
    <div class="prep-privacy">${icon("lock")}<span>${t("Your video stays on this device and is not uploaded.")}</span></div>
    <div class="spacer"></div>
    <button class="action-btn" data-act="startPrepared">${iconF("camera")}${t("Open camera")}</button>
    <button class="text-btn" data-act="closeFull">${t("Not now")}</button>
  </div></div>`;
}
function openCameraPrep(challengeId, startExercise) {
  ui.form = { challengeId, startExercise: startExercise || null };
  ui.full = CameraPrepFull;
  render();
  window.scrollTo(0, 0);
}

function pickImage(camera) {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*"; if (camera) i.capture = "user";
    i.onchange = () => { const f = i.files[0]; if (!f) return res(null); const r = new FileReader(); r.onload = () => downscale(r.result).then(res); r.readAsDataURL(f); };
    i.click();
  });
}

function storyCrop(sourceWidth, sourceHeight) {
  const target = 9 / 16, source = sourceWidth / sourceHeight;
  if (source > target) {
    const width = sourceHeight * target;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / target;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

function captureStoryPhoto() {
  return new Promise(async (resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "story-camera";
    overlay.innerHTML = `<video autoplay muted playsinline></video>
      <div class="story-camera-shade"></div>
      <div class="story-camera-top">
        <button class="cam-btn" data-camera="close" aria-label="${t("Close")}">${icon("xmark")}</button>
        <span>9:16 · ${t("Story")}</span>
        <button class="cam-btn" data-camera="flip" aria-label="${t("Switch camera")}">${icon("cameraFlip")}</button>
      </div>
      <div class="story-camera-bottom">
        <span>${t("Fill the frame")}</span>
        <button class="story-shutter" data-camera="capture" aria-label="${t("Take a photo")}"></button>
      </div>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector("video");
    let stream = null, facing = "environment", done = false;
    const stop = () => { if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null; };
    const finish = (value) => { if (done) return; done = true; stop(); overlay.remove(); resolve(value); };
    const open = async () => {
      stop();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        video.srcObject = stream;
        await video.play();
      } catch { finish(null); toast(t("Camera access is needed for the photo.")); }
    };
    overlay.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-camera]");
      if (!button) return;
      if (button.dataset.camera === "close") finish(null);
      else if (button.dataset.camera === "flip") { facing = facing === "environment" ? "user" : "environment"; await open(); }
      else if (button.dataset.camera === "capture" && video.videoWidth) {
        const crop = storyCrop(video.videoWidth, video.videoHeight);
        const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
        const g = canvas.getContext("2d");
        if (facing === "user") { g.translate(1080, 0); g.scale(-1, 1); }
        g.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, 1080, 1920);
        finish(canvas.toDataURL("image/jpeg", .86));
      }
    });
    await open();
  });
}
// Ужимаем фото до 1000px JPEG: снимки с камеры (10+ МБ в base64) тормозят шер-карточку и не влезают в localStorage.
function downscale(dataURL) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height, 1));
      if (k === 1 && dataURL.length < 500000) return res(dataURL);
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      res(cv.toDataURL("image/jpeg", 0.82));
    };
    im.onerror = () => res(dataURL);
    im.src = dataURL;
  });
}

// ==========================================================================
// Обработчики (делегирование)
// ==========================================================================
const RANGES = { "profile.age": [14, 80], "profile.heightCm": [120, 220], "profile.weightKg": [35, 180], "profile.maxReps": [1, 120] };
function storeHook(key) {
  if (key === "profile.maxReps" || key === "profile.level") store.dailyGoal = recommendedDailyReps(store["profile.level"], store["profile.maxReps"]);
}
function parseVal(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : v;
}

// Действия «на месте» (селект/степпер/тогл) — элемент не исчезает, пульс переносится
// патчем render; задержку pressFinish на них не вешаем, чтобы отклик был мгновенным.
const INSTANT_CMDS = new Set(["inc", "dec", "seg", "statEx", "challengeTab", "createChip", "createCustom", "toggle", "toggleStore", "react", "goalChoice", "presetDuration", "bugPick", "shareBg", "setLanguage", "unlockPhotos"]);
root.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const [cmd, arg] = act.split(":");
  sfx(sfxFor(cmd, arg)); // звук нажатия — свой для разных действий
  if (el.classList.contains("action-btn")) haptic(8); // лёгкий тактильный отклик на первичных кнопках
  // Ждём конца сжатия ДО действия только там, где действие снесёт элемент (навигация):
  // у степперов/тоглов/сегментов элемент остаётся, пульс переносится сам — жать мгновенно.
  if (!INSTANT_CMDS.has(cmd)) await pressFinish();

  if (act === "closeSheetBg") { if (e.target.classList.contains("sheet-backdrop")) closeSheet(); return; }

  switch (cmd) {
    case "tab": go(arg); return;
    case "shareDoneHome":
      ui.shareReturnState = null; ui.full = null; ui.form = null; ui.workoutResult = null;
      go("yours"); return;
    case "shareDoneBack": {
      const target = ui.shareReturnState;
      ui.shareReturnState = null;
      if (!target || target.type === "close") { closeFull(); return; }
      if (target.type === "workoutResult") { ui.full = WorkoutResultFull; ui.form = null; render(); return; }
      if (target.type === "dayComplete") { ui.fullId = target.challengeId; ui.full = DayCompleteFull; ui.form = null; render(); return; }
      if (target.type === "challengeComplete") { ui.form = target.form; ui.full = ChallengeCompleteFull; render(); return; }
      closeFull(); return;
    }
    case "open": openDetail(arg); return;
    case "back": back(); return;
    case "play": { const startEx = act.split(":")[2]; if (ui.sheet) { ui.sheet = null; ui.form = null; } openCameraPrep(arg, startEx); return; }
    case "chooseWorkout": ui.sheet = WorkoutPickerSheet; render(); return;
    case "demo": openCameraPrep("demo", "pushups"); return;
    case "demoAgain": ui.full = null; ui.form = null; render(); openCameraPrep("demo", "pushups"); return;
    case "findChallengeDemo": ui.full = null; ui.form = null; go("challenges"); return;
    case "onbFromDemo": ui.full = null; ui.form = null; ui.onbStep = STEP.name; render(); return;
    case "startPrepared": {
      const prep = ui.form;
      ui.full = null; ui.form = null; render();
      openSession(prep.challengeId, prep.startExercise);
      return;
    }
    case "startPick": openStartPicker(arg); return;
    case "findChallenge": go("challenges"); return;
    case "create": openCreate(); return;
    case "challengeTab": ui.challengeTab = arg; render(); return;
    case "openAccountGate": openAuthGate("account"); return;
    case "closeAuthGate": closeAuthGate(); return;
    case "useTemplate": {
      const tpl = CREATE_TEMPLATES.find((x) => x.id === arg);
      if (arg === "scratch") {
        ui.form = newCreateForm({ sel_pushups: true });
        ui.sheet = null; ui.full = CreateWizard;
      } else {
        ui.form = newCreateForm(Object.assign({ presetId: tpl.id, presetExercise: tpl.exercise, presetStep: tpl.step }, tpl.over));
        ui.sheet = null; ui.full = PresetQuickSetup;
      }
      render(); window.scrollTo(0, 0); return;
    }
    case "presetDuration": ui.form.duration = +arg; render(); return;
    case "join": if (isGuest()) openAuthGate("join", arg); else openJoin(arg); return;
    case "addMeasure": openMeasure(); return;
    case "unlockPhotos": photosUnlocked = true; render(); return;
    case "openFriends": ui.sheet = FriendsSheet; render(); return;
    case "openNotifications": localStorage.setItem(ACTIVITY_SEEN_KEY, String(Date.now())); ui.sheet = NotificationsSheet; render(); return;
    case "profileSection": ui.profileSection = arg; navRender(() => window.scrollTo(0, 0)); return;
    case "profileHome": ui.profileSection = null; navRender(() => window.scrollTo(0, 0)); return;
    case "editProfile": profileEditing = true; profileNameDraft = null; render(); return;
    case "saveProfile": {
      const inp = document.getElementById("profile-name");
      const name = (inp ? inp.value : (profileNameDraft || "")).trim();
      if (name) store["profile.name"] = name;
      profileEditing = false; profileNameDraft = null;
      Sync.registerUser(store["profile.name"]);
      render(); return;
    }
    case "invite": if (isGuest() && ui.detailId) openAuthGate("shareCreate"); else shareInvite(); return;
    case "participant": openParticipant(arg); return;
    case "follow": {
      if (isGuest()) { openAuthGate("account"); return; }
      const next = !isFollowing(arg);
      const ok = await Sync.setFollowing(arg, next);
      if (!ok) toast(t("Couldn't update subscription"));
      render(); return;
    }
    case "react": {
      if (isGuest()) { openAuthGate("account"); return; }
      const [, eventId, emoji] = act.split(":");
      const current = Sync.state.reactions && Sync.state.reactions[eventId] && Sync.state.reactions[eventId][Sync.uid];
      const ok = await Sync.setReaction(eventId, emoji, current !== emoji);
      if (!ok) toast(t("Couldn't update subscription"));
      render(); return;
    }
    case "notification": ui.sheet = null; ui.form = null; openDetail(arg); return;
    case "dismissPwa": localStorage.setItem("fs.pwahint", "1"); render(); return;
    case "signOut": Sync.signOutUser().then(() => render()); return;
    case "openLanguage": ui.sheet = LanguageSheet; render(); return;
    case "setLanguage":
      if (["en", "ru", "ua"].includes(arg)) store.lang = arg;
      ui.sheet = null; ui.form = null; render(); return;
    case "closeSheet": closeSheet(); return;
    case "closeFull": closeFull(); return;
    case "closeShareDay": {
      const shareReturn = ui.form && ui.form.shareReturn;
      ui.form = null;
      ui.full = shareReturn === "workoutResult" && ui.workoutResult ? WorkoutResultFull : shareReturn === "dayComplete" ? DayCompleteFull : null;
      render(); return;
    }
    case "showResult": openChallengeComplete(app.challenges.find((c) => c.id === arg)); return;
    case "startToday": case "startSolo": startChallengeNow(arg, startOfDay(Date.now())); return;
    case "startTomorrow": startChallengeNow(arg, startOfDay(Date.now()) + DAY); return;
    case "setReady": markReady(arg); return;
    case "invitePending": shareInvite(arg); return;
    case "askLeave": openLeave(arg); return;
    case "confirmLeave": leaveChallenge(arg); ui.sheet = null; ui.form = null; ui.detailId = null; render(); return;
    case "restartFailed": restartFailed(arg); return;
    case "openBug": openBug(); return;
    case "askResetData": ui.sheet = ResetDataSheet; render(); return;
    case "confirmResetData": {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fs.")) localStorage.removeItem(key);
      }
      try { await Sync.signOutUser(); } catch {}
      location.reload();
      return;
    }
    case "bugPick": if (ui.bug) { ui.bug.pick = arg; render(); } return;
    case "restoreTestCoins": restoreTestCoins(); return;
    case "shareBg": ui.form.background = arg; updateShareEditor(); return;
    case "shareTemplate": ui.form.template = arg; updateShareEditor(); return;
    case "pickSharePhoto": {
      const img = arg === "camera" ? await captureStoryPhoto() : await pickImage(false);
      if (img) { ui.form.photo = img; ui.form.background = "photo"; updateShareEditor(); }
      return;
    }
  }

  // Форм-контролы
  if (cmd === "seg") {
    const key = el.dataset.key, sk = el.dataset.store, val = parseVal(el.dataset.val);
    if (sk != null) { store[sk] = val; storeHook(sk); } else ui.form[key] = val;
    render(); return;
  }
  if (cmd === "statEx") { statExFilter = el.dataset.ex; render(); return; }
  if (cmd === "toggle") {
    const key = el.dataset.key;
    if (key === "isPublic" && !ui.form[key] && isGuest()) { openAuthGate("publicCreate"); return; }
    ui.form[key] = !ui.form[key]; render(); return;
  }
  if (cmd === "toggleStore") { const k = el.dataset.key; store[k] = !store[k]; render(); return; }
  if (cmd === "inc" || cmd === "dec") {
    const dir = cmd === "inc" ? 1 : -1, by = +(el.dataset.by || 1), min = +el.dataset.min, max = +el.dataset.max;
    const key = el.dataset.key, sk = el.dataset.store;
    let v = (sk != null ? store[sk] : ui.form[key]) || 0;
    v += dir * by;
    if (!isNaN(min)) v = Math.max(min, v); if (!isNaN(max)) v = Math.min(max, v);
    if (sk != null) { store[sk] = v; storeHook(sk); } else ui.form[key] = v;
    if (ui.full === ChallengeCompleteFull && sk == null) {
      const input = Array.from(document.querySelectorAll(".challenge-complete [data-model]")).find((node) => node.dataset.model === key);
      if (input) input.value = v;
      return;
    }
    render(); return;
  }

  if (act.startsWith("pickPhoto")) { const img = await pickImage(arg === "camera"); if (img) { ui.form.photo = img; render(); } return; }

  if (cmd === "createNext") {
    const f = ui.form;
    if (f.step === 0 && !selectedExercises(f).length) { toast(t("Pick at least one exercise")); return; }
    if (f.editingFromReview) { f.editingFromReview = false; f.step = CREATE_LAST; navRender(); return; }
    f.step++; navRender();
    return;
  }
  if (cmd === "editCreate") {
    ui.form.step = +arg;
    ui.form.editingFromReview = true;
    navRender(() => window.scrollTo(0, 0)); return;
  }
  if (cmd === "createBack") {
    const f = ui.form;
    if (f.editingFromReview) { f.editingFromReview = false; f.step = CREATE_LAST; navRender(); }
    else if (f.step > 0) { f.step--; navRender(); } else { ui.full = null; ui.form = null; navRender(); }
    return;
  }
  if (cmd === "createChip") {
    const key = act.split(":")[1];
    ui.form[key] = +act.split(":")[2]; ui.form["custom_" + key] = false;
    const group = el.closest(".create-chips");
    if (group) {
      group.querySelectorAll(".create-chip").forEach((chip) => chip.classList.toggle("selected", chip === el));
      const input = group.querySelector(".create-chip-input");
      if (input) {
        const button = document.createElement("button");
        button.className = "create-chip";
        button.dataset.act = `createCustom:${key}`;
        button.dataset.min = input.dataset.min;
        button.dataset.max = input.dataset.max;
        button.dataset.label = input.getAttribute("aria-label") || t("Custom");
        button.textContent = t("Custom");
        input.replaceWith(button);
      }
    }
    refreshCreateDerived();
    return;
  }
  if (cmd === "createCustom") {
    ui.form["custom_" + arg] = true;
    ui.form[arg] = "";
    // Не пересобираем весь экран: замена DOM во время инерционного скролла
    // обрывала scroll-жест в iOS. Меняем только нажатый чип.
    const inp = document.createElement("input");
    inp.className = "create-chip create-chip-input selected";
    inp.type = "text"; inp.inputMode = "numeric"; inp.pattern = "[0-9]*"; inp.enterKeyHint = "done";
    inp.dataset.model = arg; inp.dataset.num = "";
    inp.dataset.min = el.dataset.min || "1"; inp.dataset.max = el.dataset.max || "5000";
    inp.value = "";
    inp.setAttribute("aria-label", el.dataset.label || t("Custom"));
    const group = el.closest(".create-chips");
    if (group) group.querySelectorAll(".create-chip").forEach((chip) => chip.classList.remove("selected"));
    el.replaceWith(inp);
    inp.focus({ preventScroll: true });
    const end = inp.value.length; try { inp.setSelectionRange(end, end); } catch {}
    return;
  }
  if (cmd === "saveChallenge") {
    if (!ui.form) return; // второй тап: первый уже создал челлендж и обнулил форму
    const access = ui.form.access || "solo", synced = access !== "solo";
    if (synced && isGuest()) { openAuthGate("publicCreate"); return; }
    setBtnLoading(el, true, synced ? t("Publishing challenge…") : t("Create challenge"));
    if (await saveChallengeForm()) {
      ui.form = null;
      // solo стартует сразу (Active); private/public ещё не стартовали (Pending).
      ui.challengeTab = synced ? "pending" : "active";
      // Синканные (private/public) — показываем экран с инвайтом; solo — сразу к списку.
      if (synced) { ui.full = ChallengeCreatedFull; render(); }
      else { ui.full = null; go("challenges"); }
    } else setBtnLoading(el, false);
    return;
  }
  if (cmd === "shareCreated") { shareInvite(); return; }
  if (cmd === "copyCreated") {
    const url = "https://pysarenkovv.github.io/fitstake/?join=" + encodeURIComponent(ui.createdChallengeId);
    try { await navigator.clipboard.writeText(url); toast(t("Link copied")); } catch { prompt("URL", url); }
    return;
  }
  if (cmd === "openCreated") {
    ui.full = null; ui.tab = "challenges"; ui.detailId = ui.createdChallengeId;
    navRender();
    return;
  }
  if (cmd === "savePreset") {
    setBtnLoading(el, true, t("Publishing challenge…"));
    if (await saveChallengeForm()) { ui.full = null; ui.form = null; go("yours"); }
    else setBtnLoading(el, false);
    return;
  }
  if (cmd === "saveShareChallenge") {
    if (isGuest()) { openAuthGate("shareCreate"); return; }
    const f = ui.form;
    setBtnLoading(el, true, t("Publishing challenge…"));
    if (!(await saveChallengeForm())) { setBtnLoading(el, false); return; }
    ui.full = null; ui.form = null; go("yours");
    shareChallengeCard(f);
    return;
  }
  if (cmd === "submitJoin") {
    const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
    if (isGuest()) { ui.sheet = null; openAuthGate("join", c.id); return; }
    if (C.isJoined(c)) { closeSheet(); return; } // уже вступил (повторный заход по ссылке)
    setBtnLoading(el, true, t("Joining…"));
    const ok = await joinChallenge(c, f.weight, f.maxReps, f.photo);
    if (ok) closeSheet();
    else {
      setBtnLoading(el, false);
      toast(ok === null ? t("Couldn't join challenge") : t("Not enough coins"));
    }
    return;
  }
  if (cmd === "submitAuth") {
    const emailEl = document.getElementById("auth-email"), passEl = document.getElementById("auth-pass");
    const email = ((emailEl && emailEl.value) || "").trim(), pass = (passEl && passEl.value) || "";
    if (!email || !pass) { toast(t("Enter email and password")); return; }
    const mode = el.dataset.mode === "signup" ? "signup" : "signin";
    setBtnLoading(el, true, t("Signing in…"));
    const res = mode === "signup" ? await Sync.signUp(email, pass) : await Sync.signIn(email, pass);
    if (res.ok) {
      store.skippedAuth = false;
      track("account_linked", { method: "email", mode });
      if (ui.screen === "onboarding") { finishOnboarding(); return; } // вход — последний шаг, завершаем онбординг
      if (store["profile.name"]) Sync.registerUser(store["profile.name"]);
      toast(t("Signed in"));
      if (ui.authIntent) resumeAuthIntent(); else render();
    } else {
      setBtnLoading(el, false);
      const key = { "wrong-password": "Wrong password", "weak-password": "Password too short (min 6)", "invalid-email": "Invalid email", "email-taken": "Email already registered — log in", "no-account": "No account yet — sign up", "network": "Network error", "offline": "Authentication service is still loading — try again", "provider-disabled": "Email registration is temporarily unavailable. Try Google.", "unauthorized-domain": "Open the app at http://localhost:8000 to sign in" }[res.error] || res.error || "Couldn't sign in";
      toast(t(key));
    }
    return;
  }
  if (cmd === "googleAuth") {
    setBtnLoading(el, true, t("Signing in…"));
    const res = await Sync.signInGoogle();
    if (res.ok) {
      store.skippedAuth = false;
      track("account_linked", { method: "google" });
      if (ui.screen === "onboarding") { finishOnboarding(); return; } // вход — последний шаг, завершаем онбординг
      if (store["profile.name"]) Sync.registerUser(store["profile.name"]);
      toast(t("Signed in"));
      if (ui.authIntent) resumeAuthIntent(); else render();
    } else {
      setBtnLoading(el, false);
      if (res.error === "cancelled") return; // сам закрыл окно — молчим
      const hint = {
        "auth/operation-not-allowed": "Enable Google in Firebase (Sign-in method)",
        "auth/configuration-not-found": "Enable Google in Firebase (Sign-in method)",
        "auth/unauthorized-domain": "Add domain in Firebase (Authorized domains)",
        "auth/popup-blocked": "Allow popups and try again",
        "auth/operation-not-supported-in-this-environment": "Google sign-in unavailable here — use email",
        "auth/web-storage-unsupported": "Google sign-in unavailable here — use email",
        "offline": "Authentication service is still loading — try again",
      }[res.error];
      toast(hint ? t(hint) : (res.error || t("Couldn't sign in")));
    }
    return;
  }
  if (cmd === "submitMeasure") {
    addMeasurement(ui.form.weight, ui.form.maxReps);
    store["profile.weightKg"] = ui.form.weight; store["profile.maxReps"] = ui.form.maxReps; storeHook("profile.maxReps");
    closeSheet(); return;
  }
  if (cmd === "sendBug") {
    if (!ui.bug || !ui.bug.pick) return;
    const [ci, pi] = ui.bug.pick.split("-").map(Number);
    const [, cat, problems] = BUG_CATS[ci];
    const problem = problems[pi];
    const noteEl = document.getElementById("bug-note");
    const note = ((noteEl && noteEl.value) || ui.bug.note || "").trim().slice(0, 1000);
    track("bug_reported", { category: cat, problem });
    el.disabled = true;
    const ok = await Sync.reportBug({
      category: cat, problem, note,
      screen: currentScreenName(), version: APP_VERSION,
      device: (navigator.userAgent || "").slice(0, 300),
      lang: store.lang, err: (lastError || "").slice(0, 500),
    });
    closeSheet();
    toast(ok ? t("Thanks! Report sent.") : t("Couldn't send — check connection"));
    return;
  }
  if (cmd === "saveResult") {
    const f = ui.form, c = app.challenges.find((x) => x.id === arg);
    completeChallenge(c, f.photo, f.weight, f.maxReps);
    store["profile.weightKg"] = f.weight; store["profile.maxReps"] = f.maxReps;
    closeFull(); return;
  }
  if (cmd === "shareDay") {
    const c = app.challenges.find((x) => x.id === arg);
    openShareDay(c);
    return;
  }
  if (cmd === "publishDay") {
    const c = app.challenges.find((x) => x.id === arg);
    const shareForm = Object.assign({}, ui.form, { photo: ui.form.background === "photo" ? ui.form.photo : null });
    const shared = await shareDayStory(c, shareForm);
    if (shared) openShareComplete({ type: shareForm.shareReturn, challengeId: c.id });
    return;
  }
  if (cmd === "shareResult") {
    const f = ui.form, c = app.challenges.find((x) => x.id === arg);
    const wc = c.startWeight != null ? `${c.startWeight} → ${f.weight} ${t("kg")}` : t("%lld kg", f.weight);
    const mc = c.startMaxReps != null ? `${c.startMaxReps} → ${f.maxReps}` : String(f.maxReps);
    const exerciseSummary = c.goals.map((g) => {
      const total = (c.myTotalByExercise && c.myTotalByExercise[g.exercise]) || c.myTodayReps[g.exercise] || 0;
      return `${fmt(total)} ${Exercise.displayName(g.exercise).toLowerCase()}`;
    }).join(" · ");
    const shared = await shareCard({ title: c.title, duration: c.durationDays, totalReps: c.myTotalReps, exerciseSummary, weight: wc, maxReps: mc, payout: C.payout(c), beforePhoto: c.beforePhoto, afterPhoto: f.photo });
    if (shared) openShareComplete({ type: "challengeComplete", challengeId: c.id, form: Object.assign({}, f) });
    return;
  }

  // Онбординг
  if (cmd === "onbBack") { if (ui.onbStep > 0) { ui.onbStep--; render(); } return; }
  if (cmd === "onbNext") {
    if (ui.onbStep === STEP.name) {
      const inp = document.getElementById("onb-name");
      const name = inp ? inp.value.trim() : "";
      if (!name) { toast(t("Your name")); return; }
      store["profile.name"] = name;
    }
    // Основное упражнение (первое выбранное) кормит дневную норму и стартовый замер.
    if (ui.onbStep === STEP.exercises) {
      const primary = EX_ORDER.find((ex) => store["profile.sel_" + ex]);
      if (!primary) { toast(t("Pick at least one exercise")); return; }
      store["profile.startExercise"] = primary;
      store["profile.maxReps"] = store["profile.reps." + primary];
      storeHook("profile.maxReps");
    }
    // LAST_STEP — итоговый экран дневной нормы; кнопка «Погнали» завершает онбординг.
    if (ui.onbStep === LAST_STEP) { finishOnboarding(); }
    else { ui.onbStep++; render(); }
    return;
  }
  if (cmd === "onbSet") { store[arg] = act.split(":")[2]; render(); return; }
  if (cmd === "goalChoice") { store.goalChoice = arg; render(); return; }
  // Пропустить создание аккаунта — временно входим без входа (флаг гасит обязательный возврат).
  if (cmd === "skipAuth") { store.skippedAuth = true; finishOnboarding(); return; }
});

// Звук при фокусе на поле ввода (кроме ползунков — у них свой тик).
root.addEventListener("focusin", (e) => {
  if (e.target.matches && e.target.matches('input:not([type="range"]), textarea')) sfx("input");
});

root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "profile-name") { profileNameDraft = el.value; return; }
  if (el.id === "bug-note") { if (ui.bug) ui.bug.note = el.value; return; }
  // Ползунки онбординга: обновляем цифру и заливку напрямую, без render() —
  // полная перерисовка innerHTML оборвала бы жест перетаскивания.
  if (el.dataset.slider != null) {
    const k = el.dataset.slider, [min, max] = RANGES[k] || [+el.min, +el.max];
    const v = Math.min(Math.max(Math.round(+el.value), min), max);
    el.style.setProperty("--fill", (((v - min) / (max - min)) * 100).toFixed(1) + "%");
    const num = document.querySelector(`[data-val-for="${k}"]`);
    if (num && num.textContent !== String(v)) { num.textContent = v; sfx("tick"); haptic(6); }
    store[k] = v;
    return;
  }
  if (el.dataset.model != null) {
    const k = el.dataset.model;
    if (el.dataset.num != null) {
      // Числовой «Custom»-филд: держим только цифры (на десктопе могли ввести иное).
      const digits = el.value.replace(/\D/g, "");
      if (el.value !== digits) el.value = digits;
      ui.form[k] = digits === "" ? "" : parseInt(digits, 10);
    } else {
      ui.form[k] = el.type === "number" || el.type === "range" ? (+el.value || 0) : el.value;
    }
    if (k === "photoZoom" || k === "dim") updateSharePreviewStyle();
  }
});
root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.store != null && el.tagName === "INPUT") {
    const k = el.dataset.store, r = RANGES[k];
    let v = parseInt(el.value); if (isNaN(v)) v = store[k];
    if (r) v = Math.min(Math.max(v, r[0]), r[1]);
    store[k] = v; storeHook(k); render();
    return;
  }
  // Числовой «Custom»-филд: на blur клампим по [min,max] и перерисовываем.
  if (el.dataset.model != null && el.dataset.num != null) {
    const k = el.dataset.model, min = +el.dataset.min, max = +el.dataset.max;
    let v = parseInt(String(ui.form[k] == null ? "" : ui.form[k]).replace(/\D/g, ""), 10);
    if (isNaN(v)) v = min;
    ui.form[k] = Math.min(Math.max(v, min), max);
    el.value = String(ui.form[k]);
    refreshCreateDerived();
  }
});

// ==========================================================================
// afterRender — привязка колёс онбординга + сохранение скролла
// ==========================================================================
function afterRender() {
  // Переводим фокус в лист при его открытии — чтобы клавиатура/скринридер
  // попали внутрь диалога, а не остались на фоне. Только на первом появлении.
  const _sheet = document.querySelector(".sheet");
  if (_sheet && !afterRender._sheetOpen) {
    _sheet.focus(); // первое открытие — фокус + выезд снизу
  } else if (_sheet) {
    // Лист уже был открыт (перерисовка при выборе чипа и т.п.) — глушим повторный выезд,
    // синхронно до отрисовки кадра, поэтому sheet-in/backdrop-in не проигрываются заново.
    _sheet.classList.add("no-enter");
    const _bd = document.querySelector(".sheet-backdrop");
    if (_bd) _bd.classList.add("no-enter");
  }
  afterRender._sheetOpen = !!_sheet;

  // То же для полноэкранного оверлея: вход играем только на первом появлении,
  // на перерисовках (шаги мастера, драг фото) — глушим.
  const _full = document.querySelector(".fullscreen");
  const _fullJustOpened = _full && !afterRender._fullOpen;
  if (_full) {
    _full.setAttribute("role", "dialog");
    _full.setAttribute("aria-modal", "true");
    _full.tabIndex = -1;
  }
  if (_fullJustOpened) _full.focus();
  if (_full && afterRender._fullOpen) _full.classList.add("no-enter");
  afterRender._fullOpen = !!_full;
  // Count-up цифр — только при первом появлении экрана (не на каждой перерисовке).
  if (_fullJustOpened) _full.querySelectorAll("[data-countup]").forEach(animateCountUp);

  bindSharePhotoDrag();
  bindScrollFollow();
}

function updateSharePreviewStyle() {
  const preview = document.querySelector(".share-story-preview");
  if (!preview || !ui.form) return;
  preview.style.setProperty("--photo-scale", ui.form.photoZoom || 1);
  preview.style.setProperty("--photo-x", (ui.form.photoX || 0) + "%");
  preview.style.setProperty("--photo-y", (ui.form.photoY || 0) + "%");
  preview.style.setProperty("--story-dim", (ui.form.dim || 45) / 100);
}

function updateShareEditor() {
  const editor = document.querySelector(".share-editor");
  const preview = editor && editor.querySelector(".share-story-preview");
  const c = ui.form && app.challenges.find((x) => x.id === ui.form.challengeId);
  if (!editor || !preview || !c) { render(); return; }

  const photo = ui.form.background === "photo" && ui.form.photo;
  preview.classList.toggle("has-photo", !!photo);
  preview.classList.toggle("is-gradient", !photo);
  preview.classList.toggle("template-minimal", ui.form.template === "minimal");
  preview.classList.toggle("template-challenge", ui.form.template === "challenge");

  const media = preview.querySelector(":scope > img, :scope > .share-gradient");
  if (photo) {
    if (!media || media.tagName !== "IMG") {
      const img = document.createElement("img");
      img.alt = ""; img.draggable = false; img.src = photo;
      if (media) media.replaceWith(img); else preview.prepend(img);
    } else if (media.src !== photo) media.src = photo;
  } else if (!media || !media.classList.contains("share-gradient")) {
    const gradient = document.createElement("div"); gradient.className = "share-gradient";
    if (media) media.replaceWith(gradient); else preview.prepend(gradient);
  }

  const copy = preview.querySelector(".share-story-copy");
  if (copy) copy.innerHTML = shareStoryCopy(c, ui.form);
  editor.querySelectorAll('[data-act^="shareTemplate:"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.act === `shareTemplate:${ui.form.template}`);
  });
  editor.querySelector('[data-act="shareBg:gradient"]')?.classList.toggle("selected", !photo);
  editor.querySelector('[data-act="pickSharePhoto:library"]')?.classList.toggle("selected", !!photo);

  const controls = editor.querySelector(".share-photo-controls");
  if (photo && !controls) {
    editor.querySelector('[data-act^="publishDay:"]')?.insertAdjacentHTML("beforebegin", sharePhotoControls(ui.form));
  } else if (!photo && controls) controls.remove();

  updateSharePreviewStyle();
  bindSharePhotoDrag();
}

function bindSharePhotoDrag() {
  const preview = document.querySelector(".share-story-preview.has-photo");
  const img = preview && preview.querySelector("img");
  if (!preview || !img || !ui.form) return;
  let pointerId = null, startX = 0, startY = 0, baseX = 0, baseY = 0;
  preview.onpointerdown = (e) => {
    pointerId = e.pointerId; startX = e.clientX; startY = e.clientY;
    baseX = ui.form.photoX || 0; baseY = ui.form.photoY || 0;
    preview.setPointerCapture(pointerId);
  };
  preview.onpointermove = (e) => {
    if (e.pointerId !== pointerId) return;
    const rect = preview.getBoundingClientRect();
    ui.form.photoX = Math.max(-40, Math.min(40, baseX + (e.clientX - startX) / rect.width * 100));
    ui.form.photoY = Math.max(-40, Math.min(40, baseY + (e.clientY - startY) / rect.height * 100));
    updateSharePreviewStyle();
  };
  const done = (e) => { if (e.pointerId === pointerId) pointerId = null; };
  preview.onpointerup = done; preview.onpointercancel = done;
}

let clearScrollFollow = null;
function bindScrollFollow() {
  if (clearScrollFollow) clearScrollFollow();
  clearScrollFollow = null;
  if (REDUCE_MOTION()) return;
  if (document.querySelector(".challenge-complete")) return;

  const scrollBox = document.querySelector(".sheet, .fullscreen") || window;
  const content = document.querySelector(".sheet-body, .fullscreen .screen, #detail-scroll > .screen, #scroller");
  if (!content) return;
  const blocks = Array.from(content.children).filter((el) => !el.classList.contains("navbar"));
  if (blocks.length < 2) return;
  blocks.forEach((el) => el.classList.add("scroll-follow"));

  let last = scrollBox === window ? window.scrollY : scrollBox.scrollTop;
  let settleTimer = 0;
  const onScroll = () => {
    const next = scrollBox === window ? window.scrollY : scrollBox.scrollTop;
    const delta = Math.max(-16, Math.min(16, next - last));
    last = next;
    blocks.forEach((el, index) => {
      const factor = Math.min(1, 0.58 + index * 0.045);
      el.style.translate = `0 ${delta * factor}px`;
    });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => blocks.forEach((el) => { el.style.translate = "0 0"; }), 45);
  };
  scrollBox.addEventListener("scroll", onScroll, { passive: true });
  clearScrollFollow = () => {
    clearTimeout(settleTimer);
    scrollBox.removeEventListener("scroll", onScroll);
  };
}

// Сохранение позиции скролла при перерисовках на месте (степперы/тоглы).
const _render = render;
render = function () {
  const sheetTop = document.querySelector(".sheet") && document.querySelector(".sheet").scrollTop;
  const detailTop = document.querySelector("#detail-scroll") && document.querySelector("#detail-scroll").scrollTop;
  const fullTop = document.querySelector(".fullscreen") && document.querySelector(".fullscreen").scrollTop;
  // Форма создания скроллится внутренним телом (шапка/футер закреплены), а не .fullscreen.
  const wizardTop = document.querySelector(".create-wizard-body") && document.querySelector(".create-wizard-body").scrollTop;
  const winTop = window.scrollY;
  _render();
  if (sheetTop != null) { const s = document.querySelector(".sheet"); if (s) s.scrollTop = sheetTop; }
  if (detailTop != null) { const d = document.querySelector("#detail-scroll"); if (d) d.scrollTop = detailTop; }
  if (fullTop != null) { const f = document.querySelector(".fullscreen"); if (f) f.scrollTop = ui.resetFullScroll ? 0 : fullTop; }
  if (ui.resetFullScroll) { const f = document.querySelector(".fullscreen"); if (f) f.scrollTop = 0; ui.resetFullScroll = false; }
  if (wizardTop != null) { const w = document.querySelector(".create-wizard-body"); if (w) w.scrollTop = wizardTop; }
  window.scrollTo(0, winTop);
  // Перерисовка убила нажатый элемент — переносим пульс на его копию в новом DOM,
  // чтобы анимация нажатия доиграла до конца (степперы, тоглы и т.п.).
  if (press.el && !press.el.isConnected && press.sel) {
    const again = document.querySelector(press.sel);
    if (again) { again.classList.add("pressed"); press.el = again; }
    else { press.el = null; press.sel = ""; }
  }
  saveApp();
};

// iOS Safari применяет :active к не-кнопкам (кликабельным div) только при наличии
// touch-слушателя — даём пустой, чтобы press-анимация работала на всех элементах.
document.addEventListener("touchstart", function () {}, { passive: true });

// Полный цикл нажатия независимо от длины тапа: :active гаснет при отпускании,
// поэтому класс .pressed (те же стили, см. :is(:active, .pressed) в styles.css)
// держим минимум PRESS_HOLD мс — сжатие доигрывает, потом полностью играет возврат.
// Действие клика при этом ждёт конца сжатия (await pressFinish() в диспетчере) —
// иначе render/View Transition снесёт DOM раньше, чем пульс успеет показаться.
const PRESS_HOLD = 200;        // держать в синхроне с --motion-press
const PRESS_TOUCH_DELAY = 50;  // не пульсировать при старте скролла
const PRESS_RETURN_LAG = 80;   // возврат стартует после диспетчеризации и перерисовки
const PRESSABLE = "button, [data-act], [data-sess], [data-err]";
const press = { el: null, sel: "", start: 0, pending: null, applyTimer: 0, releaseTimer: 0 };
// «Тот же» элемент в перерисованном DOM ищем по data-атрибутам действия.
function pressSelector(el) {
  const parts = [];
  for (const a of ["data-act", "data-sess", "data-err", "data-key", "data-store", "data-by"]) {
    const v = el.getAttribute(a);
    if (v != null) parts.push(`[${a}="${v.replace(/"/g, '\\"')}"]`);
  }
  return parts.join("");
}
function pressApply(el) { el.classList.add("pressed"); press.el = el; press.start = performance.now(); }
function pressCancel() { // скролл/новое нажатие — снимаем сразу, без пульса
  clearTimeout(press.applyTimer); clearTimeout(press.releaseTimer);
  press.applyTimer = 0; press.releaseTimer = 0; press.pending = null;
  if (press.el) press.el.classList.remove("pressed");
  press.el = null; press.sel = "";
}
function pressRelease() {
  if (press.applyTimer) { // тап быстрее задержки — всё равно полный цикл
    clearTimeout(press.applyTimer); press.applyTimer = 0;
    if (press.pending) { pressApply(press.pending); press.pending = null; }
  }
  if (!press.el) return;
  // Возврат — после конца сжатия + запас на диспетчеризацию/перерисовку:
  // к этому моменту пульс уже перенесён на новый DOM (см. патч render).
  const wait = Math.max(0, PRESS_HOLD - (performance.now() - press.start)) + PRESS_RETURN_LAG;
  press.releaseTimer = setTimeout(() => {
    if (press.el) press.el.classList.remove("pressed");
    press.el = null; press.sel = ""; press.releaseTimer = 0;
  }, wait);
}
// Диспетчер ждёт этим промисом конца фазы сжатия — нажатие видно ДО смены экрана.
function pressFinish() {
  if (!press.el) return Promise.resolve();
  const wait = Math.max(0, PRESS_HOLD - (performance.now() - press.start));
  return wait ? new Promise((res) => setTimeout(res, wait)) : Promise.resolve();
}
document.addEventListener("pointerdown", (e) => {
  // Тап или начало скролла вне числового чипа закрывает клавиатуру. На iOS
  // это также гарантирует возврат visual viewport и нижней панели на место.
  const active = document.activeElement;
  if (active && active.matches && active.matches(".create-chip-input") && e.target !== active) active.blur();
  pressCancel();
  let el = e.target.closest(PRESSABLE);
  if (!el || el.disabled || el.classList.contains("sheet-backdrop")) return;
  // Карточка челленджа жмётся целиком — переносим пульс на контейнер.
  if (el.classList.contains("challenge-card-main")) el = el.closest(".challenge-card") || el;
  press.sel = pressSelector(el);
  if (e.pointerType === "touch") {
    press.pending = el;
    press.applyTimer = setTimeout(() => { press.applyTimer = 0; pressApply(press.pending); press.pending = null; }, PRESS_TOUCH_DELAY);
  } else pressApply(el);
}, { capture: true, passive: true });
document.addEventListener("pointerup", pressRelease, { capture: true, passive: true });
document.addEventListener("pointercancel", pressCancel, { capture: true, passive: true });

// Escape закрывает открытый лист — тот же выход, что и тап по фону.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.sheet) { closeSheet(); return; }
  if (e.key === "Escape" && ui.full) { closeFull(); return; }
  if (e.key === "Tab" && (ui.sheet || ui.full)) {
    const dialog = document.querySelector(ui.sheet ? ".sheet" : ".fullscreen");
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hidden && el.getClientRects().length);
    if (!focusable.length) { e.preventDefault(); dialog.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ==========================================================================
// Приглашение друзей
// ==========================================================================
async function shareInvite(id) {
  const c = (id && app.challenges.find((x) => x.id === id)) || (ui.createdChallengeId && app.challenges.find((x) => x.id === ui.createdChallengeId)) || (ui.detailId && app.challenges.find((x) => x.id === ui.detailId)) || app.challenges.find(C.isJoined) || app.challenges[0];
  if (!c) return;
  const url = "https://pysarenkovv.github.io/fitstake/?join=" + encodeURIComponent(c.id);
  track("invite_shared", { challenge_id: c.id });
  const slogan = store.lang === "ua" ? "Не просто кажи. Доведи це! — Repact" : REPACT_SLOGAN;
  const text = slogan + "\n\n" + t("Join my challenge") + " — " + c.title;
  if (navigator.share) {
    try { await navigator.share({ title: "Repact", text, url }); return; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast(t("Link copied")); }
  catch { prompt("URL", url); }
}

// ==========================================================================
// Старт
// ==========================================================================
// Пришли по ссылке-приглашению: запоминаем и чистим URL, чтобы обновление страницы не повторяло действие.
const JOIN_ID = new URLSearchParams(location.search).get("join") || null;
const JOIN_INTENT = !!JOIN_ID;
if (JOIN_INTENT && history.replaceState) history.replaceState(null, "", location.pathname);
ui.screen = store.onboarded ? "tabs" : "onboarding";
// Уже онбордился — открываем общий челлендж (там кнопка вступления, если ещё не внутри).
if (store.onboarded && JOIN_INTENT) { ui.tab = "challenges"; ui.detailId = JOIN_ID; }
render();

// В PWA/Android системная кнопка Back сначала закрывает верхний слой приложения.
// Guard-запись остаётся поверх базовой и восстанавливается после каждого закрытия слоя.
if (history.pushState && history.replaceState) {
  history.replaceState(Object.assign({}, history.state, { repactBase: true }), "", location.href);
  history.pushState({ repactGuard: true }, "", location.href);
  window.addEventListener("popstate", () => {
    let handled = false;
    if (ui.sheet) { ui.sheet = null; ui.form = null; handled = true; }
    else if (ui.full) { ui.full = null; ui.form = null; ui.workoutResult = null; handled = true; }
    else if (ui.detailId) { ui.detailId = null; handled = true; }
    if (handled) {
      render();
      history.pushState({ repactGuard: true }, "", location.href);
    } else history.back();
  });
}

// iOS PWA иногда открывается с временно укороченным layout viewport. Реальный свайп
// исправляет его; делаем безопасный программный пересчёт, сохраняя текущий scrollY.
// Проверять scrollHeight нельзя: асинхронные карточки делали страницу высокой раньше,
// чем WebKit успевал уточнить viewport, и старый workaround из-за этого не запускался.
function settleStandaloneViewport() {
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (!standalone || ui.sheet || ui.full || liveSession) return;
  const de = document.documentElement, y = window.scrollY;
  const previousMinHeight = de.style.minHeight;
  de.style.minHeight = Math.max(screen.height, window.innerHeight) + 2 + "px";
  window.scrollTo(0, y + 1);
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    de.style.minHeight = previousMinHeight;
  });
}
requestAnimationFrame(() => requestAnimationFrame(settleStandaloneViewport));
setTimeout(settleStandaloneViewport, 300);
window.addEventListener("pageshow", () => setTimeout(settleStandaloneViewport, 60));
window.addEventListener("orientationchange", () => setTimeout(settleStandaloneViewport, 300));

// Живой общий прогресс: подписка на Firebase (если конфиг вставлен).
// Несколько Firebase-узлов могут обновиться подряд — достаточно одного render за кадр.
let syncRenderFrame = 0;
Sync.init(() => {
  switchAppStorageOwner();
  applySync();
  phIdentify(); // uid из auth готов — связываем аналитику с игроком
  // Без инкогнито: онбордился, но остался анонимом (или вышел) — на обязательный вход.
  if (Sync.enabled && Sync.isAnonymous && store.onboarded && !store.skippedAuth && ui.screen === "tabs") { ui.screen = "onboarding"; ui.onbStep = STEP.auth; }
  // Не дёргаем перерисовку поверх открытых форм и камеры.
  if (!ui.sheet && !ui.full && !liveSession && !syncRenderFrame) {
    syncRenderFrame = requestAnimationFrame(() => {
      syncRenderFrame = 0;
      if (!ui.sheet && !ui.full && !liveSession) render();
    });
  }
});
if (store.onboarded && store["profile.name"]) Sync.registerUser(store["profile.name"]);

// Сторожок смены дня: интервал + возврат PWA из фона.
setInterval(() => { if (!liveSession && rolloverIfNeeded() && !ui.sheet && !ui.full) render(); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !liveSession && rolloverIfNeeded() && !ui.sheet && !ui.full) render(); });
