import { useState, useLayoutEffect } from 'react';
import { useLoading } from '../context/GlobalLoadingContext';
import '../styles/GetStarted.css';
import Button from '../components/Button';

const illustration = new URL('../assets/bwink_edu_08_single_02.jpg', import.meta.url).href;

/**
 * GetStarted Page
 * Enhanced UI with improved visual hierarchy and smooth CSS animations.
 * Design choices:
 * - Playfair Display for headline (warm, reading-focused feel)
 * - Staggered entrance animations for soft welcoming effect
 * - High contrast primary CTA for clear direction
 */
function GetStarted({ onGetStarted, onLogIn }) {
  const { setIsLoading } = useLoading();
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    const preloadResources = async () => {
      setIsLoading(true);
      try {
        await new Promise((resolve) => {
          const img = new Image();
          img.src = illustration;
          img.onload = resolve;
          img.onerror = resolve;
        });
      } catch (e) {
        console.error("Resource preload failed", e);
      } finally {
        setIsLoading(false);
        setIsReady(true);
      }
    };
    preloadResources();
  }, [setIsLoading]);

  if (!isReady) return null;

  return (
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
          <img
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
  );
}

export default GetStarted;