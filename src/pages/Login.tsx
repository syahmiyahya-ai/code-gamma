import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Chrome, Shield, HeartPulse, Mail, Lock, User as UserIcon, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isSignUp && !fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Clear errors when switching modes
    setError(null);
    setFieldErrors({});
    setSuccess(null);
  }, [isSignUp]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging in with Google:', error);
      setError('Failed to initialize Google Login. Please try again later.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (error) throw error;
        if (data.user) {
          setIsSignUp(false);
          setSuccess('Account created! Please check your email for the confirmation link, then sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('The email or password you entered is incorrect. Please try again.');
          }
          throw error;
        }

        if (data.user) {
          navigate(from, { replace: true });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side: Branding & Visuals (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000" 
            alt="Hospital Hallway" 
            className="w-full h-full object-cover opacity-30"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-900/40" />
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-3xl mb-10 shadow-2xl shadow-emerald-500/40">
              <HeartPulse className="text-white w-12 h-12" />
            </div>
            <h1 className="text-7xl font-bold text-white tracking-tight leading-[0.85] mb-8">
              Empowering <br />
              <span className="text-emerald-400 italic">Caregivers.</span>
            </h1>
            <p className="text-slate-300 text-xl font-light leading-relaxed mb-12 max-w-md">
              The next generation of hospital roster management. 
              Built for speed, designed for clarity, trusted by professionals.
            </p>

            <div className="space-y-6 border-t border-white/10 pt-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="text-emerald-400 w-5 h-5" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Real-time shift synchronization across all departments</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="text-emerald-400 w-5 h-5" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Automated leave management and conflict resolution</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-12 right-12 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Shield className="text-emerald-400 w-5 h-5" />
          </div>
          <div>
            <p className="text-white text-xs font-bold uppercase tracking-wider">HIPAA Compliant</p>
            <p className="text-slate-500 text-[10px]">Secure Data Encryption</p>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-24 bg-slate-50/50">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <HeartPulse className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">WardRoster</span>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-10">
              <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
                {isSignUp ? 'Join the Network' : 'Welcome Back'}
              </h2>
              <p className="text-slate-500 font-medium">
                {isSignUp 
                  ? 'Start managing your ward shifts with precision.' 
                  : 'Enter your credentials to access your dashboard.'}
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-5">
              <AnimatePresence mode="wait">
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative group">
                      <UserIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.fullName ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`} />
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: '' }));
                        }}
                        className={`w-full bg-white border rounded-2xl pl-12 pr-4 py-4 text-sm outline-none transition-all shadow-sm ${
                          fieldErrors.fullName 
                            ? 'border-rose-300 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500' 
                            : 'border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500'
                        }`}
                        placeholder="Dr. John Doe"
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-[10px] text-rose-500 font-bold ml-1 uppercase tracking-wider">{fieldErrors.fullName}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.email ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full bg-white border rounded-2xl pl-12 pr-4 py-4 text-sm outline-none transition-all shadow-sm ${
                      fieldErrors.email 
                        ? 'border-rose-300 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500' 
                        : 'border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500'
                    }`}
                    placeholder="name@hospital.com"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[10px] text-rose-500 font-bold ml-1 uppercase tracking-wider">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                  {!isSignUp && (
                    <button type="button" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${fieldErrors.password ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                    }}
                    className={`w-full bg-white border rounded-2xl pl-12 pr-12 py-4 text-sm outline-none transition-all shadow-sm ${
                      fieldErrors.password 
                        ? 'border-rose-300 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500' 
                        : 'border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[10px] text-rose-500 font-bold ml-1 uppercase tracking-wider">{fieldErrors.password}</p>
                )}
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3"
                >
                  <Shield className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-600 font-medium leading-relaxed">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-600 font-medium leading-relaxed">{success}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50/50 px-4 text-slate-400 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 px-4 rounded-2xl border border-slate-200 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <Chrome className="w-5 h-5 text-emerald-600" />
              <span>Sign in with Google</span>
            </button>

            <div className="mt-10 text-center">
              <p className="text-slate-500 text-sm font-medium">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-bold underline underline-offset-4"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          </motion.div>

          <div className="mt-12 lg:hidden text-center">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              &copy; 2026 WardRoster • Secure Infrastructure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
