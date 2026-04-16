'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [configName, setConfigName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [sortKey, setSortKey] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchResults = useCallback(async () => {
    const res = await fetch('/api/results');
    const data = await res.json();
    setResults(data);
  }, []);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // 数値変換（利回りや金額用）
      if (['price', 'totalYield', 'dividendYield', 'yutaiYield', 'pbr', 'ma5Diff', 'ma25Diff'].includes(sortKey)) {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, sortKey, sortOrder]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
      if (data.current?.name) {
        setConfigName(data.current.name);
      }
    } catch (e) {
      console.error('Config fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchResults();
  }, [fetchConfig, fetchResults]);

  const handleSaveConfig = async () => {
    if (!configName.trim()) {
      alert('設定名を入力してください');
      return;
    }
    setIsSaving(true);
    try {
      const current = config.current || config;
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: configName, 
          config: { 
            search: current.search, 
            scraping: current.scraping,
            mode: current.mode || 'condition'
          } 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        alert('設定を保存しました');
      }
    } catch (e) {
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('ファイルを選択してください');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchConfig(); // モードが更新されたので再取得
      } else {
        alert(`アップロード失敗: ${data.error}`);
      }
    } catch (e) {
      alert('通信エラーが発生しました');
    } finally {
      setIsUploading(false);
    }
  };

  const setMode = async (mode: 'condition' | 'file') => {
    const current = config.current || config;
    if (current.mode === mode) return;

    // 設定を保存してモードを切り替え
    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: configName, 
          config: { ...current, mode } 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      }
  };

  const loadHistoryConfig = (hist: any) => {
    setConfig({ ...config, current: hist });
    setConfigName(hist.name);
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleRunScraper = async () => {
    if (!config) return;
    const currentConfig = config.current || config;
    setIsRunning(true);
    setResults([]);
    
    setStatus({ phase: 'searching', message: '銘柄リストを作成しています...', current: 0, total: 0 });
    const listRes = await fetch('/api/scrape/list', { method: 'POST' });
    const listData = await listRes.json();
    
    if (!listData.success) {
      setStatus({ phase: 'error', message: `エラー: ${listData.error}`, current: 0, total: 0 });
      setIsRunning(false);
      return;
    }

    const stocks = listData.stocks;
    setResults(stocks);
    setStatus({ phase: 'fetching', message: '詳細情報を1銘柄ずつ取得します', current: 0, total: stocks.length });

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      setStatus({ phase: 'fetching', message: `${stock.name} (${stock.code}) を取得中...`, current: i + 1, total: stocks.length });
      
      const detailRes = await fetch(`/api/scrape/detail?code=${stock.code}`);
      const detailData = await detailRes.json();

      if (detailData.success) {
        setResults(prev => prev.map(s => s.code === stock.code ? { ...s, ...detailData.detail } : s));
      }

      if (i < stocks.length - 1) {
        const waitMs = (currentConfig.scraping.intervalMinutes || 1) * 60 * 1000;
        const waitSeconds = Math.floor(waitMs / 1000);
        for(let s = waitSeconds; s > 0; s--) {
          setStatus((prev: any) => ({ ...prev, message: `次の銘柄まで待機中...あと ${s} 秒` }));
          await sleep(1000);
        }
      }
    }

    setStatus({ phase: 'completed', message: 'すべての情報の取得が完了しました', current: stocks.length, total: stocks.length });
    setIsRunning(false);
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    const headers = ['コード', '銘柄名', '現在値', '総合利回り', '配当利回り', '優待利回り', 'PBR', '5日線', '5日乖離率', '25日線', '25日乖離率', '更新日時', 'Yahoo引用元'];
    const rows = results.map(s => [
      s.code, s.name, s.price, s.totalYield, s.dividendYield, s.yutaiYield, s.pbr, 
      s.ma5_val || '-', s.ma5_diff || '-', s.ma25_val || '-', s.ma25_diff || '-',
      s.timestamp || '-', s.yahooUrl
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); 
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `銘優待検索結果_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  if (!config) return <div className="p-20 text-center font-bold text-slate-400">システムを起動しています...</div>;

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
      <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0 min-h-screen">
        <div className="p-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <span className="font-bold tracking-tight text-lg">株主優待検索</span>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Automatic Scraper</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard size={18} /> ダッシュボード
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-bold transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={18} /> 検索条件の設定
          </button>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800/50">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{isRunning ? 'システム稼働中' : 'アイドル状態'}</span>
          </div>
          <button 
            onClick={handleRunScraper}
            disabled={isRunning}
            className="w-full bg-white text-slate-900 py-3 rounded font-bold text-sm shadow-xl hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} 
            {isRunning ? '取得中...' : '検索を開始'}
          </button>
        </div>

        <div className="px-8 py-5 bg-slate-950/40 border-t border-slate-800/50">
          <p className="text-[10px] text-slate-500 font-bold mb-1">株主優待自動検索システム</p>
          <p className="text-[9px] text-slate-600">バージョン 8.1 | クラウド対応版</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-auto bg-slate-50">
        <main className="p-10 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
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
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 scale-110' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <step.icon size={20} />
                          </div>
                          <span className={`text-[11px] font-bold ${isActive ? 'text-indigo-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>{step.label}</span>
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
                         <div className="text-xs bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full font-black">
                           {status.current} / {status.total} 件目
                         </div>
                       )}
                    </div>
                    {status.phase === 'fetching' && (
                      <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-1000 ease-out" 
                          style={{ width: `${(status.current / status.total) * 100}%` }}
                        ></div>
                      </div>
                    )}
                 </div>
              </div>
              <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">ダッシュボード</h2>
                  <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                    <Clock size={14} className="text-slate-400" />
                    <span>データ最終取得: {results.length > 0 ? (results.reduce((latest, s) => (!latest || (s.timestamp && s.timestamp > latest)) ? s.timestamp : latest, '') || 'データなし') : '読み込み中...'}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">取得銘柄</span>
                    <p className="text-3xl font-black text-indigo-600">{results.length}</p>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    disabled={results.length === 0}
                    className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-30"
                  >
                    <FileSpreadsheet size={18} className="text-emerald-600" /> スプレッドシート出力
                  </button>
                </div>
              </div>

              <div className="main-panel rounded-xl shadow-sm overflow-hidden bg-white border border-slate-100">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-32">状態</th>
                      <th className="w-24 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('code')}>
                        <div className="flex items-center gap-1">
                          コード
                          {sortKey === 'code' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-48 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('name')}>
                        <div className="flex items-center gap-1">
                          銘柄名
                          {sortKey === 'name' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-32 text-right cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('price')}>
                        <div className="flex items-center justify-end gap-1">
                          現在値
                          {sortKey === 'price' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-32 text-right cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('totalYield')}>
                        <div className="flex items-center justify-end gap-1">
                          総合利回り
                          {sortKey === 'totalYield' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-32 text-right cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('dividendYield')}>
                        <div className="flex items-center justify-end gap-1">
                          配当利回り
                          {sortKey === 'dividendYield' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-32 text-right cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('yutaiYield')}>
                        <div className="flex items-center justify-end gap-1">
                          優待利回り
                          {sortKey === 'yutaiYield' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-24 text-right cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('pbr')}>
                        <div className="flex items-center justify-end gap-1">
                          PBR
                          {sortKey === 'pbr' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-28 text-right underline decoration-indigo-200 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('ma5Diff')}>
                        <div className="flex items-center justify-end gap-1">
                          5日線
                          {sortKey === 'ma5Diff' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-28 text-right pr-6 underline decoration-indigo-200 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => toggleSort('ma25Diff')}>
                        <div className="flex items-center justify-end gap-1">
                          25日線
                          {sortKey === 'ma25Diff' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <div className="w-3.5" />}
                        </div>
                      </th>
                      <th className="w-24 text-right pr-6 whitespace-nowrap">リンク</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((stock) => {
                      const isComplete = stock.status === 'complete';
                      return (
                        <tr key={stock.code} className="hover:bg-slate-50/50 transition-colors">
                          <td className="pl-6">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded inline-flex items-center gap-1.5 ${isComplete ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 animate-pulse'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-indigo-600'}`}></span>
                              {isComplete ? '完了' : '取得中'}
                            </span>
                          </td>
                          <td className="font-bold text-slate-400 font-mono tracking-tighter">{stock.code}</td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 leading-tight">{stock.name}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={stock.yutai_desc}>{stock.yutai_desc || '-'}</span>
                            </div>
                          </td>
                          <td className="text-right font-black text-slate-700">
                            {stock.price ? (
                              <div className="flex flex-col items-end">
                                <span>{Number(stock.price).toLocaleString()}円</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="text-right font-black text-indigo-600">
                            {stock.totalYield && stock.totalYield !== 'N/A' ? `${stock.totalYield}%` : '-'}
                          </td>
                          <td className="text-right font-bold text-slate-500">
                            {stock.dividendYield && stock.dividendYield !== 'N/A' ? `${stock.dividendYield}%` : '-'}
                          </td>
                          <td className="text-right font-bold text-slate-500">
                            {stock.yutaiYield && stock.yutaiYield !== 'N/A' ? `${stock.yutaiYield}%` : '-'}
                          </td>
                          <td className="text-right font-bold text-slate-500">{stock.pbr || '-'}</td>
                          <td className={`text-right font-bold ${parseFloat(stock.ma5Diff) < 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                            {stock.ma5Diff ? `${stock.ma5Diff}%` : '-'}
                          </td>
                          <td className={`text-right pr-6 font-bold ${parseFloat(stock.ma25Diff) < 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                            {stock.ma25Diff ? `${stock.ma25Diff}%` : '-'}
                          </td>
                          <td className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                              <a href={`https://kabutan.jp/stock/chart?code=${stock.code}`} target="_blank" className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"><ExternalLink size={14} /></a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-32 text-center text-slate-400 bg-slate-50/20">
                          <p className="font-bold">データがありません</p>
                          <p className="text-xs mt-1">「検索を開始」ボタンを押して調査を開始してください。</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="flex justify-between items-end border-b border-slate-200 pb-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter text-slate-900">検索条件の設定</h2>
                  <p className="text-slate-500 text-sm mt-1">ご希望の条件を入力して保存してください。保存した条件が GitHub Actions にも反映されます。</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">設定名</label>
                    <input 
                      type="text" 
                      value={configName} 
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="例: 高配当モデル" 
                      className="bg-white border border-slate-200 px-4 py-3.5 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100 min-w-[240px]"
                    />
                  </div>
                  <button 
                    onClick={handleSaveConfig} 
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-2xl hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 mt-4"
                  >
                    {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 
                    {isSaving ? '保存中...' : '設定を保存'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl w-fit">
                <button 
                  onClick={() => setMode('condition')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-black transition-all ${((config.current || config).mode || 'condition') === 'condition' ? 'bg-white text-indigo-600 shadow-md translate-y-0' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Settings size={16} /> 条件指定
                </button>
                <button 
                  onClick={() => setMode('file')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-black transition-all ${((config.current || config).mode || 'condition') === 'file' ? 'bg-white text-indigo-600 shadow-md translate-y-0' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Download size={16} /> ファイル読込
                </button>
              </div>

              {((config.current || config).mode || 'condition') === 'file' ? (
                <div className="main-panel p-16 rounded-3xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center gap-8 text-center">
                  <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet size={48} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800">銘柄リストのアップロード</h3>
                    <p className="text-slate-500 max-w-md mx-auto">Excel (.xlsx) または CSV を読み込めます。<br/>A列に<strong>銘柄コード</strong>、B列に<strong>会社名</strong>を記載してください。</p>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <button 
                      onClick={handleFileUpload}
                      disabled={isUploading || !selectedFile}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-xl hover:bg-indigo-700 disabled:opacity-30 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      {isUploading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                      {isUploading ? '読み込み中...' : 'ファイルを読み込んで適用'}
                    </button>
                  </div>
                  {((config.current || config).mode === 'file') && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-full font-black text-sm">
                      <CheckCircle size={18} />
                      現在はファイル読み込みモードで動作します
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {config.history && config.history.length > 0 && (
                    <div className="main-panel p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                          <Clock size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 leading-tight">保存済みの履歴 ({config.history.length}/12)</h4>
                          <p className="text-xs text-slate-500 font-medium">過去の設定を呼び出せます</p>
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 max-w-[70%]">
                        {config.history.map((h: any, idx: number) => (
                          <button 
                            key={idx} 
                            onClick={() => loadHistoryConfig(h)}
                            className={`shrink-0 px-4 py-2.5 rounded-lg border text-xs font-bold transition-all ${config.current?.id === h.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                          >
                            {h.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-12 pb-24">
                <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-10">
                  <div className="flex items-center gap-3 text-indigo-600 font-black text-lg border-b border-slate-50 pb-5">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Coins size={20} /> 
                    </div>
                    <span>1. 主要な条件</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-12 gap-y-10">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">最大投資金額</label>
                      <div className="relative group">
                        <input 
                          type="number" 
                          value={(config.current || config)?.search?.maxAmount || ''} 
                          placeholder="上限なし" 
                          onChange={(e) => {
                            const current = config.current || config;
                            const search = current.search || {};
                            setConfig({...config, current: {...current, search: {...search, maxAmount: e.target.value}}});
                          }} 
                          className="w-full bg-slate-50 border border-slate-200 p-5 rounded-xl font-black text-lg outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white transition-all" 
                        />
                        <span className="absolute right-6 top-6 text-slate-300 font-bold">円</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">最低利回り（総合）</label>
                      <select 
                        value={(config.current || config)?.search?.minYieldTotal || ''}
                        onChange={(e) => {
                          const current = config.current || config;
                          const search = current.search || {};
                          setConfig({...config, current: {...current, search: {...search, minYieldTotal: e.target.value}}});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 p-5 rounded-xl font-black text-lg outline-none cursor-pointer focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white transition-all appearance-none"
                      >
                         <option value="">指定なし</option>
                         {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}%以上</option>)}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">最低利回り（優待）</label>
                      <select 
                        value={(config.current || config)?.search?.minYieldYutai || ''}
                        onChange={(e) => {
                          const current = config.current || config;
                          const search = current.search || {};
                          setConfig({...config, current: {...current, search: {...search, minYieldYutai: e.target.value}}});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 p-5 rounded-xl font-black text-lg outline-none cursor-pointer focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white transition-all appearance-none"
                      >
                         <option value="">指定なし</option>
                         {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}%以上</option>)}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">最低利回り（配当）</label>
                      <select 
                        value={(config.current || config)?.search?.minYieldDividend || ''}
                        onChange={(e) => {
                          const current = config.current || config;
                          const search = current.search || {};
                          setConfig({...config, current: {...current, search: {...search, minYieldDividend: e.target.value}}});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 p-5 rounded-xl font-black text-lg outline-none cursor-pointer focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white transition-all appearance-none"
                      >
                         <option value="">指定なし</option>
                         {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}%以上</option>)}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">おすすめ度（★）</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map(s => {
                          const current = config.current || config;
                          const search = current.search || {};
                          return (
                            <button key={s} onClick={() => setConfig({...config, current: {...current, search: {...search, minRecommendation: s.toString()}}})} className={`option-btn flex-1 py-4 text-sm ${search.minRecommendation === s.toString() ? 'active' : ''}`}>★{s}以上</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">長期保有特典</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          {v:'',l:'全銘柄'}, 
                          {v:'exists',l:'長期優待あり'}, 
                          {v:'only',l:'長期優待のみ'}, 
                          {v:'none',l:'長期優待なし'}
                        ].map(o => {
                          const current = config.current || config;
                          const search = current.search || {};
                          return (
                            <button key={o.v} onClick={() => setConfig({...config, current: {...current, search: {...search, longTerm: o.v}}})} className={`option-btn flex-1 py-4 text-xs min-w-[100px] ${search.longTerm === o.v ? 'active' : ''}`}>{o.l}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">銘柄の信用区分</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          {v:'',l:'全銘柄'}, 
                          {v:'standard',l:'制度信用銘柄'}, 
                          {v:'loan',l:'貸借銘柄'}
                        ].map(o => {
                          const current = config.current || config;
                          const search = current.search || {};
                          return (
                            <button key={o.v} onClick={() => setConfig({...config, current: {...current, search: {...search, creditTrading: o.v}}})} className={`option-btn flex-1 py-4 text-xs min-w-[100px] ${search.creditTrading === o.v ? 'active' : ''}`}>{o.l}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">疑義注記（重要事象等）</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          {v:'',l:'全銘柄'}, 
                          {v:'include',l:'疑義注記を含む'}, 
                          {v:'exclude',l:'疑義注記を含まない'}
                        ].map(o => {
                          const current = config.current || config;
                          const search = current.search || {};
                          return (
                            <button key={o.v} onClick={() => setConfig({...config, current: {...current, search: {...search, includeGoingConcern: o.v}}})} className={`option-btn flex-1 py-4 text-xs min-w-[120px] ${search.includeGoingConcern === o.v ? 'active' : ''}`}>{o.l}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-8">
                  <div className="flex items-center gap-3 text-indigo-600 font-black text-lg border-b border-slate-50 pb-5">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <span>2. 権利確定月</span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const month = (i + 1).toString();
                      const current = config.current || config;
                      const search = current.search || { months: [] };
                      const selected = (search.months || []).includes(month);
                      return (
                        <button key={month} onClick={() => {
                           const next = selected ? (search.months || []).filter((m: any) => m !== month) : [...(search.months || []), month];
                           setConfig({...config, current: {...current, search: {...search, months: next}}});
                        }} className={`option-btn h-16 font-black text-base ${selected ? 'active' : ''}`}>
                          {month}月
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-8">
                  <div className="flex items-center gap-3 text-indigo-600 font-black text-lg border-b border-slate-50 pb-5">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Tag size={20} />
                    </div>
                    <span>3. カテゴリで絞り込む</span>
                  </div>
                  <div className="space-y-3">
                      {categoryGroups.map(group => {
                        const isOpen = openGroups.includes(group.name);
                        const current = config.current || config;
                        const search = current.search || { categories: [] };
                        const selCount = group.items.filter(it => (search.categories || []).includes(it.id)).length;
                        return (
                         <div key={group.name} className={`border rounded-2xl transition-all ${isOpen ? 'border-indigo-100 bg-slate-50/30' : 'border-slate-100 hover:border-indigo-200'}`}>
                           <button onClick={() => setOpenGroups(isOpen ? openGroups.filter(g => g !== group.name) : [...openGroups, group.name])} className="w-full flex justify-between items-center p-6 text-left group">
                             <div className="flex items-center gap-4">
                               <span className={`font-black text-base transition-colors ${selCount > 0 ? 'text-indigo-600' : 'text-slate-700 group-hover:text-indigo-600'}`}>{group.name}</span>
                               {selCount > 0 && <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">{selCount} 個</span>}
                             </div>
                             <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-300'}`}>
                               <ChevronDown size={20} />
                             </div>
                           </button>
                           {isOpen && (
                             <div className="p-8 pt-0 grid grid-cols-2 md:grid-cols-4 gap-2.5">
                               {group.items.map(item => {
                                 const selected = (search.categories || []).includes(item.id);
                                 return (
                                   <button 
                                     key={item.id} 
                                     onClick={() => {
                                       const next = selected ? (search.categories || []).filter((c:any) => c !== item.id) : [...(search.categories || []), item.id];
                                       setConfig({...config, current: {...current, search: {...search, categories: next}}});
                                     }}
                                     className={`option-btn text-xs py-3.5 font-bold ${selected ? 'active' : ''}`}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-5">
                      <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest">
                        <ShieldCheck size={16} /> <span>銘柄の信用区分</span>
                      </div>
                      <div className="flex gap-2">
                         {[{v: '', l:'全て'}, {v:'standard', l:'制度信用'}, {v:'loan', l:'一般信用'}].map(o => {
                           const current = config.current || config;
                           const search = current.search || {};
                           return (
                             <button key={o.v} onClick={() => setConfig({...config, current: {...current, search: {...search, creditTrading: o.v}}})} className={`option-btn flex-1 py-4 font-bold text-sm ${search.creditTrading === o.v ? 'active' : ''}`}>{o.l}</button>
                           );
                         })}
                      </div>
                   </div>
                   <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-5">
                      <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest">
                        <Activity size={16} /> <span>取得エンジンの設定</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-300 uppercase">最大銘柄数</label>
                           <input 
                             type="number" 
                             value={(config.current || config)?.scraping?.maxStocks || 100} 
                             onChange={(e) => {
                               const current = config.current || config;
                               const scraping = current.scraping || {};
                               setConfig({...config, current: {...current, scraping: {...scraping, maxStocks: parseInt(e.target.value)}}});
                             }} 
                             className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black focus:ring-4 focus:ring-indigo-100 outline-none" 
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-300 uppercase">間隔 (分)</label>
                           <input 
                             type="number" 
                             step="0.1" 
                             value={(config.current || config)?.scraping?.intervalMinutes || 1} 
                             onChange={(e) => {
                               const current = config.current || config;
                               const scraping = current.scraping || {};
                               setConfig({...config, current: {...current, scraping: {...scraping, intervalMinutes: parseFloat(e.target.value)}}});
                             }} 
                             className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl font-black focus:ring-4 focus:ring-indigo-100 outline-none" 
                           />
                        </div>
                      </div>
                   </div>
                </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  </div>
);
}
