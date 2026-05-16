# 📚 Book Checker

A modern full-stack application to check book availability at **Mitcham Library (OneCard Network)**. It can scrape book titles from Goodreads lists or Reddit threads, extract details using AI, and search the library catalog with intelligent filtering.

## 🚀 Features

-   **Multi-Source Scraping:** Supports Goodreads lists and Reddit recommendation threads.
-   **AI-Powered Extraction:** Uses **Google Gemini** to intelligently extract book titles and authors from messy Reddit comments.
-   **Intelligent Library Search:** 
    *   Automatically cleans titles for better search accuracy.
    *   Applies a default **"Books" format filter** to exclude non-book media.
    *   Includes a robust **retry mechanism** and exponential backoff for reliable scraping.
-   **Local Management:**
    *   **Custom Lists:** Create and manage personal reading lists.
    *   **Search Archive:** Automatically saves search results as Markdown files for offline reference.
    *   **Image Caching:** Locally caches book covers to speed up repeat views.
-   **Modern UI:** A clean, responsive interface built with React and Tailwind CSS.

## 🛠️ Tech Stack

-   **Frontend:** React, Vite, Tailwind CSS, Lucide React, Axios, React Router.
-   **Backend:** Node.js, Express, TypeScript, Cheerio (scraping), Google Generative AI.
-   **Architecture:** Monorepo structure with automated development scripts.

## 📂 Project Structure

```text
.
├── book-checker/
│   ├── frontend/         # React + Vite application
│   ├── backend/          # Express + TypeScript API
│   ├── custom-lists/     # Locally stored user lists (JSON)
│   ├── saved-searches/   # Archive of past searches (Markdown)
│   └── public/           # Static assets and cached book covers
├── package.json          # Root scripts for monorepo management
└── library-config.md     # (Generated) Encrypted library & AI credentials
```

## 🚥 Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/lordee/book-checker.git
    cd book-checker
    ```

2.  **Install all dependencies:**
    ```bash
    npm run install:all
    ```

### Running with Docker

You can run the entire stack using Docker Compose:

```bash
docker-compose up --build
```

-   **Frontend:** `http://localhost` (Port 80)
-   **Backend:** `http://localhost:3001`

Data and book covers are persisted via volumes in the `book-checker/` directory.

## ⚙️ Configuration

The application stores settings in `library-config.md` in the root directory. You can configure these directly in the UI via the **Settings (gear icon)**:

1.  **Library Credentials:** Used for placing holds (Membership Code and PIN).
2.  **Gemini API Key:** (Optional) Required for smart extraction from Reddit threads. Get one for free at [Google AI Studio](https://aistudio.google.com/).

## 📖 License

MIT
