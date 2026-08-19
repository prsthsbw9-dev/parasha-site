const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

const TORAH_SOURCES = `
אתה פועל בתוך מערכת יהודית שמטרתה לתת חיזוק אישי והכוונה רוחנית
מתוך מקורות תורניים מוכרים בלבד.

מותר להשתמש רק במקורות מהסוגים הבאים:
- תנ"ך
- משנה
- תלמוד בבלי וירושלמי
- מדרשי חז"ל
- זוהר וספרי קבלה מוכרים
- ראשונים ואחרונים
- ספרי מוסר וחסידות מוכרים
- ספרי הלכה ומחשבה יהודית מוכרים

כללים מחייבים:
1. אין להמציא פסוקים, מאמרי חז"ל, ציטוטים או מקורות.
2. אם אינך בטוח בנוסח מדויק של מקור, אל תציג אותו כציטוט מילולי.
3. במקרה כזה כתוב את הרעיון במילים שלך וציין את המקור באופן כללי בלבד.
4. אל תכתוב שהקב"ה הבטיח לאדם דבר מסוים אם אין לכך מקור מפורש.
5. אל תנבא עתידות.
6. אל תציג את עצמך כרב, פוסק הלכה, נביא או בעל רוח הקודש.
7. בשאלות הלכתיות מעשיות שיש בהן מחלוקת או השלכה משמעותית,
   הסבר את העיקרון והמלץ לפנות לרב מוסמך להכרעה אישית.
8. במצבי סכנה, בריאות, אלימות, פגיעה עצמית או מצב חירום,
   אין להסתפק בחיזוק רוחני בלבד ויש לעודד פנייה מיידית לעזרה מתאימה.
`;

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

      const name = cleanText(input.name, 80);
      const gender = input.gender === "female" ? "female" : "male";
      const question = cleanText(input.question, 3000);
      const hebrewDate = cleanText(input.hebrewDate, 120);
      const age = Number.isFinite(Number(input.age))
        ? Number(input.age)
        : null;

      if (!question) {
        return res.status(400).json({ error: "Missing question" });
      }

      const genderInstruction =
        gender === "female"
          ? "פנה אל המשתמשת בלשון נקבה."
          : "פנה אל המשתמש בלשון זכר.";

      const userContext = `
שם פרטי: ${name || "לא נמסר"}
מין: ${gender === "female" ? "נקבה" : "זכר"}
גיל: ${age ?? "לא נמסר"}
תאריך עברי: ${hebrewDate || "לא נמסר"}

השאלה:
${question}
`;

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const response = await client.responses.create({
        model: "gpt-5.4-mini",
        instructions: `
${TORAH_SOURCES}

${genderInstruction}

המטרה:
לתת תשובה אישית, חמה, רגישה ומעשית בשפה פשוטה וברורה.

מבנה התשובה:
- פתח בהתייחסות ישירה למה שהאדם כתב.
- תן חיזוק או כיוון מתוך התורה והמקורות.
- אם מתאים, הבא מקור אחד עד שלושה מקורות אמינים.
- הסבר כיצד הרעיון קשור לחיים של האדם כיום.
- סיים בצעד קטן ומעשי שהאדם יכול לעשות.

אל תעמיס במקורות.
אל תטיף.
אל תכתוב תשובה כללית שאינה מתייחסת לשאלה.
`,
        input: userContext
      });

      return res.status(200).json({
        answer: response.output_text
      });
    } catch (err) {
      console.error("createSpiritualAnswer error:", err);
      return res.status(500).json({
        error: "Failed to create spiritual answer"
      });
    }
  }
);

exports.createPersonalReading = onRequest(
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

      const name = cleanText(input.name, 80);
      const gender = input.gender === "female" ? "female" : "male";
      const hebrewDate = cleanText(input.hebrewDate, 120);
      const parasha = cleanText(input.parasha, 120);
      const topics = Array.isArray(input.topics)
        ? input.topics
            .slice(0, 10)
            .map((item) => cleanText(item, 100))
            .filter(Boolean)
        : [];

      const client = new OpenAI({
        apiKey: openaiApiKey.value()
      });

      const genderInstruction =
        gender === "female"
          ? "כתוב את כל הפנייה בלשון נקבה."
          : "כתוב את כל הפנייה בלשון זכר.";

      const response = await client.responses.create({
        model: "gpt-5.4-mini",
        instructions: `
${TORAH_SOURCES}

${genderInstruction}

צור מסר אישי יהודי מחזק על בסיס הפרטים שנמסרו.

חשוב:
- אין לטעון שהתאריך, השם או הפרשה קובעים את גורלו של האדם.
- אין להמציא משמעות קבלית לשם או לתאריך.
- אם אתה משתמש ברעיון הקשור לפרשה, ודא שהוא אכן קשור לתוכן הפרשה.
- המטרה היא חיזוק, התבוננות והכוונה מעשית בלבד.

מבנה:
1. פתיחה אישית קצרה.
2. נקודת כוח מרכזית.
3. רעיון תורני אחד או שניים.
4. חיבור לחיי היום-יום.
5. צעד מעשי קטן.
6. משפט סיום מחזק.
`,
        input: `
שם: ${name || "לא נמסר"}
תאריך עברי: ${hebrewDate || "לא נמסר"}
פרשה: ${parasha || "לא נמסרה"}
נושאים שהאדם ביקש להתחזק בהם:
${topics.length ? topics.join(", ") : "לא נמסרו"}
`
      });

      return res.status(200).json({
        reading: response.output_text
      });
    } catch (err) {
      console.error("createPersonalReading error:", err);
      return res.status(500).json({
        error: "Failed to create personal reading"
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

      const allowedProviders = new Set([
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

      const channelEmail = "prsthsbw9@gmail.com";

      const transporter =
        nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: channelEmail,
            pass: gmailAppPassword.value()
          }
        });

      const donorSubject =
        "תודה רבה על תמיכתך בהפצת התורה";

      const donorText = wantsPublicThanks
        ? `תודה רבה לך על תרומתך והמצווה החשובה שעשית.

בחרת ששמך יופיע בעלייה הבאה בדף התודה לכל המחזקים.

לאחר אישור תרומתך מצידנו נפרסם את שמך בעז"ה בעלייה הקרובה.

חשוב: הודעה זו נשלחה עם המעבר לאמצעי התשלום ואינה מהווה עדיין אישור שהתשלום התקבל.

לאחר וידוא התשלום נשלח אליך אישור נוסף.

תבורך מהשמיים.`
        : `תודה רבה לך על תרומתך והמצווה החשובה שעשית.

עצם זה שבחרת להישאר בעילום שם, זה רק מוכיח לנו איזה צדיקים יש בעולם הזה, ורק השם יודע את גודל המצווה שעשית.

חשוב: הודעה זו נשלחה עם המעבר לאמצעי התשלום ואינה מהווה עדיין אישור שהתשלום התקבל.

לאחר וידוא התשלום נשלח אליך שוב הודעה שהתשלום התקבל.

תבורך מהשמיים.`;

      const technicalDetails = {
        donorEmail,
        provider,
        wantsPublicThanks,

        publicName:
          publicName ||
          "לא ביקש להופיע בדף התודה",

        sentAt: cleanText(
          input.sentAt,
          60
        ),

        pageUrl: cleanText(
          input.pageUrl,
          500
        ),

        language: cleanText(
          input.language,
          40
        ),

        userAgent: cleanText(
          input.userAgent,
          500
        ),

        screenWidth: Number(
          input.screen?.width || 0
        ),

        screenHeight: Number(
          input.screen?.height || 0
        )
      };

      const channelText =
        `בקשת תמיכה חדשה התקבלה באתר.

אימייל התומך: ${technicalDetails.donorEmail}

אמצעי תשלום שנבחר:
${technicalDetails.provider}

ביקש להופיע בדף התודה:
${
  technicalDetails.wantsPublicThanks
    ? "כן"
    : "לא"
}

שם להצגה:
${technicalDetails.publicName}

זמן שליחה מהדפדפן:
${technicalDetails.sentAt || "לא נמסר"}

כתובת הדף:
${technicalDetails.pageUrl || "לא נמסרה"}

שפת הדפדפן:
${technicalDetails.language || "לא נמסרה"}

גודל מסך:
${technicalDetails.screenWidth || "?"}x${
          technicalDetails.screenHeight || "?"
        }

User-Agent:
${technicalDetails.userAgent || "לא נמסר"}

הערה:
זוהי הודעה שנשלחה לפני המעבר לאמצעי התשלום.
אין לראות בה אישור שהתשלום בוצע או התקבל.`;

      await transporter.sendMail({
        from:
          `"פרשת השבוע - הפצת התורה" <${channelEmail}>`,

        to: donorEmail,

        replyTo: channelEmail,

        subject: donorSubject,

        text: donorText
      });

      await transporter.sendMail({
        from:
          `"אתר פרשת השבוע" <${channelEmail}>`,

        to: channelEmail,

        replyTo: donorEmail,

        subject:
          `בקשת תמיכה חדשה - ${provider.toUpperCase()}`,

        text: channelText
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

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}
