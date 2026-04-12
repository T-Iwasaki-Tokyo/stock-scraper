'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, LayoutDashboard, Play, Save, ExternalLink, 
  TrendingUp, Calendar, Tag, CheckCircle2, Circle, 
  ChevronDown, ChevronUp, Star, Percent, Coins, Clock, ShieldCheck, RefreshCw, BarChart3, Search,
  Download, FileSpreadsheet, Activity, CheckCircle
} from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [config, setConfig] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({ phase: 'idle', message: '待機中', current: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(['金券・ポイント']);

  const fetchResults = useCallback(async () => {
    const res = await fetch('/api/results');
    const data = await res.json();
    setResults(data);
  }, []);

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setStatus(data);
    if (data.phase === 'completed') {
       setIsRunning(false);
    } else if (data.phase !== 'idle' && data.phase !== 'error') {
       setIsRunning(true);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    const data = await res.json();
    setConfig(data);
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchResults();
    fetchStatus();
  }, [fetchConfig, fetchResults, fetchStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchResults();
      fetchStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchResults, fetchStatus]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    await fetch('/api/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    setIsSaving(false);
  };

  const handleRunScraper = async () => {
    // フロントエンド側でも即座にリセット感を出す
    setResults([]);
    setIsRunning(true);
    setStatus({ phase: 'searching', message: '銘柄リストを作成しています...', current: 0, total: 0 });
    
    await fetch('/api/run', { method: 'POST' });
    setActiveTab('dashboard');
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    
    const headers = ['コード', '銘柄名', '現在値', '総合利回り', '配当利回り', 'PBR', '更新日時', 'Yahoo引用元'];
    const rows = results.map(s => [
      s.code,
      s.name,
      s.price,
      s.totalYield,
      s.dividendYield,
      s.pbr,
      s.timestamp || '-',
      s.yahooUrl
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // Excel用BOM
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `銘優待検索結果_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!config) return <div className="p-20 text-center font-bold text-slate-400">システムを起動しています...</div>;

  const isActive = (val: any) => val !== "" && val !== null && val !== undefined && val !== "1";

  const categoryGroups = [
    { name: '金券・ポイント', items: [
      { id: '1', name: 'QUOカード' }, { id: '2', name: 'ギフトカード' }, { id: '3', name: 'グルメカード' },
      { id: '4', name: 'デジタルギフト' }, { id: '5', name: '共通ポイント' }, { id: '6', name: '自社ポイント' },
      { id: '7', name: 'プレミアム優待' }, { id: '8', name: '図書券' }, { id: '9', name: 'おこめ券' }
    ]},
    { name: '買い物・食事（割引・無料券）', items: [
      { id: '10', name: '百貨店・スーパー' }, { id: '11', name: 'ドラッグストア' }, { id: '12', name: '衣料品' },
      { id: '13', name: '家電' }, { id: '14', name: 'ホームセンター' }, { id: '17', name: 'レストラン' },
      { id: '18', name: '焼肉・ハンバーグ' }, { id: '19', name: 'カフェ' }, { id: '20', name: '居酒屋' }, { id: '21', name: '中華・ラーメン' }
    ]},
    { name: '娯楽・移動・スポーツ', items: [
      { id: '23', name: '乗り物' }, { id: '24', name: '旅行' }, { id: '25', name: '映画・演劇' },
      { id: '26', name: '遊園地' }, { id: '27', name: 'カラオケ' }, { id: '28', name: '温泉' },
      { id: '30', name: 'ゴルフ' }, { id: '31', name: 'フィットネス' }
    ]},
    { name: '飲食料品（現物配布）', items: [
      { id: '39', name: '飲料' }, { id: '40', name: 'お米' }, { id: '41', name: '麺類' }, { id: '42', name: '肉類' },
      { id: '43', name: '菓子・スイーツ' }, { id: '44', name: '果物' }, { id: '45', name: '野菜' }, { id: '46', name: '魚介類' },
      { id: '47', name: '調味料' }, { id: '48', name: '健康食品' }, { id: '49', name: '詰め合わせ' }
    ]},
    { name: '日用品・カタログ・その他', items: [
      { id: '15', name: '美容・化粧品' }, { id: '51', name: '家庭用品' }, { id: '52', name: '紙製品' },
      { id: '53', name: 'カレンダー' }, { id: '55', name: '文具' }, { id: '56', name: '日用品詰合せ' },
      { id: '33', name: '宿泊施設' }, { id: '35', name: '住宅関連' }, { id: '36', name: '医療・福祉' }
    ]}
  ];

  return (
    <div className="min-h-screen flex text-slate-800">
      {/* 垂直サイドバー */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0 min-h-screen">
        <div className="p-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <span className="font-bold tracking-tight text-lg">株主優待検索</span>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Automatic Scraper</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard size={18} /> ダッシュボード
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-bold transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={18} /> 検索条件の設定
          </button>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-xs text-slate-400 font-bold">{isRunning ? 'システム稼働中' : 'アイドル'}</span>
          </div>
          <button 
            onClick={handleRunScraper}
            disabled={isRunning}
            className="w-full bg-white text-slate-900 py-3 rounded font-bold text-sm shadow-lg hover:bg-slate-100 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Search size={16} /> {isRunning ? '実行中...' : '検索を開始'}
          </button>
        </div>

        <div className="px-8 py-5 bg-slate-950/40 border-t border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-bold mb-1">株主優待自動検索システム</p>
          <p className="text-[9px] text-slate-600">バージョン 6.0 | 開発部</p>
        </div>
      </div>

      {/* メイン コンテンツ */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50">
        <main className="p-10 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
              {/* シーケンス進捗ボード */}
              <div className="main-panel p-8 rounded-2xl border-none shadow-sm bg-white overflow-hidden relative">
                 <div className="flex justify-between items-center relative z-10">
                    {[
                      { id: 'idle', label: '待機', icon: Clock },
                      { id: 'searching', label: 'リスト抽出', icon: Search },
                      { id: 'fetching', label: '詳細取得', icon: Activity },
                      { id: 'completed', label: '完了', icon: CheckCircle }
                    ].map((step, idx) => {
                      const isActive = status.phase === step.id;
                      const isPast = ['idle', 'searching', 'fetching', 'completed'].indexOf(status.phase) > ['idle', 'searching', 'fetching', 'completed'].indexOf(step.id);
                      const isDone = status.phase === 'completed' || isPast;
                      
                      return (
                        <div key={step.id} className="flex flex-col items-center gap-3 relative flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <step.icon size={20} />
                          </div>
                          <span className={`text-xs font-bold ${isActive ? 'text-blue-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>{step.label}</span>
                          {idx < 3 && (
                            <div className={`absolute h-[2px] w-full top-5 left-1/2 -z-10 ${isDone ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
                          )}
                        </div>
                      )
                    })}
                 </div>
                 
                 <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="text-sm font-bold text-slate-600">{status.message}</div>
                       {status.phase === 'fetching' && (
                         <div className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black">
                           {status.current} / {status.total} 件目
                         </div>
                       )}
                    </div>
                    {status.phase === 'fetching' && (
                      <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 transition-all duration-500" 
                          style={{ width: `${(status.current / status.total) * 100}%` }}
                        ></div>
                      </div>
                    )}
                 </div>
              </div>

              <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">ダッシュボード</h2>
                  <p className="text-slate-500 text-sm mt-1">取得された銘柄を一覧で表示しています</p>
                </div>
                <div className="text-right flex items-center gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">銘柄数</span>
                    <p className="text-3xl font-black text-blue-600">{results.length}</p>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    disabled={results.length === 0}
                    className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-30"
                  >
                    <FileSpreadsheet size={18} className="text-emerald-600" /> スプレッドシート出力
                  </button>
                </div>
              </div>

              <div className="main-panel rounded-lg overflow-hidden bg-white">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-32">状態</th>
                      <th className="w-20">コード</th>
                      <th className="w-48">銘柄名</th>
                      <th className="w-32">株価</th>
                      <th className="w-32">総合利回り</th>
                      <th className="w-32">配当利回り</th>
                      <th className="w-24">PBR</th>
                      <th className="w-24 text-right">詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((stock) => {
                      const isComplete = stock.status === 'complete';
                      return (
                        <tr key={stock.code}>
                          <td>
                            <span className={`badge ${isComplete ? 'badge-green' : 'badge-blue'}`}>
                              {isComplete ? '完了' : '取得中'}
                            </span>
                          </td>
                          <td className="font-bold text-slate-400">{stock.code}</td>
                          <td className="font-bold">{stock.name}</td>
                          <td className="font-bold text-slate-900">{isComplete ? `¥${stock.price}` : <span className="text-slate-200 italic">読込中</span>}</td>
                          <td className="font-bold text-emerald-600">{stock.totalYield}</td>
                          <td className="font-bold text-slate-500">{isComplete ? stock.dividendYield : '-'}</td>
                          <td className="font-bold text-blue-500">{isComplete ? stock.pbr : '-'}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <a href={stock.yahooUrl} target="_blank" className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><ExternalLink size={16} /></a>
                              <a href={stock.chartUrl} target="_blank" className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><TrendingUp size={16} /></a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-300 font-medium italic">
                          {isRunning ? 'データを取得しています...' : '現在データはありません。検索を開始してください。'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">検索条件の設定</h2>
                  <p className="text-slate-500 text-sm mt-1">ご希望の条件を入力して保存してください</p>
                </div>
                <button 
                  onClick={handleSaveConfig} 
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-10 py-3 rounded font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Save size={18} /> {isSaving ? '保存中...' : '設定を保存'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-12 pb-20">
                {/* 設定項目はそのまま維持 */}
                <div className="main-panel p-10 rounded-xl space-y-8">
                  <div className="flex items-center gap-2 text-blue-600 font-bold border-b border-slate-100 pb-4">
                    <Coins size={20} /> <span>1. 主要な条件</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400">最大投資金額</label>
                      <div className="relative">
                        <input type="number" value={config.search.maxAmount} placeholder="上限なし" onChange={(e) => setConfig({...config, search: {...config.search, maxAmount: e.target.value}})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-md font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                        <span className="absolute right-4 top-4 text-slate-300 font-bold">円</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400">最低利回り（総合）</label>
                      <select 
                        value={config.search.minYieldTotal}
                        onChange={(e) => setConfig({...config, search: {...config.search, minYieldTotal: e.target.value}})}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-md font-bold outline-none cursor-pointer"
                      >
                         <option value="">指定なし</option>
                         {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}%以上</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400">おすすめ度（★）</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button key={s} onClick={() => setConfig({...config, search: {...config.search, minRecommendation: s.toString()}})} className={`option-btn flex-1 ${config.search.minRecommendation === s.toString() ? 'active' : ''}`}>★{s}以上</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400">長期保有特典</label>
                      <div className="flex gap-1">
                        {[{v:'',l:'指定なし'}, {v:'exists',l:'特典あり'}, {v:'only',l:'特典のみ'}].map(o => (
                          <button key={o.v} onClick={() => setConfig({...config, search: {...config.search, longTerm: o.v}})} className={`option-btn flex-1 ${config.search.longTerm === o.v ? 'active' : ''}`}>{o.l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="main-panel p-10 rounded-xl space-y-6">
                  <div className="flex items-center gap-2 text-blue-600 font-bold border-b border-slate-100 pb-4">
                    <Calendar size={20} /> <span>2. 権利確定月</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const month = (i + 1).toString();
                      const selected = config.search.months.includes(month);
                      return (
                        <button key={month} onClick={() => {
                           const next = selected ? config.search.months.filter((m: any) => m !== month) : [...config.search.months, month];
                           setConfig({...config, search: {...config.search, months: next}});
                        }} className={`option-btn h-14 ${selected ? 'active' : ''}`}>
                          {month}月
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="main-panel p-10 rounded-xl space-y-6">
                   <div className="flex items-center gap-2 text-blue-600 font-bold border-b border-slate-100 pb-4">
                    <Tag size={20} /> <span>3. カテゴリで絞り込む</span>
                  </div>
                  <div className="space-y-2">
                     {categoryGroups.map(group => {
                       const isOpen = openGroups.includes(group.name);
                       const selCount = group.items.filter(it => config.search.categories.includes(it.id)).length;
                       return (
                         <div key={group.name} className="border border-slate-100 rounded-lg">
                           <button onClick={() => setOpenGroups(isOpen ? openGroups.filter(g => g !== group.name) : [...openGroups, group.name])} className="w-full flex justify-between items-center p-5 text-left bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg">
                             <div className="flex items-center gap-3">
                               <span className={`text-sm font-bold ${selCount > 0 ? 'text-blue-600' : 'text-slate-700'}`}>{group.name}</span>
                               {selCount > 0 && <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selCount} 個選択中</span>}
                             </div>
                             {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                           </button>
                           {isOpen && (
                             <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-2 bg-white">
                               {group.items.map(item => {
                                 const selected = config.search.categories.includes(item.id);
                                 return (
                                   <button 
                                     key={item.id} 
                                     onClick={() => {
                                       const next = selected ? config.search.categories.filter((c:any) => c !== item.id) : [...config.search.categories, item.id];
                                       setConfig({...config, search: {...config.search, categories: next}});
                                     }}
                                     className={`option-btn text-xs py-3 ${selected ? 'active' : ''}`}
                                   >
                                     {item.name}
                                   </button>
                                 )
                               })}
                             </div>
                           )}
                         </div>
                       )
                     })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div className="main-panel p-8 rounded-xl space-y-4">
                      <label className="text-xs font-bold text-slate-400 italic">銘柄の信用区分</label>
                      <div className="flex gap-1">
                         {[{v: '', l:'全て'}, {v:'standard', l:'制度信用'}, {v:'loan', l:'一般信用'}].map(o => (
                           <button key={o.v} onClick={() => setConfig({...config, search: {...config.search, creditTrading: o.v}})} className={`option-btn flex-1 ${config.search.creditTrading === o.v ? 'active' : ''}`}>{o.l}</button>
                         ))}
                      </div>
                   </div>
                   <div className="main-panel p-8 rounded-xl space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-slate-400">上限銘柄数</label>
                           <input type="number" value={config.scraping.maxStocks} onChange={(e) => setConfig({...config, scraping: {...config.scraping, maxStocks: parseInt(e.target.value)}})} className="w-full border border-slate-200 p-3 rounded font-bold" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-slate-400">取得間隔 (分)</label>
                           <input type="number" step="0.1" value={config.scraping.intervalMinutes} onChange={(e) => setConfig({...config, scraping: {...config.scraping, intervalMinutes: parseFloat(e.target.value)}})} className="w-full border border-slate-200 p-3 rounded font-bold" />
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
