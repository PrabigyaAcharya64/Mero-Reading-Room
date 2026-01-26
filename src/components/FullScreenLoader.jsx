import LoadingSpinner from './LoadingSpinner';
import '../styles/FullScreenLoader.css';

const FullScreenLoader = () => {
    return (
        <div className="splash-screen">
            <div className="splash-content">
                <LoadingSpinner size="50" stroke="3" speed="1.2" color="var(--color-primary, #0d6efd)" />
                <p style={{
                    marginTop: '20px',
                    fontSize: '0.9rem',
                    color: '#666',
                    fontWeight: '500',
                    letterSpacing: '0.05em'
                }}>
                    MERO READING ROOM
                </p>
            </div>
        </div>
    );
};

export default FullScreenLoader;
