#!/usr/bin/env node

/**
 * AI Team — локальная система управления разработкой
 * 
 * OpenAI выступает как менеджер/архитектор/ревьюер
 * Claude Code выступает как разработчик
 * 
 * Запуск: npm run ai-team
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawn } from "child_process";
import readline from "readline";
import { OpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// КОНФИГУРАЦИЯ И УТИЛИТЫ
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  log(`\n${"=".repeat(75)}`, "cyan");
  log(title, "cyan");
  log(`${"=".repeat(75)}\n`, "cyan");
}

function logSuccess(msg) {
  log(`✓ ${msg}`, "green");
}

function logError(msg) {
  log(`✗ ${msg}`, "red");
}

function logWarning(msg) {
  log(`⚠ ${msg}`, "yellow");
}

function logInfo(msg) {
  log(`ℹ ${msg}`, "blue");
}

// ============================================================================
// ЗАГРУЗКА КОНФИГУРАЦИИ
// ============================================================================

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    logError("Файл .env не найден!");
    log(`\nСоздайте .env файл, скопировав .env.example:`, "yellow");
    log(`  cp .env.example .env\n`);
    log(`Затем отредактируйте .env и добавьте ваш OPENAI_API_KEY.`, "yellow");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim();
    env[key.trim()] = value;
  });

  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === "your_actual_api_key_here") {
    logError("OPENAI_API_KEY не установлен или использует значение по умолчанию!");
    log(`\nОтредактируйте .env файл и добавьте реальный ключ.`, "yellow");
    process.exit(1);
  }

  if (!env.OPENAI_MODEL) {
    env.OPENAI_MODEL = "gpt-4o";
  }

  return env;
}

// ============================================================================
// ЧТЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО ВВОДА
// ============================================================================

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${colors.bright}${question}${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `${colors.bright}${question} (да/нет): ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "да" || answer.toLowerCase() === "y");
      }
    );
  });
}

// ============================================================================
// СБОР КОНТЕКСТА ПРОЕКТА (БЕЗОПАСНО)
// ============================================================================

function isIgnored(filePath, ignorePatterns) {
  for (const pattern of ignorePatterns) {
    if (filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function collectProjectContext() {
  logInfo("Собираю контекст проекта...");

  const ignorePatterns = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".DS_Store",
    ".env",
    ".env.local",
    "*.pem",
    "*.key",
    "*.secret",
  ];

  const projectRoot = __dirname;
  const context = {
    structure: [],
    files: {},
    size: 0,
  };

  function walkDir(dir, baseDir = dir, depth = 0) {
    if (depth > 3) return; // Лимит глубины

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = path.relative(baseDir, fullPath);

        if (isIgnored(relPath, ignorePatterns)) {
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            context.structure.push(`📁 ${relPath}/`);
            walkDir(fullPath, baseDir, depth + 1);
          } else if (stat.isFile() && stat.size < 100000) {
            // Лимит 100KB на файл
            const ext = path.extname(entry);

            // Читаем только текстовые файлы
            if (
              [
                ".js",
                ".json",
                ".html",
                ".css",
                ".md",
                ".yml",
                ".yaml",
                ".txt",
                ".csv",
              ].includes(ext)
            ) {
              try {
                const content = fs.readFileSync(fullPath, "utf-8");
                context.files[relPath] = content;
                context.size += content.length;
                context.structure.push(`📄 ${relPath} (${stat.size} bytes)`);
              } catch (e) {
                // Skip unreadable files
              }
            } else {
              context.structure.push(`📄 ${relPath} (бинарный, пропущен)`);
            }
          }
        } catch (e) {
          // Skip problematic entries
        }
      }
    } catch (e) {
      logWarning(`Не удалось прочитать ${dir}: ${e.message}`);
    }
  }

  walkDir(projectRoot);

  logSuccess(
    `Собрано ${Object.keys(context.files).length} текстовых файлов (${(context.size / 1024).toFixed(1)}KB)`
  );

  return context;
}

// ============================================================================
// ОТПРАВКА В OPENAI RESPONSES API
// ============================================================================

async function analyzeWithOpenAI(client, model, taskDescription, projectContext) {
  logInfo("Отправляю задачу в OpenAI для анализа...");

  const systemPrompt = `Ты опытный менеджер проекта, архитектор и UX/UI-ревьюер.

Твоя задача — проанализировать описание задачи, понять требования, изучить контекст проекта и подготовить детальное техническое задание для разработчика.

ТВОЙ ОТВЕТ ДОЛЖЕН СОДЕРЖАТЬ:

1. **Понимание задачи** — кратко переформулируй, что нужно сделать
2. **Анализ текущей архитектуры** — как устроен проект, какие части затронуты
3. **UX/UI-анализ** (если релевантно) — как это повлияет на пользовательский опыт
4. **Рекомендуемое решение** — подход, который предлагаешь
5. **Пошаговый план** (5-10 шагов) — как это реализовать
6. **Техническое задание для Claude Code** — ТОЧНОЕ, без двусмысленностей
7. **Критерии проверки** — как понять, что работает правильно
8. **Риски** — что может пойти не так
9. **Что нельзя сломать** — список критических функций, которые должны остаться нетронутыми

Используй русский язык. Будь конкретен и практичен.`;

  const userMessage = `# Задача

${taskDescription}

# Контекст проекта

## Структура
\`\`\`
${projectContext.structure.slice(0, 50).join("\n")}
\`\`\`

## Ключевые файлы

${Object.entries(projectContext.files)
  .slice(0, 10)
  .map(
    ([filePath, content]) => `
### ${filePath}
\`\`\`${path.extname(filePath).slice(1)}
${content.substring(0, 2000)}
\`\`\`
`
  )
  .join("\n")}`;

  try {
    // Актуальный OpenAI Responses API
    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input: userMessage,
      temperature: 0.7,
      max_output_tokens: 4000,
    });

    return response.output_text;
  } catch (error) {
    logError(`Ошибка при обращении к OpenAI: ${error.message}`);
    if (error.status === 401) {
      logError("Неверный OPENAI_API_KEY. Проверьте .env файл.");
    }
    throw error;
  }
}

// ============================================================================
// РАБОТА С GIT
// ============================================================================

function checkGitAvailable() {
  try {
    execSync("git --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function createGitCheckpoint() {
  try {
    // Проверяем, есть ли изменения
    const status = execSync("git status --porcelain", { encoding: "utf-8" });

    if (status.trim()) {
      logWarning("В проекте есть незакоммиченные изменения!");
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const branchName = `ai-team-${timestamp}`;

    execSync(`git checkout -b ${branchName}`, { stdio: "pipe" });
    logSuccess(`Создана git ветка: ${branchName}`);
    return branchName;
  } catch (error) {
    logWarning(`Не удалось создать git checkpoint: ${error.message}`);
    return null;
  }
}

function getGitDiff() {
  try {
    return execSync("git diff HEAD", { encoding: "utf-8" });
  } catch (error) {
    logWarning(`Не удалось получить git diff: ${error.message}`);
    return null;
  }
}

// ============================================================================
// ЗАПУСК CLAUDE CODE
// ============================================================================

function isClaudeAvailable() {
  try {
    execSync("which claude", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function printClaudeInstall() {
  logError("Claude Code не установлен (команда `claude` не найдена)!");
  log(`\nУстановите Claude Code:`, "yellow");
  log(`  npm install -g @anthropic-ai/claude-code`, "yellow");
  log(`  claude  # первый запуск попросит войти в аккаунт\n`, "yellow");
  log(`После установки снова запустите: npm run ai-team`, "yellow");
}

async function runClaudeCode(specification, label = "разработка") {
  logInfo(`Запускаю Claude Code (${label})...\n`);
  log(
    "Режим: неинтерактивный (-p), правки файлов разрешены (acceptEdits),",
    "dim"
  );
  log(
    "работа ограничена этой папкой, опасные действия остаются под запретом.\n",
    "dim"
  );

  const specFile = path.join(__dirname, ".ai-team", "current-spec.md");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(specFile, specification, "utf-8");

  return new Promise((resolve) => {
    // -p                       — неинтерактивный режим
    // --permission-mode        — acceptEdits: разрешает правки файлов, но
    //                            НЕ включает опасный dangerously-skip-permissions
    // --add-dir                — ограничиваем доступ текущим проектом
    const claude = spawn(
      "claude",
      ["-p", "--permission-mode", "acceptEdits", "--add-dir", __dirname],
      {
        stdio: ["pipe", "inherit", "inherit"],
        cwd: __dirname,
      }
    );

    // Отправляем техническое задание в stdin
    claude.stdin.write(specification);
    claude.stdin.end();

    claude.on("close", (code) => {
      try {
        fs.unlinkSync(specFile);
      } catch {
        // файл мог быть уже удалён
      }
      resolve(code === 0);
    });

    claude.on("error", (error) => {
      logError(`Ошибка при запуске Claude: ${error.message}`);
      resolve(false);
    });
  });
}

// ============================================================================
// СОХРАНЕНИЕ ОТЧЁТОВ
// ============================================================================

function saveReport(name, content) {
  const reportsDir = path.join(__dirname, ".ai-team", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const fileName = `${timestamp}_${name}.md`;
  const filePath = path.join(reportsDir, fileName);

  fs.writeFileSync(filePath, content, "utf-8");
  logSuccess(`Отчёт сохранён: .ai-team/reports/${fileName}`);

  return filePath;
}

// ============================================================================
// ВЕРИФИКАЦИЯ РЕЗУЛЬТАТА В OPENAI
// ============================================================================

async function verifyResult(
  client,
  model,
  taskDescription,
  specification,
  gitDiff,
  testResults
) {
  logInfo("Отправляю результаты в OpenAI для проверки...");

  const verificationPrompt = `Ты опытный QA-инженер и архитектор.

Проверь, соответствует ли результат задаче. СПИСОК ДЛЯ ПРОВЕРКИ:

1. Решена ли задача полностью?
2. Не ухудшился ли UX/UI?
3. Нет ли очевидных ошибок в коде?
4. Нет ли дублирующегося или лишнего кода?
5. Не сломан ли существующий функционал?
6. Нет ли проблем с безопасностью?
7. Следует ли код стилю проекта?
8. Нужны ли исправления?

ВАЖНО: самой первой строкой ответа выведи ровно один из вердиктов:
ВЕРДИКТ: ГОТОВО
или
ВЕРДИКТ: НУЖНЫ_ИСПРАВЛЕНИЯ

Ставь «НУЖНЫ_ИСПРАВЛЕНИЯ» только при реальных проблемах, а не при мелких пожеланиях.

Затем ответь структурированно:
- **Проверенные пункты**: список того, что ты проверил
- **Обнаруженные проблемы** (если есть): конкретный нумерованный список
- **Точные исправления для разработчика** (если нужны): чёткие шаги, что и в каком файле поменять
- **Рекомендации** (если есть): как улучшить`;

  const userMessage = `# Первоначальная задача
${taskDescription}

# Техническое задание
${specification}

# Git diff (изменения)
\`\`\`diff
${gitDiff || "Нет изменений"}
\`\`\`

# Результаты проверки
${testResults || "Не проверялось"}`;

  try {
    // Актуальный OpenAI Responses API
    const response = await client.responses.create({
      model,
      instructions: verificationPrompt,
      input: userMessage,
      temperature: 0.5,
      max_output_tokens: 2000,
    });

    const text = response.output_text;
    const needsFixes = /ВЕРДИКТ:\s*НУЖНЫ_ИСПРАВЛЕНИЯ/i.test(text);

    return { text, needsFixes };
  } catch (error) {
    logError(`Ошибка при проверке в OpenAI: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// ОСНОВНОЙ ЦИКЛ
// ============================================================================

async function main() {
  logSection("🤖 AI Team — локальная система управления разработкой");

  // 1. Загрузка конфигурации
  const env = loadEnv();
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  // 2. Запрос задачи
  logSection("📝 Опишите, что нужно сделать");
  log(
    "Обычным языком (русский или английский):",
    "dim"
  );
  log(
    "Например: 'Добавить кнопку \"Скачать результаты\" на вкладку статистики'\n",
    "dim"
  );

  const taskDescription = await askQuestion("Ваша задача: ");

  if (!taskDescription.trim()) {
    logError("Задача не введена!");
    process.exit(1);
  }

  // 3. Сбор контекста
  const projectContext = collectProjectContext();

  // 4. Анализ в OpenAI
  logSection("🔄 OpenAI анализирует задачу...");
  let analysis;
  try {
    analysis = await analyzeWithOpenAI(
      client,
      env.OPENAI_MODEL,
      taskDescription,
      projectContext
    );
  } catch (error) {
    process.exit(1);
  }

  // 5. Показ плана пользователю
  logSection("📋 План от OpenAI");
  log(analysis);

  saveReport("analysis", `# Анализ задачи\n\n${analysis}`);

  // 6. Подтверждение
  logSection("✅ Подтверждение");
  const confirmed = await askConfirm(
    "Этот план выглядит правильно? Начать разработку?"
  );

  if (!confirmed) {
    logWarning("Отменено пользователем.");
    process.exit(0);
  }

  // 7. Git checkpoint
  let gitBranch = null;
  if (checkGitAvailable()) {
    gitBranch = createGitCheckpoint();
    if (!gitBranch) {
      const continueAnyway = await askConfirm(
        "Не удалось создать git checkpoint. Продолжить?"
      );
      if (!continueAnyway) {
        process.exit(0);
      }
    }
  } else {
    logWarning("Git не доступен. Без git checkpoint-а не будет возможности отката.");
  }

  // 8. Показ финального техзадания
  const technicalSpec = `# Техническое задание для Claude Code

## Исходная задача
${taskDescription}

## Анализ от OpenAI
${analysis}

---

## Важные инструкции для разработчика:

1. **Работай только в этом проекте** — не выходи за пределы текущей директории
2. **Не удаляй большое количество файлов** — всегда уточняй перед удалением
3. **Не публикуй и не деплой** — это сделаем отдельно
4. **Не трогай внешние сервисы** — только локальные файлы
5. **Следуй стилю проекта** — используй существующие соглашения
6. **Тестируй перед отправкой** — убедись, что ничего не сломалось

Начни работу!`;

  logSection("🚀 Запуск Claude Code");
  log(technicalSpec);
  log("\n" + "=".repeat(75) + "\n", "dim");

  // Проверяем наличие Claude ДО того, как что-либо менять
  if (!isClaudeAvailable()) {
    printClaudeInstall();
    if (gitBranch) {
      log(`\nВернуться на главную ветку: git checkout -`, "yellow");
    }
    process.exit(1);
  }

  const continueWithClaude = await askConfirm("Запустить Claude для разработки?");

  if (!continueWithClaude) {
    logWarning("Отменено пользователем.");
    if (gitBranch) {
      log(`\nВернуться на главную ветку: git checkout -`, "yellow");
    }
    process.exit(0);
  }

  // 9. Первый проход разработки
  const claudeSuccess = await runClaudeCode(technicalSpec, "первый проход");

  if (!claudeSuccess) {
    logError("Claude завершил работу с ошибкой!");
    process.exit(1);
  }

  // 10-18. Цикл «проверка → исправления» (не более 2 раундов исправлений)
  const MAX_FIX_ROUNDS = 2;
  let round = 0;
  let verification = null;
  let gitDiff = null;

  while (true) {
    // Получаем git diff
    logSection("📊 Результаты работы");
    gitDiff = getGitDiff();

    if (!gitDiff || gitDiff.trim() === "") {
      logInfo("Нет изменений в проекте.");
    } else {
      logSuccess("Обнаружены изменения:");
      log(
        gitDiff.substring(0, 1000) + (gitDiff.length > 1000 ? "\n..." : ""),
        "dim"
      );
    }

    // Проверка результата в OpenAI
    logSection(`🔍 Проверка результата (проверка ${round + 1})`);
    try {
      verification = await verifyResult(
        client,
        env.OPENAI_MODEL,
        taskDescription,
        technicalSpec,
        gitDiff,
        "Автоматических тестов не было"
      );
    } catch (error) {
      logWarning("Не удалось проверить результат в OpenAI.");
      verification = null;
      break;
    }

    log(verification.text);
    saveReport(
      `verification-${round + 1}`,
      `# Проверка результата (проверка ${round + 1})\n\n${verification.text}`
    );

    // Если проблем нет — выходим
    if (!verification.needsFixes) {
      logSuccess("OpenAI: исправления не требуются.");
      break;
    }

    // Достигли лимита раундов исправлений
    if (round >= MAX_FIX_ROUNDS) {
      logWarning(
        `Достигнут лимит раундов исправлений (${MAX_FIX_ROUNDS}). Останавливаюсь — оставшиеся замечания смотрите в отчёте.`
      );
      break;
    }

    // Раунд исправлений
    round++;
    logSection(`🛠️ Раунд исправлений ${round} из ${MAX_FIX_ROUNDS}`);

    const fixSpec = `# Задание на исправления (раунд ${round})

## Исходная задача
${taskDescription}

OpenAI-ревьюер проверил твою работу и нашёл проблемы.
Исправь строго по списку ниже. Ничего лишнего не меняй.

## Замечания ревьюера
${verification.text}

## Инструкции
1. Работай только в этом проекте, не выходи за пределы папки.
2. Исправь только перечисленные проблемы.
3. Не ломай уже работающий функционал.
4. Не публикуй и не деплой, не трогай внешние сервисы.
5. Следуй существующему стилю проекта.

Приступай к исправлениям!`;

    const fixOk = await runClaudeCode(fixSpec, `исправления, раунд ${round}`);
    if (!fixOk) {
      logError("Claude завершил раунд исправлений с ошибкой. Останавливаюсь.");
      break;
    }
  }

  // 19. Финальный отчёт
  logSection("✨ Работа завершена");

  const finalStatus =
    verification && verification.needsFixes
      ? "⚠️ Основное сделано, но остались замечания (см. отчёт проверки)"
      : "✓ Завершено, проверка OpenAI пройдена";

  const finalReport = `# Итоговый отчёт AI Team

## Задача
${taskDescription}

## Статус
${finalStatus}

## Раундов исправлений
${round} из ${MAX_FIX_ROUNDS}

## Изменённые файлы
${
  gitDiff
    ? gitDiff
        .split("\n")
        .filter((line) => line.startsWith("diff --git"))
        .map((line) => `- ${line.substring(11)}`)
        .join("\n") || "Нет изменений"
    : "Нет изменений"
}

## Git ветка
${gitBranch || "Не создана (git недоступен)"}

## Как отменить изменения
${
  gitBranch
    ? `Вернуться на исходную ветку: \`git checkout -\`\nИли откатить всё: \`git reset --hard HEAD\``
    : "Ручной откат: восстановите файлы из резервной копии"
}

## Что проверить вручную
1. Функциональность — всё ли работает как ожидается?
2. Внешний вид — всё ли выглядит правильно?
3. Совместимость — работает ли на разных браузерах?
4. Производительность — не замедлилось ли приложение?

## Команда для публикации (когда готовы, вручную)
\`\`\`bash
git push origin ${gitBranch || "your-branch"}
\`\`\`
`;

  saveReport("final-report", finalReport);
  log(finalReport);
}

// ============================================================================
// ЗАПУСК
// ============================================================================

main().catch((error) => {
  logError(`Критическая ошибка: ${error.message}`);
  process.exit(1);
});
