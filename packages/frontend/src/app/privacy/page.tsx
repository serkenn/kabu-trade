import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー - KabuTrade",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">プライバシーポリシー</h1>
        <p className="text-gray-400 text-sm mb-8">最終更新日: 2026年3月16日</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. 収集する情報</h2>
            <p>本サービスでは、以下の情報を収集します。</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>メールアドレス、表示名（アカウント登録時）</li>
              <li>IPアドレス、User-Agent（セキュリティ・監査目的）</li>
              <li>取引履歴、注文データ（サービス提供のため）</li>
              <li>外部認証（evex-accounts）利用時: ユーザーID、メールアドレス、表示名</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. 情報の利用目的</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>サービスの提供および運営</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>セキュリティの確保（不正アクセスの検知・防止）</li>
              <li>監査ログの記録（コンプライアンス対応）</li>
              <li>サービスの改善</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. 情報の保存</h2>
            <p>
              収集した情報はサーバー上のデータベースに保存されます。
              パスワードは bcrypt によるハッシュ化、APIキーおよびセッショントークンは SHA-256 ハッシュとして保存され、
              平文での保存は行いません。
            </p>
            <p className="mt-2">
              監査ログ（ログイン履歴、操作履歴等）はセキュリティおよびコンプライアンスのため永続的に保存されます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. 第三者への提供</h2>
            <p>
              収集した個人情報は、法令に基づく場合を除き、第三者に提供しません。
              ただし、本サービスは以下の外部サービスと連携します。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>evex-accounts（認証サービス）: OAuth 2.0 による認証連携</li>
              <li>J-Quants API / Finnhub API: 株価データの取得（個人情報の送信なし）</li>
              <li>Cloudflare: ネットワークセキュリティ・CDN</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Cookie の利用</h2>
            <p>
              本サービスでは、認証状態の管理のために HttpOnly Cookie を使用します。
              トラッキング目的の Cookie は使用しません。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><code className="text-gray-300">token</code> — セッション管理（有効期限: 7日間）</li>
              <li><code className="text-gray-300">evex_cv</code>, <code className="text-gray-300">evex_state</code> — OAuth 認証フロー用（有効期限: 5分間）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. ユーザーの権利</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>アカウント情報の確認および変更</li>
              <li>全セッションの無効化</li>
              <li>APIキーの削除</li>
              <li>アカウントの削除を運営者に依頼する権利</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. セキュリティ</h2>
            <p>
              本サービスでは、データ保護のために以下のセキュリティ対策を実施しています。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>HTTPS による通信の暗号化</li>
              <li>パスワードの bcrypt ハッシュ化</li>
              <li>セキュリティヘッダー（Helmet.js）</li>
              <li>レート制限によるブルートフォース対策</li>
              <li>アカウントロック機能</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. ポリシーの変更</h2>
            <p>
              本ポリシーは予告なく変更されることがあります。変更後のポリシーは本ページに掲載した時点で効力を生じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. お問い合わせ</h2>
            <p>
              本ポリシーに関するお問い合わせは、サービス運営者までご連絡ください。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-700">
          <a href="/login" className="text-brand-400 hover:text-brand-300 text-sm">
            ← ログインページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
