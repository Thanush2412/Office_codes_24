# HackerRank Scraper

An Electron application for scraping HackerRank leaderboards and comparing users.

## Features

- Leaderboard Scraping:
  - Scrape leaderboard data from HackerRank contests
  - Configurable page range and sleep time
  - Export results to Excel
  - Progress tracking

- User Comparison:
  - Compare multiple users against a fixed username
  - Import usernames from Excel/CSV files
  - Export comparison results
  - Progress tracking

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm start
```

## Building

To build the application:

```bash
npm run build
```

This will create executables for your platform in the `dist` directory.

## Note

This application uses Playwright for web scraping. Make sure to comply with HackerRank's terms of service and rate limiting policies when using this tool.
