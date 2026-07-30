export default function SettingsPage(): React.ReactNode {
  return (
    <div className="page-stack">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <span>Production xavfsizligi</span>
            <h2>Sozlamalar</h2>
          </div>
        </div>
        <dl className="settings-list">
          <div>
            <dt>Autentifikatsiya</dt>
            <dd>Serverda tekshirilgan Telegram initData + allowlist</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>HttpOnly, SameSite=Strict, production’da Secure</dd>
          </div>
          <div>
            <dt>Mutation himoyasi</dt>
            <dd>CSRF, rate limit va idempotency key</dd>
          </div>
          <div>
            <dt>Rasm manbalari</dt>
            <dd>placehold.co va images.unsplash.com HTTPS URL</dd>
          </div>
          <div>
            <dt>Maxfiy konfiguratsiya</dt>
            <dd>
              Token va database qiymatlari faqat Vercel server
              environment orqali beriladi.
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Oddiy brauzer orqali kirish</h2>
        <p>
          MVP’da parolli login yo‘q. Admin panel Telegram botdagi
          maxsus admin Web App tugmasi orqali ochiladi. Keyingi
          bosqichda alohida SSO yoki passkey oqimi xavfsizlik auditi
          bilan qo‘shilishi mumkin.
        </p>
      </section>
    </div>
  );
}
