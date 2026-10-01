'use client';
/** Events / birthday popup (port of the #eventsPopup block in base.html). Shown once per day per user. */
import { useEffect, useRef, useState } from 'react';

const POPUP_KEY = 'eventsPopupShown';

type Bday = { id: number; full_name: string };
type Announcement = { id: number; title: string; description?: string };

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BCB', '#C084FC', '#FB923C', '#ffffff', '#34D399', '#FCD34D', '#F472B6', '#60A5FA'];

function spawnConfetti(canvas: HTMLCanvasElement) {
  const W = (canvas.width = window.innerWidth);
  const H = (canvas.height = window.innerHeight);
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const particles: any[] = [];

  function addBurst(ox: number, oy: number, count: number, speedMult?: number) {
    speedMult = speedMult || 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (3 + Math.random() * 9) * speedMult;
      const type = ['rect', 'circle', 'ribbon', 'star'][Math.floor(Math.random() * 4)];
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (5 + Math.random() * 7),
        w: 5 + Math.random() * 10,
        h: 3 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        gravity: 0.2 + Math.random() * 0.12,
        drag: 0.992,
        alpha: 1,
        type,
        scaleY: 1,
        scaleYDir: Math.random() > 0.5 ? 1 : -1,
        scaleYSpeed: 0.07 + Math.random() * 0.1,
      });
    }
  }

  const cx = W * 0.5,
    cy = H * 0.52;
  addBurst(cx, cy, 75);
  setTimeout(() => addBurst(W * 0.15, H * 0.48, 38, 0.85), 160);
  setTimeout(() => addBurst(W * 0.85, H * 0.48, 38, 0.85), 300);
  setTimeout(() => addBurst(cx, cy * 0.65, 55, 1.15), 480);
  setTimeout(() => addBurst(cx, cy, 50, 0.9), 750);
  setTimeout(() => addBurst(W * 0.3, H * 0.6, 30, 0.8), 1000);
  setTimeout(() => addBurst(W * 0.7, H * 0.6, 30, 0.8), 1100);

  function drawStar(r: number) {
    ctx!.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.42;
      const px = Math.cos(ang) * rad,
        py = Math.sin(ang) * rad;
      if (i === 0) ctx!.moveTo(px, py);
      else ctx!.lineTo(px, py);
    }
    ctx!.closePath();
    ctx!.fill();
  }

  let frame = 0;
  function animate() {
    ctx!.clearRect(0, 0, W, H);
    let hasVisible = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      hasVisible = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.rotation += p.rotSpeed;
      p.scaleY += p.scaleYSpeed * p.scaleYDir;
      if (Math.abs(p.scaleY) >= 1) p.scaleYDir *= -1;
      if (p.y > H) p.alpha -= 0.06;
      if (p.alpha <= 0) continue;

      ctx!.save();
      ctx!.globalAlpha = p.alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotation);
      ctx!.scale(1, p.scaleY);
      ctx!.fillStyle = p.color;
      switch (p.type) {
        case 'circle':
          ctx!.beginPath();
          ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx!.fill();
          break;
        case 'ribbon':
          ctx!.fillRect(-p.w, -p.h * 0.18, p.w * 2, p.h * 0.36);
          break;
        case 'star':
          drawStar(p.w * 0.55);
          break;
        default:
          ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx!.restore();
    }
    frame++;
    if (hasVisible || frame < 60) requestAnimationFrame(animate);
    else canvas.style.display = 'none';
  }
  animate();

  // Fade out canvas after 4.5 s
  setTimeout(() => {
    let op = 1;
    const fade = setInterval(() => {
      op -= 0.04;
      if (!canvas.parentNode || op <= 0) {
        canvas.style.display = 'none';
        canvas.style.opacity = '1';
        clearInterval(fade);
      } else {
        canvas.style.opacity = String(op);
      }
    }, 50);
  }, 4500);
}

export default function EventsPopup({ userId }: { userId: string }) {
  const [data, setData] = useState<{ birthdays: Bday[]; announcements: Announcement[]; current_user_id: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkEvents() {
      const key = new Date().toISOString().slice(0, 10) + '_' + (userId || '');
      try {
        if (localStorage.getItem(POPUP_KEY) === key) return;
      } catch {}
      try {
        const r = await fetch('/api/events/today', { credentials: 'same-origin', cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        const { birthdays = [], announcements = [], current_user_id } = d;
        if (!birthdays.length && !announcements.length) return;
        if (cancelled) return;
        setData({ birthdays, announcements, current_user_id });
        setVisible(true);
        try {
          localStorage.setItem(POPUP_KEY, key);
        } catch {}
        if (birthdays.some((b: Bday) => b.id === current_user_id)) {
          setTimeout(() => {
            if (canvasRef.current) spawnConfetti(canvasRef.current);
          }, 80);
        }
      } catch {}
    }
    checkEvents();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function closePopup() {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      setFading(false);
    }, 260);
  }

  const myBirthday = data ? data.birthdays.find((b) => b.id === data.current_user_id) : undefined;
  const otherBdays = data ? data.birthdays.filter((b) => b.id !== data.current_user_id) : [];
  const announcements = data ? data.announcements : [];

  const btnStyle: React.CSSProperties = myBirthday
    ? {
        background: 'linear-gradient(135deg,#5b21b6,#be185d)',
        boxShadow: '0 4px 18px rgba(91,33,182,.38)',
        borderRadius: 14,
        padding: '11px 36px',
        fontSize: '0.95rem',
        letterSpacing: '0.03em',
      }
    : { background: '#1a1f3a', borderRadius: 10, padding: '9px 28px', fontSize: '0.875rem' };

  return (
    <div
      id="eventsPopup"
      style={{
        display: visible ? 'flex' : 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(10,14,35,.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        opacity: fading ? 0 : undefined,
        transition: fading ? 'opacity .25s' : undefined,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePopup();
      }}
    >
      <canvas
        id="bdayCanvas"
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'none' }}
      ></canvas>
      <div
        id="eventsPopupBox"
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 440,
          overflow: 'hidden',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,.3)',
          animation: 'popIn .35s cubic-bezier(.34,1.56,.64,1) both',
        }}
      >
        {data && (
          <>
            {myBirthday ? (
              <>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'center',
                    background: 'linear-gradient(160deg,#1e1b4b 0%,#5b21b6 35%,#be185d 72%,#c2410c 100%)',
                    padding: '2.5rem 1.5rem 2rem',
                    minHeight: 256,
                  }}
                >
                  <span style={{ position: 'absolute', top: '11%', left: '7%', fontSize: '1rem', animation: 'sparkle 1.7s 0.1s ease-in-out infinite' }}>✨</span>
                  <span style={{ position: 'absolute', top: '17%', right: '8%', fontSize: '0.85rem', animation: 'sparkle 2.1s 0.65s ease-in-out infinite' }}>✨</span>
                  <span style={{ position: 'absolute', top: '58%', left: '11%', fontSize: '0.75rem', animation: 'sparkle 1.9s 1s ease-in-out infinite' }}>⭐</span>
                  <span style={{ position: 'absolute', top: '63%', right: '10%', fontSize: '0.8rem', animation: 'sparkle 2.3s 0.4s ease-in-out infinite' }}>✨</span>
                  <span style={{ position: 'absolute', top: '33%', left: '3%', fontSize: '0.7rem', animation: 'sparkle 1.5s 0.8s ease-in-out infinite' }}>💫</span>
                  <span style={{ position: 'absolute', top: '38%', right: '3%', fontSize: '0.7rem', animation: 'sparkle 2s 1.3s ease-in-out infinite' }}>💫</span>

                  <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: '2.4rem', lineHeight: 1, animation: 'balloonFloat 2.2s ease-in-out infinite' }}>🎈</span>
                  <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: '2.2rem', lineHeight: 1, animation: 'balloonFloat 2.8s 0.5s ease-in-out infinite' }}>🎈</span>
                  <span style={{ position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)', fontSize: '1.9rem', lineHeight: 1, animation: 'balloonFloat 3.2s 0.2s ease-in-out infinite' }}>🎀</span>

                  <div
                    style={{
                      fontSize: '5rem',
                      lineHeight: 1,
                      marginBottom: '0.4rem',
                      display: 'inline-block',
                      filter: 'drop-shadow(0 6px 20px rgba(0,0,0,.45))',
                      animation: 'cakeFloat 2.6s ease-in-out infinite',
                    }}
                  >
                    🎂
                  </div>

                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: '1.85rem',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                      marginBottom: '0.4rem',
                      background: 'linear-gradient(90deg,#fde68a,#ffffff,#fde68a,#fbbf24)',
                      backgroundSize: '300% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'shimmerText 2.5s linear infinite',
                    }}
                  >
                    Happy Birthday!
                  </div>

                  <div style={{ fontSize: '1.5rem', letterSpacing: 6 }}>🎉🥳🎊</div>
                </div>

                <div style={{ padding: '1.4rem 1.75rem 0.25rem', textAlign: 'center', background: '#fff' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 800,
                      fontSize: '1.3rem',
                      color: '#1a1f3a',
                      animation: 'namePop 0.5s 0.25s cubic-bezier(.34,1.56,.64,1) both',
                    }}
                  >
                    🎁&nbsp;{myBirthday.full_name}
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#6b7280', lineHeight: 1.65, margin: '0.6rem 0 0' }}>
                    The whole team is celebrating <em style={{ color: '#7c3aed' }}>you</em> today! Wishing you a day overflowing with joy, laughter &amp; beautiful memories.&nbsp;🌟
                  </p>
                </div>
              </>
            ) : (
              (otherBdays.length > 0 || announcements.length > 0) && (
                <div
                  style={{
                    background: 'linear-gradient(135deg,#1a1f3a,#2d3561)',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      background: 'rgba(255,255,255,.12)',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    🎉
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>Team Highlights</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,.6)' }}>Today&apos;s events for your team</div>
                  </div>
                </div>
              )
            )}

            {(otherBdays.length > 0 || announcements.length > 0) && (
              <div style={{ padding: '0 1.5rem' }}>
                {otherBdays.map((b) => (
                  <div key={'b' + b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '2rem', flexShrink: 0 }}>🎂</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1a1f3a', fontSize: '0.92rem' }}>
                        Today is <span style={{ color: '#e84c4c' }}>{b.full_name}</span>&apos;s Birthday!
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>Don&apos;t forget to wish them a happy birthday 🎈</div>
                    </div>
                  </div>
                ))}
                {announcements.map((a) => (
                  <div key={'a' + a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        background: '#eff6ff',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      📢
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1a1f3a', fontSize: '0.92rem' }}>{a.title}</div>
                      {a.description ? (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 3, whiteSpace: 'pre-line' }}>{a.description}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '0.9rem 1.5rem 1.25rem', textAlign: 'center', background: '#fff' }}>
              <button
                onClick={closePopup}
                style={{ ...btnStyle, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
              >
                {myBirthday ? '🎉 Thank You!' : 'Got it!'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
