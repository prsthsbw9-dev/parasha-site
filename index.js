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
        gematriaValue: Number(input.gematriaValue || 0)
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
אתה כותב בעברית, בסגנון יהודי עדין, מחזק, נקי וזהיר.

חשוב מאוד:
אל תחשב מחדש נתונים.
אל תקבע שורש נשמה בוודאות.
אל תבטיח ישועות.
אל תיתן פסיקת הלכה.
אל תיתן ייעוץ רפואי, נפשי, משפטי או כלכלי.
אל תמציא מקורות.
אל תכתוב כאילו יש לך רוח הקודש.
אל תכתוב שהדברים ודאיים.
כתוב בלשון: "אפשר לראות בזה רמז", "ייתכן שיש כאן הזמנה", "נקודת חיזוק אפשרית".

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
פרשת מצווה: ${safeData.parasha}
עליית השורש: ${safeData.rootAliyah}
גימטריית השם הפרטי: ${safeData.gematriaValue}

כתוב תשובה במבנה הבא בלבד:

1. פתיחה אישית קצרה
2. משמעות עדינה לפי הנתונים
3. נקודת חיזוק
4. קבלה קטנה למעשה
5. סיום עדין שמזמין להוסיף שם בערוץ לזכות, ברכה, חיזוק או תפילה

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
      console.error("createPersonalReading error:", err);

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