import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';

export default function Landing() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp' | 'otp-setup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('ACADEMY_ADMIN'); // 'ACADEMY_ADMIN' | 'TEACHER'
  const [educationLevel, setEducationLevel] = useState(() => {
    return localStorage.getItem('takeme_selected_education_level') || '유치원';
  }); // '유치원' | '초등부' | '중,고등부'
  const [otpToken, setOtpToken] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [userId, setUserId] = useState(null);
  const [appAccountCountdown, setAppAccountCountdown] = useState(10);

  useEffect(() => {
    if (mode !== 'app-account-notice') return;
    if (appAccountCountdown <= 0) {
      setMode('login');
      setPassword('');
      return;
    }
    const timer = setTimeout(() => {
      setAppAccountCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [mode, appAccountCountdown]);
  
  // Teacher Registration Specific State
  const [authCode, setAuthCode] = useState('');
  const [isAuthCodeVerified, setIsAuthCodeVerified] = useState(false);
  const [isVerifyingAuthCode, setIsVerifyingAuthCode] = useState(false);
  const [verifiedAcademyName, setVerifiedAcademyName] = useState('');

  // Email Verification
  const [emailCode, setEmailCode] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);

  // Self Unlock State
  const [showSelfUnlock, setShowSelfUnlock] = useState(false);
  const [unlockMethod, setUnlockMethod] = useState('sms'); // 'sms' | 'email'
  const [unlockPhone, setUnlockPhone] = useState('');
  const [unlockSmsSent, setUnlockSmsSent] = useState(false);
  const [unlockSmsCode, setUnlockSmsCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [unlockSent, setUnlockSent] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');

  // Director Phone for Registration
  const [directorPhone, setDirectorPhone] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');

  // 사업자 등록번호 10자리 자동 하이픈 포맷터 (000-00-00000)
  const formatBusinessNumber = (value) => {
    if (!value) return '';
    const nums = value.replace(/\D/g, '').slice(0, 10);
    if (nums.length <= 3) return nums;
    if (nums.length <= 5) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 5)}-${nums.slice(5, 10)}`;
  };

  const navigate = useNavigate();


  const handleSendUnlockSms = async () => {
    if (!email || !email.includes('@')) {
      return alert('잠금 해제할 관리자 이메일 계정을 입력해주세요.');
    }
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/self-unlock/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), phone: unlockPhone.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setUnlockSmsSent(true);
        if (data.maskedPhone) setMaskedPhone(data.maskedPhone);
        alert(data.message || 'SMS 인증번호가 발송되었습니다.');
      } else {
        alert(data.message || 'SMS 발송에 실패했습니다.');
      }
    } catch (e) {
      alert('서버 연결에 실패했습니다.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleVerifyUnlockSms = async () => {
    if (!unlockSmsCode || unlockSmsCode.trim().length !== 6) {
      return alert('SMS로 전송받은 6자리 인증번호를 입력해주세요.');
    }
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/self-unlock/sms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: unlockSmsCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('관리자 계정 잠금이 성공적으로 해제되었습니다! 이제 로그인해 주세요.');
        setShowSelfUnlock(false);
        setUnlockSmsSent(false);
        setUnlockSmsCode('');
        setUnlockSent(false);
        setUnlockCode('');
      } else {
        alert(data.message || '인증번호가 일치하지 않거나 만료되었습니다.');
      }
    } catch (e) {
      alert('서버 연결에 실패했습니다.');
    } finally {
      setUnlockLoading(false);
    }
  };
  const handleSendUnlockCode = async () => {
    if (!email || !email.includes('@')) {
      return alert('잠금 해제 인증번호를 발송할 올바른 이메일 주소를 입력해주세요.');
    }
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/self-unlock/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('이메일로 6자리 잠금 해제 인증번호가 발송되었습니다. 메일함을 확인해주세요.');
        setUnlockSent(true);
      } else {
        alert(data.message || '인증번호 발송에 실패했습니다.');
      }
    } catch (e) {
      alert('서버 연결에 실패했습니다.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleVerifyUnlockCode = async () => {
    if (!unlockCode || unlockCode.trim().length !== 6) {
      return alert('6자리 인증번호를 정확히 입력해주세요.');
    }
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/self-unlock/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: unlockCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('계정 잠금이 성공적으로 해제되었습니다! 이제 로그인하실 수 있습니다.');
        setShowSelfUnlock(false);
        setUnlockSent(false);
        setUnlockCode('');
      } else {
        alert(data.message || '인증번호가 일치하지 않거나 만료되었습니다.');
      }
    } catch (e) {
      alert('서버 연결에 실패했습니다.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email.includes('@')) return alert('유효한 이메일을 입력해주세요.');
    setIsEmailSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        alert('인증 코드가 이메일로 전송되었습니다. 메일함을 확인해주세요.');
        setIsEmailSent(true);
      } else {
        alert(data.message);
      if (data.message && data.message.includes('잠겼습니다')) {
        setShowSelfUnlock(true);
      }
      }
    } catch (err) {
      alert('서버 연결에 실패했습니다.');
    } finally {
      setIsEmailSending(false);
    }
  };

  const handleVerifyEmail = async () => {
    const res = await fetch(`${API_BASE_URL}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: emailCode })
    });
    if (res.ok) {
      alert('이메일 인증이 완료되었습니다.');
      setIsEmailVerified(true);
    } else alert('인증 실패. 다시 시도해주세요.');
  };

  const handleVerifyAuthCode = async () => {
    if (!authCode || !authCode.trim()) return alert('원 인증코드를 입력해주세요.');
    setIsVerifyingAuthCode(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-auth-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode: authCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthCodeVerified(true);
        setVerifiedAcademyName(data.academyName);
        alert(`[${data.academyName}] 소속 인증이 완료되었습니다.`);
      } else {
        alert(data.message || '원 인증코드 확인에 실패했습니다.');
      }
    } catch (err) {
      alert('인증코드 확인 중 서버 오류가 발생했습니다.');
    } finally {
      setIsVerifyingAuthCode(false);
    }
  };

  const validatePassword = (pw) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return regex.test(pw);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!isEmailVerified) return alert('이메일 인증을 완료해주세요.');
    if (!role) return alert('역할을 선택해주세요.');
    if (!validatePassword(password)) return alert('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
    if (password !== confirmPassword) return alert('비밀번호가 일치하지 않습니다.');

    if (role === 'TEACHER') {
      if (!isAuthCodeVerified) return alert('원 인증코드를 먼저 확인해주세요.');

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          name, 
          role: 'TEACHER', 
          authCode: authCode.trim().toUpperCase(),
          educationLevel
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('takeme_selected_education_level', educationLevel);
        alert(data.message || '교사 회원가입이 완료되었습니다! 관리자님의 반 배정 후 이용 가능합니다.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
      } else {
        alert(data.message || '회원가입에 실패했습니다.');
      }
      return;
    }

    // ACADEMY_ADMIN
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role, phone: directorPhone.trim() || undefined, businessNumber: businessNumber.trim() || undefined, educationLevel })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('takeme_selected_education_level', educationLevel);
      setUserId(data.userId);
      setQrCodeUrl(data.qrCodeUrl);
      setMode('otp-setup');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    } else {
      alert(data.message);
      if (data.message && data.message.includes('잠겼습니다')) {
        setShowSelfUnlock(true);
      }
    }
  };

  const handleOtpSetup = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token: otpToken })
    });
    if (res.ok) {
      alert('OTP 연동이 완료되었습니다. 로그인해주세요.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setOtpToken('');
    } else {
      alert('OTP 코드가 올바르지 않습니다.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, otpToken: mode === 'otp' ? otpToken : undefined, clientType: 'web' })
    });
    const data = await res.json();

    const isWebAllowed = data.user && (
      data.user.role === 'ACADEMY_ADMIN' ||
      data.user.role === 'SUPER_ADMIN' ||
      data.user.role === 'TEACHER' ||
      data.user.role === 'HOMEROOM_TEACHER' ||
      data.user.role === 'SHUTTLE_TEACHER'
    );

    if (data.isAppAccount || (data.user && !isWebAllowed)) {
      localStorage.removeItem('takeme_token');
      localStorage.removeItem('takeme_refresh_token');
      localStorage.removeItem('takeme_user');
      setAppAccountCountdown(10);
      setMode('app-account-notice');
      return;
    }
    
    if (res.ok) {
      if (data.requireOtp) {
        setMode('otp');
      } else if (data.requireOtpSetup) {
        setUserId(data.userId);
        setQrCodeUrl(data.qrCodeUrl);
        setMode('otp-setup');
      } else {
        localStorage.removeItem('takeme_academy');
        localStorage.removeItem('takeme_buses');
        if (data.accessToken) {
          localStorage.setItem('takeme_token', data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('takeme_refresh_token', data.refreshToken);
        }
        // 로그인한 계정에 저장된 정보를 토대로 교육 부문(초등부, 중·고등부, 유치원) 자동 결정
        let targetLevel = data.user?.educationLevel;
        if (!targetLevel || targetLevel === '전체') {
          const userMeta = `${data.user?.academyName || ''} ${data.user?.name || ''} ${data.user?.email || ''}`.toLowerCase();
          if (userMeta.includes('초등') || userMeta.includes('elem')) {
            targetLevel = '초등부';
          } else if (userMeta.includes('중등') || userMeta.includes('고등') || userMeta.includes('middle') || userMeta.includes('high')) {
            targetLevel = '중,고등부';
          } else {
            targetLevel = '유치원';
          }
        }
        
        // 정규화
        if (targetLevel.includes('초등')) {
          targetLevel = '초등부';
        } else if (targetLevel.includes('중') || targetLevel.includes('고')) {
          targetLevel = '중,고등부';
        } else if (targetLevel.includes('유치')) {
          targetLevel = '유치원';
        }

        const updatedUser = {
          ...data.user,
          educationLevel: targetLevel,
          accessToken: data.accessToken || null
        };
        localStorage.setItem('takeme_user', JSON.stringify(updatedUser));
        localStorage.setItem('takeme_selected_education_level', targetLevel);

        if (targetLevel === '초등부') {
          navigate('/dashboard/elementary');
        } else if (targetLevel === '중,고등부') {
          navigate('/dashboard/middle-high');
        } else {
          navigate('/dashboard/kindergarten');
        }
      }
    } else {
      alert(data.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center relative overflow-hidden py-8 px-4">
      <div className="landing-glass w-full max-w-md p-8 relative z-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200">
        <h1 className="text-3xl font-extrabold text-center mb-1 text-blue-600 tracking-tight">Takeme</h1>
        <p className="text-center text-slate-500 mb-6 text-sm">안심 통학 셔틀 & 학생 안심 케어 시스템</p>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">이메일</label>
              <input type="email" placeholder="user@example.com" value={email} onChange={e=>setEmail(e.target.value)} className="form-input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  className="form-input !pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                  title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3 text-base font-bold shadow-md shadow-blue-500/20">로그인</button>
            {showSelfUnlock && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-950">관리자 계정 잠금 해제 안내</p>
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">5회 실패 보안잠금</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  관리자 본인 확인을 위해 휴대폰 SMS 또는 이메일로 인증번호를 받아 즉시 잠금을 해제할 수 있습니다.
                </p>

                {/* Unlock Method Tabs */}
                <div className="flex bg-amber-100/80 p-0.5 rounded-lg border border-amber-200">
                  <button
                    type="button"
                    onClick={() => setUnlockMethod('sms')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                      unlockMethod === 'sms'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-amber-800 hover:text-amber-950'
                    }`}
                  >
                    휴대폰 SMS 인증 (추천)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnlockMethod('email')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                      unlockMethod === 'email'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-amber-800 hover:text-amber-950'
                    }`}
                  >
                    이메일 인증
                  </button>
                </div>

                {/* SMS Method Content */}
                {unlockMethod === 'sms' && (
                  <div className="space-y-2 pt-1">
                    {!unlockSmsSent ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            관리자 휴대폰 번호 (등록된 번호 자동 연동)
                          </label>
                          <input
                            type="tel"
                            placeholder="010-1234-5678 (비워둘 시 등록된 번호로 발송)"
                            value={unlockPhone}
                            onChange={(e) => setUnlockPhone(e.target.value)}
                            className="form-input text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendUnlockSms}
                          disabled={unlockLoading}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                        >
                          {unlockLoading ? 'SMS 발송 중...' : '휴대폰 SMS로 인증번호 받기'}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
                          {maskedPhone ? `${maskedPhone} 번호로 SMS 인증번호가 전송되었습니다.` : 'SMS 인증번호가 발송되었습니다.'}
                        </div>
                        <input
                          type="text"
                          placeholder="인증번호 6자리 입력"
                          value={unlockSmsCode}
                          onChange={(e) => setUnlockSmsCode(e.target.value)}
                          maxLength={6}
                          className="form-input text-center tracking-widest font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleVerifyUnlockSms}
                            disabled={unlockLoading}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
                          >
                            {unlockLoading ? '확인 중...' : 'SMS로 잠금 해제'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSendUnlockSms}
                            disabled={unlockLoading}
                            className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-xl transition"
                          >
                            재발송
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Email Method Content */}
                {unlockMethod === 'email' && (
                  <div className="space-y-2 pt-1">
                    {!unlockSent ? (
                      <button
                        type="button"
                        onClick={handleSendUnlockCode}
                        disabled={unlockLoading}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                      >
                        {unlockLoading ? '인증번호 발송 중...' : '관리자 이메일로 인증번호 받기'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-2 bg-amber-100/60 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                          가입된 이메일 메일함으로 6자리 인증 코드가 발송되었습니다.
                        </div>
                        <input
                          type="text"
                          placeholder="인증번호 6자리"
                          value={unlockCode}
                          onChange={(e) => setUnlockCode(e.target.value)}
                          maxLength={6}
                          className="form-input text-center tracking-widest font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleVerifyUnlockCode}
                            disabled={unlockLoading}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
                          >
                            {unlockLoading ? '확인 중...' : '이메일로 잠금 해제'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSendUnlockCode}
                            disabled={unlockLoading}
                            className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-xl transition"
                          >
                            재발송
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setRole('ACADEMY_ADMIN');
                  setPassword('');
                  setConfirmPassword('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                회원가입
              </button>
            </div>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-center text-slate-600 mb-4">Google OTP 앱을 열고 6자리 코드를 입력해주세요.</p>
            <input type="text" placeholder="6자리 OTP 번호" maxLength={6} value={otpToken} onChange={e=>setOtpToken(e.target.value)} className="form-input text-center text-2xl tracking-widest font-mono" required />
            <button type="submit" className="btn-primary w-full py-3 font-bold">인증하기</button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-slate-500 text-sm mt-2">뒤로가기</button>
          </form>
        )}

        {mode === 'otp-setup' && (
          <form onSubmit={handleOtpSetup} className="space-y-4">
            <h3 className="font-bold text-center text-slate-800">Google OTP 2단계 보안 연동</h3>
            <p className="text-xs text-slate-500 text-center">아래 QR코드를 Google Authenticator 앱에서 스캔하세요.</p>
            <div className="flex justify-center my-4">
              {qrCodeUrl && <img src={qrCodeUrl} alt="OTP QR Code" className="w-48 h-48 border rounded-xl shadow-sm" />}
            </div>
            <input type="text" placeholder="앱에 표시된 6자리 번호" maxLength={6} value={otpToken} onChange={e=>setOtpToken(e.target.value)} className="form-input text-center tracking-widest font-mono text-xl" required />
            <button type="submit" className="btn-primary w-full py-3 font-bold">연동 완료하기</button>
          </form>
        )}

        {mode === 'app-account-notice' && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                본 계정은 앱기반 계정입니다.
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                기사 및 학부모 계정은 모바일 앱(Takeme)을 통해 로그인해 주시기 바랍니다. (관리자 및 담임/동승 교사는 웹에서도 이용 가능합니다.)
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
              <p className="text-3xl font-black text-blue-600">{appAccountCountdown}초</p>
              <p className="text-xs text-slate-500">{appAccountCountdown}초 후 로그인 화면으로 자동 이동합니다.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setPassword('');
              }}
              className="btn-primary w-full py-3 text-base font-bold shadow-md shadow-blue-500/20"
            >
              즉시 로그인 화면으로 돌아가기
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Education Level Selector: 유치원 / 초등부 / 중,고등부 */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">교육 부문 선택</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: 'kindergarten', label: '유치원' },
                  { id: 'elementary', label: '초등부' },
                  { id: 'middle_high', label: '중,고등부' },
                ].map(level => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setEducationLevel(level.label)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                      educationLevel === level.label
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{level.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">가입 유형 선택</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setRole('ACADEMY_ADMIN');
                    setIsAuthCodeVerified(false);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    role === 'ACADEMY_ADMIN'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>관리자</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('TEACHER');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    role === 'TEACHER'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>교사</span>
                </button>
              </div>
            </div>

            {role === 'ACADEMY_ADMIN' ? (
              <p className="text-xs font-medium text-blue-700 bg-blue-50 py-2 px-3 rounded-lg border border-blue-100">
                가입 즉시 새로운 통합 관리 대시보드가 생성됩니다.
              </p>
            ) : (
              <p className="text-xs font-medium text-emerald-700 bg-emerald-50 py-2 px-3 rounded-lg border border-emerald-100">
                관리자에게 전달받은 <strong>기관 인증코드</strong>를 입력해주세요.
              </p>
            )}

            {/* Teacher Specific: Kindergarten Auth Code */}
            {role === 'TEACHER' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  원 인증코드
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="원 인증코드 6자리 입력"
                    value={authCode}
                    onChange={e => {
                      setAuthCode(e.target.value.toUpperCase());
                      setIsAuthCodeVerified(false);
                    }}
                    disabled={isAuthCodeVerified || isVerifyingAuthCode}
                    className="form-input uppercase"
                    maxLength={10}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAuthCode}
                    disabled={isAuthCodeVerified || isVerifyingAuthCode}
                    className={`px-3 py-2 text-xs font-bold rounded-xl shrink-0 transition-colors ${
                      isAuthCodeVerified 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isVerifyingAuthCode ? '확인 중...' : isAuthCodeVerified ? '인증완료' : '코드 확인'}
                  </button>
                </div>
                {isAuthCodeVerified && (
                  <div className="text-xs font-semibold text-emerald-600 mt-1 pl-1">
                    소속: <strong>{verifiedAcademyName}</strong> (가입 후 관리자님께서 담당 반을 배정합니다)
                  </div>
                )}
              </div>
            )}

            {/* Email + Verification */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">이메일 계정</label>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="user@example.com" 
                  value={email} 
                  onChange={e=>setEmail(e.target.value)} 
                  className="form-input" 
                  required 
                  disabled={isEmailVerified || isEmailSending}
                />
                <button 
                  type="button" 
                  onClick={handleSendEmail} 
                  disabled={isEmailVerified || isEmailSending} 
                  className="px-3 py-2 bg-slate-200 text-xs font-bold rounded-xl shrink-0 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEmailSending ? '전송중...' : isEmailVerified ? '인증완료' : '인증 발송'}
                </button>
              </div>
            </div>
            
            {isEmailSent && !isEmailVerified && (
              <div className="flex gap-2 p-2 bg-blue-50/60 rounded-xl border border-blue-100">
                <input 
                  type="text" 
                  placeholder="메일 인증코드 6자리" 
                  value={emailCode} 
                  onChange={e=>setEmailCode(e.target.value)} 
                  className="form-input text-center font-bold" 
                  required 
                />
                <button 
                  type="button" 
                  onClick={handleVerifyEmail} 
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shrink-0 hover:bg-blue-700"
                >
                  확인
                </button>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {role === 'ACADEMY_ADMIN' ? '관리자 성함' : '교사 성함'}
              </label>
              <input 
                type="text" 
                placeholder={role === 'ACADEMY_ADMIN' ? '홍길동' : '김선생'} 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                className="form-input" 
                required 
              />
            </div>
            
            {role === 'ACADEMY_ADMIN' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    관리자 휴대폰 번호
                  </label>
                  <input 
                    type="tel" 
                    placeholder="010-1234-5678" 
                    value={directorPhone} 
                    onChange={e=>setDirectorPhone(e.target.value)} 
                    className="form-input" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    사업자 등록번호 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="123-45-67890 (10자리)" 
                    value={businessNumber} 
                    onChange={e=>setBusinessNumber(formatBusinessNumber(e.target.value))} 
                    maxLength={12}
                    className="form-input tracking-wider" 
                  />
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="form-input !pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                  title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {password && !validatePassword(password) && (
                <p className="text-xs text-red-500 mt-1 pl-1">영문, 숫자, 특수문자를 모두 포함(8자 이상)해야 합니다.</p>
              )}
              {password && validatePassword(password) && (
                <p className="text-xs text-emerald-600 mt-1 pl-1">사용 가능한 안전한 비밀번호입니다.</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 한 번 더 입력해주세요"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="form-input !pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                  title={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  aria-label={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword && (
                password === confirmPassword ? (
                  <p className="text-xs text-emerald-600 mt-1 pl-1">비밀번호가 일치합니다.</p>
                ) : (
                  <p className="text-xs text-red-500 mt-1 pl-1">비밀번호가 일치하지 않습니다.</p>
                )
              )}
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full py-3 font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={!isEmailVerified || !validatePassword(password) || password !== confirmPassword || (role === 'TEACHER' && !isAuthCodeVerified)}
            >
              {role === 'ACADEMY_ADMIN' ? '관리자 가입 완료' : '교사 가입 완료'}
            </button>
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="text-xs font-semibold text-slate-500 hover:underline"
              >
                이미 계정이 있으신가요? 로그인하기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
