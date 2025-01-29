import React from "react";

const HashtagList = ({ hashtags }) => {
  return (
    <div>
      <h2>Generated Hashtags</h2>
      <ul>
        {hashtags.length > 0
          ? hashtags.map((hashtag, index) => <li key={index}>{hashtag}</li>)
          : "No hashtags generated yet."}
      </ul>
    </div>
  );
};

export default HashtagList;
