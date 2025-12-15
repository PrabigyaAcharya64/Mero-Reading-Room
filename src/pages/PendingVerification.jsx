function PendingVerification() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>✓</div>
          <h2 style={{ marginBottom: '20px', color: '#4a4' }}>
            Your Request Has Been Submitted
          </h2>
          <p style={{ marginBottom: '15px', fontSize: '16px', lineHeight: '1.6', color: '#333' }}>
            Thank you for completing your profile. Your information has been successfully submitted for admin verification.
          </p>
          <p style={{ marginBottom: '15px', fontSize: '16px', lineHeight: '1.6', color: '#333' }}>
            <strong>Please login after 30-45 minutes.</strong>
          </p>
          <p style={{ marginBottom: '30px', fontSize: '14px', lineHeight: '1.6', color: '#666' }}>
            If you are unable to login after the given time, please contact us at{' '}
            <a href="tel:9867666655" style={{ color: '#0066cc', textDecoration: 'none' }}>
              9867666655
            </a>
          </p>
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f0f8ff', 
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#0066cc' }}>
              We will review your information and verify your account shortly. You will be able to access all features once your account is verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PendingVerification;

