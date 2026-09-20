const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
const BOT_OWNER = "gojo_esultan4";

if (!TOKEN) {
  console.log("❌ BOT_TOKEN غير موجود");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const DB_FILE = "./database.json";

let db = {
  users: {},
  groups: {},
  daily: {},
  transactions: [],
  replies: {},
  shortcuts: {},
  khatma: {}
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      if (data.trim()) db = JSON.parse(data);
    }
  } catch (e) {
    console.log("⚠️ تعذر قراءة قاعدة البيانات");
  }

  db.users ||= {};
  db.groups ||= {};
  db.daily ||= {};
  db.transactions ||= [];
  db.replies ||= {};
  db.shortcuts ||= {};
  db.khatma ||= {};
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log("❌ خطأ حفظ:", e.message);
  }
}

loadDB();

/* =========================================================
   أدوات عامة
========================================================= */

function money(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clean(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function isGroup(msg) {
  return (
    msg.chat &&
    (msg.chat.type === "group" ||
      msg.chat.type === "supergroup")
  );
}

function userId(msg) {
  return String(msg.from.id);
}

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      id: chatId,
      games: true,
      bank: true,
      members: {}
    };
  }

  db.groups[id].members ||= {};

  return db.groups[id];
}

function getUser(msg) {
  const id = userId(msg);

  if (!db.users[id]) {
    db.users[id] = {
      id: msg.from.id,
      name: msg.from.first_name || "عضو",
      username: msg.from.username || "",
      money: 0,
      points: 0,
      wins: 0,
      losses: 0,
      games: 0,
      messages: 0,
      streak: 0,
      premium: false,
      created: Date.now()
    };
  }

  const u = db.users[id];

  u.name = msg.from.first_name || u.name;
  u.username = msg.from.username || u.username;

  return u;
}

/* تسجيل رسالة مرة واحدة */
function registerMessage(msg) {
  const u = getUser(msg);

  if (msg.__gojoRegistered) return u;

  msg.__gojoRegistered = true;

  u.messages++;

  if (isGroup(msg)) {
    const g = ensureGroup(msg.chat.id);
    const id = userId(msg);

    if (!g.members[id]) {
      g.members[id] = {
        messages: 0,
        games: 0,
        wins: 0,
        losses: 0,
        streak: 0
      };
    }

    g.members[id].messages++;
  }

  saveDB();

  return u;
}

function getGroupMember(msg, targetId) {
  const g = ensureGroup(msg.chat.id);
  const id = String(targetId);

  if (!g.members[id]) {
    g.members[id] = {
      messages: 0,
      games: 0,
      wins: 0,
      losses: 0,
      streak: 0
    };
  }

  return g.members[id];
}

async function send(msg, text, options = {}) {
  try {
    return await bot.sendMessage(msg.chat.id, text, options);
  } catch (e) {
    console.log("Telegram:", e.message);
  }
}

async function isAdmin(chatId, id) {
  try {
    const member = await bot.getChatMember(chatId, id);

    return (
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch {
    return false;
  }
}

async function isOwnerOfGroup(chatId, id) {
  try {
    const member = await bot.getChatMember(chatId, id);
    return member.status === "creator";
  } catch {
    return false;
  }
}

async function getRole(msg, targetId = null) {
  if (!isGroup(msg)) return "عضو";

  const id = targetId || msg.from.id;

  try {
    const member = await bot.getChatMember(
      msg.chat.id,
      id
    );

    if (member.status === "creator") {
      return "سلطان";
    }

    if (member.status === "administrator") {
      return "مالك مساعد";
    }
  } catch {}

  const u = db.users[String(id)];

  if (u && u.premium) {
    return "مميز";
  }

  return "عضو";
}

/* =========================================================
   ألعاب الجروبات فقط
========================================================= */

const games = {
  "عواصم": {
    reward: 10000,
    questions: [
      ["ما عاصمة مصر؟", "القاهرة"],
      ["ما عاصمة السعودية؟", "الرياض"],
      ["ما عاصمة فرنسا؟", "باريس"],
      ["ما عاصمة اليابان؟", "طوكيو"],
      ["ما عاصمة العراق؟", "بغداد"],
      ["ما عاصمة الأردن؟", "عمان"],
      ["ما عاصمة المغرب؟", "الرباط"],
      ["ما عاصمة الجزائر؟", "الجزائر"],
      ["ما عاصمة تونس؟", "تونس"],
      ["ما عاصمة إيطاليا؟", "روما"]
    ]
  },

  "عربي": {
    reward: 20000,
    questions: [
      ["ما مفرد أشجار؟", "شجرة"],
      ["ما جمع كتاب؟", "كتب"],
      ["ما مفرد أقلام؟", "قلم"],
      ["ما جمع مدرسة؟", "مدارس"],
      ["ما عكس كلمة كبير؟", "صغير"],
      ["ما عكس كلمة سريع؟", "بطيء"],
      ["ما مفرد رجال؟", "رجل"],
      ["ما جمع بيت؟", "بيوت"],
      ["ما مفرد نساء؟", "امرأة"],
      ["ما جمع طريق؟", "طرق"]
    ]
  },

  "رياضيات": {
    reward: 30000,
    questions: [
      ["7 × 8 = ؟", "56"],
      ["10 + 25 = ؟", "35"],
      ["100 - 45 = ؟", "55"],
      ["9 × 9 = ؟", "81"],
      ["12 × 12 = ؟", "144"],
      ["150 ÷ 5 = ؟", "30"],
      ["25 × 4 = ؟", "100"],
      ["99 + 1 = ؟", "100"],
      ["200 - 75 = ؟", "125"],
      ["15 × 6 = ؟", "90"]
    ]
  },

  "حزوره": {
    reward: 50000,
    questions: [
      ["شيء كلما أخذت منه كبر، ما هو؟", "الحفرة"],
      ["له أسنان ولا يعض، ما هو؟", "المشط"],
      ["شيء يمشي بلا رجلين، ما هو؟", "الوقت"],
      ["له عين ولا يرى، ما هو؟", "الإبرة"],
      ["له أوراق وليس شجرة، ما هو؟", "الكتاب"],
      ["شيء إذا وضعته في الثلاجة لا يبرد، ما هو؟", "الفلفل الحار"],
      ["ما الشيء الذي يكتب ولا يقرأ؟", "القلم"],
      ["شيء يسمع بلا أذن ويتكلم بلا لسان؟", "الصدى"]
    ]
  },

  "خمن": {
    reward: 100000,
    questions: [
      ["له أسنان ولا يعض، من هو؟", "المشط"],
      ["له عين ولا يرى، ما هو؟", "الإبرة"],
      ["له أوراق وليس شجرة، ما هو؟", "الكتاب"],
      ["شيء كلما زاد نقص، ما هو؟", "العمر"],
      ["ما الشيء الذي إذا كسرته لا تسمع له صوتًا؟", "الوعد"],
      ["شيء يوجد في القرن مرة وفي الدقيقة مرتين ولا يوجد في الساعة؟", "حرف القاف"],
      ["ما الشيء الذي يمشي ويقف وليس له أرجل؟", "الساعة"],
      ["شيء له رقبة وليس له رأس؟", "الزجاجة"]
    ]
  }
};

const activeGames = {};
const usedQuestions = {};

/* اختيار سؤال بدون تكرار */
function getRandomQuestion(chatId, gameName) {
  usedQuestions[chatId] ||= {};
  usedQuestions[chatId][gameName] ||= [];

  const list = games[gameName].questions;

  let available = list
    .map((q, i) => i)
    .filter(
      i => !usedQuestions[chatId][gameName].includes(i)
    );

  if (available.length === 0) {
    usedQuestions[chatId][gameName] = [];
    available = list.map((q, i) => i);
  }

  const index =
    available[random(0, available.length - 1)];

  usedQuestions[chatId][gameName].push(index);

  return list[index];
}

async function startGame(msg, gameName) {
  if (!isGroup(msg)) return false;

  const group = ensureGroup(msg.chat.id);

  if (!group.games) {
    await send(msg, "⛔ الألعاب مقفولة في الجروب.");
    return true;
  }

  const chatId = String(msg.chat.id);

  const q = getRandomQuestion(
    chatId,
    gameName
  );

  activeGames[chatId] = {
    type: "question",
    game: gameName,
    answer: clean(q[1]),
    reward: games[gameName].reward,
    startedBy: msg.from.id
  };

  const u = getUser(msg);
  const gm = getGroupMember(
    msg,
    msg.from.id
  );

  u.games++;
  gm.games++;

  saveDB();

  await send(
    msg,
    `🎮 ${gameName}

❓ ${q[0]}

🏆 الجائزة:
💰 ${money(games[gameName].reward)} ﷼

⚡ أول إجابة صحيحة تكسب!`
  );

  return true;
}

async function startGuess(msg) {
  if (!isGroup(msg)) return false;

  const group = ensureGroup(msg.chat.id);

  if (!group.games) {
    await send(msg, "⛔ الألعاب مقفولة.");
    return true;
  }

  const chatId = String(msg.chat.id);

  activeGames[chatId] = {
    type: "number",
    number: random(1, 20),
    reward: 100000
  };

  const u = getUser(msg);
  const gm = getGroupMember(
    msg,
    msg.from.id
  );

  u.games++;
  gm.games++;

  saveDB();

  await send(
    msg,
    `🎯 لعبة التخمين

خمنت رقم من 1 إلى 20 🤫

💰 الجائزة:
100,000 ﷼

اكتب رقمك!`
  );

  return true;
}

async function runGame(msg, text) {
  if (!isGroup(msg)) return false;

  const name = Object.keys(games).find(
    g => clean(g) === clean(text)
  );

  if (name) {
    await startGame(msg, name);
    return true;
  }

  if (clean(text) === "تخمين") {
    await startGuess(msg);
    return true;
  }

  return false;
}

/* =========================================================
   /العاب - الجروب فقط
========================================================= */

function groupGamesMenu() {
  return `
🎮 ألعاب Gojo Esultan

━━━━━━━━━━━━━━

🏆 5 ألعاب فقط:

↢ عواصم
↢ عربي
↢ رياضيات
↢ حزوره
↢ تخمين

━━━━━━━━━━━━━━

💰 الجوائز:

عواصم → 10,000 ﷼
عربي → 20,000 ﷼
رياضيات → 30,000 ﷼
حزوره → 50,000 ﷼
تخمين → 100,000 ﷼

💡 اكتب اسم اللعبة مباشرة.
`;
}

bot.onText(/^\/العاب$/i, async msg => {
  registerMessage(msg);

  if (!isGroup(msg)) {
    return send(
      msg,
      `🎮 الألعاب تعمل داخل الجروبات فقط.

📖 في الخاص استخدم القائمة الرئيسية.`
    );
  }

  await send(msg, groupGamesMenu());
});

bot.onText(/^العاب$/i, async msg => {
  registerMessage(msg);

  if (!isGroup(msg)) {
    return send(
      msg,
      `🎮 الألعاب تعمل داخل الجروبات فقط.

📖 في الخاص استخدم القائمة الرئيسية.`
    );
  }

  await send(msg, groupGamesMenu());
});

/* =========================================================
   الخاص
========================================================= */

function privateMenu() {
  return `
👋 أهلاً بيك في Gojo Esultan

━━━━━━━━━━━━━━

📖 القرآن الكريم
اختر السورة واستمع للتلاوة.

🕌 الختمة
ابدأ من الصفر أو تابع ختمتك.

💰 فلوسي
اعرف رصيدك.

🏆 التوب
اعرف المتصدرين.

━━━━━━━━━━━━━━

🎮 الألعاب تعمل في الجروبات فقط.`;
}

bot.onText(/^\/start$/i, async msg => {
  registerMessage(msg);

  if (isGroup(msg)) {
    return send(
      msg,
      `👋 أهلاً بيك

🎮 اكتب العاب لعرض ألعاب الجروب.
💰 اكتب فلوسي لمعرفة رصيدك.`
    );
  }

  await send(
    msg,
    privateMenu(),
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📖 القرآن",
              callback_data: "quran_menu"
            }
          ],
          [
            {
              text: "🕌 الختمة",
              callback_data: "khatma_menu"
            }
          ],
          [
            {
              text: "💰 فلوسي",
              callback_data: "private_money"
            },
            {
              text: "🏆 التوب",
              callback_data: "private_top"
            }
          ]
        ]
      }
    }
  );
});

/* =========================================================
   القرآن
========================================================= */

const surahs = [
"الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام",
"الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد",
"إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه",
"الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء",
"النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب",
"سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى",
"الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات",
"ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة",
"الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة",
"المنافقون","التغابن","الطلاق","التحريم","الملك","القلم",
"الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة",
"الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير",
"الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى",
"الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح",
"التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة",
"التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر",
"الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"
];

function quranKeyboard(page = 0) {
  const perPage = 18;
  const start = page * perPage;
  const items = surahs.slice(start, start + perPage);

  const keyboard = [];

  for (let i = 0; i < items.length; i += 2) {
    const row = [];

    const first = start + i;
    row.push({
      text: `${first + 1} - ${surahs[first]}`,
      callback_data: `surah_${first + 1}`
    });

    if (items[i + 1]) {
      const second = start + i + 1;

      row.push({
        text: `${second + 1} - ${surahs[second]}`,
        callback_data: `surah_${second + 1}`
      });
    }

    keyboard.push(row);
  }

  const nav = [];

  if (page > 0) {
    nav.push({
      text: "⬅️ السابق",
      callback_data: `quran_page_${page - 1}`
    });
  }

  if ((page + 1) * perPage < surahs.length) {
    nav.push({
      text: "التالي ➡️",
      callback_data: `quran_page_${page + 1}`
    });
  }

  if (nav.length) keyboard.push(nav);

  return keyboard;
}

async function showQuranMenu(chatId, page = 0) {
  await bot.sendMessage(
    chatId,
    `📖 القرآن الكريم

اختر السورة:

🎙️ القارئ: مشاري العفاسي`,
    {
      reply_markup: {
        inline_keyboard:
          quranKeyboard(page)
      }
    }
  );
}

bot.on("callback_query", async query => {
  try {
    const data = query.data;
    const chatId = query.message.chat.id;
    const user = query.from;

    await bot.answerCallbackQuery(query.id);

    /* القائمة الرئيسية */
    if (data === "quran_menu") {
      return showQuranMenu(chatId, 0);
    }

    /* صفحات القرآن */
    if (data.startsWith("quran_page_")) {
      const page = Number(
        data.replace("quran_page_", "")
      );

      return showQuranMenu(chatId, page);
    }

    /* سورة */
    if (data.startsWith("surah_")) {
      const number = Number(
        data.replace("surah_", "")
      );

      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 114
      ) {
        return;
      }

      const name = surahs[number - 1];

      const audioUrl =
        `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${number}.mp3`;

      await bot.sendMessage(
        chatId,
        `📖 سورة ${name}

🎙️ مشاري العفاسي`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎧 تشغيل التلاوة",
                  callback_data: `audio_${number}`
                }
              ],
              [
                {
                  text: "🖼 صور السورة",
                  callback_data: `images_${number}`
                }
              ]
            ]
          }
        }
      );

      return;
    }

    /* تشغيل الصوت */
    if (data.startsWith("audio_")) {
      const number = Number(
        data.replace("audio_", "")
      );

      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 114
      ) {
        return;
      }

      const name = surahs[number - 1];

      const url =
        `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${number}.mp3`;

      try {
        await bot.sendAudio(
          chatId,
          url,
          {
            caption:
              `🎙️ سورة ${name}\nالقارئ: مشاري العفاسي`
          },
          {
            filename: `${name}.mp3`,
            contentType: "audio/mpeg"
          }
        );
      } catch (e) {
        await bot.sendMessage(
          chatId,
          `❌ تعذر تشغيل السورة حاليًا.

🔗 حاول مرة أخرى بعد قليل.`
        );
      }

      return;
    }

    /* صور السورة */
    if (data.startsWith("images_")) {
      const number = Number(
        data.replace("images_", "")
      );

      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 114
      ) {
        return;
      }

      await bot.sendMessage(
        chatId,
        `🖼 جاري إرسال صور آيات سورة ${surahs[number - 1]}...

قد تستغرق بعض الوقت لأن السورة قد تحتوي على عدد كبير من الآيات.`
      );

      try {
        const response = await fetch(
          `https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`
        );

        const json = await response.json();

        if (!json.data || !json.data.ayahs) {
          throw new Error("No ayahs");
        }

        for (const ayah of json.data.ayahs) {
          const image =
            `https://cdn.islamic.network/quran/images/high-resolution/${number}_${ayah.numberInSurah}.png`;

          try {
            await bot.sendPhoto(
              chatId,
              image,
              {
                caption:
                  `📖 ${surahs[number - 1]} - الآية ${ayah.numberInSurah}`
              }
            );
          } catch {}
        }
      } catch {
        await bot.sendMessage(
          chatId,
          "❌ تعذر تحميل صور السورة حاليًا."
        );
      }

      return;
    }

    /* الختمة */
    if (data === "khatma_menu") {
      const id = String(user.id);
      const current = db.khatma[id];

      return bot.sendMessage(
        chatId,
        current
          ? `🕌 ختمتك الحالية

📖 السورة الحالية:
${surahs[current.surah - 1]}

📅 بدأت:
${new Date(current.started).toLocaleDateString("ar-EG")}

اختر:`
          : `🕌 ختمة القرآن

لم تبدأ ختمة حتى الآن.

اختر طريقة البداية:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🌙 بدء ختمة من الصفر",
                  callback_data: "khatma_start"
                }
              ],
              [
                {
                  text: "▶️ متابعة ختمتي",
                  callback_data: "khatma_continue"
                }
              ],
              [
                {
                  text: "📖 ختمة اليوم",
                  callback_data: "khatma_today"
                }
              ]
            ]
          }
        }
      );
    }

    if (data === "khatma_start") {
      const id = String(user.id);

      db.khatma[id] = {
        surah: 1,
        started: Date.now(),
        lastDay: new Date().toDateString()
      };

      saveDB();

      return bot.sendMessage(
        chatId,
        `🕌 بدأت ختمتك من الصفر ❤️

📖 ابدأ بسورة الفاتحة.

كل مرة تكمل سورة، اضغط "السورة التالية".`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎧 تشغيل الفاتحة",
                  callback_data: "audio_1"
                }
              ],
              [
                {
                  text: "➡️ السورة التالية",
                  callback_data: "khatma_next"
                }
              ]
            ]
          }
        }
      );
    }

    if (data === "khatma_continue") {
      const id = String(user.id);
      const current = db.khatma[id];

      if (!current) {
        return bot.sendMessage(
          chatId,
          "❌ أنت لم تبدأ ختمة بعد."
        );
      }

      return bot.sendMessage(
        chatId,
        `🕌 نكمل ختمتك

📖 أنت الآن عند:
سورة ${surahs[current.surah - 1]}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎧 تشغيل السورة",
                  callback_data:
                    `audio_${current.surah}`
                }
              ],
              [
                {
                  text: "➡️ السورة التالية",
                  callback_data: "khatma_next"
                }
              ]
            ]
          }
        }
      );
    }

    if (data === "khatma_today") {
      const id = String(user.id);
      const today = new Date().toDateString();

      if (
        db.khatma[id] &&
        db.khatma[id].lastDay === today
      ) {
        return bot.sendMessage(
          chatId,
          `🌙 بدأت ختمة اليوم بالفعل.

📖 السورة:
${surahs[db.khatma[id].surah - 1]}`
        );
      }

      db.khatma[id] = {
        surah: 1,
        started: Date.now(),
        lastDay: today
      };

      saveDB();

      return bot.sendMessage(
        chatId,
        `🌙 تم بدء ختمة اليوم.

📖 سورة الفاتحة`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎧 تشغيل",
                  callback_data: "audio_1"
                }
              ],
              [
                {
                  text: "➡️ التالية",
                  callback_data: "khatma_next"
                }
              ]
            ]
          }
        }
      );
    }

    if (data === "khatma_next") {
      const id = String(user.id);

      if (!db.khatma[id]) {
        return bot.sendMessage(
          chatId,
          "❌ ابدأ ختمتك أولًا."
        );
      }

      if (db.khatma[id].surah >= 114) {
        db.khatma[id].surah = 1;
        db.khatma[id].started = Date.now();
        saveDB();

        return bot.sendMessage(
          chatId,
          "🎉 ما شاء الله!

أتممت الختمة كاملة ❤️

بدأنا ختمة جديدة من سورة الفاتحة."
        );
      }

      db.khatma[id].surah++;

      saveDB();

      const s = db.khatma[id].surah;

      return bot.sendMessage(
        chatId,
        `📖 السورة التالية:

${surahs[s - 1]}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎧 تشغيل",
                  callback_data: `audio_${s}`
                }
              ],
              [
                {
                  text: "➡️ السورة التالية",
                  callback_data: "khatma_next"
                }
              ]
            ]
          }
        }
      );
    }

    /* فلوسي */
    if (data === "private_money") {
      const id = String(user.id);
      const u = db.users[id];

      return bot.sendMessage(
        chatId,
        `💰 حسابك

━━━━━━━━━━━━━━

🆔 رقم الحساب:
${u ? u.account : "سيتم إنشاؤه"}

💵 الرصيد:
${money(u ? u.money : 0)} ﷼

🏆 الفوز:
${money(u ? u.wins : 0)}

🔥 الستريك:
${money(u ? u.streak : 0)}`
      );
    }

    /* التوب */
    if (data === "private_top") {
      return sendTop(chatId, "money");
    }

  } catch (e) {
    console.log("Callback Error:", e.message);
  }
});

/* =========================================================
   رقم الحساب
========================================================= */

function generateAccount() {
  let account;

  do {
    account =
      String(random(10000000, 99999999));
  } while (
    Object.values(db.users).some(
      u => String(u.account) === account
    )
  );

  return account;
}

function ensureAccount(u) {
  if (!u.account) {
    u.account = generateAccount();
    saveDB();
  }

  return u.account;
}

/* =========================================================
   فلوسي
========================================================= */

async function sendMoneyInfo(msg) {
  const u = getUser(msg);
  ensureAccount(u);

  await send(
    msg,
    `💰 حسابك البنكي

━━━━━━━━━━━━━━

🆔 رقم الحساب:
${u.account}

💵 رصيدك:
${money(u.money)} ﷼

🏆 انتصارات:
${money(u.wins)}

🎮 ألعاب:
${money(u.games)}

🔥 ستريك:
${money(u.streak)}

━━━━━━━━━━━━━━

💸 للتحويل:

تحويل رقم_الحساب المبلغ`
  );
}

bot.onText(/^فلوسي$/i, async msg => {
  registerMessage(msg);

  const u = getUser(msg);
  ensureAccount(u);

  await sendMoneyInfo(msg);
});

/* =========================================================
   التوب
========================================================= */

async function sendTop(chatId, type = "money") {
  const users = Object.values(db.users);

  let sorted;

  if (type === "money") {
    sorted = users.sort(
      (a, b) => b.money - a.money
    );
  } else if (type === "games") {
    sorted = users.sort(
      (a, b) => b.wins - a.wins
    );
  } else {
    sorted = users.sort(
      (a, b) => b.streak - a.streak
    );
  }

  sorted = sorted.slice(0, 10);

  let text =
    type === "money"
      ? "💰 توب الفلوس"
      : type === "games"
      ? "🎮 توب الألعاب"
      : "🔥 توب الستريك";

  text += "\n\n";

  sorted.forEach((u, i) => {
    text +=
      `${i + 1}. ${u.name}\n`;

    if (type === "money") {
      text += `💵 ${money(u.money)} ﷼\n`;
    }

    if (type === "games") {
      text += `🏆 ${money(u.wins)} فوز\n`;
    }

    if (type === "streak") {
      text += `🔥 ${money(u.streak)}\n`;
    }

    text += "\n";
  });

  await bot.sendMessage(chatId, text);
}

bot.onText(/^توب فلوس$/i, async msg => {
  registerMessage(msg);
  await sendTop(msg.chat.id, "money");
});

bot.onText(/^توب العاب$/i, async msg => {
  registerMessage(msg);
  await sendTop(msg.chat.id, "games");
});

bot.onText(/^توب ستريك$/i, async msg => {
  registerMessage(msg);
  await sendTop(msg.chat.id, "streak");
});

/* =========================================================
   التحويل برقم الحساب
========================================================= */

bot.onText(/^تحويل$/i, async msg => {
  registerMessage(msg);

  await send(
    msg,
    `💸 طريقة التحويل:

تحويل رقم_الحساب المبلغ

مثال:

تحويل 12345678 500`
  );
});

bot.onText(/^تحويل\s+(\d{8})\s+(\d+)$/i, async msg => {
  registerMessage(msg);

  if (isGroup(msg)) {
    const g = ensureGroup(msg.chat.id);

    if (!g.bank) {
      return send(msg, "⛔ البنك مقفول في الجروب.");
    }
  }

  const sender = getUser(msg);
  ensureAccount(sender);

  const targetAccount = msg.text.match(
    /^تحويل\s+(\d{8})\s+(\d+)$/i
  )[1];

  const amount = Number(
    msg.text.match(
      /^تحويل\s+(\d{8})\s+(\d+)$/i
    )[2]
  );

  if (amount <= 0) {
    return send(msg, "❌ المبلغ غير صحيح.");
  }

  let receiver = null;

  for (const u of Object.values(db.users)) {
    if (String(u.account) === targetAccount) {
      receiver = u;
      break;
    }
  }

  if (!receiver) {
    return send(
      msg,
      "❌ رقم الحساب غير موجود."
    );
  }

  if (receiver.id === sender.id) {
    return send(
      msg,
      "❌ مينفعش تحول لنفسك."
    );
  }

  if (sender.money < amount) {
    return send(
      msg,
      `❌ رصيدك غير كافي.

💵 رصيدك:
${money(sender.money)} ﷼`
    );
  }

  sender.money -= amount;
  receiver.money += amount;

  db.transactions.push({
    type: "transfer",
    from: sender.id,
    to: receiver.id,
    amount,
    date: Date.now()
  });

  saveDB();

  await send(
    msg,
    `💸 تم التحويل بنجاح!

👤 المستلم:
${receiver.name}

🆔 الحساب:
${receiver.account}

💵 المبلغ:
${money(amount)} ﷼

💳 رصيدك:
${money(sender.money)} ﷼`
  );
});

/* =========================================================
   اليومية
========================================================= */

bot.onText(/^يومي$/i, async msg => {
  registerMessage(msg);

  const u = getUser(msg);
  const id = userId(msg);
  const now = Date.now();
  const day = 86400000;

  if (
    db.daily[id] &&
    now - db.daily[id] < day
  ) {
    const left =
      day - (now - db.daily[id]);

    return send(
      msg,
      `⏳ أخذت اليومية قبل كده.

ارجع بعد ${Math.ceil(
        left / 3600000
      )} ساعة.`
    );
  }

  const reward = random(1000, 5000);

  u.money += reward;
  u.points += 2;

  db.daily[id] = now;

  db.transactions.push({
    type: "daily",
    user: id,
    amount: reward,
    date: Date.now()
  });

  saveDB();

  await send(
    msg,
    `🎁 اليومية وصلت!

💵 +${money(reward)} ﷼
⭐ +2 نقاط

💳 رصيدك:
${money(u.money)} ﷼`
  );
});

/* =========================================================
   كشف بالـ Reply
========================================================= */

async function showProfile(msg) {
  let target = msg.from;

  if (isGroup(msg) && msg.reply_to_message) {
    target =
      msg.reply_to_message.from;
  }

  const id = String(target.id);

  if (!db.users[id]) {
    db.users[id] = {
      id: target.id,
      name: target.first_name || "عضو",
      username: target.username || "",
      money: 0,
      points: 0,
      wins: 0,
      losses: 0,
      games: 0,
      messages: 0,
      streak: 0,
      premium: false,
      account: generateAccount(),
      created: Date.now()
    };
  }

  const u = db.users[id];

  if (!u.account) {
    u.account = generateAccount();
  }

  let groupMessages = u.messages;

  if (isGroup(msg)) {
    const gm =
      getGroupMember(msg, target.id);

    groupMessages = gm.messages;
  }

  const role =
    await getRole(msg, target.id);

  const username = target.username
    ? `@${target.username}`
    : "لا يوجد يوزر";

  await send(
    msg,
    `🔎 كشف العضو

━━━━━━━━━━━━━━

👤 الاسم:
${target.first_name || "عضو"}

🔗 اليوزر:
${username}

🆔 ID:
${target.id}

👑 الرتبة:
${role}

💬 رسائله في الجروب:
${money(groupMessages)}

💵 الرصيد:
${money(u.money)} ﷼

🏆 الفوز:
${money(u.wins)}

🔥 الستريك:
${money(u.streak)}

🎮 الألعاب:
${money(u.games)}

━━━━━━━━━━━━━━
🤖 Gojo Esultan`
  );
}

bot.onText(/^كشف$/i, async msg => {
  registerMessage(msg);
  await showProfile(msg);
});

/* =========================================================
   إضافة فلوس للمالك فقط
========================================================= */

function isBotOwner(msg) {
  return (
    String(msg.from.username || "")
      .toLowerCase() ===
    BOT_OWNER.toLowerCase()
  );
}

bot.onText(
  /^اضف فلوس\s+(\d{8})\s+(\d+)$/i,
  async msg => {
    registerMessage(msg);

    if (!isBotOwner(msg)) {
      return send(
        msg,
        "❌ الأمر ده متاح لمالك البوت فقط."
      );
    }

    const match =
      msg.text.match(
        /^اضف فلوس\s+(\d{8})\s+(\d+)$/i
      );

    const account = match[1];
    const amount = Number(match[2]);

    let target = null;

    for (const u of Object.values(db.users)) {
      if (String(u.account) === account) {
        target = u;
        break;
      }
    }

    if (!target) {
      return send(
        msg,
        "❌ رقم الحساب غير موجود."
      );
    }

    target.money += amount;

    db.transactions.push({
      type: "admin_add",
      by: msg.from.id,
      to: target.id,
      amount,
      date: Date.now()
    });

    saveDB();

    await send(
      msg,
      `💰 تمت إضافة الأموال!

👤 ${target.name}

🆔 الحساب:
${target.account}

💵 +${money(amount)} ﷼

💳 الرصيد:
${money(target.money)} ﷼`
    );
  }
);

/* =========================================================
   صلاحيات الإدارة
========================================================= */

async function requireAdmin(msg) {
  if (!isGroup(msg)) {
    await send(
      msg,
      "❌ الأمر ده للجروبات فقط."
    );
    return false;
  }

  if (
    !(await isAdmin(
      msg.chat.id,
      msg.from.id
    ))
  ) {
    await send(
      msg,
      "❌ الأمر ده للمشرفين فقط."
    );

    return false;
  }

  return true;
}

async function requireOwnerOrAdmin(msg) {
  return requireAdmin(msg);
}

/* =========================================================
   قفل وفتح الألعاب
========================================================= */

bot.onText(/^قفل العاب$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  const g = ensureGroup(msg.chat.id);

  g.games = false;

  saveDB();

  await send(
    msg,
    "🔒 تم قفل الألعاب."
  );
});

bot.onText(/^فتح العاب$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  const g = ensureGroup(msg.chat.id);

  g.games = true;

  saveDB();

  await send(
    msg,
    "🔓 تم فتح الألعاب."
  );
});

bot.onText(/^قفل البنك$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  const g = ensureGroup(msg.chat.id);

  g.bank = false;

  saveDB();

  await send(
    msg,
    "🔒 تم قفل البنك."
  );
});

bot.onText(/^فتح البنك$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  const g = ensureGroup(msg.chat.id);

  g.bank = true;

  saveDB();

  await send(
    msg,
    "🔓 تم فتح البنك."
  );
});

/* =========================================================
   رفع مميز
========================================================= */

bot.onText(/^رفع مميز$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على الشخص واكتب رفع مميز."
    );
  }

  const target =
    msg.reply_to_message.from;

  const u = getUser({
    from: target,
    chat: msg.chat
  });

  u.premium = true;

  saveDB();

  await send(
    msg,
    `⭐ تم رفع ${target.first_name} إلى مميز.`
  );
});

bot.onText(/^ازالة مميز$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على الشخص."
    );
  }

  const id =
    String(
      msg.reply_to_message.from.id
    );

  if (db.users[id]) {
    db.users[id].premium = false;
  }

  saveDB();

  await send(
    msg,
    "✅ تم إزالة رتبة مميز."
  );
});

/* =========================================================
   كتم
========================================================= */

bot.onText(/^كتم$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو."
    );
  }

  try {
    await bot.restrictChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id,
      {
        permissions: {
          can_send_messages: false
        }
      }
    );

    await send(
      msg,
      "🔇 تم كتم العضو."
    );
  } catch {
    await send(
      msg,
      "❌ تأكد أن البوت مشرف ولديه صلاحية تقييد الأعضاء."
    );
  }
});

bot.onText(/^فك كتم$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو."
    );
  }

  try {
    await bot.restrictChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id,
      {
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_invite_users: true
        }
      }
    );

    await send(
      msg,
      "🔊 تم فك الكتم."
    );
  } catch {
    await send(
      msg,
      "❌ حصل خطأ أثناء فك الكتم."
    );
  }
});

/* =========================================================
   طرد
========================================================= */

bot.onText(/^طرد$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو."
    );
  }

  try {
    await bot.banChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id
    );

    await send(
      msg,
      "🚫 تم طرد العضو."
    );
  } catch {
    await send(
      msg,
      "❌ تأكد أن البوت مشرف ولديه صلاحية الطرد."
    );
  }
});

/* =========================================================
   رفع مشرف
   فقط سلطان أو مالك مساعد
========================================================= */

bot.onText(/^رفع مشرف$/i, async msg => {
  registerMessage(msg);

  if (!isGroup(msg)) {
    return send(
      msg,
      "❌ الأمر للجروبات فقط."
    );
  }

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على الشخص."
    );
  }

  const actorRole =
    await getRole(msg);

  if (
    actorRole !== "سلطان" &&
    actorRole !== "مالك مساعد"
  ) {
    return send(
      msg,
      "❌ رفع المشرف متاح للسلطان أو المالك المساعد فقط."
    );
  }

  try {
    await bot.promoteChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id,
      {
        can_manage_chat: true,
        can_delete_messages: true,
        can_manage_video_chats: true,
        can_restrict_members: true,
        can_promote_members: false,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true
      }
    );

    await send(
      msg,
      `👑 تم رفع ${msg.reply_to_message.from.first_name} إلى مشرف.`
    );
  } catch {
    await send(
      msg,
      `❌ لم أستطع رفعه.

تأكد أن البوت نفسه مشرف ولديه صلاحية إضافة مشرفين.`
    );
  }
});

/* =========================================================
   الاختصارات
========================================================= */

bot.onText(/^اضف اختصار$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      `❌ اعمل Reply على الرسالة التي تريد ربطها بالاختصار.

مثال:
اضف اختصار

ثم اكتب اسم الاختصار.`
    );
  }

  const groupId =
    String(msg.chat.id);

  db.shortcuts[groupId] ||= {};

  db.shortcuts[groupId]._pending = {
    admin: msg.from.id,
    messageId:
      msg.reply_to_message.message_id
  };

  saveDB();

  await send(
    msg,
    `⚡ اكتب الآن اسم الاختصار.

مثال:
اهلا`
  );
});

bot.onText(/^حذف اختصار$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  const groupId =
    String(msg.chat.id);

  db.shortcuts[groupId] ||= {};

  db.shortcuts[groupId]._deletePending =
    msg.from.id;

  saveDB();

  await send(
    msg,
    "🗑 اكتب اسم الاختصار الذي تريد حذفه."
  );
});

/* =========================================================
   الردود
========================================================= */

bot.onText(/^اضف رد$/i, async msg => {
  registerMessage(msg);

  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      `❌ اعمل Reply على الرسالة التي تريد حفظها ثم اكتب:

اضف رد`
    );
  }

  const groupId =
    String(msg.chat.id);

  db.replies[groupId] ||= {};

  db.replies[groupId]._pending = {
    admin: msg.from.id,
    sourceMessageId:
      msg.reply_to_message.message_id
  };

  saveDB();

  await send(
    msg,
    `📝 اكتب اسم الرد الآن.

مثال:
اهلاً`
  );
});

/* =========================================================
   معالجة الردود والاختصارات
========================================================= */

async function handleSavedItems(msg) {
  if (!isGroup(msg)) return false;

  const groupId =
    String(msg.chat.id);

  /* إعداد رد */
  if (
    db.replies[groupId] &&
    db.replies[groupId]._pending
  ) {
    const pending =
      db.replies[groupId]._pending;

    if (pending.admin !== msg.from.id) {
      return false;
    }

    if (!msg.text) {
      return false;
    }

    const name = clean(msg.text);

    if (!name) return false;

    delete db.replies[groupId]._pending;

    db.replies[groupId][name] = {
      sourceChatId: msg.chat.id,
      sourceMessageId:
        pending.sourceMessageId,
      createdBy: msg.from.id,
      created: Date.now()
    };

    saveDB();

    await send(
      msg,
      `💎 تم حفظ الرد.

أرسل:
${msg.text}

لإرسال الرد المحفوظ.`
    );

    return true;
  }

  /* حذف رد */
  if (
    db.replies[groupId] &&
    db.replies[groupId]._deletePending
  ) {
    const admin =
      db.replies[groupId]._deletePending;

    if (admin !== msg.from.id) {
      return false;
    }

    if (!msg.text) return false;

    const name = clean(msg.text);

    if (
      db.replies[groupId][name]
    ) {
      delete db.replies[groupId][name];

      delete db.replies[groupId]
        ._deletePending;

      saveDB();

      await send(
        msg,
        `🗑 تم حذف الرد:
${msg.text}`
      );

      return true;
    }

    delete db.replies[groupId]
      ._deletePending;

    await send(
      msg,
      "❌ الرد ده مش موجود."
    );

    return true;
  }

  /* إعداد اختصار */
  if (
    db.shortcuts[groupId] &&
    db.shortcuts[groupId]._pending
  ) {
    const pending =
      db.shortcuts[groupId]._pending;

    if (pending.admin !== msg.from.id) {
      return false;
    }

    if (!msg.text) return false;

    const name = clean(msg.text);

    db.shortcuts[groupId][name] = {
      messageId:
        pending.messageId,
      createdBy: msg.from.id,
      created: Date.now()
    };

    delete db.shortcuts[groupId]._pending;

    saveDB();

    await send(
      msg,
      `⚡ تم حفظ الاختصار:

${msg.text}

أرسله في الجروب لتشغيله.`
    );

    return true;
  }

  /* حذف اختصار */
  if (
    db.shortcuts[groupId] &&
    db.shortcuts[groupId]._deletePending
  ) {
    const admin =
      db.shortcuts[groupId]._deletePending;

    if (admin !== msg.from.id) {
      return false;
    }

    if (!msg.text) return false;

    const name = clean(msg.text);

    if (
      db.shortcuts[groupId][name]
    ) {
      delete db.shortcuts[groupId][name];

      delete db.shortcuts[groupId]
        ._deletePending;

      saveDB();

      await send(
        msg,
        `🗑 تم حذف الاختصار:
${msg.text}`
      );

      return true;
    }

    delete db.shortcuts[groupId]
      ._deletePending;

    await send(
      msg,
      "❌ الاختصار غير موجود."
    );

    return true;
  }

  /* تشغيل رد محفوظ */
  if (
    msg.text &&
    db.replies[groupId]
  ) {
    const name = clean(msg.text);
    const saved =
      db.replies[groupId][name];

    if (
      saved &&
      saved.sourceMessageId
    ) {
      try {
        await bot.copyMessage(
          msg.chat.id,
          saved.sourceChatId,
          saved.sourceMessageId
        );

        return true;
      } catch (e) {
        console.log(
          "Copy reply error:",
          e.message
        );
      }
    }
  }

  /* تشغيل اختصار محفوظ */
  if (
    msg.text &&
    db.shortcuts[groupId]
  ) {
    const name = clean(msg.text);
    const shortcut =
      db.shortcuts[groupId][name];

    if (
      shortcut &&
      shortcut.messageId
    ) {
      try {
        await bot.copyMessage(
          msg.chat.id,
          msg.chat.id,
          shortcut.messageId
        );

        return true;
      } catch (e) {
        console.log(
          "Shortcut error:",
          e.message
        );
      }
    }
  }

  return false;
}

/* =========================================================
   معالجة إجابات الألعاب + الألعاب
========================================================= */

bot.on("message", async msg => {
  try {
    if (msg.from?.is_bot) return;

    registerMessage(msg);

    /* الخاص:
       لا ألعاب */
    if (!isGroup(msg)) {
      return;
    }

    const chatId =
      String(msg.chat.id);

    /* الردود والاختصارات */
    if (
      await handleSavedItems(msg)
    ) {
      return;
    }

    /* إجابة لعبة */
    if (activeGames[chatId]) {
      const game =
        activeGames[chatId];

      const text =
        String(msg.text || "").trim();

      /* تخمين رقم */
      if (
        game.type === "number" &&
        /^\d+$/.test(text)
      ) {
        const guess =
          Number(text);

        if (
          guess < 1 ||
          guess > 20
        ) {
          return;
        }

        const u = getUser(msg);
        const gm =
          getGroupMember(
            msg,
            msg.from.id
          );

        delete activeGames[chatId];

        if (guess === game.number) {
          u.wins++;
          u.points += 10;
          u.money += game.reward;
          u.streak++;
          gm.wins++;
          gm.streak++;

          db.transactions.push({
            type: "game",
            user: u.id,
            amount: game.reward,
            game: "تخمين",
            date: Date.now()
          });

          saveDB();

          return send(
            msg,
            `🎉 إجابة صحيحة!

👤 الفائز:
${msg.from.first_name}

🏆 +1 فوز
⭐ +10 نقاط
🔥 ستريك: ${gm.streak}

💰 +${money(game.reward)} ﷼

💳 رصيدك:
${money(u.money)} ﷼`
          );
        }

        u.losses++;
        u.streak = 0;
        gm.losses++;
        gm.streak = 0;

        saveDB();

        return send(
          msg,
          `❌ إجابة غلط!

🎯 الرقم الصحيح:
${game.number}

🔥 تم تصفير الستريك.`
        );
      }

      /* ألعاب الأسئلة */
      if (
        game.type === "question" &&
        text
      ) {
        if (
          clean(text) ===
          game.answer
        ) {
          const u =
            getUser(msg);

          const gm =
            getGroupMember(
              msg,
              msg.from.id
            );

          delete activeGames[chatId];

          u.wins++;
          u.points += 3;
          u.money += game.reward;
          u.streak++;

          gm.wins++;
          gm.streak++;

          db.transactions.push({
            type: "game",
            user: u.id,
            amount: game.reward,
            game: game.game,
            date: Date.now()
          });

          saveDB();

          return send(
            msg,
            `🎉 إجابة صحيحة!

👤 الفائز:
${msg.from.first_name}

🏆 +1 فوز
⭐ +3 نقاط
🔥 ستريك: ${gm.streak}

💰 +${money(game.reward)} ﷼

💳 رصيدك:
${money(u.money)} ﷼`
          );
        }
      }
    }

    /* تشغيل لعبة جديدة */
    if (
      msg.text &&
      !msg.text.startsWith("/") &&
      msg.text.length < 50
    ) {
      await runGame(
        msg,
        msg.text.trim()
      );
    }

  } catch (e) {
    console.log(
      "Message Error:",
      e.message
    );
  }
});

/* =========================================================
   دخول عضو جديد
========================================================= */

bot.on(
  "new_chat_members",
  async msg => {
    try {
      if (!msg.new_chat_members) return;

      for (
        const member of msg.new_chat_members
      ) {
        if (member.is_bot) continue;

        const fakeMsg = {
          from: member,
          chat: msg.chat
        };

        const u =
          getUser(fakeMsg);

        ensureAccount(u);

        await bot.sendMessage(
          msg.chat.id,
          `👋 أهلاً بيك يا ${member.first_name}

نورت الجروب ❤️

🎮 اكتب العاب للألعاب
💰 اكتب فلوسي لحسابك
🔎 اعمل Reply على رسالة واكتب كشف`
        );
      }
    } catch (e) {
      console.log(
        "Welcome Error:",
        e.message
      );
    }
  }
);

/* =========================================================
   دخول البوت لجروب
========================================================= */

bot.on(
  "my_chat_member",
  async update => {
    try {
      const chat =
        update.chat;

      if (
        chat &&
        (
          chat.type === "group" ||
          chat.type === "supergroup"
        )
      ) {
        ensureGroup(chat.id);
        saveDB();
      }
    } catch (e) {
      console.log(
        "Chat member error:",
        e.message
      );
    }
  }
);

/* =========================================================
   أخطاء وإغلاق
========================================================= */

process.on(
  "SIGINT",
  () => {
    saveDB();
    process.exit(0);
  }
);

process.on(
  "SIGTERM",
  () => {
    saveDB();
    process.exit(0);
  }
);

process.on(
  "uncaughtException",
  error => {
    console.log(
      "❌ Uncaught:",
      error.message
    );

    saveDB();
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.log(
      "❌ Rejection:",
      error
    );

    saveDB();
  }
);

bot.on(
  "polling_error",
  error => {
    console.log(
      "Telegram Polling Error:",
      error.message
    );
  }
);

console.log(
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
);

console.log(
  "🤖 Gojo Esultan Bot"
);

console.log(
  "✅ Bot Started Successfully"
);

console.log(
  "🎮 Group Games: ON"
);

console.log(
  "💰 Riyal Bank: ON"
);

console.log(
  "📖 Quran: ON"
);

console.log(
  "🕌 Khatma: ON"
);

console.log(
  "💎 Replies: ON"
);

console.log(
  "⚡ Shortcuts: ON"
);

console.log(
  "👑 Admin System: ON"
);

console.log(
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
);
