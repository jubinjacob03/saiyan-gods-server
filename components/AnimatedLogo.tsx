'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnimatedLogo() {
  const [stage, setStage] = useState<'flix' | 'strike' | 'kord'>('flix');

  useEffect(() => {
    // Animation sequence loop
    const sequence = async () => {
      // Show NexFlix for 3 seconds
      setStage('flix');
      await new Promise(r => setTimeout(r, 3000));
      
      // Strikethrough Flix for 1 second
      setStage('strike');
      await new Promise(r => setTimeout(r, 1000));
      
      // Show NexKord for 4 seconds
      setStage('kord');
      await new Promise(r => setTimeout(r, 4000));
      
      // Loop
      sequence();
    };

    sequence();
  }, []);

  return (
    <div className="flex text-[#e50914] text-3xl md:text-4xl font-extrabold uppercase tracking-wider select-none relative overflow-visible h-[40px] md:h-[48px] items-center">
      <span className="z-10">Nex</span>
      
      <div className="relative flex items-center ml-[2px]">
        <AnimatePresence mode="wait">
          {(stage === 'flix' || stage === 'strike') && (
            <motion.div
              key="flix"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative flex items-center"
            >
              <span>Flix</span>
              {/* Strikethrough line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: stage === 'strike' ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute left-0 right-0 h-1 bg-white top-1/2 -translate-y-1/2 origin-left z-20"
              />
            </motion.div>
          )}

          {stage === 'kord' && (
            <motion.div
              key="kord"
              initial={{ opacity: 0, y: 10, rotateX: -90 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative text-white flex items-center shadow-black drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            >
              Kord
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
