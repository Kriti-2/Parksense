import { useState, useRef } from 'react';

export default function TiltCard({ children, className = '', ...props }) {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Mouse position relative to the card's dimensions
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation factors
    // Max rotation is +/- 6 degrees for a subtle and elegant feel (not extreme)
    const rX = ((y / rect.height) - 0.5) * -12;
    const rY = ((x / rect.width) - 0.5) * 12;
    
    setCoords({ x: rX, y: rY });
    
    // Set custom CSS variables for the mouse position to drive the reflection/shine
    card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
  };

  const handleMouseEnter = () => setIsHovered(true);
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
    if (cardRef.current) {
      cardRef.current.style.setProperty('--mouse-x', '50%');
      cardRef.current.style.setProperty('--mouse-y', '50%');
    }
  };

  const style = {
    transform: isHovered
      ? `perspective(1000px) rotateX(${coords.x}deg) rotateY(${coords.y}deg) scale3d(1.015, 1.015, 1.015)`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: isHovered ? 'transform 0.05s ease-out' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`transform-gpu relative overflow-hidden transition-shadow duration-300 ${
        isHovered ? 'shadow-md border-command-accent/30' : 'shadow-sm'
      } ${className}`}
      {...props}
    >
      {/* Dynamic elegant glare effect (non-neon, soft white highlight reflection) */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.06)_0%,transparent_60%)]"
        style={{ opacity: isHovered ? 1 : 0 }}
      />
      {children}
    </div>
  );
}
