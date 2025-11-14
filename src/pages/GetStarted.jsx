const illustration = new URL('../assets/bwink_edu_08_single_02.jpg', import.meta.url).href;

function GetStarted({ onGetStarted, onLogIn }) {
  return (
    <section className="intro-screen" aria-labelledby="intro-heading">
      <div className="intro-content">
        <p className="intro-eyebrow">Mero Reading Room</p>
        <img className="intro-image" src={illustration} alt="Two readers sharing a moment outdoors" />
        
        <p className="intro-subtext">
        Your space to focus. Your community to grow. Your journey begins here.
         </p>
      </div>
      <div className="intro-actions">
        <button type="button" className="cta-button cta-button--primary" onClick={onGetStarted}>
          Get Started
        </button>
        <button type="button" className="cta-button cta-button--secondary" onClick={onLogIn}>
          Log In
        </button>
      </div>
    </section>
  );
}

export default GetStarted;

