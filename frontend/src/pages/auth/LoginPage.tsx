import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, LockKeyhole, Eye, EyeOff, Plane, ShieldCheck, CircleAlert } from 'lucide-react';
import api from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import AppLoader from '@/components/shared/AppLoader';
import LoginScene from './LoginScene';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  passwordRaw: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

/** Flat cloud built from overlapping circles - colour comes from CSS `fill`. */
function Cloud({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 52" aria-hidden="true">
      <circle cx="32" cy="32" r="18" />
      <circle cx="60" cy="22" r="22" />
      <circle cx="88" cy="32" r="16" />
      <rect x="12" y="32" width="96" height="20" rx="10" />
    </svg>
  );
}

/** Flat chat bubble with three "typing" dots; `flip` puts the tail on the right. */
function Bubble({ className, fill, flip }: { className?: string; fill: string; flip?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 52 44" aria-hidden="true" style={flip ? { scale: '-1 1' } : undefined}>
      <rect x="4" y="4" width="44" height="30" rx="10" fill="#08458A" />
      <rect width="44" height="30" rx="10" fill={fill} />
      <path d="M8 28 L6 42 L20 30 Z" fill={fill} />
      <circle cx="12" cy="15" r="3" fill="#0B5CB5" />
      <circle cx="22" cy="15" r="3" fill="#0B5CB5" />
      <circle cx="32" cy="15" r="3" fill="#0B5CB5" />
    </svg>
  );
}

/** Small chapel with a bell tower - bottom-left corner decoration. */
function Chapel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 110" aria-hidden="true">
      <rect x="20" y="52" width="80" height="58" />
      <polygon points="12,54 60,24 108,54" />
      <rect x="100" y="30" width="30" height="80" />
      <polygon points="96,32 115,10 134,32" />
      <rect x="113" y="0" width="4" height="12" />
      <rect x="109" y="3" width="12" height="3.5" />
      <path d="M50 110 V90 a10 10 0 0 1 20 0 V110 Z" className="lp-cut" />
      <rect x="109" y="48" width="12" height="18" rx="6" className="lp-cut" />
      <rect x="32" y="66" width="10" height="16" rx="5" className="lp-cut" />
      <rect x="78" y="66" width="10" height="16" rx="5" className="lp-cut" />
    </svg>
  );
}

/** Twin-spired cathedral - bottom-right corner decoration. */
function Cathedral({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" aria-hidden="true">
      <rect x="20" y="30" width="36" height="110" />
      <polygon points="16,32 38,0 60,32" />
      <rect x="144" y="30" width="36" height="110" />
      <polygon points="140,32 162,0 184,32" />
      <rect x="56" y="64" width="88" height="76" />
      <polygon points="50,66 100,30 150,66" />
      <rect x="98" y="12" width="4" height="20" />
      <rect x="92" y="18" width="16" height="4" />
      <circle cx="100" cy="64" r="10" className="lp-cut" />
      <path d="M88 140 V114 a12 12 0 0 1 24 0 V140 Z" className="lp-cut" />
      <rect x="32" y="56" width="12" height="22" rx="6" className="lp-cut" />
      <rect x="156" y="56" width="12" height="22" rx="6" className="lp-cut" />
      <rect x="32" y="92" width="12" height="22" rx="6" className="lp-cut" />
      <rect x="156" y="92" width="12" height="22" rx="6" className="lp-cut" />
    </svg>
  );
}

function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const setAuth = useAuthStore((s) => s.setAuth);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    try {
      const res = await api.post('/auth/login', { email: data.email, passwordRaw: data.passwordRaw });
      const result = res.data.data;
      setAuth(result.token, result.user);
      const firstName = result.user.name?.split(' ')[0] || result.user.name;
      addNotification({
        type: 'success',
        title: 'Signed in',
        message: firstName ? `Welcome back, ${firstName}.` : 'Welcome back to your workspace.',
      });
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      setServerError(msg || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="lp-page">
      <div className="lp-wrap">
        <div className="lp-card fade-up">
          {/* Illustration panel */}
          <section className="lp-hero">
            <Cloud className="lp-cloud lp-cloud-1" />
            <Cloud className="lp-cloud lp-cloud-2" />
            <Cloud className="lp-cloud lp-cloud-3" />
            <Bubble className="lp-bubble lp-bubble-1" fill="#FFC83D" />
            <Bubble className="lp-bubble lp-bubble-2" fill="#5EEAD4" flip />
            <Bubble className="lp-bubble lp-bubble-3" fill="#fff" />
            <div className="lp-brand">
              <h2 className="lp-brand-name">SMS Campaign<br />Platform</h2>
              <p>Reach every member and every group with a single message.</p>
            </div>
            <LoginScene />
          </section>

          {/* Sign-in panel */}
          <section className="lp-panel">
            <div className="lp-flight" aria-hidden="true">
              <svg viewBox="0 0 220 70" fill="none">
                <path d="M6 50 C60 4 150 0 214 64" />
              </svg>
              <Plane size={30} />
            </div>

            <div className="lp-form-wrap">
              <h1 className="lp-title">Welcome</h1>
              <p className="lp-sub">Sign in with your email</p>

              {serverError && (
                <div className="alert-error" role="alert" style={{ marginBottom: 18 }}>
                  <CircleAlert size={16} />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="col" style={{ gap: 18 }} noValidate>
                <div>
                  <fieldset className={`lp-field${errors.email ? ' has-error' : ''}`}>
                    <legend><label htmlFor="login-email">Email</label></legend>
                    <Mail size={18} aria-hidden="true" />
                    <input
                      {...register('email')}
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      autoFocus
                      placeholder="you@example.com"
                      aria-invalid={errors.email ? true : undefined}
                    />
                  </fieldset>
                  {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>

                <div>
                  <fieldset className={`lp-field${errors.passwordRaw ? ' has-error' : ''}`}>
                    <legend><label htmlFor="login-password">Password</label></legend>
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      {...register('passwordRaw')}
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      aria-invalid={errors.passwordRaw ? true : undefined}
                    />
                    <button
                      type="button"
                      className="lp-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </fieldset>
                  {errors.passwordRaw && <span className="field-error">{errors.passwordRaw.message}</span>}
                </div>

                <p className="lp-hint">Forgot password? Ask your administrator.</p>

                <button className="lp-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting ? <><AppLoader size={16} color="#fff" /> Signing in…</> : 'Login'}
                </button>
              </form>

              <p className="lp-foot">
                <ShieldCheck size={14} aria-hidden="true" />
                Authorized personnel only · All activity is audited
              </p>
            </div>

            <Chapel className="lp-church lp-church-left" />
            <Cathedral className="lp-church lp-church-right" />
          </section>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
