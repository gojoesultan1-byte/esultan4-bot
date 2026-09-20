const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;

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
  games: {},
  transactions: []
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      if (data.trim()) db = JSON.parse(data);
    }
  } catch {
    console.log("⚠️ تعذر قراءة قاعدة البيانات، سيتم إنشاء قاعدة جديدة");
  }

  db.users ||= {};
  db.groups ||= {};
  db.daily ||= {};
  db.games ||= {};
  db.transactions ||= [];
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log("❌ خطأ حفظ قاعدة البيانات:", e.message);
  }
}

loadDB();

function userId(msg) {
  return String(msg.from.id);
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
      premium: false,
      created: Date.now()
    };
  }

  const u = db.users[id];

  u.name = msg.from.first_name || u.name;
  u.username = msg.from.username || u.username;
  u.messages++;

  saveDB();

  return u;
}

function getGroup(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      id: chatId,
      enabled: true,
      bank: true,
      games: true
    };
    saveDB();
  }

  return db.groups[id];
}

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

async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);

    return (
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch {
    return false;
  }
}

async function getRole(msg) {
  if (!msg.chat || !["group", "supergroup"].includes(msg.chat.type)) {
    return "عضو";
  }

  try {
    const member = await bot.getChatMember(
      msg.chat.id,
      msg.from.id
    );

    if (member.status === "creator") {
      return "سلطان";
    }

    if (member.status === "administrator") {
      return "مالك مساعد";
    }
  } catch {}

  const u = getUser(msg);

  if (u.premium) return "مميز";

  return "عضو";
}

async function send(msg, text, options = {}) {
  try {
    return await bot.sendMessage(msg.chat.id, text, options);
  } catch (e) {
    console.log("Telegram:", e.message);
  }
}

/* =========================
   القوائم
========================= */

const photoGames = [
  "ميكب",
  "زوم",
  "صور",
  "شاعر",
  "جدول",
  "طبخات",
  "مسلسل",
  "المختلف",
  "صور فنانين",
  "شخصيات انمي"
];

const textGames = [
  "اسالني",
  "عواصم",
  "خمن",
  "كلمات",
  "عربي",
  "اكمل",
  "خلوه مع ذاتك",
  "انقليزي",
  "تفكيك",
  "الاسرع",
  "العكس",
  "حزوره",
  "ترتيب",
  "علم دول",
  "دين",
  "عامه",
  "كبو العشاء",
  "رياضيات",
  "مصطلح",
  "تركيب",
  "كت تويت",
  "لو خيروك",
  "سرعه",
  "صراحه",
  "اعرف المثل",
  "اختر حرف",
  "حروف",
  "خلينا نهوجس",
  "ايموجي"
];

const addedGames = [
  "ضحكيني عنود",
  "غنيلي",
  "بغني",
  "عجلة النجوم",
  "قرعة",
  "تخمين"
];

const groupGames = [
  "فك الشفرة",
  "قنص",
  "روليت روسي",
  "كراجي",
  "مزاد البقاء",
  "العمدة",
  "روليت دول",
  "روليت",
  "معركة الاساطير",
  "بدء تخمين",
  "اسطبلي",
  "جوابك جوابهم",
  "المعركة",
  "صراع العقول",
  "حزر",
  "احكام",
  "عقاب",
  "حكم",
  "تحديات",
  "كرسي اعتراف"
];

const allGames = [
  ...photoGames,
  ...textGames,
  ...addedGames,
  ...groupGames
];

function gamesMenu() {
  return `
🎮 العاب Gojo Esultan 🫰

━━━━━━━━━━━━━━
📸 العاب صور

↢ ${photoGames.join("\n↢ ")}

━━━━━━━━━━━━━━
✍️ العاب كتابية

↢ ${textGames.join("\n↢ ")}

━━━━━━━━━━━━━━
🆕 العاب مضافة

↢ ${addedGames.join("\n↢ ")}

━━━━━━━━━━━━━━
👥 العاب جماعية

↢ ${groupGames.join("\n↢ ")}

━━━━━━━━━━━━━━

💡 اكتب اسم اللعبة في الجروب لتشغيلها مباشرة.
`;
}

/* =========================
   /start
========================= */

bot.onText(/^\/start$/i, async msg => {
  getUser(msg);

  await send(
    msg,
    `👋 أهلاً بيك في بوت Gojo Esultan

🎮 بوت ألعاب وترفيه للجروبات

📋 الألعاب:
اكتب العاب

🏦 البنك:
اكتب البنك

🔎 بياناتك:
اكتب الكشف

💡 تقدر تكتب اسم أي لعبة مباشرة في الجروب.`
  );
});

/* =========================
   الألعاب
========================= */

bot.onText(/^\/العاب$/i, async msg => {
  getUser(msg);
  await send(msg, gamesMenu());
});

bot.onText(/^العاب$/i, async msg => {
  getUser(msg);
  await send(msg, gamesMenu());
});

/* =========================
   البنك
========================= */

bot.onText(/^\/البنك$/i, async msg => {
  const u = getUser(msg);

  await send(
    msg,
    `🏦 بنك Gojo Esultan

━━━━━━━━━━━━━━

💰 رصيدك: ${money(u.money)}

⭐ نقاطك: ${money(u.points)}

🏆 انتصاراتك: ${money(u.wins)}

❌ خسائرك: ${money(u.losses)}

🎮 ألعابك: ${money(u.games)}

━━━━━━━━━━━━━━

📌 أوامر البنك:

💰 رصيدي
🎁 يومي
💸 تحويل
⭐ نقاطي
📊 احصائياتي`
  );
});

bot.onText(/^البنك$/i, async msg => {
  const u = getUser(msg);

  await send(
    msg,
    `🏦 بنك Gojo Esultan

💰 رصيدك: ${money(u.money)}
⭐ نقاطك: ${money(u.points)}

💰 رصيدي
🎁 يومي
💸 تحويل
⭐ نقاطي
📊 احصائياتي`
  );
});

bot.onText(/^رصيدي$/i, async msg => {
  const u = getUser(msg);

  await send(
    msg,
    `💰 رصيدك الحالي:

${money(u.money)} عملة 💵`
  );
});

bot.onText(/^نقاطي$/i, async msg => {
  const u = getUser(msg);

  await send(
    msg,
    `⭐ نقاطك:

${money(u.points)} نقطة`
  );
});

bot.onText(/^احصائياتي$/i, async msg => {
  const u = getUser(msg);

  await send(
    msg,
    `📊 إحصائياتك

👤 ${u.name}

💰 البنك: ${money(u.money)}

⭐ النقاط: ${money(u.points)}

🎮 الألعاب: ${money(u.games)}

🏆 الفوز: ${money(u.wins)}

❌ الخسارة: ${money(u.losses)}

💬 الرسائل: ${money(u.messages)}`
  );
});

/* =========================
   اليومية
========================= */

bot.onText(/^يومي$/i, async msg => {
  const u = getUser(msg);
  const id = userId(msg);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (db.daily[id] && now - db.daily[id] < day) {
    const left = day - (now - db.daily[id]);
    const hours = Math.ceil(left / 3600000);

    return send(
      msg,
      `⏳ أخدت اليومية قبل كده.

ارجع بعد حوالي ${hours} ساعة.`
    );
  }

  const reward = random(100, 500);

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

💰 +${money(reward)} عملة
⭐ +2 نقاط

💳 رصيدك:
${money(u.money)}`
  );
});

/* =========================
   التحويل
========================= */

async function transfer(msg) {
  const text = msg.text.trim();

  const parts = text.split(/\s+/);

  if (parts.length < 3) {
    return send(
      msg,
      `💸 طريقة التحويل:

تحويل @username المبلغ

مثال:
تحويل @ahmed 100`
    );
  }

  const targetUsername =
    parts[1].replace("@", "").toLowerCase();

  const amount = Number(parts[2]);

  if (!Number.isInteger(amount) || amount <= 0) {
    return send(msg, "❌ اكتب مبلغ صحيح.");
  }

  const sender = getUser(msg);

  let receiverId = null;

  for (const id of Object.keys(db.users)) {
    if (
      String(db.users[id].username).toLowerCase() ===
      targetUsername
    ) {
      receiverId = id;
      break;
    }
  }

  if (!receiverId) {
    return send(
      msg,
      "❌ المستخدم مش موجود في قاعدة بيانات البوت."
    );
  }

  if (receiverId === userId(msg)) {
    return send(msg, "❌ مينفعش تحول لنفسك.");
  }

  if (sender.money < amount) {
    return send(
      msg,
      `❌ رصيدك غير كافي.

رصيدك:
${money(sender.money)}`
    );
  }

  const receiver = db.users[receiverId];

  sender.money -= amount;
  receiver.money += amount;

  db.transactions.push({
    type: "transfer",
    from: userId(msg),
    to: receiverId,
    amount,
    date: Date.now()
  });

  saveDB();

  await send(
    msg,
    `💸 تم التحويل بنجاح!

👤 إلى: ${receiver.name}

💰 المبلغ:
${money(amount)}

💳 رصيدك:
${money(sender.money)}`
  );
}

bot.onText(/^تحويل\b/i, transfer);

/* =========================
   الكشف
========================= */

bot.onText(/^\/الكشف$/i, async msg => {
  await showProfile(msg);
});

bot.onText(/^الكشف$/i, async msg => {
  await showProfile(msg);
});

async function showProfile(msg) {
  const u = getUser(msg);
  const role = await getRole(msg);

  await send(
    msg,
    `🔎 كشف العضو

━━━━━━━━━━━━━━

👤 الاسم:
${u.name}

🆔 ID:
${u.id}

👑 الرتبة:
${role}

💰 البنك:
${money(u.money)}

⭐ النقاط:
${money(u.points)}

🎮 الألعاب:
${money(u.games)}

🏆 الفوز:
${money(u.wins)}

❌ الخسارة:
${money(u.losses)}

💬 الرسائل:
${money(u.messages)}

━━━━━━━━━━━━━━
🤖 Gojo Esultan`
  );
}

/* =========================
   نظام التخمين
========================= */

function startGuess(msg) {
  const chat = String(msg.chat.id);

  db.games[chat] = {
    type: "guess",
    number: random(1, 10),
    player: msg.from.id
  };

  const u = getUser(msg);
  u.games++;

  saveDB();

  return send(
    msg,
    `🎯 لعبة التخمين بدأت!

أنا اخترت رقم من 1 إلى 10 🤫

اكتب رقمك الآن.`
  );
}

/* =========================
   لعبة القرعة
========================= */

async function lottery(msg) {
  const u = getUser(msg);

  const results = [
    "🎉 كسبت!",
    "😈 حظك وحش!",
    "🔥 فوز جامد!",
    "😂 خسرت!",
    "💎 جائزة كبيرة!"
  ];

  const result =
    results[random(0, results.length - 1)];

  u.games++;

  if (result.includes("كسبت") || result.includes("فوز")) {
    const reward = random(50, 200);
    u.money += reward;
    u.points += 1;

    saveDB();

    return send(
      msg,
      `🎰 القرعة

${result}

💰 +${reward} عملة
⭐ +1 نقطة`
    );
  }

  saveDB();

  return send(
    msg,
    `🎰 القرعة

${result}

جرب مرة تانية 😂`
  );
}

/* =========================
   لعبة الروليت
========================= */

async function roulette(msg) {
  const u = getUser(msg);
  u.games++;

  const result = random(1, 6);

  if (result === 6) {
    const reward = 300;

    u.money += reward;
    u.points += 3;
    u.wins++;

    saveDB();

    return send(
      msg,
      `🎰 روليت

💎 JACKPOT!

💰 +${reward} عملة
⭐ +3 نقاط
🏆 +1 فوز`
    );
  }

  u.losses++;
  saveDB();

  return send(
    msg,
    `🎰 روليت

🎲 الرقم: ${result}

❌ مفيش جائزة المرة دي.`
  );
}

/* =========================
   أسئلة الألعاب
========================= */

const questions = {

  "عواصم": [
    ["ما عاصمة مصر؟", "القاهرة"],
    ["ما عاصمة السعودية؟", "الرياض"],
    ["ما عاصمة فرنسا؟", "باريس"],
    ["ما عاصمة اليابان؟", "طوكيو"]
  ],

  "رياضيات": [
    ["7 × 8 = ؟", "56"],
    ["10 + 25 = ؟", "35"],
    ["100 - 45 = ؟", "55"],
    ["9 × 9 = ؟", "81"]
  ],

  "دين": [
    ["كم عدد الصلوات المفروضة؟", "5"],
    ["كم عدد أركان الإسلام؟", "5"],
    ["ما أول سورة في القرآن؟", "الفاتحة"]
  ],

  "عامه": [
    ["ما أكبر كوكب في المجموعة الشمسية؟", "المشتري"],
    ["كم عدد أيام الأسبوع؟", "7"],
    ["ما أسرع حيوان بري؟", "الفهد"]
  ],

  "عربي": [
    ["ما جمع كتاب؟", "كتب"],
    ["ما مفرد أشجار؟", "شجرة"],
    ["ما عكس كلمة كبير؟", "صغير"]
  ],

  "انقليزي": [
    ["ما معنى Apple؟", "تفاحة"],
    ["ما معنى Book؟", "كتاب"],
    ["ما معنى Water؟", "ماء"]
  ],

  "اعرف المثل": [
    ["أكمل: الصديق وقت ...", "الضيق"],
    ["أكمل: العلم ...", "نور"],
    ["أكمل: الوقت من ...", "ذهب"]
  ],

  "حزوره": [
    ["شيء كلما أخذت منه كبر، ما هو؟", "الحفرة"],
    ["شيء له أسنان ولا يعض، ما هو؟", "المشط"],
    ["شيء يمشي بلا رجلين، ما هو؟", "الوقت"]
  ],

  "خمن": [
    ["له أسنان ولا يعض، من هو؟", "المشط"],
    ["له عين ولا يرى، ما هو؟", "الإبرة"],
    ["له أوراق وليس شجرة، ما هو؟", "الكتاب"]
  ]
};

const activeQuestions = {};

async function startQuestionGame(msg, gameName) {
  const list = questions[gameName];

  if (!list) return false;

  const q = list[random(0, list.length - 1)];
  const chat = String(msg.chat.id);

  activeQuestions[chat] = {
    game: gameName,
    answer: clean(q[1]),
    player: msg.from.id
  };

  const u = getUser(msg);
  u.games++;

  saveDB();

  await send(
    msg,
    `🎮 ${gameName}

❓ السؤال:

${q[0]}

⏳ أول إجابة صحيحة تكسب!`
  );

  return true;
}

/* =========================
   الألعاب النصية البسيطة
========================= */

const simpleResponses = {

  "ميكب":
    "💄 ميكب\nاختاري رقم من 1 إلى 5!",

  "زوم":
    "🔎 زوم\nخمن الشخصية المخفية!",

  "صور":
    "📸 صور\nابعت صورة في الجروب ونبدأ الجولة.",

  "شاعر":
    "✍️ شاعر\nاذكر اسم شاعر عربي.",

  "جدول":
    "📊 جدول\n9 × 7 = ؟",

  "طبخات":
    "🍳 طبخات\nاذكر أكلة تبدأ بحرف م.",

  "مسلسل":
    "📺 مسلسل\nاذكر اسم مسلسل مصري.",

  "المختلف":
    "🧐 المختلف\n🍎 🍎 🍎 🍌\nمين المختلف؟",

  "صور فنانين":
    "🎤 صور فنانين\nخمن الفنان من الوصف!",

  "شخصيات انمي":
    "🌸 شخصيات أنمي\nخمن شخصية أنمي!",

  "اسالني":
    "❓ اسألني\nاسأل أي سؤال للجروب.",

  "كلمات":
    "🔤 كلمات\nاكتب كلمة تبدأ بحرف م.",

  "اكمل":
    "✍️ أكمل\nالعلم نور و...؟",

  "خلوه مع ذاتك":
    "🤐 خلوه مع ذاتك\nالسؤال سري 😂",

  "تفكيك":
    "🔤 تفكيك\nفكك كلمة «مدرسة» إلى حروفها.",

  "الاسرع":
    "⚡ الأسرع\nأول واحد يكتب GOJO يكسب!",

  "العكس":
    "🔄 العكس\nاكتب عكس كلمة «كبير».",

  "ترتيب":
    "🔢 ترتيب\nرتب: 3 - 1 - 4 - 2",

  "علم دول":
    "🌍 علم دول\n🇪🇬 علم أي دولة؟",

  "مصطلح":
    "📚 مصطلح\nاشرح كلمة «اقتصاد».",

  "تركيب":
    "🧩 تركيب\nركب الحروف: م ـ ص ـ ر",

  "كت تويت":
    "🐦 كت تويت\nاكتب تغريدة من 5 كلمات.",

  "لو خيروك":
    "🤔 لو خيروك\nتعيش بدون هاتف أم بدون إنترنت؟",

  "سرعه":
    "⚡ سرعة\nأول شخص يكتب GOJO يفوز!",

  "صراحه":
    "🔥 صراحة\nمين أكتر شخص بتكلمه يوميًا؟",

  "اختر حرف":
    "🔤 اختر حرف\nاختار حرف ونبدأ.",

  "حروف":
    "🔤 حروف\nاذكر اسم يبدأ بحرف ب.",

  "خلينا نهوجس":
    "🌀 خلينا نهوجس\nقول أول حاجة جت في دماغك.",

  "ايموجي":
    "😂 إيموجي\n🍎 + 📱 = ؟",

  "كبو العشاء":
    "🍽️ كبو العشاء\nاختار شخص من الجروب 😂",

  "ضحكيني عنود":
    "😂 ضحكيني عنود\nجاري اختيار موقف مضحك...",

  "غنيلي":
    "🎤 غنيلي\nاكتب اسم أغنية.",

  "بغني":
    "🎶 بغني\nاختار رقم من 1 إلى 10.",

  "عجلة النجوم":
    "⭐ عجلة النجوم\nجاري تدوير العجلة...",

  "فك الشفرة":
    "🔐 فك الشفرة\nالشفرة: 2-15-10-15",

  "قنص":
    "🎯 قنص\nاختار شخص من الجروب.",

  "روليت روسي":
    "🎰 روليت روسي\nجاري تدوير الروليت...",

  "كراجي":
    "🏎️ كراجي\nاختار عربيتك!",

  "مزاد البقاء":
    "💰 مزاد البقاء\nالمزاد بدأ!",

  "العمدة":
    "👮 العمدة\nجاري اختيار العمدة...",

  "روليت دول":
    "🌍 روليت دول\nجاري اختيار دولة...",

  "معركة الاساطير":
    "⚔️ معركة الأساطير\nالمعركة بدأت!",

  "اسطبلي":
    "🐎 اسطبلي\nاختار حصانك.",

  "جوابك جوابهم":
    "👥 جوابك جوابهم\nجاوب بسرعة!",

  "المعركة":
    "⚔️ المعركة\nاختار خصمك.",

  "صراع العقول":
    "🧠 صراع العقول\nالجولة الأولى بدأت!",

  "حزر":
    "🤔 حزر\nخمن الشيء المخفي.",

  "احكام":
    "⚖️ أحكام\nاختار شخص للحكم.",

  "عقاب":
    "😈 عقاب\nاكتب آخر إيموجي استخدمته.",

  "حكم":
    "⚖️ حكم\nاختار شخص من الجروب.",

  "تحديات":
    "🔥 تحديات\nاكتب جملة بدون حرف الألف.",

  "كرسي اعتراف":
    "🪑 كرسي الاعتراف\nاختار شخص يسألك سؤال."
};

/* =========================
   تشغيل الألعاب بالاسم
========================= */

async function runGame(msg, rawText) {
  const text = clean(rawText);

  if (!allGames.some(g => clean(g) === text)) {
    return false;
  }

  const group = getGroup(msg.chat.id);

  if (!group.games) {
    await send(msg, "⛔ الألعاب مقفولة في الجروب.");
    return true;
  }

  if (text === clean("تخمين") || text === clean("بدء تخمين")) {
    await startGuess(msg);
    return true;
  }

  if (text === clean("قرعة")) {
    await lottery(msg);
    return true;
  }

  if (text === clean("روليت")) {
    await roulette(msg);
    return true;
  }

  const questionKey = Object.keys(questions)
    .find(k => clean(k) === text);

  if (questionKey) {
    await startQuestionGame(msg, questionKey);
    return true;
  }

  const responseKey = Object.keys(simpleResponses)
    .find(k => clean(k) === text);

  if (responseKey) {
    const u = getUser(msg);
    u.games++;
    saveDB();

    await send(msg, simpleResponses[responseKey]);
    return true;
  }

  return true;
}

/* =========================
   أوامر الإدارة
========================= */

async function requireAdmin(msg) {
  if (
    !msg.chat ||
    !["group", "supergroup"].includes(msg.chat.type)
  ) {
    await send(msg, "❌ الأمر ده للجروبات فقط.");
    return false;
  }

  const admin = await isAdmin(
    msg.chat.id,
    msg.from.id
  );

  if (!admin) {
    await send(msg, "❌ الأمر ده للمشرفين فقط.");
    return false;
  }

  return true;
}

bot.onText(/^قفل العاب$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  const g = getGroup(msg.chat.id);
  g.games = false;
  saveDB();

  await send(msg, "🔒 تم قفل الألعاب.");
});

bot.onText(/^فتح العاب$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  const g = getGroup(msg.chat.id);
  g.games = true;
  saveDB();

  await send(msg, "🔓 تم فتح الألعاب.");
});

bot.onText(/^قفل البنك$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  const g = getGroup(msg.chat.id);
  g.bank = false;
  saveDB();

  await send(msg, "🔒 تم قفل البنك.");
});

bot.onText(/^فتح البنك$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  const g = getGroup(msg.chat.id);
  g.bank = true;
  saveDB();

  await send(msg, "🔓 تم فتح البنك.");
});

/* =========================
   مميز
========================= */

bot.onText(/^مميز$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو واكتب مميز."
    );
  }

  const target = msg.reply_to_message;
  const id = String(target.from.id);

  if (!db.users[id]) {
    db.users[id] = {
      id: target.from.id,
      name: target.from.first_name || "عضو",
      username: target.from.username || "",
      money: 0,
      points: 0,
      wins: 0,
      losses: 0,
      games: 0,
      messages: 0,
      premium: true,
      created: Date.now()
    };
  } else {
    db.users[id].premium = true;
  }

  saveDB();

  await send(
    msg,
    `⭐ تم إعطاء رتبة مميز لـ ${target.from.first_name}`
  );
});

bot.onText(/^ازالة مميز$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو واكتب ازالة مميز."
    );
  }

  const id =
    String(msg.reply_to_message.from.id);

  if (db.users[id]) {
    db.users[id].premium = false;
    saveDB();
  }

  await send(msg, "✅ تم إزالة رتبة مميز.");
});

/* =========================
   كتم عضو
========================= */

bot.onText(/^كتم$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو واكتب كتم."
    );
  }

  try {
    await bot.restrictChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id,
      {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false
        }
      }
    );

    await send(msg, "🔇 تم كتم العضو.");
  } catch {
    await send(
      msg,
      "❌ مش قادر أكتم العضو. تأكد إن البوت مشرف وعنده صلاحية تقييد الأعضاء."
    );
  }
});

/* =========================
   فك الكتم
========================= */

bot.onText(/^فك كتم$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو واكتب فك كتم."
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

    await send(msg, "🔊 تم فك الكتم.");
  } catch {
    await send(msg, "❌ حصل خطأ أثناء فك الكتم.");
  }
});

/* =========================
   طرد
========================= */

bot.onText(/^طرد$/i, async msg => {
  if (!(await requireAdmin(msg))) return;

  if (!msg.reply_to_message) {
    return send(
      msg,
      "❌ اعمل Reply على العضو واكتب طرد."
    );
  }

  try {
    await bot.banChatMember(
      msg.chat.id,
      msg.reply_to_message.from.id
    );

    await send(msg, "🚫 تم طرد العضو.");
  } catch {
    await send(
      msg,
      "❌ مش قادر أطرد العضو. تأكد من صلاحيات البوت."
    );
  }
});

/* =========================
   ترقية إحصائية
========================= */

bot.onText(/^من انا$/i, async msg => {
  await showProfile(msg);
});

/* =========================
   الرسائل ومعالجة الألعاب
========================= */

bot.on("message", async msg => {
  try {
    if (!msg.text) return;

    if (msg.from?.is_bot) return;

    const text = msg.text.trim();

    getUser(msg);

    /* تخمين */
    const chatId = String(msg.chat.id);

    if (
      db.games[chatId] &&
      db.games[chatId].type === "guess" &&
      /^\d+$/.test(text)
    ) {
      const game = db.games[chatId];
      const guess = Number(text);
      const u = getUser(msg);

      delete db.games[chatId];

      if (guess === game.number) {
        u.wins++;
        u.points += 5;
        u.money += 100;

        saveDB();

        await send(
          msg,
          `🎉 مبروك!

🎯 الرقم الصحيح: ${game.number}

🏆 +1 فوز
⭐ +5 نقاط
💰 +100 عملة`
        );
      } else {
        u.losses++;
        saveDB();

        await send(
          msg,
          `❌ غلط!

الرقم الصحيح كان:
${game.number}`
        );
      }

      return;
    }

    /* أسئلة */
    if (activeQuestions[chatId]) {
      const game = activeQuestions[chatId];

      if (
        clean(text) === game.answer
      ) {
        const u = getUser(msg);

        u.wins++;
        u.points += 3;
        u.money += 50;

        delete activeQuestions[chatId];

        saveDB();

        await send(
          msg,
          `🎉 إجابة صحيحة!

👤 الفائز: ${msg.from.first_name}

🏆 +1 فوز
⭐ +3 نقاط
💰 +50 عملة`
        );

        return;
      }
    }

    /* تشغيل اللعبة بالاسم */
    if (
      !text.startsWith("/") &&
      text.length < 50
    ) {
      await runGame(msg, text);
    }

  } catch (e) {
    console.log("Message Error:", e.message);
  }
});

/* =========================
   دخول عضو جديد
========================= */

bot.on("new_chat_members", async members => {
  try {
    for (const member of members) {
      if (member.is_bot) continue;

      await bot.sendMessage(
        member.chat.id,
        `👋 أهلاً بيك يا ${member.first_name}

نورت جروبنا ❤️

🎮 اكتب العاب لمشاهدة الألعاب
🏦 اكتب البنك لنظام البنك
🔎 اكتب الكشف لبياناتك`
      );
    }
  } catch (e) {
    console.log("Welcome Error:", e.message);
  }
});

/* =========================
   إضافة البوت لجروب
========================= */

bot.on("my_chat_member", async update => {
  try {
    const chat = update.chat;

    if (
      chat &&
      (chat.type === "group" ||
        chat.type === "supergroup")
    ) {
      getGroup(chat.id);
      saveDB();
    }
  } catch (e) {
    console.log("Chat member error:", e.message);
  }
});

/* =========================
   إيقاف نظيف
========================= */

process.on("SIGINT", () => {
  saveDB();
  process.exit(0);
});

process.on("SIGTERM", () => {
  saveDB();
  process.exit(0);
});

process.on("uncaughtException", error => {
  console.log("❌ Uncaught:", error.message);
  saveDB();
});

process.on("unhandledRejection", error => {
  console.log("❌ Rejection:", error);
  saveDB();
});

bot.on("polling_error", error => {
  console.log("Telegram Polling Error:", error.message);
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🤖 Gojo Esultan Bot");
console.log("✅ Bot Started Successfully");
console.log("🎮 Games System: ON");
console.log("🏦 Bank System: ON");
console.log("👑 Groups System: ON");
console.log("🔎 Profile System: ON");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
