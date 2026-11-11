export default function TrackSelector({ selectedTrack, onSelectTrack, disabled }) {
  const tracks = [
    { id: 'dsa', label: 'DSA Problem', enabled: true },
    { id: 'lld', label: 'System Design (LLD) (Coming Soon)', enabled: false }
  ];

  return (
    <div>
      {tracks.map((track) => (
        <button
          key={track.id}
          type="button"
          disabled={disabled || !track.enabled}
          onClick={() => onSelectTrack(track.id)}
        >
          {track.label}
        </button>
      ))}
    </div>
  );
}