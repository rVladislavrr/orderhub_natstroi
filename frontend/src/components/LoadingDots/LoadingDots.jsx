import './LoadingDots.css';

const LoadingDots = ({ inline = false }) => {
  return (
    <div className={inline ? 'loading-dots-wrapper--inline' : 'loading-dots-wrapper'}>
      <div className="loading-dots">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    </div>
  );
};

export default LoadingDots;
