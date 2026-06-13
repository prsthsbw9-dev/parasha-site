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
      
        parasha: cleanText(input.parasha, 80),
        rootAliyah: cleanText(input.rootAliyah, 40),
        gematriaValue: Number(input.gematriaValue || 0),
      
        birthParasha: cleanText(
          input.birthParasha || input.personalParasha || input.parasha,
          90
        ),
        
        mitzvahParasha: cleanText(
          input.mitzvahParasha || input.parasha,
          90
        ),
        
        aiInstruction: cleanText(
          input.aiInstruction || input.writingInstruction || "",
          3000
        )

      if (!safeData.firstName || !safeData.jewishName) {
        return res.status(400).json({
          error: "Missing required fields"
        });
      }

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const prompt = `
      אתה כותב בעברית, בסגנון יהודי עמוק, ברור, מחזק, נקי ואחראי.
      
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
      כתוב בלשון זהירה אבל לא חלשה:
      "לפי הכיוון של הפרשה אפשר לראות..."
      "ברובד הפשט אפשר לקרוא בזה..."
      "ברובד הרמז ייתכן שיש כאן..."
      "על דרך הדרש אפשר ללמוד..."
      "ברובד הסוד, בזהירות, אפשר לראות נקודת עומק..."
      
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
      ${safeData.birthParasha || safeData.parasha || "לא זוהתה"}
      
      פרשת השבוע שבה הצופה הגיע לגיל מצוות:
      ${safeData.mitzvahParasha || safeData.parasha || "לא זוהתה"}
      
      הוראה נוספת מהדף:
      ${safeData.aiInstruction || ""}
        
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
      
      חלק 4 — הסיכום הכי מדויק:
      כתוב סיכום חד של 2-3 שורות שמתחיל כך:
      לפי הכיוון שעולה מהפרשות והפרד״ס, השליחות שלך נראית כך:
      
      אחר כך כתוב משפט אחד חזק, אישי וברור, בסגנון:
      "לראות עמוק, לבחור נכון, ולהראות לאחרים איך להפוך תורה, ניסיון חיים וקושי אישי לדרך של ברכה."
      
      חלק 5 — במילים פשוטות יותר:
      כתוב משפט אחד פשוט, אנושי וקליט שמסכם את השליחות.
      
      חלק 6 — קבלה קטנה למעשה:
      תן פעולה אחת קטנה שהאדם יכול לקחת על עצמו השבוע.
      
      סיום:
      סיים במשפט עדין שמזמין להוסיף שם בערוץ לזכות, ברכה, חיזוק או תפילה.
      
      אורך כולל: עד 520 מילים.
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
