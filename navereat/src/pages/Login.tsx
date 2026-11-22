import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/login.css';

export function Login() {
  const login = useAppStore((s) => s.login);
  const nav = useAppNav();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const digits = phone.replace(/\D/g, '').slice(0, 10);

  const requestOtp = () => {
    if (digits.length !== 10) {
      toast('Enter a 10-digit mobile number', 'error');
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStep('otp');
      toast(`Demo OTP sent to +91 ${digits}`, 'success');
    }, 450);
  };

  const verify = () => {
    if (!/^\d{4,6}$/.test(otp)) {
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

  return (
    <div className="page login-page">
      <div className="page-scroll login-scroll">
        <header className="login-hero">
          <div className="login-gradient" />
          <div className="login-blob" style={{ width: 190, height: 190, top: -50, right: -40 }} />
          <div className="login-blob" style={{ width: 120, height: 120, bottom: -30, left: -24, animationDelay: '2.5s' }} />
          <div className="login-hero-inner">
            <div className="login-logo">N</div>
            <h1 className="login-brand">navereat</h1>
            <p className="login-tag">Food from your favourite places, near you.</p>
          </div>
        </header>

        <motion.section
          className="login-card"
          key={step}
          initial={{ opacity: 0, x: step === 'otp' ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {step === 'phone' ? (
            <>
              <h2 className="login-title">Login or Sign up</h2>
              <p className="login-sub">Enter your mobile number to continue</p>
              <label className="field-label" htmlFor="phone">
                Mobile number
              </label>
              <div className="phone-field">
                <span className="phone-prefix">+91</span>
                <Icon name="solid:phone" size={15} style={{ color: 'var(--g400)' }} />
                <input
                  id="phone"
                  className="phone-input"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={digits}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <button type="button" className="login-btn" onClick={requestOtp} disabled={busy}>
                {busy ? <span className="spinner" /> : <>Continue <Icon name="solid:arrow-right" size={14} /></>}
              </button>
              <p className="login-demo">
                <b>Demo mode</b> — any phone number works. No SMS is sent.
              </p>
              <p className="login-terms">
                By continuing you agree to Navereat&apos;s <b>Terms of Service</b> and <b>Privacy Policy</b>.
              </p>
            </>
          ) : (
            <>
              <button type="button" className="login-back tap" onClick={() => setStep('phone')} aria-label="Back">
                <Icon name="solid:chevron-left" size={14} />
              </button>
              <h2 className="login-title">Verify OTP</h2>
              <p className="login-sub">Sent to +91 {digits}</p>
              <button type="button" className="login-change" onClick={() => setStep('phone')}>
                <Icon name="solid:phone" size={11} /> +91 {digits} · Change
              </button>
              <label className="field-label" htmlFor="otp">
                One-time password
              </label>
              <div className="phone-field">
                <Icon name="solid:lock" size={15} style={{ color: 'var(--g400)' }} />
                <input
                  id="otp"
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <button type="button" className="login-btn" onClick={verify} disabled={busy}>
                {busy ? <span className="spinner" /> : <>Verify &amp; Continue <Icon name="solid:arrow-right" size={14} /></>}
              </button>
              <p className="otp-hint">
                Demo mode: enter any 4–6 digit OTP. <span className="resend">Resend</span>
              </p>
            </>
          )}
        </motion.section>

        <p className="login-footer">Navereat · Demo build · Works fully offline</p>
      </div>
    </div>
  );
}
