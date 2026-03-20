import {Composition} from 'remotion';
import {INTRO_DURATION_IN_FRAMES, IntroVideo} from './IntroVideo';
import {MOTION_DASH_DURATION, MotionDataVideo} from './MotionDataVideo';
import {SHOWCASE_DURATION_IN_FRAMES, ShowcaseVideo} from './ShowcaseVideo';
import {SubmissionVideo, TOTAL_DURATION_IN_FRAMES} from './SubmissionVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PolkaStreamIntroEn"
        component={IntroVideo}
        durationInFrames={INTRO_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PolkaStreamMotionDataBoard"
        component={MotionDataVideo}
        durationInFrames={MOTION_DASH_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PolkaStreamSubmissionVideo"
        component={SubmissionVideo}
        durationInFrames={TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PolkaStreamShowcaseCN"
        component={ShowcaseVideo}
        durationInFrames={SHOWCASE_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
