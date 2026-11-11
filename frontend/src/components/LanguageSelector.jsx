const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' }
];

export default function LanguageSelector({ currentLanguage, onLanguageChange, disabled }) {
  return (
    <div>
      <label htmlFor="language-select">Language: </label>
      <select
        id="language-select"
        value={currentLanguage}
        disabled={disabled}
        onChange={(e) => onLanguageChange(e.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}