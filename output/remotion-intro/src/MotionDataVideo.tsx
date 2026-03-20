import React from 'react';
import {Video} from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';

const DATA_SCENE_DURATION = 180;
const DEMO_SCENE_DURATION = 350;
const OUTRO_SCENE_DURATION = 110;
const TRANSITION_DURATION = 20;

export const MOTION_DASH_DURATION =
  DATA_SCENE_DURATION + DEMO_SCENE_DURATION + OUTRO_SCENE_DURATION - TRANSITION_DURATION * 2;

const kpi = [
  {label: 'Active Streams', value: 128, unit: '', accent: '#22D3EE'},
  {label: 'Settlement Success', value: 98.7, unit: '%', accent: '#34D399'},
  {label: 'Daily Volume', value: 2.45, unit: 'M', accent: '#F59E0B'},
  {label: 'Notify Retries', value: 3, unit: '', accent: '#F472B6'},
] as const;

const cardBase: React.CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'linear-gradient(150deg, rgba(15,23,42,0.82), rgba(30,41,59,0.48))',
  padding: '24px 26px',
  minHeight: 180,
};

const textFont = 'SF Pro Display, Inter, system-ui, sans-serif';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const valueText = (value: number, unit: string) => {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'M') return `${value.toFixed(2)}M`;
  return `${Math.round(value)}`;
};

const DataWallScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entry = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const titleY = interpolate(entry, [0, 1], [40, 0]);
  const titleOpacity = interpolate(entry, [0, 1], [0, 1]);
  const bgShiftX = interpolate(frame, [0, DATA_SCENE_DURATION], [-80, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgShiftY = interpolate(frame, [0, DATA_SCENE_DURATION], [60, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chartProgress = interpolate(frame, [20, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const lineLength = 950;
  const dashOffset = lineLength * (1 - chartProgress);

  const scanY = interpolate(frame, [0, DATA_SCENE_DURATION], [-160, 1080], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#050816'}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 20% 25%, rgba(56,189,248,0.22), transparent 48%), radial-gradient(circle at 78% 68%, rgba(236,72,153,0.22), transparent 42%), linear-gradient(160deg, #050816 0%, #0b1228 52%, #13142c 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 80 + bgShiftY,
          right: -100 + bgShiftX,
          width: 460,
          height: 460,
          borderRadius: 999,
          filter: 'blur(80px)',
          background: 'rgba(168,85,247,0.26)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: scanY,
          left: 0,
          width: '100%',
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.85), transparent)',
          opacity: 0.6,
        }}
      />

      <AbsoluteFill style={{padding: 56}}>
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: textFont,
              fontWeight: 800,
              letterSpacing: 0.6,
              fontSize: 56,
              color: '#E2E8F0',
            }}
          >
            PolkaStream Data Big Screen
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: textFont,
              fontSize: 28,
              color: 'rgba(203,213,225,0.9)',
            }}
          >
            Real-time stream operations, settlement quality, and notifier health
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16}}>
          {kpi.map((item, idx) => {
            const delayed = frame - idx * 10;
            const progress = interpolate(delayed, [0, 45], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const v = item.value * progress;
            const y = interpolate(progress, [0, 1], [22, 0]);
            const opacity = interpolate(progress, [0, 1], [0, 1]);
            return (
              <div
                key={item.label}
                style={{
                  ...cardBase,
                  transform: `translateY(${y}px)`,
                  opacity,
                  boxShadow: `0 0 40px color-mix(in srgb, ${item.accent} 38%, transparent)`,
                }}
              >
                <div
                  style={{
                    fontFamily: textFont,
                    fontSize: 18,
                    color: 'rgba(148,163,184,0.95)',
                    letterSpacing: 0.4,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontFamily: textFont,
                    fontSize: 58,
                    fontWeight: 800,
                    color: '#F8FAFC',
                  }}
                >
                  {valueText(v, item.unit)}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    height: 4,
                    borderRadius: 999,
                    background: 'rgba(148,163,184,0.26)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(progress * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: item.accent,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 18}}>
          <div style={{...cardBase, minHeight: 290, position: 'relative'}}>
            <div style={{fontFamily: textFont, fontSize: 19, color: 'rgba(148,163,184,0.95)'}}>
              Settlement Throughput (24h)
            </div>
            <svg width="100%" height="220" viewBox="0 0 960 220" style={{marginTop: 18}}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22D3EE" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <path d="M0 188 L120 170 L240 146 L360 152 L480 110 L600 122 L720 84 L840 98 L960 56" stroke="url(#lineGrad)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={lineLength} strokeDashoffset={dashOffset} />
              <path d="M0 188 L120 170 L240 146 L360 152 L480 110 L600 122 L720 84 L840 98 L960 56 L960 220 L0 220 Z" fill="url(#lineGrad)" opacity={0.12 * chartProgress} />
              <circle cx={960 * chartProgress} cy={56 + (1 - chartProgress) * 132} r={9} fill="#E2E8F0" opacity={chartProgress} />
            </svg>
          </div>

          <div style={{...cardBase, minHeight: 290}}>
            <div style={{fontFamily: textFont, fontSize: 19, color: 'rgba(148,163,184,0.95)'}}>Stream Status Mix</div>
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 12, height: 190, marginTop: 16}}>
              {[
                {label: 'Active', value: 86, color: '#22D3EE'},
                {label: 'Paused', value: 26, color: '#F59E0B'},
                {label: 'Canceled', value: 12, color: '#F472B6'},
                {label: 'Failed', value: 4, color: '#EF4444'},
              ].map((bar, idx) => {
                const p = interpolate(frame - 30 - idx * 8, [0, 50], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const h = bar.value * p * 1.6;
                return (
                  <div key={bar.label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1}}>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 54,
                        height: `${h}px`,
                        borderRadius: '10px 10px 6px 6px',
                        background: bar.color,
                        boxShadow: `0 0 22px color-mix(in srgb, ${bar.color} 44%, transparent)`,
                      }}
                    />
                    <div style={{fontFamily: textFont, fontSize: 14, color: 'rgba(203,213,225,0.92)'}}>{bar.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const pulseOpacity = (frame: number, at: number) => {
  const d = frame - at;
  if (d < 0 || d > 20) return 0;
  return 1 - d / 20;
};

const LiveDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entry = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const panelScale = interpolate(entry, [0, 1], [0.94, 1]);
  const panelOpacity = interpolate(entry, [0, 1], [0, 1]);
  const panX = interpolate(frame, [0, DEMO_SCENE_DURATION], [18, -22], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const mouseX = interpolate(frame, [0, 90, 190, 290, 340], [430, 760, 600, 980, 1200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const mouseY = interpolate(frame, [0, 90, 190, 290, 340], [920, 760, 650, 520, 450], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const timelineProgress = interpolate(frame, [0, DEMO_SCENE_DURATION], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#020617'}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 10% 20%, rgba(59,130,246,0.25), transparent 35%), radial-gradient(circle at 90% 80%, rgba(244,114,182,0.20), transparent 32%), linear-gradient(165deg, #020617 0%, #111827 58%, #0f172a 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 42,
          borderRadius: 26,
          border: '1px solid rgba(148,163,184,0.30)',
          overflow: 'hidden',
          transform: `translateX(${panX}px) scale(${panelScale})`,
          opacity: panelOpacity,
          boxShadow: '0 25px 80px rgba(2,6,23,0.55)',
        }}
      >
        <Video
          src={staticFile('slides/local-mock.mp4')}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: textFont,
          color: '#E2E8F0',
        }}
      >
        <div style={{fontWeight: 750, fontSize: 28}}>Live Workflow Demo</div>
        <div style={{fontSize: 20, color: 'rgba(203,213,225,0.9)'}}>Local frontend + mock wallet + mock on-chain data</div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 42,
          right: 42,
          bottom: 24,
          height: 8,
          borderRadius: 999,
          background: 'rgba(100,116,139,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${timelineProgress}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #22D3EE, #8B5CF6, #F472B6)',
          }}
        />
      </div>

      {[
        {from: 20, title: 'Wallet Import', desc: 'Injected MetaMask provider and connected account', x: 80, y: 120, color: '#22D3EE'},
        {from: 130, title: 'Stream Actions', desc: 'Pause / Resume / Withdraw / Retry Notify', x: 1240, y: 160, color: '#F59E0B'},
        {from: 230, title: 'Create Stream', desc: 'Filled form and submitted transaction', x: 90, y: 740, color: '#34D399'},
      ].map((tip, idx) => {
        const local = frame - tip.from;
        const progress = interpolate(local, [0, 18, 90], [0, 1, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const opacity = progress;
        const y = interpolate(progress, [0, 1], [16, 0]);

        return (
          <div
            key={tip.title}
            style={{
              position: 'absolute',
              left: tip.x,
              top: tip.y,
              width: 560,
              borderRadius: 18,
              border: `1px solid ${tip.color}`,
              background: 'rgba(2,6,23,0.72)',
              padding: '14px 16px',
              transform: `translateY(${y}px)`,
              opacity,
              boxShadow: `0 0 34px color-mix(in srgb, ${tip.color} 30%, transparent)`,
            }}
          >
            <div style={{fontFamily: textFont, fontSize: 24, fontWeight: 760, color: '#F8FAFC'}}>{tip.title}</div>
            <div style={{marginTop: 6, fontFamily: textFont, fontSize: 18, color: 'rgba(203,213,225,0.95)'}}>{tip.desc}</div>
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: mouseX,
          top: mouseY,
          width: 24,
          height: 24,
          borderRadius: 999,
          border: '2px solid #E2E8F0',
          background: 'rgba(255,255,255,0.18)',
          boxShadow: '0 0 22px rgba(226,232,240,0.7)',
        }}
      />

      {[85, 190, 290].map((at) => {
        const opacity = pulseOpacity(frame, at);
        const scale = 1 + clamp((frame - at) / 10, 0, 2);
        if (opacity <= 0) return null;
        return (
          <div
            key={at}
            style={{
              position: 'absolute',
              left: mouseX - 18,
              top: mouseY - 18,
              width: 60,
              height: 60,
              borderRadius: 999,
              border: '2px solid rgba(56,189,248,0.9)',
              transform: `scale(${scale})`,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entry = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const scale = interpolate(entry, [0, 1], [0.95, 1]);
  const opacity = interpolate(entry, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 50% 30%, rgba(34,211,238,0.22), transparent 45%), linear-gradient(160deg, #020617, #111827 65%, #0f172a)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 1420,
          borderRadius: 28,
          border: '1px solid rgba(148,163,184,0.32)',
          background: 'rgba(15,23,42,0.55)',
          padding: '42px 48px',
          transform: `scale(${scale})`,
          opacity,
          boxShadow: '0 20px 70px rgba(2,6,23,0.6)',
        }}
      >
        <div style={{fontFamily: textFont, fontWeight: 820, fontSize: 62, color: '#F8FAFC'}}>PolkaStream Ops Console</div>
        <div style={{marginTop: 14, fontFamily: textFont, fontSize: 30, color: 'rgba(203,213,225,0.94)'}}>
          Real-time stream payments with interactive controls and operations telemetry
        </div>
        <div style={{marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14}}>
          {['Data Big Screen', 'Wallet + Stream Actions', 'Settlement Reliability'].map((item) => (
            <div
              key={item}
              style={{
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'rgba(30,41,59,0.45)',
                padding: '13px 16px',
                fontFamily: textFont,
                fontSize: 22,
                color: '#E2E8F0',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MotionDataVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={DATA_SCENE_DURATION}>
          <DataWallScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({direction: 'from-right'})}
          timing={linearTiming({durationInFrames: TRANSITION_DURATION})}
        />

        <TransitionSeries.Sequence durationInFrames={DEMO_SCENE_DURATION}>
          <LiveDemoScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({durationInFrames: TRANSITION_DURATION})}
        />

        <TransitionSeries.Sequence durationInFrames={OUTRO_SCENE_DURATION}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
