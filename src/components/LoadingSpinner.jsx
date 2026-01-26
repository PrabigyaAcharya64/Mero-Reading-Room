import React from 'react';
import { Waveform } from 'ldrs/react';
import 'ldrs/react/Waveform.css';

const LoadingSpinner = ({ size = "35", stroke = "3.5", speed = "1", color = "currentColor" }) => {
    return (
        <Waveform
            size={size}
            stroke={stroke}
            speed={speed}
            color={color}
        />
    );
};

export default LoadingSpinner;