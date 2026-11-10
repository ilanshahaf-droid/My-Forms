/**
 * שליחת טופס ההסכמה החתום במייל – Google Apps Script
 * ------------------------------------------------------------
 * הסקריפט מקבל מהדף consent/index.html את קובץ ה-PDF החתום ושולח אותו
 * מחשבון ה-Gmail שלך, כקובץ מצורף, לכתובת שהוגדרה כאן.
 *
 * הגנה מפני שימוש לרעה: הסקריפט שולח רק לכתובות שברשימה ALLOWED_TO,
 * ורק קבצי PDF אמיתיים. אי אפשר להשתמש בו כדי לשלוח מייל לכתובת אחרת.
 */

// לאן נשלחים הטפסים כברירת מחדל
const DEFAULT_TO = "YOUR_EMAIL@gmail.com";

// כתובות נוספות שמותר לשלוח אליהן (למשל מייל העבודה). אפשר להשאיר ריק.
// אם בקישור שיצרת להורים הוגדר מייל אחר שלא מופיע כאן – הטופס יישלח ל-DEFAULT_TO.
const ALLOWED_TO = [DEFAULT_TO];

const MAX_BYTES = 6 * 1024 * 1024;

// סוגי הטפסים המוכרים (שם הטופס קובע את נושא המייל ושם הקובץ)
const TITLES = ["טופס הסכמה מדעת", "טופס ויתור סודיות"];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const bytes = Utilities.base64Decode(String(d.pdf || ""));
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("invalid file size");
    // הקובץ חייב להתחיל ב-%PDF
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") throw new Error("not a pdf");

    const wanted = String(d.to || "").trim().toLowerCase();
    const allowed = ALLOWED_TO.map(function (x) { return x.toLowerCase(); });
    const to = allowed.indexOf(wanted) >= 0 ? wanted : DEFAULT_TO;

    const clean = function (v) { return String(v || "").replace(/[\r\n<>]/g, " ").slice(0, 100).trim(); };
    const student = clean(d.student), school = clean(d.school), cls = clean(d.cls), parents = clean(d.parents);

    const title = TITLES.indexOf(String(d.title || "")) >= 0 ? String(d.title) : TITLES[0];
    const blob = Utilities.newBlob(bytes, "application/pdf", title + ".pdf");
    const subject = title + " חתום" + (student ? " – " + student : "");
    const body =
      "התקבל " + title + " חתום.\n\n" +
      "תלמיד/ה: " + (student || "-") + "\n" +
      "מוסד: " + (school || "-") + (cls ? ", כיתה " + cls : "") + "\n" +
      "חתמו: " + (parents || "-") + "\n" +
      "התקבל: " + Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm") + "\n\n" +
      "הטופס החתום מצורף כקובץ PDF.";

    GmailApp.sendEmail(to, subject, body, { attachments: [blob], name: "טופס הסכמה – שפ\"ח" });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

// בדיקה שהסקריפט עובד: פתיחת הכתובת בדפדפן תציג {"ok":true,"ping":true}
function doGet() { return json_({ ok: true, ping: true }); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
