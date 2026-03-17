"use client";

import { useState } from "react";

type Tab = "terms" | "shortcuts" | "skabu" | "pages" | "source";

const tabs: { id: Tab; label: string }[] = [
  { id: "terms", label: "用語集" },
  { id: "shortcuts", label: "ショートカット" },
  { id: "skabu", label: "S株ルール" },
  { id: "pages", label: "ページ説明" },
  { id: "source", label: "ソースコード" },
];

const terms = [
  { term: "現物取引", desc: "実際に株式を購入・売却する取引。買った株は保有銘柄として記録され、売却時に損益が確定します。" },
  { term: "信用取引", desc: "証拠金を担保にレバレッジをかけて取引する方法。買建（ロング）と売建（ショート）が可能です。" },
  { term: "成行注文", desc: "現在の市場価格で即座に約定する注文方式。価格は指定できませんが、確実に約定します。" },
  { term: "指値注文", desc: "希望する価格を指定して発注する注文方式。指定価格に達するまで約定せず、PENDING状態になります。" },
  { term: "買建（ロング）", desc: "信用取引で株を買い建てること。株価が上がると利益、下がると損失になります。" },
  { term: "売建（ショート）", desc: "信用取引で株を売り建てること。株価が下がると利益、上がると損失になります。" },
  { term: "証拠金", desc: "信用取引に必要な担保金。取引金額 ÷ 証拠金率（デフォルト3倍）が必要証拠金となります。" },
  { term: "証拠金率", desc: "信用取引のレバレッジ倍率。3倍なら取引金額の1/3の証拠金で取引可能。管理者が設定可能です。" },
  { term: "ストップ高", desc: "前日終値から東証が定めた値幅制限の上限に達した状態。ストップ高では買い注文ができません。" },
  { term: "ストップ安", desc: "前日終値から東証が定めた値幅制限の下限に達した状態。ストップ安では売り注文ができません。" },
  { term: "約定", desc: "注文が成立し、取引が完了すること。成行注文は即座に約定、指値注文は条件を満たしたときに約定します。" },
  { term: "平均取得単価", desc: "保有銘柄の加重平均の購入価格。複数回に分けて購入した場合に自動計算されます。" },
  { term: "含み損益", desc: "保有銘柄の現在価格と平均取得単価の差額 × 数量。まだ確定していない損益です。" },
  { term: "損益率", desc: "投資額に対する損益の割合(%)。(含み損益 ÷ 取得コスト) × 100 で計算されます。" },
  { term: "OHLC", desc: "始値(Open)・高値(High)・安値(Low)・終値(Close)の略。ローソク足チャートの基本データです。" },
  { term: "出来高", desc: "一定期間内に成立した売買の数量。取引の活発さを示す指標です。" },
  { term: "前日終値", desc: "前営業日の最後に成立した株価。当日の値動きの基準になります。" },
  { term: "ウォッチリスト", desc: "お気に入り銘柄を登録するリスト。取引画面で素早く銘柄を切り替えられます。" },
  { term: "S株（単元未満株）", desc: "100株未満の株式取引。成行注文・現物のみ対応で、前日終値で約定します。詳しくは「S株ルール」タブを参照。" },
  { term: "単元株", desc: "取引所で売買できる最小単位。日本株は原則100株が1単元です。100株以上の注文は通常の単元株取引になります。" },
  { term: "スリッページ", desc: "注文時の表示価格と実際の約定価格のずれ。成行注文では市場の状況により発生します。" },
  { term: "API キー", desc: "Bot/AI から KabuTrade API を利用するための認証キー。パーミッションで操作範囲を制限できます。" },
];

const shortcuts = [
  { key: "B", desc: "買い注文モードに切り替え、数量フィールドにフォーカス" },
  { key: "S", desc: "売り注文モードに切り替え、数量フィールドにフォーカス" },
  { key: "M", desc: "成行 ↔ 指値 を切り替え" },
  { key: "T", desc: "現物 ↔ 信用 を切り替え" },
  { key: "Q", desc: "数量入力フィールドにフォーカス" },
];

const pages = [
  {
    name: "取引", path: "/trade",
    desc: "メインの取引画面。銘柄検索、リアルタイム株価表示、ローソク足チャート（日足・日中足）、注文フォーム、ウォッチリストを統合した画面です。",
  },
  {
    name: "ポートフォリオ", path: "/portfolio",
    desc: "保有銘柄の一覧と評価額を確認できます。各銘柄の現在価格、含み損益、損益率が表示され、総資産評価額も確認できます。",
  },
  {
    name: "信用取引", path: "/margin",
    desc: "信用建玉（ポジション）の一覧と管理画面。各ポジションの含み損益を確認し、決済ボタンで建玉を手仕舞いできます。",
  },
  {
    name: "ランキング", path: "/rankings",
    desc: "全ユーザーの総資産評価額・損益額・損益率によるランキング。トップ3はカード表示で強調されます。",
  },
  {
    name: "注文履歴", path: "/history",
    desc: "過去の全注文履歴。ステータス（約定済み・待機中・キャンセル）でフィルタリングできます。",
  },
  {
    name: "API キー管理", path: "/apikeys",
    desc: "Bot/AI 連携用のAPIキーを作成・管理する画面。パーミッション（read/trade/margin）を設定して、プログラムから取引できます。",
  },
];

export default function HelpPage() {
  const [tab, setTab] = useState<Tab>("terms");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">ヘルプ</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs md:text-sm rounded-md font-medium transition-colors ${
              tab === t.id
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Terms */}
      {tab === "terms" && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">用語集</h2>
          <div className="space-y-0 divide-y divide-gray-800">
            {terms.map((t) => (
              <div key={t.term} className="py-3">
                <dt className="font-bold text-brand-400 text-sm">{t.term}</dt>
                <dd className="text-gray-300 text-sm mt-1">{t.desc}</dd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      {tab === "shortcuts" && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">キーボードショートカット</h2>
          <p className="text-sm text-gray-400 mb-4">
            取引画面でテキスト入力フィールドにフォーカスしていない状態で使用できます。
          </p>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.key} className="flex items-center gap-4 py-2">
                <kbd className="min-w-[40px] text-center px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono font-bold text-brand-400 text-sm">
                  {s.key}
                </kbd>
                <span className="text-gray-300 text-sm">{s.desc}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 rounded bg-gray-800/50 border border-gray-700">
            <p className="text-xs text-gray-400">
              <span className="text-yellow-400 font-bold">Tip:</span> 数量入力後に <kbd className="px-1 py-0.5 rounded bg-gray-700 text-[10px] font-mono">Enter</kbd> で注文を送信できます。
            </p>
          </div>
        </div>
      )}

      {/* S株ルール */}
      {tab === "skabu" && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">S株（単元未満株）取引ルール</h2>

          <div className="p-3 rounded bg-orange-900/20 border border-orange-700/30 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-600 text-white">S株</span>
              <span className="text-sm text-orange-400 font-bold">日本株で100株未満の注文に自動適用</span>
            </div>
            <p className="text-xs text-orange-300/70">
              SBI証券のS株ルールに準拠した単元未満株取引です。
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm text-white mb-2">基本ルール</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="py-2 text-gray-400 w-32">対象</td>
                    <td className="py-2 text-gray-200">日本株で <span className="font-bold text-orange-400">100株未満</span> の注文</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">注文方法</td>
                    <td className="py-2 text-gray-200"><span className="font-bold">成行注文のみ</span>（指値注文は不可）</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">取引種別</td>
                    <td className="py-2 text-gray-200"><span className="font-bold">現物取引のみ</span>（信用取引は不可）</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">売買</td>
                    <td className="py-2 text-gray-200">買い・売り <span className="font-bold">両方可能</span></td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">約定価格</td>
                    <td className="py-2 text-gray-200"><span className="font-bold text-orange-400">前日終値</span> で約定（リアルタイム価格ではありません）</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold text-sm text-white mb-2">通常注文との違い</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 text-left text-gray-400"></th>
                    <th className="py-2 text-center text-gray-400">通常注文 (100株以上)</th>
                    <th className="py-2 text-center text-orange-400">S株 (100株未満)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="py-2 text-gray-400">成行注文</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">指値注文</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                    <td className="py-2 text-center text-red-400">×</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">現物取引</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">信用取引</td>
                    <td className="py-2 text-center text-gray-300">○</td>
                    <td className="py-2 text-center text-red-400">×</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">約定価格</td>
                    <td className="py-2 text-center text-gray-300">現在値 ± スリッページ</td>
                    <td className="py-2 text-center text-orange-400">前日終値</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">米国株</td>
                    <td className="py-2 text-center text-gray-300">1株から通常注文</td>
                    <td className="py-2 text-center text-gray-500">対象外</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded bg-gray-800/50 border border-gray-700">
              <p className="text-xs text-gray-400">
                <span className="text-yellow-400 font-bold">注意:</span> S株は少額から株式投資を始められるメリットがありますが、
                約定価格が前日終値に固定されるため、当日の値動きは反映されません。
                100株以上の注文は自動的に通常注文として処理されます。
                米国株は1株から通常注文として取引できるため、S株ルールは適用されません。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pages */}
      {tab === "pages" && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">ページ説明</h2>
          <div className="space-y-4">
            {pages.map((p) => (
              <div key={p.path} className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white">{p.name}</span>
                  <code className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-mono">{p.path}</code>
                </div>
                <p className="text-sm text-gray-300">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="font-bold text-sm mb-2 text-gray-400">チャート機能</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <p>日足: 1ヶ月 / 3ヶ月 / 6ヶ月 / 1年</p>
              <p>日中足: 1分 / 5分 / 10分 / 15分 / 30分 / 1時間 / 2時間 / 4時間</p>
              <p>描画ツール: トレンドライン、水平線、フィボナッチリトレースメント（デスクトップのみ）</p>
            </div>
          </div>
        </div>
      )}

      {/* Source */}
      {tab === "source" && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">ソースコード</h2>

          <div className="space-y-4">
            <div className="p-4 rounded bg-gray-800/50 border border-gray-700/50">
              <p className="text-sm text-gray-300 mb-3">
                KabuTrade はオープンソースのデモトレードプラットフォームです。
              </p>
              <a
                href="https://github.com/serkenn/kabu-trade"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub リポジトリ
              </a>
            </div>

            <div>
              <h3 className="font-bold text-sm mb-3 text-gray-400">技術スタック</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { label: "バックエンド", value: "Express.js + TypeScript" },
                  { label: "フロントエンド", value: "Next.js 14 (App Router)" },
                  { label: "データベース", value: "PostgreSQL + Prisma ORM" },
                  { label: "UI", value: "TailwindCSS" },
                  { label: "チャート", value: "Lightweight Charts" },
                  { label: "認証", value: "JWT + evex-accounts OAuth 2.0" },
                  { label: "日本株データ", value: "Nikkei Smart Chart" },
                  { label: "米国株データ", value: "Finnhub + Stooq" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-1.5 px-3 rounded bg-gray-800/30 text-sm">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-gray-200 font-mono text-xs">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm mb-3 text-gray-400">プロジェクト構成</h3>
              <pre className="text-xs font-mono text-gray-300 bg-gray-800/50 rounded p-3 overflow-x-auto">
{`kabu-trade/
├── packages/
│   ├── frontend/    # ユーザー向け UI (Next.js :3000)
│   ├── admin/       # 管理画面 (Next.js :3001)
│   ├── backend/     # API サーバー (Express :4000)
│   └── shared/      # 共通ライブラリ (Prisma, JWT, 型定義)
├── docker-compose.yml
└── docs/
    ├── API.md       # Bot API ドキュメント
    └── SECURITY.md  # セキュリティドキュメント`}
              </pre>
            </div>

            <div className="p-4 rounded bg-yellow-900/20 border border-yellow-700/30">
              <h3 className="font-bold text-sm text-yellow-400 mb-2">バグ報告・機能リクエスト</h3>
              <p className="text-sm text-gray-300 mb-3">
                問題を見つけた場合や改善提案がある場合は、GitHub の Issues または Pull Request からお願いします。
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/serkenn/kabu-trade/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-xs font-medium transition-colors"
                >
                  Issue を作成
                </a>
                <a
                  href="https://github.com/serkenn/kabu-trade/pulls"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium transition-colors"
                >
                  Pull Request を送る
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
