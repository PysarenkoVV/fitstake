/* FitStake — веб-версия iOS-приложения (порт со Swift).
   Чистый JS без сборки. Состояние в памяти + профиль в localStorage. */

"use strict";

// Версия оболочки — держать в синхроне с CACHE в sw.js; уходит в баг-репорты.
const APP_VERSION = "v55";
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
  seal: '<path d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3 16.3l.9-2.9L3 10.5l2.6-1.5 1-2.8 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-4.5" stroke="#0a0a0a"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  camera: '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.5"/>',
  photo: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="8" cy="9" r="1.4"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" class="rec-dot"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="8" y="8" width="8" height="8" rx="1.5" stroke="#0a0a0a"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  lockOpen: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017-2.5"/>',
  faceid: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><path d="M9 10v1M15 10v1M12 9v4l-1 1M9 15s1 1.5 3 1.5S15 15 15 15"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  share: '<path d="M12 3v13M8 7l4-4 4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"/>',
  personXmark: '<circle cx="9" cy="8" r="3.5"/><path d="M3 21c0-3.5 3-5.5 6-5.5M16 9l5 5M21 9l-5 5"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/>',
  plusCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8" stroke="#0a0a0a"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  dollar: '<circle cx="12" cy="12" r="10"/><path d="M12 7v10M14.5 9.2c-.4-1-1.4-1.4-2.5-1.4-1.4 0-2.5.7-2.5 1.9 0 2.7 5 1.3 5 4 0 1.3-1.2 2-2.5 2-1.2 0-2.2-.5-2.6-1.5" stroke="#0a0a0a"/>',
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
  "Try a demo workout": "Попробовать демо-тренировку",
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
  "Goal reached!": "Цель выполнена!", "Height": "Рост", "Honestly — the daily goal is built from this.": "Честно — из этого посчитаем дневную норму.",
  "How many push-ups can you do in one set?": "Сколько отжиманий делаешь за один подход?",
  "I barely train": "Почти не тренируюсь", "Increase by: %lld reps": "Прирост: %lld повторов",
  "Join for": "Вступить за", "kg": "кг", "Leaderboard": "Таблица итогов", "Let's go": "Погнали",
  "Test coins · no cash value": "Тест-монеты · без денежной стоимости",
  "Leave challenge": "Выйти из челленджа", "Leave challenge?": "Выйти из челленджа?", "Leave": "Выйти", "Cancel": "Отмена",
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
  "Test currency — no real money.": "Тестовая валюта — настоящие деньги не участвуют.",
  "The buy-in is deducted from your balance right away. Test currency — no real money.": "Взнос сразу списывается с баланса. Валюта тестовая — настоящие деньги не участвуют.",
  "The challenge runs %lld days.": "Челлендж идёт %lld дней.", "The daily goal grows as the challenge goes on.": "Дневная норма растёт по ходу челленджа.",
  "The goal grows by %lld reps every day — by day %lld it's %lld.": "Норма растёт на %lld повторов каждый день — к дню %lld это %lld.",
  "The goal grows by %lld reps every week — by day %lld it's %lld.": "Норма растёт на %lld повторов каждую неделю — к дню %lld это %lld.",
  "The photo stays hidden until the finish — then it appears next to your AFTER photo.": "Фото скрыто до финиша — там оно встанет рядом с фото ПОСЛЕ.",
  "Title": "Название", "Today": "Сегодня", "Total reps": "Всего повторов", "Total reps over the last 4 weeks.": "Сумма повторов за последние 4 недели.",
  "Show photos": "Показать фото", "Upload from library": "Загрузить из галереи", "Week %lld": "Неделя %lld",
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
  "Your starting point — at the finish you'll see how far you've come.": "Твоя точка отсчёта — на финише увидишь, как далеко ушёл.",
  "Your weight": "Твой вес", "Your whole body must be in frame": "В кадре должно быть всё тело целиком", "Yours": "Твои",
  "Language": "Язык", "Edit": "Изменить", "Increase by": "Прирост",
  "Progress": "Прогресс", "Settings": "Настройки", "Continue workout": "Продолжить тренировку",
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
  "In the app: %lld": "В приложении: %lld", "today": "сегодня", "yesterday": "вчера",
  "Pull-ups": "Подтягивания", "Dips": "Брусья",
  "Do today's pull-ups": "Подтягивания за сегодня", "Do today's dips": "Брусья за сегодня",
  "You didn't finish this one.": "В этот раз ты не дошёл.", "Finishers": "Дошли",
  "A new season starts soon.": "Скоро новый сезон.", "Completed": "Завершён",
  "Day streak": "Дней подряд", "%lld-day streak": "%lld дней подряд",
  "Closed": "Закрыт", "Missed": "Пропущен", "Upcoming": "Впереди", "Out": "Выбыл",
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
  "%lld in FitStake": "%lld в FitStake", "Create from scratch": "Создать с нуля",
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
  "How many %@ can you do in one set?": "Сколько %@ ты делаешь за один подход?",
  "Easier": "Легче", "Recommended": "Рекомендовано", "Harder": "Интенсивнее",
  "Your max is %lld reps. %@ level → %lld working sets.": "Твой максимум — %lld повторений. Уровень %@ → %lld рабочих подхода.",
  "Enter manually": "Ввести вручную",
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
  "Total reps": "Всего повторений", "Following %lld": "Подписок: %lld", "Followers %lld": "Подписчиков: %lld",
  "Notifications": "Уведомления", "No notifications yet": "Уведомлений пока нет",
  "%@ completed %@ in %@": "%@ закрыл упражнение «%@» в «%@»",
  "%@ completed today's challenge in %@": "%@ выполнил дневную цель в «%@»",
  "just now": "только что", "%lld min ago": "%lld мин назад", "%lld h ago": "%lld ч назад",
  "Couldn't update subscription": "Не удалось изменить подписку",
};

// Перевод + подстановка %lld / %@ по порядку аргументов.
function t(key, ...args) {
  let s = store.lang === "ru" && RU[key] != null ? RU[key] : key;
  let i = 0;
  s = s.replace(/%lld|%@/g, () => (i < args.length ? String(args[i++]) : ""));
  return s;
}

// ==========================================================================
// Персистентность (аналог @AppStorage)
// ==========================================================================
const DEFAULTS = {
  onboarded: false, "profile.name": "", "profile.gender": "male", "profile.age": 25, "profile.heightCm": 178,
  "profile.weightKg": 75, "profile.level": "regular", "profile.maxReps": 15, "profile.startExercise": "pushups", dailyGoal: 50,
  workoutSounds: true, interfaceSounds: true, lang: (navigator.language || "en").startsWith("ru") ? "ru" : "en",
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
function coinCountUp(value, key, fromZero) {
  return `<span class="money">${COIN_SYM}${fmt(value)}</span>`;
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
  norm: (c, g, day) => g.repsPerDay + c.progression.step * progIncrements(c.progression, day ?? c.currentDay),
  repsNorm: (c, day) => c.goals.reduce((s, g) => s + C.norm(c, g, day), 0),
  isTodayDone: (c) => c.goals.every((g) => C.myToday(c, g.exercise) >= C.norm(c, g)),
  isFinished: (c) => c.currentDay >= c.durationDays && C.isTodayDone(c),
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
    id: uid(), missPolicy: "oneTotal", progression: { step: 0, period: "day" },
    myTodayReps: {}, myTotalReps: 0, startWeight: null, startMaxReps: null,
    beforePhoto: null, afterPhoto: null, isCompleted: false,
  }, o);
}

// Единственный общий челлендж: 150 отжиманий + 50 приседаний в день.
// С включённым Sync участники настоящие; без него — мок-соперники.
const Sync = window.Sync || { enabled: false, uid: null, state: {}, init: async () => false, registerUser() {}, join() {}, report() {} };
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

function mockChallenges() {
  return [
    newChallenge({
      id: "main",
      title: "150 Push-ups + 50 Squats",
      goals: [{ exercise: "pushups", repsPerDay: 150 }, { exercise: "squats", repsPerDay: 50 }],
      durationDays: 30, buyIn: 100, isPublic: true,
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
  return c.startedAt ? dateKey(c.startedAt) : null;
}
function dayEpoch(startKey, day) { return new Date(startKey + "T00:00:00").getTime() + (day - 1) * DAY; }
function dayClosed(c, day, dayData) {
  return c.goals.every((g) => (dayData[g.exercise] || 0) >= C.norm(c, g, day));
}
// Прошедшие (не сегодняшние) дни, где дневная норма не закрыта.
function missedDays(c, days) {
  const startKey = challengeStartKey(c);
  if (!startKey) return 0;
  let missed = 0;
  for (let day = 1; day < c.currentDay; day++) {
    if (!dayClosed(c, day, days[dateKey(dayEpoch(startKey, day))] || {})) missed++;
  }
  return missed;
}
function allowedMisses(policy, throughDays) {
  if (policy === "never") return 0;
  if (policy === "onePerTwoWeeks") return Math.floor(Math.max(throughDays - 1, 0) / 14) + 1;
  return 1; // oneTotal и дефолт
}
function eliminatedByMisses(c, days) {
  return missedDays(c, days) > allowedMisses(c.missPolicy, c.currentDay - 1);
}
// Серия закрытых дней подряд от сегодня назад; незакрытое «сегодня» серию не рвёт.
function streakOf(c, days) {
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
      return { id: uid(), title: ch.title, norm, reps };
    });
    out.push({ id: uid(), date, entries });
  }
  return out;
}

// ==========================================================================
// AppState
// ==========================================================================
const app = {
  balance: 50,
  transactions: [{ id: uid(), kind: "start", amount: 50, date: Date.now() }],
  challenges: mockChallenges(),
  history: [],
  measurements: [],
  totalReps: Sync.enabled ? 0 : 1760,
  repsByExercise: {}, // сумма повторов за всё время по типам упражнений
  leftMain: false,
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
    const eliminated = eliminatedByMisses(ch, pdays);
    return { id, name: p.name || "?", isMe: id === Sync.uid, state: eliminated ? "eliminated" : "active",
      doneToday, todayReps, _days: pdays, _total: p.total || 0, _streak: streakOf(ch, pdays) };
    });
    const me = ch.participants.find((p) => p.isMe);
    if (me) {
    ch.myTodayReps = Object.assign({}, me._days[today] || {});
    ch.myTotalReps = me._total;
    app.totalReps = me._total;
    app.history = Object.entries(me._days).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, per]) => ({
      id: date, date: new Date(date + "T00:00:00").getTime(),
      entries: [{ id: date + "e", title: ch.title, norm: C.repsNorm(ch), reps: Object.values(per).reduce((a, b) => a + b, 0) }],
    }));
    }
  }
  applyPublicChallenges(today);
}

function applyPublicChallenges(today) {
  const remote = Sync.state.challenges;
  if (!remote) return;
  for (const [id, rec] of Object.entries(remote)) {
    if (!rec.meta) continue;
    let c = app.challenges.find((x) => x.id === id);
    const m = rec.meta;
    if (!c) {
      c = newChallenge({ id, title: m.title, goals: Object.values(m.goals || {}), durationDays: m.durationDays,
        buyIn: m.buyIn, isPublic: true, ownerId: m.ownerId, missPolicy: m.missPolicy, progression: { step: m.progressionStep || 0, period: m.progressionPeriod || "day" },
        startedAt: m.createdAt, currentDay: Math.min(Math.floor((startOfDay(Date.now()) - startOfDay(m.createdAt)) / DAY) + 1, m.durationDays),
        yesterdayDropouts: 0, participants: [], myTodayReps: {}, myTotalReps: 0 });
      app.challenges.push(c);
    }
    c.participants = Object.entries(rec.participants || {}).map(([pid, p]) => {
      const days = p.days || {}, day = days[today] || {};
      return { id: pid, name: p.name || "?", isMe: pid === Sync.uid, state: eliminatedByMisses(c, days) ? "eliminated" : "active",
        doneToday: c.goals.every((g) => (day[g.exercise] || 0) >= C.norm(c, g)), todayReps: Object.values(day).reduce((a, b) => a + b, 0), _days: days, _total: p.total || 0, _streak: streakOf(c, days) };
    });
    const me = C.me(c);
    if (me) { c.myTodayReps = Object.assign({}, me._days[today] || {}); c.myTotalReps = me._total; }
  }
  if (JOIN_ID && app.challenges.some((c) => c.id === JOIN_ID) && !ui.full && !ui.sheet) { ui.tab = "challenges"; ui.detailId = JOIN_ID; }
}
// ---- Персистентность: баланс, челленджи, история и замеры живут в localStorage ----
const SAVE_KEY = "fs.state";
function snapshotApp() {
  return { balance: app.balance, transactions: app.transactions, challenges: app.challenges,
    history: app.history, measurements: app.measurements, totalReps: app.totalReps, repsByExercise: app.repsByExercise, dayKey: app.dayKey, leftMain: app.leftMain };
}
let saveTimer = null;
let lastSavedState = null;
try { lastSavedState = localStorage.getItem(SAVE_KEY); } catch {}
function saveApp() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const serialized = JSON.stringify(snapshotApp());
    if (serialized === lastSavedState) return;
    try { localStorage.setItem(SAVE_KEY, serialized); lastSavedState = serialized; }
    catch {
      // квота переполнена — сохраняем без фото
      const slim = snapshotApp();
      slim.challenges = slim.challenges.map((c) => Object.assign({}, c, { beforePhoto: null, afterPhoto: null }));
      const slimSerialized = JSON.stringify(slim);
      if (slimSerialized === lastSavedState) return;
      try { localStorage.setItem(SAVE_KEY, slimSerialized); lastSavedState = slimSerialized; } catch {}
    }
  }, 250);
}
(function restoreApp() {
  app.dayKey = dateKey();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
  if (!saved || !Array.isArray(saved.challenges) || !saved.challenges.length) return;
  app.balance = saved.balance != null ? saved.balance : app.balance;
  app.transactions = saved.transactions || app.transactions;
  app.challenges = saved.challenges;
  app.history = saved.history || [];
  app.measurements = saved.measurements || [];
  app.totalReps = saved.totalReps != null ? saved.totalReps : (saved.totalPushups || 0); // миграция старого ключа
  app.repsByExercise = saved.repsByExercise || {};
  app.dayKey = saved.dayKey || dateKey();
  app.leftMain = saved.leftMain || false;
  // Конфигурация общего челленджа всегда из кода — старое сохранение не должно блокировать обновления.
  const tpl = mockChallenges()[0];
  const main = app.challenges.find((c) => c.id === "main");
  if (!main) { if (!app.leftMain) app.challenges.unshift(tpl); }
  else {
    Object.assign(main, { title: tpl.title, goals: tpl.goals, durationDays: tpl.durationDays, buyIn: tpl.buyIn, isPublic: tpl.isPublic });
    if (Sync.enabled) main.currentDay = currentDayFromStart(main.durationDays);
  }
})();
{
  const w = store["profile.weightKg"], m = store["profile.maxReps"];
  if (store.onboarded && w > 0 && m > 0 && !app.measurements.length) app.measurements = [{ id: uid(), date: Date.now(), weight: w, maxReps: m }];
}

// ---- Смена дня: приложение может жить открытым сутками — сбрасываем «сегодня» и двигаем номер дня ----
function rolloverIfNeeded() {
  const now = dateKey();
  if (app.dayKey === now) return false;
  const from = new Date(app.dayKey + "T00:00:00").getTime();
  const diff = Math.max(1, Math.round((startOfDay(Date.now()) - from) / DAY));
  app.dayKey = now;
  for (const c of app.challenges) {
    c.myTodayReps = {};
    for (const p of c.participants) { p.doneToday = false; p.todayReps = 0; }
    if (c.id === "main" && Sync.enabled) c.currentDay = currentDayFromStart(c.durationDays);
    else if (c.startedAt) c.currentDay = Math.min(Math.floor((startOfDay(Date.now()) - startOfDay(c.startedAt)) / DAY) + 1, c.durationDays);
    else c.currentDay = Math.min(c.currentDay + diff, c.durationDays);
  }
  applySync(); // с Firebase «сегодня» пересоберётся из данных нового дня
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

// Пополнение баланса тестовыми коинами (не реальная оплата — валюта тестовая).
function buyCoins(amount) {
  app.balance += amount;
  app.transactions.unshift({ id: uid(), kind: "topup", amount, date: Date.now() });
  saveApp();
  track("coins_bought", { amount });
  closeSheet();
  toast(t("+%lld coins", amount));
}

function logEntry(title, norm, reps) {
  const today = startOfDay(Date.now());
  let last = app.history[app.history.length - 1];
  if (!last || startOfDay(last.date) !== today) { last = { id: uid(), date: today, entries: [] }; app.history.push(last); }
  const e = last.entries.find((x) => x.title === title);
  if (e) { e.reps += reps; if (norm != null) e.norm = norm; }
  else last.entries.push({ id: uid(), title, norm, reps });
}

function joinChallenge(ch, weight, maxReps, beforePhoto) {
  if (C.isJoined(ch)) return false;
  const paidKey = "fs.paid." + ch.id;
  if (!localStorage.getItem(paidKey) && !spend(ch.buyIn, ch.title)) return false;
  localStorage.setItem(paidKey, "1");
  ch.participants.unshift({ id: Sync.uid || uid(), name: "", isMe: true, state: "active", doneToday: false, todayReps: 0, _days: {}, _total: 0 });
  ch.startWeight = weight; ch.startMaxReps = maxReps; ch.beforePhoto = beforePhoto || null;
  if (ch.id === "main") Sync.join(store["profile.name"]);
  else if (ch.isPublic) Sync.joinChallenge(ch.id, store["profile.name"]);
  track("challenge_joined", { challenge_id: ch.id, buy_in: ch.buyIn, exercises: ch.goals.map((g) => g.exercise).join(",") });
  return true;
}

function createChallenge(o) {
  if (!spend(o.buyIn, o.title)) return false;
  const id = o.id || ("ch_" + (Sync.uid || "local") + "_" + Date.now().toString(36));
  app.challenges.unshift(newChallenge(Object.assign({ id, ownerId: o.isPublic ? Sync.uid : null, currentDay: 1, yesterdayDropouts: 0, startedAt: startOfDay(Date.now()), participants: [{ id: Sync.uid || uid(), name: store["profile.name"] || "", isMe: true, state: "active", doneToday: false, todayReps: 0 }] }, o)));
  localStorage.setItem("fs.paid." + id, "1");
  ui.createdChallengeId = id;
  if (o.isPublic && Sync.enabled) Sync.createChallenge(id, { title: o.title, goals: o.goals, durationDays: o.durationDays, buyIn: o.buyIn,
    missPolicy: o.missPolicy, progressionStep: o.progression.step, progressionPeriod: o.progression.period }, store["profile.name"]).then((ok) => { if (!ok) toast(t("Couldn't publish challenge")); });
  return true;
}

// Выход из челленджа: взнос НЕ возвращается, прогресс/результаты пропадают. Челлендж
// убираем из списка; общий "main" помечаем leftMain, чтобы он не вернулся при перезапуске.
function leaveChallenge(id) {
  const leaving = app.challenges.find((c) => c.id === id);
  app.challenges = app.challenges.filter((c) => c.id !== id);
  if (id === "main") app.leftMain = true;
  else if (leaving && leaving.isPublic) Sync.leaveChallenge(id).then((ok) => { if (!ok) toast(t("Couldn't leave challenge")); });
  localStorage.removeItem("fs.paid." + id);
  saveApp();
  track("challenge_left", { challenge_id: id });
}

// Плюсует подход; возвращает true, если дневная норма закрылась впервые.
function addReps(ch, counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return false;
  const me = C.me(ch);
  if (!me) return false;
  const wasDone = C.isTodayDone(ch);
  const completedBefore = new Set(ch.goals.filter((g) => (ch.myTodayReps[g.exercise] || 0) >= C.norm(ch, g)).map((g) => g.exercise));
  app.totalReps += total;
  logEntry(ch.title, C.repsNorm(ch), total);
  for (const [ex, reps] of Object.entries(counts)) if (reps > 0) {
    ch.myTodayReps[ex] = (ch.myTodayReps[ex] || 0) + reps;
    app.repsByExercise[ex] = (app.repsByExercise[ex] || 0) + reps;
  }
  ch.myTotalReps += total;
  me.todayReps = C.myTodayTotal(ch);
  if (C.isTodayDone(ch)) me.doneToday = true;
  if (ch.id === "main") Sync.report(dateKey(), ch.myTodayReps, ch.myTotalReps);
  else if (ch.isPublic) Sync.reportChallenge(ch.id, dateKey(), ch.myTodayReps, ch.myTotalReps);
  const closed = !wasDone && C.isTodayDone(ch);
  if (Sync.enabled && ch.participants.length > 1) {
    const base = { actorName: store["profile.name"] || "Player", challengeId: ch.id, challengeTitle: ch.title, dateKey: dateKey() };
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
// Зафиксировать введённое вручную число из колеса (если сейчас режим ввода) и выйти из него.
function commitWheelIfEditing() {
  if (ui.wheelEdit == null) return;
  const el = document.getElementById("wheel-input");
  if (el) {
    const key = el.dataset.wheelkey, min = +el.dataset.min, max = +el.dataset.max;
    let v = parseInt(el.value, 10);
    if (isNaN(v)) v = store[key];
    store[key] = Math.min(Math.max(v, min), max);
    storeHook(key);
  }
  ui.wheelEdit = null;
}

// ==========================================================================
// UI-состояние и рендер (см. app-ui.js — экраны ниже в этом же файле)
// ==========================================================================
const ui = { screen: "onboarding", tab: "yours", detailId: null, sheet: null, full: null, onbStep: 0, form: null, wheelEdit: null, profileSection: null };

function isGuest() { return !Sync.enabled || Sync.isAnonymous || !Sync.email; }

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const root = document.getElementById("app");
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
  if (cmd === "buyCoins" || cmd === "openBuyCoins") return "coin";
  if (cmd === "play") return "start";
  if (NAV_CMDS.includes(cmd)) return "soft";
  return "tap";
}
function render() {
  rolloverIfNeeded();
  if (ui.screen === "onboarding") { root.innerHTML = Onboarding() + (ui.full ? ui.full() : ""); afterRender(); return; }
  let html = "";
  if (ui.detailId) html = DetailScreen(ui.detailId);
  else {
    html = `<div class="screen" id="scroller">${{ yours: YoursTab, challenges: ChallengesTab, stats: StatsTab, profile: ProfileTab }[ui.tab]()}</div>`;
  }
  html += TabBar();
  if (!ui.detailId && !ui.sheet && !ui.full) html += pwaHint();
  if (ui.sheet) html += ui.sheet();
  if (ui.full) html += ui.full();
  root.innerHTML = html;
  afterRender();
}

// Навигация получает один короткий, непрерывный переход. Анимируем только новый
// контент: без копий старого экрана, задержек и конкурирующих CSS-анимаций.
let pendingViewMotion = null;
function moveView(direction) {
  pendingViewMotion = direction;
}

function motionView() {
  return document.querySelector(".create-question, .create-review, #detail-scroll, #scroller");
}

function pageTransition(direction, update) {
  const current = motionView();
  if (!current || REDUCE_MOTION() || !current.animate) {
    moveView(direction);
    update();
    render();
    return;
  }
  const ghost = document.createElement("div");
  ghost.className = "page-motion-ghost";
  const copy = current.cloneNode(true);
  const top = current.id === "scroller" ? window.scrollY : current.scrollTop;
  copy.style.transform = `translate3d(0, ${-top}px, 0)`;
  ghost.appendChild(copy);
  ghost.style.zIndex = direction === "back" ? "42" : "40";
  document.body.appendChild(ghost);

  moveView(direction);
  update();
  render();

  const endX = direction === "back" ? "100vw" : "-18vw";
  const anim = ghost.animate([
    { transform: "translate3d(0, 0, 0)", opacity: 1 },
    { transform: `translate3d(${endX}, 0, 0)`, opacity: 1 }
  ], { duration: direction === "back" ? 260 : 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" });
  anim.finished.catch(() => {}).finally(() => ghost.remove());
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

function go(tab) { moveView("tab"); ui.tab = tab; ui.detailId = null; ui.profileSection = null; render(); window.scrollTo(0, 0); }
function openDetail(id) { pageTransition("forward", () => { ui.detailId = id; }); window.scrollTo(0, 0); }
function back() { pageTransition("back", () => { ui.detailId = null; }); window.scrollTo(0, 0); }
function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = "position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#222;color:#fff;padding:12px 18px;border-radius:12px;z-index:200;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.5)";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
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
      <button class="header-icon-btn" data-act="openNotifications" aria-label="${t("Notifications")}">${icon("bell")}${unread ? `<span class="notification-count">${Math.min(unread, 9)}${unread > 9 ? "+" : ""}</span>` : ""}</button>
      ${langToggle()}</div></div>
  </div>`;
}
function langToggle() {
  const en = store.lang === "en", tag = (a, on) => `<span style="color:${on ? "#fff" : "var(--text-secondary)"}">${a}</span>`;
  return `<button class="badge" data-act="toggleLang" style="color:var(--text-secondary)">${tag("EN", en)}·${tag("RU", !en)}</button>`;
}

function TabBar() {
  const tabs = [["yours", t("Today"), "calendar"], ["challenges", t("Challenges"), "flame"], ["stats", t("Progress"), "chartBar"], ["profile", t("Profile"), "person"]];
  return `<nav class="tabbar">${tabs.map(([k, name, ic]) =>
    `<button data-act="tab:${k}" class="${ui.tab === k && !ui.detailId ? "active" : ""}">${icon(ic)}<span>${esc(name)}</span></button>`).join("")}</nav>`;
}

// ==========================================================================
// Карточка челленджа
// ==========================================================================
function ChallengeCard(c, withPlay) {
  const joined = C.isJoined(c);
  const doneBorder = joined && C.isTodayDone(c) ? "done" : "";
  const todayRows = c.goals.map((g) => {
    const reps = C.myToday(c, g.exercise), norm = C.norm(c, g), done = reps >= norm;
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

  const canPlay = joined && !C.isTodayDone(c) && !challengeEnded(c);
  const playBtn = canPlay ? (withPlay
    ? `<button data-act="play:${c.id}" style="width:44px;height:44px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center">${iconF("play")}</button>`
    : `<span style="width:44px;height:44px;border-radius:50%;background:var(--accent);color:#000;display:flex;align-items:center;justify-content:center">${iconF("play")}</span>`) : "";

  return `<div class="card challenge-card ${doneBorder}"><button class="challenge-card-main" data-act="open:${c.id}">
    <div class="between" style="align-items:flex-start">
      <div style="font-size:20px;font-weight:700">${esc(c.title)}</div>
      <div class="row gap6">${c.ownerId === Sync.uid ? badge(t("Creator"), "var(--accent)") : joined && c.isPublic ? badge(t("Joined"), "var(--money)") : ""}${joined ? streakPill(myStreak(c)) : ""}${challengeEnded(c) ? badge(t("Completed"), "var(--money)") : badge(c.isPublic ? t("Public") : t("Private"), c.isPublic ? "var(--text-secondary)" : "var(--purple)")}</div>
    </div>
    ${!joined ? `<div class="between">${lbl(C.goalsText(c))}${lbl(t("Day %lld of %lld", c.currentDay, c.durationDays))}</div>` : ""}
    ${joined ? joinedFooter : openFooter}
  </button>${playBtn ? `<div class="challenge-card-action">${playBtn}</div>` : ""}</div>`;
}

// ==========================================================================
// Вкладка «Твои»
// ==========================================================================
function YoursTab() {
  const mine = app.challenges.filter(C.isJoined);
  const active = mine.filter((c) => !challengeEnded(c));
  const nextUp = active.find((c) => !C.isTodayDone(c));

  // Блок «Сегодня» — главный вопрос пользователя: что сделать сейчас. Агрегат по активным.
  const todayReps = active.reduce((s, c) => s + C.myTodayTotal(c), 0);
  const todayNorm = active.reduce((s, c) => s + C.repsNorm(c), 0);
  const remaining = Math.max(0, todayNorm - todayReps);
  const streak = mine.length ? Math.max(0, ...mine.map((c) => myStreak(c))) : 0;
  const msLeft = startOfDay(Date.now()) + DAY - Date.now();
  const hh = Math.floor(msLeft / 3600000), mm = Math.floor((msLeft % 3600000) / 60000);
  const allDone = active.length > 0 && !nextUp;

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
      ? `<div class="action-btn" style="background:var(--white-08);color:var(--money);pointer-events:none;margin-top:4px">${iconF("checkCircle")}${t("All done for today")}</div>`
      : `<button class="action-btn" data-act="play:${nextUp.id}" style="margin-top:4px">${iconF("play")}${t("Continue workout")}</button>`}
  </div>` : "";

  const by = exerciseBreakdown();
  const exKeys = EX_ORDER.concat(Object.keys(by).filter((k) => !EX_ORDER.includes(k)));
  const exLabel = (ex) => ex === "other" ? t("Earlier reps") : Exercise.displayName(ex);
  const exRow = (ex) => { const n = by[ex] || 0; return `<div class="between" style="align-items:baseline">
    <span style="font-size:15px;${n ? "" : "color:var(--text-secondary)"}">${esc(exLabel(ex))}</span>
    <span class="money" style="font-size:15px;${n ? "font-weight:700" : "color:var(--text-secondary)"}">${n}</span></div>`; };
  const statsCard = `<div class="card" style="padding:24px 16px 18px;display:flex;flex-direction:column;gap:6px">
    <div style="text-align:center;display:flex;flex-direction:column;gap:4px">
      ${lbl(t("All-time"), "tracking-15")}
      <div class="money" style="font-size:44px">${app.totalReps}</div>
      ${lbl(t("Total reps"))}
    </div>
    <hr class="hr">
    <div style="display:flex;flex-direction:column;gap:12px">${exKeys.map(exRow).join("")}</div>
  </div>`;
  const empty = `<div class="card center" style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:14px">
    ${icon("flame", "")}
    <div class="secondary" style="font-weight:500">${t("You're not in any challenge yet. Join one and put some coins on the line.")}</div>
    <button class="action-btn" data-act="findChallenge">${icon("search")}${t("Find a challenge")}</button>
    <button class="text-btn" data-act="demo">${t("Try a demo workout")}</button>
  </div>`;
  return screenHeader(t("Today")) + `<div class="stack">
    ${todayHero}
    ${mine.length ? mine.map((c) => ChallengeCard(c, true)).join("") : empty}
    ${mine.length ? statsCard : ""}
    <button class="action-btn" data-act="invite" style="background:var(--white-08);color:#fff">${icon("share")}${t("Invite friends")}</button>
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
    <span style="flex:1;font-weight:600;font-size:15px">${t("%lld in FitStake", list.length)}</span>
    <span class="secondary" style="display:flex">${icon("chevronRight")}</span></button>`;
}
function FriendsSheet() {
  const list = friendsList();
  const relDate = (ts) => {
    if (!ts) return "";
    const diff = startOfDay(Date.now()) - startOfDay(ts);
    if (diff <= 0) return t("today");
    if (diff === DAY) return t("yesterday");
    return new Date(ts).toLocaleDateString(store.lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
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
  return new Date(ts).toLocaleDateString(store.lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
}
function NotificationsSheet() {
  const events = sharedActivity();
  const rows = events.map((e) => {
    const message = e.type === "day"
      ? t("%@ completed today's challenge in %@", e.actorName || "?", e.challengeTitle || "?")
      : t("%@ completed %@ in %@", e.actorName || "?", Exercise.displayName(e.exercise), e.challengeTitle || "?");
    return `<button class="entry-row" data-act="notification:${e.challengeId}" style="width:100%;text-align:left;align-items:flex-start">
      <div class="avatar" style="background:rgba(77,194,128,.14);color:var(--money)">${icon(e.type === "day" ? "check" : "bolt")}</div>
      <span style="flex:1"><span style="display:block;font-size:14px;line-height:1.35">${esc(message)}</span><span class="secondary" style="display:block;font-size:12px;margin-top:4px">${relativeActivityTime(e.ts)}</span></span>
    </button>`;
  }).join("");
  return sheetShell(t("Notifications"), rows || `<div class="card card-soft center secondary" style="padding:24px">${t("No notifications yet")}</div>`, true);
}

// ==========================================================================
// Вкладка «Челленджи»
// ==========================================================================
function ChallengesTab() {
  const syncState = Sync.enabled && !Sync.state.ready ? `<div class="card card-soft center" style="padding:14px"><span class="secondary">${t("Loading public challenges…")}</span></div>`
    : Sync.state.error ? `<div class="card center" style="padding:14px;border-color:var(--red)"><span>${t("Couldn't load public challenges. Check connection.")}</span></div>` : "";
  return screenHeader(t("Challenges")) + `<div class="stack">
    ${syncState}
    ${app.challenges.map((c) => ChallengeCard(c, false)).join("")}
    <button class="action-btn" data-act="create">${icon("plus")}${t("Create Challenge")}</button>
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
    const inviteBtn = `<button class="action-btn" data-act="invite" style="background:var(--white-08);color:#fff">${icon("share")}${t("Invite friends")}</button>`;
    const leaveBtn = `<button class="action-btn" data-act="askLeave:${c.id}" style="background:transparent;color:var(--red);box-shadow:none">${t("Leave challenge")}</button>`;
    body = ended ? [
      finaleCard(c), totalCard(c), participantsCard(c), potCard(c), rulesCard(c),
      c.beforePhoto ? beforeAfterCard(c) : "", inviteBtn, leaveBtn,
    ].join("") : [
      totalCard(c), todayCard(c),
      C.isFinished(c) ? `<button class="action-btn money" data-act="showResult:${c.id}">${iconF("trophy")}${t("Show result")}</button>` : "",
      callToAction(c), inviteBtn,
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
  let inner;
  if (c.goals.length === 1) {
    const g = c.goals[0], reps = C.myToday(c, g.exercise), norm = C.norm(c, g), d = reps >= norm;
    inner = `<div class="between" style="align-items:baseline">${lbl(t("Today"), "tracking-1")}<span class="money ${d ? "c-money" : "c-white"}" style="font-size:24px">${reps} / ${norm}</span></div>${bar(reps / norm, d)}`;
  } else {
    const rings = c.goals.map((g) => {
      const reps = C.myToday(c, g.exercise), norm = C.norm(c, g), d = reps >= norm;
      return progressRing(c.id, g, reps, norm, d);
    }).join("");
    inner = lbl(t("Today"), "tracking-1") + `<div style="display:flex;gap:8px;align-items:flex-start;padding-top:4px">${rings}</div>`;
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
    return `<button class="action-btn ${done ? "money" : ""}" data-act="${act}">${iconF(done ? "plusCircle" : "flame")}${done ? t("Extra reps") : C.actionText(c)}</button>`;
  }
  return `<button class="action-btn" data-act="join:${c.id}">${t("Join for")} ${coin(c.buyIn)}</button>`;
}
// Лист выбора «с чего начать» для комбо: строки-упражнения, тап → запуск именно его.
function StartPicker() {
  const c = app.challenges.find((x) => x.id === ui.form.challengeId);
  if (!c) return "";
  const rows = c.goals.map((g) => {
    const reps = C.myToday(c, g.exercise), norm = C.norm(c, g), done = reps >= norm;
    return `<button class="picker-row" data-act="play:${c.id}:${g.exercise}">
      <span class="row gap12"><span style="display:flex;color:var(--accent)">${exIcon(g.exercise)}</span><span style="font-weight:600;font-size:16px">${esc(Exercise.displayName(g.exercise))}</span></span>
      <span class="row gap12"><span class="money ${done ? "c-money" : "secondary"}" style="font-size:15px">${reps} / ${norm}</span><span style="color:var(--accent);display:flex">${iconF("play")}</span></span>
    </button>`;
  }).join("");
  return sheetShell(t("Where to start?"), `<div class="picker-list">${rows}</div>`, true);
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
    <button class="action-btn" data-act="confirmLeave:${c.id}" style="background:var(--red);color:#fff">${t("Leave")}</button>
    <button class="action-btn" data-act="closeSheet" style="background:var(--white-08);color:#fff">${t("Cancel")}</button>`;
  return sheetShell(t("Leave challenge?"), body, true);
}

// Разделы и типовые проблемы для отчёта тестера — под реальные экраны FitStake.
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

// Магазин коинов: тестовые пакеты (реальной оплаты нет — валюта тестовая).
const COIN_PACKS = [500, 1500, 5000];
function BuyCoinsSheet() {
  const rows = COIN_PACKS.map((n) => `<button class="action-btn" data-act="buyCoins:${n}" style="background:var(--white-08);color:#fff;justify-content:space-between">
    <span class="row gap8"><span style="color:var(--money);display:flex">${iconF("plusCircle")}</span>${fmt(n)} ${t("coins")}</span>
    <span class="c-money money" style="font-size:16px">+${fmt(n)}</span></button>`).join("");
  return sheetShell(t("Buy coins"), `<div class="form-footer">${t("Test currency — no real money.")}</div><div class="stack">${rows}</div>`, true);
}
function openBuyCoins() { ui.sheet = BuyCoinsSheet; render(); }

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
    return `<div ${tappable ? `data-act="participant:${p.id}" ` : ""}class="row gap12" style="opacity:${p.state === "eliminated" ? 0.45 : 1}${tappable ? ";cursor:pointer" : ""}">
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
function StatsTab() {
  const joined = app.challenges.filter(C.isJoined);
  const dot = (color, title) => `<div class="row gap8"><span class="chart-dot" style="background:${color}"></span><span class="label" style="font-size:11px;letter-spacing:1px">${esc(title)}</span></div>`;

  // Пустое состояние: пока нет ни одной завершённой тренировки — объясняем, как получить данные.
  const hasData = app.history.some((d) => d.entries && d.entries.length);
  if (!hasData) return screenHeader(t("Progress")) + `<div class="stack">
    <div class="card center" style="padding:36px 22px;display:flex;flex-direction:column;align-items:center;gap:14px">
      <span style="color:var(--accent);display:flex">${icon("trend")}</span>
      <div class="secondary" style="font-weight:500;text-align:center;max-width:280px;font-size:15px">${t("Complete your first workout and your weekly trend will appear here.")}</div>
    </div></div>`;

  // Суммы по календарным дням: в истории бывают пропуски, слайс «по записям» сдвигал графики
  const byDay = new Map(app.history.map((d) => [startOfDay(d.date), d.entries.reduce((s, e) => s + e.reps, 0)]));
  const today0 = startOfDay(Date.now());
  const series = (n) => { const out = []; for (let back = n - 1; back >= 0; back--) out.push(byDay.get(today0 - back * DAY) || 0); return out; };

  // Недельный объём
  const padded = series(28);
  const weeks = [0, 1, 2, 3].map((w) => padded.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0));

  // Активность по дням
  const days = series(30).map((reps, i) => ({ date: today0 - (29 - i) * DAY, reps }));

  // Выводы: превращаем цифры в мотивацию вместо голых графиков.
  const loc = store.lang === "ru" ? "ru-RU" : "en-US";
  const thisWeek = weeks[3], lastWeek = weeks[2];
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

  const weeklyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:4px">
    ${dot("var(--money)", t("Weekly volume"))}
    <div class="form-footer">${t("Total reps over the last 4 weeks.")}</div>
    ${weeklyChart(weeks)}</div>`;
  const dailyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:4px">
    ${dot("var(--accent)", t("Daily activity — 30 days"))}
    <div class="form-footer">${t("Each bar is one day.")}</div>
    ${dailyChart(days)}</div>`;

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
  let journal = lbl(t("Exercise journal"), "tracking-1") + dayChip(t("Today"));
  journal += joined.map((c) => entryRow(c.title, C.myTodayTotal(c), C.repsNorm(c), C.isTodayDone(c))).join("");
  journal += todayPractice.map((e) => entryRow(t("Practice"), e.reps, null, false)).join("");
  for (const d of past) {
    journal += dayChip(new Date(d.date).toLocaleDateString(store.lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" }));
    journal += d.entries.map((e) => entryRow(e.title || t("Practice"), e.reps, e.norm, e.norm != null && e.reps >= e.norm)).join("");
  }
  const journalCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">${journal}</div>`;

  return screenHeader(t("Progress")) + `<div class="stack">${insightsCard}${weeklyCard}${dailyCard}${journalCard}</div>`;
}
function weeklyChart(weeks) {
  const W = 300, H = 150, pad = 20, max = Math.max(...weeks, 1);
  const xs = weeks.map((_, i) => pad + i * ((W - pad * 2) / 3));
  const ys = weeks.map((v) => H - 12 - (v / max) * (H - 30));
  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4dc280" stop-opacity="0.35"/><stop offset="1" stop-color="#4dc280" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#wg)"/>
    <path d="${line}" fill="none" stroke="#4dc280" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${xs.map((x, i) => `<text x="${x}" y="${H + 14}" fill="rgba(255,255,255,.55)" font-size="10" font-family="monospace" text-anchor="middle">${t("Week %lld", i + 1)}</text>`).join("")}
  </svg>`;
}
function dailyChart(days) {
  const W = 300, H = 150, pad = 6, max = Math.max(...days.map((d) => d.reps), 1);
  const bw = (W - pad * 2) / days.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5e1f"/><stop offset="1" stop-color="#ff5e1f" stop-opacity="0.2"/></linearGradient></defs>
    ${days.map((d, i) => {
      const h = (d.reps / max) * (H - 10);
      return `<rect x="${(pad + i * bw + bw * 0.2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="url(#dg)"/>`;
    }).join("")}
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
        <span style="font-size:15px">${new Date(m.date).toLocaleDateString(store.lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
        <span class="row gap6"><span class="money secondary" style="font-size:14px">${t("%lld kg", m.weight)}</span><span class="secondary">·</span><span class="money" style="font-size:14px">${m.maxReps}</span></span></div>`).join("")}
  </div>`;

  let photosInner;
  if (withPhotos.length === 0) photosInner = `<div class="form-footer">${t("Photos appear here once you join a challenge with a BEFORE photo.")}</div>`;
  else if (photosUnlocked) photosInner = withPhotos.map((c) => `<div style="display:flex;flex-direction:column;gap:8px">
    <div style="font-weight:600;font-size:15px">${esc(c.title)}</div>
    <div class="grid2">${photoSlot(c.beforePhoto, t("Before"))}${photoSlot(c.afterPhoto, t("After"))}</div></div>`).join("");
  else photosInner = `<button class="action-btn" data-act="unlockPhotos" style="background:var(--white-08);color:#fff">${t("Show photos")}</button>`;
  const photosCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    ${lbl(t("Before / After photos"), "tracking-1")}
    ${photosInner}</div>`;

  const txLabel = (tx) => tx.kind === "start" ? t("Starting balance") : tx.kind === "topup" ? t("Coins purchased") : t("Buy-in: %@", esc(tx.challenge));
  const wallet = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="between">${lbl(t("Balance"), "tracking-1")}<span class="c-money" style="font-size:24px">${coinCountUp(app.balance, "balance")}</span></div>
    <div class="form-footer">${t("Test currency — no real money.")}</div>
    <button class="action-btn" data-act="openBuyCoins">${icon("plus")}${t("Buy coins")}</button>
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
    <button class="action-btn" data-act="openBug" style="background:var(--white-08);color:#fff">${icon("bug")}${t("Report a problem")}</button>
  </div>`;

  // Приватность и данные — честный текст о том, что происходит с видео/фото/замерами.
  const privacyRow = (txt) => `<div class="row gap8" style="align-items:flex-start"><span style="color:var(--money);font-weight:800">✓</span><span style="font-size:14px;line-height:1.45">${esc(txt)}</span></div>`;
  const privacyCard = `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
    ${lbl(t("Privacy & data"), "tracking-1")}
    ${privacyRow(t("Video is processed on your device by the camera — not recorded and not sent to any server."))}
    ${privacyRow(t("Before / After photos are stored on your device — the app doesn't upload them to our servers."))}
    ${privacyRow(t("Weight and measurements stay on this device."))}
    ${privacyRow(t("Nothing is used to train any models."))}
    <div class="form-footer">${t("Test currency — no real money.")}</div>
  </div>`;

  // Профиль разбит на разделы: меню → раздел. Крупный экран не смешивает разные сущности.
  const sections = {
    body: [t("Body & measurements"), bodyCard + measurements + photosCard],
    wallet: [t("Wallet"), wallet],
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
    ${row("wallet", t("Wallet"))}
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
  return `<button class="action-btn" data-act="googleAuth" style="background:#fff;color:#1f1f1f">${t("Continue with Google")}</button>
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
// Короткий онбординг: имя → упражнение → уровень → тест-максимум → норма → вход.
// Пол/возраст/рост/вес не влияют на норму и запрашиваются позже в Body & measurements.
const SYNC_ON = !!(window.Sync && window.Sync.enabled);
const LAST_STEP = SYNC_ON ? 6 : 5;
const STEP = {
  name: 1, startExercise: 2, fitness: 3, maxReps: 4, goal: 5,
  auth: SYNC_ON ? 6 : -1,
};
function Onboarding() {
  const step = ui.onbStep, level = store["profile.level"], maxReps = store["profile.maxReps"], startEx = store["profile.startExercise"];

  const optionCard = (title, subtitle, selected, act) =>
    `<button class="card ${selected ? "selected" : ""}" data-act="${act}" style="padding:16px;width:100%;display:flex;align-items:center;gap:10px;text-align:left">
      <div style="flex:1"><div class="display" style="font-size:20px">${esc(title)}</div>${subtitle ? `<div class="form-footer" style="margin-top:2px">${esc(subtitle)}</div>` : ""}</div>
      <span style="color:${selected ? "var(--accent)" : "var(--text-secondary)"};display:flex">${selected ? iconF("checkCircle") : icon("plusCircle").replace("M12 8v8M8 12h8", "")}</span>
    </button>`;
  const question = (title, subtitle, content) => `<div class="create-question">
    <div class="display" style="font-size:30px">${esc(title)}</div>${subtitle ? `<div class="form-footer">${esc(subtitle)}</div>` : ""}
    <div class="create-question-content">${content}</div></div>`;
  const wheel = (key, min, max, fmtFn) => {
    // Ручной ввод: тап по «123» открывает поле с клавиатурой.
    if (ui.wheelEdit === key) {
      return `<div class="wheel-wrap">
        <input class="field wheel-input" id="wheel-input" type="number" inputmode="numeric" aria-label="${t("Max reps in one set")}" min="${min}" max="${max}" value="${store[key]}" data-wheelkey="${key}" data-min="${min}" data-max="${max}">
        <button class="action-btn" data-act="wheelDone" style="margin-top:14px">${t("Done")}</button>
      </div>`;
    }
    let opts = "";
    for (let v = min; v <= max; v++) opts += `<div class="opt ${v === store[key] ? "active" : ""}" data-val="${v}">${esc(fmtFn(v))}</div>`;
    return `<div class="wheel-wrap">
      <div class="wheel" data-wheel="${key}" data-min="${min}" data-max="${max}"><div class="pad"></div>${opts}<div class="pad"></div></div>
      <button class="wheel-edit-btn" data-act="wheelEdit:${key}" aria-label="${t("Enter manually")}">123</button>
    </div>`;
  };

  let content;
  if (step === 0) content = `<div class="center" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
    <div style="color:var(--accent);width:76px;height:76px;display:flex">${iconF("flame")}</div>
    <div class="display" style="font-size:46px">FitStake</div>
    <div class="form-footer" style="max-width:320px;font-weight:500">${t("Every rep is verified by the camera. Coins on the line. Miss too many days and you're out.")}</div></div>`;
  // Вход — последний шаг, перед сохранением прогресса (только с Firebase).
  else if (step === STEP.auth) content = question(t("Create your account"), t("So your progress is saved and syncs across your devices."), authForm());
  else if (step === STEP.name) content = question(t("Your name"), t("Friends will see it in the leaderboard."),
    `<input class="field" id="onb-name" value="${esc(store["profile.name"] || "")}" placeholder="${esc(t("Your name"))}" aria-label="${esc(t("Your name"))}" maxlength="20" autocomplete="name">`);
  else if (step === STEP.startExercise) content = question(t("Which exercise do you want to start with?"), null, EX_ORDER.map((ex) => optionCard(Exercise.displayName(ex), null, startEx === ex, `onbSet:profile.startExercise:${ex}`)).join(""));
  else if (step === STEP.fitness) content = question(t("Your fitness level"), null, Level.all.map((l) => optionCard(Level.name(l), Level.subtitle(l), level === l, `onbSet:profile.level:${l}`)).join(""));
  else if (step === STEP.maxReps) content = question(t("How many %@ can you do in one set?", Exercise.displayName(startEx)), t("Honestly — the daily goal is built from this."), wheel("profile.maxReps", 1, 120, (v) => String(v)));
  // Итоговый шаг: дневная норма с объяснением и выбором нагрузки.
  else {
    const choice = store.goalChoice || "recommended";
    const goalC = goalForChoice(level, maxReps, choice);
    const segBtn = (val, label) => `<button data-act="goalChoice:${val}" class="${choice === val ? "active" : ""}">${esc(label)}</button>`;
    content = `<div class="center" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
    ${lbl(t("Your daily goal"), "tracking-15")}
    <div class="money" style="font-size:72px">${goalC}</div>
    ${lbl(t("reps per day"), "tracking-1")}
    <div class="segmented" style="margin-top:14px;width:100%">${segBtn("easier", t("Easier"))}${segBtn("recommended", t("Recommended"))}${segBtn("harder", t("Harder"))}</div>
    <div class="form-footer" style="margin-top:12px;text-align:center;max-width:320px">${t("Your max is %lld reps. %@ level → %lld working sets.", maxReps, Level.name(level), Level.sets(level))}</div>
    <div class="card" style="padding:16px;width:100%;display:flex;flex-direction:column;gap:10px;margin-top:16px">
      ${[[t("Exercise"), Exercise.displayName(startEx)], [t("Max reps in one set"), maxReps], [t("Fitness level"), Level.name(level)]]
        .map(([k, v]) => `<div class="between">${lbl(k)}<span style="font-weight:600;font-size:15px">${esc(v)}</span></div>`).join("")}
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
    ? `<div style="padding:0 20px 8px;padding-bottom:calc(8px + env(safe-area-inset-bottom))"><button class="action-btn" data-act="saveChallenge">${t("Create challenge")}</button></div>`
    : `<div style="padding:0 20px 8px;padding-bottom:calc(8px + env(safe-area-inset-bottom))"><button class="action-btn" data-act="createNext">${f.editingFromReview ? t("Save changes") : label}</button></div>`;

  return `<div class="fullscreen"><div style="min-height:100dvh;display:flex;flex-direction:column">
    <div class="row gap12" style="padding:max(10px,env(safe-area-inset-top)) 20px 16px;align-items:center">
      <button data-act="createBack" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#fff">${icon(step > 0 ? "chevronLeft" : "xmark")}</button>
      <div style="flex:1">${bar(step / CREATE_LAST)}</div>
    </div>
    <div style="flex:1;padding:0 24px;overflow-y:auto">${content}</div>
    ${footer}
  </div></div>`;
}

// Собрать goals из выбранных упражнений и создать челлендж. false — если нечем оплатить/ничего не выбрано.
function saveChallengeForm() {
  const f = ui.form, sel = selectedExercises(f);
  if (!sel.length) { toast(t("Pick at least one exercise")); return false; }
  const clamp = (n) => Math.min(Math.max(n, 1), 500);
  const goals = sel.map((e) => ({ exercise: e, repsPerDay: clamp(f[e]) }));
  const ok = createChallenge({ title: f.title.trim() || defaultTitle(f), goals, durationDays: Math.min(Math.max(f.duration, 1), 365), buyIn: Math.max(f.buyIn, 0), isPublic: f.isPublic, missPolicy: f.miss, progression: f.progOn ? { step: f.progStep, period: f.progPeriod } : { step: 0, period: "day" } });
  if (!ok) { toast(t("Not enough coins")); return false; }
  return true;
}
function ChallengeCreatedFull() {
  const c = app.challenges.find((x) => x.id === ui.createdChallengeId);
  if (!c) return "";
  return `<div class="fullscreen"><div class="celebrate">
    <div class="prep-hero">${iconF("checkCircle")}</div>
    <div class="display" style="font-size:34px">${t("Challenge created")}</div>
    <div class="secondary" style="text-align:center">${esc(c.title)}<br>${t("Invite people now or share it later from the challenge page.")}</div>
    <div class="spacer"></div>
    <button class="action-btn" data-act="shareCreated">${icon("share")}${t("Share invite")}</button>
    <button class="action-btn" data-act="copyCreated" style="background:var(--white-08);color:#fff">${t("Copy link")}</button>
    <button class="text-btn" data-act="openCreated">${t("Open challenge")}</button>
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
  const colors = ["#ff5e1f", "#4dc280", "#ffd60a", "#fff", "#a855f7"];
  let s = "";
  for (let i = 0; i < 44; i++) {
    const x = (i * 37) % 100, delay = ((i * 13) % 9) / 10, dur = 1.6 + ((i * 7) % 12) / 10;
    s += `<i style="left:${x}%;background:${colors[i % colors.length]};animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
  }
  return `<div class="confetti">${s}</div>`;
}
function DayCompleteFull() {
  const c = app.challenges.find((x) => x.id === ui.fullId);
  return `<div class="fullscreen">${confetti()}<div class="celebrate">
    <div class="c-money pop-in" style="font-size:84px;display:flex">${iconF("seal")}</div>
    <div class="display" style="font-size:42px">${t("Day done!")}</div>
    <div class="form-footer" style="max-width:360px">${t("%lld reps today. Day %lld of %lld in the bag.", C.myTodayTotal(c), c.currentDay, c.durationDays)}</div>
    <div style="flex:0"></div>
    <button class="action-btn" data-act="shareDay:${c.id}" style="max-width:320px">${iconF("share")}${t("Share")}</button>
    <button class="text-btn" data-act="closeFull">${t("Close")}</button>
  </div></div>`;
}
function ChallengeCompleteFull() {
  const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
  const weightChange = c.startWeight != null ? `${c.startWeight} → ${f.weight} ${t("kg")} (${f.weight - c.startWeight > 0 ? "+" : ""}${f.weight - c.startWeight})` : t("%lld kg", f.weight);
  const maxChange = c.startMaxReps != null ? `${c.startMaxReps} → ${f.maxReps} (${f.maxReps - c.startMaxReps > 0 ? "+" : ""}${f.maxReps - c.startMaxReps})` : String(f.maxReps);
  return `<div class="fullscreen">${confetti()}<div class="screen" style="padding-top:24px;display:flex;flex-direction:column;gap:18px;align-items:center;text-align:center">
    <div class="c-money pop-in" style="font-size:76px;display:flex">${iconF("trophy")}</div>
    <div class="display" style="font-size:34px">${t("Challenge complete!")}</div>
    <div class="row gap6">${lbl(t("You take home"))}<span class="c-money money" style="font-size:22px">${coinCountUp(C.payout(c), "winPayout", true)}</span></div>

    <div class="card" style="padding:16px;width:100%;display:flex;flex-direction:column;gap:12px;text-align:left">
      ${lbl(t("Before / After"), "tracking-1")}
      <div class="grid2">
        <div style="display:flex;flex-direction:column;gap:6px"><div class="photo-slot" style="height:190px">${c.beforePhoto ? `<img src="${c.beforePhoto}" alt="${t("Before")}">` : icon("camera")}</div>${lbl(t("Before"))}</div>
        <div style="display:flex;flex-direction:column;gap:6px"><div class="photo-slot accent" style="height:190px">${f.photo ? `<img src="${f.photo}" alt="${t("After")}">` : iconF("camera")}</div>${lbl(t("After"))}</div>
      </div>
      <div class="row gap12">
        <button class="action-btn" data-act="pickPhoto:camera" style="background:var(--white-08);color:#fff;font-size:14px">${iconF("camera")}${f.photo ? t("Retake") : t("Take a photo")}</button>
        <button class="action-btn" data-act="pickPhoto:library" style="background:var(--white-08);color:#fff;font-size:14px">${iconF("photo")}${t("Upload from library")}</button>
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
// Сессия с камерой (живёт вне цикла render, чтобы не рвать видеопоток)
// ==========================================================================
const CAN_RECORD = typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
let liveSession = null;

async function openSession(challengeId, startExercise) {
  const isDemo = challengeId === "demo";
  const c = isDemo ? null : app.challenges.find((x) => x.id === challengeId);
  if ((!isDemo && !c) || liveSession) return;
  const goals = isDemo
    ? [{ exercise: startExercise || "pushups", target: 5, start: 0 }]
    : c.goals.map((g) => ({ exercise: g.exercise, target: C.norm(c, g), start: C.myToday(c, g.exercise) }));

  const overlay = document.createElement("div");
  overlay.className = "session";
  overlay.innerHTML = `
    <video autoplay muted playsinline></video>
    <canvas class="skeleton"></canvas>
    <div class="topbar">
      <div class="between" style="align-items:flex-start">
        <button class="cam-btn" data-sess="close" aria-label="${t("Close")}">${icon("xmark")}</button>
        <div class="cam-col">
          ${CAN_RECORD ? `<button class="cam-btn" data-sess="record" aria-label="${t("Record video")}">${icon("record")}</button>` : ""}
        </div>
      </div>
      <div class="hint" id="sess-hint"></div>
    </div>
    <div class="sess-countdown" id="sess-countdown" aria-live="assertive"></div>
    <div class="hud"><div id="sess-counters"></div><div id="sess-bottom" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px"></div></div>`;
  document.body.appendChild(overlay);

  const video = overlay.querySelector("video");
  const canvas = overlay.querySelector(".skeleton");
  const hintEl = overlay.querySelector("#sess-hint");
  const countdownEl = overlay.querySelector("#sess-countdown");
  const countersEl = overlay.querySelector("#sess-counters");
  const bottomEl = overlay.querySelector("#sess-bottom");

  // Комбо теперь последовательное: активно одно упражнение за раз, счётчик показываем один.
  // startExercise — с какого упражнения начать (кнопка play у строки / выбор с большой кнопки).
  const combo = goals.length > 1;
  let active = 0;
  if (startExercise) { const i = goals.findIndex((g) => g.exercise === startExercise); if (i >= 0) active = i; }

  const sess = new window.PoseSession(goals.map((g) => g.exercise));
  sess.setActive(active);
  liveSession = { sess, overlay };

  // Индикатор загрузки: перекрывает экран, пока открывается камера и грузится MediaPipe.
  const loader = document.createElement("div");
  loader.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:20;background:rgba(0,0,0,.55)";
  loader.innerHTML = `<div class="spinner"></div><div style="color:#fff;font-weight:600">${t("Preparing workout…")}</div>`;
  overlay.appendChild(loader);

  try {
    await sess.start(video, canvas);
    loader.remove();
  } catch (err) {
    // Ошибка камеры/модели: завершаем сессию, чистим и предлагаем повтор — приложение не виснет.
    sess.stop();
    overlay.remove();
    liveSession = null;
    showCameraError(cameraError(err), challengeId, startExercise);
    return;
  }

  const totalFor = (g, r) => g.start + (r ? r.repCount : 0);
  const resultFor = (ex) => sess.snapshot.results.find((r) => r.exercise === ex);

  // Один счётчик — активного упражнения. В комбо над ним подпись «Упражнение · N/всего».
  let prevTotal = -1;
  function renderCounter() {
    const g = goals[active];
    const hasPrev = combo && active > 0, hasNext = combo && active < goals.length - 1;
    countersEl.className = "counter-col";
    countersEl.innerHTML = `
      <span class="cap">${esc(Exercise.displayName(g.exercise))}${combo ? ` • ${active + 1}/${goals.length}` : ""}</span>
      <div class="count-line">
        <span class="counter-big c-white" id="sess-num">${totalFor(g, resultFor(g.exercise))}</span>
        ${g.target != null ? `<span class="count-target">/ ${g.target}</span>` : ""}
      </div>
      ${hasPrev || hasNext ? `<div class="sess-nav">
        ${hasPrev ? `<button data-sess="prev">${icon("chevronLeft")}${esc(Exercise.displayName(goals[active - 1].exercise))}</button>` : ""}
        ${hasNext ? `<button data-sess="next">${esc(Exercise.displayName(goals[active + 1].exercise))}${icon("chevronRight")}</button>` : ""}
      </div>` : ""}`;
    prevTotal = totalFor(g, resultFor(g.exercise)); // сброс, чтобы пульс не сработал при смене упражнения
  }
  renderCounter();
  let prevGoalReached = false, prevBottomKey = "", prevTracked = false, lastWarnTs = 0;
  let countingStarted = false, readySince = 0, countdownShown = 0, demoFinishing = false;

  function resetReadyState() {
    countingStarted = false;
    readySince = 0;
    countdownShown = 0;
    countdownEl.textContent = "";
    countdownEl.classList.remove("show");
    sess.setCountingEnabled(false);
  }

  // Плашка-уведомление поверх камеры («Push-ups completed» и т.п.) — короткая, ~1.5 с.
  function flashPlate(text) {
    const p = document.createElement("div");
    p.style.cssText = "position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);background:rgba(0,0,0,.72);color:#fff;font-weight:800;font-size:22px;padding:16px 24px;border-radius:16px;z-index:30;pointer-events:none;text-align:center";
    p.textContent = text;
    overlay.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }

  function loop() {
    if (liveSession !== undefined && liveSession && liveSession.sess === sess) {
      const results = sess.snapshot.results;
      const sessionTotal = results.reduce((s, r) => s + r.repCount, 0);
      const g = goals[active], ar = resultFor(g.exercise), total = totalFor(g, ar);
      const curReached = g.target != null && total >= g.target;
      const allReached = goals.every((x) => x.target != null && totalFor(x, resultFor(x.exercise)) >= x.target);

      // Счётчик активного упражнения
      const numEl = countersEl.querySelector("#sess-num");
      if (numEl) {
        numEl.textContent = total;
        const cls = curReached ? "c-money" : (ar && ar.status === "down" ? "c-accent" : "c-white");
        numEl.className = numEl.className.replace(/c-(money|accent|white)/, cls);
        // Новый засчитанный повтор: один звук по приоритету workout > exercise > milestone > rep.
        // На повторе, закрывающем упражнение/тренировку, обычный rep/milestone не звучит.
        if (total > prevTotal && total > 0) {
          const milestone = total % 10 === 0;
          const justReached = curReached && !prevGoalReached;
          const event = justReached ? (allReached ? "workout" : "exercise") : (milestone ? "milestone" : "rep");
          wsfxMain(event);
          haptic(event === "rep" ? 12 : [0, 40, 40, 90]);
          if (justReached) flashPlate(t("%@ completed", Exercise.displayName(g.exercise)));
          if (isDemo && allReached && !demoFinishing) {
            demoFinishing = true;
            setTimeout(() => { if (liveSession && liveSession.sess === sess) endSession(true); }, 700);
          }
        }
        prevTotal = total;
      }

      // Сначала стабильно находим тело, затем даём человеку 3 секунды занять позицию.
      const tracked = !!(ar && (ar.status === "up" || ar.status === "down"));
      const now = performance.now();
      if (!countingStarted) {
        if (!tracked) {
          readySince = 0;
          countdownShown = 0;
          countdownEl.textContent = "";
          countdownEl.classList.remove("show", "word");
        } else {
          if (!readySince) readySince = now;
          const elapsed = now - readySince;
          if (elapsed >= 500) {
            const n = 3 - Math.floor((elapsed - 500) / 1000);
            if (n > 0 && n !== countdownShown) {
              countdownShown = n;
              countdownEl.textContent = String(n);
              countdownEl.classList.remove("word");
              countdownEl.classList.add("show");
              sfx("tick");
            } else if (n <= 0) {
              countingStarted = true;
              sess.setCountingEnabled(true);
              countdownEl.textContent = t("Go!");
              countdownEl.classList.toggle("word", t("Go!").length > 4);
              setTimeout(() => countdownEl.classList.remove("show"), 650);
            }
          }
        }
      }

      // Плашка нужна только пока камера не готова. Во время нормального счёта
      // она исчезает, чтобы текст не мелькал над человеком на каждом движении.
      let hint;
      if (!ar || ar.status === "noBody") hint = t("Step into frame");
      else if (!tracked) hint = g.exercise === "squats" ? t("Both legs must be fully in frame") : t("Both arms must be fully in frame");
      else if (!countingStarted) hint = t("Body found — hold still");
      else hint = null;
      hintEl.style.display = hint ? "" : "none";
      hintEl.textContent = hint || "";
      // Пользователь вышел из кадра (был в кадре → пропал): короткий warning, не чаще раза в 4 с.
      if (prevTracked && !tracked && total > 0) {
        const nowTs = performance.now();
        if (nowTs - lastWarnTs > 4000) { wsfx("warning"); lastWarnTs = nowTs; }
      }
      prevTracked = tracked;

      // Нижняя панель: угол текущего упражнения + кнопка Завершить/Готово (переключение упражнений — в блоке счётчика)
      const angle = ar && ar.bendAngle != null ? Math.round(ar.bendAngle) : null;
      const key = `${curReached}|${allReached}|${sessionTotal > 0}|${angle}`;
      if (key !== prevBottomKey) {
        prevBottomKey = key;
        let b = angle != null ? `<span class="angle">${angle}°</span>` : "";
        if (allReached) b += `<button class="action-btn money" data-sess="finish" style="max-width:340px">${iconF("checkCircle")}${t("Finish")}</button>`;
        else if (sessionTotal > 0) b += `<button class="action-btn" data-sess="finish" style="max-width:340px">${icon("check")}${t("Done")}</button>`;
        bottomEl.innerHTML = b;
      }
      prevGoalReached = curReached;
    }
    if (liveSession && liveSession.sess === sess) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  let finishing = false;
  // Завершение сессии. save=true — засчитать повторы; в обоих случаях активная запись
  // авто-сохраняется, чтобы видео не терялось. Двойное сохранение исключено флагом finishing.
  async function endSession(save) {
    if (finishing) return;
    finishing = true;
    const counts = {};
    sess.snapshot.results.forEach((r) => (counts[r.exercise] = r.repCount));
    if (sess.isRecording()) { try { await sess.toggleRecording(); } catch (e) { wsfx("recError"); } }
    if (save) {
      if (isDemo) {
        sess.stop(); overlay.remove(); liveSession = null;
        openDemoComplete(Object.values(counts).reduce((sum, n) => sum + n, 0));
        return;
      }
      let closed;
      try { closed = addReps(c, counts); }
      catch (e) { finishing = false; toast(t("Couldn't save. Try again.")); return; } // разблокируем — можно повторить
      sess.stop(); overlay.remove(); liveSession = null;
      render();
      if (closed) { C.isFinished(c) ? openChallengeComplete(c) : openDayComplete(c); }
    } else {
      sess.stop(); overlay.remove(); liveSession = null;
    }
  }

  // Крестик: если есть засчитанные повторы — спрашиваем; иначе закрываем сразу.
  function askExit() {
    const done = sess.snapshot.results.reduce((s, r) => s + r.repCount, 0);
    if (done <= 0) { endSession(false); return; }
    if (overlay.querySelector(".sess-modal")) return;
    const dlg = document.createElement("div");
    dlg.className = "sess-modal";
    dlg.style.cssText = "position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.6)";
    dlg.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--card,#1a1a1a);border-radius:20px;padding:22px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;text-align:center">
      <div style="font-weight:800;font-size:20px">${t("Finish workout?")}</div>
      <div style="color:var(--text-secondary);font-size:15px;margin-bottom:6px">${t("Save completed reps?")}</div>
      <button class="action-btn money" data-sess="doSave">${t("Save workout")}</button>
      <button class="action-btn" data-sess="doExit" style="background:var(--white-08);color:#fff">${t("Exit without saving")}</button>
      <button class="text-btn" data-sess="doContinue">${t("Continue workout")}</button>
    </div>`;
    overlay.appendChild(dlg);
  }

  overlay.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-sess]");
    if (!b) return;
    const a = b.dataset.sess;
    if (a === "close") askExit();
    else if (a === "finish") endSession(true);
    else if (a === "doSave") { setBtnLoading(b, true, t("Save workout")); await endSession(true); if (document.body.contains(overlay)) setBtnLoading(b, false); }
    else if (a === "doExit") endSession(false);
    else if (a === "doContinue") { const m = overlay.querySelector(".sess-modal"); if (m) m.remove(); }
    else if (a === "next") {
      if (active < goals.length - 1) { active++; sess.setActive(active); resetReadyState(); wsfx("transition"); renderCounter(); prevBottomKey = ""; prevGoalReached = false; }
    }
    else if (a === "prev") {
      if (active > 0) { active--; sess.setActive(active); resetReadyState(); renderCounter(); prevBottomKey = ""; prevGoalReached = false; }
    }
    else if (a === "record") {
      let on;
      try { on = await sess.toggleRecording(); }
      catch (err) { wsfx("recError"); toast(t("Couldn't save. Try again.")); return; }
      if (on) { wsfx("recStart"); toast(t("Recording started")); } else wsfx("recStop");
      b.innerHTML = icon(on ? "stop" : "record");
      b.style.color = on ? "var(--red)" : "rgba(255,255,255,.85)";
    }
  });
}

// Понятное сообщение об ошибке камеры/модели по типу сбоя. denied → есть подсказка про настройки.
function cameraError(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
    return { msg: t("Camera permission denied"), hint: t("Allow camera access in your browser settings, then retry.") };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError")
    return { msg: t("Camera not found") };
  if (err && err.code === "offline") return { msg: t("Internet connection required") };
  if (err && err.code === "poseLoad") return { msg: t("Couldn't load pose recognition") };
  return { msg: t("Camera access is needed to count your reps.") };
}

// Экран ошибки камеры поверх приложения: сообщение + Retry (заново) / Cancel (назад).
function showCameraError(info, challengeId, startExercise) {
  const ov = document.createElement("div");
  ov.className = "session";
  ov.style.cssText = "display:flex;align-items:center;justify-content:center;padding:32px;background:#000";
  ov.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;max-width:340px;color:#fff">
    <div style="width:44px;height:44px;color:rgba(255,255,255,.75)">${iconF("camera")}</div>
    <div style="font-weight:700;font-size:18px">${esc(info.msg)}</div>
    ${info.hint ? `<div style="color:rgba(255,255,255,.65);font-size:14px;line-height:1.4">${esc(info.hint)}</div>` : ""}
    <button class="action-btn money" data-err="retry" style="max-width:280px">${t("Retry")}</button>
    <button class="text-btn" data-err="cancel">${t("Cancel")}</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-err]");
    if (!b) return;
    ov.remove();
    if (b.dataset.err === "retry") openSession(challengeId, startExercise);
  });
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
  const scale = 3, W = 380, pad = 28;
  const before = await loadImg(data.beforePhoto), after = await loadImg(data.afterPhoto);
  const hasPhotos = !!(before || after);
  const cv = document.createElement("canvas");
  const g = cv.getContext("2d");
  // Заголовок переносим до 2 строк — считаем ДО установки размеров (они сбросят контекст).
  g.font = "900 26px -apple-system,system-ui,sans-serif";
  const titleLines = wrapLines(g, String(data.title).toUpperCase(), W - pad * 2, 2);

  const H = (pad + 6) + 34 + titleLines.length * 30 + 2 + 22
    + (hasPhotos ? 166 : 0) + data.metrics.length * 38 + (data.payout != null ? 52 : 0) + 34;
  cv.width = W * scale; cv.height = H * scale;
  g.scale(scale, scale);

  g.fillStyle = "#141414"; g.fillRect(0, 0, W, H);
  roundRectPath(g, 1, 1, W - 2, H - 2, 22);
  g.strokeStyle = "rgba(255,94,31,.55)"; g.lineWidth = 1.5; g.stroke();

  g.textAlign = "left";
  let y = pad + 6;
  g.fillStyle = "#ff5e1f"; g.font = "800 14px -apple-system,system-ui,sans-serif";
  g.fillText("🔥 FITSTAKE", pad, y + 4);
  y += 34;
  g.fillStyle = "#fff"; g.font = "900 26px -apple-system,system-ui,sans-serif";
  for (const line of titleLines) { g.fillText(line, pad, y); y += 30; }
  y += 2;
  g.fillStyle = "#ff5e1f"; g.font = "700 11px monospace";
  g.fillText(String(data.headline).toUpperCase(), pad, y + 8);
  y += 22;

  if (hasPhotos) {
    const ph = 150, pw = (W - pad * 2 - 10) / 2;
    const drawP = (im, x, cap) => {
      g.save(); roundRectPath(g, x, y, pw, ph, 12); g.clip();
      if (im) { const s = Math.max(pw / im.width, ph / im.height); g.drawImage(im, x + (pw - im.width * s) / 2, y + (ph - im.height * s) / 2, im.width * s, im.height * s); }
      else { g.fillStyle = "#0a0a0a"; g.fillRect(x, y, pw, ph); }
      g.restore();
      g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x + 8, y + ph - 22, 52, 16);
      g.fillStyle = "#fff"; g.font = "700 9px monospace"; g.textAlign = "left"; g.fillText(cap, x + 12, y + ph - 10);
    };
    drawP(before, pad, "BEFORE"); drawP(after, pad + pw + 10, "AFTER");
    y += 166;
  }

  for (let i = 0; i < data.metrics.length; i++) {
    const [k, v] = data.metrics[i];
    g.fillStyle = "rgba(255,255,255,.62)"; g.font = "700 10px monospace"; g.textAlign = "left";
    g.fillText(String(k).toUpperCase(), pad, y + 14);
    g.fillStyle = "#fff"; g.font = "800 19px monospace"; g.textAlign = "right";
    g.fillText(String(v), W - pad, y + 16); g.textAlign = "left";
    if (i < data.metrics.length - 1) { g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, y + 30); g.lineTo(W - pad, y + 30); g.stroke(); }
    y += 38;
  }

  if (data.payout != null) {
    g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, y + 4); g.lineTo(W - pad, y + 4); g.stroke();
    y += 22;
    g.fillStyle = "rgba(255,255,255,.62)"; g.font = "700 10px monospace"; g.textAlign = "left";
    g.fillText(store.lang === "ru" ? "ЗАБИРАЕШЬ" : "YOU TAKE HOME", pad, y + 8);
    g.fillStyle = "#4dc280"; g.font = "800 23px monospace"; g.textAlign = "right";
    g.fillText(COIN_SYM + fmt(data.payout), W - pad, y + 12); g.textAlign = "left";
    y += 30;
  }

  g.fillStyle = "rgba(255,255,255,.4)"; g.font = "600 11px monospace"; g.textAlign = "left";
  g.fillText(store.lang === "ru" ? "Прими вызов на FitStake" : "Take the challenge on FitStake", pad, H - pad + 4);

  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  const file = new File([blob], "fitstake.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "FitStake" }); return; } catch {}
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fitstake.png"; a.click();
}

// SVG-иконку → data-URI, чтобы нарисовать её на canvas через drawImage с нужным цветом.
function posterIconURI(markup, { stroke = "#ff5e1f", fill = "none", sw = 2 } = {}) {
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
  const ORANGE = "#ff5e1f";
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
    flame: posterIconURI(PATHS.flame, { fill: ORANGE, stroke: "none" }),
    bolt: posterIconURI(PATHS.bolt, { fill: ORANGE, stroke: "none" }),
    dollar: posterIconURI('<line x1="12" y1="2.5" x2="12" y2="21.5"/><path d="M16.5 6.5H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H6.5"/>', { stroke: ORANGE }),
    calendar: posterIconURI(PATHS.calendar, { stroke: ORANGE }),
    shield: posterIconURI('<path d="M12 3l7 3v5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>', { stroke: ORANGE }),
    phone: posterIconURI('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', { stroke: "rgba(255,255,255,.6)" }),
  };
  data.exercises.forEach((e) => { icons["ex_" + e.ex] = posterIconURI(PATHS[EXERCISE_ICON[e.ex]] || PATHS.flame, { stroke: ORANGE }); });
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
  rg.addColorStop(0, "rgba(255,94,31,.20)"); rg.addColorStop(1, "rgba(255,94,31,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  rg = g.createRadialGradient(W * 0.85, H * 0.1, 20, W * 0.85, H * 0.1, 280);
  rg.addColorStop(0, "rgba(255,120,40,.12)"); rg.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * W, yy = Math.random() * H, r = Math.random() * 1.5 + 0.4;
    g.fillStyle = `rgba(255,${(140 + Math.random() * 70) | 0},60,${(Math.random() * 0.5 + 0.1).toFixed(2)})`;
    g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(255,94,31,.09)"; g.lineWidth = 3; g.lineCap = "round";
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const bx = cx + side * (Wu / 2 + 16 + k * 12), by = H * 0.45;
    g.beginPath(); g.moveTo(bx - side * 6, by - 9); g.lineTo(bx, by); g.lineTo(bx - side * 6, by + 9); g.stroke();
  }

  let y = (H - contentH) / 2;

  // Логотип
  setLS("3px"); g.font = "800 20px -apple-system,system-ui,sans-serif";
  const brand = "FITSTAKE", bw = g.measureText(brand).width, fl = 22, gapL = 9, lw = fl + gapL + bw, lsx = cx - lw / 2;
  drawIcon("flame", lsx + fl / 2, y + 11, fl);
  g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(brand, lsx + fl + gapL, y + 12);
  setLS("0px"); y += LOGO_H + GAP1;

  // Бейдж
  setLS("2px"); g.font = "700 12px -apple-system,system-ui,sans-serif";
  const btw = g.measureText(L.badge).width, bpad = 18, bwd = btw + bpad * 2, bh = 32, bx0 = cx - bwd / 2;
  roundRectPath(g, bx0, y, bwd, bh, 16); g.fillStyle = "rgba(255,94,31,.10)"; g.fill();
  roundRectPath(g, bx0, y, bwd, bh, 16); g.strokeStyle = "rgba(255,94,31,.6)"; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = ORANGE; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L.badge, cx, y + bh / 2 + 1);
  setLS("0px"); y += BADGE_H + GAP2;

  // Герой
  if (single) {
    g.save(); g.shadowColor = "rgba(255,255,255,.18)"; g.shadowBlur = 22;
    y = ctext(String(ex0.reps), y, 150, 900, "#fff", "0px", 128);
    g.restore();
    y = ctext(nameUpper, y, nameSize, 900, "#fff", "1px", nameLh);
    y = ctext(L.aDay, y, 40, 900, ORANGE, "4px", 50);
  } else {
    y = ctext(L.combo, y, 76, 900, "#fff", "3px", 74);
    y = ctext(L.exCount, y, 28, 800, ORANGE, "2px", 40);
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
    hexPath(g, hcx, midY, 23); g.fillStyle = "rgba(255,94,31,.12)"; g.fill();
    hexPath(g, hcx, midY, 23); g.strokeStyle = "rgba(255,94,31,.55)"; g.lineWidth = 1.6; g.stroke();
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
  g.save(); g.shadowColor = "rgba(255,94,31,.5)"; g.shadowBlur = 28; g.shadowOffsetY = 6;
  roundRectPath(g, pad, y, Wu, CTA_H, 16);
  const lg = g.createLinearGradient(0, y, 0, y + CTA_H); lg.addColorStop(0, "#ff8a3d"); lg.addColorStop(1, ORANGE);
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
  const w1 = g.measureText(L.fOpen).width, w2 = g.measureText("FitStake").width, w3 = g.measureText(L.fEnd).width;
  const pIc = 14, pg = 8, fgW = pIc + pg + w1 + w2 + w3, fx = cx - fgW / 2;
  drawIcon("phone", fx + pIc / 2, y + 8, pIc);
  g.textAlign = "left"; g.textBaseline = "middle";
  g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(L.fOpen, fx + pIc + pg, y + 9);
  g.fillStyle = ORANGE; g.fillText("FitStake", fx + pIc + pg + w1, y + 9);
  g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(L.fEnd, fx + pIc + pg + w1 + w2, y + 9);
  y += FOOT_H + GAP7;

  // Микро-футер
  ctext(L.micro, y, 11, 700, "rgba(255,255,255,.3)", "2px", MICRO_H);

  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  const file = new File([blob], "fitstake-challenge.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "FitStake" }); return; } catch {}
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fitstake-challenge.png"; a.click();
}

// ==========================================================================
// Открытие/закрытие модалок и поздравлений
// ==========================================================================
function newCreateForm(over) {
  return Object.assign({ step: 0, title: "", sel_pushups: false, sel_squats: false, sel_pullups: false, sel_dips: false,
    pushups: store.dailyGoal, squats: store.dailyGoal, pullups: 20, dips: 30,
    duration: 30, buyIn: 50, isPublic: !isGuest(), miss: "oneTotal", progOn: false, progStep: 5, progPeriod: "day" }, over || {});
}
// Быстрые шаблоны перед мастером — сокращают путь создания. over — предзаполнение формы.
const CREATE_TEMPLATES = [
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
function openCreate() { ui.sheet = TemplatesSheet; render(); }
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
function closeSheet() { ui.sheet = null; ui.form = null; render(); }
function openDayComplete(c) { ui.fullId = c.id; ui.full = DayCompleteFull; render(); }
function openChallengeComplete(c) { ui.form = { challengeId: c.id, weight: store["profile.weightKg"], maxReps: store["profile.maxReps"], photo: null }; ui.full = ChallengeCompleteFull; render(); }
function closeFull() { ui.full = null; ui.form = null; render(); }

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

root.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const [cmd, arg] = act.split(":");
  sfx(sfxFor(cmd, arg)); // звук нажатия — свой для разных действий
  if (el.classList.contains("action-btn")) haptic(8); // лёгкий тактильный отклик на первичных кнопках

  if (act === "closeSheetBg") { if (e.target.classList.contains("sheet-backdrop")) closeSheet(); return; }

  switch (cmd) {
    case "tab": go(arg); return;
    case "open": openDetail(arg); return;
    case "back": back(); return;
    case "play": { const startEx = act.split(":")[2]; if (ui.sheet) { ui.sheet = null; ui.form = null; } openCameraPrep(arg, startEx); return; }
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
    case "profileSection": pageTransition("forward", () => { ui.profileSection = arg; }); window.scrollTo(0, 0); return;
    case "profileHome": pageTransition("back", () => { ui.profileSection = null; }); window.scrollTo(0, 0); return;
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
    case "notification": ui.sheet = null; ui.form = null; openDetail(arg); return;
    case "dismissPwa": localStorage.setItem("fs.pwahint", "1"); render(); return;
    case "signOut": Sync.signOutUser().then(() => render()); return;
    case "toggleLang": store.lang = store.lang === "ru" ? "en" : "ru"; render(); return;
    case "closeSheet": closeSheet(); return;
    case "closeFull": closeFull(); return;
    case "showResult": openChallengeComplete(app.challenges.find((c) => c.id === arg)); return;
    case "askLeave": openLeave(arg); return;
    case "confirmLeave": leaveChallenge(arg); ui.sheet = null; ui.form = null; ui.detailId = null; render(); return;
    case "openBug": openBug(); return;
    case "bugPick": if (ui.bug) { ui.bug.pick = arg; render(); } return;
    case "openBuyCoins": openBuyCoins(); return;
    case "buyCoins": buyCoins(+arg); return;
  }

  // Форм-контролы
  if (cmd === "seg") {
    const key = el.dataset.key, sk = el.dataset.store, val = parseVal(el.dataset.val);
    if (sk != null) { store[sk] = val; storeHook(sk); } else ui.form[key] = val;
    render(); return;
  }
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
    render(); return;
  }

  if (act.startsWith("pickPhoto")) { const img = await pickImage(arg === "camera"); if (img) { ui.form.photo = img; render(); } return; }

  if (cmd === "createNext") {
    const f = ui.form;
    if (f.step === 0 && !selectedExercises(f).length) { toast(t("Pick at least one exercise")); return; }
    moveView("forward");
    if (f.editingFromReview) { f.editingFromReview = false; f.step = CREATE_LAST; render(); return; }
    f.step++; render();
    return;
  }
  if (cmd === "editCreate") {
    moveView("back");
    ui.form.step = +arg;
    ui.form.editingFromReview = true;
    render(); window.scrollTo(0, 0); return;
  }
  if (cmd === "createBack") {
    const f = ui.form;
    moveView("back");
    if (f.editingFromReview) { f.editingFromReview = false; f.step = CREATE_LAST; render(); }
    else if (f.step > 0) { f.step--; render(); } else { ui.full = null; ui.form = null; render(); }
    return;
  }
  if (cmd === "saveChallenge") {
    if (ui.form.isPublic && isGuest()) { openAuthGate("publicCreate"); return; }
    const wasPublic = ui.form.isPublic;
    if (saveChallengeForm()) { ui.form = null; if (wasPublic) { ui.full = ChallengeCreatedFull; render(); } else { ui.full = null; go("yours"); } }
    return;
  }
  if (cmd === "shareCreated") { shareInvite(); return; }
  if (cmd === "copyCreated") {
    const url = "https://pysarenkovv.github.io/fitstake/?join=" + encodeURIComponent(ui.createdChallengeId);
    try { await navigator.clipboard.writeText(url); toast(t("Link copied")); } catch { prompt("URL", url); }
    return;
  }
  if (cmd === "openCreated") {
    const id = ui.createdChallengeId;
    pageTransition("forward", () => { ui.full = null; ui.tab = "challenges"; ui.detailId = id; });
    return;
  }
  if (cmd === "savePreset") {
    if (saveChallengeForm()) { ui.full = null; ui.form = null; go("yours"); }
    return;
  }
  if (cmd === "saveShareChallenge") {
    if (isGuest()) { openAuthGate("shareCreate"); return; }
    const f = ui.form;
    if (!saveChallengeForm()) return;
    ui.full = null; ui.form = null; go("yours");
    shareChallengeCard(f);
    return;
  }
  if (cmd === "submitJoin") {
    const f = ui.form, c = app.challenges.find((x) => x.id === f.challengeId);
    if (isGuest()) { ui.sheet = null; openAuthGate("join", c.id); return; }
    if (C.isJoined(c)) { closeSheet(); return; } // уже вступил (повторный заход по ссылке)
    const ok = joinChallenge(c, f.weight, f.maxReps, f.photo);
    if (ok) closeSheet(); else toast(t("Not enough coins"));
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
    shareCard({ title: c.title, headline: t("Day %lld of %lld", c.currentDay, c.durationDays), metrics: [[t("Today"), C.myTodayTotal(c)], [t("Challenge total"), c.myTotalReps]] });
    return;
  }
  if (cmd === "shareResult") {
    const f = ui.form, c = app.challenges.find((x) => x.id === arg);
    const wc = c.startWeight != null ? `${c.startWeight} → ${f.weight} ${t("kg")}` : t("%lld kg", f.weight);
    const mc = c.startMaxReps != null ? `${c.startMaxReps} → ${f.maxReps}` : String(f.maxReps);
    shareCard({ title: c.title, headline: t("%lld days — finished", c.durationDays), metrics: [[t("Total reps"), c.myTotalReps], [t("Weight"), wc], [t("Max reps"), mc]], payout: C.payout(c), beforePhoto: c.beforePhoto, afterPhoto: f.photo });
    return;
  }

  // Онбординг
  if (cmd === "onbBack") { commitWheelIfEditing(); if (ui.onbStep > 0) { ui.onbStep--; render(); } return; }
  if (cmd === "onbNext") {
    commitWheelIfEditing();
    if (ui.onbStep === STEP.name) {
      const inp = document.getElementById("onb-name");
      const name = inp ? inp.value.trim() : "";
      if (!name) { toast(t("Your name")); return; }
      store["profile.name"] = name;
    }
    // LAST_STEP — итоговый экран дневной нормы; кнопка «Погнали» завершает онбординг.
    if (ui.onbStep === LAST_STEP) { finishOnboarding(); }
    else { ui.onbStep++; render(); }
    return;
  }
  if (cmd === "onbSet") { store[arg] = act.split(":")[2]; render(); return; }
  if (cmd === "goalChoice") { store.goalChoice = arg; render(); return; }
  if (cmd === "wheelEdit") { ui.wheelEdit = arg; render(); return; }
  if (cmd === "wheelDone") { commitWheelIfEditing(); render(); return; }
  // Пропустить создание аккаунта — временно входим без входа (флаг гасит обязательный возврат).
  if (cmd === "skipAuth") { store.skippedAuth = true; finishOnboarding(); return; }
});

// Звук при фокусе на поле ввода.
root.addEventListener("focusin", (e) => {
  if (e.target.matches && e.target.matches("input, textarea")) sfx("input");
});

root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "profile-name") { profileNameDraft = el.value; return; }
  if (el.id === "bug-note") { if (ui.bug) ui.bug.note = el.value; return; }
  if (el.dataset.model != null) {
    const k = el.dataset.model;
    ui.form[k] = el.type === "number" ? (parseInt(el.value) || 0) : el.value;
  }
});
root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.store != null && el.tagName === "INPUT") {
    const k = el.dataset.store, r = RANGES[k];
    let v = parseInt(el.value); if (isNaN(v)) v = store[k];
    if (r) v = Math.min(Math.max(v, r[0]), r[1]);
    store[k] = v; storeHook(k); render();
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

  if (pendingViewMotion && !REDUCE_MOTION()) {
    const direction = pendingViewMotion;
    pendingViewMotion = null;
    const view = motionView();
    if (view && view.animate) {
      const x = direction === "forward" ? "100vw" : direction === "back" ? "-18vw" : "0";
      const y = direction === "tab" ? 5 : 0;
      if (direction !== "tab") view.classList.add("page-motion-entering");
      const enterAnim = view.animate([
        { opacity: direction === "tab" ? 0.8 : 1, transform: `translate3d(${x}, ${y}px, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" }
      ], { duration: direction === "tab" ? 220 : 280, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
      enterAnim.finished.catch(() => {}).finally(() => view.classList.remove("page-motion-entering"));
    }
  } else {
    pendingViewMotion = null;
  }

  document.querySelectorAll(".wheel").forEach((w) => {
    const key = w.dataset.wheel, min = +w.dataset.min, max = +w.dataset.max;
    w.scrollTop = (store[key] - min) * 44;
    let timer, lastVal = store[key];
    w.addEventListener("scroll", () => {
      const val = Math.min(Math.max(min + Math.round(w.scrollTop / 44), min), max);
      if (val !== lastVal) { sfx("tick"); haptic(6); lastVal = val; } // звук + вибро при смене числа
      w.querySelectorAll(".opt").forEach((o) => o.classList.toggle("active", +o.dataset.val === val));
      clearTimeout(timer);
      timer = setTimeout(() => { store[key] = val; }, 120);
    }, { passive: true });
  });

  // Ручной ввод в колесе — сразу фокус и выделение для замены.
  const wi = document.getElementById("wheel-input");
  if (wi) { wi.focus(); wi.select(); }

  bindScrollFollow();
}

let clearScrollFollow = null;
function bindScrollFollow() {
  if (clearScrollFollow) clearScrollFollow();
  clearScrollFollow = null;
  if (REDUCE_MOTION()) return;

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
  const winTop = window.scrollY;
  _render();
  if (sheetTop != null) { const s = document.querySelector(".sheet"); if (s) s.scrollTop = sheetTop; }
  if (detailTop != null) { const d = document.querySelector("#detail-scroll"); if (d) d.scrollTop = detailTop; }
  if (fullTop != null) { const f = document.querySelector(".fullscreen"); if (f) f.scrollTop = fullTop; }
  window.scrollTo(0, winTop);
  saveApp();
};

// Escape закрывает открытый лист — тот же выход, что и тап по фону.
document.addEventListener("keydown", (e) => {
  if (e.target.id === "wheel-input" && e.key === "Enter") { commitWheelIfEditing(); render(); return; }
  if (e.key === "Escape" && ui.sheet) { closeSheet(); }
  if (e.key === "Tab" && ui.sheet) {
    const sheet = document.querySelector(".sheet");
    if (!sheet) return;
    const focusable = Array.from(sheet.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hidden && el.getClientRects().length);
    if (!focusable.length) { e.preventDefault(); sheet.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ==========================================================================
// Приглашение друзей
// ==========================================================================
async function shareInvite() {
  const c = (ui.createdChallengeId && app.challenges.find((x) => x.id === ui.createdChallengeId)) || (ui.detailId && app.challenges.find((x) => x.id === ui.detailId)) || app.challenges.find(C.isJoined) || app.challenges[0];
  if (!c) return;
  const url = "https://pysarenkovv.github.io/fitstake/?join=" + encodeURIComponent(c.id);
  track("invite_shared", { challenge_id: c.id });
  const text = t("Join my challenge") + " — " + c.title;
  if (navigator.share) {
    try { await navigator.share({ title: "FitStake", text, url }); return; } catch {}
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

// Живой общий прогресс: подписка на Firebase (если конфиг вставлен).
// Несколько Firebase-узлов могут обновиться подряд — достаточно одного render за кадр.
let syncRenderFrame = 0;
Sync.init(() => {
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
setInterval(() => { if (rolloverIfNeeded() && !ui.sheet && !ui.full && !liveSession) render(); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && rolloverIfNeeded() && !ui.sheet && !ui.full && !liveSession) render(); });
