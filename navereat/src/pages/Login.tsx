import { useLayoutEffect, useRef, useState } from 'react';
import heroArt from '../assets/login-hero.webp';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import loginBundleCss from '../styles/original/login.bundle.css?raw';
import loginShellCss from '../styles/original/login-shell.css?raw';
import '../styles/pages/login.css';

const OTP_LENGTH = 6;
const loginStyle = createRouteStyleSheet(`${loginShellCss}\n${loginBundleCss}`, 'navereatLogin');

export function Login() {
  const login = useAppStore((s) => s.login);
  const nav = useAppNav();
  const [step, setStep] = useState<'choice' | 'phone' | 'otp'>('choice');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useLayoutEffect(() => {
    const detach = loginStyle.attach();
    document.body.classList.add('login-redesign');
    return () => {
      detach();
      document.body.classList.remove('login-redesign');
    };
  }, []);

  const digits = phone.replace(/\D/g, '').slice(0, 10);
  const phoneValid = digits.length >= 6;
  const otpValue = otp.join('');

  const requestOtp = () => {
    if (!phoneValid) {
      toast('Enter a valid mobile number', 'error');
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStep('otp');
      toast(`Demo OTP sent to +91 ${digits}`, 'success');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 60);
    }, 450);
  };

  const verify = () => {
    if (!/^\d{4,6}$/.test(otpValue)) {
      toast('Enter any 4–6 digit OTP', 'error');
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      login(digits);
      toast('Welcome to Navereat', 'success');
      nav.reset('/');
    }, 500);
  };

  const skip = () => {
    login('9876543210');
    toast('Browsing as a demo guest', 'success');
    nav.reset('/');
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (key === 'Enter') verify();
  };

  const handlePaste = (text: string) => {
    const pasted = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((digit, index) => {
      next[index] = digit;
    });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className="page login-page">
      <section className="hero-section login-hero">
        <button className="hero-btn-skip tap" type="button" onClick={skip}>
          Skip
        </button>
        <div className="login-hero-art-wrap">
          <img className="login-hero-art" src={heroArt} alt="Navereat food delivery" decoding="async" />
        </div>
        <div className="login-hero-copy">
          <h1 className="login-hero-title">
            Your cravings,
            <span>our neighbourhood.</span>
          </h1>
          <p className="login-hero-subtitle">Good food, delivered around Demo City.</p>
        </div>
      </section>

      <div className="bottom-sheet">
        {step === 'choice' ? (
          <div id="step1" className="step-container active">
            <div id="authChoiceView" className="auth-choice-view">
              <button id="googleSignInBtn" className="social-btn tap" type="button" onClick={() => setStep('phone')}>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
              <button id="showPasswordLoginBtn" className="password-mode-btn tap" type="button" onClick={() => setStep('phone')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Login with password
              </button>
            </div>
            <div className="legal-text">
              By continuing, you agree to our Terms of Service and Privacy Policy.<br />
              <a href="#" onClick={(event) => { event.preventDefault(); toast('Terms are part of the demo'); }}>Terms of Service</a>
              <span className="legal-sep" aria-hidden="true">·</span>
              <a href="#" onClick={(event) => { event.preventDefault(); toast('Privacy policy is part of the demo'); }}>Privacy Policy</a>
            </div>
          </div>
        ) : step === 'phone' ? (
          <div id="step1" className="step-container active">
            <label className="auth-label" htmlFor="loginPhone">
              Mobile number
            </label>
            <div className="phone-box">
              <span className="phone-prefix">+91</span>
              <span className="phone-divider" aria-hidden="true" />
              <input
                id="loginPhone"
                className="phone-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') requestOtp();
                }}
              />
            </div>
            <button className="btn-primary tap" type="button" disabled={busy || !phoneValid} onClick={requestOtp}>
              {busy ? 'Sending OTP…' : 'Continue'}
            </button>
            <div className="legal-text">
              By continuing, you agree to our{' '}
              <a href="#" onClick={(event) => { event.preventDefault(); toast('Terms are part of the demo'); }}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" onClick={(event) => { event.preventDefault(); toast('Privacy policy is part of the demo'); }}>
                Privacy Policy
              </a>
              .
            </div>
          </div>
        ) : (
          <div id="step3" className="step-container active">
            <button className="btn-back-otp tap" type="button" onClick={() => setStep('phone')}>
              Back
            </button>
            <div className="sheet-header">
              <div className="brand-mark">N</div>
              <h2 className="otp-title">Enter OTP</h2>
              <p className="otp-sub">Sent to +91 {digits}</p>
            </div>
            <div className="otp-grid" onPaste={(event) => { event.preventDefault(); handlePaste(event.clipboardData.getData('text')); }}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { otpRefs.current[index] = element; }}
                  className="otp-box"
                  inputMode="numeric"
                  maxLength={1}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`OTP digit ${index + 1}`}
                  value={digit}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event.key)}
                />
              ))}
            </div>
            <button className="verify-otp-btn tap" type="button" disabled={busy || otpValue.length < 4} onClick={verify}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <div className="resend-row">
              <span>Didn’t receive the code?</span>
              <button className="resend-btn tap" type="button" onClick={() => toast(`Demo OTP re-sent to +91 ${digits}`, 'success')}>
                Resend
              </button>
            </div>
            <p className="auth-note">Use any 4–6 digit code for this demo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
