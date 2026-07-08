# Fast Group Sync Setup

الموقع على GitHub Pages لا يكتب في الملفات بنفسه. التزامن يحتاج Cloudflare Worker وسيط يكتب في ملف JSON داخل الريبو.

## الملفات

- `sync-config.js`: ضع فيه رابط الـ Worker بعد نشره.
- `sync-worker.js`: ارفعه كـ Cloudflare Worker.
- ملف البيانات الذي سيُنشأ تلقائيًا: `data/site-state.json`.

## متغيرات الـ Worker

أضف هذه المتغيرات في Cloudflare Worker:

- `GITHUB_TOKEN`: GitHub fine-grained token بصلاحية `Contents: Read and write` للريبو.
- `GITHUB_OWNER`: اسم حساب GitHub.
- `GITHUB_REPO`: اسم الريبو.
- `GITHUB_BRANCH`: اسم الفرع، غالبًا `main`.
- `DATA_PATH`: اختياري، الافتراضي `data/site-state.json`.
- `ADMIN_SYNC_KEY`: مفتاح تختاره أنت لتعديل بيانات الأدمن.

## بعد النشر

1. افتح `sync-config.js`.
2. ضع رابط الـ Worker في `endpoint`.
3. ارفع `index.html` و`sync-config.js` و`sync-worker.js` على GitHub.
4. من لوحة الأدمن اضغط `إعداد التزامن`.
5. ضع رابط الـ Worker ومفتاح `ADMIN_SYNC_KEY`.

بعدها:

- تعديلات الأدمن تتزامن من اللاب والفون بعد حفظ المفتاح على جهاز الأدمن.
- تقييمات العملاء تتزامن بدون مفتاح.
- أي جهاز جديد يقرأ آخر نسخة عند فتح الموقع، وعند الرجوع للتبويب، وكل 30 ثانية.
