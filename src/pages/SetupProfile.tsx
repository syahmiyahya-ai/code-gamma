import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Upload, User as UserIcon, CheckCircle2, Loader2, Camera, Sparkles, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PLACEHOLDER_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jocelyn',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=George'
];

export const SetupProfile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [role, setRole] = useState<string>(
    user?.email === 'syahmiyahya@gmail.com' || user?.email === 'syahmi@ikn.gov.my' 
      ? 'Administrator' 
      : 'Doctor'
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ROLES = ['Doctor', 'Manager', 'Administrator'];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      if (!user) return;

      setUploading(true);
      setError(null);

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setSelectedAvatar(publicUrl);
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!selectedAvatar || !user) return;

    setSaving(true);
    setError(null);

    try {
      // First check if user exists in the users table
      const res = await fetch(`/api/users/${user.id}`);
      
      if (res.ok) {
        // Update existing user
        const updateRes = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({ 
            avatar_url: selectedAvatar,
            role: role 
          })
        });
        if (!updateRes.ok) {
          const errorData = await updateRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update profile');
        }
      } else {
        // Create new user record
        const createRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
            role: role,
            email: user.email,
            avatar_url: selectedAvatar
          })
        });
        if (!createRes.ok) {
          const errorData = await createRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create profile');
        }
      }

      await refreshProfile();
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to complete setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4 shadow-lg shadow-emerald-500/30">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Welcome!</h1>
          <p className="text-slate-500 font-medium">Let's set up your profile picture to get started.</p>
        </div>

        <div className="space-y-8">
          {/* Preview Area */}
          <div className="flex justify-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                {selectedAvatar ? (
                  <img src={selectedAvatar} alt="Avatar Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-16 h-16 text-slate-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-10 h-10 bg-emerald-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-emerald-600 transition-colors">
                <Camera className="text-white w-5 h-5" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-6">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Select Your Role</label>
              <div className="grid grid-cols-3 gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`py-3 rounded-2xl text-xs font-bold transition-all border-2 ${role === r ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-200 bg-white'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Choose a 3D Avatar</label>
              <div className="grid grid-cols-4 gap-4">
                {PLACEHOLDER_AVATARS.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all p-1 ${selectedAvatar === url ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <img src={url} alt={`Avatar ${index + 1}`} className="w-full h-full rounded-xl" referrerPolicy="no-referrer" />
                    {selectedAvatar === url && (
                      <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                        <CheckCircle2 className="text-white w-3 h-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                <span className="bg-white px-4 tracking-widest">Or upload your own</span>
              </div>
            </div>

            <label className="w-full flex items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl border-2 border-dashed border-slate-200 cursor-pointer transition-all active:scale-[0.98]">
              <Upload className="w-5 h-5" />
              <span>Upload Photo</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-medium text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleCompleteSetup}
            disabled={!selectedAvatar || saving || uploading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <span>Complete Setup</span>
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-4 rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
