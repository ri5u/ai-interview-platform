export default function LanguageSelector({ currentLanguage, onLanguageChange, disabled }) {
  const languages = [
    { id: 'cpp', title: 'C++', desc: 'STL & modern C++' },
    { id: 'python', title: 'Python', desc: 'Python 3 syntax' },
    { id: 'java', title: 'Java', desc: 'Strongly typed OOP' },
    { id: 'javascript', title: 'JavaScript', desc: 'ES2023+ runtime' },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2 className="modal-title">Select Programming Language</h2>
        <p className="modal-subtitle">
          Configures Monaco syntax highlighting and your interviewer&apos;s code review context.
        </p>

        <div className="option-grid option-grid-2col">
          {languages.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className="option-card"
              onClick={() => onLanguageChange(lang.id)}
            >
              <span className="option-card-title">{lang.title}</span>
              <span className="option-card-desc">{lang.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}