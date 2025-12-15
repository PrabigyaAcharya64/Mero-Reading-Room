import LoadingSpinner from './LoadingSpinner';

const FullScreenLoader = ({ text = "Loading..." }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            gap: '20px'
        }}>
            <LoadingSpinner size="60" stroke="4" speed="1" color="var(--color-primary, #007bff)" />
            {text && (
                <p style={{
                    margin: 0,
                    fontSize: '16px',
                    color: '#666',
                    fontWeight: '500'
                }}>
                    {text}
                </p>
            )}
        </div>
    );
};

export default FullScreenLoader;
