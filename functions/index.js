const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

if (!getApps().length) {
  initializeApp();
}

const adminDb = getFirestore();

exports.createPersonalReading = onRequest(
  {
    region: "us-central1",
    secrets: [openaiApiKey],
    cors: true
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          error: "Method not allowed"
        });
      }

      const input = req.body || {};

      const safeData = {
        firstName: cleanText(input.firstName, 40),
        jewishName: cleanText(input.jewishName, 90),
        gender: cleanText(input.gender, 20),

        isBeforeMitzvah: Boolean(input.isBeforeMitzvah),
        ageYears: Number(input.ageYears || 0),
        pronounGender: cleanText(input.pronounGender, 20),

        hebrewDate: cleanText(input.hebrewDate, 80),
        hebrewMonth: cleanText(input.hebrewMonth, 40),
        weekday: cleanText(input.weekday, 40),
        birthTime: cleanText(input.birthTime, 40),

        mitzvahType: cleanText(input.mitzvahType, 30),
        mitzvahHebrewDate: cleanText(input.mitzvahHebrewDate, 80),
        mitzvahGregorianDate: cleanText(input.mitzvahGregorianDate, 40),

        parasha: cleanText(input.parasha, 80),

        birthParasha: cleanText(
          input.birthParasha || input.personalParasha || input.parasha,
          90
        ),

        mitzvahParasha: cleanText(
          input.mitzvahParasha || input.parasha,
          90
        )
      };

      if (!safeData.firstName || !safeData.jewishName) {
        return res.status(400).json({
          error: "Missing required fields"
        });
      }

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const prompt = `
גרסת פרומפט: PRDS_SHLICHUT_V3

אתה כותב בעברית תקנית, טבעית, ברורה, נקייה ואחראית, בסגנון יהודי עמוק ומחזק.
לפני החזרת התשובה בצע הגהה פנימית מלאה.
אל תשתמש במילים מומצאות, שיבושי כתיב, ערבוב אנגלית או ניסוחים לא מובנים.
אם ניסוח מסוים נשמע מסורבל, פשט אותו לעברית קצרה, נקייה ומובנת.

המטרה:
לכתוב לצופה קריאה אישית על "השליחות האישית שלו" לפי:
1. התאריך העברי שלו
2. פרשת השבוע האישית ששויכה לתאריך הלידה שלו
3. פרשת השבוע שבה הגיע לגיל מצוות
4. ארבעת רבדי פרד״ס: פשט, רמז, דרש, סוד

חשוב מאוד:
אל תכתוב "הייעוד האמיתי שלך בוודאות".
אל תקבע גורל.
אל תקבע שורש נשמה בוודאות.
אל תכתוב נבואה.
אל תכתוב כאילו יש לך רוח הקודש.
אל תבטיח ישועות.
אל תיתן פסיקת הלכה.
אל תיתן ייעוץ רפואי, נפשי, משפטי או כלכלי.
אל תמציא מקורות, פסוקים או ציטוטים מדויקים אם אינך בטוח.
אם אתה מזכיר פסוק, עשה זאת רק אם הוא מוכר ובטוח.

חשוב במיוחד:
אל תשתמש בגימטריית השם.
אל תשתמש בעליית השורש.
אל תשתמש במזל, יסוד, שבט או חוש פנימי.
אל תשתמש במפת עומק אישית, שנת חיים או מספרים.
אל תכתוב על חודש כמזל.
אל תכתוב על מספרים, הרמוניה מספרית, או משמעות מספרית של השם.
גם אם נתונים כאלה נשלחו מהדף — התעלם מהם לגמרי.

התשובה חייבת להתבסס רק על:
1. התאריך העברי
2. פרשת השבוע האישית לפי תאריך הלידה
3. פרשת השבוע של גיל המצוות
4. ארבעת רבדי פרד״ס

כתוב בלשון זהירה אבל לא חלשה:
"לפי הכיוון של הפרשה אפשר לראות..."
"ברובד הפשט אפשר לקרוא בזה..."
"ברובד הרמז ייתכן שיש כאן..."
"על דרך הדרש אפשר ללמוד..."
"ברובד הסוד, בזהירות, אפשר לראות נקודת עומק..."

הנתונים שחושבו כבר בדף:
שם פרטי: ${safeData.firstName}
שם תורני: ${safeData.jewishName}
האם הצופה לפני גיל מצוות:
${safeData.isBeforeMitzvah ? "כן" : "לא"}

גיל בשנים:
${safeData.ageYears || "לא זוהה"}

לשון פנייה:
${safeData.pronounGender === "female" ? "נקבה" : "זכר"}

תאריך עברי: ${safeData.hebrewDate}
יום לידה: ${safeData.weekday}
חודש עברי: ${safeData.hebrewMonth}
זמן לידה אם ידוע: ${safeData.birthTime || "לא ידוע"}

סוג מצווה: ${safeData.mitzvahType}
תאריך מצווה עברי: ${safeData.mitzvahHebrewDate}
תאריך מצווה לועזי: ${safeData.mitzvahGregorianDate}

פרשת השבוע לפי תאריך הלידה של הצופה:
${safeData.birthParasha || safeData.parasha || "לא זוהתה"}

פרשת השבוע שבה הצופה הגיע לגיל מצוות:
${safeData.mitzvahParasha || safeData.parasha || "לא זוהתה"}

כתוב את התשובה במבנה הבא בלבד:

כותרת:
השליחות האישית שלך

פתיחה קצרה:
כתוב פנייה אישית בשם האדם.
הסבר במשפט אחד שהדברים אינם נבואה או קביעה מוחלטת, אלא קריאה רוחנית אפשרית לפי הפרשה והתאריך העברי.

חלק 1 — לפי פרשת השבוע האישית:
כתוב מה הכיוון המרכזי של פרשת השבוע ששייכת לתאריך הלידה.
חבר את זה לשליחות של האדם בחיים.
כתוב בצורה עמוקה אבל מובנת.

חלק 2 — לפי פרשת גיל המצוות:
כתוב מה אפשר ללמוד מהפרשה שבה האדם הגיע לגיל מצוות.
לא להתייחס לעלייה מסוימת.
להסביר מה זה מוסיף להבנת השליחות שלו.

חלק 3 — מה השליחות שלי לפי ארבעת פירושי הפרד״ס?

פשט — הבחירה והדרך:
כתוב 2-3 משפטים.
הסבר מה המסר הפשוט של הפרשה לחיים של האדם.
סיים בשורה:
הכיוון שלך בפשט:
ואז כתוב משפט חד וברור על השליחות שלו.

רמז — העומק שמתחת לפני השטח:
כתוב 2-3 משפטים.
הסבר איזה רמז פנימי אפשר לראות בפרשה ובנתונים.
סיים בשורה:
הכיוון שלך ברמז:
ואז כתוב משפט חד וברור על השליחות שלו.

דרש — להפוך תורה להדרכה מעשית:
כתוב 2-3 משפטים.
הסבר איך האדם יכול להפוך את המסר לחיים, משפחה, עבודה, נתינה, אחריות או השפעה.
סיים בשורה:
הכיוון שלך בדרש:
ואז כתוב משפט חד וברור על השליחות שלו.

סוד — נקודת העומק הפנימית:
כתוב בזהירות רבה 2-3 משפטים.
אל תכתוב קבלה מעשית.
אל תכתוב דברים מוחלטים.
כתוב על תיקון פנימי, אור מתוך ניסיון, אמונה, בחירה, או הפיכת קושי לכלי של ברכה.
סיים בשורה:
הכיוון שלך בסוד:
ואז כתוב משפט חד וברור על השליחות שלו.

חלק 4 — כיוון בתחום הקשר והקירבה:
אם "האם הצופה לפני גיל מצוות" הוא כן — אל תכתוב ניתוח זוגי ואל תשתמש במילים זוגיות, בן זוג, בת זוג, נישואין או קשר רומנטי. במקום זאת כתוב בקצרה:
בגיל הזה נכון להתמקד בבניית לב טוב, מידות טובות, כיבוד הורים, חברות טובה, שמחה, לימוד והקשבה לעצמך.

אם הצופה בגיל מצוות ומעלה — כתוב 2-3 משפטים בלבד על כיוון בתחום הקשר והקירבה האנושית.
אל תניח אם האדם רווק, נשוי, גרוש, אלמן, בזוגיות, ללא זוגיות, בפרק ב׳, או בכל מצב חיים אחר.
אל תניח נטייה מינית או סיפור אישי שלא נמסרו.
אל תבטיח זוגיות.
אל תכתוב שימצא או תמצא בן/בת זוג.
אל תיתן ייעוץ זוגי מחייב.
כתוב בלשון פתוחה ומכבדת:
"בין אם יש כרגע קשר זוגי ובין אם לא..."
"הכיוון שעולה בתחום הקשר והקירבה הוא..."
תן כיוון מעשי אחד שקשור להקשבה, אמון, גבולות, נתינה, אמת פנימית או בחירה נכונה.

חלק 5 — כיוון בתחום העשייה והעיסוק:
אם "האם הצופה לפני גיל מצוות" הוא כן — אל תכתוב ניתוח מקצועי למבוגרים ואל תמליץ על מקצוע. במקום זאת כתוב בקצרה:
בגיל הזה נכון להתמקד בלימוד, גילוי כישרונות, אחריות קטנה, התמדה, שמחה ושאלת עצה מהורים או ממבוגר אחראי.

אם הצופה בגיל מצוות ומעלה — כתוב 2-3 משפטים בלבד על תחומי עשייה כלליים שיכולים להתאים לכיוון שעולה מהפרשות והפרד״ס.
אל תקבע מקצוע ודאי.
אל תיתן ייעוץ כלכלי או תעסוקתי מחייב.
אל תכתוב "זה המקצוע שלך".
כתוב בסגנון:
"תחומים שיכולים להתאים לכיוון שלך הם..."
בחר 2-3 כיוונים כלליים בלבד, כמו חינוך, הדרכה, יצירה, כתיבה, ניהול, סדר וארגון, נתינה קהילתית, לימוד, עבודת עומק עם אנשים, יזמות, או תחום אחר שעולה מהפרשות.
סיים במשפט מעשי קצר:
"צעד קטן שאפשר להתחיל ממנו הוא..."

חלק 6 — הסיכום הכי מדויק:
כתוב סיכום חד של 2-3 שורות שמתחיל כך:
לפי הכיוון שעולה מהפרשות והפרד״ס, השליחות שלך נראית כך:

אחר כך כתוב משפט אחד חזק, אישי וברור, בסגנון:
"לראות עמוק, לבחור נכון, ולהראות לאחרים איך להפוך תורה, ניסיון חיים וקושי אישי לדרך של ברכה."

חלק 7 — במילים פשוטות יותר:
כתוב משפט אחד פשוט, אנושי וקליט שמסכם את השליחות.

חלק 8 — קבלה קטנה למעשה:
תן פעולה אחת קטנה שהאדם יכול לקחת על עצמו השבוע.

סיום:
סיים במשפט עדין שמזמין להוסיף שם בערוץ לזכות, ברכה, חיזוק או תפילה.

אורך כולל: עד 620 מילים.
`;

      const completion = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt
      });

      const message = completion.output_text || "";

      return res.status(200).json({
        message
      });
    } catch (err) {
      console.error("createPersonalReading error:", err);

      return res.status(500).json({
        error: "AI generation failed"
      });
    }
  }
);

exports.createSpiritualAnswer = onRequest(
  {
    region: "us-central1",
    secrets: [openaiApiKey],
    cors: true
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          error: "Method not allowed"
        });
      }

      const input = req.body || {};

      const character = cleanText(input.character, 30);
      const question = cleanText(input.question, 1200);

      if (!character || !question) {
        return res.status(400).json({
          error: "Missing required fields"
        });
      }

      const characterMap = {
        yosef: {
          title: "יוסף הצדיק",
          field: "חלומות, ניסיון, אמונה וירידה לצורך עלייה",
          warning: "אל תציג את פירוש החלום כנבואה או קביעה ודאית."
        },
        avraham: {
          title: "אברהם אבינו",
          field: "אמונה, חסד, דרך חיים והכנסת אורחים",
          warning: "אל תיתן פסיקת הלכה מעשית."
        },
        rambam: {
          title: "הרמב״ם",
          field: "בריאות, תזונה, הרגלי חיים ואיזון הגוף והנפש לפי דרכו הכללית של הרמב״ם",
          warning: "אל תיתן אבחון רפואי, טיפול רפואי או הוראות מסוכנות. הפנה לרופא כשצריך."
        },
        rachel: {
          title: "רחל אמנו",
          field: "זוגיות, קשר, תפילה מהלב, שלום בית וחיזוק רגשי",
          warning: "אל תבטיח זיווג, שלום בית או ישועה. במצבי משבר הפנה לרב מוסמך או איש מקצוע."
        },
        heart: {
          title: "מה שבלב",
          field: "הקשבה, חיזוק, אמונה, התמודדות, כאב אישי, פחדים, החלטות וכל מה שמכביד על הלב",
          warning: "אל תציג את עצמך כרב, פסיכולוג או מטפל. אם יש מצוקה נפשית קשה, סכנה, אלימות, מחשבות פגיעה, בעיה רפואית או מצב חירום — כתוב בעדינות שחשוב לפנות מיד לאיש מקצוע מתאים, לרב מוסמך או לגורמי חירום."
        }
      };

      const profile = characterMap[character];

      if (!profile) {
        return res.status(400).json({
          error: "Invalid character"
        });
      }

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const prompt = `
אתה כותב בעברית, בסגנון יהודי עדין, מחזק, אחראי ונקי.

המדור: בהשראת ${profile.title}
תחום המדור: ${profile.field}

${character === "heart" ? `
הוראות מיוחדות לדף "מה שבלב":

האדם לא בהכרח יודע להגדיר את השאלה שלו. קודם כול הקשב, הרגיע, ותן תחושה שיש מקום למה שהוא מרגיש.

אל תענה כמו רב פוסק.
אל תענה כמו פסיכולוג.
אל תענה כמו תשובה טכנית.

ענה כמו מלווה יהודי עדין, חם ואחראי.

מבנה התשובה:
1. פתיחה אישית ומרגיעה.
2. הבנה של מה שיושב על הלב.
3. נקודת מבט יהודית פשוטה ומחזקת.
4. עצה מעשית קטנה.
5. מקור יהודי אחד, רק אם אתה בטוח בו.
6. סיום קבוע:

❤️ משפט ללב:
כתוב משפט קצר ומחזק.

🌱 קבלה קטנה להיום:
תן פעולה אחת קטנה ופשוטה שהאדם יכול לעשות היום.

אם מדובר במצוקה קשה, אלימות, סכנה, בריאות, דיכאון עמוק או מחשבות פגיעה — הפנה מיד לעזרה מתאימה.
` : ""}

השאלה של המשתמש:
${question}

כללים חשובים מאוד:
- השתמש רק בשפה של השראה יהודית כללית ומקורות יהודיים ידועים.
- אל תמציא מקורות.
- אל תכתוב כאילו ${profile.title} עצמו מדבר.
- אל תכתוב נבואה.
- אל תבטיח ישועות.
- אל תיתן פסיקת הלכה.
- אל תיתן אבחון רפואי, נפשי, זוגי, משפטי או כלכלי.
- כתוב בלשון זהירה: "אפשר ללמוד", "יש כאן כיוון", "ייתכן שיש כאן נקודת חיזוק".
- ${profile.warning}

כתוב תשובה במבנה הבא בלבד:

1. פתיחה קצרה ומכבדת
2. נקודת מבט לפי המדור
3. חיזוק מעשי לחיים של היום
4. פעולה קטנה שהאדם יכול לקחת על עצמו
5. סיום קצר עם הסתייגות מתאימה

אורך: עד 220 מילים.
`;

      const completion = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt
      });

      const message = completion.output_text || "";

      return res.status(200).json({
        message
      });
    } catch (err) {
      console.error("createSpiritualAnswer error:", err);

      return res.status(500).json({
        error: "AI generation failed"
      });
    }
  }
);

exports.sendSupportEmails = onRequest(
  {
    region: "us-central1",
    secrets: [gmailAppPassword],
    cors: true
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          error: "Method not allowed"
        });
      }

      const input = req.body || {};

      const donorEmail = cleanText(
        input.donorEmail,
        254
      ).toLowerCase();

      const provider = cleanText(
        input.provider,
        30
      ).toLowerCase();

      const wantsPublicThanks =
        Boolean(input.wantsPublicThanks);

      const publicName = wantsPublicThanks
        ? cleanText(input.publicName, 80)
        : "";

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const allowedProviders =
        new Set([
          "bit",
          "paybox",
          "paypal"
        ]);

      if (!emailPattern.test(donorEmail)) {
        return res.status(400).json({
          error: "Invalid email"
        });
      }

      if (!allowedProviders.has(provider)) {
        return res.status(400).json({
          error: "Invalid payment provider"
        });
      }

      if (wantsPublicThanks && !publicName) {
        return res.status(400).json({
          error: "Missing public name"
        });
      }

      const channelEmail =
        "prsthsbw9@gmail.com";

      /*
       * הכפתור הירוק:
       * חזרה לעמוד הראשי של עץ הפרד״ס.
       */
      const pardesHomeUrl =
        "https://prsthsbw9-dev.github.io/parasha-site/index.html";


      /*
       * הכפתור הכחול:
       * מקבל מהאתר את הקישור לסרטון שממנו
       * הצופה הגיע לדף התמיכה.
       */
      const rawReturnUrl = cleanText(
        input.returnUrl,
        1800
      );

      let pardesLastVideoUrl = "";

      if (rawReturnUrl) {
        try {
          const parsedReturnUrl =
            new URL(rawReturnUrl);

          const allowedReturnHosts =
            new Set([
              "prsthsbw9-dev.github.io",
              "hsbw9-dev.github.io",
              "parasha-site-links.web.app"
            ]);

          if (
            parsedReturnUrl.protocol === "https:" &&
            allowedReturnHosts.has(
              parsedReturnUrl.hostname.toLowerCase()
            )
          ) {
            pardesLastVideoUrl =
              parsedReturnUrl.href;
          }
        } catch (error) {
          pardesLastVideoUrl = "";
        }
      }


      const transporter =
        nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: channelEmail,
            pass: gmailAppPassword.value()
          }
        });


      const providerLabel = {
        bit: "Bit",
        paybox: "PayBox",
        paypal: "PayPal"
      }[provider] || provider;


      const donorSubject =
        "תודה רבה על תמיכתך בהפצת התורה";


      /*
       * גרסת טקסט רגילה של המייל.
       * מיועדת גם לתוכנות מייל שלא מציגות HTML.
       */
      const donorText = wantsPublicThanks
        ? `תודה רבה לך על תרומתך והמצווה החשובה שעשית.

פרטי הבקשה שלך:
אימייל: ${donorEmail}
אמצעי התשלום שנבחר: ${providerLabel}
הופעה בדף התודה: כן
השם להצגה: ${publicName}

בחרת ששמך יופיע בעלייה הבאה בדף התודה לכל המחזקים.

לאחר אישור תרומתך מצידנו נפרסם את שמך בעז"ה בעלייה הקרובה.

חשוב: הודעה זו נשלחה עם המעבר לאמצעי התשלום ואינה מהווה עדיין אישור שהתשלום התקבל.

לאחר וידוא התשלום נשלח אליך אישור נוסף.

תבורך מהשמיים.

חזרה לפרד״ס:
${pardesHomeUrl}

${
  pardesLastVideoUrl
    ? `בחזרה לסרטון האחרון שצפית בו:
${pardesLastVideoUrl}

`
    : ""
}לשיתוף אישור התשלום שלך:
לחץ על תשובה ושלח לנו את אישור תשלום התרומה.`
        : `תודה רבה לך על תרומתך והמצווה החשובה שעשית.

פרטי הבקשה שלך:
אימייל: ${donorEmail}
אמצעי התשלום שנבחר: ${providerLabel}
הופעה בדף התודה: לא

עצם זה שבחרת להישאר בעילום שם, זה רק מוכיח לנו איזה צדיקים יש בעולם הזה, ורק השם יודע את גודל המצווה שעשית.

חשוב: הודעה זו נשלחה עם המעבר לאמצעי התשלום ואינה מהווה עדיין אישור שהתשלום התקבל.

לאחר וידוא התשלום נשלח אליך שוב הודעה שהתשלום התקבל.

תבורך מהשמיים.

חזרה לפרד״ס:
${pardesHomeUrl}

${
  pardesLastVideoUrl
    ? `בחזרה לסרטון האחרון שצפית בו:
${pardesLastVideoUrl}

`
    : ""
}לשיתוף אישור התשלום שלך:
לחץ על תשובה ושלח לנו את אישור תשלום התרומה.`;


      /*
       * גרסת HTML של המייל לצופה.
       */
      const donorHtml = `
        <div
          dir="rtl"
          style="
            font-family:Arial,sans-serif;
            line-height:1.8;
            color:#202020;
          "
        >

          <p>
            תודה רבה לך על תרומתך והמצווה החשובה שעשית.
          </p>


          <div
            style="
              margin:18px 0;
              padding:14px 16px;
              border-radius:14px;
              background:#f6f6f6;
            "
          >
            <strong>
              פרטי הבקשה שלך:
            </strong>

            <br>

            אימייל:
            ${donorEmail}

            <br>

            אמצעי התשלום שנבחר:
            ${providerLabel}

            <br>

            הופעה בדף התודה:
            ${wantsPublicThanks ? "כן" : "לא"}

            ${
              wantsPublicThanks
                ? `<br>השם להצגה: ${publicName}`
                : ""
            }
          </div>


          ${
            wantsPublicThanks
              ? `
                <p>
                  בחרת ששמך יופיע בעלייה הבאה בדף התודה לכל המחזקים.
                </p>

                <p>
                  לאחר אישור תרומתך מצידנו נפרסם את שמך בעז"ה בעלייה הקרובה.
                </p>
              `
              : `
                <p>
                  עצם זה שבחרת להישאר בעילום שם,
                  זה רק מוכיח לנו איזה צדיקים יש בעולם הזה,
                  ורק השם יודע את גודל המצווה שעשית.
                </p>
              `
          }


          <p>
            <strong>
              חשוב:
            </strong>

            הודעה זו נשלחה עם המעבר לאמצעי התשלום
            ואינה מהווה עדיין אישור שהתשלום התקבל.
          </p>


          <p>
            לאחר וידוא התשלום נשלח אליך
            ${
              wantsPublicThanks
                ? "אישור נוסף"
                : "שוב הודעה שהתשלום התקבל"
            }.
          </p>


          <p>
            תבורך מהשמיים.
          </p>


          <!-- ========================= -->
          <!-- לחצן ירוק - חזרה לפרד״ס -->
          <!-- ========================= -->

          <div
            style="
              text-align:center;
              margin-top:28px;
            "
          >
            <a
              href="${pardesHomeUrl}"
              style="
                display:block;
                width:100%;
                max-width:520px;
                margin:0 auto;
                padding:11px 18px;

                border:
                  1px solid #c9efd1;

                border-radius:10px;

                background:#21813b;

                color:#ffffff;

                text-decoration:none;

                font-size:17px;

                line-height:1.35;

                font-weight:700;

                text-align:center;

                box-sizing:border-box;
              "
            >
              🌳 חזרה לפרד״ס
            </a>
          </div>


          <!-- ================================== -->
          <!-- לחצן כחול - הסרטון האחרון שנצפה -->
          <!-- ================================== -->

          ${
            pardesLastVideoUrl
              ? `
                <div
                  style="
                    text-align:center;
                    margin-top:10px;
                  "
                >
                  <a
                    href="${pardesLastVideoUrl}"
                    style="
                      display:block;
                      width:100%;
                      max-width:520px;
                      margin:0 auto;

                      padding:11px 18px;

                      border:
                        1px solid #8ab4f8;

                      border-radius:10px;

                      background:#1877F2;

                      color:#ffffff;

                      text-decoration:none;

                      font-size:16px;

                      line-height:1.35;

                      font-weight:700;

                      text-align:center;

                      box-sizing:border-box;
                    "
                  >
                    בחזרה לסרטון האחרון שצפית בו
                  </a>
                </div>
              `
              : ""
          }


          <!-- ========================= -->
          <!-- הוראות שליחת אישור תשלום -->
          <!-- ========================= -->

          <div
            style="
              width:100%;
              max-width:520px;

              margin:22px auto 0;

              padding-top:17px;

              border-top:
                1px solid #d1d1d1;

              text-align:center;

              color:#777777;

              font-size:13px;

              line-height:1.65;
            "
          >
            <strong
              style="
                color:#555555;
              "
            >
              לשיתוף אישור התשלום שלך
            </strong>

            <br>

            לחץ על
            <strong>
              תשובה
            </strong>

            ושלח לנו את אישור תשלום התרומה.
          </div>

        </div>
      `;


      /*
       * המייל לערוץ:
       * פרטים טכניים בלבד.
       * אין בו שום קישור חזרה.
       */
      const channelText =
`בקשת תמיכה חדשה התקבלה באתר.

אימייל התומך:
${donorEmail}

אמצעי תשלום שנבחר:
${providerLabel}

ביקש להופיע בדף התודה:
${wantsPublicThanks ? "כן" : "לא"}

שם להצגה:
${publicName || "לא ביקש להופיע בדף התודה"}

זמן שליחה מהדפדפן:
${cleanText(input.sentAt, 60) || "לא נמסר"}

שפת הדפדפן:
${cleanText(input.language, 40) || "לא נמסרה"}

גודל מסך:
${Number(input.screen?.width || 0) || "?"}x${Number(input.screen?.height || 0) || "?"}

User-Agent:
${cleanText(input.userAgent, 500) || "לא נמסר"}

הערה:
זוהי הודעה שנשלחה לפני המעבר לאמצעי התשלום.
אין לראות בה אישור שהתשלום בוצע או התקבל.`;


      /*
       * מייל לצופה.
       */
      await transporter.sendMail({
        from:
          `"פרשת השבוע - הפצת התורה" <${channelEmail}>`,

        to:
          donorEmail,

        replyTo:
          channelEmail,

        subject:
          donorSubject,

        text:
          donorText,

        html:
          donorHtml
      });


      /*
       * מייל לערוץ.
       */
      await transporter.sendMail({
        from:
          `"אתר פרשת השבוע" <${channelEmail}>`,

        to:
          channelEmail,

        replyTo:
          donorEmail,

        subject:
          `בקשת תמיכה חדשה - ${provider.toUpperCase()}`,

        text:
          channelText
      });


      return res.status(200).json({
        ok: true
      });

    } catch (err) {

      console.error(
        "sendSupportEmails error:",
        err
      );

      return res.status(500).json({
        error: "Email sending failed"
      });
    }
  }
);

/*
 * ============================================================
 * חיזוק אישי — כניסה מאובטחת באמצעות קוד חד־פעמי בדוא״ל
 * ============================================================
 * הקוד נשמר ב־Firestore רק כגיבוב מאובטח, תקף ל־10 דקות
 * ומאפשר עד 5 ניסיונות אימות.
 */

const personalStrengthCors = [
  "https://prsthsbw9-dev.github.io",
  "https://hsbw9-dev.github.io",
  "https://parasha-site-links.web.app",
  "https://parasha-site-links.firebaseapp.com"
];

const personalStrengthCodeCollection =
  "personalStrengthEmailCodes";

const personalStrengthRateCollection =
  "personalStrengthEmailCodeRateLimits";

const personalStrengthCodeLifetimeMs =
  10 * 60 * 1000;

const personalStrengthResendDelayMs =
  60 * 1000;

const personalStrengthRateWindowMs =
  60 * 60 * 1000;

const personalStrengthMaxEmailRequestsPerHour = 5;
const personalStrengthMaxIpRequestsPerHour = 12;
const personalStrengthMaxVerificationAttempts = 5;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function createCodeHash(code, salt) {
  return sha256(`${code}:${salt}`);
}

function safeHashesEqual(first, second) {
  const firstBuffer = Buffer.from(String(first), "hex");
  const secondBuffer = Buffer.from(String(second), "hex");

  return (
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function getRequestIp(req) {
  const forwardedFor = String(
    req.headers["x-forwarded-for"] || ""
  ).split(",")[0].trim();

  return forwardedFor || req.ip || "unknown";
}

function createPersonalStrengthTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "prsthsbw9@gmail.com",
      pass: gmailAppPassword.value()
    }
  });
}

exports.sendPersonalStrengthCode = onRequest(
  {
    region: "us-central1",
    secrets: [gmailAppPassword],
    cors: personalStrengthCors,
    timeoutSeconds: 60,
    maxInstances: 12
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email"
      });
    }

    const now = Date.now();
    const emailKey = sha256(email);
    const ipKey = sha256(getRequestIp(req));
    const codeDocument = adminDb
      .collection(personalStrengthCodeCollection)
      .doc(emailKey);
    const rateDocument = adminDb
      .collection(personalStrengthRateCollection)
      .doc(ipKey);

    const code = String(
      crypto.randomInt(100000, 1000000)
    );
    const salt = crypto.randomBytes(24).toString("hex");
    const codeHash = createCodeHash(code, salt);

    try {
      await adminDb.runTransaction(async (transaction) => {
        const [codeSnapshot, rateSnapshot] = await Promise.all([
          transaction.get(codeDocument),
          transaction.get(rateDocument)
        ]);

        const previousCode = codeSnapshot.exists
          ? codeSnapshot.data()
          : {};
        const previousRate = rateSnapshot.exists
          ? rateSnapshot.data()
          : {};

        const previousSentAt = Number(
          previousCode.sentAtMs || 0
        );

        if (
          previousSentAt &&
          now - previousSentAt < personalStrengthResendDelayMs
        ) {
          const error = new Error("resend-too-soon");
          error.statusCode = 429;
          throw error;
        }

        const emailWindowStartedAt = Number(
          previousCode.rateWindowStartedAtMs || now
        );
        const emailWindowExpired =
          now - emailWindowStartedAt >=
          personalStrengthRateWindowMs;
        const emailRequestCount = emailWindowExpired
          ? 1
          : Number(previousCode.requestCount || 0) + 1;

        if (
          emailRequestCount >
          personalStrengthMaxEmailRequestsPerHour
        ) {
          const error = new Error("email-rate-limit");
          error.statusCode = 429;
          throw error;
        }

        const ipWindowStartedAt = Number(
          previousRate.windowStartedAtMs || now
        );
        const ipWindowExpired =
          now - ipWindowStartedAt >=
          personalStrengthRateWindowMs;
        const ipRequestCount = ipWindowExpired
          ? 1
          : Number(previousRate.requestCount || 0) + 1;

        if (
          ipRequestCount >
          personalStrengthMaxIpRequestsPerHour
        ) {
          const error = new Error("ip-rate-limit");
          error.statusCode = 429;
          throw error;
        }

        transaction.set(codeDocument, {
          email,
          salt,
          codeHash,
          attempts: 0,
          sentAtMs: now,
          expiresAtMs: now + personalStrengthCodeLifetimeMs,
          requestCount: emailRequestCount,
          rateWindowStartedAtMs: emailWindowExpired
            ? now
            : emailWindowStartedAt
        });

        transaction.set(rateDocument, {
          requestCount: ipRequestCount,
          windowStartedAtMs: ipWindowExpired
            ? now
            : ipWindowStartedAt,
          updatedAtMs: now
        });
      });

      const transporter = createPersonalStrengthTransporter();
      const subject = "קוד הכניסה שלך לחיזוק האישי";
      const textMessage = `קוד הכניסה שלך לחיזוק האישי הוא: ${code}

הקוד תקף למשך 10 דקות ולשימוש חד־פעמי בלבד.

אם לא ביקשת את הקוד, אפשר להתעלם מהודעה זו.

עץ הפרד״ס החי`;
      const htmlMessage = `
        <div
          dir="rtl"
          style="
            max-width:560px;
            margin:0 auto;
            padding:28px 22px;
            font-family:Arial,sans-serif;
            line-height:1.7;
            color:#202020;
            text-align:right;
          "
        >
          <h2 style="margin:0 0 12px;color:#8a6500;">
            קוד הכניסה שלך לחיזוק האישי
          </h2>

          <p>
            יש להקליד באתר את הקוד הבא:
          </p>

          <div
            dir="ltr"
            style="
              margin:22px 0;
              padding:16px;
              border:1px solid #d8b64c;
              border-radius:10px;
              background:#fff8df;
              color:#171717;
              font-size:34px;
              font-weight:700;
              letter-spacing:8px;
              text-align:center;
            "
          >${code}</div>

          <p>
            הקוד תקף למשך <strong>10 דקות</strong>
            ולשימוש חד־פעמי בלבד.
          </p>

          <p style="color:#666;font-size:14px;">
            אם לא ביקשת את הקוד, אפשר להתעלם מהודעה זו.
          </p>

          <p style="margin-top:24px;">
            עץ הפרד״ס החי
          </p>
        </div>
      `;

      await transporter.sendMail({
        from:
          `"עץ הפרד״ס החי - חיזוק אישי" <prsthsbw9@gmail.com>`,
        to: email,
        replyTo: "prsthsbw9@gmail.com",
        subject,
        text: textMessage,
        html: htmlMessage
      });

      return res.status(200).json({
        ok: true,
        expiresInSeconds:
          personalStrengthCodeLifetimeMs / 1000
      });
    } catch (err) {
      console.error("sendPersonalStrengthCode error:", err);

      if (
        err.message === "resend-too-soon" ||
        err.message === "email-rate-limit" ||
        err.message === "ip-rate-limit"
      ) {
        return res.status(err.statusCode || 429).json({
          error: err.message
        });
      }

      return res.status(500).json({
        error: "Code sending failed"
      });
    }
  }
);

exports.verifyPersonalStrengthCode = onRequest(
  {
    region: "us-central1",
    cors: personalStrengthCors,
    timeoutSeconds: 60,
    maxInstances: 12
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email"
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: "Invalid code format"
      });
    }

    const emailKey = sha256(email);
    const codeDocument = adminDb
      .collection(personalStrengthCodeCollection)
      .doc(emailKey);
    const now = Date.now();

    try {
      const verificationResult = await adminDb.runTransaction(
        async (transaction) => {
        const snapshot = await transaction.get(codeDocument);

        if (!snapshot.exists) {
          return {
            ok: false,
            error: "code-not-found",
            statusCode: 400
          };
        }

        const data = snapshot.data();
        const attempts = Number(data.attempts || 0);

        if (Number(data.expiresAtMs || 0) <= now) {
          transaction.delete(codeDocument);
          return {
            ok: false,
            error: "code-expired",
            statusCode: 400
          };
        }

        if (
          attempts >= personalStrengthMaxVerificationAttempts
        ) {
          transaction.delete(codeDocument);
          return {
            ok: false,
            error: "too-many-attempts",
            statusCode: 429
          };
        }

        const receivedHash = createCodeHash(
          code,
          data.salt
        );
        const isCorrect = safeHashesEqual(
          receivedHash,
          data.codeHash
        );

        if (!isCorrect) {
          const nextAttempts = attempts + 1;

          if (
            nextAttempts >=
            personalStrengthMaxVerificationAttempts
          ) {
            transaction.delete(codeDocument);
          } else {
            transaction.update(codeDocument, {
              attempts: nextAttempts
            });
          }

          return {
            ok: false,
            error: "incorrect-code",
            statusCode: 400,
            remainingAttempts: Math.max(
              0,
              personalStrengthMaxVerificationAttempts -
                nextAttempts
            )
          };
        }

        transaction.delete(codeDocument);
        return { ok: true };
      });

      if (!verificationResult.ok) {
        return res
          .status(verificationResult.statusCode || 400)
          .json({
            error: verificationResult.error,
            remainingAttempts:
              verificationResult.remainingAttempts
          });
      }

      const adminAuth = getAuth();
      let userRecord;

      try {
        userRecord = await adminAuth.getUserByEmail(email);

        if (!userRecord.emailVerified) {
          userRecord = await adminAuth.updateUser(
            userRecord.uid,
            { emailVerified: true }
          );
        }
      } catch (err) {
        if (err.code !== "auth/user-not-found") {
          throw err;
        }

        userRecord = await adminAuth.createUser({
          email,
          emailVerified: true
        });
      }

      const customToken = await adminAuth.createCustomToken(
        userRecord.uid,
        {
          personalStrengthEmailVerified: true
        }
      );

      return res.status(200).json({
        ok: true,
        customToken
      });
    } catch (err) {
      console.error("verifyPersonalStrengthCode error:", err);

      const expectedErrors = new Set([
        "code-not-found",
        "code-expired",
        "too-many-attempts",
        "incorrect-code"
      ]);

      if (expectedErrors.has(err.message)) {
        return res.status(err.statusCode || 400).json({
          error: err.message,
          remainingAttempts:
            Number.isFinite(err.remainingAttempts)
              ? err.remainingAttempts
              : undefined
        });
      }

      return res.status(500).json({
        error: "Code verification failed"
      });
    }
  }
);

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}
