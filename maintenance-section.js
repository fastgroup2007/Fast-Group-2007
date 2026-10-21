/* Fast Group maintenance: prepare a customer-reviewed WhatsApp request. */
(function () {
  'use strict';

  // Verified in both existing site copies: the contact/hero WhatsApp links.
  const BUSINESS_PHONE = '201013283466';
  const BRANDS = ['كاريير', 'ميديا', 'شارب', 'تورنادو', 'هاير', 'LG', 'فري إير', 'فريش', 'ماركة تانية / مش متأكد'];

  function cleanText(value) {
    return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }

  function normalizePhone(value) {
    let phone = cleanText(value)
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
      .replace(/[\s()-]/g, '');
    if (phone.startsWith('0020')) phone = phone.slice(4);
    else if (phone.startsWith('+20')) phone = phone.slice(3);
    else if (phone.startsWith('20')) phone = phone.slice(2);
    if (/^1[0125]\d{8}$/.test(phone)) phone = '0' + phone;
    return /^01[0125]\d{8}$/.test(phone) ? phone : '';
  }

  function validateRequest(raw) {
    const values = {};
    ['name', 'phone', 'area', 'brand', 'problem', 'preferred'].forEach(key => {
      values[key] = cleanText(raw[key]);
    });
    const errors = {};
    if (values.name.length < 2 || values.name.length > 80) errors.name = 'اكتب اسمك من حرفين إلى 80 حرف.';
    const phone = normalizePhone(values.phone);
    if (!phone) errors.phone = 'اكتب رقم موبايل مصري صحيح من 11 رقم، مثل 01012345678. ممكن تضيف +20.';
    else values.phone = phone;
    if (values.area.length < 2 || values.area.length > 160) errors.area = 'اكتب المحافظة والمنطقة من حرفين إلى 160 حرف.';
    if (!BRANDS.includes(values.brand)) errors.brand = 'اختار ماركة الجهاز، أو «ماركة تانية / مش متأكد».';
    if (values.problem.length < 8 || values.problem.length > 1200) errors.problem = 'وصف المشكلة يكون من 8 إلى 1200 حرف عشان نقدر نفهم العطل.';
    if (values.preferred.length > 120) errors.preferred = 'اكتب الوقت المفضل في 120 حرف أو أقل.';
    return { values, errors, valid: Object.keys(errors).length === 0 };
  }

  function buildMessage(values) {
    return [
      'السلام عليكم، عايز أطلب صيانة تكييف من Fast Group.',
      '',
      'الاسم: ' + values.name,
      'رقم الموبايل: ' + values.phone,
      'المحافظة والمنطقة: ' + values.area,
      'ماركة الجهاز: ' + values.brand,
      'المشكلة: ' + values.problem,
      'الوقت المفضل للتواصل أو الزيارة: ' + (values.preferred || 'حسب الاتفاق'),
      '',
      'برجاء التواصل لتحديد تفاصيل الصيانة والتكلفة والموعد.'
    ].join('\n');
  }

  const styles = `
    .fgm-section { padding: 64px 0; background: #fff; color: #0f172a; }
    .fgm-wrap { width: min(1200px, 100%); margin: auto; padding-inline: 16px; box-sizing: border-box; }
    .fgm-heading { text-align: center; max-width: 750px; margin: 0 auto 28px; }
    .fgm-heading h2 { font-size: clamp(26px, 4vw, 36px); font-weight: 900; margin: 0 0 12px; }
    .fgm-heading p, .fgm-services p { color: #475569; line-height: 1.8; margin: 0; }
    .fgm-services { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
    .fgm-service { border: 1px solid #e2e8f0; border-radius: 24px; background: #f8fafc; padding: 24px; }
    .fgm-service svg { width: 30px; height: 30px; color: #0369a1; margin-bottom: 14px; }
    .fgm-service h3 { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
    #maintenance, #maintenance-request { scroll-margin-top: 112px; }
    #maintenance-request { box-sizing: border-box; margin-top: 28px; padding: clamp(20px, 4vw, 36px); border: 1px solid #bae6fd; border-radius: 28px; background: #f0f9ff; color: #0f172a; text-align: right; }
    #maintenance-request *, #maintenance-request *::before, #maintenance-request *::after { box-sizing: border-box; }
    #maintenance-request .fgm-kicker { color: #0369a1; font-size: 14px; font-weight: 800; margin: 0 0 8px; }
    #maintenance-request h3 { font-size: clamp(24px, 4vw, 30px); font-weight: 900; margin: 0 0 10px; }
    #maintenance-request p { line-height: 1.8; }
    #maintenance-request .fgm-intro { color: #475569; margin: 0 0 22px; max-width: 820px; }
    #maintenance-request .fgm-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    #maintenance-request .fgm-field { min-width: 0; }
    #maintenance-request .fgm-wide { grid-column: 1 / -1; }
    #maintenance-request label { display: block; font-size: 15px; font-weight: 800; margin-bottom: 8px; }
    #maintenance-request input, #maintenance-request select, #maintenance-request textarea { width: 100%; max-width: 100%; min-height: 48px; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; color: #0f172a; padding: 12px 14px; font: inherit; font-size: 16px; }
    #maintenance-request textarea { resize: vertical; }
    #maintenance-request :is(input, select, textarea):focus { outline: 3px solid #7dd3fc; outline-offset: 2px; }
    #maintenance-request [aria-invalid="true"] { border-color: #b91c1c; }
    #maintenance-request .fgm-help { display: block; color: #475569; font-size: 13px; margin-top: 6px; }
    #maintenance-request .fgm-error { display: block; color: #b91c1c; font-size: 14px; margin-top: 6px; }
    #maintenance-request .fgm-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 22px; }
    #maintenance-request .fgm-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 12px 22px; border: 0; border-radius: 14px; background: #0369a1; color: #fff; font: inherit; font-weight: 800; cursor: pointer; text-decoration: none; line-height: 1.5; }
    #maintenance-request .fgm-button:hover { background: #075985; }
    #maintenance-request .fgm-button:focus-visible { outline: 3px solid #38bdf8; outline-offset: 3px; }
    #maintenance-request .fgm-call { background: #0f172a; }
    #maintenance-request .fgm-whatsapp { background: #047857; }
    #maintenance-request .fgm-whatsapp:hover { background: #065f46; }
    #maintenance-request .fgm-note { color: #475569; font-size: 14px; margin: 14px 0 0; }
    #maintenance-request .fgm-preview { margin-top: 24px; padding: 20px; border: 1px solid #cbd5e1; background: #fff; border-radius: 18px; }
    #maintenance-request .fgm-preview h4 { font-weight: 800; font-size: 18px; margin: 0 0 12px; }
    #maintenance-request .fgm-message { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 15px; line-height: 1.8; margin: 0; }
    #maintenance-request [hidden] { display: none !important; }
    #maintenance-request .fgm-status { margin-top: 12px; color: #0369a1; }
    .dark .fgm-section { background: #020617; color: #f1f5f9; }
    .dark .fgm-service, .dark #maintenance-request .fgm-preview { background: #0f172a; border-color: #334155; }
    .dark #maintenance-request { background: #0c1e32; border-color: #164e63; color: #f1f5f9; }
    .dark #maintenance-request input, .dark #maintenance-request select, .dark #maintenance-request textarea { background: #0f172a; border-color: #475569; color: #f1f5f9; }
    .dark :is(.fgm-heading p, .fgm-services p), .dark #maintenance-request :is(.fgm-intro, .fgm-note, .fgm-help) { color: #cbd5e1; }
    .dark .fgm-service svg, .dark #maintenance-request :is(.fgm-kicker, .fgm-status) { color: #7dd3fc; }
    .dark #maintenance-request .fgm-error { color: #fca5a5; }
    .dark #maintenance-request [aria-invalid="true"] { border-color: #f87171; }
    @media (max-width: 650px) {
      .fgm-section { padding: 36px 0; }
      .fgm-services, #maintenance-request .fgm-fields { grid-template-columns: minmax(0, 1fr); }
      #maintenance-request .fgm-actions { align-items: stretch; flex-direction: column; }
      #maintenance-request { border-radius: 20px; }
      #maintenance-request .fgm-preview { padding: 14px; }
    }
  `;

  function init() {
    if (document.getElementById('maintenance-request')) return;
    const style = document.createElement('style');
    style.id = 'fg-maintenance-style';
    style.textContent = styles;
    document.head.appendChild(style);

    let section = document.getElementById('maintenance');
    if (!section) {
      section = document.createElement('section');
      section.id = 'maintenance';
      section.className = 'fgm-section';
      section.setAttribute('aria-labelledby', 'fgm-title');
      section.innerHTML = `
        <div class="fgm-wrap">
          <div class="fgm-heading">
            <h2 id="fgm-title">صيانة التكييف</h2>
            <p>التكييف محتاج تنظيف، تبريده ضعيف، أو فيه عطل؟ اكتب لنا التفاصيل ونرتب معاك الخطوة المناسبة.</p>
          </div>
          <div class="fgm-services">
            <article class="fgm-service"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6"/></svg><h3>تنظيف وصيانة دورية</h3><p>تنظيف الفلاتر والوحدات، ومراجعة الأداء والتصريف حسب حالة الجهاز.</p></article>
            <article class="fgm-service"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 6 4-4a6 6 0 0 1-7 8L4 17a2 2 0 0 0 3 3l7-7a6 6 0 0 0 8-7l-4 4z"/></svg><h3>كشف وإصلاح الأعطال</h3><p>فحص سبب ضعف التبريد، الأصوات غير المعتادة، أو توقف الجهاز عن التشغيل.</p></article>
            <article class="fgm-service"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/></svg><h3>مراجعة التسريب والتصريف</h3><p>فحص تسريب المياه ودائرة التبريد وتحديد الإصلاح المطلوب بعد الكشف.</p></article>
          </div>
        </div>`;
      const business = document.getElementById('business');
      const contact = document.getElementById('contact');
      if (business) business.after(section);
      else if (contact) contact.before(section);
      else (document.querySelector('main') || document.body).appendChild(section);
    }

    const request = document.createElement('div');
    request.id = 'maintenance-request';
    request.dir = 'rtl';
    request.innerHTML = `
      <p class="fgm-kicker">طلبات الصيانة</p>
      <h3 id="fgm-request-title">اطلب صيانة لجهازك</h3>
      <p class="fgm-intro">املا البيانات وراجع الرسالة، وبعدها افتح واتساب وابعتها لفاست جروب. هنحدد معاك تفاصيل الزيارة والتكلفة والموعد في المحادثة. الحقول المطلوبة عليها علامة *.</p>
      <form id="fgm-form" aria-labelledby="fgm-request-title" novalidate>
        <div class="fgm-fields">
          <div class="fgm-field"><label for="fgm-name">الاسم *</label><input id="fgm-name" name="name" autocomplete="name" required maxlength="80" aria-describedby="fgm-name-error"><span id="fgm-name-error" class="fgm-error" hidden></span></div>
          <div class="fgm-field"><label for="fgm-phone">رقم الموبايل *</label><input id="fgm-phone" name="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" required maxlength="24" placeholder="01012345678" aria-describedby="fgm-phone-help fgm-phone-error"><span id="fgm-phone-help" class="fgm-help">رقم مصري من 11 رقم. بنقبل كمان +20 والأرقام العربية.</span><span id="fgm-phone-error" class="fgm-error" hidden></span></div>
          <div class="fgm-field"><label for="fgm-area">المحافظة والمنطقة *</label><input id="fgm-area" name="area" autocomplete="address-level2" required maxlength="160" placeholder="مثال: الإسكندرية، سموحة" aria-describedby="fgm-area-error"><span id="fgm-area-error" class="fgm-error" hidden></span></div>
          <div class="fgm-field"><label for="fgm-brand">ماركة الجهاز *</label><select id="fgm-brand" name="brand" required aria-describedby="fgm-brand-error"><option value="">اختار الماركة</option>${BRANDS.map(brand => '<option>' + brand + '</option>').join('')}</select><span id="fgm-brand-error" class="fgm-error" hidden></span></div>
          <div class="fgm-field fgm-wide"><label for="fgm-problem">وصف المشكلة *</label><textarea id="fgm-problem" name="problem" rows="4" required maxlength="1200" placeholder="مثال: التكييف تبريده ضعيف وبيسرّب مياه. اكتب كود الموديل لو موجود." aria-describedby="fgm-problem-error"></textarea><span id="fgm-problem-error" class="fgm-error" hidden></span></div>
          <div class="fgm-field fgm-wide"><label for="fgm-preferred">الوقت المفضل للتواصل أو الزيارة (اختياري)</label><input id="fgm-preferred" name="preferred" maxlength="120" placeholder="مثال: يوم الخميس بعد الساعة 5 مساءً" aria-describedby="fgm-preferred-help fgm-preferred-error"><span id="fgm-preferred-help" class="fgm-help">الوقت ده تفضيل منك، والموعد بيتأكد بعد التواصل.</span><span id="fgm-preferred-error" class="fgm-error" hidden></span></div>
        </div>
        <div class="fgm-actions"><button type="submit" class="fgm-button">جهّز رسالة طلب الصيانة</button><a href="tel:01013283466" class="fgm-button fgm-call">اتصل بالصيانة</a></div>
        <p class="fgm-note">الطلب بيتبعت لما تضغط «إرسال» داخل واتساب. تجهيز الرسالة هنا ما بيحجزش زيارة، والبيانات ما بتتحفظش في الموقع.</p>
      </form>
      <p class="fgm-status" id="fgm-status" role="status" aria-live="polite"></p>
      <div class="fgm-preview" id="fgm-preview" hidden>
        <h4>راجع طلبك قبل الإرسال</h4>
        <pre class="fgm-message" id="fgm-message"></pre>
        <div class="fgm-actions"><a id="fgm-send" target="_blank" rel="noopener noreferrer" class="fgm-button fgm-whatsapp">افتح واتساب لإرسال الطلب</a></div>
        <p class="fgm-note">هتفتح محادثة فاست جروب على الرقم <bdi dir="ltr">01013283466</bdi> بالرسالة الجاهزة. اضغط إرسال هناك لإتمام طلبك.</p>
      </div>`;
    (section.querySelector('.container, .fgm-wrap') || section).appendChild(request);

    // Add navigation only when absent; preserve existing gallery and service content.
    const desktopNav = document.querySelector('header nav');
    const mobileNav = document.querySelector('#mobileMenu > div');
    [desktopNav, mobileNav].forEach(nav => {
      if (!nav) return;
      [['#maintenance', 'الصيانة'], ['#maintenance-request', 'طلب صيانة']].forEach(([href, label]) => {
        // One compact desktop link; the section itself provides the request form.
        if (nav === desktopNav && href === '#maintenance-request') return;
        if (nav.querySelector('a[href="' + href + '"]')) return;
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = label;
        anchor.className = nav.querySelector('a')?.className || '';
        const contactLink = nav.querySelector('a[href="#contact"]');
        if (contactLink) contactLink.before(anchor);
        else nav.appendChild(anchor);
        if (nav === mobileNav) anchor.addEventListener('click', () => document.getElementById('mobileMenu')?.classList.add('hidden'));
      });
    });

    const form = document.getElementById('fgm-form');
    const preview = document.getElementById('fgm-preview');
    const status = document.getElementById('fgm-status');
    const send = document.getElementById('fgm-send');
    const fields = ['name', 'phone', 'area', 'brand', 'problem', 'preferred'];
    const clearPreview = () => {
      preview.hidden = true;
      send.removeAttribute('href');
      status.textContent = '';
    };
    fields.forEach(key => {
      const field = document.getElementById('fgm-' + key);
      const clearField = () => {
        field.removeAttribute('aria-invalid');
        document.getElementById('fgm-' + key + '-error').hidden = true;
        clearPreview();
      };
      field.addEventListener('input', clearField);
      field.addEventListener('change', clearField);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      clearPreview();
      const raw = Object.fromEntries(fields.map(key => [key, document.getElementById('fgm-' + key).value]));
      const result = validateRequest(raw);
      fields.forEach(key => {
        const input = document.getElementById('fgm-' + key);
        const error = document.getElementById('fgm-' + key + '-error');
        error.textContent = result.errors[key] || '';
        error.hidden = !result.errors[key];
        if (result.errors[key]) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      });
      if (!result.valid) {
        status.textContent = 'راجع البيانات الموضحة تحت الحقول عشان نجهز طلبك.';
        document.getElementById('fgm-' + fields.find(key => result.errors[key])).focus();
        return;
      }
      const message = buildMessage(result.values);
      document.getElementById('fgm-message').textContent = message;
      send.href = 'https://wa.me/' + BUSINESS_PHONE + '?text=' + encodeURIComponent(message);
      preview.hidden = false;
      status.textContent = 'الرسالة جاهزة للمراجعة. افتح واتساب واضغط إرسال هناك لما تكون البيانات صحيحة.';
      send.focus({ preventScroll: true });
      preview.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { normalizePhone, validateRequest, buildMessage };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})();
