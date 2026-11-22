import { useEffect, useRef, useState } from 'react';
import heroArt from '../assets/login-hero.webp';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import loginBundleCss from '../styles/original/login.bundle.css?raw';
import loginShellCss from '../styles/original/login-shell.css?raw';
import '../styles/pages/login.css';

const OTP_LENGTH = 6;

export function Login() {
  const login = useAppStore((s) => s.login);
  const nav = useAppNav();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.navereatLogin = 'true';
    style.textContent = `${loginShellCss}\n${loginBundleCss}`;
    document.head.appendChild(style);
    document.body.classList.add('login-redesign');
    return () => {
      style.remove();
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
          <img className="login-hero-art" src={heroArt} alt="Navereat food delivery" />
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
        {step === 'phone' ? (
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
