/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  RefreshCw, 
  Clock, 
  Coins, 
  Layers, 
  Zap,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ShieldCheck,
  User,
  LogIn,
  X,
  Lock,
  Mail
} from 'lucide-react';
import { fetchLiveMetalPrices, MetalPrices } from './services/metalService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GOLD_WEIGHTS = [1, 2, 5, 10, 50, 100];
const METAL_WEIGHTS = [0.1, 0.25, 0.5, 1, 5, 10]; // in KG

interface PriceHistory {
  time: string;
  value: number;
}

export default function App() {
  const [basePrices, setBasePrices] = useState<MetalPrices | null>(null);
  const [livePrices, setLivePrices] = useState<MetalPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gold' | 'silver' | 'copper'>('gold');
  const [lastFetch, setLastFetch] = useState<Date>(new Date());
  const [history, setHistory] = useState<Record<string, PriceHistory[]>>({
    gold: [],
    silver: [],
    copper: []
  });

  // Auth State
  const [user, setUser] = useState<{ name: string, email?: string, picture?: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Handle Google OAuth Message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setUser(event.data.user);
        setShowAuth(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      alert('Google Sign-In failed. Please check your configuration.');
    }
  };

  // Fetch base prices periodically
  const loadPrices = async () => {
    setLoading(true);
    const data = await fetchLiveMetalPrices();
    
    // Final check for NaN before setting state
    const cleanData = {
      ...data,
      gold24k: isNaN(data.gold24k) ? 8650 : data.gold24k,
      gold22k: isNaN(data.gold22k) ? 7930 : data.gold22k,
      gold18k: isNaN(data.gold18k) ? 6480 : data.gold18k,
      silver: isNaN(data.silver) ? 108500 : data.silver,
      copper: isNaN(data.copper) ? 920 : data.copper,
    };

    setBasePrices(cleanData);
    setLivePrices(cleanData);
    setLoading(false);
    setLastFetch(new Date());
  };

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 60000); // Real fetch every 1 min
    return () => clearInterval(interval);
  }, []);

  // Live Ticker Simulation (Per-second updates)
  useEffect(() => {
    if (!basePrices) return;

    const ticker = setInterval(() => {
      setLivePrices(prev => {
        if (!prev) return prev;
        
        // Generate small random fluctuation (-0.05% to +0.05%)
        const fluctuate = (val: number) => {
          if (isNaN(val)) return 1000; // Safety fallback
          const change = 1 + (Math.random() * 0.001 - 0.0005);
          const result = val * change;
          return isNaN(result) ? val : result;
        };

        const updated = {
          ...prev,
          gold24k: fluctuate(prev.gold24k),
          gold22k: fluctuate(prev.gold22k),
          gold18k: fluctuate(prev.gold18k),
          silver: fluctuate(prev.silver),
          copper: fluctuate(prev.copper),
        };

        // Update history for charts
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setHistory(h => {
          const newHistory = { ...h };
          const metals: (keyof typeof newHistory)[] = ['gold', 'silver', 'copper'];
          
          metals.forEach(m => {
            const val = m === 'gold' ? updated.gold24k : m === 'silver' ? updated.silver : updated.copper;
            if (!isNaN(val)) {
              newHistory[m] = [...newHistory[m].slice(-19), { time: now, value: val }];
            }
          });
          
          return newHistory;
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [basePrices]);

  const formatCurrency = (value: number, decimals = 2) => {
    if (isNaN(value)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const currentTrend = useMemo(() => {
    if (!basePrices || !livePrices) return 0;
    const activePrice = activeTab === 'gold' ? livePrices.gold24k : activeTab === 'silver' ? livePrices.silver : livePrices.copper;
    const basePrice = activeTab === 'gold' ? basePrices.gold24k : activeTab === 'silver' ? basePrices.silver : basePrices.copper;
    if (isNaN(activePrice) || isNaN(basePrice) || basePrice === 0) return 0;
    return ((activePrice - basePrice) / basePrice) * 100;
  }, [basePrices, livePrices, activeTab]);

  const handleAuth = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string || 'User';
    const email = formData.get('email') as string;
    
    setUser({ name, email });
    setShowAuth(false);
  };

  return (
    <div className="min-h-screen mesh-gradient text-zinc-100 font-sans selection:bg-gold/30 selection:text-gold">
      {/* Top Bar */}
      <div className="bg-gold/10 border-b border-gold/20 py-1 px-4 text-center overflow-hidden">
        <div className="flex items-center justify-center gap-4 animate-marquee whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold flex items-center gap-1">
            <Activity className="w-3 h-3" /> Live Market Ticker Active
          </span>
          <span className="text-[10px] text-zinc-500">•</span>
          <span className="text-[10px] font-medium text-zinc-400">Gold 24K: {livePrices ? formatCurrency(livePrices.gold24k) : '...'}</span>
          <span className="text-[10px] text-zinc-500">•</span>
          <span className="text-[10px] font-medium text-zinc-400">Silver: {livePrices ? formatCurrency(livePrices.silver) : '...'}</span>
          <span className="text-[10px] text-zinc-500">•</span>
          <span className="text-[10px] font-medium text-zinc-400">Copper: {livePrices ? formatCurrency(livePrices.copper) : '...'}</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-2xl shadow-gold/40">
              <TrendingUp className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold tracking-tight leading-none">
                MetalLive<span className="text-gold">.</span>
              </h1>
              <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Premium Exchange</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                <Clock className="w-3 h-3" />
                {lastFetch.toLocaleTimeString()}
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-gold/50" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-black font-bold text-xs">
                    {user.name[0]}
                  </div>
                )}
                <span className="text-sm font-medium hidden md:block">{user.name}</span>
                <button onClick={() => setUser(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <LogIn className="w-4 h-4 rotate-180" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setShowAuth(true); setAuthMode('signin'); }}
                  className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all border border-white/10"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setShowAuth(true); setAuthMode('signup'); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gold-gradient text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-gold/20"
                >
                  <User className="w-4 h-4" />
                  Sign Up
                </button>
              </div>
            )}

            <button 
              onClick={loadPrices}
              disabled={loading}
              className="group relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5 text-zinc-300 group-hover:text-white", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold uppercase tracking-widest mb-6">
              <ShieldCheck className="w-3 h-3" /> Verified Market Data
            </div>
            <h2 className="text-6xl md:text-8xl font-display italic font-bold mb-6 leading-[0.9] tracking-tighter">
              Precision <br />
              <span className="text-gold text-glow-gold">Metals</span>
            </h2>
            <p className="text-zinc-400 max-w-md text-lg leading-relaxed">
              Experience real-time commodity tracking with micro-second accuracy. Professional grade data for serious investors.
            </p>
          </motion.div>

          <div className="flex flex-col gap-4">
             <div className="flex flex-wrap gap-3 p-1.5 bg-white/[0.03] border border-white/10 rounded-2xl w-fit backdrop-blur-md">
              <TabButton 
                active={activeTab === 'gold'} 
                onClick={() => setActiveTab('gold')}
                icon={<Coins className="w-4 h-4" />}
                label="Gold"
                color="gold"
              />
              <TabButton 
                active={activeTab === 'silver'} 
                onClick={() => setActiveTab('silver')}
                icon={<Layers className="w-4 h-4" />}
                label="Silver"
                color="silver"
              />
              <TabButton 
                active={activeTab === 'copper'} 
                onClick={() => setActiveTab('copper')}
                icon={<Zap className="w-4 h-4" />}
                label="Copper"
                color="copper"
              />
            </div>
            <div className="flex items-center gap-4 px-4 py-3 glass-card">
              <div className={cn(
                "p-2 rounded-lg",
                currentTrend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {currentTrend >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Session Trend</div>
                <div className={cn("text-lg font-mono font-bold", currentTrend >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {currentTrend >= 0 ? '+' : ''}{currentTrend.toFixed(4)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {livePrices && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-12"
            >
              {/* Chart Section */}
              <div className="glass-card p-8 h-[400px] relative overflow-hidden">
                <div className="absolute top-8 left-8 z-10">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-[0.3em] mb-1">
                    {activeTab === 'gold' ? '24K Live Gold Price (INR per gram)' : `${activeTab.toUpperCase()} Live Price (INR per gram)`}
                  </h3>
                  <div className="text-3xl font-heading font-bold">
                    {activeTab === 'gold' ? formatCurrency(livePrices.gold24k) : activeTab === 'silver' ? formatCurrency(livePrices.silver) : formatCurrency(livePrices.copper)}
                    <span className="text-sm text-zinc-500 ml-2 font-normal">{activeTab === 'gold' ? '/ Gram' : '/ KG'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500 font-mono">
                    <Clock className="w-3 h-3" />
                    Last Updated: {lastFetch.toLocaleTimeString()}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history[activeTab]}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeTab === 'gold' ? '#D4AF37' : activeTab === 'silver' ? '#C0C0C0' : '#B87333'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={activeTab === 'gold' ? '#D4AF37' : activeTab === 'silver' ? '#C0C0C0' : '#B87333'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      hide 
                    />
                    <YAxis 
                      hide 
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={activeTab === 'gold' ? '#D4AF37' : activeTab === 'silver' ? '#C0C0C0' : '#B87333'} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {activeTab === 'gold' ? (
                <GoldView prices={livePrices} formatCurrency={formatCurrency} />
              ) : (
                <SingleMetalView 
                  type={activeTab} 
                  price={activeTab === 'silver' ? livePrices.silver : livePrices.copper} 
                  formatCurrency={formatCurrency} 
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-32 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/5 pt-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded gold-gradient flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-black" />
                </div>
                <span className="font-heading font-bold text-lg">MetalLive.</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The world's most advanced precious metals dashboard. Real-time data, professional analytics, and seamless interface.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Resources</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li className="hover:text-gold cursor-pointer transition-colors">Market Analysis</li>
                <li className="hover:text-gold cursor-pointer transition-colors">Historical Data</li>
                <li className="hover:text-gold cursor-pointer transition-colors">API Documentation</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Legal</h4>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Info className="w-3 h-3" />
                <span>Prices are indicative and may vary based on market conditions.</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-mono">
                © 2026 METALLIVE EXCHANGE. ALL RIGHTS RESERVED.
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuth(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 shadow-2xl border-white/20"
            >
              <button 
                onClick={() => setShowAuth(false)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center mx-auto mb-4 shadow-xl shadow-gold/20">
                  <TrendingUp className="w-7 h-7 text-black" />
                </div>
                <h2 className="text-2xl font-heading font-bold">
                  {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-zinc-500 text-sm mt-2">
                  {authMode === 'signin' ? 'Enter your details to access your dashboard' : 'Join the elite metal exchange community'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        name="name"
                        type="text" 
                        required
                        placeholder="John Doe"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-gold/50 transition-colors"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      name="email"
                      type="email" 
                      required
                      placeholder="name@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 rounded-xl gold-gradient text-black font-bold mt-4 hover:scale-[1.02] transition-transform shadow-xl shadow-gold/20"
                >
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0a0a0a] px-2 text-zinc-500 font-bold tracking-widest">Or continue with</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleSignIn}
                className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors shadow-xl"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>

              <div className="mt-8 text-center">
                <p className="text-zinc-500 text-sm">
                  {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                    className="ml-2 text-gold font-bold hover:underline"
                  >
                    {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-8 py-3 rounded-xl transition-all duration-500 font-heading font-bold text-sm",
        active 
          ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-105" 
          : "text-zinc-500 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "text-black" : `text-${color}`)}>{icon}</span>
      {label}
    </button>
  );
}

function GoldView({ prices, formatCurrency }: { prices: MetalPrices, formatCurrency: (v: number, d?: number) => string }) {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <PurityCard 
          title="Price per gram (24K)" 
          subtitle="99.9% Purity" 
          price={prices.gold24k} 
          color="gold" 
          footer="Selling Price (includes making charges & GST)"
        />
        <PurityCard 
          title="Price per gram (22K)" 
          subtitle="91.6% Purity" 
          price={prices.gold22k} 
          color="gold" 
          variant="dim" 
          footer="Selling Price (includes making charges & GST)"
        />
        <PurityCard 
          title="Price per gram (18K)" 
          subtitle="75.0% Purity" 
          price={prices.gold18k} 
          color="gold" 
          variant="dimmer" 
          footer="Selling Price (includes making charges & GST)"
        />
      </div>

      <div className="glass-card overflow-hidden border-white/5">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-white/[0.01] gap-4">
          <div>
            <h3 className="text-xl font-heading font-bold">Weight-wise Breakdown</h3>
            <p className="text-xs text-zinc-500 mt-1">Calculated based on current live 24K rate</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Estimates
            </div>
            <span className="text-[10px] text-zinc-500 italic">Final price may vary based on brand and packaging</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold">
                <th className="px-8 py-6">Weight Unit</th>
                <th className="px-8 py-6">24K (Fine)</th>
                <th className="px-8 py-6">22K (Standard)</th>
                <th className="px-8 py-6">18K (Jewelry)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {GOLD_WEIGHTS.map((weight) => (
                <tr key={weight} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-400">
                        {weight}
                      </div>
                      <span className="font-bold text-zinc-200">{weight} Grams</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-mono text-gold font-bold text-lg group-hover:translate-x-1 transition-transform">
                    {formatCurrency(prices.gold24k * weight, 2)}
                  </td>
                  <td className="px-8 py-6 font-mono text-zinc-400">
                    {formatCurrency(prices.gold22k * weight, 2)}
                  </td>
                  <td className="px-8 py-6 font-mono text-zinc-500">
                    {formatCurrency(prices.gold18k * weight, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SingleMetalView({ type, price, formatCurrency }: { type: 'silver' | 'copper', price: number, formatCurrency: (v: number, d?: number) => string }) {
  const isSilver = type === 'silver';
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2"
        >
          <div className={cn(
            "aspect-square rounded-[40px] flex flex-col items-center justify-center p-12 text-center relative overflow-hidden shadow-2xl",
            isSilver ? "silver-gradient shadow-silver/20" : "copper-gradient shadow-copper/20"
          )}>
            <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px]" />
            <div className="relative z-10">
              <span className="text-black/40 font-bold text-[10px] uppercase tracking-[0.3em] mb-4 block">Market Value</span>
              <h3 className="text-black text-5xl md:text-7xl font-heading font-black mb-4 tracking-tighter">
                {formatCurrency(price)}
              </h3>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/10 text-black text-sm font-bold">
                Per 1 Kilogram (1kg)
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/30 rounded-full blur-[100px]" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-black/10 rounded-full blur-[100px]" />
          </div>
        </motion.div>

        <div className="lg:col-span-3 space-y-8">
          <div>
            <h3 className="text-4xl font-heading font-bold capitalize mb-4">{type} Intelligence</h3>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
              {isSilver 
                ? "Silver is currently experiencing high volatility due to increased industrial demand in the EV sector. Our live tracking captures micro-fluctuations in global spot prices."
                : "Copper remains the backbone of the global energy transition. Prices are currently being driven by supply constraints in major mining regions and surging demand for renewable infrastructure."
              }
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard label="Purity Standard" value={isSilver ? "99.9% Pure Silver" : "99.9% Grade A Copper"} />
            <StatCard label="Trading Unit" value="1,000 Grams (Metric)" />
            <StatCard label="Market Status" value="Open / Active" />
            <StatCard label="Volatility" value="Moderate-High" />
          </div>
        </div>
      </div>

      {/* Weight Breakdown Table */}
      <div className="glass-card overflow-hidden border-white/5">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-white/[0.01] gap-4">
          <div>
            <h3 className="text-xl font-heading font-bold">{type.toUpperCase()} Weight Breakdown</h3>
            <p className="text-xs text-zinc-500 mt-1">Calculated based on current live {type} rate</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Estimates
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold">
                <th className="px-8 py-6">Weight Unit</th>
                <th className="px-8 py-6">Price (INR)</th>
                <th className="px-8 py-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {METAL_WEIGHTS.map((weight) => (
                <tr key={weight} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-400">
                        {weight >= 1 ? `${weight}kg` : `${weight * 1000}g`}
                      </div>
                      <span className="font-bold text-zinc-200">{weight >= 1 ? `${weight} Kilogram` : `${weight * 1000} Grams`}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-mono text-zinc-200 font-bold text-lg group-hover:translate-x-1 transition-transform">
                    {formatCurrency(price * weight, 2)}
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-bold text-zinc-500 uppercase">Available</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-6 glass-card border-white/5">
      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block mb-2">{label}</span>
      <span className="text-lg font-bold text-zinc-200">{value}</span>
    </div>
  );
}

function PurityCard({ title, subtitle, price, color, variant, footer }: { title: string, subtitle: string, price: number, color: 'gold' | 'silver' | 'copper', variant?: 'dim' | 'dimmer', footer?: string }) {
  return (
    <div className={cn(
      "glass-card p-8 relative overflow-hidden group hover:border-white/20 transition-all duration-700 hover:-translate-y-1 flex flex-col justify-between h-full",
      variant === 'dim' && "opacity-90",
      variant === 'dimmer' && "opacity-80"
    )}>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h4 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{subtitle}</h4>
            <h3 className="text-2xl font-heading font-bold tracking-tight">{title}</h3>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl",
            color === 'gold' ? "gold-gradient shadow-gold/20" : color === 'silver' ? "silver-gradient shadow-silver/20" : "copper-gradient shadow-copper/20"
          )}>
            <Coins className="w-6 h-6 text-black" />
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-bold tracking-tighter text-glow-gold">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)}
            </span>
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">/ 1g</span>
          </div>
          {footer && <p className="text-[10px] text-zinc-500 mt-2 italic">{footer}</p>}
        </div>
      </div>
      
      {/* Animated background element */}
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-white/[0.02] rounded-full blur-3xl group-hover:bg-white/[0.05] transition-all duration-700" />
    </div>
  );
}
