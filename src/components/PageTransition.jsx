import React from 'react';
import { motion } from 'framer-motion';

/**
 * PageTransition
 * standardized entry animation for pages: pronounced bottom-to-top slide up.
 */
const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1] // Custom quint ease-out for a premium feel
            }}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
