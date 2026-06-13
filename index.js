const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

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
      
        hebrewDate: cleanText(input.hebrewDate, 80),
        hebrewMonth: cleanText(input.hebrewMonth, 40),
        weekday: cleanText(input.weekday, 40),
        birthTime: cleanText(input.birthTime, 40),
      
        mitzvahType: cleanText(input.mitzvahType, 30),
        mitzvahHebrewDate: cleanText(input.mitzvahHebrewDate, 80),
        mitzvahGregorianDate: cleanText(input.mitzvahGregorianDate, 40),
      
        birthParasha: cleanText(input.birthParasha || input.parasha, 90),
        mitzvahParasha: cleanText(input.mitzvahParasha || input.parasha, 90),
      
        aiInstruction: cleanText(input.aiInstruction, 3000)
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
      אתה כותב בעברית, בסגנון יהודי עדין, מחזק, נקי, אחראי וזהיר.
      
      חשוב מאוד:
      אל תחשב מחדש נתונים.
      אל תמציא תאריכים.
      אל תמציא פרשות.
      אל תמציא מקורות.
      אל תקבע שורש נשמה בוודאות.
      אל תכתוב נבואה.
      אל תכתוב כאילו יש לך רוח הקודש.
      אל תבטיח ישועות.
      אל תיתן פסיקת הלכה.
      אל תיתן ייעוץ רפואי, נפשי, משפטי או כלכלי.
      אל תכתוב שהדברים ודאיים.
      
      כתוב בלשון זהירה:
      "אפשר לראות בזה רמז",
      "ייתכן שיש כאן הזמנה",
      "נקודת חיזוק אפשרית",
      "על דרך הדרש אפשר לומר".
      
      הנתונים שחושבו כבר בדף:
      שם פרטי: ${safeData.firstName}
      שם תורני: ${safeData.jewishName}
      תאריך עברי: ${safeData.hebrewDate}
      יום לידה: ${safeData.weekday}
      חודש עברי: ${safeData.hebrewMonth}
      זמן לידה אם ידוע: ${safeData.birthTime || "לא ידוע"}
      
      סוג מצווה: ${safeData.mitzvahType}
      תאריך מצווה עברי: ${safeData.mitzvahHebrewDate}
      תאריך מצווה לועזי: ${safeData.mitzvahGregorianDate}
      
      פרשת השבוע לפי תאריך הלידה של הצופה:
      ${safeData.birthParasha || "לא זוהתה"}
      
      פרשת השבוע שבה הצופה הגיע לגיל מצוות:
      ${safeData.mitzvahParasha || "לא זוהתה"}
      
      הוראה נוספת מהדף:
      ${safeData.aiInstruction || ""}
      
      כתוב תשובה במבנה הבא בלבד:
      
      1. פתיחה קצרה ואישית
      כתוב 2-3 משפטים מחזקים לאדם, בלי עומס נתונים.
      
      2. פרשת השבוע האישית
      הסבר בקצרה מה אפשר ללמוד מפרשת השבוע ששויכה לתאריך הלידה של האדם.
      השתמש רק ברעיונות יהודיים כלליים, מוכרים וזהירים.
      אל תמציא פסוקים או מקורות מדויקים אם אינך בטוח.
      
      3. פרשת גיל המצוות
      הסבר מה אפשר לראות כרמז בכך שזו הפרשה שבה האדם הגיע לגיל מצוות.
      לא חשוב איזו עלייה. התמקד בפרשה הכללית בלבד.
      
      4. עומק הפרד״ס
      כתוב ארבע נקודות קצרות:
      פשט — מה המסר הפשוט שעולה מהכיוון הזה.
      רמז — איזה רמז פנימי אפשר לראות בזה.
      דרש — איזו קריאה לחיים אפשר ללמוד מזה.
      סוד — כתוב בזהירות רבה, בשפה עדינה בלבד, על נקודת עומק פנימית, בלי קבלה מעשית ובלי קביעות ודאיות.
      
      5. מסקנות עדינות על הייעוד בעולם הזה
      כתוב 3 מסקנות קצרות בלבד.
      כל מסקנה תהיה בלשון זהירה ולא מוחלטת.
      המסקנות צריכות לדבר על שליחות, תיקון מידה, נתינה, חיזוק, אחריות או אור שהאדם יכול להוסיף בעולם.
      
      6. קבלה קטנה למעשה
      תן פעולה אחת קטנה שהאדם יכול לקחת על עצמו השבוע.
      
      7. סיום קצר
      סיים במשפט עדין שמזמין להוסיף שם בערוץ לזכות, ברכה, חיזוק או תפילה.
      
      אורך כולל: עד 320 מילים.
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
        return res.status(405).json({ error: "Method not allowed" });
      }

      const input = req.body || {};

      const character = cleanText(input.character, 30);
      const question = cleanText(input.question, 1200);

      if (!character || !question) {
        return res.status(400).json({ error: "Missing required fields" });
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
        }
      };

      const profile = characterMap[character];

      if (!profile) {
        return res.status(400).json({ error: "Invalid character" });
      }

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const prompt = `
אתה כותב בעברית, בסגנון יהודי עדין, מחזק, אחראי ונקי.

המדור: בהשראת ${profile.title}
תחום המדור: ${profile.field}

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

      return res.status(200).json({ message });

    } catch (err) {
      console.error("createSpiritualAnswer error:", err);

      return res.status(500).json({
        error: "AI generation failed"
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
