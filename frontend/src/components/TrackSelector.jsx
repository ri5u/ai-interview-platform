export default function TrackSelector({ selectedTrack, onSelectTrack, disabled }) {
  const tracks = [
    {
      id: 'dsa',
      title: 'Data Structures & Algorithms (DSA)', // Make sure this key is 'title'
      desc: 'Live algorithmic problem solving, edge cases, and complexity analysis.', // Make sure this is 'desc'
    },
    {
      id: 'lld',
      title: 'Low-Level Design (LLD)',
      desc: 'Object-oriented modeling, SOLID principles, and extensible class architecture.',
    },
  ];
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2 className="modal-title">Select Interview Track</h2>
        <p className="modal-subtitle">
          Choose the technical round format you want to practice today.
        </p>

        <div className="option-grid">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              className="option-card"
              onClick={() => onSelectTrack(track.id)}
            >
              <span className="option-card-title">{track.title}</span>
              <span className="option-card-desc">{track.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}