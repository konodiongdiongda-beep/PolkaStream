import React from 'react';
import {Audio} from '@remotion/media';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
const TOTAL_DURATION_IN_FRAMES = 3274;

const sceneDurations = {
  intro: 330,
  problem: 360,
  create: 690,
  streamState: 510,
  retry: 480,
  settlement: 390,
  proof: 330,
  closing: 184,
} as const;

type ImageSceneProps = {
  src: string;
  kicker: string;
  title: string;
  body: string;
  caption: string;
  accent: string;
  dim?: number;
  children?: React.ReactNode;
};

const overlayGradient =
  'linear-gradient(180deg, rgba(10, 12, 18, 0.10) 0%, rgba(10, 12, 18, 0.28) 38%, rgba(10, 12, 18, 0.72) 100%)';

const shellTextColor = '#f8fafc';

const SceneChrome: React.FC<{
  kicker: string;
  title: string;
  body: string;
  caption: string;
  accent: string;
  children?: React.ReactNode;
}> = ({kicker, title, body, caption, accent, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rise = interpolate(
    spring({
      frame,
      fps,
      config: {damping: 140},
    }),
    [0, 1],
    [28, 0]
  );

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn,
        padding: 64,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: accent,
              boxShadow: `0 0 24px ${accent}`,
            }}
          />
          <div
            style={{
              fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 26,
              fontWeight: 700,
              color: shellTextColor,
              letterSpacing: 0.2,
            }}
          >
            PolkaStream
          </div>
        </div>
        <div
          style={{
            borderRadius: 999,
            border: `1px solid ${accent}`,
            backgroundColor: 'rgba(255,255,255,0.10)',
            padding: '10px 18px',
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: shellTextColor,
          }}
        >
          Polkadot Hub Testnet
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${rise}px)`,
          maxWidth: 860,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.16)',
            border: `1px solid ${accent}`,
            padding: '10px 16px',
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 18,
            fontWeight: 700,
            color: shellTextColor,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.02,
            color: shellTextColor,
            letterSpacing: -1.8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 28,
            lineHeight: 1.45,
            color: 'rgba(241,245,249,0.94)',
          }}
        >
          {body}
        </div>
        {children ? <div style={{marginTop: 26}}>{children}</div> : null}
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          borderRadius: 999,
          backgroundColor: 'rgba(15,23,42,0.72)',
          padding: '16px 24px',
          fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: shellTextColor,
          letterSpacing: 0.1,
          boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
};

const ScreenshotScene: React.FC<ImageSceneProps> = ({
  src,
  kicker,
  title,
  body,
  caption,
  accent,
  dim = 1,
  children,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 160], [1.03, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#120f17'}}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          opacity: dim,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: overlayGradient}} />
      <SceneChrome
        kicker={kicker}
        title={title}
        body={body}
        caption={caption}
        accent={accent}
      >
        {children}
      </SceneChrome>
    </AbsoluteFill>
  );
};

const CalloutRow: React.FC<{items: string[]; accent: string}> = ({items, accent}) => {
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 12}}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            borderRadius: 999,
            border: `1px solid ${accent}`,
            backgroundColor: 'rgba(255,255,255,0.14)',
            padding: '12px 18px',
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: shellTextColor,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
};

const StreamCapabilityCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: {damping: 130},
  });
  const translateY = interpolate(entrance, [0, 1], [46, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: 1020,
        borderRadius: 34,
        background:
          'linear-gradient(180deg, rgba(255,251,253,0.98) 0%, rgba(255,246,250,0.98) 100%)',
        border: '1px solid rgba(255, 205, 226, 0.9)',
        padding: 32,
        boxShadow: '0 34px 80px rgba(13, 17, 23, 0.16)',
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              backgroundColor: '#fef0f7',
              border: '1px solid #ffbdd7',
              padding: '8px 14px',
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#be2d73',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Current stream state
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 48,
              fontWeight: 700,
              color: '#101113',
              letterSpacing: -1.2,
            }}
          >
            Stream #3 • Active • mUSD
          </div>
          <div
            style={{
              marginTop: 12,
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 22,
              lineHeight: 1.45,
              color: 'rgba(16,17,19,0.68)',
              maxWidth: 620,
            }}
          >
            Budget is locked once, value accrues over time, and both sides keep explicit lifecycle
            controls on the stream.
          </div>
        </div>
        <div
          style={{
            borderRadius: 24,
            backgroundColor: '#101113',
            padding: '14px 18px',
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 18,
            fontWeight: 700,
            color: '#f8fafc',
          }}
        >
          Onchain
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginTop: 28}}>
        {[
          {label: 'Deposit', value: '120.00 mUSD'},
          {label: 'Claimable', value: '24.60 mUSD'},
          {label: 'Remaining', value: '95.40 mUSD'},
          {label: 'Duration', value: '1 day'},
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 24,
              backgroundColor: '#fff',
              border: '1px solid rgba(16,17,19,0.08)',
              padding: 22,
            }}
          >
            <div
              style={{
                fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: 'rgba(16,17,19,0.42)',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
                fontSize: 32,
                fontWeight: 700,
                color: '#101113',
                letterSpacing: -0.6,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{display: 'flex', gap: 12, marginTop: 26}}>
        {[
          {label: 'Withdraw', tone: '#101113', text: '#fff'},
          {label: 'Pause', tone: '#fff', text: '#101113'},
          {label: 'Resume', tone: '#fff', text: '#101113'},
          {label: 'Cancel', tone: '#fff', text: '#101113'},
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 999,
              padding: '14px 22px',
              backgroundColor: item.tone,
              border: item.tone === '#fff' ? '1px solid rgba(16,17,19,0.10)' : '1px solid #101113',
              color: item.text,
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 22,
          borderRadius: 24,
          backgroundColor: '#fff1f7',
          border: '1px solid #ffbfd8',
          padding: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#be2d73',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Retryable notifier recovery
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 22,
              lineHeight: 1.4,
              color: '#101113',
            }}
          >
            Notify failed on withdraw #2. The operator can retry explicitly instead of leaving failure
            handling invisible.
          </div>
        </div>
        <div
          style={{
            borderRadius: 999,
            padding: '16px 24px',
            backgroundColor: '#ff5ca4',
            color: '#fff',
            fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
            fontSize: 20,
            fontWeight: 700,
            boxShadow: '0 16px 34px rgba(255,92,164,0.24)',
          }}
        >
          Retry Notify
        </div>
      </div>
    </div>
  );
};

const SettlementExtensionCard: React.FC = () => {
  return (
    <div
      style={{
        width: 980,
        borderRadius: 34,
        background:
          'linear-gradient(180deg, rgba(255,252,253,0.98) 0%, rgba(255,246,250,0.98) 100%)',
        border: '1px solid rgba(255, 205, 226, 0.9)',
        padding: 34,
        boxShadow: '0 34px 80px rgba(13, 17, 23, 0.16)',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', gap: 28}}>
        <div style={{flex: 1}}>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              padding: '8px 14px',
              border: '1px solid #ffbdd7',
              backgroundColor: '#fff1f7',
              color: '#be2d73',
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Optional extension
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 46,
              fontWeight: 700,
              color: '#101113',
              letterSpacing: -1.1,
            }}
          >
            AI Agent Settlement sidecar
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 24,
              lineHeight: 1.45,
              color: 'rgba(16,17,19,0.68)',
            }}
          >
            The streaming core remains the product center. When usage becomes more frequent, the sidecar
            can aggregate request-level AI settlement without changing the payment rail underneath.
          </div>
        </div>

        <div
          style={{
            width: 300,
            borderRadius: 28,
            backgroundColor: '#101113',
            padding: 22,
            color: '#f8fafc',
          }}
        >
          <div
            style={{
              fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: 'rgba(248,250,252,0.64)',
            }}
          >
            Example window
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            {[
              ['Window', '30s'],
              ['Requests', '5'],
              ['Settlement tx', '2'],
              ['Core rail', 'Stream'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    color: 'rgba(248,250,252,0.58)',
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProofCard: React.FC = () => {
  return (
    <div
      style={{
        width: 1040,
        borderRadius: 36,
        background:
          'linear-gradient(180deg, rgba(255,251,253,0.98) 0%, rgba(255,246,250,0.98) 100%)',
        border: '1px solid rgba(255, 205, 226, 0.9)',
        padding: 36,
        boxShadow: '0 34px 80px rgba(13, 17, 23, 0.16)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          borderRadius: 999,
          backgroundColor: '#fef0f7',
          border: '1px solid #ffbdd7',
          padding: '8px 14px',
          fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          color: '#be2d73',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        Deployment evidence
      </div>

      <div
        style={{
          marginTop: 18,
          fontFamily: 'SF Pro Display, Avenir Next, Helvetica Neue, sans-serif',
          fontSize: 48,
          fontWeight: 700,
          color: '#101113',
          letterSpacing: -1.2,
        }}
      >
        Live on Polkadot Hub Testnet
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {[
          ['Network', 'polkadot-hub-testnet'],
          ['Chain ID', '420420417'],
          ['Contract', '0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D'],
          ['Frontend', 'polkastream-console.vercel.app'],
          ['Testnet release', '2026-03-10 Ready'],
          ['Review state', 'Contract tests + internal security review'],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              borderRadius: 24,
              backgroundColor: '#fff',
              border: '1px solid rgba(16,17,19,0.08)',
              padding: 22,
            }}
          >
            <div
              style={{
                fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: 'rgba(16,17,19,0.44)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: 'SF Pro Text, Avenir Next, Helvetica Neue, sans-serif',
                fontSize: label === 'Contract' || label === 'Frontend' ? 22 : 26,
                fontWeight: 700,
                lineHeight: 1.35,
                color: '#101113',
                wordBreak: 'break-word',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SubmissionVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#120f17'}}>
      <Audio src={staticFile('submission/voiceover.mp3')} />

      <Sequence from={0} durationInFrames={sceneDurations.intro} premountFor={FPS}>
        <ScreenshotScene
          src="submission/console-top.png"
          kicker="Core Product"
          title="Streaming Payments First"
          body="PolkaStream is a stablecoin streaming payments protocol built on Polkadot Hub EVM. AI Agent Settlement is the flagship scenario we use to demonstrate the product."
          caption="Streaming payments on Polkadot Hub EVM"
          accent="#d0e46e"
        >
          <CalloutRow
            accent="#d0e46e"
            items={['Stablecoin streams', 'Onchain lifecycle control', 'Polkadot Hub Testnet']}
          />
        </ScreenshotScene>
      </Sequence>

      <Sequence
        from={sceneDurations.intro}
        durationInFrames={sceneDurations.problem}
        premountFor={FPS}
      >
        <ScreenshotScene
          src="submission/console-top.png"
          kicker="Problem"
          title="Continuous services still meet coarse payments"
          body="Digital services are becoming more real-time, but payment flows are still often upfront, one-off, or manually reconciled. That mismatch makes automation and budget control harder than it should be."
          caption="Continuous services need continuous payments"
          accent="#ff8dbb"
        >
          <CalloutRow
            accent="#ff8dbb"
            items={['Upfront transfers', 'Manual settlement', 'Weak budget controls']}
          />
        </ScreenshotScene>
      </Sequence>

      <Sequence
        from={sceneDurations.intro + sceneDurations.problem}
        durationInFrames={sceneDurations.create}
        premountFor={FPS}
      >
        <AbsoluteFill style={{backgroundColor: '#120f17'}}>
          <Sequence from={0} durationInFrames={360} premountFor={FPS}>
            <ScreenshotScene
              src="submission/create-modal.png"
              kicker="Create Flow"
              title="Lock budget once, release value continuously"
              body="The payer sets the receiver, token, deposit, duration, and optional cliff. Once created, funds are locked in the contract and released linearly over time."
              caption="Lock budget once • Release value continuously"
              accent="#ff72ad"
            />
          </Sequence>
          <Sequence from={300} durationInFrames={sceneDurations.create - 300} premountFor={FPS}>
            <ScreenshotScene
              src="submission/create-submitting.png"
              kicker="Onchain Action"
              title="Programmable, visible, and verifiable"
              body="Preflight checks run before execution so the payment flow is easier to validate, and the create transaction follows a straightforward approval plus stream creation path."
              caption="Preflight checks before stream creation"
              accent="#79e0cf"
            />
          </Sequence>
        </AbsoluteFill>
      </Sequence>

      <Sequence
        from={sceneDurations.intro + sceneDurations.problem + sceneDurations.create}
        durationInFrames={sceneDurations.streamState}
        premountFor={FPS}
      >
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at top left, rgba(255,92,164,0.22), transparent 34%), linear-gradient(180deg, #130f16 0%, #19131d 100%)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneChrome
            kicker="Lifecycle"
            title="Live stream state with explicit controls"
            body="Once a stream is running, the receiver can withdraw accrued value in real time, while the sender can pause, resume, or cancel depending on state."
            caption="Live stream state • withdraw / pause / resume / cancel"
            accent="#ff8dbb"
          >
            <StreamCapabilityCard />
          </SceneChrome>
        </AbsoluteFill>
      </Sequence>

      <Sequence
        from={
          sceneDurations.intro +
          sceneDurations.problem +
          sceneDurations.create +
          sceneDurations.streamState
        }
        durationInFrames={sceneDurations.retry}
        premountFor={FPS}
      >
        <ScreenshotScene
          src="submission/usage-surface.png"
          kicker="Recovery Path"
          title="Retryable notifier failure handling"
          body="Failure recovery is surfaced as an explicit operation. Instead of hiding a failed notify in the background, the operator can identify it and trigger a retry."
          caption="Retry failed notify"
          accent="#ffd36c"
        >
          <CalloutRow accent="#ffd36c" items={['Visible failure path', 'Explicit retry action', 'Operational clarity']} />
        </ScreenshotScene>
      </Sequence>

      <Sequence
        from={
          sceneDurations.intro +
          sceneDurations.problem +
          sceneDurations.create +
          sceneDurations.streamState +
          sceneDurations.retry
        }
        durationInFrames={sceneDurations.settlement}
        premountFor={FPS}
      >
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at top right, rgba(208,228,110,0.20), transparent 30%), linear-gradient(180deg, #130f16 0%, #19131d 100%)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneChrome
            kicker="Flagship Scenario"
            title="AI Agent Settlement stays an extension, not the core"
            body="On top of the streaming core, we can attach an optional request-level batched settlement sidecar for higher-frequency AI usage without changing the core product identity."
            caption="Flagship scenario • AI Agent Settlement"
            accent="#d0e46e"
          >
            <SettlementExtensionCard />
          </SceneChrome>
        </AbsoluteFill>
      </Sequence>

      <Sequence
        from={
          sceneDurations.intro +
          sceneDurations.problem +
          sceneDurations.create +
          sceneDurations.streamState +
          sceneDurations.retry +
          sceneDurations.settlement
        }
        durationInFrames={sceneDurations.proof}
        premountFor={FPS}
      >
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at top left, rgba(255,92,164,0.18), transparent 32%), linear-gradient(180deg, #130f16 0%, #19131d 100%)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SceneChrome
            kicker="Proof"
            title="Deployment evidence is already archived"
            body="The current public-safe build is tied to Polkadot Hub Testnet deployment evidence, contract tests, invariant checks, and an internal security review."
            caption="Live on Polkadot Hub Testnet"
            accent="#79e0cf"
          >
            <ProofCard />
          </SceneChrome>
        </AbsoluteFill>
      </Sequence>

      <Sequence
        from={
          sceneDurations.intro +
          sceneDurations.problem +
          sceneDurations.create +
          sceneDurations.streamState +
          sceneDurations.retry +
          sceneDurations.settlement +
          sceneDurations.proof
        }
        durationInFrames={sceneDurations.closing}
        premountFor={FPS}
      >
        <ScreenshotScene
          src="submission/console-top.png"
          kicker="Closing"
          title="A programmable payment rail for continuous digital services"
          body="PolkaStream shows how Polkadot can support streaming payments first, with AI Agent Settlement as a strong scenario on top."
          caption="Thank you. This is PolkaStream."
          accent="#ff8dbb"
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export {SubmissionVideo, TOTAL_DURATION_IN_FRAMES};
