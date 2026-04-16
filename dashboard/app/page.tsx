'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Settings, LayoutDashboard, Play, Save, ExternalLink, 
  TrendingUp, Calendar, Tag, CheckCircle2, Circle, 
  ChevronDown, ChevronUp, Star, Percent, Coins, Clock, ShieldCheck, RefreshCw, BarChart3, Search,
  Download, FileSpreadsheet, Activity, CheckCircle, Trash2, Image, ImageOff
} from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [config, setConfig] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(['金券・ポイント']);
  const [configName, setConfigName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [sortKey, setSortKey] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [lastScreenshotUrl, setLastScreenshotUrl] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    const res = await fetch('/api/results', { cache: 'no-store' });
    const data = await res.json();
    setResults(data);
    
    // スクリーンショットのURLを更新（キャッシュ回避のためタイムスタンプを付与）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      setLastScreenshotUrl(`${supabaseUrl}/storage/v1/object/public/screenshots/last_search.png?t=${Date.now()}`);
    }
  }, []);

  const status = useMemo(() => {
    if (results.length === 0) return { phase: 'idle', message: '待機中', current: 0, total: 0 };
    const total = results.length;
    const current = results.filter(r => r.status === 'complete').length;
    if (total > 0 && current < total) {
      return { phase: 'fetching', message: `詳細情報をクラウドで取得中です... (${current}/${total})`, current, total };
    }
    return { phase: 'completed', message: '最新情報の取得が完了しています', current, total };
  }, [results]);

  const isRunning = status.phase === 'fetching';

  useEffect(() => {
    let timer: any;
    if (isRunning) {
      timer = setInterval(() => {
        fetchResults();
      }, 5000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, fetchResults]);

  const progress = useMemo(() => {
    if (status.total === 0) return 0;
    return Math.round((status.current / status.total) * 100);
  }, [status]);

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

  const deleteConfig = async (name: string) => {
    if (!confirm(`${name} を削除してもよろしいですか？`)) return;
    try {
      const res = await fetch(`/api/config?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        alert('削除しました');
        fetchConfig();
      }
    } catch (e) {
      alert('削除に失敗しました');
    }
  };

  const handleClearUpload = async () => {
    if (!confirm('アップロードされたリストをクリアしてもよろしいですか？\n条件指定モードに戻ります。')) return;
    try {
      const res = await fetch('/api/upload', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchConfig();
      }
    } catch (e) {
      alert('クリアに失敗しました');
    }
  };

  const categoryGroups = [
    { name: '金券・ポイント', value: '金券・ポイント1' },
    { name: '割引券・無料券', value: '割引券・無料券2' },
    { name: '優待品', value: '優待品3' },
    { name: 'カタログ', value: 'カタログ4' },
    { name: 'その他', value: 'その他5' }
  ];

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

  const handleRunScraper = async () => {
    alert("【お知らせ】\n\n株主優待の検索処理は、現在クラウド環境（GitHub Actions）で全自動で実行されるようにアップグレードされています。\nそのため、この画面からサーバーに負荷をかける手動実行はできません。\n\n最新データを直ちに取得したい場合は、GitHubレポジトリの「Actions」タブから手動で実行（Run workflow）してください。\n（実行中は、この画面を開いたままにしておくと自動で進捗が更新されます）");
    fetchResults(); // 更新用
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
                      const phases = ['idle', 'searching', 'fetching', 'completed'];
                      const currentIdx = phases.indexOf(status.phase);
                      const stepIdx = phases.indexOf(step.id);
                      const isActive = status.phase === step.id;
                      const isDone = stepIdx < currentIdx || status.phase === 'completed';
                      
                      return (
                        <div key={step.id} className="flex flex-col items-center gap-3 relative flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 scale-110 shadow-lg' : isDone ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                            <step.icon size={20} />
                          </div>
                          <span className={`text-[11px] font-bold tracking-tighter ${isActive ? 'text-indigo-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>{step.label}</span>
                          {idx < 3 && (
                            <div className={`absolute h-[3px] w-full top-5 left-1/2 -z-0 transition-colors duration-500 ${isDone ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
                          )}
                        </div>
                      )
                    })}
                 </div>
                 
                 <div className="mt-8 pt-8 border-t border-slate-50">
                    <div className="flex flex-col gap-4">
                       <div className="flex justify-between items-end">
                          <div className="space-y-1">
                             <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</div>
                             <div className="text-lg font-black text-slate-800 leading-none animate-in fade-in slide-in-from-left-2">{status.message}</div>
                          </div>
                          {(status.phase === 'fetching' || status.phase === 'completed') && results.length > 0 && (
                            <div className="text-right">
                               <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Items Processed</div>
                               <div className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                 {results.filter(r => r.status === 'complete').length} / {results.length}
                               </div>
                            </div>
                          )}
                       </div>
                       
                       <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 text-[8px] font-bold text-white shadow-lg ${status.phase === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600 animate-pulse'}`}
                            style={{ width: `${(status.phase === 'completed' ? 100 : (status.total > 0 ? (status.current / status.total) * 100 : (status.phase === 'searching' ? 25 : 0)))}%` }}
                          >
                             {status.total > 0 && Math.round((status.current / status.total) * 100) > 10 && `${Math.round((status.current / status.total) * 100)}%`}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* 最新の検索証拠セクション */}
              <div className="main-panel p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                         <Image size={20} />
                      </div>
                      <div>
                         <h3 className="text-lg font-black text-slate-800 tracking-tight">最新の検索証拠</h3>
                         <p className="text-xs text-slate-500 font-bold">実際に公式サイトを操作した際の全画面キャプチャです</p>
                      </div>
                   </div>
                   {lastScreenshotUrl && (
                      <a href={lastScreenshotUrl} target="_blank" className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-2 rounded-lg transition-all active:scale-95">
                         <ExternalLink size={14} /> 全画面で開く
                      </a>
                   )}
                </div>
                
                <div className="relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50 h-64 group cursor-zoom-in">
                   {lastScreenshotUrl ? (
                      <>
                        <img 
                          src={lastScreenshotUrl} 
                          alt="Search Evidence" 
                          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                           <p className="text-white text-xs font-bold">クリックして拡大</p>
                        </div>
                      </>
                   ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                         <ImageOff size={48} strokeWidth={1} />
                         <p className="text-sm font-bold">画像がまだありません。検索を開始してください。</p>
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
                    <div className="mt-4 flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-full font-black text-sm">
                        <CheckCircle size={18} />
                        現在はファイル読み込みモードで動作します
                      </div>
                      <button 
                        onClick={handleClearUpload}
                        className="text-rose-500 hover:text-rose-700 text-xs font-black flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={14} /> アップロードしたリストをクリア
                      </button>
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
                           <div key={idx} className="shrink-0 flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden transition-all hover:border-indigo-300">
                             <button 
                               onClick={() => loadHistoryConfig(h)}
                               className={`px-4 py-2.5 text-xs font-bold transition-all ${config.current?.id === h.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-indigo-600'}`}
                             >
                               {h.name}
                             </button>
                             <button 
                               onClick={() => deleteConfig(h.name)}
                               className="px-2 py-2.5 text-slate-300 hover:text-rose-500 transition-colors border-l border-slate-100"
                             >
                               <Trash2 size={12} />
                             </button>
                           </div>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">最大投資額</label>
                      <div className="relative">
                        <select 
                          value={(config.current || config)?.search?.maxAmount || ''} 
                          onChange={(e) => {
                            const current = config.current || config;
                            const search = current.search || {};
                            setConfig({...config, current: {...current, search: {...search, maxAmount: e.target.value}}});
                          }} 
                          className="w-full bg-slate-50 border border-slate-200 p-5 rounded-xl font-black text-lg outline-none cursor-pointer focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 focus:bg-white transition-all appearance-none"
                        >
                          <option value="">上限なし</option>
                          {Array.from({length: 10}).map((_, i) => (
                            <option key={i} value={(i + 1) * 1000000}>{(i + 1) * 100}万円</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-6 top-6 text-slate-300 pointer-events-none" size={20} />
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

                    <div className="space-y-4 col-span-1 md:col-span-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">おすすめ度（★）</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          {v:'',l:'指定なし'},
                          ...[1, 2, 3, 4, 5].map(v => ({v:v.toString(), l:`★${v}以上`}))
                        ].map(o => {
                          const current = config.current || config;
                          const search = current.search || {};
                          return (
                            <button key={o.v} onClick={() => setConfig({...config, current: {...current, search: {...search, minRecommendation: o.v}}})} className={`option-btn flex-1 py-4 text-xs ${search.minRecommendation === o.v ? 'active' : ''}`}>{o.l}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="main-panel p-10 rounded-2xl shadow-sm bg-white border border-slate-100 space-y-8">
                  <div className="flex items-center gap-3 text-indigo-600 font-black text-lg border-b border-slate-50 pb-5">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                      <Tag size={20} />
                    </div>
                    <span>3. カテゴリで絞り込む</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {categoryGroups.map(group => {
                      const current = config.current || config;
                      const search = current.search || { categories: [] };
                      const selected = (search.categories || []).includes(group.value);
                      return (
                        <button 
                          key={group.value} 
                          onClick={() => {
                             const next = selected ? (search.categories || []).filter((v: any) => v !== group.value) : [...(search.categories || []), group.value];
                             setConfig({...config, current: {...current, search: {...search, categories: next}}});
                          }} 
                          className={`option-btn h-20 flex flex-col items-center justify-center gap-1 font-black text-sm px-2 text-center leading-tight ${selected ? 'active' : ''}`}
                        >
                          {group.name}
                        </button>
                      );
                    })}
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
               </>
             )}
            </div>
           )}
        </main>
      </div>
    </div>
  );
}
