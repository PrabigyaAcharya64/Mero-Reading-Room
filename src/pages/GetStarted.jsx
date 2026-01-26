import { useLoading } from '../context/GlobalLoadingContext';
import '../styles/GetStarted.css';
import Button from '../components/Button';
import SmartImage from '../components/SmartImage';
import PageTransition from '../components/PageTransition';

const illustration = new URL('../assets/bwink_edu_08_single_02.jpg', import.meta.url).href;

/**
 * GetStarted Page
 * Enhanced with SmartImage for automatic global loading tracking
 * and PageTransition for a professional entry animation.
 */
function GetStarted({ onGetStarted, onLogIn }) {
  // We no longer need manual state for readiness as SmartImage handles it via GlobalLoadingContext

  return (
    <PageTransition>
      <section className="gs-container" aria-labelledby="gs-headline">
        <div className="gs-content">
          <header className="gs-header">
            <p className="gs-eyebrow">Mero Reading Room</p>
            <h1 id="gs-headline" className="gs-headline">
              Your space to focus.
            </h1>
            <p className="gs-subtext">
              Your community to grow. Your journey begins here.
            </p>
          </header>

          <div className="gs-image-container">
            <SmartImage
              className="gs-image"
              src={illustration}
              alt="Two readers sharing a moment outdoors in a cozy atmosphere"
            />
          </div>

          <div className="gs-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Button
              variant="primary"
              onClick={onGetStarted}
              aria-label="Get started with Mero Reading Room"
              fullWidth
              className="gs-btn-primary"
            >
              Get Started
            </Button>
            <Button
              variant="outline"
              onClick={onLogIn}
              aria-label="Log in to your account"
              fullWidth
              className="gs-btn-secondary"
            >
              Log In
            </Button>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

export default GetStarted;