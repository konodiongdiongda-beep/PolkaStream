import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';

type Slide = {
  image: string;
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
};

const slides: Slide[] = [
  {
    image: 'slides/01-dashboard.png',
    title: 'Dashboard Overview',
    subtitle: 'Track preflight checks and stream health in one command center.',
    tag: 'Overview',
    accent: '#8B5CF6',
  },
  {
    image: 'slides/02-streams.png',
    title: 'Stream Explorer',
    subtitle: 'Monitor active, paused, and canceled payment streams in real time.',
    tag: 'Operations',
    accent: '#22D3EE',
  },
  {
    image: 'slides/03-create-stream.png',
    title: 'Create Stream',
    subtitle: 'Set recipient, token, deposit, and duration with on-chain precision.',
    tag: 'Setup',
    accent: '#34D399',
  },
  {
    image: 'slides/04-settlements.png',
    title: 'Settlement Ledger',
    subtitle: 'Audit payout records and delivery status from one settlement table.',
    tag: 'Finance',
    accent: '#F59E0B',
  },
  {
    image: 'slides/05-settings.png',
    title: 'Settings & Network',
    subtitle: 'Control language, network, RPC endpoint, and contract references.',
    tag: 'Config',
    accent: '#F472B6',
  },
];

const SCENE_DURATION_IN_FRAMES = 120;
const TRANSITION_DURATION_IN_FRAMES = 20;

export const INTRO_DURATION_IN_FRAMES =
  slides.length * SCENE_DURATION_IN_FRAMES -
  (slides.length - 1) * TRANSITION_DURATION_IN_FRAMES;

const overlayStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(8,11,23,0.10) 0%, rgba(8,11,23,0.72) 64%, rgba(8,11,23,0.88) 100%)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'SF Pro Display, Inter, system-ui, sans-serif',
  fontSize: 70,
  fontWeight: 800,
  letterSpacing: 0.2,
  lineHeight: 1.08,
  color: '#F8FAFC',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
  fontSize: 34,
  lineHeight: 1.3,
  color: 'rgba(226, 232, 240, 0.95)',
  maxWidth: 1180,
  marginTop: 20,
};

const Scene: React.FC<{slide: Slide; index: number}> = ({slide, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: {damping: 200},
  });

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textTranslateY = interpolate(entrance, [0, 1], [36, 0]);
  const textOpacity = interpolate(entrance, [0, 1], [0, 1]);
  const imageScale = interpolate(frame, [0, SCENE_DURATION_IN_FRAMES], [1.03, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{opacity: fadeIn}}>
      <AbsoluteFill
        style={{
          transform: `scale(${imageScale})`,
          transformOrigin: 'center center',
        }}
      >
        <Img
          src={staticFile(slide.image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={overlayStyle} />

      <AbsoluteFill
        style={{
          padding: 60,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: slide.accent,
              boxShadow: `0 0 28px ${slide.accent}`,
            }}
          />
          <div
            style={{
              fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
              fontSize: 26,
              fontWeight: 700,
              color: 'rgba(248, 250, 252, 0.95)',
              letterSpacing: 0.3,
            }}
          >
            PolkaStream Console
          </div>
          <div
            style={{
              marginLeft: 14,
              fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
              fontSize: 21,
              fontWeight: 600,
              color: 'rgba(203, 213, 225, 0.95)',
              padding: '8px 16px',
              borderRadius: 999,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              border: `1px solid ${slide.accent}`,
            }}
          >
            {slide.tag}
          </div>
        </div>

        <div
          style={{
            transform: `translateY(${textTranslateY}px)`,
            opacity: textOpacity,
          }}
        >
          <div style={titleStyle}>{slide.title}</div>
          <div style={subtitleStyle}>{slide.subtitle}</div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'rgba(226, 232, 240, 0.9)',
            fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif',
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          <div>English UI • Polkadot Hub TestNet</div>
          <div>{String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const IntroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#0B1120'}}>
      <TransitionSeries>
        {slides.map((slide, index) => {
          return (
            <React.Fragment key={slide.image}>
              <TransitionSeries.Sequence durationInFrames={SCENE_DURATION_IN_FRAMES}>
                <Scene slide={slide} index={index} />
              </TransitionSeries.Sequence>
              {index < slides.length - 1 ? (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({
                    durationInFrames: TRANSITION_DURATION_IN_FRAMES,
                  })}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
