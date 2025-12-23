import '../styles/GetStarted.css';

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

        <div className="gs-actions">
          <button 
            type="button" 
            className="gs-btn-primary" 
            onClick={onGetStarted}
            aria-label="Get started with Mero Reading Room"
          >
            Get Started
          </button>
          <button 
            type="button" 
            className="gs-btn-secondary" 
            onClick={onLogIn}
            aria-label="Log in to your account"
          >
            Log In
          </button>
        </div>
      </div>
    </section>
  );
}

export default GetStarted;