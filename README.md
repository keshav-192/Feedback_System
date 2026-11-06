# Stakeholder Feedback System

Comprehensive, enterprise-grade Stakeholder Feedback Management & Analytical Reporting System built for academic institutions (NAAC & IQAC aligned).

## 🚀 Key Features

- **Dynamic Form Builder**: Drag-and-drop sections and questions, customized rating scales, linear grids, multiple choice, and open-ended feedback.
- **Global Options & Hierarchy**: Centrally managed reusable option sets (`options.json`) for Programs, Departments, Academic Years, and 5-Point Quality Scales.
- **Advanced Interactive Analytics**:
  - Response velocity & timeline distribution (Daily, Monthly, Cumulative spikes).
  - Multi-Year Institutional Performance (YoY Trendline & NAAC Grade tracking).
  - 5-Point Likert Quality Scales (Diverging Likert charts, Radar/Spider profiles, 100% Stacked horizontal bars).
  - Granular Date Range Filter with real-time validation.
- **Executive PowerPoint (PPTX) & Excel Export Engine**:
  - High-resolution client-side PowerPoint presentation export that faithfully mirrors the active view of every chart on screen.
  - Comprehensive question-by-question breakdown slides with metrics, counts, and percentages.
- **Role-Based Access**:
  - Secure Admin Dashboard with session handling and audit logging.
  - Responsive, clean student/stakeholder submission UI.

## 🛠️ Tech Stack

- **Backend**: PHP, MySQL (PDO)
- **Frontend**: HTML5, CSS3, Modern Vanilla JavaScript
- **Libraries**: Chart.js, PptxGenJS, SheetJS (XLSX)
- **Local Server**: XAMPP (Apache / MySQL)

## 📦 Setup & Installation

1. Clone or extract into your web root directory (e.g., `C:/xampp/htdocs/Stakeholder_Feedback`).
2. Import the MySQL database schema into MySQL (`iqac` database).
3. Update `configuration/config.php` with your database credentials.
4. Open in browser:
   - User Feedback: `http://localhost/Stakeholder_Feedback/`
   - Admin Dashboard: `http://localhost/Stakeholder_Feedback/admin/`

