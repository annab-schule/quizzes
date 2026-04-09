#!/usr/bin/env node
/**
 * Quiz HTML Test Suite
 * Führe aus mit: node tests/test-quizzes.js
 * Wird automatisch von pre-push Hook ausgeführt.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUIZ_DIRS = ['englisch', 'spanisch', 'sonstiges'];

let passed = 0;
let failed = 0;
let errors = [];

function assert(condition, file, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`  ✗ [${file}] ${message}`);
  }
}

function getQuizFiles() {
  const files = [];
  for (const dir of QUIZ_DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    const htmlFiles = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.html'))
      .map(f => path.join(dirPath, f));
    files.push(...htmlFiles);
  }
  return files;
}

function isStandardQuiz(content) {
  // Standard-Quiz-Format erkennen: hat quiz-meta UND renderQuestion (neues Format)
  return content.includes('name="quiz-meta"') && content.includes('renderQuestion');
}

function testQuizFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const isStandard = isStandardQuiz(content);

  // === Basis-Checks (für ALLE Quiz-Dateien) ===

  // 1. Kein Markdown-Artefakt (Backticks) im HTML
  const backtickLines = content.split('\n').filter(line => line.trim() === '```');
  assert(
    backtickLines.length === 0,
    rel,
    `Enthält ${backtickLines.length} Markdown-Backtick-Zeile(n) — CSS wird dadurch gebrochen`
  );

  // 2. Valider <title>-Tag
  assert(
    /<title>.+<\/title>/.test(content),
    rel,
    'Fehlender oder leerer <title>-Tag'
  );

  // 3. UTF-8 charset
  assert(
    content.includes('charset="UTF-8"') || content.includes("charset='UTF-8'"),
    rel,
    'Fehlende charset=UTF-8 Deklaration'
  );

  // 4. lang-Attribut auf html-Tag
  assert(
    /<html[^>]+lang=/.test(content),
    rel,
    'Fehlendes lang-Attribut auf <html>-Tag'
  );

  // 5. Keine externen Fonts (Google Fonts verboten für alle)
  assert(
    !content.includes('fonts.googleapis.com'),
    rel,
    'Google Fonts nicht erlaubt (nur cdnjs.cloudflare.com)'
  );

  // === Standard-Quiz-Checks (nur für neue Quizze mit quiz-meta + renderQuestion) ===
  if (!isStandard) {
    // Legacy-Datei: nur Basis-Checks, kein vollständiges Schema gefordert
    return;
  }

  // 6. Pflicht-Meta-Tag
  assert(
    content.includes('name="quiz-meta"'),
    rel,
    'Fehlender <meta name="quiz-meta"> Tag'
  );

  // 7. QRCode.js eingebunden
  assert(
    content.includes('qrcodejs'),
    rel,
    'QRCode.js (cdnjs) nicht eingebunden'
  );

  // 8. QR-Button vorhanden
  assert(
    content.includes('openQR()'),
    rel,
    'Kein QR-Button (openQR() Funktion) gefunden'
  );

  // 9. Fortschrittsbalken vorhanden
  assert(
    content.includes('progressBar') && content.includes('progressLabel'),
    rel,
    'Fehlender Fortschrittsbalken (#progressBar / #progressLabel)'
  );

  // 10. Antwort-Buttons und Feedback vorhanden
  assert(
    content.includes('answer-btn') && content.includes('feedback'),
    rel,
    'Fehlende Antwort-Buttons oder Feedback-Element'
  );

  // 11. Score-Screen und Nochmal-Button
  assert(
    content.includes('scoreScreen') && content.includes('restartQuiz'),
    rel,
    'Fehlender Score-Screen oder restartQuiz-Funktion'
  );

  // 12. Keine CSS-Variablen (var(--...))
  const cssVarMatches = content.match(/var\(--[^)]+\)/g);
  assert(
    !cssVarMatches || cssVarMatches.length === 0,
    rel,
    `CSS-Variablen gefunden: ${(cssVarMatches || []).join(', ')} — nur direkte Hex-Werte erlaubt`
  );

  // 13. questions-Array nicht leer
  const qMatch = content.match(/var questions\s*=\s*\[/);
  if (qMatch) {
    const afterQuestions = content.slice(content.indexOf(qMatch[0]));
    const firstObj = afterQuestions.indexOf('{');
    assert(
      firstObj !== -1,
      rel,
      'questions-Array scheint leer zu sein'
    );
  } else {
    assert(false, rel, 'Kein `var questions = [...]` Array gefunden — Quiz hat keine Fragen?');
  }

  // 14. renderQuestion() wird am Ende aufgerufen
  assert(
    content.includes('renderQuestion()') && /<\/script>/.test(content),
    rel,
    'renderQuestion() wird nie aufgerufen — Quiz startet nicht'
  );
}

// === Run ===
console.log('\n🎓 Quiz Test Suite\n' + '='.repeat(50));

const files = getQuizFiles();
if (files.length === 0) {
  console.error('❌ Keine Quiz-HTML-Dateien gefunden!');
  process.exit(1);
}

console.log(`\n📂 Teste ${files.length} Datei(en):\n`);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  try {
    testQuizFile(file);
    const fileErrors = errors.filter(e => e.includes(`[${rel}]`));
    if (fileErrors.length === 0) {
      console.log(`  ✅ ${rel}`);
    } else {
      console.log(`  ❌ ${rel}`);
    }
  } catch (e) {
    failed++;
    errors.push(`  ✗ [${rel}] Unerwarteter Fehler: ${e.message}`);
    console.log(`  💥 ${rel} → ${e.message}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log(`\n📊 Ergebnis: ${passed} Tests bestanden, ${failed} fehlgeschlagen\n`);

if (errors.length > 0) {
  console.log('Fehler:\n');
  errors.forEach(e => console.log(e));
  console.log('');
}

if (failed > 0) {
  console.log('❌ Tests fehlgeschlagen — Push abgebrochen!\n');
  process.exit(1);
} else {
  console.log('✅ Alle Tests bestanden!\n');
  process.exit(0);
}
