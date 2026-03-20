import React from 'react';
import {Audio} from '@remotion/media';
import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
export const SHOWCASE_DURATION_IN_FRAMES = 3274;
const AUDIO_SRC = 'audio/livestream-sales.mp3';

type SceneSpec = {
  image: string;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  duration: number;
};

const scenes: SceneSpec[] = [
  {
    image: 'showcase/homepage-en.png',
    label: 'Website Home',
    title: 'PolkaStream',
    subtitle: 'Stablecoin streaming payments on Polkadot Hub',
    accent: '#34d399',
    duration: 420,
  },
  {
    image: 'showcase/pink-console-01.png',
    label: 'Console Overview',
    title: 'Streams and AI Settlement',
    subtitle: 'One pink interface for stream usage, balances, and retry status',
    accent: '#60a5fa',
    duration: 460,
  },
  {
    image: 'showcase/pink-console-02.png',
    label: 'Connected Wallet',
    title: 'Usage Per Stream',
    subtitle: 'After wallet connection, live data appears in the console',
    accent: '#22d3ee',
    duration: 470,
  },
  {
    image: 'showcase/pink-create-01.png',
    label: 'Create Stream',
    title: 'Create Stream Modal',
    subtitle: 'Configure receiver, token, deposit and duration in one flow',
    accent: '#f472b6',
    duration: 470,
  },
  {
    image: 'showcase/pink-create-02.png',
    label: 'Onchain Submit',
    title: 'Budget Locked, Value Released Over Time',
    subtitle: 'The transaction submits while preflight checks stay visible',
    accent: '#f59e0b',
    duration: 500,
  },
  {
    image: 'showcase/pink-later-03.png',
    label: 'Settlement Surface',
    title: 'Retry Notify and Settlement Visibility',
    subtitle: 'Failed notify handling remains explicit and recoverable',
    accent: '#a78bfa',
    duration: 470,
  },
  {
    image: 'showcase/homepage-en.png',
    label: 'Final',
    title: 'Streaming Payments First',
    subtitle: 'AI Agent Settlement is the flagship scenario',
    accent: '#d0e46e',
    duration: 484,
  },
];

type Subtitle = {start: number; end: number; text: string};

const subtitles: Subtitle[] = [
  {start: 0.2, end: 5.2, text: 'PolkaStream is a stablecoin streaming payments protocol.'},
  {start: 5.2, end: 10.2, text: 'The homepage keeps the core message: streaming payments first.'},
  {start: 10.2, end: 15.5, text: 'Connect a wallet and move into the pink console surface.'},
  {start: 15.5, end: 21.2, text: 'Stream lifecycle controls are visible and explicit.'},
  {start: 21.2, end: 27.2, text: 'Create Stream sets receiver, token, deposit, and duration.'},
  {start: 27.2, end: 33.2, text: 'Budget is locked once and value releases linearly over time.'},
  {start: 33.2, end: 39.2, text: 'Receivers withdraw claimable balances when needed.'},
  {start: 39.2, end: 45.2, text: 'If notify fails, operators can retry with clear feedback.'},
  {start: 45.2, end: 51.2, text: 'Settlement visibility stays in one operational surface.'},
  {start: 51.2, end: 57.2, text: 'Wallet and network signals stay visible during execution.'},
  {start: 57.2, end: 63.2, text: 'This demo is live on Polkadot Hub Testnet.'},
  {start: 63.2, end: 69.2, text: 'AI Agent Settlement is the flagship scenario, not the category.'},
  {start: 69.2, end: 76.2, text: 'An optional sidecar supports request-level batched settlement.'},
  {start: 76.2, end: 84.2, text: 'The main flow remains stream creation, claimability, and withdraw.'},
  {start: 84.2, end: 92.2, text: 'Continuous services get continuous, auditable payment rails.'},
  {start: 92.2, end: 100.2, text: 'This gives tighter budget control and clearer onchain evidence.'},
  {start: 100.2, end: 108.8, text: 'PolkaStream is a demo-ready prototype with deployment evidence.'},
];

const transitionFrames = 20;

const sceneSum = scenes.reduce((acc, scene) => acc + scene.duration, 0);
if (sceneSum !== SHOWCASE_DURATION_IN_FRAMES) {
  throw new Error(`Scene duration mismatch: ${sceneSum} !== ${SHOWCASE_DURATION_IN_FRAMES}`);
}

const pseudo = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const ParticleField: React.FC<{frame: number; bass: number}> = ({frame, bass}) => {
  return (
    <>
      {Array.from({length: 72}).map((_, idx) => {
        const px = pseudo(idx + 1) * 1920;
        const speed = 14 + pseudo(idx + 2) * 70;
        const py = ((pseudo(idx + 3) * 1400 + frame * speed) % 1400) - 180;
        const size = 1.4 + pseudo(idx + 4) * 3.6;
        const alpha = 0.1 + pseudo(idx + 5) * 0.42 + bass * 0.25;
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: size,
              height: size,
              borderRadius: 999,
              background: idx % 3 === 0 ? '#ffffff' : idx % 3 === 1 ? '#a5b4fc' : '#67e8f9',
              opacity: Math.min(alpha, 0.82),
              boxShadow: `0 0 ${8 + bass * 60}px rgba(103, 232, 249, 0.45)`,
            }}
          />
        );
      })}
    </>
  );
};

const SubtitleBar: React.FC<{frame: number}> = ({frame}) => {
  const now = frame / FPS;
  const active = subtitles.find((line) => now >= line.start && now < line.end);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 66,
        transform: 'translateX(-50%)',
        borderRadius: 14,
        background: 'rgba(8, 15, 30, 0.72)',
        border: '1px solid rgba(148,163,184,0.35)',
        padding: '9px 16px',
        color: 'rgba(248,250,252,0.96)',
        fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
        fontSize: 22,
        lineHeight: 1.25,
        letterSpacing: 0.1,
        backdropFilter: 'blur(8px)',
      }}
    >
      {active.text}
    </div>
  );
};

const BeatBars: React.FC<{frequencies: number[]}> = ({frequencies}) => {
  const bars = frequencies.slice(0, 32);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom: 22,
        height: 28,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      {bars.map((value, i) => {
        const h = 4 + Math.pow(value, 0.9) * 24;
        return (
          <div
            key={`bar-${i}`}
            style={{
              flex: 1,
              height: h,
              borderRadius: 999,
              opacity: 0.85,
              background: 'linear-gradient(180deg, #67e8f9 0%, #a78bfa 55%, #f472b6 100%)',
            }}
          />
        );
      })}
    </div>
  );
};

const SceneLayer: React.FC<{
  scene: SceneSpec;
  index: number;
  bass: number;
  pulse: number;
}> = ({scene, index, bass, pulse}) => {
  const frame = useCurrentFrame();

  const imgScale = interpolate(frame, [0, scene.duration], [1.07, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const panX = interpolate(frame, [0, scene.duration], [34, -20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const panelY = interpolate(frame, [0, 30], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const panelOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleScale = 1 + bass * 0.06 + pulse * 0.015;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${panX}px) scale(${imgScale})`,
          transformOrigin: 'center center',
        }}
      >
        <Img src={staticFile(scene.image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(3,9,20,0.18) 0%, rgba(3,9,20,0.58) 54%, rgba(2,6,23,0.84) 100%)',
        }}
      />

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(96,165,250,0.22), transparent 36%), radial-gradient(circle at 88% 76%, rgba(244,114,182,0.24), transparent 34%)',
          mixBlendMode: 'screen',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 68,
          borderRadius: 999,
          border: `1px solid ${scene.accent}`,
          padding: '10px 16px',
          color: 'white',
          fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 0.4,
          backgroundColor: 'rgba(15, 23, 42, 0.56)',
          opacity: panelOpacity,
          transform: `translateY(${panelY}px)`,
        }}
      >
        {scene.label}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          bottom: 152,
          opacity: panelOpacity,
          transform: `translateY(${panelY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'SF Pro Display, Inter, system-ui, sans-serif',
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.02,
            transform: `scale(${titleScale})`,
            transformOrigin: 'left bottom',
            backgroundImage: 'linear-gradient(90deg, #f8fafc 0%, #67e8f9 38%, #a78bfa 68%, #f472b6 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: `0 0 ${18 + bass * 90}px rgba(167, 139, 250, 0.35)`,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
            fontSize: 34,
            color: 'rgba(226,232,240,0.94)',
            maxWidth: 1200,
            lineHeight: 1.35,
          }}
        >
          {scene.subtitle}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 72,
          top: 68,
          borderRadius: 999,
          background: 'rgba(8, 15, 30, 0.54)',
          border: '1px solid rgba(148,163,184,0.34)',
          color: 'rgba(226,232,240,0.96)',
          fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 0.4,
          padding: '10px 16px',
        }}
      >
        Scene {String(index + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

export const ShowcaseVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const {audioData, dataOffsetInSeconds} = useWindowedAudioData({
    src: staticFile(AUDIO_SRC),
    frame,
    fps,
    windowInSeconds: 24,
  });

  const frequencies = audioData
    ? visualizeAudio({
        fps,
        frame,
        audioData,
        numberOfSamples: 64,
        optimizeFor: 'speed',
        dataOffsetInSeconds,
      })
    : Array.from({length: 64}, () => 0);

  const bassBucket = frequencies.slice(0, 12);
  const bass = bassBucket.length
    ? bassBucket.reduce((acc, value) => acc + value, 0) / bassBucket.length
    : 0;
  const pulse = Math.max(
    interpolate(frame % 15, [0, 7, 15], [0.65, 1, 0.65], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    0.7 + bass * 0.3
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#020617'}}>
      <Audio src={staticFile(AUDIO_SRC)} />

      <TransitionSeries>
        {scenes.map((scene, index) => (
          <React.Fragment key={scene.label}>
            <TransitionSeries.Sequence durationInFrames={scene.duration}>
              <SceneLayer scene={scene} index={index} bass={bass} pulse={pulse} />
            </TransitionSeries.Sequence>
            {index < scenes.length - 1 ? (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({durationInFrames: transitionFrames})}
              />
            ) : null}
          </React.Fragment>
        ))}
      </TransitionSeries>

      <ParticleField frame={frame} bass={bass} />
      <SubtitleBar frame={frame} />
      <BeatBars frequencies={frequencies} />
    </AbsoluteFill>
  );
};
