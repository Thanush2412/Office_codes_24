import React from 'react';

function SEOResult({ seoResults, error }) {
  return (
    <div className="results-container">
      {error && <p className="error">{error}</p>}

      {seoResults.length > 0 ? (
        <div>
          <h2>SEO Suggestions</h2>
          <ul>
            {seoResults.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No suggestions yet. Please submit your article for analysis.</p>
      )}
    </div>
  );
}

export default SEOResult;
