import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import MarksList from './MarksList';

const KmdSection = ({ kmdList, selectedKmd, marks, marksLoading, onKmdClick }) => {
  if (!kmdList || kmdList.length === 0) return null;

  return (
    <>
      <div className="kmd-section">
        <h2>КМД</h2>
        <div className="kmd-buttons">
          {kmdList.map((kmd) => (
            <button
              key={kmd.uuid}
              className={`kmd-button ${selectedKmd?.uuid === kmd.uuid ? 'active' : ''}`}
              onClick={() => onKmdClick(kmd)}
            >
              {kmd.num_kmd}
            </button>
          ))}
        </div>
      </div>

      {marksLoading && <LoadingDots />}
      <MarksList
        marks={marks}
        selectedKmd={selectedKmd}
        marksLoading={marksLoading}
      />
    </>
  );
};

export default KmdSection;
