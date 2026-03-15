import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 - KabuTrade",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">利用規約</h1>
        <p className="text-gray-400 text-sm mb-8">最終更新日: 2026年3月16日</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第1条（適用）</h2>
            <p>
              本利用規約（以下「本規約」）は、KabuTrade（以下「本サービス」）の利用に関する条件を定めるものです。
              ユーザーは本サービスを利用することにより、本規約に同意したものとみなします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第2条（サービスの内容）</h2>
            <p>
              本サービスは、日本株および米国株のデモトレード（仮想取引）プラットフォームです。
              本サービスで使用される資金はすべて仮想のものであり、実際の金銭的価値はありません。
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>本サービスは教育・学習目的で提供されます</li>
              <li>実際の証券取引とは異なります</li>
              <li>投資助言や金融商品の推奨を行うものではありません</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第3条（アカウント）</h2>
            <p>
              ユーザーはアカウント登録時に正確な情報を提供し、アカウントの管理について責任を負います。
              アカウントの不正利用が発覚した場合、事前の通知なくアカウントを停止することがあります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第4条（禁止事項）</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>本サービスの不正利用またはシステムへの攻撃</li>
              <li>他のユーザーへの迷惑行為</li>
              <li>APIの過度な利用によるサービスへの負荷</li>
              <li>法令に違反する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第5条（免責事項）</h2>
            <p>
              本サービスは「現状のまま」で提供され、株価データの正確性、サービスの継続性について保証しません。
              本サービスの利用に起因する損害について、運営者は一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第6条（サービスの変更・終了）</h2>
            <p>
              運営者は、事前の通知なく本サービスの内容を変更、または提供を終了することができます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">第7条（規約の変更）</h2>
            <p>
              運営者は本規約を変更できるものとし、変更後の規約は本ページに掲載した時点で効力を生じます。
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
